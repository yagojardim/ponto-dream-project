// Dashboards data access layer — read-only aggregations over the connected Supabase project.
// Every read is scoped by tenant_id (never cross-tenant) and, optionally, by the
// projects the user can see (project_members scope). No writes happen here.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { T } from '../../components/ds/tokens'
import { DEFAULT_TENANT_ID } from './timeline'
import { PRIORITY_FROM_DB } from './board'
import type { WorkItem, WorkStatus, RagStatus } from '../../components/ds/DashboardKit'

export { DEFAULT_TENANT_ID }

type Tables = Database['public']['Tables']

type ProjectRow = Pick<Tables['projects']['Row'], 'id' | 'key' | 'name' | 'status' | 'period_start' | 'period_end' | 'metadata'>
type SprintRow = Pick<Tables['sprints']['Row'], 'id' | 'project_id' | 'name' | 'state' | 'start_date' | 'end_date' | 'velocity'>
type ProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials' | 'avatar_color' | 'department'>
type ItemRow = Pick<
  Tables['work_items']['Row'],
  | 'id' | 'key' | 'title' | 'description' | 'type' | 'status' | 'priority' | 'severity'
  | 'project_id' | 'sprint_id' | 'epic_id' | 'assignee_id' | 'reporter_id' | 'story_points'
  | 'is_blocked' | 'blocked_reason' | 'due_date' | 'created_at' | 'updated_at' | 'completed_at'
  | 'acceptance_status' | 'progress' | 'feature_id'
>
type FeatureRow = Pick<Tables['features']['Row'], 'id' | 'epic_id' | 'name'>
type EpicRow = Pick<Tables['epics']['Row'], 'id' | 'project_id'>
type DependencyRow = Pick<Tables['dependencies']['Row'], 'source_id' | 'target_id' | 'relation_type'>
type LabelJoinRow = { work_item_id: string; labels: { name: string } | { name: string }[] | null }

/** DB statuses (snake_case) → DashboardKit statuses (kebab-case). */
export const STATUS_FROM_DB: Record<string, WorkStatus> = {
  backlog: 'backlog', todo: 'todo', ready: 'ready',
  in_progress: 'in-progress', in_review: 'in-review', testing: 'testing',
  blocked: 'blocked', done: 'done', cancelled: 'cancelled',
}

const TYPE_FROM_DB: Record<string, WorkItem['type']> = {
  story: 'story', task: 'task', bug: 'bug', epic: 'epic', subtask: 'subtask',
}

const PROJECT_PALETTE = [T.accent, T.success, T.purple, T.warn, T.indigo, T.crit]

export function dashProjectColor(project: { metadata: unknown }, index: number): string {
  const meta = project.metadata as Record<string, unknown> | null
  const c = meta && typeof meta.color === 'string' ? meta.color : null
  return c && c.startsWith('#') ? c : PROJECT_PALETTE[index % PROJECT_PALETTE.length]
}

export interface RagProject {
  id: string
  key: string
  name: string
  squad: string
  color: string
  rag: RagStatus
  reason?: string
  pct: number
  done: number
  total: number
  points: number
  donePoints: number
  blockedCount: number
  daysLeft: number
  daysLabel: string
  periodEnd: string | null
  status: string | null
  finalizedAt: string | null
  finalizeNote: string | null
}

export interface SprintSummary {
  id: string
  name: string
  projectId: string
  projectName: string
  startDate: string | null
  endDate: string | null
  done: number
  total: number
  pct: number
  points: number
  donePoints: number
  daysLeft: number
  items: WorkItem[]
}

export interface WorkloadEntry {
  profileId: string
  name: string
  initials: string
  color: string
  active: number
  points: number
}

export interface DashboardProjectOption {
  id: string
  name: string
  color: string
  status?: string | null
  finalizedAt?: string | null
  finalizeNote?: string | null
}

