// Work item detail data access layer — reads and persists the real Supabase rows.
// Same pattern as ./board.ts and ./timeline.ts: every read/write is scoped by tenant_id.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { DEFAULT_TENANT_ID, PRIORITY_FROM_DB, PRIORITY_TO_DB, epicColor } from './board'
import { sortSprintsByStartDate } from './sprints'
import { safeCall } from '../../utils/logger'

export { DEFAULT_TENANT_ID, PRIORITY_FROM_DB, PRIORITY_TO_DB }

type Tables = Database['public']['Tables']

export type WorkItemRow = Tables['work_items']['Row']
export type ProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials'>
export type EpicRow = Pick<Tables['epics']['Row'], 'id' | 'project_id' | 'key' | 'name' | 'color'>
export type SprintRow = Pick<Tables['sprints']['Row'], 'id' | 'name' | 'state' | 'start_date'>
export type CommentRow = Pick<
  Tables['comments']['Row'],
  'id' | 'work_item_id' | 'author_id' | 'author_kind' | 'body' | 'visibility' | 'created_at'
>
export type AcceptanceRow = Pick<
  Tables['acceptance_criteria']['Row'],
  'id' | 'work_item_id' | 'text' | 'is_done' | 'position'
>
export type HistoryRow = Pick<
  Tables['item_status_history']['Row'],
  'id' | 'field' | 'from_value' | 'to_value' | 'actor_id' | 'created_at'
>
export type DependencyRow = Pick<
  Tables['dependencies']['Row'],
  'id' | 'source_id' | 'target_id' | 'relation_type'
>
export type RelatedItemRow = Pick<
  Tables['work_items']['Row'],
  'id' | 'key' | 'title' | 'type' | 'status' | 'priority' | 'assignee_id'
>

/** Everything the detail panel needs for a single work item. */
export interface WorkItemDetailData {
  item: WorkItemRow
  epic: EpicRow | null
  sprint: SprintRow | null
  assignee: ProfileRow | null
  reporter: ProfileRow | null
  labels: string[]
  comments: CommentRow[]
  acceptance: AcceptanceRow[]
  history: HistoryRow[]
  dependencies: { relation: DependencyRow; item: RelatedItemRow; direction: 'outgoing' | 'incoming' }[]
  subtasks: RelatedItemRow[]
  /** Catalogues for the editors. */
  profiles: ProfileRow[]
  epics: EpicRow[]
  sprints: SprintRow[]
  availableLabels: string[]
  availableVersions: string[]
}

/** DB status keys ↔ the UI status enum used across board/list/detail. */
export const STATUS_FROM_DB: Record<string, string> = {
  backlog: 'backlog', todo: 'todo', to_do: 'todo',
  in_progress: 'in-progress', doing: 'in-progress',
  in_review: 'in-review', review: 'in-review',
  done: 'done', concluido: 'done',
}
export const STATUS_TO_DB: Record<string, string> = {
  backlog: 'backlog', todo: 'todo',
  'in-progress': 'in_progress', 'in-review': 'in_review', done: 'done',
}

export function uiStatusFromDb(status: string): string {
  return STATUS_FROM_DB[(status ?? '').toLowerCase()] ?? status
}

export { epicColor }

const RELATED_COLS = 'id, key, title, type, status, priority, assignee_id'

function fail(table: string, message: string): Error {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return new Error(`A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico.`)
  }
  return new Error(message)
}

