// Boards visíveis para o usuário autenticado.
// Sempre escopado pelo tenant do próprio usuário — nunca cross-tenant.
// A visibilidade usa o RBAC existente: papel/permissions + project_members (+ permission_overrides).
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { can } from '@/data/permissions'
import { useSession } from '@/data/SessionContext'

export type VisibleBoardStatus = 'active' | 'archived'

export interface VisibleBoard {
  id: string
  tenant_id: string
  name: string
  project_id: string
  project_name: string
  status: VisibleBoardStatus
  /** true quando o board foi finalizado (ciclo de vida), não apenas arquivado. */
  finalized: boolean
  archived_at: string | null
  description: string
  period_start: string
  period_end: string
  team_ids: string[]
  columns: string[]
  item_count: number
  updated_at: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

/** Vê todos os boards do tenant (Admin / gestão) ou apenas os dos projetos em que participa. */
function hasTenantWideAccess(permissions: string[]): boolean {
  return can(permissions, 'users:manage') || can(permissions, 'board:manage')
}

/**
 * Lista os boards que o usuário pode VISUALIZAR.
 * Degrada para lista vazia em qualquer falha de leitura (nunca lança).
 */
export function fetchVisibleBoards(opts: {
  tenantId: string
  profileId: string
  permissions: string[]
}): Promise<VisibleBoard[]> {
  const { tenantId, profileId, permissions } = opts

  return safeCall<VisibleBoard[]>('boards.fetchVisibleBoards', async () => {
    if (!tenantId) return []

    let allowedProjectIds: string[] | null = null // null ⇒ todos do tenant

    if (!hasTenantWideAccess(permissions)) {
      const [members, overrides] = await Promise.all([
        tbl('project_members').select('project_id').eq('tenant_id', tenantId).eq('profile_id', profileId),
        tbl('permission_overrides').select('scope_id, scope_type, granted')
          .eq('tenant_id', tenantId).eq('profile_id', profileId),
      ])

      const ids = new Set<string>()
      for (const row of (members.data ?? []) as { project_id: string }[]) {
        if (row.project_id) ids.add(row.project_id)
      }
      for (const row of (overrides.data ?? []) as { scope_id: string | null; scope_type: string | null; granted: boolean | null }[]) {
        if (row.granted !== false && row.scope_type === 'project' && row.scope_id) ids.add(row.scope_id)
      }
      allowedProjectIds = [...ids]
      if (allowedProjectIds.length === 0) return []
    }

    let query = tbl('boards')
      .select('id, tenant_id, name, project_id, status, description, metadata, archived_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('name')
    if (allowedProjectIds) query = query.in('project_id', allowedProjectIds)

    const boardsRes = await query
    if (boardsRes.error) throw new Error(boardsRes.error.message)
    const boards = (boardsRes.data ?? []) as BoardRow[]
    if (boards.length === 0) return []

    const projectIds = [...new Set(boards.map(b => b.project_id).filter(Boolean))]
    const boardIds = boards.map(b => b.id)

    const [projectsRes, columnsRes, itemsRes] = await Promise.all([
      tbl('projects').select('id, name').eq('tenant_id', tenantId).in('id', projectIds),
      tbl('board_columns').select('id, board_id, name, position').eq('tenant_id', tenantId).in('board_id', boardIds).order('position'),
      tbl('work_items').select('id, board_id').eq('tenant_id', tenantId).in('board_id', boardIds),
    ])

    const projectName = new Map<string, string>()
    for (const p of (projectsRes.data ?? []) as { id: string; name: string }[]) projectName.set(p.id, p.name)

    const columnsByBoard = new Map<string, string[]>()
    for (const c of (columnsRes.data ?? []) as { board_id: string; name: string }[]) {
      const list = columnsByBoard.get(c.board_id) ?? []
      list.push(c.name)
      columnsByBoard.set(c.board_id, list)
    }

    const countByBoard = new Map<string, number>()
    for (const i of (itemsRes.data ?? []) as { board_id: string | null }[]) {
      if (!i.board_id) continue
      countByBoard.set(i.board_id, (countByBoard.get(i.board_id) ?? 0) + 1)
    }

    return boards.map(b => ({
      id: b.id,
      tenant_id: b.tenant_id,
      name: b.name,
      project_id: b.project_id,
      project_name: projectName.get(b.project_id) ?? 'Projeto',
      status: (b.status === 'archived' ? 'archived' : 'active') as VisibleBoardStatus,
      columns: columnsByBoard.get(b.id) ?? [],
      item_count: countByBoard.get(b.id) ?? 0,
      updated_at: b.updated_at ?? new Date().toISOString(),
    }))
  }, [])
}

export interface VisibleBoardsState {
  boards: VisibleBoard[]
  loading: boolean
}

/** Hook compartilhado pela Sidebar e pela BoardsListPage. */
export function useVisibleBoards(): VisibleBoardsState {
  const { activeUser } = useSession()
  const [boards, setBoards] = useState<VisibleBoard[]>([])
  const [loading, setLoading] = useState(true)

  const tenantId = activeUser.tenant_id
  const profileId = activeUser.user_id
  const permKey = activeUser.permissions.join(',')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchVisibleBoards({ tenantId, profileId, permissions: permKey ? permKey.split(',') : [] })
      .then(rows => { if (alive) setBoards(rows) })
      .catch(() => { if (alive) setBoards([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tenantId, profileId, permKey])

  return { boards, loading }
}
