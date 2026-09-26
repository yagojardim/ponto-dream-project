// Shared board column definitions used by both projects.ts and board.ts.

export interface BoardColumnDef {
  name: string
  category: string
  statuses: string[]
}

export const SCRUM_COLUMNS: BoardColumnDef[] = [
  { name: 'Backlog', category: 'todo', statuses: ['backlog'] },
  { name: 'A Fazer', category: 'todo', statuses: ['todo'] },
  // Categoria 'in_progress' (valor já aceito pelo CHECK do banco); a cor roxa
  // vem do nome em columnColor(). O status próprio 'ux_ui' é o que distingue a etapa.
  { name: 'UX/UI', category: 'in_progress', statuses: ['ux_ui'] },
  { name: 'Em Andamento', category: 'in_progress', statuses: ['in_progress', 'blocked'] },
  { name: 'Em Revisão', category: 'in_progress', statuses: ['in_review'] },
  { name: 'Concluído', category: 'done', statuses: ['done'] },
]

export const KANBAN_COLUMNS: BoardColumnDef[] = [
  { name: 'A Fazer', category: 'todo', statuses: ['backlog', 'todo'] },
  { name: 'UX/UI', category: 'in_progress', statuses: ['ux_ui'] },
  { name: 'Executando', category: 'in_progress', statuses: ['in_progress', 'in_review', 'blocked'] },
  { name: 'Concluído', category: 'done', statuses: ['done'] },
]
