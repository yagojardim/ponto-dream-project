/* eslint-disable @typescript-eslint/no-explicit-any */
// Módulos Premium data access layer — reads the global `modules` catalog and the
// per-tenant `tenant_modules` state, and records activation requests in
// `module_activation_requests`. Every write also writes to `audit_logs`.
// Activation is NEVER granted automatically: requests only set status 'pending'.
import { supabase } from '../../integrations/supabase/client'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'
import { safeCall, logger } from '../../utils/logger'
import { MODULE_CATALOG, type ModuleCategory, type ModuleStatus } from '../modules'

export { DEFAULT_TENANT_ID }

type ModuleTable = 'modules' | 'tenant_modules' | 'module_activation_requests'

function tbl(name: ModuleTable): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

// ─── Row types ────────────────────────────────────────────────────────────────
export interface ModuleCatalogRow {
  id: string
  key: string
  name: string
  description: string | null
  category: string | null
  module_type: string | null
  is_premium: boolean
  is_future: boolean
  is_preview: boolean
  default_status: string
  display_order: number
  icon: string | null
  trial_duration_days?: number | null
}

export interface TenantModuleRow {
  id: string
  tenant_id: string
  module_id: string
  status: string
  requested_at: string | null
  requested_by: string | null
  approved_at: string | null
  suspended_reason: string | null
  metadata: Record<string, unknown> | null
}

export type RequestPriority = 'low' | 'medium' | 'high' | 'critical'

export interface ActivationRequestRow {
  id: string
  tenant_id: string
  module_id: string
  requested_by: string | null
  request_status: string
  business_reason: string | null
  expected_use: string | null
  priority: RequestPriority
  notes: string | null
  created_at: string
}

/** A catalog module merged with the current tenant's activation state. */
export interface ModuleView {
  id: string
  key: string
  name: string
  tagline: string
  description: string
  category: ModuleCategory
  icon: string
  is_premium: boolean
  is_future: boolean
  is_preview: boolean
  features: string[]
  status: ModuleStatus
  suspended_reason: string | null
  notes: string | null
  requested_at: string | null
  cta: ModuleCta
  contract_status: ContractStatus
  technical_health: TechnicalHealth
  trial_duration_days: number
}

export type ContractStatus =
  | 'included' | 'trial_available' | 'trialing' | 'trial_expired' | 'pending_activation'
  | 'active' | 'past_due' | 'suspended' | 'not_contracted' | 'planned'

export type TechnicalHealth = 'operational' | 'degraded' | 'maintenance' | 'unavailable'

const CONTRACT_STATUSES: ContractStatus[] = [
  'included', 'trial_available', 'trialing', 'trial_expired', 'pending_activation',
  'active', 'past_due', 'suspended', 'not_contracted', 'planned',
]

function normalizeContract(raw: unknown, fallback: ModuleStatus): ContractStatus {
  const k = String(raw ?? '').trim()
  if ((CONTRACT_STATUSES as string[]).includes(k)) return k as ContractStatus
  switch (fallback) {
    case 'operational':
    case 'implemented':  return 'included'
    case 'contracted':
    case 'deploying':    return 'active'
    case 'pending':      return 'pending_activation'
    case 'planned':
    case 'coming-soon':  return 'planned'
    case 'suspended':    return 'suspended'
    case 'preview':      return 'included'
    default:             return 'trial_available'
  }
}

function normalizeHealth(raw: unknown): TechnicalHealth {
  const k = String(raw ?? '').trim()
  return (['operational', 'degraded', 'maintenance', 'unavailable'] as string[]).includes(k)
    ? (k as TechnicalHealth) : 'operational'
}

export interface ModuleCta {
  label: string
  action: 'open' | 'preview' | 'request' | 'details' | 'reason' | 'none'
}

const VALID_STATUS: ModuleStatus[] = [
  'operational', 'implemented', 'contracted', 'deploying', 'pending',
  'not-contracted', 'planned', 'coming-soon', 'preview', 'suspended', 'unavailable',
]

