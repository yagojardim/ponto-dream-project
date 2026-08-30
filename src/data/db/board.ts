// Board / Kanban data access layer — reads real data from the connected Supabase project.
// Same pattern as ./timeline.ts: every read and write is scoped by tenant_id (never cross-tenant).
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { T } from '../../components/ds/tokens'
import { DEFAULT_TENANT_ID, epicColor } from './timeline'
import { sortSprintsByStartDate } from './sprints'
import { writeAudit as writeMilestone } from './audit'
import { SCRUM_COLUMNS, KANBAN_COLUMNS, type BoardColumnDef } from './boardColumnDefs'
import { applyBoardFilter } from './filterTranslator'
import type { BoardFilter } from './filterTranslator'

export { DEFAULT_TENANT_ID }
export type { BoardFilter }

type Tables = Database['public']['Tables']

export type BoardRow = Pick<Tables['boards']['Row'], 'id' | 'project_id' | 'name' | 'board_type' | 'status' | 'filter'>
export type BoardColumnRow = Pick<
  Tables['board_columns']['Row'],
  'id' | 'board_id' | 'name' | 'category' | 'position' | 'wip_limit'
>
export type BoardSprintRow = Pick<
  Tables['sprints']['Row'],
  'id' | 'project_id' | 'name' | 'goal' | 'state' | 'start_date' | 'end_date' | 'velocity' | 'metadata'
>
export type BoardItemRow = Pick<
  Tables['work_items']['Row'],
  | 'id' | 'key' | 'title' | 'description' | 'type' | 'status' | 'priority' | 'severity'
  | 'project_id' | 'board_id' | 'board_column_id' | 'sprint_id' | 'epic_id' | 'feature_id'
  | 'assignee_id' | 'reporter_id' | 'story_points' | 'position' | 'is_blocked'
  | 'blocked_reason' | 'due_date'
>
export type BoardFeatureRow = Pick<Tables['features']['Row'], 'id' | 'epic_id' | 'name'>
export type BoardEpicRow = Pick<Tables['epics']['Row'], 'id' | 'project_id' | 'key' | 'name' | 'color'>
export type BoardProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials' | 'avatar_color'>
export type BoardProjectRow = Pick<Tables['projects']['Row'], 'id' | 'name' | 'metadata'>

/** A board column enriched with the statuses it maps (board_column_statuses). */
export interface BoardColumnDef extends BoardColumnRow {
  statuses: string[]
}

export interface BoardData {
  board: BoardRow | null
  project: BoardProjectRow | null
  boards: BoardRow[]
  columns: BoardColumnDef[]
  items: BoardItemRow[]
  sprints: BoardSprintRow[]
  epics: BoardEpicRow[]
  features: BoardFeatureRow[]
  profiles: BoardProfileRow[]
}

/** Colour used for the column dot, derived from its category. */
export const COLUMN_CATEGORY_COLOR: Record<string, string> = {
  todo: T.text2,
  backlog: T.text3,
  in_progress: T.accent,
  in_review: T.warn,
  review: T.warn,
  done: T.success,
  blocked: T.crit,
}

export function columnColor(column: BoardColumnRow): string {
  return COLUMN_CATEGORY_COLOR[(column.category ?? '').toLowerCase()] ?? T.text3
}

/** DB priorities are stored in pt-BR. */
export const PRIORITY_FROM_DB: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  critica: 'critical', crítica: 'critical', critical: 'critical',
  alta: 'high', high: 'high',
  media: 'medium', média: 'medium', medium: 'medium',
  baixa: 'low', low: 'low',
}
export const PRIORITY_TO_DB: Record<string, string> = {
  critical: 'critica', high: 'alta', medium: 'media', low: 'baixa',
}

