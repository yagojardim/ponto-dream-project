// Issue list data access layer — real work items from Supabase, filtered by tenant.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { DEFAULT_TENANT_ID } from './timeline'
import { epicColor, PRIORITY_FROM_DB, PRIORITY_TO_DB } from './board'
import { sortSprintsByStartDate } from './sprints'
import { STATUS_TO_DB, uiStatusFromDb } from './workItem'

export { DEFAULT_TENANT_ID, epicColor, PRIORITY_FROM_DB, PRIORITY_TO_DB, STATUS_TO_DB, uiStatusFromDb }

type Tables = Database['public']['Tables']

export type ListItemRow = Pick<
  Tables['work_items']['Row'],
  'id' | 'key' | 'title' | 'type' | 'status' | 'priority' | 'assignee_id' | 'story_points'
  | 'epic_id' | 'feature_id' | 'sprint_id' | 'project_id' | 'due_date' | 'is_blocked'
>
export type ListEpicRow = Pick<Tables['epics']['Row'], 'id' | 'project_id' | 'name' | 'color'>
export type ListFeatureRow = Pick<Tables['features']['Row'], 'id' | 'epic_id' | 'name'>
export type ListSprintRow = Pick<Tables['sprints']['Row'], 'id' | 'project_id' | 'name' | 'state'>
export type ListProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials' | 'avatar_color'>
export type ListProjectRow = Pick<Tables['projects']['Row'], 'id' | 'key' | 'name'>
export type ListLabelRow = { work_item_id: string; name: string }

export interface ListFilters {
  projectId?: string
  status?: string
  priority?: string
  type?: string
  assigneeId?: string
  sprintId?: string
  epicId?: string
  featureId?: string
  search?: string
}

export interface ListData {
  items: ListItemRow[]
  labels: ListLabelRow[]
  epics: ListEpicRow[]
  features: ListFeatureRow[]
  sprints: ListSprintRow[]
  profiles: ListProfileRow[]
  projects: ListProjectRow[]
}

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar a Lista.`
  }
  return message
}

const sel = (s: string): string => s

/** UI filter value → every value the database may actually store for it. */
const STATUS_MATCHES: Record<string, string[]> = {
  backlog: ['backlog'],
  todo: ['todo', 'to_do', 'a_fazer'],
  'in-progress': ['in_progress', 'in-progress', 'doing', 'em_andamento'],
  'in-review': ['in_review', 'in-review', 'review', 'em_revisao'],
  blocked: ['blocked', 'bloqueado'],
  done: ['done', 'concluido', 'concluído'],
}

const PRIORITY_MATCHES: Record<string, string[]> = {
  critical: ['critical', 'critica', 'crítica'],
  high: ['high', 'alta'],
  medium: ['medium', 'media', 'média'],
  low: ['low', 'baixa'],
}

const TYPE_MATCHES: Record<string, string[]> = {
  story: ['story', 'user_story', 'historia', 'história'],
  bug: ['bug', 'erro', 'defeito'],
  task: ['task', 'tarefa'],
  subtask: ['subtask', 'sub_task', 'subtarefa'],
  epic: ['epic', 'epico', 'épico'],
  feature: ['feature', 'funcionalidade'],
}

export async function listWorkItems(filters: ListFilters = {}): Promise<ListData> {
  const tid = DEFAULT_TENANT_ID

  let query = supabase
    .from('work_items')
    .select(sel('id, key, title, type, status, priority, assignee_id, story_points, epic_id, sprint_id, project_id, due_date, is_blocked'))
    .eq('tenant_id', tid)
    .is('archived_at', null)

  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  // Filters arrive in UI format; the DB may hold snake_case statuses, pt-BR priorities
  // and pt-BR/EN types. Matching against every known synonym keeps the filters honest.
  if (filters.status) query = query.in('status', STATUS_MATCHES[filters.status] ?? [filters.status])
  if (filters.priority) query = query.in('priority', PRIORITY_MATCHES[filters.priority] ?? [filters.priority])
  if (filters.type) query = query.in('type', TYPE_MATCHES[filters.type] ?? [filters.type])
  if (filters.assigneeId) query = query.eq('assignee_id', filters.assigneeId)
  if (filters.sprintId) query = query.eq('sprint_id', filters.sprintId)
  if (filters.epicId) query = query.eq('epic_id', filters.epicId)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)

  const itemsPromise = query.order('key').returns<ListItemRow[]>()

  const [items, labels, epics, sprints, profiles, projects] = await Promise.all([
    itemsPromise,
    supabase.from('work_item_labels').select('work_item_id, labels(name)').eq('tenant_id', tid),
    supabase.from('epics').select('id, project_id, name, color').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('sprints').select('id, project_id, name, state, start_date').eq('tenant_id', tid).is('archived_at', null)
      .order('start_date', { ascending: true, nullsFirst: false }),
    supabase.from('profiles').select('id, name, avatar_initials, avatar_color').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('projects').select('id, key, name').eq('tenant_id', tid).is('archived_at', null).order('name'),
  ])

  const failed = [
    ['work_items', items.error], ['work_item_labels', labels.error], ['epics', epics.error],
    ['sprints', sprints.error], ['profiles', profiles.error], ['projects', projects.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined
  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  const labelRows: ListLabelRow[] = (labels.data ?? []).flatMap(row => {
    const rel = (row as { work_item_id: string; labels: { name: string } | { name: string }[] | null }).labels
    if (!rel) return []
    const list = Array.isArray(rel) ? rel : [rel]
    return list.map(l => ({ work_item_id: row.work_item_id, name: l.name }))
  })

  return {
    items: items.data ?? [],
    labels: labelRows,
    epics: epics.data ?? [],
    sprints: ((sprints.data ?? []) as ListSprintRow[]).slice().sort(sortSprintsByStartDate),
    profiles: profiles.data ?? [],
    projects: projects.data ?? [],
  }
}
