// Reports data access layer — read-only aggregations for every chart in the report registry.
// Scoped by tenant_id and, optionally, by the selected/allowed projects. No writes.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { T } from '../../components/ds/tokens'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'

export { DEFAULT_TENANT_ID }

type Tables = Database['public']['Tables']

type ItemRow = Pick<
  Tables['work_items']['Row'],
  | 'id' | 'key' | 'title' | 'type' | 'status' | 'priority' | 'severity' | 'project_id'
  | 'sprint_id' | 'epic_id' | 'assignee_id' | 'story_points' | 'is_blocked'
  | 'created_at' | 'updated_at' | 'completed_at' | 'due_date'
>
type SprintRow = Pick<Tables['sprints']['Row'], 'id' | 'project_id' | 'name' | 'state' | 'start_date' | 'end_date' | 'velocity'>
type EpicRow = Pick<Tables['epics']['Row'], 'id' | 'project_id' | 'name' | 'color'>
type ProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials'>
type HistoryRow = Pick<Tables['item_status_history']['Row'], 'work_item_id' | 'field' | 'from_value' | 'to_value' | 'created_at'>
type ProjectAnchorRow = Pick<Tables['projects']['Row'], 'id' | 'period_start' | 'created_at'>

export interface SeriesPoint { label: string; value: number }

export interface ReportsData {
  empty: boolean
  /** Projects the aggregates were computed for (null ⇒ todo o tenant). */
  scopeProjectIds: string[] | null

  velocity: { sprints: SeriesPoint[]; avg: number; max: number }
  burndown: {
    sprintName: string | null
    days: string[]
    total: number
    ideal: number[]
    actual: number[]
  }
  cfd: { days: string[]; layers: { label: string; color: string; data: number[] }[]; max: number }
  bugs: { label: string; color: string; val: number }[]
  createdVsResolved: {
    weeks: string[]
    /** Rótulo longo por bucket (para tooltip): "27/07 – 02/08" ou "Ago 2025". */
    bucketTitles: string[]
    /** Granularidade do eixo, derivada do tempo de vida do projeto. */
    unit: 'day' | 'week' | 'month'
    /** Início do eixo (início do projeto), ISO. */
    axisStart: string | null
    created: number[]
    resolved: number[]
    max: number
    /** Séries por projeto — só preenchido quando há escopo selecionado. */
    byProject: { projectId: string; created: number[]; resolved: number[] }[]
  }
  workload: { name: string; fullName: string; pts: number }[]
  aging: { id: string; itemId: string; days: number; tag: string | null; color: string }[]
  leadCycle: { leadAvg: number; cycleAvg: number; buckets: { label: string; value: number }[] }
  health: { axes: { label: string; val: number }[]; score: number }
  epicBurndown: {
    weeks: string[]
    bucketTitles: string[]
    unit: 'day' | 'week' | 'month'
    axisStart: string | null
    epics: { label: string; color: string; data: number[] }[]
    max: number
  }
  totals: { issues: number; velocity: number; leadAvg: number; bugRate: number }
}

interface Axis {
  unit: 'day' | 'week' | 'month'
  labels: string[]
  titles: string[]
  ranges: { from: Date; to: Date }[]
}

const MONTH_ABBR_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

/** Início do projeto: period_start → created_at do projeto → created_at mais antigo das demandas. */
function projectStartAnchor(
  projects: { period_start: string | null; created_at: string | null }[],
  items: { created_at: string | null }[],
  now: Date,
): Date | null {
  const candidates: number[] = []
  for (const p of projects) {
    const raw = p.period_start ?? p.created_at
    if (raw) { const t = new Date(raw).getTime(); if (!Number.isNaN(t)) candidates.push(t) }
  }
  if (candidates.length === 0) {
    for (const i of items) {
      if (i.created_at) { const t = new Date(i.created_at).getTime(); if (!Number.isNaN(t)) candidates.push(t) }
    }
  }
  if (candidates.length === 0) return null
  const min = Math.min(...candidates)
  return new Date(Math.min(min, now.getTime()))
}

