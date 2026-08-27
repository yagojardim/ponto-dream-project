/**
 * Altech — Native Home widgets.
 * Each card of the Início screen extracted into a standalone component so it can
 * be registered in the widget catalog (src/data/homeWidgets.tsx) and rendered
 * inside the draggable/resizable grid. All data comes from the live Supabase
 * dashboard store (src/data/db/homeLive.ts) — no mocks.
 */
import { T } from '@/components/ds/tokens'
import {
  KpiCard, RagCard, WorkQueue, SprintDonutCard, EmptyState,
  type WorkItem,
} from '@/components/ds/DashboardKit'
import {
  liveItems, liveProjects, liveAggregates, liveCurrentSprintName,
  getBlockedItems, getSprintItems, getReadyItems, getTestingItems, getBacklogWithAlerts,
} from '@/data/db/homeLive'

export interface WidgetCtx {
  /** Navigates to another screen of the app (optionally focusing an entity). */
  onNav: (view: string, targetId?: string) => void
  /** Opens the shared work item drawer with the clicked item. */
  onOpenItem: (item: WorkItem) => void
  /** Name of the logged user — used by the personal queues. */
  userName: string
}

function Scroll({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
}

// ─── Queues ───────────────────────────────────────────────────────────────────

export function BlockedWidget({ onNav, onOpenItem }: WidgetCtx) {
  const items = getBlockedItems()
  return (
    <WorkQueue
      title={`Bloqueados (${items.length})`}
      items={items}
      showDaysBlocked
      maxItems={20}
      emptyMsg="Nenhum item bloqueado no seu escopo."
      onOpen={onOpenItem}
      onViewAll={() => onNav('list')}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

export function ReadyWidget({ onNav, onOpenItem }: WidgetCtx) {
  const items = getReadyItems()
  return (
    <WorkQueue
      title={`Prontos para desenvolvimento (${items.length})`}
      items={items}
      maxItems={20}
      emptyMsg="Nenhum item pronto para iniciar."
      onOpen={onOpenItem}
      onViewAll={() => onNav('list')}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

export function TestingWidget({ onNav, onOpenItem }: WidgetCtx) {
  const items = getTestingItems()
  return (
    <WorkQueue
      title={`Aguardando teste (${items.length})`}
      items={items}
      maxItems={20}
      emptyMsg="Nada aguardando validação de QA."
      onOpen={onOpenItem}
      onViewAll={() => onNav('list')}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

export function BacklogAlertWidget({ onNav, onOpenItem }: WidgetCtx) {
  const items = getBacklogWithAlerts()
  return (
    <WorkQueue
      title={`Backlog com alerta (${items.length})`}
      items={items}
      maxItems={20}
      emptyMsg="Backlog sem itens em alerta."
      onOpen={onOpenItem}
      onViewAll={() => onNav('list')}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

export function MyQueueWidget({ onNav, onOpenItem, userName }: WidgetCtx) {
  const mine = liveItems().filter(w => w.assignee?.name === userName && w.status !== 'done')
  return (
    <WorkQueue
      title={`Minha fila (${mine.length})`}
      items={mine}
      maxItems={20}
      emptyMsg="Você não tem demandas abertas atribuídas."
      onOpen={onOpenItem}
      onViewAll={() => onNav('list')}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

// ─── Sprint ───────────────────────────────────────────────────────────────────

export function SprintWidget({ onNav, onOpenItem }: WidgetCtx) {
  const sprintName = liveCurrentSprintName()
  const items = sprintName ? getSprintItems(sprintName) : []
  if (!sprintName || items.length === 0) {
    return <EmptyState message="Nenhuma sprint ativa no escopo selecionado." action={{ label: 'Ver projetos', onClick: () => onNav('projects') }} />
  }
  const done = items.filter(i => i.status === 'done').length
  return (
    <SprintDonutCard
      sprintName={sprintName}
      done={done}
      total={items.length}
      items={items}
      onOpen={onOpenItem}
      onViewSprint={() => onNav('project')}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export function KpiBlockedWidget({ onNav }: WidgetCtx) {
  const n = getBlockedItems().length
  return (
    <KpiCard
      value={String(n)} label="Itens bloqueados"
      sub={n > 0 ? 'Precisam de desbloqueio' : 'Nenhum impedimento'}
      color={n > 0 ? T.crit : T.success} alert={n > 0}
      onClick={() => onNav('list')}
    />
  )
}

export function KpiWipWidget({ onNav }: WidgetCtx) {
  const wip = liveItems().filter(w => ['in-progress', 'in-review', 'testing'].includes(w.status)).length
  return (
    <KpiCard value={String(wip)} label="Trabalho em andamento" sub="Em progresso, revisão ou teste" color={T.accent} onClick={() => onNav('list')} />
  )
}

export function KpiSprintProgressWidget({ onNav }: WidgetCtx) {
  const sprintName = liveCurrentSprintName()
  const items = sprintName ? getSprintItems(sprintName) : []
  const done = items.filter(i => i.status === 'done').length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : null
  return (
    <KpiCard
      value={pct === null ? '—' : `${pct}%`}
      label="Progresso da sprint"
      sub={sprintName ?? 'Sem sprint ativa'}
      color={T.success}
      onClick={() => onNav('project')}
    />
  )
}

export function KpiProjectsWidget({ onNav }: WidgetCtx) {
  const projects = liveProjects()
  const atRisk = (liveAggregates()?.rag ?? []).filter(p => p.rag !== 'healthy').length
  return (
    <KpiCard
      value={String(projects.length)} label="Projetos no escopo"
      sub={atRisk > 0 ? `${atRisk} em risco ou bloqueado` : 'Todos saudáveis'}
      color={atRisk > 0 ? T.warn : T.success}
      onClick={() => onNav('projects')}
    />
  )
}

export function KpiDeliveredWidget({ onNav }: WidgetCtx) {
  const agg = liveAggregates()
  const done = liveItems().filter(w => w.status === 'done').length
  return (
    <KpiCard
      value={String(done)} label="Entregues"
      sub={agg ? 'Total no escopo atual' : 'Sem dados'}
      color={T.success}
      onClick={() => onNav('reports')}
    />
  )
}

// ─── Projects (RAG) ───────────────────────────────────────────────────────────

export function ProjectsRagWidget({ onNav }: WidgetCtx) {
  const projects = liveAggregates()?.rag ?? []
  if (projects.length === 0) {
    return <EmptyState message="Nenhum projeto no seu escopo." action={{ label: 'Ver projetos', onClick: () => onNav('projects') }} />
  }
  return (
    <Scroll>
      {projects.map(p => (
        <RagCard
          key={p.id}
          name={p.name}
          squad={p.squad}
          rag={p.rag}
          pct={p.pct}
          daysLabel={`${p.done}/${p.total} itens`}
          reason={p.reason}
          onClick={() => onNav('project', p.id)}
        />
      ))}
    </Scroll>
  )
}
