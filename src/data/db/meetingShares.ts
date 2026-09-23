/* eslint-disable @typescript-eslint/no-explicit-any */
// Meeting Intelligence — compartilhamento de reunião (Onda A, funciona já). Fase 2.
// Regra de negócio (mockup): só o DONO compartilha; quem recebe não consome cota.
// RLS-off + tenant-cliente (padrão 1A).
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'
import { getMembers } from '@/data/db/members'
import { emitNotification } from '@/data/db/meetingNotifications'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export interface MeetingShareTarget {
  profileId: string
  name: string
  sharedById: string | null
}

/** Pessoas com quem a reunião está compartilhada (nomes resolvidos via getMembers). */
export async function listShares(meetingId: string): Promise<MeetingShareTarget[]> {
  return safeCall('meetingShares.listShares', async () => {
    const { data, error } = await tbl('meeting_shares')
      .select('shared_with_id, shared_by_id')
      .eq('tenant_id', getActiveTenantId())
      .eq('meeting_id', meetingId)
    if (error) throw error
    const rows = (data ?? []) as any[]
    const names = new Map((await getMembers()).map(m => [m.id, m.name]))
    return rows.map((r): MeetingShareTarget => ({
      profileId: r.shared_with_id,
      name: names.get(r.shared_with_id) ?? '—',
      sharedById: r.shared_by_id ?? null,
    }))
  }, [])
}

/** Ids das reuniões compartilhadas com o usuário (para a lista "compartilhadas comigo"). */
export async function meetingIdsSharedWith(profileId: string): Promise<Set<string>> {
  return safeCall('meetingShares.meetingIdsSharedWith', async () => {
    const { data, error } = await tbl('meeting_shares')
      .select('meeting_id')
      .eq('tenant_id', getActiveTenantId())
      .eq('shared_with_id', profileId)
    if (error) throw error
    return new Set(((data ?? []) as any[]).map(r => r.meeting_id as string))
  }, new Set<string>())
}

/** Compartilhamentos de TODAS as reuniões do tenant, agrupados por meeting_id
 *  (para a lista mostrar com quem cada reunião do dono está compartilhada). */
export async function sharesByMeeting(): Promise<Map<string, MeetingShareTarget[]>> {
  return safeCall('meetingShares.sharesByMeeting', async () => {
    const { data, error } = await tbl('meeting_shares')
      .select('meeting_id, shared_with_id, shared_by_id')
      .eq('tenant_id', getActiveTenantId())
    if (error) throw error
    const rows = (data ?? []) as any[]
    const names = new Map((await getMembers()).map(m => [m.id, m.name]))
    const map = new Map<string, MeetingShareTarget[]>()
    for (const r of rows) {
      const arr = map.get(r.meeting_id) ?? []
      arr.push({ profileId: r.shared_with_id, name: names.get(r.shared_with_id) ?? '—', sharedById: r.shared_by_id ?? null })
      map.set(r.meeting_id, arr)
    }
    return map
  }, new Map<string, MeetingShareTarget[]>())
}

export async function addShare(input: {
  meetingId: string; meetingTitle: string; sharedWithId: string; sharedById: string; sharedByName: string
}): Promise<boolean> {
  return safeCall('meetingShares.addShare', async () => {
    const { error } = await tbl('meeting_shares').insert({
      tenant_id: getActiveTenantId(),
      meeting_id: input.meetingId,
      shared_with_id: input.sharedWithId,
      shared_by_id: input.sharedById,
    })
    if (error) throw error
    await emitNotification({
      recipientId: input.sharedWithId,
      kind: 'share',
      body: `${input.sharedByName} compartilhou a reunião "${input.meetingTitle}" com você — sem gastar sua cota.`,
    })
    return true
  }, false)
}

export async function removeShare(meetingId: string, sharedWithId: string): Promise<boolean> {
  return safeCall('meetingShares.removeShare', async () => {
    const { error } = await tbl('meeting_shares')
      .delete()
      .eq('tenant_id', getActiveTenantId())
      .eq('meeting_id', meetingId)
      .eq('shared_with_id', sharedWithId)
    if (error) throw error
    return true
  }, false)
}