/** Loads a work item with every relation the detail panel renders. */
export async function getWorkItem(id: string): Promise<WorkItemDetailData> {
  const tid = DEFAULT_TENANT_ID

  const itemRes = await supabase
    .from('work_items').select('*').eq('id', id).eq('tenant_id', tid).maybeSingle()
  if (itemRes.error) throw fail('work_items', itemRes.error.message)
  if (!itemRes.data) throw new Error('Item não encontrado.')
  const item = itemRes.data as WorkItemRow

  const [
    profilesRes, epicsRes, sprintsRes, labelsRes, itemLabelsRes,
    commentsRes, acRes, historyRes, depsRes, subtasksRes, releasesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_initials').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('epics').select('id, project_id, key, name, color')
      .eq('tenant_id', tid).eq('project_id', item.project_id).is('archived_at', null),
    supabase.from('sprints').select('id, name, state, start_date')
      .eq('tenant_id', tid).eq('project_id', item.project_id).is('archived_at', null)
      .order('start_date', { ascending: true, nullsFirst: false }),
    supabase.from('labels').select('id, name').eq('tenant_id', tid),
    supabase.from('work_item_labels').select('label_id').eq('tenant_id', tid).eq('work_item_id', id),
    supabase.from('comments')
      .select('id, work_item_id, author_id, author_kind, body, visibility, created_at')
      .eq('tenant_id', tid).eq('work_item_id', id).is('archived_at', null).order('created_at'),
    supabase.from('acceptance_criteria').select('id, work_item_id, text, is_done, position')
      .eq('tenant_id', tid).eq('work_item_id', id).order('position'),
    supabase.from('item_status_history').select('id, field, from_value, to_value, actor_id, created_at')
      .eq('tenant_id', tid).eq('work_item_id', id).order('created_at', { ascending: false }),
    supabase.from('dependencies').select('id, source_id, target_id, relation_type')
      .eq('tenant_id', tid).or(`source_id.eq.${id},target_id.eq.${id}`),
    supabase.from('work_items').select(RELATED_COLS)
      .eq('tenant_id', tid).eq('parent_id', id).is('archived_at', null).order('position'),
    supabase.from('releases').select('version').eq('tenant_id', tid).eq('project_id', item.project_id),
  ])

  const failed = ([
    ['profiles', profilesRes.error], ['epics', epicsRes.error], ['sprints', sprintsRes.error],
    ['labels', labelsRes.error], ['work_item_labels', itemLabelsRes.error],
    ['comments', commentsRes.error], ['acceptance_criteria', acRes.error],
    ['item_status_history', historyRes.error], ['dependencies', depsRes.error],
    ['work_items', subtasksRes.error], ['releases', releasesRes.error],
  ] as [string, { message: string } | null][]).find(([, err]) => err)
  if (failed) throw fail(failed[0], failed[1]!.message)

  const labelById = new Map((labelsRes.data ?? []).map(l => [l.id, l.name]))
  const labels = (itemLabelsRes.data ?? [])
    .map(r => labelById.get(r.label_id))
    .filter((n): n is string => !!n)

  // Resolve the counterpart of each dependency edge.
  const deps = depsRes.data ?? []
  const otherIds = deps.map(d => (d.source_id === id ? d.target_id : d.source_id))
  let relatedRows: RelatedItemRow[] = []
  if (otherIds.length) {
    const relRes = await supabase.from('work_items').select(RELATED_COLS).eq('tenant_id', tid).in('id', otherIds)
    if (relRes.error) throw fail('work_items', relRes.error.message)
    relatedRows = (relRes.data ?? []) as RelatedItemRow[]
  }
  const relatedById = new Map(relatedRows.map(r => [r.id, r]))

  const profiles = (profilesRes.data ?? []) as ProfileRow[]
  const profileById = new Map(profiles.map(p => [p.id, p]))
  const epics = (epicsRes.data ?? []) as EpicRow[]

  const sprints = ((sprintsRes.data ?? []) as SprintRow[]).slice().sort(sortSprintsByStartDate)

  return {
    item,
    epic: (item.epic_id ? epics.find(e => e.id === item.epic_id) : null) ?? null,
    sprint: (item.sprint_id ? sprints.find(s => s.id === item.sprint_id) : null) ?? null,
    assignee: (item.assignee_id ? profileById.get(item.assignee_id) : null) ?? null,
    reporter: (item.reporter_id ? profileById.get(item.reporter_id) : null) ?? null,
    labels,
    comments: (commentsRes.data ?? []) as CommentRow[],
    acceptance: (acRes.data ?? []) as AcceptanceRow[],
    history: (historyRes.data ?? []) as HistoryRow[],
    dependencies: deps
      .map(d => {
        const other = relatedById.get(d.source_id === id ? d.target_id : d.source_id)
        return other
          ? { relation: d as DependencyRow, item: other, direction: (d.source_id === id ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming' }
          : null
      })
      .filter((v): v is NonNullable<typeof v> => !!v),
    subtasks: (subtasksRes.data ?? []) as RelatedItemRow[],
    profiles,
    epics,
    sprints,
    availableLabels: (labelsRes.data ?? []).map(l => l.name),
    availableVersions: (releasesRes.data ?? []).map(r => r.version),
  }
}

type AuditValue = string | number | boolean | null
type AuditPayload = Record<string, AuditValue>

async function writeAudit(
  entityId: string, action: string, actorName: string,
  before: AuditPayload, after: AuditPayload,
  actorId?: string | null,
) {
  await supabase.from('audit_logs').insert({
    tenant_id: DEFAULT_TENANT_ID,
    entity_type: 'work_item',
    entity_id: entityId,
    action,
    actor_id: actorId ?? null,
    actor_name: actorName,
    before,
    after,
  })
}

/** Columns the detail panel is allowed to edit. */
export type EditableField =
  | 'title' | 'description' | 'status' | 'priority' | 'severity'
  | 'assignee_id' | 'reporter_id' | 'story_points' | 'due_date'
  | 'sprint_id' | 'epic_id' | 'fix_version'

export interface FieldUpdateContext {
  actorName?: string
  actorId?: string | null
  /** Human readable values used in the audit trail / history. */
  fromLabel?: string
  toLabel?: string
}

/**
 * Persists a single field of a work item, always audited.
 * A status change also writes an item_status_history row (from → to, actor, timestamp).
 */
export async function updateWorkItemField(
  itemId: string,
  field: EditableField,
  value: AuditValue,
  previous: AuditValue,
  ctx: FieldUpdateContext = {},
): Promise<void> {
  const tid = DEFAULT_TENANT_ID
  const actorName = ctx.actorName ?? 'Sistema'

  // `fix_version` is not a column: it maps to release_id via the release version.
  let column: string = field
  let dbValue: AuditValue = value
  // UI enums → DB enums. Keys are the UI values, so already-DB values pass through.
  if (field === 'priority' && value != null) dbValue = PRIORITY_TO_DB[String(value)] ?? value
  if (field === 'status' && value != null) dbValue = STATUS_TO_DB[String(value)] ?? value
  if (field === 'fix_version') {
    column = 'release_id'
    if (value == null || value === '') dbValue = null
    else {
      const relRes = await supabase.from('releases').select('id')
        .eq('tenant_id', tid).eq('version', String(value)).maybeSingle()
      if (relRes.error) throw fail('releases', relRes.error.message)
      dbValue = relRes.data?.id ?? null
    }
  }

  const { error } = await supabase
    .from('work_items')
    .update({ [column]: dbValue } as Tables['work_items']['Update'])
    .eq('id', itemId)
    .eq('tenant_id', tid)
  if (error) throw fail('work_items', error.message)

  let dbPrevious: AuditValue = previous
  if (field === 'priority' && previous != null) dbPrevious = PRIORITY_TO_DB[String(previous)] ?? previous
  if (field === 'status' && previous != null) dbPrevious = STATUS_TO_DB[String(previous)] ?? previous

  await writeAudit(
    itemId, `work_item.${field}_updated`, actorName,
    { [column]: dbPrevious }, { [column]: dbValue }, ctx.actorId,
  )

  if (field === 'status') {
    const { error: histErr } = await supabase.from('item_status_history').insert({
      tenant_id: tid,
      work_item_id: itemId,
      field: 'status',
      from_value: dbPrevious == null ? null : String(dbPrevious),
      to_value: dbValue == null ? null : String(dbValue),
      actor_id: ctx.actorId ?? null,
    })
    if (histErr) throw fail('item_status_history', histErr.message)
  }
}

/** Inserts a comment in the item thread. */
export async function addComment(
  itemId: string,
  body: string,
  opts: { authorId?: string | null; authorKind?: string; visibility?: string; actorName?: string } = {},
): Promise<CommentRow> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      tenant_id: DEFAULT_TENANT_ID,
      work_item_id: itemId,
      author_id: opts.authorId ?? null,
      author_kind: opts.authorKind ?? 'internal',
      body,
      visibility: opts.visibility ?? 'internal',
    })
    .select('id, work_item_id, author_id, author_kind, body, visibility, created_at')
    .single()
  if (error) throw fail('comments', error.message)

  await writeAudit(itemId, 'work_item.comment_added', opts.actorName ?? 'Sistema', {}, { body }, opts.authorId)
  return data as CommentRow
}

