// "Minha Fila" data access layer — real work items assigned to the active profile.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'

export { DEFAULT_TENANT_ID }

type Tables = Database['public']['Tables']

type QueueRow = Pick<
  Tables['work_items']['Row'],
  'id' | 'key' | 'title' | 'type' | 'status' | 'priority' | 'due_date' | 'start_date'
  | 'project_id' | 'epic_id' | 'sprint_id' | 'assignee_id' | 'story_points' | 'is_blocked'
  | 'blocked_reason' | 'progress' | 'updated_at'
>

export interface QueueItem {
  id: string
  key: string
  title: string
  type: string
  status: string
  priority: string
  dueDateIso: string | null
  startDateIso: string | null
  projectId: string
  projectName: string
  epicId: string | null
  epicName: string | null
  sprintId: string | null
  sprintName: string | null
  storyPoints: number | null
  blocked: boolean
  blockedReason: string | null
  progress: number
  updatedAt: string
}

export interface QueueData {
  profileId: string | null
  items: QueueItem[]
}

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar a Minha Fila.`
  }
  return message
}

/** Resolves the profile of the active session user by name (auth comes later). */
export async function resolveProfileIdByName(name: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles')
    .select('id, name').eq('tenant_id', getActiveTenantId()).eq('name', name).limit(1)
  if (error) throw new Error(missingTableMessage('profiles', error.message))
  return data?.[0]?.id ?? null
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 0, critica: 0, crítica: 0, high: 1, alta: 1, medium: 2, media: 2, média: 2, low: 3, baixa: 3,
}

/** Work items assigned to a user, ordered by required action then deadline. */
export async function listMyQueue(userName: string): Promise<QueueData> {
  const profileId = await resolveProfileIdByName(userName)
  if (!profileId) return { profileId: null, items: [] }

  const [items, projects, epics, sprints] = await Promise.all([
    supabase.from('work_items')
      .select('id, key, title, type, status, priority, due_date, start_date, project_id, epic_id, sprint_id, assignee_id, story_points, is_blocked, blocked_reason, progress, updated_at')
      .eq('tenant_id', getActiveTenantId()).eq('assignee_id', profileId).is('archived_at', null),
    supabase.from('projects').select('id, name').eq('tenant_id', getActiveTenantId()),
    supabase.from('epics').select('id, name').eq('tenant_id', getActiveTenantId()),
    supabase.from('sprints').select('id, name').eq('tenant_id', getActiveTenantId()),
  ])

  const failed = [
    ['work_items', items.error], ['projects', projects.error],
    ['epics', epics.error], ['sprints', sprints.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined
  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  const projectName = new Map((projects.data ?? []).map(p => [p.id, p.name]))
  const epicName    = new Map((epics.data ?? []).map(e => [e.id, e.name]))
  const sprintName  = new Map((sprints.data ?? []).map(s => [s.id, s.name]))

  const mapped: QueueItem[] = (items.data ?? []).map((r: QueueRow) => ({
    id: r.id,
    key: r.key,
    title: r.title,
    type: r.type,
    status: r.status,
    priority: r.priority,
    dueDateIso: r.due_date,
    startDateIso: r.start_date,
    projectId: r.project_id,
    projectName: projectName.get(r.project_id) ?? '',
    epicId: r.epic_id,
    epicName: r.epic_id ? epicName.get(r.epic_id) ?? null : null,
    sprintId: r.sprint_id,
    sprintName: r.sprint_id ? sprintName.get(r.sprint_id) ?? null : null,
    storyPoints: r.story_points === null ? null : Number(r.story_points),
    blocked: r.is_blocked,
    blockedReason: r.blocked_reason,
    progress: r.progress ?? 0,
    updatedAt: r.updated_at,
  }))

  mapped.sort((a, b) => {
    // 1) blocked items first (need action), 2) earliest deadline, 3) priority
    if (a.blocked !== b.blocked) return a.blocked ? -1 : 1
    const ad = a.dueDateIso ?? '9999-12-31'
    const bd = b.dueDateIso ?? '9999-12-31'
    if (ad !== bd) return ad < bd ? -1 : 1
    const ap = PRIORITY_WEIGHT[a.priority] ?? 9
    const bp = PRIORITY_WEIGHT[b.priority] ?? 9
    if (ap !== bp) return ap - bp
    return a.key.localeCompare(b.key)
  })

  return { profileId, items: mapped }
}
