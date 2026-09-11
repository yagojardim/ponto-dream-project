/* eslint-disable @typescript-eslint/no-explicit-any */
// Leitura dos logs de PRODUTO por tenant (support_logs).
// A RLS restringe a leitura ao ADMIN do próprio tenant — o cliente não precisa
// (nem deve) filtrar por tenant aqui. Escrita é só via Edge Function log-event.
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'

export type SupportLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface SupportLogRow {
  id: string
  tenant_id: string | null
  profile_id: string | null
  level: SupportLogLevel
  area: string | null
  message: string
  context: Record<string, unknown>
  correlation_id: string | null
  created_at: string
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

function normalize(rows: unknown): SupportLogRow[] {
  if (!Array.isArray(rows)) return []
  return rows as SupportLogRow[]
}

/** Últimos N eventos do tenant (mais recentes primeiro). */
export async function fetchRecentLogs(limit = DEFAULT_LIMIT): Promise<SupportLogRow[]> {
  const capped = Math.min(Math.max(limit, 1), MAX_LIMIT)
  return safeCall('supportLogs.fetchRecent', async () => {
    const { data, error } = await tbl('support_logs')
      .select('id, tenant_id, profile_id, level, area, message, context, correlation_id, created_at')
      .order('created_at', { ascending: false })
      .limit(capped)
    if (error) throw new Error(error.message)
    return normalize(data)
  }, [], { limit: capped })
}

/** Eventos de um chamado específico, buscados pelo código de correlação. */
export async function fetchLogsByCorrelation(correlationId: string): Promise<SupportLogRow[]> {
  const id = correlationId.trim()
  if (!id) return []
  return safeCall('supportLogs.fetchByCorrelation', async () => {
    const { data, error } = await tbl('support_logs')
      .select('id, tenant_id, profile_id, level, area, message, context, correlation_id, created_at')
      .eq('correlation_id', id)
      .order('created_at', { ascending: false })
      .limit(MAX_LIMIT)
    if (error) throw new Error(error.message)
    return normalize(data)
  }, [])
}
