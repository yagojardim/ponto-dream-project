// Live dashboard store — real Supabase aggregates exposed through the same
// selector API the Home panels used to import from `src/data/workItems.ts`.
// Read-only: the dashboards never write.
import { useEffect, useState } from 'react'
import {
  fetchDashboardAggregates,
  type DashboardAggregates, type DashboardProjectOption,
} from './dashboards'
import { getActiveTenantId } from '@/data/session'
import type { WorkItem } from '../../components/ds/DashboardKit'

let LIVE: DashboardAggregates | null = null
let LOADING = false
let ERROR: string | null = null
let inflight: Promise<void> | null = null
// Tenant para o qual o cache atual foi carregado. Evita vazar dados de outro
// tenant quando o tenant ativo muda (login, troca de persona).
let LOADED_TENANT: string | null = null

const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

function load(force = false): Promise<void> {
  const tid = getActiveTenantId()
  if (inflight && !force && LOADED_TENANT === tid) return inflight
  LOADING = true
  ERROR = null
  emit()
  inflight = fetchDashboardAggregates()
    .then(d => { LIVE = d; LOADED_TENANT = tid; ERROR = null })
    .catch((e: Error) => { ERROR = e.message })
    .finally(() => { LOADING = false; inflight = null; emit() })
  return inflight
}

/** Recarrega os agregados quando o tenant ativo mudou (login, troca de persona). */
export function reloadLiveDashboardForTenant(): void {
  if (LOADED_TENANT === getActiveTenantId()) return
  LIVE = null
  void load(true)
}

export interface LiveDashboardState {
  data: DashboardAggregates | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** Subscribes a component to the shared aggregate store (fetch-once, shared). */
export function useLiveDashboard(): LiveDashboardState {
  const [, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick(t => t + 1)
    listeners.add(l)
    if ((!LIVE || LOADED_TENANT !== getActiveTenantId()) && !LOADING) void load()
    return () => { listeners.delete(l) }
  }, [])
  return { data: LIVE, loading: LOADING, error: ERROR, reload: () => void load(true) }
}

// ─── Selectors (mock-compatible signatures) ───────────────────────────────────
const items = (): WorkItem[] => LIVE?.items ?? []
const byProject = (list: WorkItem[], pid?: string) => pid ? list.filter(w => w.project_id === pid) : list

export function liveItems(): WorkItem[] { return items() }

export function liveProjects(): DashboardProjectOption[] { return LIVE?.projects ?? [] }

export function liveAggregates(): DashboardAggregates | null { return LIVE }

/** Name of the sprint currently running (first active sprint in scope). */
export function liveCurrentSprintName(): string | null {
  return LIVE?.currentSprints[0]?.name ?? null
}

export function getBlockedItems(project_id?: string): WorkItem[] {
  return byProject(items().filter(w => w.status === 'blocked'), project_id)
}

/**
 * Items of a sprint. Passing no name (or a name that no longer exists in the
 * database) falls back to every active sprint, so panels keep working after
 * the mock "Sprint 14" label disappeared.
 */
export function getSprintItems(sprint?: string, project_id?: string): WorkItem[] {
  const active = LIVE?.currentSprints ?? []
  const named = sprint ? active.find(s => s.name === sprint) : undefined
  const pool = named ? named.items : active.flatMap(s => s.items)
  return byProject(pool, project_id)
}

export function getReadyItems(project_id?: string): WorkItem[] {
  return byProject(items().filter(w => w.status === 'ready' || w.status === 'todo'), project_id)
}

export function getTestingItems(project_id?: string): WorkItem[] {
  return byProject(items().filter(w => w.status === 'testing' || w.status === 'in-review'), project_id)
}

const ALERT_TAGS = [
  'Sem Critério de Aceite', 'Refinamento Pendente', 'Dependência Aberta',
  'Sem Épico', 'Sem Prioridade', 'Sem Responsável', 'Descrição Insuficiente',
]

/** Backlog items that fail the PO "ready" checklist — computed from real rows. */
export function getBacklogWithAlerts(project_id?: string): WorkItem[] {
  const list = items().filter(w => {
    if (w.status === 'done' || w.status === 'cancelled') return false
    const tagged = (w.tags ?? []).some(t => ALERT_TAGS.includes(t))
    const missing = !w.assignee || !w.description || (w.points == null && w.type !== 'epic')
    return tagged || missing
  })
  return byProject(list, project_id)
}