/** Agregado de funcionalidades (projetos Pro) no escopo carregado. */
export interface FeatureAggregate {
  total: number
  done: number
  totalPoints: number
  donePoints: number
  pct: number
}

/** Lê metadados de finalização do projeto. */
export function projectFinalizeInfo(metadata: unknown): { finalizedAt: string | null; finalizeNote: string | null } {
  const meta = (metadata ?? null) as Record<string, unknown> | null
  const at = meta && typeof meta.finalized_at === 'string' ? meta.finalized_at : null
  const note = meta && typeof meta.finalize_note === 'string' ? meta.finalize_note : null
  return { finalizedAt: at, finalizeNote: note }
}

/** Métricas de entrega calculadas das próprias demandas (sem CI/deploy). */
export interface DeliveryMetrics {
  leadTimeDias: number | null
  vazaoSemana: number | null
  cycleTimeDias: number | null
  taxaBugsPct: number | null
}

/** Linha mínima usada para calcular as métricas de entrega. */
export interface DeliveryRow {
  projectId: string
  type: string
  status: string
  createdAt: string | null
  completedAt: string | null
  firstInProgressAt: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Calcula lead time, vazão, cycle time e retrabalho para um conjunto de demandas. */
export function computeDeliveryMetrics(rows: DeliveryRow[]): DeliveryMetrics {
  if (rows.length === 0) {
    return { leadTimeDias: null, vazaoSemana: null, cycleTimeDias: null, taxaBugsPct: null }
  }

  const doneRows = rows.filter(r => r.status === 'done' && r.completedAt)

  const leadDays = doneRows
    .filter(r => r.createdAt)
    .map(r => (new Date(r.completedAt!).getTime() - new Date(r.createdAt!).getTime()) / DAY)
    .filter(d => Number.isFinite(d) && d >= 0)
  const leadTimeDias = leadDays.length ? round1(leadDays.reduce((a, b) => a + b, 0) / leadDays.length) : null

  const anchorTimes = rows.map(r => (r.createdAt ? new Date(r.createdAt).getTime() : NaN)).filter(t => !Number.isNaN(t))
  let vazaoSemana: number | null = null
  if (anchorTimes.length && doneRows.length) {
    const weeks = Math.max(1, (Date.now() - Math.min(...anchorTimes)) / (DAY * 7))
    vazaoSemana = round1(doneRows.length / weeks)
  }

  const cycleDays = doneRows
    .filter(r => r.firstInProgressAt)
    .map(r => (new Date(r.completedAt!).getTime() - new Date(r.firstInProgressAt!).getTime()) / DAY)
    .filter(d => Number.isFinite(d) && d >= 0)
  const cycleTimeDias = cycleDays.length ? round1(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null

  const taxaBugsPct = round1((rows.filter(r => r.type === 'bug').length / rows.length) * 100)

  return { leadTimeDias, vazaoSemana, cycleTimeDias, taxaBugsPct }
}

export interface DashboardAggregates {
  projects: DashboardProjectOption[]
  rag: RagProject[]
  consolidatedPct: number
  planned: number
  done: number
  plannedPoints: number
  donePoints: number
  currentSprints: SprintSummary[]
  blockers: WorkItem[]
  openDependencies: { source: WorkItem; target: WorkItem; relation: string }[]
  upcoming: WorkItem[]
  workload: WorkloadEntry[]
  items: WorkItem[]
  /** Métricas de entrega de todo o escopo carregado. */
  delivery: DeliveryMetrics
  /** Linhas cruas para recalcular as métricas por subconjunto de projetos. */
  deliveryRows: DeliveryRow[]
  counts: {
    projects: number
    activeProjects: number
    atRisk: number
    blocked: number
    bugs: number
    criticalBugs: number
    unassigned: number
    ready: number
    testing: number
    people: number
  }
  velocityAvg: number
  predictability: number
  features: FeatureAggregate
}


function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar os dashboards.`
  }
  return message
}

const DAY = 86400000
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

/** Resolves the project ids a profile may see (project_members). Empty ⇒ all tenant projects. */
export async function fetchScopedProjectIds(profileId?: string | null): Promise<string[] | null> {
  if (!profileId) return null
  const { data, error } = await supabase
    .from('project_members').select('project_id')
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('profile_id', profileId)
  if (error) return null
  const ids = (data ?? []).map(r => r.project_id)
  return ids.length > 0 ? ids : null
}

export function toWorkItem(
  row: ItemRow,
  profiles: Map<string, ProfileRow>,
  sprints: Map<string, SprintRow>,
  labels: Map<string, string[]>,
): WorkItem {
  const assignee = row.assignee_id ? profiles.get(row.assignee_id) : undefined
  const reporter = row.reporter_id ? profiles.get(row.reporter_id) : undefined
  const person = (p?: ProfileRow) => p
    ? { name: p.name, initials: p.avatar_initials ?? p.name.slice(0, 2).toUpperCase(), color: p.avatar_color ?? T.accent }
    : undefined
  const sprint = row.sprint_id ? sprints.get(row.sprint_id) : undefined
  const blockedSince = row.updated_at ? Math.max(0, daysBetween(new Date(row.updated_at), new Date())) : 0

  return {
    id: row.id,
    key: row.key,
    title: row.title,
    type: TYPE_FROM_DB[row.type] ?? 'task',
    status: row.is_blocked ? 'blocked' : (STATUS_FROM_DB[row.status] ?? 'backlog'),
    priority: PRIORITY_FROM_DB[(row.priority ?? '').toLowerCase()] ?? 'medium',
    assignee: person(assignee),
    reporter: person(reporter),
    sprint: sprint?.name,
    project_id: row.project_id,
    squad_id: assignee?.department ?? '',
    points: row.story_points != null ? Number(row.story_points) : undefined,
    description: row.description ?? undefined,
    tags: labels.get(row.id) ?? [],
    created_at: row.created_at ?? undefined,
    due_date: row.due_date ?? undefined,
    days_blocked: row.is_blocked ? blockedSince : undefined,
  }
}

/**
 * Loads every aggregate the dashboards need in a single round-trip.
 * `projectIds` narrows the read to the selected/allowed projects.
 */
export async function fetchDashboardAggregates(projectIds?: string[]): Promise<DashboardAggregates> {
  const tid = DEFAULT_TENANT_ID
  const scoped = projectIds && projectIds.length > 0 ? projectIds : null

  let projectsQ = supabase.from('projects')
    .select('id, key, name, status, period_start, period_end, metadata')
    .eq('tenant_id', tid).is('archived_at', null).order('name')
  if (scoped) projectsQ = projectsQ.in('id', scoped)

  let itemsQ = supabase.from('work_items')
    .select('id, key, title, description, type, status, priority, severity, project_id, sprint_id, epic_id, feature_id, assignee_id, reporter_id, story_points, is_blocked, blocked_reason, due_date, created_at, updated_at, completed_at, acceptance_status, progress')
    .eq('tenant_id', tid).is('archived_at', null).order('key')
  if (scoped) itemsQ = itemsQ.in('project_id', scoped)

  let sprintsQ = supabase.from('sprints')
    .select('id, project_id, name, state, start_date, end_date, velocity')
    .eq('tenant_id', tid).is('archived_at', null)
  if (scoped) sprintsQ = sprintsQ.in('project_id', scoped)

  const [projects, items, sprints, profiles, deps, labels, history, features, epics] = await Promise.all([
    projectsQ.returns<ProjectRow[]>(),
    itemsQ.returns<ItemRow[]>(),
    sprintsQ.returns<SprintRow[]>(),
    supabase.from('profiles').select('id, name, avatar_initials, avatar_color, department')
      .eq('tenant_id', tid).is('archived_at', null).returns<ProfileRow[]>(),
    supabase.from('dependencies').select('source_id, target_id, relation_type')
      .eq('tenant_id', tid).returns<DependencyRow[]>(),
    supabase.from('work_item_labels').select('work_item_id, labels(name)').eq('tenant_id', tid),
    supabase.from('item_status_history').select('work_item_id, to_value, created_at')
      .eq('tenant_id', tid).eq('field', 'status').eq('to_value', 'in_progress')
      .order('created_at', { ascending: true }),
    supabase.from('features').select('id, epic_id, name')
      .eq('tenant_id', tid).is('archived_at', null).returns<FeatureRow[]>(),
    supabase.from('epics').select('id, project_id')
      .eq('tenant_id', tid).is('archived_at', null).returns<EpicRow[]>(),
  ])


  const failed = [
    ['projects', projects.error], ['work_items', items.error], ['sprints', sprints.error],
    ['profiles', profiles.error], ['dependencies', deps.error], ['work_item_labels', labels.error],
    ['features', features.error], ['epics', epics.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined
  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  const projectRows = projects.data ?? []
  const itemRows = items.data ?? []
  const sprintRows = sprints.data ?? []
  const profileRows = profiles.data ?? []

  const profileMap = new Map(profileRows.map(p => [p.id, p]))
  const sprintMap = new Map(sprintRows.map(s => [s.id, s]))
  const labelMap = new Map<string, string[]>()
  for (const row of (labels.data ?? []) as LabelJoinRow[]) {
    const rel = row.labels
    if (!rel) continue
    const list = Array.isArray(rel) ? rel : [rel]
    labelMap.set(row.work_item_id, [...(labelMap.get(row.work_item_id) ?? []), ...list.map(l => l.name)])
  }

  const workItems = itemRows.map(r => toWorkItem(r, profileMap, sprintMap, labelMap))
  const byId = new Map(workItems.map(w => [w.id, w]))
  const today = new Date()

  // ── RAG per project ────────────────────────────────────────────────────────
  const rag: RagProject[] = projectRows.map((p, idx) => {
    const rows = itemRows.filter(i => i.project_id === p.id)
    const total = rows.length
    const done = rows.filter(i => i.status === 'done').length
    const points = rows.reduce((s, i) => s + Number(i.story_points ?? 0), 0)
    const donePoints = rows.filter(i => i.status === 'done').reduce((s, i) => s + Number(i.story_points ?? 0), 0)
    const blockedCount = rows.filter(i => i.is_blocked).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    const end = p.period_end ? new Date(p.period_end) : null
    const daysLeft = end ? daysBetween(today, end) : 0
    const overdueItems = rows.filter(i => i.due_date && i.status !== 'done' && new Date(i.due_date) < today).length

    let status: RagStatus = 'healthy'
    let reason: string | undefined
    if (blockedCount > 0) {
      status = 'blocked'
      const first = rows.find(i => i.is_blocked)
      reason = first?.blocked_reason ?? `${blockedCount} item(ns) bloqueado(s)`
    } else if (end && daysLeft < 0) {
      status = 'risk'; reason = `Período encerrado há ${Math.abs(daysLeft)}d com ${total - done} item(ns) em aberto`
    } else if (overdueItems > 0) {
      status = 'risk'; reason = `${overdueItems} item(ns) com prazo vencido`
    } else if (end && daysLeft <= 14 && pct < 70) {
      status = 'risk'; reason = `${pct}% concluído a ${daysLeft}d do fim do período`
    }
    if (status !== 'healthy' && !reason) reason = 'Atenção necessária'

    const squadNames = new Set(
      rows.map(i => (i.assignee_id ? profileMap.get(i.assignee_id)?.department : null)).filter(Boolean) as string[],
    )

    return {
      id: p.id, key: p.key, name: p.name,
      squad: squadNames.size === 1 ? [...squadNames][0] : p.key,
      color: dashProjectColor(p, idx),
      rag: status, reason,
      pct, done, total, points, donePoints, blockedCount,
      daysLeft,
      daysLabel: !end ? 'sem período definido'
        : daysLeft >= 0 ? `${daysLeft}d restantes` : `${Math.abs(daysLeft)}d de atraso`,
      periodEnd: p.period_end,
      status: p.status ?? null,
      ...projectFinalizeInfo(p.metadata),
    }
  })

  // ── Funcionalidades no escopo ─────────────────────────────────────────────
  const projectIdSet = new Set(projectRows.map(p => p.id))
  const epicProject = new Map((epics.data ?? []).map(e => [e.id, e.project_id]))
  const scopedFeatures = (features.data ?? []).filter(f => {
    const pid = f.epic_id ? epicProject.get(f.epic_id) : null
    return pid ? projectIdSet.has(pid) : false
  })
  const scopedFeatureIds = new Set(scopedFeatures.map(f => f.id))
  const featureItems = itemRows.filter(i => i.feature_id && scopedFeatureIds.has(i.feature_id))
  const featureTotalPoints = featureItems.reduce((s2, i) => s2 + Number(i.story_points ?? 0), 0)
  const featureDonePoints = featureItems.filter(i => i.status === 'done')
    .reduce((s2, i) => s2 + Number(i.story_points ?? 0), 0)
  const featuresDone = scopedFeatures.filter(f => {
    const rows = featureItems.filter(i => i.feature_id === f.id)
    return rows.length > 0 && rows.every(i => i.status === 'done')
  }).length
  const featureAggregate: FeatureAggregate = {
    total: scopedFeatures.length,
    done: featuresDone,
    totalPoints: featureTotalPoints,
    donePoints: featureDonePoints,
    pct: featureTotalPoints > 0 ? Math.round((featureDonePoints / featureTotalPoints) * 100) : 0,
  }

  const totalItems = itemRows.length
  const doneItems = itemRows.filter(i => i.status === 'done').length
  const plannedPoints = itemRows.reduce((s, i) => s + Number(i.story_points ?? 0), 0)
  const donePoints = itemRows.filter(i => i.status === 'done').reduce((s, i) => s + Number(i.story_points ?? 0), 0)

  // ── Current (active) sprint per project ────────────────────────────────────
  const currentSprints: SprintSummary[] = sprintRows
    .filter(s => s.state === 'active')
    .map(s => {
      const rows = itemRows.filter(i => i.sprint_id === s.id)
      const total = rows.length
      const done = rows.filter(i => i.status === 'done').length
      const end = s.end_date ? new Date(s.end_date) : null
      return {
        id: s.id, name: s.name, projectId: s.project_id,
        projectName: projectRows.find(p => p.id === s.project_id)?.name ?? '—',
        startDate: s.start_date, endDate: s.end_date,
        done, total,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        points: rows.reduce((acc, i) => acc + Number(i.story_points ?? 0), 0),
        donePoints: rows.filter(i => i.status === 'done').reduce((acc, i) => acc + Number(i.story_points ?? 0), 0),
        daysLeft: end ? daysBetween(today, end) : 0,
        items: rows.map(r => byId.get(r.id)!).filter(Boolean),
      }
    })

  // ── Blockers & open dependencies ───────────────────────────────────────────
  const blockers = workItems
    .filter(w => w.status === 'blocked')
    .sort((a, b) => (b.days_blocked ?? 0) - (a.days_blocked ?? 0))

  const openDependencies = (deps.data ?? [])
    .map(d => ({ source: byId.get(d.source_id), target: byId.get(d.target_id), relation: d.relation_type }))
    .filter(d => d.source && d.target && d.target.status !== 'done')
    .map(d => ({ source: d.source!, target: d.target!, relation: d.relation }))

  // ── Upcoming deliveries ────────────────────────────────────────────────────
  const upcoming = workItems
    .filter(w => w.status !== 'done' && w.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 12)

  // ── Workload per person ────────────────────────────────────────────────────
  const workload: WorkloadEntry[] = profileRows
    .map(p => {
      const rows = itemRows.filter(i => i.assignee_id === p.id && i.status !== 'done' && i.status !== 'cancelled')
      return {
        profileId: p.id,
        name: p.name,
        initials: p.avatar_initials ?? p.name.slice(0, 2).toUpperCase(),
        color: p.avatar_color ?? T.accent,
        active: rows.length,
        points: rows.reduce((s, i) => s + Number(i.story_points ?? 0), 0),
      }
    })
    .filter(w => w.active > 0)
    .sort((a, b) => b.points - a.points)

  // ── Velocity & predictability from completed sprints ───────────────────────
  const completed = sprintRows
    .filter(s => s.state === 'completed')
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
  const velocities = completed.map(s => {
    if (s.velocity != null) return Number(s.velocity)
    return itemRows.filter(i => i.sprint_id === s.id && i.status === 'done')
      .reduce((acc, i) => acc + Number(i.story_points ?? 0), 0)
  })
  const velocityAvg = velocities.length ? Math.round((velocities.reduce((a, b) => a + b, 0) / velocities.length) * 10) / 10 : 0

  const committed = completed.reduce((s, sp) => s + itemRows.filter(i => i.sprint_id === sp.id).length, 0)
  const delivered = completed.reduce((s, sp) => s + itemRows.filter(i => i.sprint_id === sp.id && i.status === 'done').length, 0)
  const predictability = committed > 0 ? Math.round((delivered / committed) * 100) : 0

  const bugs = itemRows.filter(i => i.type === 'bug' && i.status !== 'done')

  // ── Métricas de entrega (lead time, vazão, cycle time, retrabalho) ─────────
  const firstInProgress = new Map<string, string>()
  for (const h of (history.error ? [] : (history.data ?? [])) as { work_item_id: string; created_at: string }[]) {
    if (!firstInProgress.has(h.work_item_id)) firstInProgress.set(h.work_item_id, h.created_at)
  }
  const deliveryRows: DeliveryRow[] = itemRows.map(i => ({
    projectId: i.project_id,
    type: i.type,
    status: i.status,
    createdAt: i.created_at,
    completedAt: i.completed_at,
    firstInProgressAt: firstInProgress.get(i.id) ?? null,
  }))

  return {
    delivery: computeDeliveryMetrics(deliveryRows),
    deliveryRows,

    features: featureAggregate,
    projects: projectRows.map((p, i) => ({
      id: p.id, name: p.name, color: dashProjectColor(p, i),
      status: p.status ?? null, ...projectFinalizeInfo(p.metadata),
    })),
    rag,
    consolidatedPct: totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0,
    planned: totalItems,
    done: doneItems,
    plannedPoints,
    donePoints,
    currentSprints,
    blockers,
    openDependencies,
    upcoming,
    workload,
    items: workItems,
    counts: {
      projects: projectRows.length,
      activeProjects: projectRows.filter(p => p.status === 'active').length,
      atRisk: rag.filter(r => r.rag !== 'healthy').length,
      blocked: blockers.length,
      bugs: bugs.length,
      criticalBugs: bugs.filter(b => ['critica', 'crítica', 'critical', 'alta'].includes((b.priority ?? '').toLowerCase())).length,
      unassigned: itemRows.filter(i => !i.assignee_id && i.status !== 'done').length,
      ready: itemRows.filter(i => i.status === 'ready' || i.status === 'todo').length,
      testing: itemRows.filter(i => i.status === 'in_review' || i.status === 'testing').length,
      people: profileRows.length,
    },
    velocityAvg,
    predictability,
  }
}

/** Lightweight project options for filters (tenant-scoped). */
export async function listDashboardProjects(): Promise<DashboardProjectOption[]> {
  const { data, error } = await supabase.from('projects')
    .select('id, name, status, metadata')
    .eq('tenant_id', DEFAULT_TENANT_ID).is('archived_at', null).order('name')
  if (error) throw new Error(missingTableMessage('projects', error.message))
  return (data ?? []).map((p, i) => ({
    id: p.id, name: p.name, color: dashProjectColor(p, i),
    status: p.status ?? null, ...projectFinalizeInfo(p.metadata),
  }))
}

// ─── Admin Master KPIs ────────────────────────────────────────────────────────

export interface AdminKpis {
  projects: { total: number; active: number }
  boards: { total: number; active: number }
  modules: { total: number; active: number }
  users: { total: number; active: number; blocked: number }
  invites: { pending: number; nextExpiryDays: number | null }
}

const ACTIVE_MODULE_STATUSES = ['operational', 'implemented', 'preview', 'trial', 'active']

/** Real per-tenant counts for the Admin Master dashboard. Never cross-tenant. */
export async function fetchAdminKpis(projectIds?: string[]): Promise<AdminKpis> {
  const tid = DEFAULT_TENANT_ID
  const ids = projectIds && projectIds.length > 0 ? projectIds : null

  let projectsQ = supabase.from('projects').select('id, status').eq('tenant_id', tid).is('archived_at', null)
  if (ids) projectsQ = projectsQ.in('id', ids)
  let boardsQ = supabase.from('boards').select('id, status').eq('tenant_id', tid).is('archived_at', null)
  if (ids) boardsQ = boardsQ.in('project_id', ids)

  const [projects, boards, modules, profiles, invites] = await Promise.all([
    projectsQ,
    boardsQ,
    supabase.from('tenant_modules').select('id, status').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('profiles').select('id, status').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('invitations').select('id, status, expires_at').eq('tenant_id', tid),
  ])


  const failed = [
    ['projects', projects.error], ['boards', boards.error], ['tenant_modules', modules.error],
    ['profiles', profiles.error], ['invitations', invites.error],
  ].find(([, e]) => e) as [string, { message: string }] | undefined
  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  const projectRows = projects.data ?? []
  const boardRows = boards.data ?? []
  const moduleRows = modules.data ?? []
  const profileRows = profiles.data ?? []
  const inviteRows = (invites.data ?? []).filter(i => (i.status ?? '').toLowerCase() === 'pending')

  const nextExpiry = inviteRows
    .map(i => new Date(i.expires_at).getTime())
    .filter(t => !Number.isNaN(t))
    .sort((a, b) => a - b)[0]

  return {
    projects: {
      total: projectRows.length,
      active: projectRows.filter(p => ['active', 'in_progress', 'em_andamento'].includes((p.status ?? '').toLowerCase())).length,
    },
    boards: {
      total: boardRows.length,
      active: boardRows.filter(b => (b.status ?? '').toLowerCase() === 'active').length,
    },
    modules: {
      total: moduleRows.length,
      active: moduleRows.filter(m => ACTIVE_MODULE_STATUSES.includes((m.status ?? '').toLowerCase())).length,
    },
    users: {
      total: profileRows.length,
      active: profileRows.filter(p => (p.status ?? '').toLowerCase() === 'active').length,
      blocked: profileRows.filter(p => ['blocked', 'suspended'].includes((p.status ?? '').toLowerCase())).length,
    },
    invites: {
      pending: inviteRows.length,
      nextExpiryDays: nextExpiry != null ? Math.floor((nextExpiry - Date.now()) / 86400000) : null,
    },
  }
}


// ─── Product Owner mural cards ───────────────────────────────────────────────
export interface PoCardMetrics {
  createdVsFinalized: {
    created: number
    finalized: number
    weekly: { label: string; value: number; current?: boolean }[]
  }
  releasesHealth: {
    healthPct: number
    activeCount: number
    overdue: boolean
    perRelease: { label: string; value: number; current?: boolean }[]
  }
}

const DONE_STATUSES = ['done', 'concluido', 'concluído']

function startOfWeek(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // Monday = 0
  x.setDate(x.getDate() - dow)
  return x.getTime()
}

/** Live metrics for the two Product Owner mural cards, scoped by project(s). */
export async function fetchPoCardMetrics(projectIds: string[]): Promise<PoCardMetrics> {
  try {
    let itemsQ = supabase.from('work_items')
      .select('id, status, created_at, completed_at, project_id, release_id')
      .eq('tenant_id', DEFAULT_TENANT_ID).is('archived_at', null)
    let relQ = supabase.from('releases')
      .select('id, project_id, version, state, release_date')
      .eq('tenant_id', DEFAULT_TENANT_ID).is('archived_at', null)
    if (projectIds.length > 0) {
      itemsQ = itemsQ.in('project_id', projectIds)
      relQ = relQ.in('project_id', projectIds)
    }

    const [items, releases] = await Promise.all([itemsQ, relQ])
    if (items.error) throw new Error(items.error.message)
    if (releases.error) throw new Error(releases.error.message)

    const rows = items.data ?? []
    const isDone = (s: string | null) => DONE_STATUSES.includes((s ?? '').toLowerCase())

    const created = rows.length
    const finalized = rows.filter(r => isDone(r.status)).length

    // Finalized per ISO week — last 4 weeks.
    const thisWeek = startOfWeek(new Date())
    const WEEK = 7 * 86400000
    const buckets = [3, 2, 1, 0].map(back => thisWeek - back * WEEK)
    const labels = ['S-3', 'S-2', 'S-1', 'Atual']
    const weekly = buckets.map((start, i) => ({
      label: labels[i],
      value: rows.filter(r => {
        if (!isDone(r.status) || !r.completed_at) return false
        const t = new Date(r.completed_at).getTime()
        return !Number.isNaN(t) && t >= start && t < start + WEEK
      }).length,
      ...(i === buckets.length - 1 ? { current: true } : {}),
    }))

    // Releases health.
    const active = (releases.data ?? []).filter(r => (r.state ?? '') !== 'released')
    const activeIds = new Set(active.map(r => r.id))
    const linked = rows.filter(r => r.release_id && activeIds.has(r.release_id))
    const linkedDone = linked.filter(r => isDone(r.status)).length
    const healthPct = linked.length > 0 ? Math.round((linkedDone / linked.length) * 100) : 100

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const overdue = active.some(r => r.release_date && new Date(r.release_date).getTime() < today.getTime())

    const sorted = [...active].sort((a, b) => {
      const ta = a.release_date ? new Date(a.release_date).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.release_date ? new Date(b.release_date).getTime() : Number.MAX_SAFE_INTEGER
      return tb - ta
    }).slice(0, 4)
    const nearest = [...sorted].sort((a, b) => {
      const da = a.release_date ? Math.abs(new Date(a.release_date).getTime() - today.getTime()) : Number.MAX_SAFE_INTEGER
      const db = b.release_date ? Math.abs(new Date(b.release_date).getTime() - today.getTime()) : Number.MAX_SAFE_INTEGER
      return da - db
    })[0]
    const perRelease = sorted.reverse().map(r => {
      const own = rows.filter(w => w.release_id === r.id)
      const ownDone = own.filter(w => isDone(w.status)).length
      return {
        label: r.version ?? '—',
        value: own.length > 0 ? Math.round((ownDone / own.length) * 100) : 0,
        ...(nearest && nearest.id === r.id ? { current: true } : {}),
      }
    })

    return {
      createdVsFinalized: { created, finalized, weekly },
      releasesHealth: { healthPct, activeCount: active.length, overdue, perRelease },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Falha ao carregar métricas do painel P.O.: ${msg}`)
  }
}
