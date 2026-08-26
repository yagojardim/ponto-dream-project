import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { DEFAULT_TENANT_ID } from './timeline'
import { VIEW_LABELS } from '../../App'

export interface SearchResult {
  id: string
  label: string
  sub: string
  kind: 'project' | 'item' | 'member' | 'screen'
  view: string
  targetId?: string
}

type Tables = Database['public']['Tables']
type ProjectRow = Pick<Tables['projects']['Row'], 'id' | 'key' | 'name'>
type WorkItemRow = Pick<Tables['work_items']['Row'], 'id' | 'key' | 'title'>
type ProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'primary_role'>

export async function searchGlobal(q: string): Promise<SearchResult[]> {
  const term = q.trim()
  if (term.length < 2) return []

  const like = `%${term}%`
  const tid = DEFAULT_TENANT_ID

  try {
    const [projects, workItems, profiles] = await Promise.all([
      supabase
        .from('projects')
        .select('id, key, name')
        .eq('tenant_id', tid)
        .is('archived_at', null)
        .or(`name.ilike.${like},key.ilike.${like}`)
        .order('name')
        .limit(5)
        .then(r => ({ data: r.data as ProjectRow[] | null, error: r.error })),

      supabase
        .from('work_items')
        .select('id, key, title')
        .eq('tenant_id', tid)
        .is('archived_at', null)
        .or(`title.ilike.${like},key.ilike.${like}`)
        .order('key')
        .limit(8)
        .then(r => ({ data: r.data as WorkItemRow[] | null, error: r.error })),

      supabase
        .from('profiles')
        .select('id, name, primary_role')
        .eq('tenant_id', tid)
        .is('archived_at', null)
        .ilike('name', like)
        .order('name')
        .limit(5)
        .then(r => ({ data: r.data as ProfileRow[] | null, error: r.error })),
    ])

    if (projects.error) throw projects.error
    if (workItems.error) throw workItems.error
    if (profiles.error) throw profiles.error

    const screenResults: SearchResult[] = Object.entries(VIEW_LABELS)
      .filter(([, label]) => label.toLowerCase().includes(term.toLowerCase()))
      .map(([key, label]) => ({
        id: `screen-${key}`,
        label,
        sub: 'Tela',
        kind: 'screen' as const,
        view: key,
      }))

    const projectResults: SearchResult[] = (projects.data ?? []).map(p => ({
      id: p.id,
      label: p.name,
      sub: 'Projeto',
      kind: 'project' as const,
      view: 'project',
      targetId: p.id,
    }))

    const itemResults: SearchResult[] = (workItems.data ?? []).map(w => ({
      id: w.id,
      label: w.title,
      sub: `Demanda · ${w.key}`,
      kind: 'item' as const,
      view: 'list',
      targetId: w.id,
    }))

    const memberResults: SearchResult[] = (profiles.data ?? []).map(p => ({
      id: p.id,
      label: p.name,
      sub: p.primary_role ? String(p.primary_role) : 'Membro',
      kind: 'member' as const,
      view: 'team',
      targetId: p.id,
    }))

    return [
      ...projectResults,
      ...itemResults,
      ...memberResults,
      ...screenResults,
    ]
  } catch (err) {
    console.error('searchGlobal failed:', err)
    return []
  }
}