/** Flips an acceptance criterion. */
export async function toggleAcceptanceCriterion(
  criterionId: string, isDone: boolean, itemId: string, actorName = 'Sistema',
): Promise<void> {
  const { error } = await supabase
    .from('acceptance_criteria')
    .update({ is_done: isDone })
    .eq('id', criterionId)
    .eq('tenant_id', DEFAULT_TENANT_ID)
  if (error) throw fail('acceptance_criteria', error.message)
  await writeAudit(itemId, 'work_item.acceptance_toggled', actorName, { is_done: !isDone }, { is_done: isDone })
}

/** Adds an acceptance criterion at the end of the list. */
export async function addAcceptanceCriterion(
  itemId: string, text: string, position: number, actorName = 'Sistema',
): Promise<AcceptanceRow> {
  const { data, error } = await supabase
    .from('acceptance_criteria')
    .insert({ tenant_id: DEFAULT_TENANT_ID, work_item_id: itemId, text, position, is_done: false })
    .select('id, work_item_id, text, is_done, position')
    .single()
  if (error) throw fail('acceptance_criteria', error.message)
  await writeAudit(itemId, 'work_item.acceptance_added', actorName, {}, { text })
  return data as AcceptanceRow
}

export async function removeAcceptanceCriterion(
  criterionId: string, itemId: string, actorName = 'Sistema',
): Promise<void> {
  const { error } = await supabase
    .from('acceptance_criteria').delete().eq('id', criterionId).eq('tenant_id', DEFAULT_TENANT_ID)
  if (error) throw fail('acceptance_criteria', error.message)
  await writeAudit(itemId, 'work_item.acceptance_removed', actorName, { id: criterionId }, {})
}

