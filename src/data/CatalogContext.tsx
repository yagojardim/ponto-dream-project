import React, { createContext, useContext, useState } from "react"

export interface LabelDef {
  id: string
  name: string
  color: string
}
export interface PriorityDef {
  id: string
  name: string
  color: string
  icon: string
  order: number
}
export interface IssueTypeDef {
  id: string
  name: string
  icon: string
  color: string
  isDefault?: boolean
}
export interface ComponentDef {
  id: string
  name: string
  lead: string
  desc: string
}
export interface WorkflowStatus {
  id: string
  name: string
  color: string
  category: "todo" | "in-progress" | "done"
  order: number
}
export interface BoardColDef {
  id: string
  name: string
  statusIds: string[]
  wipLimit: number | null
}
export interface MemberDef {
  id: string
  name: string
  initials: string
  email: string
  role: "Admin" | "Member" | "Viewer"
  avatarColor: string
}

export interface Catalog {
  labels: LabelDef[]
  priorities: PriorityDef[]
  issueTypes: IssueTypeDef[]
  components: ComponentDef[]
  workflow: WorkflowStatus[]
  boardCols: BoardColDef[]
  members: MemberDef[]
}

const DEFAULT_CATALOG: Catalog = {
  labels: [
    { id: "l1", name: "Design", color: "#7d92ff" },
    { id: "l2", name: "Eng", color: "#35c9ae" },
    { id: "l3", name: "UX", color: "#a78bfa" },
    { id: "l4", name: "Content", color: "#e6b23c" },
    { id: "l5", name: "Research", color: "#f0805c" },
    { id: "l6", name: "SEO", color: "#22d3ee" },
    { id: "l7", name: "Web", color: "#fb923c" },
    { id: "l8", name: "Mobile", color: "#4ade80" },
    { id: "l9", name: "Brand", color: "#f472b6" },
    { id: "l10", name: "Hero", color: "#7d92ff" },
  ],
  priorities: [
    { id: "p1", name: "Crítica", color: "#f0805c", icon: "↑↑", order: 0 },
    { id: "p2", name: "Alta", color: "#e6b23c", icon: "↑", order: 1 },
    { id: "p3", name: "Média", color: "#7d92ff", icon: "→", order: 2 },
    { id: "p4", name: "Baixa", color: "#6a7390", icon: "↓", order: 3 },
  ],
  issueTypes: [
    {
      id: "t1",
      name: "História",
      icon: "◇",
      color: "#7d92ff",
      isDefault: true,
    },
    { id: "t2", name: "Bug", icon: "⬟", color: "#f0805c" },
    { id: "t4", name: "Subtarefa", icon: "◻", color: "#6a7390" },
    { id: "t5", name: "Épico", icon: "⚡", color: "#e6b23c" },
    { id: "t6", name: "Feature", icon: "▣", color: "#a78bfa" },
  ],
  components: [
    { id: "c1", name: "Frontend", lead: "AL", desc: "Componentes React e UI" },
    { id: "c2", name: "Backend", lead: "LF", desc: "APIs e serviços Node" },
    { id: "c3", name: "Design", lead: "AL", desc: "Design system e assets" },
    { id: "c4", name: "Infra", lead: "LF", desc: "CI/CD e cloud infra" },
    { id: "c5", name: "QA", lead: "NM", desc: "Testes e automação" },
  ],
  workflow: [
    { id: "w1", name: "Backlog", color: "#6a7390", category: "todo", order: 0 },
    { id: "w2", name: "A Fazer", color: "#a2a8ba", category: "todo", order: 1 },
    {
      id: "w3",
      name: "Em andamento",
      color: "#7d92ff",
      category: "in-progress",
      order: 2,
    },
    {
      id: "w4",
      name: "Em revisão",
      color: "#e6b23c",
      category: "in-progress",
      order: 3,
    },
    {
      id: "w5",
      name: "Concluído",
      color: "#35c9ae",
      category: "done",
      order: 4,
    },
  ],
  boardCols: [
    { id: "bc1", name: "Backlog", statusIds: ["w1"], wipLimit: null },
    { id: "bc2", name: "A Fazer", statusIds: ["w2"], wipLimit: 6 },
    { id: "bc3", name: "Em Dev", statusIds: ["w3"], wipLimit: 4 },
    { id: "bc4", name: "Em Revisão", statusIds: ["w4"], wipLimit: 3 },
    { id: "bc5", name: "Concluído", statusIds: ["w5"], wipLimit: null },
  ],
  members: [
    {
      id: "m1",
      name: "Ana Lima",
      initials: "AL",
      email: "ana@altech.io",
      role: "Admin",
      avatarColor: "#7d92ff",
    },
    {
      id: "m2",
      name: "Nuno Matos",
      initials: "NM",
      email: "nuno@altech.io",
      role: "Member",
      avatarColor: "#a78bfa",
    },
    {
      id: "m3",
      name: "João Neves",
      initials: "JN",
      email: "joao@altech.io",
      role: "Member",
      avatarColor: "#e6b23c",
    },
    {
      id: "m4",
      name: "Carla Silva",
      initials: "CS",
      email: "carla@altech.io",
      role: "Member",
      avatarColor: "#35c9ae",
    },
    {
      id: "m5",
      name: "Rui Melo",
      initials: "RM",
      email: "rui@altech.io",
      role: "Viewer",
      avatarColor: "#f0805c",
    },
    {
      id: "m6",
      name: "Lucas Ferreira",
      initials: "LF",
      email: "lucas@altech.io",
      role: "Member",
      avatarColor: "#f97316",
    },
  ],
}

