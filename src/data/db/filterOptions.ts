import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { DEFAULT_TENANT_ID } from './timeline'

export interface FilterOption { value: string; label: string }

/** Opções reais (por id) para os campos de filtro do board que apontam para colunas uuid. */
export interface BoardFilterOptions {
  assignee_id: FilterOption[]
  sprint_id: FilterOption[]
  epic_id: FilterOption[]
}

const EMPTY: BoardFilterOptions = { assignee_id: [], sprint_id: [], epic_id: [] }

interface IdName { id: string; name: string | null }

/**
 * Carrega as opções de filtro de um projeto: Responsável (membros do tenant),
 * Sprint e Épico (do projeto). Degrada para listas vazias em qualquer falha.
 */
export function fetchBoardFilterOptions(projectId: string): Promise<BoardFilterOptions> {
  return safeCall<BoardFilterOptions>('board.filterOptions', async () => {
    if (!projectId) return EMPTY
    const tid = DEFAULT_TENANT_ID
    const [profilesRes, sprintsRes, epicsRes] = await Promise.all([
      supabase.from('profiles').select('id, name').eq('tenant_id', tid).is('archived_at', null),
      supabase.from('sprints').select('id, name').eq('tenant_id', tid).eq('project_id', projectId).is('archived_at', null),
      supabase.from('epics').select('id, name').eq('tenant_id', tid).eq('project_id', projectId).is('archived_at', null),
    ])
    const toOpts = (rows: IdName[] | null): FilterOption[] =>
      (rows ?? []).map(r => ({ value: r.id, label: r.name ?? r.id }))
    return {
      assignee_id: toOpts(profilesRes.data as IdName[] | null),
      sprint_id: toOpts(sprintsRes.data as IdName[] | null),
      epic_id: toOpts(epicsRes.data as IdName[] | null),
    }
  }, EMPTY)
}