/** Links two work items. `targetKey` accepts the human key (WEB-101) or an id. */
export async function addDependency(
  sourceId: string, targetKeyOrId: string, relationType: string, actorName = 'Sistema',
): Promise<{ relation: DependencyRow; item: RelatedItemRow }> {
  const tid = DEFAULT_TENANT_ID
  const targetRes = await supabase.from('work_items').select(RELATED_COLS)
    .eq('tenant_id', tid).or(`id.eq.${targetKeyOrId},key.eq.${targetKeyOrId}`).maybeSingle()
  if (targetRes.error) throw fail('work_items', targetRes.error.message)
  const target = targetRes.data as RelatedItemRow | null
  if (!target) throw new Error(`Issue "${targetKeyOrId}" não encontrada.`)

  const { data, error } = await supabase
    .from('dependencies')
    .insert({ tenant_id: tid, source_id: sourceId, target_id: target.id, relation_type: relationType })
    .select('id, source_id, target_id, relation_type')
    .single()
  if (error) throw fail('dependencies', error.message)

  await writeAudit(sourceId, 'work_item.dependency_added', actorName, {}, { target: target.key, relation_type: relationType })
  return { relation: data as DependencyRow, item: target }
}

/** Creates a child work item (parent_id = itemId) reusing the parent's project/board/sprint. */
export async function addSubtask(
  parent: Pick<WorkItemRow, 'id' | 'project_id' | 'board_id' | 'board_column_id' | 'sprint_id' | 'epic_id' | 'status'>,
  title: string,
  actorName = 'Sistema',
  opts?: { assigneeId?: string | null; storyPoints?: number | null; description?: string | null; priority?: 'critical'|'high'|'medium'|'low' },
): Promise<RelatedItemRow> {
  const tid = DEFAULT_TENANT_ID

  const [projectRes, itemsRes] = await Promise.all([
    supabase.from('projects').select('key').eq('id', parent.project_id).eq('tenant_id', tid).maybeSingle(),
    supabase.from('work_items').select('key').eq('project_id', parent.project_id).eq('tenant_id', tid),
  ])
  const prefix = projectRes.data?.key ?? 'ITEM'
  let max = 100
  for (const row of itemsRes.data ?? []) {
    const n = parseInt(String(row.key).split('-').pop() ?? '', 10)
    if (!isNaN(n) && n > max) max = n
  }

  const { data, error } = await supabase
    .from('work_items')
    .insert({
      tenant_id: tid,
      project_id: parent.project_id,
      board_id: parent.board_id,
      board_column_id: parent.board_column_id,
      sprint_id: parent.sprint_id,
      epic_id: parent.epic_id,
      parent_id: parent.id,
      key: `${prefix}-${max + 1}`,
      type: 'subtask',
      title,
      status: 'todo',
      priority: PRIORITY_TO_DB[opts?.priority ?? 'medium'] ?? 'media',
      description: opts?.description ?? null,
      assignee_id: opts?.assigneeId ?? null,
      story_points: opts?.storyPoints ?? null,
    })
    .select(RELATED_COLS)
    .single()
  if (error) throw fail('work_items', error.message)

  await writeAudit(parent.id, 'work_item.subtask_added', actorName, {}, { key: (data as RelatedItemRow).key, title })
  return data as RelatedItemRow
}

