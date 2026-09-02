/* eslint-disable @typescript-eslint/no-explicit-any */
// Trial + Entitlement layer for Premium Modules.
// Commercial status (contract_status) and technical health are separate concepts.
// No billing / checkout here — contracting lives in Altech Control.
import { supabase } from '../../integrations/supabase/client'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'
import { safeCall, logger } from '../../utils/logger'

export { DEFAULT_TENANT_ID }

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export type TrialStatus = 'available' | 'active' | 'expiring' | 'expired' | 'converted' | 'cancelled'
export type EntitlementSource = 'trial' | 'contract'

export interface ModuleTrialRow {
  id: string
  tenant_id: string
  module_id: string
  started_at: string
  expires_at: string
  status: TrialStatus
  activated_by: string | null
  converted_at: string | null
  cancelled_at: string | null
  metadata: Record<string, unknown> | null
}

export interface ModuleEntitlementRow {
  id: string
  tenant_id: string
  module_id: string
  source: EntitlementSource
  status: 'active' | 'expired' | 'revoked'
  granted_at: string
  expires_at: string | null
  trial_id: string | null
}

async function writeAudit(
  entityId: string, action: string, after: Record<string, unknown> | null,
  actorName = 'Sistema',
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      tenant_id: getActiveTenantId(),
      entity_type: 'module',
      entity_id: entityId,
      action,
      actor_name: actorName,
      before: null,
      after: after as any,
    })
  } catch (err) {
    logger.error('moduleTrials.writeAudit', err, { entityId, action })
  }
}

