// Projects data access layer — real data from the connected Supabase project.
// Every read is filtered by tenant_id; every write records an audit_logs entry.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { DEFAULT_TENANT_ID, projectColor } from './timeline'
import { safeCall } from '@/utils/logger'
import { can } from '@/data/permissions'

export { DEFAULT_TENANT_ID, projectColor }

type Tables = Database['public']['Tables']

export type ProjectRow = Pick<
  Tables['projects']['Row'],
  'id' | 'key' | 'name' | 'description' | 'client_name' | 'status' | 'lead_id' | 'period_start' | 'period_end' | 'metadata'
>
export type ProjectTaskRow = Pick<
  Tables['work_items']['Row'],
  'id' | 'key' | 'title' | 'type' | 'status' | 'project_id' | 'parent_id' | 'assignee_id' | 'start_date' | 'due_date' | 'progress'
>

export type ProjectProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials' | 'avatar_color'>
export type ProjectMemberRow = Pick<Tables['project_members']['Row'], 'project_id' | 'profile_id' | 'project_role'>
export type ProjectBoardRow = Pick<Tables['boards']['Row'], 'id' | 'project_id' | 'name' | 'board_type'>

export interface ProjectsData {
  projects: ProjectRow[]
  tasks: ProjectTaskRow[]
  profiles: ProjectProfileRow[]
  members: ProjectMemberRow[]
  boards: ProjectBoardRow[]
}

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar esta tela.`
  }
  return message
}

function fail(table: string, message: string): Error {
  return new Error(missingTableMessage(table, message))
}

/** Percentage of completed work items for a project. */
export function projectProgress(tasks: ProjectTaskRow[]): number {
  if (tasks.length === 0) return 0
  const done = tasks.filter(t => t.status === 'done').length
  return Math.round((done / tasks.length) * 100)
}

export async function listProjects(): Promise<ProjectsData> {
  const tid = DEFAULT_TENANT_ID

  const [projects, tasks, profiles, members, boards] = await Promise.all([
    supabase.from('projects')
      .select('id, key, name, description, client_name, status, lead_id, period_start, period_end, metadata')
      .eq('tenant_id', tid).is('archived_at', null).order('name'),
    supabase.from('work_items')
      .select('id, key, title, type, status, project_id, parent_id, assignee_id, start_date, due_date, progress')
      .eq('tenant_id', tid).is('archived_at', null).order('key'),

    supabase.from('profiles').select('id, name, avatar_initials, avatar_color').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('project_members').select('project_id, profile_id, project_role').eq('tenant_id', tid),
    supabase.from('boards').select('id, project_id, name, board_type').eq('tenant_id', tid).is('archived_at', null),

  ])

  const failed = [
    ['projects', projects.error], ['work_items', tasks.error], ['profiles', profiles.error],
    ['project_members', members.error], ['boards', boards.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined
  if (failed) throw fail(failed[0], failed[1].message)

  return {
    projects: projects.data ?? [],
    tasks: tasks.data ?? [],
    profiles: profiles.data ?? [],
    members: members.data ?? [],
    boards: boards.data ?? [],
  }
}

type AuditValue = string | number | boolean | null
type AuditPayload = Record<string, AuditValue>

async function writeAudit(
  entityId: string,
  action: string,
  actorName: string,
  before: AuditPayload | null,
  after: AuditPayload | null,
): Promise<void> {
  await supabase.from('audit_logs').insert({
    tenant_id: DEFAULT_TENANT_ID,
    entity_type: 'project',
    entity_id: entityId,
    action,
    actor_name: actorName,
    before,
    after,
  })
}

export interface CreateProjectInput {
  name: string
  key: string
  description?: string | null
  clientName?: string | null
  boardType?: 'scrum' | 'kanban'
  leadId?: string | null
  actorName?: string
  usesFeatures?: boolean
}

export function projectUsesFeatures(p: { metadata?: unknown } | null | undefined): boolean {
  const m = (p?.metadata ?? {}) as Record<string, unknown>
  return m.uses_features === true
}


const SCRUM_COLUMNS: { name: string; category: string; statuses: string[] }[] = [
  { name: 'Backlog', category: 'todo', statuses: ['backlog'] },
  { name: 'A Fazer', category: 'todo', statuses: ['todo'] },
  { name: 'Em Andamento', category: 'in_progress', statuses: ['in_progress', 'blocked'] },
  { name: 'Em Revisão', category: 'in_progress', statuses: ['in_review'] },
  { name: 'Concluído', category: 'done', statuses: ['done'] },
]

const KANBAN_COLUMNS: { name: string; category: string; statuses: string[] }[] = [
  { name: 'A Fazer', category: 'todo', statuses: ['backlog', 'todo'] },
  { name: 'Executando', category: 'in_progress', statuses: ['in_progress', 'in_review', 'blocked'] },
  { name: 'Concluído', category: 'done', statuses: ['done'] },
]

/** Creates a project plus its default board, columns and lead membership. */
export async function createProject(input: CreateProjectInput): Promise<ProjectRow> {
  const tid = DEFAULT_TENANT_ID
  const boardType = input.boardType ?? 'scrum'
  const actorName = input.actorName ?? 'Sistema'

  const { data: project, error } = await supabase.from('projects').insert({
    tenant_id: tid,
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    client_name: input.clientName ?? null,
    status: 'planned',
    lead_id: input.leadId ?? null,
    metadata: { uses_features: input.usesFeatures ?? false },
  }).select('id, key, name, description, client_name, status, lead_id, period_start, period_end, metadata').single()


  if (error || !project) throw fail('projects', error?.message ?? 'Falha ao criar o projeto.')

  const { data: board, error: boardErr } = await supabase.from('boards').insert({
    tenant_id: tid,
    project_id: project.id,
    name: boardType === 'scrum' ? 'Sprint Board' : 'Kanban',
    board_type: boardType,
    status: 'active',
  }).select('id').single()

  if (boardErr || !board) throw fail('boards', boardErr?.message ?? 'Falha ao criar o board padrão.')

  const defs = boardType === 'scrum' ? SCRUM_COLUMNS : KANBAN_COLUMNS
  const { data: columns, error: colErr } = await supabase.from('board_columns').insert(
    defs.map((c, i) => ({
      tenant_id: tid, board_id: board.id, name: c.name, category: c.category, position: i,
    })),
  ).select('id, position')

  if (colErr) throw fail('board_columns', colErr.message)

  const statusRows = (columns ?? []).flatMap(col => {
    const def = defs[col.position]
    return (def?.statuses ?? []).map(status_key => ({
      tenant_id: tid, board_column_id: col.id, status_key,
    }))
  })
  if (statusRows.length > 0) {
    const { error: bcsErr } = await supabase.from('board_column_statuses').insert(statusRows)
    if (bcsErr) throw fail('board_column_statuses', bcsErr.message)
  }

  if (input.leadId) {
    const { error: memberErr } = await supabase.from('project_members').insert({
      tenant_id: tid, project_id: project.id, profile_id: input.leadId, project_role: 'admin',
    })
    if (memberErr) throw fail('project_members', memberErr.message)
  }

  await writeAudit(project.id, 'project.created', actorName, null, {
    key: project.key, name: project.name, board_type: boardType,
  })

  return project
}

export interface UpdateProjectInput {
  name?: string
  status?: string
  periodStart?: string | null
  periodEnd?: string | null
  leadId?: string | null
  clientName?: string | null
  description?: string | null
  archivedAt?: string | null
  metadata?: Record<string, unknown>
}

export async function updateProject(
  project: ProjectRow,
  patch: UpdateProjectInput,
  actorName = 'Sistema',
): Promise<void> {
  const payload: Tables['projects']['Update'] = {}
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.status !== undefined) payload.status = patch.status
  if (patch.periodStart !== undefined) payload.period_start = patch.periodStart
  if (patch.periodEnd !== undefined) payload.period_end = patch.periodEnd
  if (patch.leadId !== undefined) payload.lead_id = patch.leadId
  if (patch.clientName !== undefined) payload.client_name = patch.clientName
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.archivedAt !== undefined) payload.archived_at = patch.archivedAt
  if (patch.metadata !== undefined) payload.metadata = patch.metadata as Tables['projects']['Update']['metadata']
  if (Object.keys(payload).length === 0) return

  const { error } = await supabase.from('projects')
    .update(payload).eq('id', project.id).eq('tenant_id', DEFAULT_TENANT_ID)
  if (error) throw fail('projects', error.message)

  await writeAudit(project.id, 'project.updated', actorName, {
    name: project.name, status: project.status, period_start: project.period_start,
    period_end: project.period_end, lead_id: project.lead_id, client_name: project.client_name,
  }, payload as unknown as AuditPayload)

}

/**
 * `permission_overrides` ainda não expõe colunas de escopo nos tipos gerados;
 * a leitura é feita por um acesso estreitamente tipado (sem `any`).
 */
interface ProjectOverrideRow {
  scope_id: string | null
  scope_type: string | null
  granted: boolean | null
}

interface OverrideQuery {
  select: (cols: string) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => PromiseLike<{ data: ProjectOverrideRow[] | null }>
    }
  }
}

async function fetchProjectOverrides(tenantId: string, profileId: string): Promise<ProjectOverrideRow[]> {
  const client = supabase as unknown as { from: (table: string) => OverrideQuery }
  const res = await client.from('permission_overrides')
    .select('scope_id, scope_type, granted')
    .eq('tenant_id', tenantId)
    .eq('profile_id', profileId)
  return res.data ?? []
}

/** Options for the Home project filter: projects assigned to the profile. */
export interface AssignedProject { id: string; name: string }

/**
 * Projetos atribuídos ao perfil (não depende de board).
 * Gestão (`users:manage` / `board:manage`) enxerga todos os projetos do tenant.
 * Degrada para lista vazia em qualquer falha — nunca cross-tenant.
 */
export function fetchAssignedProjects(opts: {
  tenantId: string
  profileId: string
  permissions: string[]
}): Promise<AssignedProject[]> {
  const { tenantId, profileId, permissions } = opts

  return safeCall<AssignedProject[]>('projects.fetchAssignedProjects', async () => {
    if (!tenantId) return []

    const tenantWide = can(permissions, 'users:manage') || can(permissions, 'board:manage')
    let allowedProjectIds: string[] | null = null // null ⇒ todos do tenant

    if (!tenantWide) {
      const [members, overrides] = await Promise.all([
        supabase.from('project_members').select('project_id')
          .eq('tenant_id', tenantId).eq('profile_id', profileId),
        fetchProjectOverrides(tenantId, profileId),
      ])

      const ids = new Set<string>()
      for (const row of members.data ?? []) {
        if (row.project_id) ids.add(row.project_id)
      }
      for (const row of overrides) {
        if (row.granted !== false && row.scope_type === 'project' && row.scope_id) ids.add(row.scope_id)
      }
      allowedProjectIds = [...ids]
      if (allowedProjectIds.length === 0) return []
    }

    let query = supabase.from('projects').select('id, name')
      .eq('tenant_id', tenantId).is('archived_at', null).order('name')
    if (allowedProjectIds) query = query.in('id', allowedProjectIds)

    const res = await query
    if (res.error) throw fail('projects', res.error.message)
    return (res.data ?? []).map(p => ({ id: p.id, name: p.name }))
  }, [])
}