interface CatalogCtx {
  catalog: Catalog
  setCatalog: React.Dispatch<React.SetStateAction<Catalog>>
  updateLabels: (fn: (prev: LabelDef[]) => LabelDef[]) => void
  updatePriorities: (fn: (prev: PriorityDef[]) => PriorityDef[]) => void
  updateIssueTypes: (fn: (prev: IssueTypeDef[]) => IssueTypeDef[]) => void
  updateComponents: (fn: (prev: ComponentDef[]) => ComponentDef[]) => void
  updateWorkflow: (fn: (prev: WorkflowStatus[]) => WorkflowStatus[]) => void
  updateBoardCols: (fn: (prev: BoardColDef[]) => BoardColDef[]) => void
  updateMembers: (fn: (prev: MemberDef[]) => MemberDef[]) => void
}

const CatalogContext = createContext<CatalogCtx | null>(null)

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(DEFAULT_CATALOG)

  function updateLabels(fn: (prev: LabelDef[]) => LabelDef[]) {
    setCatalog((c) => ({ ...c, labels: fn(c.labels) }))
  }
  function updatePriorities(fn: (prev: PriorityDef[]) => PriorityDef[]) {
    setCatalog((c) => ({ ...c, priorities: fn(c.priorities) }))
  }
  function updateIssueTypes(fn: (prev: IssueTypeDef[]) => IssueTypeDef[]) {
    setCatalog((c) => ({ ...c, issueTypes: fn(c.issueTypes) }))
  }
  function updateComponents(fn: (prev: ComponentDef[]) => ComponentDef[]) {
    setCatalog((c) => ({ ...c, components: fn(c.components) }))
  }
  function updateWorkflow(fn: (prev: WorkflowStatus[]) => WorkflowStatus[]) {
    setCatalog((c) => ({ ...c, workflow: fn(c.workflow) }))
  }
  function updateBoardCols(fn: (prev: BoardColDef[]) => BoardColDef[]) {
    setCatalog((c) => ({ ...c, boardCols: fn(c.boardCols) }))
  }
  function updateMembers(fn: (prev: MemberDef[]) => MemberDef[]) {
    setCatalog((c) => ({ ...c, members: fn(c.members) }))
  }

  return (
    <CatalogContext.Provider
      value={{
        catalog,
        setCatalog,
        updateLabels,
        updatePriorities,
        updateIssueTypes,
        updateComponents,
        updateWorkflow,
        updateBoardCols,
        updateMembers,
      }}
    >
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error("useCatalog must be used inside CatalogProvider")
  return ctx
}