/** Replaces the label set of a work item, creating labels that do not exist yet. */
export async function setWorkItemLabels(
  itemId: string, names: string[], actorName = 'Sistema',
): Promise<void> {
  const tid = DEFAULT_TENANT_ID
  const wanted = names.map(n => n.trim()).filter(Boolean)

  const existingRes = await supabase.from('labels').select('id, name').eq('tenant_id', tid)
  if (existingRes.error) throw fail('labels', existingRes.error.message)
  const byName = new Map((existingRes.data ?? []).map(l => [l.name.toLowerCase(), l.id]))

  const missing = wanted.filter(n => !byName.has(n.toLowerCase()))
  if (missing.length) {
    const insRes = await supabase.from('labels')
      .insert(missing.map(name => ({ tenant_id: tid, name })))
      .select('id, name')
    if (insRes.error) throw fail('labels', insRes.error.message)
    for (const l of insRes.data ?? []) byName.set(l.name.toLowerCase(), l.id)
  }

  const del = await supabase.from('work_item_labels').delete().eq('tenant_id', tid).eq('work_item_id', itemId)
  if (del.error) throw fail('work_item_labels', del.error.message)

  if (wanted.length) {
    const ins = await supabase.from('work_item_labels').insert(
      wanted.map(n => ({ tenant_id: tid, work_item_id: itemId, label_id: byName.get(n.toLowerCase())! })),
    )
    if (ins.error) throw fail('work_item_labels', ins.error.message)
  }

  await writeAudit(itemId, 'work_item.labels_updated', actorName, {}, { labels: wanted.join(', ') })
}

// ─── Histórico unificado (read-only / observabilidade) ────────────────────────
export interface UnifiedHistoryEntry {
  id: string
  createdAt: string
  actorName: string
  /** 'field' → alteração de campo; 'action' → evento de auditoria. */
  kind: 'field' | 'action'
  field?: string
  fromValue?: string | null
  toValue?: string | null
  action?: string
  detail?: string
  /** Resumo legível pronto para exibição. */
  summary?: string
  /** true quando o evento veio do épico e não do item. */
  fromEpic?: boolean
  /** Preenchido em eventos de anexo — permite baixar o arquivo pelo histórico. */
  attachmentName?: string
  attachmentPath?: string
}

const PT_FIELD: Record<string, string> = {
  status: 'status', title: 'título', description: 'descrição', priority: 'prioridade',
  severity: 'severidade', assignee_id: 'responsável', reporter_id: 'relator',
  story_points: 'estimativa', due_date: 'prazo', start_date: 'data de início',
  sprint_id: 'sprint', epic_id: 'épico', fix_version: 'versão',
  column: 'coluna', column_id: 'coluna', column_changed: 'coluna', status_changed: 'coluna',
  labels: 'labels', type: 'tipo', parent_id: 'item pai', order_index: 'ordem',
  estimate: 'estimativa', time_spent: 'tempo gasto', archived_at: 'arquivamento',
}

