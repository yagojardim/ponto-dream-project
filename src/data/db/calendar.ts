// Calendar data access layer — real work item deadlines (due_date) from Supabase.
// The agenda itself still lives in the local calendar_events prototype domain.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'

export { DEFAULT_TENANT_ID }

type Tables = Database['public']['Tables']

export type DeadlineRow = Pick<
  Tables['work_items']['Row'],
  'id' | 'key' | 'title' | 'type' | 'status' | 'priority' | 'due_date' | 'project_id' | 'assignee_id' | 'is_blocked'
>

export interface DeadlineItem {
  id: string
  key: string
  title: string
  type: string
  status: string
  priority: string
  dueDateIso: string
  projectId: string
  projectName: string
  assigneeId: string | null
  blocked: boolean
}

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar o Calendário.`
  }
  return message
}

/** Every work item of the tenant that has a real deadline. */
export async function listDeadlines(projectIds?: string[]): Promise<DeadlineItem[]> {
  const tid = getActiveTenantId()
  let query = supabase.from('work_items')
    .select('id, key, title, type, status, priority, due_date, project_id, assignee_id, is_blocked')
    .eq('tenant_id', tid).is('archived_at', null).not('due_date', 'is', null)
  if (projectIds && projectIds.length > 0) query = query.in('project_id', projectIds)

  const [items, projects] = await Promise.all([
    query.order('due_date'),
    supabase.from('projects').select('id, name').eq('tenant_id', tid).is('archived_at', null),
  ])

  if (items.error) throw new Error(missingTableMessage('work_items', items.error.message))
  if (projects.error) throw new Error(missingTableMessage('projects', projects.error.message))

  const nameById = new Map((projects.data ?? []).map(p => [p.id, p.name]))

  return (items.data ?? []).map((r: DeadlineRow) => ({
    id: r.id,
    key: r.key,
    title: r.title,
    type: r.type,
    status: r.status,
    priority: r.priority,
    dueDateIso: r.due_date as string,
    projectId: r.project_id,
    projectName: nameById.get(r.project_id) ?? '',
    assigneeId: r.assignee_id,
    blocked: r.is_blocked,
  }))
}
