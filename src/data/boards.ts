import { MOCK_TENANT } from './session'

export type BoardStatus = 'active' | 'archived'

export interface BoardDef {
  id:          string
  tenant_id:   string
  name:        string
  project_id:  string
  project_name: string
  status:      BoardStatus
  columns:     string[]   // column names in order
  wip_limit?:  number
  item_count:  number
  updated_at:  string
}

const T = MOCK_TENANT.tenant_id

const MOCK_BOARDS: BoardDef[] = [
  {
    id: 'board_001', tenant_id: T,
    name: 'Sprint Board',
    project_id: 'proj_001', project_name: 'Website Relaunch',
    status: 'active',
    columns: ['Backlog', 'A Fazer', 'Em Dev', 'Em Revisão', 'Concluído'],
    wip_limit: 6, item_count: 38,
    updated_at: '2025-07-24T10:30:00Z',
  },
  {
    id: 'board_002', tenant_id: T,
    name: 'Design Review Flow',
    project_id: 'proj_001', project_name: 'Website Relaunch',
    status: 'active',
    columns: ['Aguardando', 'Em Revisão UX', 'Aprovado', 'Handoff Dev'],
    wip_limit: 4, item_count: 14,
    updated_at: '2025-07-23T16:00:00Z',
  },
  {
    id: 'board_003', tenant_id: T,
    name: 'DevOps Pipeline',
    project_id: 'proj_002', project_name: 'Infra Migration',
    status: 'active',
    columns: ['Planejado', 'Em Execução', 'Validação', 'Concluído'],
    wip_limit: 3, item_count: 21,
    updated_at: '2025-07-25T09:15:00Z',
  },
  {
    id: 'board_004', tenant_id: T,
    name: 'iOS & Android Release',
    project_id: 'proj_003', project_name: 'Mobile App',
    status: 'active',
    columns: ['Backlog', 'Em Dev', 'QA', 'Release Candidate', 'Publicado'],
    wip_limit: 5, item_count: 27,
    updated_at: '2025-07-22T14:45:00Z',
  },
  {
    id: 'board_005', tenant_id: T,
    name: 'Sprint Q1 2025',
    project_id: 'proj_001', project_name: 'Website Relaunch',
    status: 'archived',
    columns: ['Backlog', 'A Fazer', 'Em Dev', 'Em Revisão', 'Concluído'],
    item_count: 52,
    updated_at: '2025-04-01T18:00:00Z',
  },
]

export function getBoardsForScope(project_ids: string[], tenant_id: string): BoardDef[] {
  return MOCK_BOARDS.filter(b => b.tenant_id === tenant_id && project_ids.includes(b.project_id))
}

export function getBoardById(id: string): BoardDef | undefined {
  return MOCK_BOARDS.find(b => b.id === id)
}