/** Rótulos PT para chaves de status/coluna do board. */
const PT_STATUS: Record<string, string> = {
  backlog: 'Backlog', todo: 'A Fazer', to_do: 'A Fazer', ready: 'Pronto',
  in_progress: 'Em Andamento', 'in-progress': 'Em Andamento', doing: 'Em Andamento',
  in_review: 'Em Revisão', 'in-review': 'Em Revisão', review: 'Em Revisão',
  testing: 'Em Teste', qa: 'Em Teste', blocked: 'Bloqueado',
  done: 'Concluído', completed: 'Concluído', cancelled: 'Cancelado', canceled: 'Cancelado',
}

/** Rótulos PT para prioridades e tipos. */
const PT_VALUE: Record<string, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa',
  story: 'História', bug: 'Bug', task: 'Tarefa', subtask: 'Subtarefa',
  epic: 'Épico', feature: 'Funcionalidade',
  true: 'Sim', false: 'Não', null: '—',
}

/** Traduz um valor cru (status, coluna, prioridade, tipo) para PT quando conhecido. */
function ptValue(field: string | undefined, value: string | null | undefined): string {
  const v = (value ?? '').trim()
  if (!v) return '—'
  const k = v.toLowerCase()
  const isStatusField = !field || /^(status|column|column_id|column_changed|status_changed)$/.test(field)
  if (isStatusField && PT_STATUS[k]) return PT_STATUS[k]
  return PT_STATUS[k] ?? PT_VALUE[k] ?? v
}

function pick(v: unknown, ...keys: string[]): string | undefined {
  if (v == null) return undefined
  if (typeof v !== 'object') return String(v)
  const obj = v as Record<string, unknown>
  for (const k of keys) {
    const val = obj[k]
    if (val != null && val !== '') return String(val)
  }
  const first = Object.values(obj).find(x => x != null && x !== '')
  return first == null ? undefined : String(first)
}

/** Resumo legível de um evento de auditoria a partir de action + before/after. */
function auditSummary(action: string, before: unknown, after: unknown): string {
  const rawA = pick(after)
  const rawB = pick(before)
  const a = rawA == null ? undefined : ptValue(undefined, rawA)
  const b = rawB == null ? undefined : ptValue(undefined, rawB)
  switch (action) {
    case 'work_item.created': return 'Criou a demanda'
    case 'work_item.priority_updated': return `Alterou a prioridade de ${b ?? '—'} para ${a ?? '—'}`
    case 'work_item.status_updated': return `Moveu de ${b ?? '—'} para ${a ?? '—'}`
    case 'work_item.moved': return `Moveu de ${b ?? '—'} para ${a ?? '—'}`
    case 'work_item.epic_id_updated':
    case 'work_item.epic_linked': return a ? `Alterou o épico para ${a}` : 'Alterou o épico'
    case 'work_item.due_date_updated': return `Alterou a data (Gantt) para ${a ?? '—'}`
    case 'work_item.start_date_updated': return `Alterou a data de início (Gantt) para ${a ?? '—'}`
    case 'work_item.dependency_added': return `Vinculou dependência ${pick(after, 'target', 'key', 'target_key') ?? ''}`.trim()
    case 'work_item.subtask_added': return `Adicionou subtarefa ${pick(after, 'key', 'title') ?? ''}`.trim()
    case 'work_item.assignee_id':
    case 'work_item.assignee_updated': return `Alterou o responsável para ${a ?? '—'}`
    case 'work_item.title_updated': return `Alterou o título para “${rawA ?? '—'}”`
    case 'work_item.description_updated': return 'Atualizou a descrição'
    case 'work_item.labels_updated': return `Atualizou as labels${a ? `: ${a}` : ''}`
    case 'work_item.comment_added': {
      const body = pick(after, 'body', 'text', 'comment')
      if (!body) return 'Comentou na demanda'
      const t = body.length > 140 ? `${body.slice(0, 140)}…` : body
      return `Comentou: “${t}”`
    }
    case 'attachment_added': return `Anexou o arquivo ${pick(after, 'name') ?? ''}`.trim()
    case 'attachment_deleted': return `Removeu o anexo ${pick(before, 'name') ?? ''}`.trim()
    default: {
      const m = /^(?:work_item|epic)\.(.+?)(?:_updated)?$/.exec(action)
      const fieldKey = m?.[1] ?? action
      const label = PT_FIELD[fieldKey] ?? PT_FIELD[fieldKey.replace(/_changed$/, '')] ?? fieldKey.replace(/_/g, ' ')
      const fa = rawA == null ? undefined : ptValue(fieldKey, rawA)
      const fb = rawB == null ? undefined : ptValue(fieldKey, rawB)
      if (fb && fa) return `Alterou a ${label} de ${fb} para ${fa}`
      if (fa) return `Alterou a ${label} para ${fa}`
      return `Atualizou a ${label}`
    }
  }
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  'work_item.created': 'criou o item',
  'work_item.subtask_added': 'adicionou uma subtarefa',
  'work_item.dependency_added': 'vinculou uma issue',
  'work_item.labels_updated': 'atualizou as labels',
  'work_item.comment_added': 'comentou',
  'work_item.moved': 'moveu de coluna',
  'work_item.status': 'mudou o status',
  'work_item.assignee_id': 'mudou o responsável',
  'work_item.assignee_updated': 'mudou o responsável',
  'work_item.status_updated': 'mudou o status',
  'work_item.priority_updated': 'mudou a prioridade',
  'work_item.title_updated': 'alterou o título',
  'work_item.description_updated': 'atualizou a descrição',
  'work_item.epic_linked': 'vinculou um épico',
  'work_item.epic_id_updated': 'alterou o épico',
  'work_item.due_date_updated': 'alterou o prazo',
  'work_item.start_date_updated': 'alterou a data de início',
  'work_item.column_changed': 'moveu de coluna',
  'work_item.updated': 'atualizou a demanda',
  'work_item.deleted': 'removeu a demanda',
  'attachment_added': 'anexou um arquivo',
  'attachment_deleted': 'removeu um anexo',
}