const STATUS_ALIASES: Record<string, ModuleStatus> = {
  implementado: 'implemented',
  operacional: 'operational',
  contratado: 'contracted',
  'nao-contratado': 'not-contracted',
  solicitado: 'pending',
  planejado: 'planned',
  'em-breve': 'coming-soon',
  suspenso: 'suspended',
}

export function normalizeStatus(raw: string | null | undefined): ModuleStatus {
  if (!raw) return 'not-contracted'
  const k = raw.trim().toLowerCase()
  if ((VALID_STATUS as string[]).includes(k)) return k as ModuleStatus
  return STATUS_ALIASES[k] ?? 'not-contracted'
}

const VALID_CATEGORIES: ModuleCategory[] = [
  'intelligence', 'integration', 'external', 'community', 'governance', 'security',
]

function normalizeCategory(raw: string | null): ModuleCategory {
  const k = (raw ?? '').trim().toLowerCase() as ModuleCategory
  return VALID_CATEGORIES.includes(k) ? k : 'integration'
}

export function ctaFor(status: ModuleStatus): ModuleCta {
  switch (status) {
    case 'operational':     return { label: 'Acessar módulo',            action: 'open' }
    case 'implemented':     return { label: 'Abrir / Configurar',        action: 'open' }
    case 'contracted':
    case 'deploying':       return { label: 'Acompanhar implantação',    action: 'details' }
    case 'pending':         return { label: 'Solicitado — Pendente',     action: 'none' }
    case 'not-contracted':  return { label: 'Solicitar ativação',        action: 'request' }
    case 'preview':         return { label: 'Ver preview',               action: 'preview' }
    case 'planned':         return { label: 'Ver detalhes',              action: 'details' }
    case 'coming-soon':     return { label: 'Ver detalhes',              action: 'details' }
    case 'suspended':       return { label: 'Ver motivo',                action: 'reason' }
    case 'unavailable':     return { label: 'Indisponível',              action: 'none' }
  }
}

/** Editorial copy (tagline + feature bullets) lives in the front-end catalog. */
function copyFor(key: string) {
  return MODULE_CATALOG.find(m => m.key === key)
}

function moduleError(table: string, message: string): Error {
  return new Error(`[${table}] ${message}`)
}