/** Whole days remaining until the trial expires (never negative). */
export function daysRemaining(trial: { expires_at: string } | null | undefined): number {
  if (!trial) return 0
  const ms = new Date(trial.expires_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

async function setTenantModuleStatus(moduleId: string, contract_status: string): Promise<void> {
  const { data: existing } = await tbl('tenant_modules').select('id')
    .eq('tenant_id', getActiveTenantId()).eq('module_id', moduleId)
    .is('archived_at', null).maybeSingle()

  if (existing?.id) {
    await tbl('tenant_modules').update({ contract_status }).eq('id', existing.id)
  } else {
    await tbl('tenant_modules').insert({
      tenant_id: getActiveTenantId(), module_id: moduleId, contract_status,
    })
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────
async function listTrials__raw(): Promise<ModuleTrialRow[]> {
  const { data, error } = await tbl('module_trials').select('*')
    .eq('tenant_id', getActiveTenantId())
  if (error) throw new Error(`[module_trials] ${error.message}`)
  return (data ?? []) as ModuleTrialRow[]
}

export function listTrials(): Promise<ModuleTrialRow[]> {
  return safeCall('moduleTrials.listTrials', listTrials__raw, [])
}

/** Currently open (active/expiring) trial for a module, if any. */
export async function getActiveTrial(moduleId: string): Promise<ModuleTrialRow | null> {
  const rows = await listTrials()
  return rows.find(t => t.module_id === moduleId && (t.status === 'active' || t.status === 'expiring')) ?? null
}

async function listEntitlements__raw(): Promise<ModuleEntitlementRow[]> {
  const { data, error } = await tbl('module_entitlements').select('*')
    .eq('tenant_id', getActiveTenantId())
  if (error) throw new Error(`[module_entitlements] ${error.message}`)
  return (data ?? []) as ModuleEntitlementRow[]
}

export function listEntitlements(): Promise<ModuleEntitlementRow[]> {
  return safeCall('moduleTrials.listEntitlements', listEntitlements__raw, [])
}

export interface ModuleAccess {
  allowed: boolean
  source: EntitlementSource | null
  expires_at: string | null
}

/**
 * Tenant-level access: is there a live entitlement (trial or contract)?
 * NOTE: an entitlement is NOT a user permission — permission checks still apply.
 */
export async function getModuleAccess(moduleId: string): Promise<ModuleAccess> {
  const ents = await listEntitlements()
  const live = ents.find(e =>
    e.module_id === moduleId &&
    e.status === 'active' &&
    (!e.expires_at || new Date(e.expires_at).getTime() > Date.now()))
  return live
    ? { allowed: true, source: live.source, expires_at: live.expires_at }
    : { allowed: false, source: null, expires_at: null }
}

// ─── Start trial ──────────────────────────────────────────────────────────────
async function startTrial__raw(moduleId: string, actor?: { id?: string | null; name?: string }): Promise<ModuleTrialRow | null> {
  const existing = await getActiveTrial(moduleId)
  if (existing) return existing

  const { data: mod, error: modErr } = await tbl('modules')
    .select('id, trial_duration_days').eq('id', moduleId).maybeSingle()
  if (modErr) throw new Error(`[modules] ${modErr.message}`)
  const days = Number(mod?.trial_duration_days ?? 30) || 30

  const expires = new Date(Date.now() + days * 86_400_000).toISOString()

  const { data: trial, error: trialErr } = await tbl('module_trials').insert({
    tenant_id: getActiveTenantId(),
    module_id: moduleId,
    expires_at: expires,
    status: 'active',
    activated_by: actor?.id ?? null,
  }).select('*').single()
  if (trialErr) throw new Error(`[module_trials] ${trialErr.message}`)
  const row = trial as ModuleTrialRow

  const { error: entErr } = await tbl('module_entitlements').insert({
    tenant_id: getActiveTenantId(),
    module_id: moduleId,
    source: 'trial',
    status: 'active',
    expires_at: expires,
    trial_id: row.id,
    created_by: actor?.id ?? null,
  })
  if (entErr) throw new Error(`[module_entitlements] ${entErr.message}`)

  await setTenantModuleStatus(moduleId, 'trialing')
  await writeAudit(moduleId, 'module_trial_started',
    { trial_id: row.id, expires_at: expires, duration_days: days }, actor?.name ?? 'Sistema')

  return row
}

export function startTrial(
  moduleId: string, actor?: { id?: string | null; name?: string },
): Promise<ModuleTrialRow | null> {
  return safeCall('moduleTrials.startTrial', () => startTrial__raw(moduleId, actor), null, { moduleId })
}

// ─── Cancel trial (admin / override) ─────────────────────────────────────────
async function cancelTrial__raw(moduleId: string, actor?: { name?: string }): Promise<boolean> {
  const trial = await getActiveTrial(moduleId)
  if (!trial) return false

  const now = new Date().toISOString()
  const { error } = await tbl('module_trials')
    .update({ status: 'cancelled', cancelled_at: now }).eq('id', trial.id)
  if (error) throw new Error(`[module_trials] ${error.message}`)

  await tbl('module_entitlements').update({ status: 'revoked' }).eq('trial_id', trial.id)
  await setTenantModuleStatus(moduleId, 'trial_available')
  await writeAudit(moduleId, 'module_trial_cancelled', { trial_id: trial.id }, actor?.name ?? 'Sistema')
  return true
}

export function cancelTrial(moduleId: string, actor?: { name?: string }): Promise<boolean> {
  return safeCall('moduleTrials.cancelTrial', () => cancelTrial__raw(moduleId, actor), false, { moduleId })
}

// ─── Reconcile expiries (called on screen load) ──────────────────────────────
async function reconcileExpiries__raw(): Promise<void> {
  const trials = await listTrials()
  const now = Date.now()

  for (const t of trials) {
    if (t.status !== 'active' && t.status !== 'expiring') continue
    const exp = new Date(t.expires_at).getTime()

    if (exp <= now) {
      await tbl('module_trials').update({ status: 'expired' }).eq('id', t.id)
      await tbl('module_entitlements').update({ status: 'expired' }).eq('trial_id', t.id)
      await setTenantModuleStatus(t.module_id, 'trial_expired')
      await writeAudit(t.module_id, 'module_trial_expired', { trial_id: t.id })
      continue
    }

    const daysLeft = Math.ceil((exp - now) / 86_400_000)
    const alreadyFlagged = Boolean((t.metadata as any)?.expiring_notified)
    if (daysLeft <= 3 && !alreadyFlagged) {
      await tbl('module_trials').update({
        status: 'expiring',
        metadata: { ...(t.metadata ?? {}), expiring_notified: true },
      }).eq('id', t.id)
      await writeAudit(t.module_id, 'module_trial_expiring', { trial_id: t.id, days_left: daysLeft })
    }
  }
}

export function reconcileExpiries(): Promise<void> {
  return safeCall('moduleTrials.reconcileExpiries', reconcileExpiries__raw, undefined)
}
