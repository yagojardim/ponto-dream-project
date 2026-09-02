/* eslint-disable @typescript-eslint/no-explicit-any */
// Eleição autônoma do Admin Master — todo o estado vive no banco do Project.
// Nenhum serviço externo participa: o futuro Altech Control apenas LÊ este estado.
// Padrão do projeto: tenant scope, safeCall degradando para valores seguros,
// writes registrados em audit_logs (coluna `action`) e avisos em notifications.
import { supabase } from '../../integrations/supabase/client'
import { getActiveTenantId } from '@/data/session'
import { safeCall, logger } from '../../utils/logger'
import { issueToken, activationLink } from './activationTokens'
import { create as createNotification } from './notifications'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export type AdminMasterStatus = 'pending' | 'defined'
export type AdminMasterMethod = 'self_elected' | 'invited_other' | 'auto_elected'

export interface AdminMasterState {
  status: AdminMasterStatus
  graceUntil: string | null
  daysRemaining: number
  graceDays: number
  definedAt: string | null
  definedBy: string | null
  definedMethod: AdminMasterMethod | null
  registrantProfileId: string | null
  /** true quando a auto-eleição acabou de acontecer nesta sessão */
  autoElected?: boolean
}

const EMPTY_STATE: AdminMasterState = {
  status: 'defined', graceUntil: null, daysRemaining: 0, graceDays: 5,
  definedAt: null, definedBy: null, definedMethod: null, registrantProfileId: null,
}

async function writeAudit(action: string, entityId: string | null, after: Record<string, unknown>) {
  try {
    await tbl('audit_logs').insert({
      tenant_id: getActiveTenantId(),
      entity_type: 'admin_master',
      entity_id: entityId,
      action,
      before: null,
      after: after as any,
    })
  } catch (err) {
    logger.error('adminMaster.writeAudit', err, { action })
  }
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000))
}

async function loadSettings(): Promise<any | null> {
  const { data, error } = await tbl('tenant_settings')
    .select('*').eq('tenant_id', getActiveTenantId()).maybeSingle()
  if (error) throw error
  return data ?? null
}

async function tenantCreatedAt(): Promise<string | null> {
  const { data } = await tbl('tenants').select('created_at').eq('id', getActiveTenantId()).maybeSingle()
  return data?.created_at ?? null
}

/** Prazo efetivo: coluna gravada ou tenant.created_at + grace_days. */
async function resolveGraceUntil(row: any): Promise<string | null> {
  if (row?.admin_master_grace_until) return row.admin_master_grace_until
  const created = await tenantCreatedAt()
  if (!created) return null
  const days = Number(row?.admin_master_grace_days ?? 5)
  return new Date(new Date(created).getTime() + days * 86_400_000).toISOString()
}

function toState(row: any, graceUntil: string | null): AdminMasterState {
  return {
    status: (row?.admin_master_status as AdminMasterStatus) ?? 'pending',
    graceUntil,
    daysRemaining: graceUntil ? daysBetween(new Date(), new Date(graceUntil)) : 0,
    graceDays: Number(row?.admin_master_grace_days ?? 5),
    definedAt: row?.admin_master_defined_at ?? null,
    definedBy: row?.admin_master_defined_by ?? null,
    definedMethod: (row?.admin_master_defined_method as AdminMasterMethod) ?? null,
    registrantProfileId: row?.registrant_profile_id ?? null,
  }
}

// ─── Leitura ──────────────────────────────────────────────────────────────────
export function getAdminMasterState(): Promise<AdminMasterState> {
  return safeCall('adminMaster.getState', async () => {
    const row = await loadSettings()
    if (!row) return EMPTY_STATE
    return toState(row, await resolveGraceUntil(row))
  }, EMPTY_STATE)
}

// ─── Promoção de um profile ao Admin Master ──────────────────────────────────
async function promote(profileId: string, method: AdminMasterMethod): Promise<void> {
  // Garante um único owner por tenant (índice único parcial no banco).
  await tbl('profiles')
    .update({ tenant_owner: false })
    .eq('tenant_id', getActiveTenantId()).eq('tenant_owner', true).neq('id', profileId)

  const { error } = await tbl('profiles')
    .update({ tenant_owner: true, primary_role: 'ADMIN_MASTER' })
    .eq('id', profileId).eq('tenant_id', getActiveTenantId())
  if (error) throw error

  const { error: sErr } = await tbl('tenant_settings').upsert({
    tenant_id: getActiveTenantId(),
    admin_master_status: 'defined',
    admin_master_defined_method: method,
    admin_master_defined_at: new Date().toISOString(),
    admin_master_defined_by: profileId,
  }, { onConflict: 'tenant_id' })
  if (sErr) throw sErr
}