/** Eixo do início do projeto até hoje: diário (curto), semanal (médio) ou mensal. */
function buildAxis(anchor: Date | null, now: Date): Axis {
  const start = anchor ?? new Date(now.getTime() - 7 * 7 * DAY)
  const spanDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / DAY))
  const spanWeeks = Math.max(1, Math.ceil(spanDays / 7))
  const ranges: { from: Date; to: Date }[] = []
  const labels: string[] = []
  const titles: string[] = []

  if (spanDays <= 21) {
    for (let d = 0; d < spanDays; d++) {
      const from = new Date(start.getTime() + d * DAY)
      const to = new Date(Math.min(from.getTime() + DAY, now.getTime()))
      ranges.push({ from, to })
      labels.push(ddmm(from))
      titles.push(`Dia ${d + 1} · ${ddmm(from)}`)
    }
    return { unit: 'day', labels, titles, ranges }
  }

  if (spanWeeks <= 16) {
    for (let w = 0; w < spanWeeks; w++) {
      const from = new Date(start.getTime() + w * 7 * DAY)
      const to = new Date(Math.min(from.getTime() + 7 * DAY, now.getTime()))
      ranges.push({ from, to })
      labels.push(ddmm(from))
      titles.push(`Sem ${w + 1} · ${ddmm(from)} – ${ddmm(new Date(to.getTime() - DAY))}`)
    }
    return { unit: 'week', labels, titles, ranges }
  }

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor.getTime() <= now.getTime()) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    const from = new Date(Math.max(cursor.getTime(), start.getTime()))
    const to = new Date(Math.min(next.getTime(), now.getTime()))
    ranges.push({ from, to })
    labels.push(`${MONTH_ABBR_PT[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`)
    titles.push(`${MONTH_ABBR_PT[cursor.getMonth()]} ${cursor.getFullYear()}`)
    cursor = next
  }
  if (ranges.length === 0) {
    ranges.push({ from: start, to: now })
    labels.push(ddmm(start))
    titles.push(`${ddmm(start)} – ${ddmm(now)}`)
  }
  return { unit: 'month', labels, titles, ranges }
}

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar os relatórios.`
  }
  return message
}

const DAY = 86400000
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
const shortDay = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`

const SEVERITY_ORDER: { key: string[]; label: string; color: string }[] = [
  { key: ['critica', 'crítica', 'critical', 'bloqueante'], label: 'Crítico', color: T.crit },
  { key: ['maior', 'alta', 'high', 'major'], label: 'Alto', color: T.warn },
  { key: ['media', 'média', 'medium', 'menor'], label: 'Médio', color: T.accent },
  { key: ['baixa', 'low', 'trivial'], label: 'Baixo', color: T.text3 },
]

const CFD_STATUSES: { key: string[]; label: string; color: string }[] = [
  { key: ['backlog'], label: 'Backlog', color: T.text3 },
  { key: ['todo', 'ready'], label: 'A Fazer', color: T.text2 },
  { key: ['in_progress', 'blocked'], label: 'Em Andamento', color: T.accent },
  { key: ['in_review', 'testing'], label: 'Revisão', color: T.warn },
  { key: ['done'], label: 'Concluído', color: T.success },
]

/** Status of an item at a given instant, reconstructed from item_status_history. */
function statusAt(item: ItemRow, history: HistoryRow[], at: Date): string | null {
  if (item.created_at && new Date(item.created_at) > at) return null
  const changes = history
    .filter(h => h.field === 'status')
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  const past = changes.filter(h => h.created_at && new Date(h.created_at) <= at)
  if (past.length > 0) return past[past.length - 1].to_value
  if (changes.length > 0) return changes[0].from_value ?? 'backlog'
  // No history at all: assume the item stayed in its current status, unless it was completed later.
  if (item.completed_at && new Date(item.completed_at) > at) return 'in_progress'
  return item.status
}

