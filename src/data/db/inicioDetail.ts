// Leituras reais para as abas de detalhe da Início (Fatia 5a) — sem migração.
// Todas escopadas por tenant (nunca cross-tenant) e, opcionalmente, por projeto.
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'

/* eslint-disable @typescript-eslint/no-explicit-any */

const QA_STATES = ['in-review', 'in_review', 'testing', 'review']
const DEV_STATES = ['in-progress', 'in_progress', 'todo', 'backlog', 'a_fazer']

export interface DeadlineRow {
  id: string
  name: string
  periodStart: string | null
  periodEnd: string | null
  daysLeft: number | null
  pctElapsed: number | null
}

/** Projetos com prazo cadastrado (period_start/period_end) e o quanto já decorreu. */
export async function fetchProjectDeadlines(projectIds?: string[]): Promise<DeadlineRow[]> {
  return safeCall('inicio.deadlines', async () => {
    let q = (supabase.from('projects') as any)
      .select('id, name, period_start, period_end, status, archived_at')
      .eq('tenant_id', getActiveTenantId())
      .is('archived_at', null)
    if (projectIds && projectIds.length) q = q.in('id', projectIds)
    const { data, error } = await q
    if (error) throw error
    const now = Date.now()
    return ((data ?? []) as any[]).map((p): DeadlineRow => {
      const s = p.period_start ? new Date(p.period_start).getTime() : null
      const e = p.period_end ? new Date(p.period_end).getTime() : null
      const daysLeft = e != null ? Math.ceil((e - now) / 86400000) : null
      const pctElapsed = s != null && e != null && e > s
        ? Math.max(0, Math.min(100, Math.round(((now - s) / (e - s)) * 100)))
        : null
      return { id: p.id, name: p.name, periodStart: p.period_start ?? null, periodEnd: p.period_end ?? null, daysLeft, pctElapsed }
    })
  }, [])
}

export interface QaItemRow {
  workItemId: string
  key: string
  title: string
  projectId: string | null
  count?: number
}

/** Itens devolvidos do QA para o dev (transições de status "para trás"), do histórico. */
export async function fetchRejections(projectIds?: string[]): Promise<QaItemRow[]> {
  return safeCall('inicio.rejections', async () => {
    const { data, error } = await (supabase.from('item_status_history') as any)
      .select('work_item_id, from_value, to_value, field, work_items(key, title, project_id, type, tenant_id)')
      .eq('tenant_id', getActiveTenantId())
      .eq('field', 'status')
    if (error) throw error
    const byItem = new Map<string, QaItemRow>()
    ;(data ?? []).forEach((h: any) => {
      const from = (h.from_value ?? '').toLowerCase()
      const to = (h.to_value ?? '').toLowerCase()
      if (!QA_STATES.includes(from) || !DEV_STATES.includes(to)) return
      const wi = Array.isArray(h.work_items) ? h.work_items[0] : h.work_items
      if (!wi) return
      if (projectIds && projectIds.length && !projectIds.includes(wi.project_id)) return
      const prev = byItem.get(h.work_item_id)
      if (prev) prev.count = (prev.count ?? 1) + 1
      else byItem.set(h.work_item_id, { workItemId: h.work_item_id, key: wi.key, title: wi.title, projectId: wi.project_id ?? null, count: 1 })
    })
    return [...byItem.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  }, [])
}

/** Bugs abertos sem nenhuma evidência (anexo) vinculada. */
export async function fetchEvidencePending(projectIds?: string[]): Promise<QaItemRow[]> {
  return safeCall('inicio.evidence', async () => {
    let bq = (supabase.from('work_items') as any)
      .select('id, key, title, project_id, type, status')
      .eq('tenant_id', getActiveTenantId())
      .eq('type', 'bug')
      .neq('status', 'done')
    if (projectIds && projectIds.length) bq = bq.in('project_id', projectIds)
    const bugsRes = await bq
    if (bugsRes.error) throw bugsRes.error
    const bugs = (bugsRes.data ?? []) as any[]
    if (bugs.length === 0) return []
    const ids = bugs.map(b => b.id)
    const attRes = await (supabase.from('attachments') as any)
      .select('work_item_id')
      .eq('tenant_id', getActiveTenantId())
      .is('archived_at', null)
      .in('work_item_id', ids)
    if (attRes.error) throw attRes.error
    const withEvidence = new Set((attRes.data ?? []).map((a: any) => a.work_item_id))
    return bugs
      .filter(b => !withEvidence.has(b.id))
      .map((b): QaItemRow => ({ workItemId: b.id, key: b.key, title: b.title, projectId: b.project_id ?? null }))
  }, [])
}
