/* eslint-disable @typescript-eslint/no-explicit-any */
// Meeting Intelligence — solicitações de horas (Fase 2). Fluxo funciona já; o
// consumo real das horas depende do motor. RLS-off + tenant-cliente.
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'
import { getMembers } from '@/data/db/members'
import { emitNotification } from '@/data/db/meetingNotifications'
import { adjustQuota, getMyQuota } from '@/data/db/meetingQuotas'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export type HourRequestType = 'temporaria' | 'definitiva'
export type HourRequestStatus = 'pending' | 'approved' | 'denied'

export interface HourRequest {
  id: string
  requesterId: string
  requesterName: string
  requesterRole: string | null
  type: HourRequestType
  minutes: number
  justification: string
  status: HourRequestStatus
  grantedMinutes: number | null
  reason: string | null
  createdAt: string
  decidedAt: string | null
}

export interface CreateRequestInput {
  type: HourRequestType
  minutes: number
  justification: string
}

export async function createRequest(input: CreateRequestInput, requester: { id: string; name: string; role: string | null }): Promise<boolean> {
  return safeCall('meetingRequests.createRequest', async () => {
    const { error } = await tbl('meeting_hour_requests').insert({
      tenant_id: getActiveTenantId(),
      requester_id: requester.id,
      type: input.type,
      minutes: Math.max(1, Math.round(input.minutes)),
      justification: input.justification.trim(),
      status: 'pending',
    })
    if (error) throw error
    await emitNotification({
      recipientId: null, // admins do tenant
      kind: 'request',
      body: `${requester.name} (${requester.role ?? '—'}) solicitou +${Math.round(input.minutes)} min (${input.type}).`,
    })
    return true
  }, false)
}

export async function listRequests(status?: HourRequestStatus): Promise<HourRequest[]> {
  return safeCall('meetingRequests.listRequests', async () => {
    let query = tbl('meeting_hour_requests')
      .select('*')
      .eq('tenant_id', getActiveTenantId())
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    const members = new Map((await getMembers()).map(m => [m.id, m]))
    return ((data ?? []) as any[]).map((r): HourRequest => {
      const m = members.get(r.requester_id)
      return {
        id: r.id,
        requesterId: r.requester_id,
        requesterName: m?.name ?? '—',
        requesterRole: m?.primary_role ?? null,
        type: r.type,
        minutes: r.minutes,
        justification: r.justification,
        status: r.status,
        grantedMinutes: r.granted_minutes ?? null,
        reason: r.reason ?? null,
        createdAt: r.created_at,
        decidedAt: r.decided_at ?? null,
      }
    })
  }, [])
}

/** Aprova concedendo `grantedMinutes` (pode diferir do pedido). Soma na cota do usuário. */
export async function approveRequest(req: HourRequest, grantedMinutes: number, deciderId: string): Promise<boolean> {
  return safeCall('meetingRequests.approveRequest', async () => {
    const granted = Math.max(1, Math.round(grantedMinutes))
    const { error } = await tbl('meeting_hour_requests').update({
      status: 'approved',
      granted_minutes: granted,
      decided_by: deciderId,
      decided_at: new Date().toISOString(),
    }).eq('id', req.id).eq('tenant_id', getActiveTenantId())
    if (error) throw error
    // Soma na cota atual do solicitante.
    const current = await getMyQuota(req.requesterId)
    await adjustQuota(req.requesterId, (current?.quotaMinutes ?? 0) + granted)
    await emitNotification({
      recipientId: req.requesterId,
      kind: 'approved',
      body: `Sua solicitação de +${req.minutes} min foi aprovada${granted !== req.minutes ? ` — concedido +${granted} min` : ''}.`,
    })
    return true
  }, false)
}

export async function denyRequest(req: HourRequest, reason: string, deciderId: string): Promise<boolean> {
  return safeCall('meetingRequests.denyRequest', async () => {
    const { error } = await tbl('meeting_hour_requests').update({
      status: 'denied',
      reason: reason.trim(),
      decided_by: deciderId,
      decided_at: new Date().toISOString(),
    }).eq('id', req.id).eq('tenant_id', getActiveTenantId())
    if (error) throw error
    await emitNotification({
      recipientId: req.requesterId,
      kind: 'denied',
      body: `Sua solicitação de +${req.minutes} min foi negada. Motivo: "${reason.trim()}"`,
    })
    return true
  }, false)
}