export async function fetchReportsData(projectIds?: string[]): Promise<ReportsData> {
  const tid = getActiveTenantId()
  const scoped = projectIds && projectIds.length > 0 ? projectIds : null

  let itemsQ = supabase.from('work_items')
    .select('id, key, title, type, status, priority, severity, project_id, sprint_id, epic_id, assignee_id, story_points, is_blocked, created_at, updated_at, completed_at, due_date')
    .eq('tenant_id', tid).is('archived_at', null)
  if (scoped) itemsQ = itemsQ.in('project_id', scoped)

  let sprintsQ = supabase.from('sprints')
    .select('id, project_id, name, state, start_date, end_date, velocity')
    .eq('tenant_id', tid).is('archived_at', null)
  if (scoped) sprintsQ = sprintsQ.in('project_id', scoped)

  let epicsQ = supabase.from('epics')
    .select('id, project_id, name, color').eq('tenant_id', tid).is('archived_at', null)
  if (scoped) epicsQ = epicsQ.in('project_id', scoped)

  let projectsQ = supabase.from('projects')
    .select('id, period_start, created_at').eq('tenant_id', tid)
  if (scoped) projectsQ = projectsQ.in('id', scoped)

  const [items, sprints, epics, profiles, history, projects] = await Promise.all([
    itemsQ.returns<ItemRow[]>(),
    sprintsQ.returns<SprintRow[]>(),
    epicsQ.returns<EpicRow[]>(),
    supabase.from('profiles').select('id, name, avatar_initials').eq('tenant_id', tid).returns<ProfileRow[]>(),
    supabase.from('item_status_history')
      .select('work_item_id, field, from_value, to_value, created_at')
      .eq('tenant_id', tid).order('created_at').returns<HistoryRow[]>(),
    projectsQ.returns<ProjectAnchorRow[]>(),
  ])

  const failed = [
    ['work_items', items.error], ['sprints', sprints.error], ['epics', epics.error],
    ['profiles', profiles.error], ['item_status_history', history.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined
  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  const itemRows = items.data ?? []
  const sprintRows = sprints.data ?? []
  const epicRows = epics.data ?? []
  const profileRows = profiles.data ?? []
  const historyRows = history.data ?? []
  const projectRows = projects.data ?? []

  const historyByItem = new Map<string, HistoryRow[]>()
  for (const h of historyRows) {
    historyByItem.set(h.work_item_id, [...(historyByItem.get(h.work_item_id) ?? []), h])
  }

  const now = new Date()
  const pts = (i: ItemRow) => Number(i.story_points ?? 0)
  const doneAt = (i: ItemRow): Date | null => {
    if (i.completed_at) return new Date(i.completed_at)
    const h = (historyByItem.get(i.id) ?? []).filter(x => x.field === 'status' && x.to_value === 'done')
    return h.length > 0 && h[h.length - 1].created_at ? new Date(h[h.length - 1].created_at) : null
  }

  // ── Velocity ───────────────────────────────────────────────────────────────
  const finished = sprintRows
    .filter(s => s.state === 'completed')
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
    .slice(-8)
  const velocitySeries: SeriesPoint[] = finished.map(s => ({
    label: s.name.replace(/^Sprint\s*/i, 'S'),
    value: s.velocity != null
      ? Number(s.velocity)
      : itemRows.filter(i => i.sprint_id === s.id && i.status === 'done').reduce((a, i) => a + pts(i), 0),
  }))
  const velAvg = velocitySeries.length
    ? Math.round((velocitySeries.reduce((a, b) => a + b.value, 0) / velocitySeries.length) * 10) / 10
    : 0
  const velMax = Math.max(10, ...velocitySeries.map(v => v.value)) * 1.2

  // ── Burndown (active sprint, or the last completed one) ────────────────────
  const activeSprint = sprintRows.find(s => s.state === 'active') ?? finished[finished.length - 1] ?? null
  let burndown: ReportsData['burndown'] = { sprintName: null, days: [], total: 0, ideal: [], actual: [] }
  if (activeSprint?.start_date && activeSprint?.end_date) {
    const start = new Date(activeSprint.start_date)
    const end = new Date(activeSprint.end_date)
    const nDays = Math.max(2, daysDiff(start, end) + 1)
    const sprintItems = itemRows.filter(i => i.sprint_id === activeSprint.id)
    const total = sprintItems.reduce((a, i) => a + pts(i), 0)
    const days: string[] = []
    const actual: number[] = []
    const ideal: number[] = []
    for (let d = 0; d < nDays; d++) {
      const day = addDays(start, d)
      days.push(shortDay(day))
      ideal.push(Math.max(0, total - (total * d) / (nDays - 1)))
      if (day > now) { actual.push(NaN); continue }
      const burned = sprintItems.reduce((a, i) => {
        const dn = doneAt(i)
        return dn && dn <= addDays(day, 1) ? a + pts(i) : a
      }, 0)
      actual.push(Math.max(0, total - burned))
    }
    burndown = { sprintName: activeSprint.name, days, total, ideal, actual }
  }

  // ── CFD — last 14 days ─────────────────────────────────────────────────────
  const cfdDays: string[] = []
  const cfdLayers = CFD_STATUSES.map(s => ({ label: s.label, color: s.color, data: [] as number[] }))
  for (let d = 13; d >= 0; d--) {
    const day = addDays(now, -d)
    cfdDays.push(shortDay(day))
    const counts = CFD_STATUSES.map(() => 0)
    for (const item of itemRows) {
      const st = statusAt(item, historyByItem.get(item.id) ?? [], day)
      if (!st) continue
      const idx = CFD_STATUSES.findIndex(s => s.key.includes(st))
      if (idx >= 0) counts[idx] += 1
    }
    counts.forEach((c, i) => cfdLayers[i].data.push(c))
  }
  const cfdMax = Math.max(
    1,
    ...cfdDays.map((_, d) => cfdLayers.reduce((a, l) => a + l.data[d], 0)),
  )

  // ── Bugs by severity ───────────────────────────────────────────────────────
  const openBugs = itemRows.filter(i => i.type === 'bug' && i.status !== 'done')
  const bugs = SEVERITY_ORDER.map(s => ({
    label: s.label, color: s.color,
    val: openBugs.filter(b => {
      const raw = (b.severity ?? b.priority ?? '').toLowerCase()
      return s.key.includes(raw)
    }).length,
  })).filter(s => s.val > 0)

  // ── Created vs resolved — série CUMULATIVA saindo do zero ─────────────────
  const anchor = projectStartAnchor(projectRows, itemRows, now)
  const axis = buildAxis(anchor, now)
  const axisStart = anchor ?? axis.ranges[0].from
  // Ponto inicial obrigatório (início do projeto, 0/0) + fim de cada bucket.
  const cutoffs = [axisStart, ...axis.ranges.map(r => r.to)]
  const weeks = [ddmm(axisStart), ...axis.labels.map((_, i) => ddmm(axis.ranges[i].to))]
  const bucketTitles = [`Início · ${ddmm(axisStart)}`, ...axis.titles]

  const cumulative = (rows: ItemRow[]) => {
    const createdAt = rows
      .map(i => (i.created_at ? new Date(i.created_at).getTime() : null))
      .filter((t): t is number => t != null && !Number.isNaN(t))
    const resolvedAt = rows
      .map(i => doneAt(i)?.getTime() ?? null)
      .filter((t): t is number => t != null && !Number.isNaN(t))
      // clamp: concluídos antes do início do projeto contam já no primeiro bucket
      .map(t => Math.max(t, axisStart.getTime() + 1))
    return {
      created: cutoffs.map((c, idx) => (idx === 0 ? 0 : createdAt.filter(t => t <= c.getTime()).length)),
      resolved: cutoffs.map((c, idx) => (idx === 0 ? 0 : resolvedAt.filter(t => t <= c.getTime()).length)),
    }
  }

  const { created, resolved } = cumulative(itemRows)
  const cvrMax = Math.max(1, ...created, ...resolved)
  const cvrByProject = (scoped ?? []).map(pid => ({
    projectId: pid,
    ...cumulative(itemRows.filter(i => i.project_id === pid)),
  }))

  // ── Workload ───────────────────────────────────────────────────────────────
  const workload = profileRows
    .map(p => {
      const rows = itemRows.filter(i => i.assignee_id === p.id && i.status !== 'done' && i.status !== 'cancelled')
      return {
        name: p.avatar_initials ?? p.name.slice(0, 2).toUpperCase(),
        fullName: p.name,
        pts: rows.reduce((a, i) => a + pts(i), 0),
      }
    })
    .filter(p => p.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 8)

  // ── Aging of in-flight items ───────────────────────────────────────────────
  const inFlight = itemRows.filter(i => ['in_progress', 'in_review', 'testing', 'blocked'].includes(i.status) || i.is_blocked)
  const aging = inFlight.map(i => {
    const enters = (historyByItem.get(i.id) ?? []).filter(h => h.field === 'status' && h.to_value === i.status)
    const since = enters.length > 0 && enters[enters.length - 1].created_at
      ? new Date(enters[enters.length - 1].created_at)
      : new Date(i.updated_at ?? i.created_at ?? now)
    const days = Math.max(0, Math.round((now.getTime() - since.getTime()) / DAY))
    const tag = i.is_blocked ? 'Bloqueado'
      : i.due_date && new Date(i.due_date) < now ? 'Atrasado' : null
    return {
      id: i.key, itemId: i.id, days, tag,
      color: i.is_blocked ? T.crit : tag ? T.warn : days > 7 ? T.warn : T.success,
    }
  }).sort((a, b) => b.days - a.days).slice(0, 8)

  // ── Lead & cycle time ──────────────────────────────────────────────────────
  const leadValues: number[] = []
  const cycleValues: number[] = []
  for (const i of itemRows) {
    const dn = doneAt(i)
    if (!dn || !i.created_at) continue
    leadValues.push(Math.max(0, (dn.getTime() - new Date(i.created_at).getTime()) / DAY))
    const starts = (historyByItem.get(i.id) ?? []).filter(h => h.field === 'status' && h.to_value === 'in_progress')
    if (starts.length > 0 && starts[0].created_at) {
      cycleValues.push(Math.max(0, (dn.getTime() - new Date(starts[0].created_at).getTime()) / DAY))
    }
  }
  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0
  const bucketDefs: { label: string; test: (d: number) => boolean }[] = [
    { label: '1-3d', test: d => d <= 3 },
    { label: '4-6d', test: d => d > 3 && d <= 6 },
    { label: '7-9d', test: d => d > 6 && d <= 9 },
    { label: '10-14d', test: d => d > 9 && d <= 14 },
    { label: '15+d', test: d => d > 14 },
  ]
  const leadCycle = {
    leadAvg: avg(leadValues),
    cycleAvg: avg(cycleValues),
    buckets: bucketDefs.map(b => ({ label: b.label, value: leadValues.filter(b.test).length })),
  }

  // ── Project health radar ───────────────────────────────────────────────────
  const totalItems = itemRows.length
  const doneCount = itemRows.filter(i => i.status === 'done').length
  const bugRate = totalItems > 0 ? Math.round((itemRows.filter(i => i.type === 'bug').length / totalItems) * 100) : 0
  const blockedCount = itemRows.filter(i => i.is_blocked).length
  const committed = finished.reduce((a, s) => a + itemRows.filter(i => i.sprint_id === s.id).length, 0)
  const delivered = finished.reduce((a, s) => a + itemRows.filter(i => i.sprint_id === s.id && i.status === 'done').length, 0)
  const axes = [
    { label: 'Progresso', val: totalItems ? Math.round((doneCount / totalItems) * 100) : 0 },
    { label: 'Qualidade', val: Math.max(0, 100 - bugRate * 2) },
    { label: 'Previsibilidade', val: committed ? Math.round((delivered / committed) * 100) : 0 },
    { label: 'Fluxo', val: aging.length ? Math.max(0, 100 - Math.round(avg(aging.map(a => a.days)) * 5)) : 100 },
    { label: 'Risco', val: totalItems ? Math.max(0, 100 - Math.round((blockedCount / totalItems) * 100) * 3) : 100 },
  ]
  const health = { axes, score: Math.round(axes.reduce((a, b) => a + b.val, 0) / axes.length) }

  // ── Epic burndown — mesmo eixo ancorado no início do projeto ───────────────
  const epicSeries = epicRows.map(e => {
    const rows = itemRows.filter(i => i.epic_id === e.id)
    const data = axis.ranges.map(({ to: at }) =>
      rows.reduce((a, i) => {
        if (i.created_at && new Date(i.created_at) > at) return a
        const dn = doneAt(i)
        return dn && dn <= at ? a : a + pts(i)
      }, 0))
    return { label: e.name, color: epicColorFor(e.color), data, remaining: data[data.length - 1] }
  })
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 3)
    .map(({ label, color, data }) => ({ label, color, data }))
  const epicMax = Math.max(1, ...epicSeries.flatMap(e => e.data)) * 1.15

  return {
    empty: totalItems === 0,
    scopeProjectIds: scoped,

    velocity: { sprints: velocitySeries, avg: velAvg, max: velMax },
    burndown,
    cfd: { days: cfdDays, layers: cfdLayers, max: cfdMax * 1.1 },
    bugs,
    createdVsResolved: {
      weeks, bucketTitles, unit: axis.unit, axisStart: axisStart.toISOString(),
      created, resolved, max: cvrMax * 1.2, byProject: cvrByProject,
    },
    workload,
    aging,
    leadCycle,
    health,
    epicBurndown: {
      weeks: axis.labels, bucketTitles: axis.titles, unit: axis.unit,
      axisStart: anchor ? anchor.toISOString() : null,
      epics: epicSeries, max: epicMax,
    },
    totals: {
      issues: totalItems,
      velocity: velocitySeries.length ? velocitySeries[velocitySeries.length - 1].value : 0,
      leadAvg: leadCycle.leadAvg,
      bugRate,
    },
  }
}

function daysDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

const EPIC_COLORS: Record<string, string> = {
  purple: T.purple, warning: T.warn, warn: T.warn, inprogress: T.accent, accent: T.accent,
  blue: T.accent, success: T.success, done: T.success, critical: T.crit, crit: T.crit,
  danger: T.crit, indigo: T.indigo, neutral: T.text3,
}
function epicColorFor(color: string | null): string {
  if (!color) return T.accent
  if (color.startsWith('#')) return color
  return EPIC_COLORS[color.toLowerCase()] ?? T.accent
}