/** O usuário atual assume o papel de Admin Master. */
export function electSelf(profileId: string): Promise<boolean> {
  return safeCall('adminMaster.electSelf', async () => {
    await promote(profileId, 'self_elected')
    await writeAudit('admin_master_defined', profileId, { method: 'self_elected' })
    await createNotification({
      profileId,
      type: 'info',
      title: 'Você agora é o Admin Master',
      body: 'Sua conta passou a ser a proprietária deste tenant.',
      entityType: 'admin_master',
      entityId: profileId,
    })
    return true
  }, false)
}

export interface InviteResult { ok: boolean; link?: string; reason?: string }

/** Define outra pessoa (por e-mail) como Admin Master e emite o link de 1º acesso. */
export function inviteAsAdminMaster(
  email: string, name: string, actorProfileId: string | null,
): Promise<InviteResult> {
  return safeCall<InviteResult>('adminMaster.invite', async () => {
    const mail = email.trim().toLowerCase()
    if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      return { ok: false, reason: 'E-mail inválido.' }
    }

    const { data: found } = await tbl('profiles')
      .select('id').eq('tenant_id', getActiveTenantId()).ilike('email', mail).limit(1)
    let profileId: string | null = found?.[0]?.id ?? null

    if (!profileId) {
      const { data: created, error } = await tbl('profiles').insert({
        tenant_id: getActiveTenantId(),
        name: name.trim() || mail,
        email: mail,
        status: 'active',
        password_must_change: true,
      }).select('id').single()
      if (error) throw error
      profileId = created.id as string
    } else {
      await tbl('profiles').update({
        name: name.trim() || undefined,
        password_must_change: true,
      }).eq('id', profileId).eq('tenant_id', getActiveTenantId())
    }

    await promote(profileId!, 'invited_other')

    const raw = await issueToken(profileId!, 'first_access', 72)
    const link = raw ? activationLink(raw) : undefined

    await writeAudit('admin_master_invited', profileId, { method: 'invited_other', invited_by: actorProfileId })
    await createNotification({
      profileId: profileId!,
      type: 'info',
      title: 'Você foi definido como Admin Master',
      body: 'Use o link de ativação recebido para criar sua senha.',
      entityType: 'admin_master',
      entityId: profileId,
    })

    return { ok: true, link }
  }, { ok: false, reason: 'Não foi possível concluir o convite.' })
}

/** Avaliação preguiçosa no login: expira o prazo e auto-elege a conta de cadastro. */
export function reconcileAdminMaster(): Promise<AdminMasterState> {
  return safeCall('adminMaster.reconcile', async () => {
    const row = await loadSettings()
    if (!row) return EMPTY_STATE

    const graceUntil = await resolveGraceUntil(row)
    const state = toState(row, graceUntil)
    if (state.status !== 'pending') return state
    if (!graceUntil || Date.now() <= new Date(graceUntil).getTime()) return state

    // Alvo: conta de cadastro; senão o profile ativo mais antigo do tenant.
    let target = state.registrantProfileId
    if (!target) {
      const { data } = await tbl('profiles')
        .select('id').eq('tenant_id', getActiveTenantId()).eq('status', 'active')
        .order('created_at', { ascending: true }).limit(1)
      target = data?.[0]?.id ?? null
    }
    if (!target) return state

    await promote(target, 'auto_elected')
    await writeAudit('admin_master_auto_elected', target, { method: 'auto_elected', grace_until: graceUntil })
    await createNotification({
      profileId: target,
      type: 'info',
      title: 'Sua conta foi elevada a Admin Master',
      body: 'O prazo para definir o Admin Master expirou; sua conta de cadastro foi elevada a Admin Master.',
      entityType: 'admin_master',
      entityId: target,
    })

    const refreshed = await loadSettings()
    return { ...toState(refreshed, graceUntil), autoElected: true }
  }, EMPTY_STATE)
}

/** "Agora não": registra o adiamento e avisa pelo sino. */
export function remindLater(profileId: string, daysRemaining: number): Promise<boolean> {
  return safeCall('adminMaster.remindLater', async () => {
    await writeAudit('admin_master_reminder_sent', profileId, { days_remaining: daysRemaining })
    await createNotification({
      profileId,
      type: 'info',
      title: `Defina o Admin Master em ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'}`,
      body: 'Ao final do prazo, sua conta de cadastro será elevada automaticamente a Admin Master.',
      entityType: 'admin_master',
      entityId: profileId,
    })
    return true
  }, false)
}
