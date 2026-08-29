// Shared board column definitions used by both projects.ts and board.ts.

export interface BoardColumnDef {
  name: string
  category: string
  statuses: string[]
}

export const SCRUM_COLUMNS: BoardColumnDef[] = [
  { name: 'Backlog', category: 'todo', statuses: ['backlog'] },
  { name: 'A Fazer', category: 'todo', statuses: ['todo'] },
  { name: 'Em Andamento', category: 'in_progress', statuses: ['in_progress', 'blocked'] },
  { name: 'Em Revisão', category: 'in_progress', statuses: ['in_review'] },
  { name: 'Concluído', category: 'done', statuses: ['done'] },
]

export const KANBAN_COLUMNS: BoardColumnDef[] = [
  { name: 'A Fazer', category: 'todo', statuses: ['backlog', 'todo'] },
  { name: 'Executando', category: 'in_progress', statuses: ['in_progress', 'in_review', 'blocked'] },
  { name: 'Concluído', category: 'done', statuses: ['done'] },
]
