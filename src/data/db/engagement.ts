// Métricas de produto (engajamento / adoção / funil) a partir de usage_events — Fatia 5c-2/5c-3.
// Uma leitura de 60 dias de eventos + perfis, com cache por tenant. Degrada com elegância
// quando não há dados (ou a tabela ainda não foi aplicada): hasData=false, zeros — nunca inventa.
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'

/* eslint-disable @typescript-eslint/no-explicit-any */

// usage_events ainda não está nos tipos gerados do Supabase — acesso via cast.
const usageTbl = () => (supabase as unknown as { from: (t: string) => any }).from('usage_events')

const DAY = 86400000

export interface FeatureAdoption {
  key: string
  label: string
  users: number
  pct: number
}

export interface ProductMetrics {
  /** false quando não há eventos (ou a tabela ainda não existe). */
  hasData: boolean
  engagement: { mau: number; averageDau: number; stickinessPct: number; churnPct: number | null }
  adoption: { features: FeatureAdoption[]; base: number }
  funnel: { stage: string; value: number }[]
}

const FEATURE_LABELS: Record<string, string> = {
  home: 'Início', dashboard: 'Dashboard Executivo', project: 'Board', 'boards-list': 'Boards',
  'projects-list': 'Projetos', list: 'Lista', gantt: 'Gráfico Gantt', timeline: 'Timeline',
  calendar: 'Calendário', epics: 'Épicos', releases: 'Releases', reports: 'Relatórios',
  automations: 'Automações', team: 'Time', 'my-tasks': 'Minha Fila', modules: 'Módulos',
  client: 'Portal do Cliente', 'client-messages': 'Mensagens do Cliente',
  timesheet: 'Apontamento de Horas', config: 'Configurações', 'tenant-settings': 'Configurações',
}
function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1))
}

const EMPTY: ProductMetrics = {
  hasData: false,
  engagement: { mau: 0, averageDau: 0, stickinessPct: 0, churnPct: null },
  adoption: { features: [], base: 0 },
  funnel: [],
}

function addTo(m: Map<string, Set<string>>, key: string, value: string): void {
  let s = m.get(key)
  if (!s) { s = new Set(); m.set(key, s) }
  s.add(value)
}

/** Lê 60d de usage_events + perfis e deriva engajamento, adoção e funil (por tenant). */
export async function fetchProductMetrics(): Promise<ProductMetrics> {
  return safeCall('inicio.product-metrics', async () => {
    const tid = getActiveTenantId()
    const now = Date.now(), d30 = now - 30 * DAY, d60 = now - 60 * DAY
    const [evRes, profRes] = await Promise.all([
      usageTbl()
        .select('user_id, feature_key, occurred_at')
        .eq('tenant_id', tid)
        .gte('occurred_at', new Date(d60).toISOString()),
      supabase.from('profiles').select('id').eq('tenant_id', tid).is('archived_at', null),
    ])
    if (evRes.error) throw evRes.error
    if (profRes.error) throw profRes.error
    const events = (evRes.data ?? []) as { user_id: string; feature_key: string; occurred_at: string }[]
    const base = (profRes.data ?? []).length

    if (events.length === 0) {
      return {
        ...EMPTY,
        adoption: { features: [], base },
        funnel: [
          { stage: 'Cadastros', value: base },
          { stage: 'Ativação', value: 0 },
          { stage: 'Engajamento', value: 0 },
          { stage: 'Retenção D30', value: 0 },
        ],
      }
    }

    const curr = new Set<string>()       // ativos nos últimos 30d
    const prev = new Set<string>()       // ativos em [-60d, -30d)
    const activated = new Set<string>()  // qualquer atividade em 60d (proxy de "ativado")
    const perDay = new Map<string, Set<string>>()   // dia -> usuários (30d)
    const featUsers = new Map<string, Set<string>>() // feature -> usuários (30d)
    for (const e of events) {
      const t = new Date(e.occurred_at).getTime()
      if (Number.isNaN(t)) continue
      activated.add(e.user_id)
      if (t >= d30) {
        curr.add(e.user_id)
        addTo(perDay, e.occurred_at.slice(0, 10), e.user_id)
        addTo(featUsers, e.feature_key, e.user_id)
      } else if (t >= d60) {
        prev.add(e.user_id)
      }
    }

    const mau = curr.size
    const dauSum = [...perDay.values()].reduce((s, set) => s + set.size, 0)
    const averageDau = Math.round(dauSum / 30)
    const stickinessPct = mau > 0 ? Math.round((dauSum / 30 / mau) * 100) : 0
    const churnedCount = [...prev].filter(u => !curr.has(u)).length
    const churnPct = prev.size > 0 ? Math.round((churnedCount / prev.size) * 100) : null
    const retained = [...prev].filter(u => curr.has(u)).length

    const features: FeatureAdoption[] = [...featUsers.entries()]
      .map(([key, set]) => ({ key, label: featureLabel(key), users: set.size, pct: base > 0 ? Math.round((set.size / base) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct)

    return {
      hasData: true,
      engagement: { mau, averageDau, stickinessPct, churnPct },
      adoption: { features, base },
      funnel: [
        { stage: 'Cadastros', value: base },
        { stage: 'Ativação', value: activated.size },
        { stage: 'Engajamento', value: mau },
        { stage: 'Retenção D30', value: retained },
      ],
    }
  }, EMPTY)
}

// Cache por tenant: os 5 widgets do Product Manager compartilham uma única leitura.
let cache: { tenant: string; promise: Promise<ProductMetrics> } | null = null
function loadProductMetrics(): Promise<ProductMetrics> {
  const tid = getActiveTenantId()
  if (cache && cache.tenant === tid) return cache.promise
  const promise = fetchProductMetrics()
  cache = { tenant: tid, promise }
  return promise
}

/** Hook compartilhado (fetch-once por tenant) para os cards/KPIs do Product Manager. */
export function useProductMetrics(): ProductMetrics | null {
  const [m, setM] = useState<ProductMetrics | null>(null)
  const tid = getActiveTenantId()
  useEffect(() => {
    let alive = true
    loadProductMetrics().then(v => { if (alive) setM(v) }).catch(() => { if (alive) setM(EMPTY) })
    return () => { alive = false }
  }, [tid])
  return m
}
