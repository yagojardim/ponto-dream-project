/* eslint-disable @typescript-eslint/no-explicit-any */
// Meeting Intelligence — notificações do módulo (sino). Fase 2.
// RLS-off + tenant-cliente (padrão 1A): toda escrita/leitura filtra por tenant_id.
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export type MeetingNotificationKind = 'request' | 'approved' | 'denied' | 'share' | 'usage' | 'module'

export interface MeetingNotification {
  id: string
  recipientId: string | null   // null = dirigida aos admins do tenant
  kind: MeetingNotificationKind
  body: string
  read: boolean
  createdAt: string
}

function mapNotif(r: any): MeetingNotification {
  return {
    id: r.id,
    recipientId: r.recipient_id ?? null,
    kind: r.kind,
    body: r.body,
    read: !!r.read,
    createdAt: r.created_at,
  }
}

/** Cria uma notificação. `recipientId=null` a direciona aos admins do tenant. */
export async function emitNotification(input: {
  recipientId: string | null; kind: MeetingNotificationKind; body: string
}): Promise<void> {
  await safeCall('meetingNotifications.emit', async () => {
    const { error } = await tbl('meeting_notifications').insert({
      tenant_id: getActiveTenantId(),
      recipient_id: input.recipientId,
      kind: input.kind,
      body: input.body,
    })
    if (error) throw error
    return null
  }, null)
}

/** Admin vê as dos admins (recipient nulo) + as próprias; usuário vê só as próprias. */
export async function listNotifications(opts: { profileId: string; isAdmin: boolean }): Promise<MeetingNotification[]> {
  return safeCall('meetingNotifications.list', async () => {
    let query = tbl('meeting_notifications')
      .select('*')
      .eq('tenant_id', getActiveTenantId())
      .order('created_at', { ascending: false })
    if (opts.isAdmin) query = query.or(`recipient_id.is.null,recipient_id.eq.${opts.profileId}`)
    else query = query.eq('recipient_id', opts.profileId)
    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as any[]).map(mapNotif)
  }, [])
}

export async function markNotificationRead(id: string): Promise<boolean> {
  return safeCall('meetingNotifications.markRead', async () => {
    const { error } = await tbl('meeting_notifications')
      .update({ read: true }).eq('id', id).eq('tenant_id', getActiveTenantId())
    if (error) throw error
    return true
  }, false)
}

export async function markAllNotificationsRead(opts: { profileId: string; isAdmin: boolean }): Promise<boolean> {
  return safeCall('meetingNotifications.markAllRead', async () => {
    let query = tbl('meeting_notifications').update({ read: true }).eq('tenant_id', getActiveTenantId()).eq('read', false)
    if (opts.isAdmin) query = query.or(`recipient_id.is.null,recipient_id.eq.${opts.profileId}`)
    else query = query.eq('recipient_id', opts.profileId)
    const { error } = await query
    if (error) throw error
    return true
  }, false)
}
