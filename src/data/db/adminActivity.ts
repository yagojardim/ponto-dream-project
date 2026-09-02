// Admin activity feed — lê os registros reais de audit_logs do tenant atual.
// Somente leitura; nunca cross-tenant.
import { supabase } from '../../integrations/supabase/client'
import { getActiveTenantId } from '@/data/session'
import { safeCall } from '../../utils/logger'

export interface AdminActivityRow {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actorName: string | null
  createdAt: string
}

interface RawAuditRow {
  id: string
  action: string | null
  entity_type: string | null
  entity_id: string | null
  actor_name: string | null
  created_at: string
}

export function fetchRecentAdminActivity(
  limit = 8,
  opts: { actorName?: string } = {},
): Promise<AdminActivityRow[]> {
  return safeCall<AdminActivityRow[]>('adminActivity.fetchRecent', async () => {
    let q = supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, actor_name, created_at')
      .eq('tenant_id', getActiveTenantId())
    if (opts.actorName) q = q.eq('actor_name', opts.actorName)
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return ((data ?? []) as unknown as RawAuditRow[]).map(r => ({
      id: r.id,
      action: r.action ?? '—',
      entityType: r.entity_type ?? '—',
      entityId: r.entity_id ?? null,
      actorName: r.actor_name,
      createdAt: r.created_at,
    }))
  }, [])
}

/** Tempo relativo em pt-BR, ex.: "2h atrás", "3d atrás". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Math.max(0, Date.now() - then)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d atrás`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}sem atrás`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}m atrás`
  return `${Math.floor(d / 365)}a atrás`
}
