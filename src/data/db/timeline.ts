// Timeline data access layer — reads real data from the connected Supabase project.
// Never cross-tenant: every read is filtered by tenant_id and every write records it.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { T } from '../../components/ds/tokens'
import { sortSprintsByStartDate } from './sprints'

/** Single tenant of the prototype. With Auth Final Lock this comes from the session. */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

type Tables = Database['public']['Tables']
export type ProjectRow = Pick<Tables['projects']['Row'], 'id' | 'name' | 'period_start' | 'period_end' | 'status' | 'metadata'> & { created_at?: string | null }
export type EpicRow = Pick<Tables['epics']['Row'], 'id' | 'project_id' | 'name' | 'color'>
export type SprintRow = Pick<Tables['sprints']['Row'], 'id' | 'project_id' | 'name' | 'start_date' | 'end_date' | 'state'>
export type WorkItemRow = Pick<
  Tables['work_items']['Row'],
  'id' | 'key' | 'title' | 'type' | 'status' | 'project_id' | 'epic_id' | 'feature_id' | 'sprint_id' | 'start_date' | 'due_date' | 'assignee_id' | 'is_blocked'
>
export type TimelineFeatureRow = Pick<Tables['features']['Row'], 'id' | 'epic_id' | 'name'>
export type DependencyRow = Pick<Tables['dependencies']['Row'], 'source_id' | 'target_id' | 'relation_type'>
export type ProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials' | 'avatar_color'>

export interface TimelineData {
  projects: ProjectRow[]
  epics: EpicRow[]
  sprints: SprintRow[]
  workItems: WorkItemRow[]
  features: TimelineFeatureRow[]
  dependencies: DependencyRow[]
  profiles: ProfileRow[]
}

/** Palette used to give each project a stable colour (projects have no colour column). */
const PROJECT_PALETTE = [T.accent, T.success, T.purple, T.warn, T.indigo, T.crit]

export function projectColor(project: ProjectRow, index: number): string {
  const meta = project.metadata as Record<string, unknown> | null
  const c = meta && typeof meta.color === 'string' ? meta.color : null
  return c && c.startsWith('#') ? c : PROJECT_PALETTE[index % PROJECT_PALETTE.length]
}

/** Epic colours are stored as semantic keys ('purple', 'warning', 'inprogress', …). */
const EPIC_COLOR_MAP: Record<string, string> = {
  purple: T.purple, warning: T.warn, warn: T.warn, inprogress: T.accent,
  accent: T.accent, blue: T.accent, success: T.success, done: T.success,
  critical: T.crit, crit: T.crit, danger: T.crit, indigo: T.indigo, neutral: T.text3,
}

export function epicColor(color: string | null): string {
  if (!color) return T.text3
  if (color.startsWith('#')) return color
  return EPIC_COLOR_MAP[color.toLowerCase()] ?? T.accent
}

/** Canonical status colours for bars (DB statuses use snake_case). */
export const DB_STATUS_CFG: Record<string, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: T.text3 },
  todo: { label: 'A Fazer', color: T.text2 },
  in_progress: { label: 'Em andamento', color: T.accent },
  in_review: { label: 'Em revisão', color: T.warn },
  blocked: { label: 'Bloqueado', color: T.crit },
  done: { label: 'Concluído', color: T.success },
}

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar a Timeline.`
  }
  return message
}

export async function fetchTimelineData(): Promise<TimelineData> {
  const tid = DEFAULT_TENANT_ID

  const [projects, epics, sprints, workItems, features, dependencies, profiles] = await Promise.all([
    supabase.from('projects').select('id, name, period_start, period_end, status, metadata, created_at')
      .eq('tenant_id', tid).is('archived_at', null).order('name'),
    supabase.from('epics').select('id, project_id, name, color')
      .eq('tenant_id', tid).is('archived_at', null).order('name'),
    supabase.from('sprints').select('id, project_id, name, start_date, end_date, state')
      .eq('tenant_id', tid).is('archived_at', null).order('start_date', { ascending: true, nullsFirst: false }),
    supabase.from('work_items').select('id, key, title, type, status, project_id, epic_id, feature_id, sprint_id, start_date, due_date, assignee_id, is_blocked')
      .eq('tenant_id', tid).is('archived_at', null).order('key'),
    supabase.from('features').select('id, epic_id, name')
      .eq('tenant_id', tid).is('archived_at', null).order('name'),
    supabase.from('dependencies').select('source_id, target_id, relation_type').eq('tenant_id', tid),
    supabase.from('profiles').select('id, name, avatar_initials, avatar_color').eq('tenant_id', tid).is('archived_at', null),
  ])

  const failed = [
    ['projects', projects.error], ['epics', epics.error], ['sprints', sprints.error],
    ['work_items', workItems.error], ['features', features.error], ['dependencies', dependencies.error], ['profiles', profiles.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined

  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  return {
    projects: projects.data ?? [],
    epics: epics.data ?? [],
    sprints: ((sprints.data ?? []) as SprintRow[]).slice().sort(sortSprintsByStartDate),
    workItems: workItems.data ?? [],
    features: features.data ?? [],
    dependencies: dependencies.data ?? [],
    profiles: profiles.data ?? [],
  }
}

/** Persists a dragged bar (new start/due date) and writes the audit trail. */
export async function updateWorkItemDates(
  item: WorkItemRow,
  startDate: string,
  dueDate: string,
  actorName = 'Sistema',
): Promise<void> {
  const { error } = await supabase
    .from('work_items')
    .update({ start_date: startDate, due_date: dueDate })
    .eq('id', item.id)
    .eq('tenant_id', DEFAULT_TENANT_ID)

  if (error) throw new Error(error.message)

  await supabase.from('audit_logs').insert({
    tenant_id: DEFAULT_TENANT_ID,
    entity_type: 'work_item',
    entity_id: item.id,
    action: 'work_item.dates_updated',
    actor_name: actorName,
    before: { start_date: item.start_date, due_date: item.due_date },
    after: { start_date: startDate, due_date: dueDate },
  })
}