export { epicColor }

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar o Board.`
  }
  return message
}

function fail(table: string, message: string): Error {
  return new Error(missingTableMessage(table, message))
}

/** Parses the JSONB filter column into a typed BoardFilter (or null when empty). */
function parseBoardFilter(raw: unknown): BoardFilter | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.conditions) || obj.conditions.length === 0) return null
  return obj as unknown as BoardFilter
}

/**
 * Loads everything the Kanban needs. When `projectId` is omitted the first
 * active board of the tenant is used.
 */
export async function fetchBoardData(projectId?: string, boardId?: string, boardName?: string): Promise<BoardData> {
  const tid = DEFAULT_TENANT_ID

  let boardsQuery = supabase
    .from('boards')
    .select('id, project_id, name, board_type, status, filter')
    .eq('tenant_id', tid)
    .is('archived_at', null)
    .order('name')
  if (projectId) boardsQuery = boardsQuery.eq('project_id', projectId)

  const boardsRes = await boardsQuery
  if (boardsRes.error) throw new Error(missingTableMessage('boards', boardsRes.error.message))

  const boards = (boardsRes.data ?? []) as BoardRow[]
  const board =
    (boardId ? boards.find(b => b.id === boardId) : undefined) ??
    (boardName ? boards.find(b => b.name.toLowerCase() === boardName.toLowerCase()) : undefined) ??
    boards[0] ?? null

  if (!board) {
    return { board: null, project: null, boards, columns: [], items: [], sprints: [], epics: [], features: [], profiles: [] }
  }

  // Build items query: always scoped by project_id, then apply board.filter on top.
  const boardFilter = parseBoardFilter(board.filter)
  let itemsQuery = supabase
    .from('work_items')
    .select('id, key, title, description, type, status, priority, severity, project_id, board_id, board_column_id, sprint_id, epic_id, feature_id, assignee_id, reporter_id, story_points, position, is_blocked, blocked_reason, due_date')
    .eq('tenant_id', tid)
    .eq('project_id', board.project_id)
    .is('archived_at', null)
  // Apply board filter conditions (synonym-aware) — no-op when filter is empty.
  itemsQuery = applyBoardFilter(itemsQuery, boardFilter)

  const [columnsRes, statusesRes, itemsRes, sprintsRes, epicsRes, featuresRes, profilesRes, projectRes] = await Promise.all([
    supabase.from('board_columns').select('id, board_id, name, category, position, wip_limit')
      .eq('tenant_id', tid).eq('board_id', board.id).order('position'),
    supabase.from('board_column_statuses').select('board_column_id, status_key').eq('tenant_id', tid),
    itemsQuery.order('position'),
    supabase.from('sprints').select('id, project_id, name, goal, state, start_date, end_date, velocity, metadata')
      .eq('tenant_id', tid).eq('project_id', board.project_id).is('archived_at', null)
      .order('start_date', { ascending: true, nullsFirst: false }),
    supabase.from('epics').select('id, project_id, key, name, color')
      .eq('tenant_id', tid).eq('project_id', board.project_id).is('archived_at', null),
    supabase.from('features').select('id, epic_id, name')
      .eq('tenant_id', tid).is('archived_at', null),
    supabase.from('profiles').select('id, name, avatar_initials, avatar_color').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('projects').select('id, name, metadata').eq('id', board.project_id).eq('tenant_id', tid).maybeSingle(),
  ])

  const failed = [
    ['board_columns', columnsRes.error], ['board_column_statuses', statusesRes.error],
    ['work_items', itemsRes.error], ['sprints', sprintsRes.error],
    ['epics', epicsRes.error], ['features', featuresRes.error], ['profiles', profilesRes.error],
    ['projects', projectRes.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined
  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  const statusesByColumn = new Map<string, string[]>()
  for (const row of statusesRes.data ?? []) {
    const list = statusesByColumn.get(row.board_column_id) ?? []
    list.push(row.status_key)
    statusesByColumn.set(row.board_column_id, list)
  }

  const columns: BoardColumnDef[] = (columnsRes.data ?? []).map(c => ({
    ...c,
    statuses: statusesByColumn.get(c.id) ?? [],
  }))

  return {
    board,
    project: projectRes.data ?? null,
    boards,
    columns,
    items: (itemsRes.data ?? []) as BoardItemRow[],
    sprints: ((sprintsRes.data ?? []) as BoardSprintRow[]).slice().sort(sortSprintsByStartDate),
    epics: epicsRes.data ?? [],
    features: featuresRes.data ?? [],
    profiles: profilesRes.data ?? [],
  }
}

async function writeAudit(
  entityId: string,
  action: string,
  actorName: string,
  before: Record<string, string | number | boolean | null>,
  after: Record<string, string | number | boolean | null>,
) {
  await supabase.from('audit_logs').insert({
    tenant_id: DEFAULT_TENANT_ID,
    entity_type: 'work_item',
    entity_id: entityId,
    action,
    actor_name: actorName,
    before,
    after,
  })
}

/** Moves a card to another column: updates board_column_id + status and audits it. */
export async function moveWorkItemToColumn(
  item: Pick<BoardItemRow, 'id' | 'status' | 'board_column_id'>,
  column: BoardColumnDef,
  actorName = 'Sistema',
): Promise<string> {
  const nextStatus = column.statuses.includes(item.status)
    ? item.status
    : (column.statuses[0] ?? column.category ?? item.status)

  const { error } = await supabase
    .from('work_items')
    .update({ board_column_id: column.id, status: nextStatus })
    .eq('id', item.id)
    .eq('tenant_id', DEFAULT_TENANT_ID)

  if (error) throw new Error(error.message)

  await writeAudit(
    item.id,
    'work_item.column_changed',
    actorName,
    { board_column_id: item.board_column_id, status: item.status },
    { board_column_id: column.id, status: nextStatus },
  )

  return nextStatus
}

/** Persists a new ordering inside a column. */
export async function reorderWorkItems(
  ordered: { id: string; position: number }[],
): Promise<void> {
  for (const row of ordered) {
    const { error } = await supabase
      .from('work_items')
      .update({ position: row.position })
      .eq('id', row.id)
      .eq('tenant_id', DEFAULT_TENANT_ID)
    if (error) throw new Error(error.message)
  }
}

export interface CreateWorkItemInput {
  projectId: string
  boardId: string
  column: BoardColumnDef
  sprintId?: string | null
  title: string
  type?: string
  priority?: 'critical' | 'high' | 'medium' | 'low'
  epicId?: string | null
  featureId?: string | null
  assigneeId?: string | null
  storyPoints?: number | null
  description?: string | null
}

/** Generates the next key for the project (e.g. WEB-118). */
async function nextItemKey(projectId: string): Promise<string> {
  const [projectRes, itemsRes] = await Promise.all([
    supabase.from('projects').select('key').eq('id', projectId).eq('tenant_id', DEFAULT_TENANT_ID).maybeSingle(),
    supabase.from('work_items').select('key').eq('project_id', projectId).eq('tenant_id', DEFAULT_TENANT_ID),
  ])
  const prefix = projectRes.data?.key ?? 'ITEM'
  let max = 100
  for (const row of itemsRes.data ?? []) {
    const n = parseInt(String(row.key).split('-').pop() ?? '', 10)
    if (!isNaN(n) && n > max) max = n
  }
  return `${prefix}-${max + 1}`
}

/** Inserts a real work_item on the given column/sprint and audits the creation. */
export async function createWorkItem(
  input: CreateWorkItemInput,
  actorName = 'Sistema',
): Promise<BoardItemRow> {
  const status = input.column.statuses[0] ?? input.column.category ?? 'todo'
  const key = await nextItemKey(input.projectId)

  const { data, error } = await supabase
    .from('work_items')
    .insert({
      tenant_id: DEFAULT_TENANT_ID,
      project_id: input.projectId,
      board_id: input.boardId,
      board_column_id: input.column.id,
      sprint_id: input.sprintId ?? null,
      epic_id: input.epicId ?? null,
      feature_id: input.featureId ?? null,
      assignee_id: input.assigneeId ?? null,
      key,
      type: input.type ?? 'story',
      title: input.title,
      description: input.description ?? null,
      status,
      priority: PRIORITY_TO_DB[input.priority ?? 'medium'] ?? 'media',
      story_points: input.storyPoints ?? null,
    })
    .select('id, key, title, description, type, status, priority, severity, project_id, board_id, board_column_id, sprint_id, epic_id, feature_id, assignee_id, reporter_id, story_points, position, is_blocked, blocked_reason, due_date')
    .single()

  if (error) throw new Error(error.message)

  await writeAudit(data.id, 'work_item.created', actorName, {}, { key: data.key, title: data.title, status: data.status })

  return data as BoardItemRow
}

// ─── Board CRUD ───────────────────────────────────────────────────────────────

export interface CreateBoardInput {
  name: string
  boardType: 'scrum' | 'kanban'
  filter?: BoardFilter
  /** Colunas personalizadas; quando ausente usa o template do boardType. */
  columns?: BoardColumnDef[]
}

/** Creates a new board for the project, cloning the base columns + statuses. */
export async function createBoard(
  projectId: string,
  input: CreateBoardInput,
  actorName = 'Sistema',
): Promise<BoardRow> {
  const tid = DEFAULT_TENANT_ID
  const boardType = input.boardType
  const filter = input.filter ?? {}

  const { data: board, error } = await supabase.from('boards').insert({
    tenant_id: tid,
    project_id: projectId,
    name: input.name,
    board_type: boardType,
    status: 'active',
    filter: filter as unknown as Tables['boards']['Insert']['filter'],
  }).select('id, project_id, name, board_type, status, filter').single()

  if (error || !board) throw fail('boards', error?.message ?? 'Falha ao criar o board.')

  // Clone base columns
  const defs = boardType === 'scrum' ? SCRUM_COLUMNS : KANBAN_COLUMNS
  const { data: columns, error: colErr } = await supabase.from('board_columns').insert(
    defs.map((c, i) => ({
      tenant_id: tid,
      board_id: board.id,
      name: c.name,
      category: c.category,
      position: i,
    })),
  ).select('id, position')

  if (colErr) throw fail('board_columns', colErr.message)

  // Clone board_column_statuses
  const statusRows = (columns ?? []).flatMap(col => {
    const def = defs[col.position]
    return (def?.statuses ?? []).map(status_key => ({
      tenant_id: tid,
      board_column_id: col.id,
      status_key,
    }))
  })
  if (statusRows.length > 0) {
    const { error: bcsErr } = await supabase.from('board_column_statuses').insert(statusRows)
    if (bcsErr) throw fail('board_column_statuses', bcsErr.message)
  }

  // Emit milestone
  await writeMilestone('board.created', board.id, {
    name: input.name,
    project_id: projectId,
    board_type: boardType,
  }, { actorName })

  return board as BoardRow
}

export interface UpdateBoardInput {
  name?: string
  filter?: BoardFilter
}

/** Updates board name and/or filter. */
export async function updateBoard(
  boardId: string,
  input: UpdateBoardInput,
  actorName = 'Sistema',
): Promise<void> {
  const payload: Tables['boards']['Update'] = {}
  if (input.name !== undefined) payload.name = input.name
  if (input.filter !== undefined) payload.filter = input.filter as unknown as Tables['boards']['Update']['filter']
  if (Object.keys(payload).length === 0) return

  const { error } = await supabase.from('boards')
    .update(payload)
    .eq('id', boardId)
    .eq('tenant_id', DEFAULT_TENANT_ID)
  if (error) throw fail('boards', error.message)

  await writeMilestone('board.updated', boardId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    has_filter: input.filter !== undefined,
  }, { actorName })
}

/**
 * Archives a board. Prevents archiving the default board (the one with the
 * earliest created_at for the project).
 */
export async function archiveBoard(
  boardId: string,
  actorName = 'Sistema',
): Promise<void> {
  const tid = DEFAULT_TENANT_ID

  // Load the target board
  const { data: target, error: targetErr } = await supabase.from('boards')
    .select('id, project_id, name, created_at')
    .eq('id', boardId)
    .eq('tenant_id', tid)
    .maybeSingle()
  if (targetErr) throw fail('boards', targetErr.message)
  if (!target) throw new Error('Board não encontrado.')

  // Find the oldest board of the same project (the default one)
  const { data: oldest, error: oldestErr } = await supabase.from('boards')
    .select('id')
    .eq('tenant_id', tid)
    .eq('project_id', target.project_id)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (oldestErr) throw fail('boards', oldestErr.message)

  if (oldest && oldest.id === boardId) {
    throw new Error('Não é possível arquivar o board padrão do projeto (o mais antigo).')
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('boards')
    .update({ archived_at: now, status: 'archived' })
    .eq('id', boardId)
    .eq('tenant_id', tid)
  if (error) throw fail('boards', error.message)

  await writeMilestone('board.archived', boardId, {
    name: target.name,
    project_id: target.project_id,
  }, { actorName })
}
