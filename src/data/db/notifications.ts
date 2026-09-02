/* eslint-disable @typescript-eslint/no-explicit-any */
// Notifications data access layer — reads/writes the `notifications` table for
// the Header bell and the inbox. Tenant scoped, degrades to empty via safeCall,
// and mirrors unread `client_signals` into notifications so the bell shows the
// real portal activity.
import { supabase } from '../../integrations/supabase/client'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'
import { safeCall, logger } from '../../utils/logger'

export { DEFAULT_TENANT_ID }

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export interface NotificationRow {
  id: string
  tenant_id: string
  user_id: string
  type: string
  entity_type: string | null
  entity_id: string | null
  title: string
  body: string | null
  read: boolean
  created_at: string
}

function notifError(table: string, message: string): Error {
  return new Error(`[${table}] ${message}`)
}

async function writeAudit(
  entityId: string, action: string, after: Record<string, unknown> | null,
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      tenant_id: getActiveTenantId(),
      entity_type: 'notification',
      entity_id: entityId,
      action,
      before: null,
      after: after as any,
    })
  } catch (err) {
    logger.error('notifications.writeAudit', err, { entityId, action })
  }
}

/** Resolves the profile uuid of a session user by display name (auth comes later). */
async function resolveProfileId__raw(name: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles')
    .select('id').eq('tenant_id', getActiveTenantId()).eq('name', name).limit(1)
  if (error) throw notifError('profiles', error.message)
  return data?.[0]?.id ?? null
}

export function resolveProfileId(name: string): Promise<string | null> {
  return safeCall('notifications.resolveProfileId', () => resolveProfileId__raw(name), null, { name })
}

// ─── Mirror client_signals → notifications ───────────────────────────────────
async function mirrorClientSignals__raw(profileId: string): Promise<number> {
  const { data: signals, error } = await tbl('client_signals')
    .select('id, type, item_id, item_title, body, author, created_at, read_by_po')
    .eq('tenant_id', getActiveTenantId()).is('archived_at', null)
    .order('created_at', { ascending: false }).limit(50)
  if (error) throw notifError('client_signals', error.message)

  const rows = (signals ?? []) as any[]
  if (rows.length === 0) return 0

  const { data: existing, error: exErr } = await tbl('notifications')
    .select('entity_id')
    .eq('tenant_id', getActiveTenantId()).eq('user_id', profileId)
    .eq('entity_type', 'client_signal')
  if (exErr) throw notifError('notifications', exErr.message)

  const known = new Set((existing ?? []).map((r: any) => r.entity_id))
  const missing = rows.filter(r => !known.has(r.id))
  if (missing.length === 0) return 0

  const payload = missing.map(s => ({
    tenant_id: getActiveTenantId(),
    user_id: profileId,
    type: s.type === 'approval' ? 'approval' : 'comment',
    entity_type: 'client_signal',
    entity_id: s.id,
    title: `${s.author ?? 'Cliente'} ${s.type === 'approval' ? 'solicitou aprovação de' : 'comentou em'} "${s.item_title ?? 'um item'}"`,
    body: s.body ?? null,
    read: !!s.read_by_po,
    metadata: { item_id: s.item_id ?? null },
  }))

  const { error: insErr } = await tbl('notifications').insert(payload)
  if (insErr) throw notifError('notifications', insErr.message)
  return payload.length
}

export function mirrorClientSignals(profileId: string): Promise<number> {
  return safeCall('notifications.mirrorClientSignals', () => mirrorClientSignals__raw(profileId), 0, { profileId })
}

// ─── Reads ────────────────────────────────────────────────────────────────────
async function list__raw(profileId: string, limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await tbl('notifications').select('*')
    .eq('tenant_id', getActiveTenantId()).eq('user_id', profileId)
    .is('archived_at', null)
    .order('read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw notifError('notifications', error.message)
  return (data ?? []) as NotificationRow[]
}

export function list(profileId: string, limit = 50): Promise<NotificationRow[]> {
  return safeCall('notifications.list', () => list__raw(profileId, limit), [], { profileId })
}

async function unreadCount__raw(profileId: string): Promise<number> {
  const { count, error } = await tbl('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', getActiveTenantId()).eq('user_id', profileId)
    .eq('read', false).is('archived_at', null)
  if (error) throw notifError('notifications', error.message)
  return count ?? 0
}

export function unreadCount(profileId: string): Promise<number> {
  return safeCall('notifications.unreadCount', () => unreadCount__raw(profileId), 0, { profileId })
}

// ─── Writes ───────────────────────────────────────────────────────────────────
async function markRead__raw(id: string): Promise<boolean> {
  const { error } = await tbl('notifications').update({ read: true })
    .eq('tenant_id', getActiveTenantId()).eq('id', id)
  if (error) throw notifError('notifications', error.message)
  await writeAudit(id, 'notification.read', { read: true })
  return true
}

export function markRead(id: string): Promise<boolean> {
  return safeCall('notifications.markRead', () => markRead__raw(id), false, { id })
}

async function markAllRead__raw(profileId: string): Promise<boolean> {
  const { error } = await tbl('notifications').update({ read: true })
    .eq('tenant_id', getActiveTenantId()).eq('user_id', profileId).eq('read', false)
  if (error) throw notifError('notifications', error.message)
  await writeAudit(profileId, 'notification.read_all', { read: true })
  return true
}

export function markAllRead(profileId: string): Promise<boolean> {
  return safeCall('notifications.markAllRead', () => markAllRead__raw(profileId), false, { profileId })
}

async function create__raw(input: {
  profileId: string
  type?: string
  title: string
  body?: string | null
  entityType?: string | null
  entityId?: string | null
}): Promise<string | null> {
  const { data, error } = await tbl('notifications').insert({
    tenant_id: getActiveTenantId(),
    user_id: input.profileId,
    type: input.type ?? 'info',
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
  }).select('id').single()
  if (error) throw notifError('notifications', error.message)
  await writeAudit(data.id, 'notification.create', { title: input.title })
  return data.id as string
}

export function create(input: Parameters<typeof create__raw>[0]): Promise<string | null> {
  return safeCall('notifications.create', () => create__raw(input), null, { title: input.title })
}