function auditDetail(before: unknown, after: unknown): string | undefined {
  const fmt = (v: unknown) => {
    if (v == null) return ''
    if (typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>).filter(([, val]) => val != null && val !== '')
      if (!entries.length) return ''
      return entries.map(([k, val]) => `${k}: ${String(val)}`).join(', ')
    }
    return String(v)
  }
  const b = fmt(before); const a = fmt(after)
  if (b && a) return `${b} → ${a}`
  return a || b || undefined
}

/**
 * Toda a movimentação da história (e opcionalmente do épico), mesclada por data desc.
 * Degrada para [] em qualquer falha de leitura.
 */
export async function listItemHistory(workItemId: string, epicId?: string | null): Promise<UnifiedHistoryEntry[]> {
  return safeCall('workItem.listItemHistory', async () => {
    const tid = DEFAULT_TENANT_ID
    const [statusRes, itemAuditRes, epicAuditRes, profilesRes, sprintsRes, epicsRes] = await Promise.all([
      supabase.from('item_status_history')
        .select('id, field, from_value, to_value, actor_id, created_at')
        .eq('tenant_id', tid).eq('work_item_id', workItemId)
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('audit_logs')
        .select('id, action, actor_id, actor_name, before, after, created_at')
        .eq('tenant_id', tid).eq('entity_type', 'work_item').eq('entity_id', workItemId)
        .order('created_at', { ascending: false }).limit(200),
      epicId
        ? supabase.from('audit_logs')
            .select('id, action, actor_id, actor_name, before, after, created_at')
            .eq('tenant_id', tid).eq('entity_type', 'epic').eq('entity_id', epicId)
            .order('created_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null } as never),
      supabase.from('profiles').select('id, name').eq('tenant_id', tid),
      supabase.from('sprints').select('id, name').eq('tenant_id', tid),
      supabase.from('epics').select('id, name').eq('tenant_id', tid),
    ])

    const nameById = new Map<string, string>()
    for (const p of (profilesRes.data ?? []) as { id: string; name: string }[]) nameById.set(p.id, p.name)
    const sprintById = new Map<string, string>()
    for (const s of (sprintsRes.data ?? []) as { id: string; name: string }[]) sprintById.set(s.id, s.name)
    const epicById = new Map<string, string>()
    for (const e of (epicsRes.data ?? []) as { id: string; name: string }[]) epicById.set(e.id, e.name)

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    /** Resolve o valor cru de um campo para texto legível. */
    const readable = (field: string, value: string | null | undefined): string => {
      const v = (value ?? '').trim()
      if (field === 'assignee_id' || field === 'reporter_id') {
        if (!v) return 'Ninguém'
        return nameById.get(v) ?? (UUID_RE.test(v) ? 'Desconhecido' : v)
      }
      if (!v) return '—'
      if (/^(status|column|column_id|column_changed|status_changed|priority|type|severity)$/.test(field)) {
        return ptValue(field, v)
      }
      if (field === 'sprint_id') return sprintById.get(v) ?? (UUID_RE.test(v) ? 'Sprint removida' : v)
      if (field === 'epic_id') return epicById.get(v) ?? (UUID_RE.test(v) ? 'Épico removido' : v)
      if (UUID_RE.test(v)) return nameById.get(v) ?? sprintById.get(v) ?? epicById.get(v) ?? v
      return v
    }

    const out: UnifiedHistoryEntry[] = []

    for (const h of (statusRes.data ?? []) as HistoryRow[]) {
      const from = readable(h.field, h.from_value)
      const to = readable(h.field, h.to_value)
      out.push({
        id: `sh-${h.id}`,
        createdAt: h.created_at,
        actorName: (h.actor_id && nameById.get(h.actor_id)) || 'Sistema',
        kind: 'field',
        field: h.field,
        fromValue: from,
        toValue: to,
        summary: /^(status|column|column_id|column_changed|status_changed)$/.test(h.field)
          ? `Moveu de ${from} para ${to}`
          : `Alterou o ${PT_FIELD[h.field] ?? PT_FIELD[h.field.replace(/_changed$/, '')] ?? h.field.replace(/_/g, ' ')} de ${from} para ${to}`,
      })
    }

    /** Troca UUIDs soltos em textos de auditoria por nomes conhecidos. */
    const deUuid = <T extends string | undefined>(text: T): T => (
      typeof text === 'string'
        ? (text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            m => nameById.get(m) ?? sprintById.get(m) ?? epicById.get(m) ?? m) as T)
        : text
    )


    const pushAudit = (rows: unknown[], fromEpic: boolean) => {
      for (const raw of rows as {
        id: string; action: string; actor_id: string | null; actor_name: string | null
        before: unknown; after: unknown; created_at: string
      }[]) {
        const att = raw.action === 'attachment_added'
          ? (raw.after as Record<string, unknown> | null)
          : raw.action === 'attachment_deleted'
            ? (raw.before as Record<string, unknown> | null)
            : null
        out.push({
          id: `au-${raw.id}`,
          createdAt: raw.created_at,
          actorName: raw.actor_name || (raw.actor_id && nameById.get(raw.actor_id)) || 'Sistema',
          kind: 'action',
          action: AUDIT_ACTION_LABEL[raw.action] ?? (() => {
            const m = /^(?:work_item|epic)\.(.+?)(?:_updated)?$/.exec(raw.action)
            const key = m?.[1] ?? raw.action
            const label = PT_FIELD[key] ?? PT_FIELD[key.replace(/_changed$/, '')]
            return label ? `alterou a ${label}` : key.replace(/_/g, ' ')
          })(),
          detail: deUuid(auditDetail(raw.before, raw.after)),
          summary: deUuid(auditSummary(raw.action, raw.before, raw.after)),
          attachmentName: typeof att?.name === 'string' ? att.name : undefined,
          attachmentPath: raw.action === 'attachment_added' && typeof att?.storage_path === 'string'
            ? att.storage_path : undefined,
          fromEpic,
        })
      }
    }
    pushAudit(itemAuditRes.data ?? [], false)
    pushAudit(epicAuditRes?.data ?? [], true)

    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    return out
  }, [])
}