// ─── Audit ────────────────────────────────────────────────────────────────────
async function writeAudit(
  entityId: string, action: string, actorName: string,
  after: Record<string, unknown> | null,
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
    logger.error('modules.writeAudit', err, { entityId, action })
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────
async function listModules__raw(): Promise<ModuleView[]> {
  const { data: cat, error: catErr } = await tbl('modules').select('*')
    .is('archived_at', null).order('display_order', { ascending: true })
  if (catErr) throw moduleError('modules', catErr.message)

  const { data: tm, error: tmErr } = await tbl('tenant_modules').select('*')
    .eq('tenant_id', getActiveTenantId()).is('archived_at', null)
  if (tmErr) throw moduleError('tenant_modules', tmErr.message)

  const byModule = new Map<string, TenantModuleRow>()
  for (const row of (tm ?? []) as TenantModuleRow[]) byModule.set(row.module_id, row)

  return ((cat ?? []) as ModuleCatalogRow[]).map(m => {
    const state = byModule.get(m.id)
    const status = normalizeStatus(state?.status ?? m.default_status)
    const copy = copyFor(m.key)
    return {
      id: m.id,
      key: m.key,
      name: m.name,
      tagline: copy?.tagline ?? (m.description ?? ''),
      description: m.description ?? copy?.description ?? '',
      category: normalizeCategory(m.category),
      icon: m.icon ?? copy?.icon ?? '📦',
      is_premium: m.is_premium,
      is_future: m.is_future,
      is_preview: m.is_preview,
      features: copy?.features ?? [],
      status,
      suspended_reason: state?.suspended_reason ?? null,
      notes: (state?.metadata?.notes as string | undefined) ?? null,
      requested_at: state?.requested_at ?? null,
      cta: ctaFor(status),
      contract_status: normalizeContract((state as any)?.contract_status, status),
      technical_health: normalizeHealth((state as any)?.technical_health),
      trial_duration_days: Number((m as any).trial_duration_days ?? 30) || 30,
    }
  })
}

export function listModules(): Promise<ModuleView[]> {
  return safeCall('modules.listModules', listModules__raw, [])
}

async function listActivationRequests__raw(): Promise<ActivationRequestRow[]> {
  const { data, error } = await tbl('module_activation_requests').select('*')
    .eq('tenant_id', getActiveTenantId()).is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw moduleError('module_activation_requests', error.message)
  return (data ?? []) as ActivationRequestRow[]
}

export function listActivationRequests(): Promise<ActivationRequestRow[]> {
  return safeCall('modules.listActivationRequests', listActivationRequests__raw, [])
}

/** Active/operational modules for this tenant — used by the Home KPI. */
export async function countActiveModules(): Promise<{ active: number; total: number }> {
  const mods = await listModules()
  const active = mods.filter(m =>
    m.status === 'operational' || m.status === 'implemented' || m.status === 'preview').length
  return { active, total: mods.length }
}

// ─── Activation request (never activates) ────────────────────────────────────
export interface ActivationInput {
  business_reason: string
  expected_use: string
  priority: RequestPriority
  notes?: string
  requested_by?: string | null
  actor_name?: string
  metadata?: Record<string, unknown>
}

async function requestActivation__raw(
  moduleId: string, input: ActivationInput,
): Promise<ActivationRequestRow | null> {
  const payload = {
    tenant_id: getActiveTenantId(),
    module_id: moduleId,
    requested_by: input.requested_by ?? null,
    request_status: 'pending',
    business_reason: input.business_reason,
    expected_use: input.expected_use,
    priority: input.priority,
    notes: input.notes ?? null,
    metadata: (input.metadata ?? {}) as Record<string, unknown>,
  }

  const { data, error } = await tbl('module_activation_requests')
    .insert(payload).select('*').single()
  if (error) throw moduleError('module_activation_requests', error.message)
  const row = data as ActivationRequestRow

  // Upsert the tenant state to 'pending' — activation stays manual/off-platform.
  const { data: existing } = await tbl('tenant_modules').select('id')
    .eq('tenant_id', getActiveTenantId()).eq('module_id', moduleId)
    .is('archived_at', null).maybeSingle()

  const state = {
    status: 'pending',
    requested_at: new Date().toISOString(),
    requested_by: input.requested_by ?? null,
  }

  if (existing?.id) {
    const { error: upErr } = await tbl('tenant_modules').update(state).eq('id', existing.id)
    if (upErr) throw moduleError('tenant_modules', upErr.message)
  } else {
    const { error: insErr } = await tbl('tenant_modules')
      .insert({ tenant_id: getActiveTenantId(), module_id: moduleId, ...state })
    if (insErr) throw moduleError('tenant_modules', insErr.message)
  }

  await writeAudit(moduleId, 'module.activation_requested', input.actor_name ?? 'Sistema', {
    request_id: row.id,
    priority: input.priority,
    business_reason: input.business_reason,
    expected_use: input.expected_use,
  })

  return row
}

/** Resolve a catalog module id from its stable key (e.g. 'STORAGE_MANAGER'). */
export async function findModuleIdByKey(key: string): Promise<string | null> {
  return safeCall('modules.findModuleIdByKey', async () => {
    const { data, error } = await tbl('modules').select('id').eq('key', key).maybeSingle()
    if (error) throw moduleError('modules', error.message)
    return (data?.id as string | undefined) ?? null
  }, null, { key })
}

export function requestActivation(
  moduleId: string, input: ActivationInput,
): Promise<ActivationRequestRow | null> {
  return safeCall('modules.requestActivation', () => requestActivation__raw(moduleId, input), null,
    { moduleId })
}
