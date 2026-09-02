// Epics data access layer — real epics, features and work items from Supabase.
// Every read is filtered by tenant_id; every write records an audit_logs entry.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { DEFAULT_TENANT_ID, epicColor } from './timeline'
import { getActiveTenantId } from '@/data/session'

export { DEFAULT_TENANT_ID, epicColor }

type Tables = Database['public']['Tables']

export type EpicRow = Pick<
  Tables['epics']['Row'],
  'id' | 'project_id' | 'key' | 'name' | 'description' | 'color' | 'quarter' | 'owner_id'
>
export type EpicFeatureRow = Pick<Tables['features']['Row'], 'id' | 'epic_id' | 'name' | 'description'>
export type EpicItemRow = Pick<
  Tables['work_items']['Row'],
  'id' | 'key' | 'title' | 'type' | 'status' | 'priority' | 'epic_id' | 'feature_id' | 'project_id'
  | 'assignee_id' | 'story_points' | 'is_blocked'
>
export type EpicProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials' | 'avatar_color' | 'primary_role'>
export type EpicProjectRow = Pick<Tables['projects']['Row'], 'id' | 'key' | 'name'>

export interface EpicsData {
  epics: EpicRow[]
  features: EpicFeatureRow[]
  items: EpicItemRow[]
  profiles: EpicProfileRow[]
  projects: EpicProjectRow[]
}

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar a tela de Épicos.`
  }
  return message
}

/** Lists every epic of the tenant (optionally scoped to a set of projects). */
export async function listEpics(projectIds?: string[]): Promise<EpicsData> {
  const tid = getActiveTenantId()
  const scoped = projectIds && projectIds.length > 0 ? projectIds : null

  let epicsQ = supabase.from('epics')
    .select('id, project_id, key, name, description, color, quarter, owner_id')
    .eq('tenant_id', tid).is('archived_at', null)
  let itemsQ = supabase.from('work_items')
    .select('id, key, title, type, status, priority, epic_id, feature_id, project_id, assignee_id, story_points, is_blocked')
    .eq('tenant_id', tid).is('archived_at', null)
  if (scoped) {
    epicsQ = epicsQ.in('project_id', scoped)
    itemsQ = itemsQ.in('project_id', scoped)
  }

  const [epics, features, items, profiles, projects] = await Promise.all([
    epicsQ.order('key'),
    supabase.from('features').select('id, epic_id, name, description').eq('tenant_id', tid).is('archived_at', null),
    itemsQ.order('key'),
    supabase.from('profiles').select('id, name, avatar_initials, avatar_color, primary_role').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('projects').select('id, key, name').eq('tenant_id', tid).is('archived_at', null).order('name'),
  ])

  const failed = [
    ['epics', epics.error], ['features', features.error], ['work_items', items.error],
    ['profiles', profiles.error], ['projects', projects.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined
  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  return {
    epics: epics.data ?? [],
    features: features.data ?? [],
    items: items.data ?? [],
    profiles: profiles.data ?? [],
    projects: projects.data ?? [],
  }
}

type AuditValue = string | number | boolean | null
type AuditPayload = Record<string, AuditValue>

async function writeAudit(
  entityType: string,
  entityId: string,
  action: string,
  actorName: string,
  before: AuditPayload | null,
  after: AuditPayload | null,
): Promise<void> {
  await supabase.from('audit_logs').insert({
    tenant_id: getActiveTenantId(),
    entity_type: entityType,
    entity_id: entityId,
    action,
    actor_name: actorName,
    before,
    after,
  })
}

/** Next sequential key (PROJ-123) for a project. */
async function nextItemKey(projectId: string): Promise<string> {
  const { data: project } = await supabase.from('projects')
    .select('key').eq('id', projectId).eq('tenant_id', getActiveTenantId()).single()
  const prefix = project?.key ?? 'ITEM'
  const { data: rows } = await supabase.from('work_items')
    .select('key').eq('project_id', projectId).eq('tenant_id', getActiveTenantId())
  const max = (rows ?? []).reduce((acc, r) => {
    const n = parseInt((r.key ?? '').split('-').pop() ?? '', 10)
    return Number.isFinite(n) && n > acc ? n : acc
  }, 100)
  return `${prefix}-${max + 1}`
}

export interface CreateEpicIssueInput {
  epicId: string
  projectId: string
  title: string
  description?: string | null
  type?: string
  priority?: string
  assigneeId?: string | null
  storyPoints?: number | null
  actorName?: string
}

/** Creates a real work item already linked to the epic. */
export async function createEpicIssue(input: CreateEpicIssueInput): Promise<EpicItemRow> {
  const key = await nextItemKey(input.projectId)

  const { data, error } = await supabase.from('work_items').insert({
    tenant_id: getActiveTenantId(),
    project_id: input.projectId,
    epic_id: input.epicId,
    key,
    type: input.type ?? 'story',
    title: input.title,
    description: input.description ?? null,
    status: 'backlog',
    priority: input.priority ?? 'media',
    assignee_id: input.assigneeId ?? null,
    story_points: input.storyPoints ?? null,
  }).select('id, key, title, type, status, priority, epic_id, feature_id, project_id, assignee_id, story_points, is_blocked')
    .single()

  if (error || !data) throw new Error(missingTableMessage('work_items', error?.message ?? 'Falha ao criar a issue.'))

  await writeAudit('work_item', data.id, 'work_item.created', input.actorName ?? 'Sistema', null, {
    key: data.key, title: data.title, epic_id: input.epicId,
  })

  return data as EpicItemRow
}

/** Links an existing work item to an epic. */
export async function linkItemToEpic(itemId: string, epicId: string, actorName = 'Sistema'): Promise<void> {
  const { error } = await supabase.from('work_items')
    .update({ epic_id: epicId }).eq('id', itemId).eq('tenant_id', getActiveTenantId())
  if (error) throw new Error(missingTableMessage('work_items', error.message))
  await writeAudit('work_item', itemId, 'work_item.epic_linked', actorName, null, { epic_id: epicId })
}

export interface CreateEpicInput {
  projectId: string
  name: string
  key?: string
  description?: string | null
  quarter?: string | null
  ownerId?: string | null
  color?: string | null
  actorName?: string
}

/** Next sequential epic key (EP-01, EP-02, …) for a project. */
export async function nextEpicKey(projectId: string): Promise<string> {
  const { data, error } = await supabase.from('epics')
    .select('key').eq('project_id', projectId).eq('tenant_id', getActiveTenantId())
  if (error) throw new Error(missingTableMessage('epics', error.message))
  const max = (data ?? []).reduce((acc, r) => {
    const n = parseInt((r.key ?? '').split('-').pop() ?? '', 10)
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return `EP-${String(max + 1).padStart(2, '0')}`
}

/** Creates a real epic for a project of the current tenant. */
export async function createEpic(input: CreateEpicInput): Promise<EpicRow> {
  try {
    const key = input.key?.trim() || (await nextEpicKey(input.projectId))

    const { data, error } = await supabase.from('epics').insert({
      tenant_id: getActiveTenantId(),
      project_id: input.projectId,
      key,
      name: input.name,
      description: input.description ?? null,
      quarter: input.quarter ?? null,
      owner_id: input.ownerId ?? null,
      color: input.color ?? null,
    }).select('id, project_id, key, name, description, color, quarter, owner_id').single()

    if (error || !data) {
      throw new Error(missingTableMessage('epics', error?.message ?? 'Falha ao criar o épico.'))
    }

    await writeAudit('epic', data.id, 'epic.created', input.actorName ?? 'Sistema', null, {
      key: data.key, name: data.name, project_id: data.project_id,
    })

    return data as EpicRow
  } catch (err) {
    throw new Error(`Não foi possível criar o épico: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Creates a feature (row in `features`) under an epic. */
export async function createFeature(input: {
  epicId: string; name: string; description?: string | null; actorName?: string
}): Promise<EpicFeatureRow> {
  const { data, error } = await supabase.from('features').insert({
    tenant_id: getActiveTenantId(),
    epic_id: input.epicId,
    name: input.name,
    description: input.description ?? null,
  }).select('id, epic_id, name, description').single()
  if (error || !data) throw new Error(missingTableMessage('features', error?.message ?? 'Falha ao criar a funcionalidade.'))
  await writeAudit('feature', data.id, 'feature.created', input.actorName ?? 'Sistema', null, { name: data.name, epic_id: data.epic_id })
  return data as EpicFeatureRow
}
