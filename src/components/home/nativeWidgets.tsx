/**
 * Altech — Native Home widgets.
 * Each card of the Início screen extracted into a standalone component so it can
 * be registered in the widget catalog (src/data/homeWidgets.tsx) and rendered
 * inside the draggable/resizable grid. All data comes from the live Supabase
 * dashboard store (src/data/db/homeLive.ts) — no mocks.
 */
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import {
  KpiCard, RagCard, WorkQueue, SprintDonutCard, EmptyState,
  MiniBarChart, MiniSparkline,
  type WorkItem,
} from '@/components/ds/DashboardKit'
import { BurndownChart } from '@/data/reportRegistry'
import {
  liveItems, liveProjects, liveAggregates, liveCurrentSprintName,
  getBlockedItems, getSprintItems, getReadyItems, getTestingItems, getBacklogWithAlerts,
} from '@/data/db/homeLive'
import {
  fetchAdminKpis, fetchPoCardMetrics, computeDeliveryMetrics,
  type AdminKpis, type PoCardMetrics,
} from '@/data/db/dashboards'
import { logger } from '@/utils/logger'
import { setListPrefilter } from '@/data/listPrefilter'

export interface WidgetCtx {
  /** Navigates to another screen of the app (optionally focusing an entity). */
  onNav: (view: string, targetId?: string) => void
  /** Opens the shared work item drawer with the clicked item. */
  onOpenItem: (item: WorkItem) => void
  /** Name of the logged user — used by the personal queues. */
  userName: string
  /** Projetos selecionados no filtro do board (vazio = todos). */
  projectIds: ReadonlySet<string>
  /** Abre o board (Kanban) — direto no projeto quando há exatamente 1 no filtro. */
  openBoard: () => void
  /** Abre o detalhe ampliado (modal) de um relatório, sem trocar de tela. */
  openDetail: (reportId: string) => void
  /** false durante edição do painel: widgets devem ignorar cliques de navegação. */
  interactive: boolean
}

/** Helpers que respeitam o modo edição (interactive = false). */
function doNav(ctx: WidgetCtx, view: string, targetId?: string) {
  if (!ctx.interactive) return
  ctx.onNav(view, targetId)
}
/** Abre a Lista com o escopo da Início (1 projeto → filtra o projeto) e um status opcional. */
function doOpenScopedList(ctx: WidgetCtx, status?: string) {
  if (!ctx.interactive) return
  const ids = [...ctx.projectIds]
  setListPrefilter(ids.length === 1 ? { projectId: ids[0], status } : { status })
  ctx.onNav('list')
}
function doOpenBoard(ctx: WidgetCtx) {
  if (!ctx.interactive) return
  ctx.openBoard()
}
function doOpenDetail(ctx: WidgetCtx, reportId: string) {
  if (!ctx.interactive) return
  ctx.openDetail(reportId)
}
function doOpenItem(ctx: WidgetCtx, item: WorkItem) {
  if (!ctx.interactive) return
  ctx.onOpenItem(item)
}

/**
 * Espelhado num módulo para que todos os widgets nativos leiam o mesmo recorte
 * sem precisar propagar props em cada helper do homeLive.
 */
let WIDGET_SCOPE: ReadonlySet<string> = new Set<string>()

export function setWidgetScope(ids: ReadonlySet<string>): void {
  WIDGET_SCOPE = ids
}

export function scopedItems<I extends { project_id?: string }>(items: I[]): I[] {
  return WIDGET_SCOPE.size === 0 ? items : items.filter(i => WIDGET_SCOPE.has(i.project_id ?? ''))
}

export function scopedProjects<P extends { id: string }>(projects: P[]): P[] {
  return WIDGET_SCOPE.size === 0 ? projects : projects.filter(p => WIDGET_SCOPE.has(p.id))
}

function scopedDelivery<R extends { projectId?: string | null }>(rows: R[]): R[] {
  return WIDGET_SCOPE.size === 0 ? rows : rows.filter(r => WIDGET_SCOPE.has(r.projectId ?? ''))
}

/** Contagem tenant-wide quando não há recorte; valor recalculado quando há. */
function scopedOr(total: number, scopedValue: number): number {
  return WIDGET_SCOPE.size === 0 ? total : scopedValue
}

function scopeIds(): string[] {
  return [...WIDGET_SCOPE]
}

function Scroll({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
}

/**
 * Medidor horizontal de proporção — substitui o donut antigo.
 * Ocupa a largura do card e ancora na base; o rótulo % dá leitura imediata.
 */
function ratioViz(part: number, total: number, color: string) {
  const pct = total > 0 ? Math.round((part / total) * 100) : 0
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 6, background: T.bgSurface2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.text2, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ─── Queues ───────────────────────────────────────────────────────────────────

export function BlockedWidget(props: WidgetCtx) {
  const { openBoard, onOpenItem } = props
  const ctx = props
  const items = scopedItems(getBlockedItems())
  return (
    <WorkQueue
      title={`Bloqueados (${items.length})`}
      items={items}
      showDaysBlocked
      maxItems={20}
      emptyMsg="Nenhum item bloqueado no seu escopo."
      onOpen={item => doOpenItem(ctx, item)}
      onViewAll={() => doOpenBoard(ctx)}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

export function ReadyWidget(props: WidgetCtx) {
  const { openBoard, onOpenItem } = props
  const ctx = props
  const items = scopedItems(getReadyItems())
  return (
    <WorkQueue
      title={`Prontos para desenvolvimento (${items.length})`}
      items={items}
      maxItems={20}
      emptyMsg="Nenhum item pronto para iniciar."
      onOpen={item => doOpenItem(ctx, item)}
      onViewAll={() => doOpenBoard(ctx)}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

export function TestingWidget(props: WidgetCtx) {
  const { openBoard, onOpenItem } = props
  const ctx = props
  const items = scopedItems(getTestingItems())
  return (
    <WorkQueue
      title={`Aguardando teste (${items.length})`}
      items={items}
      maxItems={20}
      emptyMsg="Nada aguardando validação de QA."
      onOpen={item => doOpenItem(ctx, item)}
      onViewAll={() => doOpenBoard(ctx)}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

export function BacklogAlertWidget(props: WidgetCtx) {
  const { openBoard, onOpenItem } = props
  const ctx = props
  const items = scopedItems(getBacklogWithAlerts())
  return (
    <WorkQueue
      title={`Backlog com alerta (${items.length})`}
      items={items}
      maxItems={20}
      emptyMsg="Backlog sem itens em alerta."
      onOpen={item => doOpenItem(ctx, item)}
      onViewAll={() => doOpenBoard(ctx)}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

export function MyQueueWidget(props: WidgetCtx) {
  const { openBoard, onOpenItem, userName } = props
  const ctx = props
  const mine = scopedItems(liveItems()).filter(w => w.assignee?.name === userName && w.status !== 'done')
  return (
    <WorkQueue
      title={`Minha fila (${mine.length})`}
      items={mine}
      maxItems={20}
      emptyMsg="Você não tem demandas abertas atribuídas."
      onOpen={item => doOpenItem(ctx, item)}
      onViewAll={() => doOpenBoard(ctx)}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

/** Itens em revisão / bugs — gargalos técnicos do painel do Tech Lead. */
export function ReviewQueueWidget(props: WidgetCtx) {
  const { openBoard, onOpenItem } = props
  const ctx = props
  const items = scopedItems(liveItems()).filter(w => w.status === 'in-review' || w.type === 'bug')
  return (
    <WorkQueue
      title={`Gargalos de PRs / Issues em revisão (${items.length})`}
      items={items}
      maxItems={20}
      emptyMsg="Nenhum gargalo no momento."
      onOpen={item => doOpenItem(ctx, item)}
      onViewAll={() => doOpenBoard(ctx)}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

/** Fila de design ativa — painel de UX/UI. */
export function DesignQueueWidget(props: WidgetCtx) {
  const { openBoard, onOpenItem } = props
  const ctx = props
  const items = scopedItems(liveItems()).filter(w =>
    w.squad_id === 'squad_design' || (w.tags ?? []).some(t => ['design', 'handoff', 'frontend'].includes(t))
  )
  return (
    <WorkQueue
      title={`Fila de design ativa (${items.length})`}
      items={items}
      maxItems={20}
      emptyMsg="Fila de design vazia."
      onOpen={item => doOpenItem(ctx, item)}
      onViewAll={() => doOpenBoard(ctx)}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

// ─── Sprint ───────────────────────────────────────────────────────────────────

export function SprintWidget(props: WidgetCtx) {
  const { openBoard, onOpenItem } = props
  const ctx = props
  const sprintName = liveCurrentSprintName()
  const items = sprintName ? scopedItems(getSprintItems(sprintName)) : []
  if (!sprintName || items.length === 0) {
    return <EmptyState message="Nenhuma sprint ativa no escopo selecionado." action={{ label: 'Ver board', onClick: () => doOpenBoard(ctx) }} />
  }
  const done = items.filter(i => i.status === 'done').length
  return (
    <SprintDonutCard
      sprintName={sprintName}
      done={done}
      total={items.length}
      items={items}
      onOpen={item => doOpenItem(ctx, item)}
      onViewSprint={() => doOpenBoard(ctx)}
      style={{ border: 'none', background: 'transparent' }}
    />
  )
}

// ─── KPIs genéricos ───────────────────────────────────────────────────────────

export function KpiBlockedWidget(props: WidgetCtx) {
  const { openBoard } = props
  const ctx = props
  const n = scopedItems(getBlockedItems()).length
  const total = scopedItems(liveItems()).length
  return (
    <KpiCard
      value={String(n)} label="Itens bloqueados"
      sub={n > 0 ? 'Precisam de desbloqueio' : 'Nenhum impedimento'}
      color={n > 0 ? T.crit : T.success} alert={n > 0}
      miniViz={ratioViz(n, total, n > 0 ? T.crit : T.success)}
      onClick={() => doOpenScopedList(ctx, 'blocked')}
    />
  )
}

export function KpiWipWidget(props: WidgetCtx) {
  const { openBoard } = props
  const ctx = props
  const all = scopedItems(liveItems())
  const wip = all.filter(w => ['in-progress', 'in-review', 'testing'].includes(w.status)).length
  return (
    <KpiCard
      value={String(wip)} label="Trabalho em andamento" sub="Em progresso, revisão ou teste"
      color={T.accent}
      miniViz={ratioViz(wip, all.length, T.accent)}
      onClick={() => doOpenBoard(ctx)}
    />
  )
}

export function KpiSprintProgressWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  const sprintName = liveCurrentSprintName()
  const items = sprintName ? scopedItems(getSprintItems(sprintName)) : []
  const done = items.filter(i => i.status === 'done').length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : null
  return (
    <KpiCard
      value={pct === null ? '—' : `${pct}%`}
      label="Progresso da sprint"
      sub={sprintName ?? 'Sem sprint ativa'}
      color={T.success}
      miniViz={<BurndownChart variant="thumbnail" />}
      onClick={() => doOpenDetail(ctx, 'burndown')}
    />
  )
}

export function KpiProjectsWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const projects = scopedProjects(liveProjects())
  const rag = scopedProjects(liveAggregates()?.rag ?? [])
  const atRisk = rag.filter(p => p.rag !== 'healthy').length
  return (
    <KpiCard
      value={String(projects.length)} label="Projetos no escopo"
      sub={atRisk > 0 ? `${atRisk} em risco ou bloqueado` : 'Todos saudáveis'}
      color={atRisk > 0 ? T.warn : T.success}
      miniViz={ratioViz(rag.length - atRisk, rag.length, atRisk > 0 ? T.warn : T.success)}
      onClick={() => doNav(ctx, 'projects')}
    />
  )
}

export function KpiDeliveredWidget(props: WidgetCtx) {
  const ctx = props
  const agg = liveAggregates()
  const all = scopedItems(liveItems())
  const done = all.filter(w => w.status === 'done').length
  // Abre a Lista filtrada pelos projetos do escopo da Início + status Concluído.
  function openDeliveredList() {
    const ids = [...ctx.projectIds]
    setListPrefilter(ids.length === 1 ? { projectId: ids[0], status: 'done' } : { status: 'done' })
    doNav(ctx, 'list')
  }
  return (
    <KpiCard
      value={String(done)} label="Entregues"
      sub={agg ? 'Total no escopo atual' : 'Sem dados'}
      color={T.success}
      miniViz={ratioViz(done, all.length, T.success)}
      onClick={openDeliveredList}
    />
  )
}

// ─── KPIs · Admin Master ──────────────────────────────────────────────────────

function useAdminKpis(): AdminKpis | null {
  const [kpis, setKpis] = useState<AdminKpis | null>(null)
  useEffect(() => {
    let alive = true
    fetchAdminKpis()
      .then(k => { if (alive) setKpis(k) })
      .catch(err => { logger.error('home.admin-kpis', err) })
    return () => { alive = false }
  }, [])
  return kpis
}

export function KpiAdminProjectsWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const k = useAdminKpis()
  return (
    <KpiCard
      value={k ? String(k.projects.total) : '—'} label="Projetos"
      sub={k ? `${k.projects.active} ativo${k.projects.active !== 1 ? 's' : ''}` : 'carregando…'}
      disclaimer="projetos do tenant (não arquivados)"
      miniViz={k ? ratioViz(k.projects.active, k.projects.total, T.accent) : undefined}
      onClick={() => doNav(ctx, 'projects-list')}
    />
  )
}

export function KpiAdminBoardsWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const k = useAdminKpis()
  return (
    <KpiCard
      value={k ? String(k.boards.total) : '—'} label="Boards"
      sub={k ? `${k.boards.active} ativo${k.boards.active !== 1 ? 's' : ''}` : 'carregando…'}
      disclaimer="boards de Kanban do tenant"
      miniViz={k ? ratioViz(k.boards.active, k.boards.total, T.indigo) : undefined}
      onClick={() => doNav(ctx, 'boards-list')}
    />
  )
}

export function KpiAdminModulesWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const k = useAdminKpis()
  return (
    <KpiCard
      value={k ? String(k.modules.active) : '—'} label="Módulos ativos"
      sub={k ? `de ${k.modules.total}` : 'carregando…'}
      disclaimer="módulos habilitados para este tenant"
      miniViz={k ? ratioViz(k.modules.active, k.modules.total, T.purple) : undefined}
      onClick={() => doNav(ctx, 'modules')}
    />
  )
}

export function KpiAdminUsersWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const k = useAdminKpis()
  return (
    <KpiCard
      value={k ? String(k.users.total) : '—'} label="Usuários"
      sub={k ? `${k.users.active} ativo${k.users.active !== 1 ? 's' : ''}${k.users.blocked ? ` · ${k.users.blocked} bloqueado(s)` : ''}` : 'carregando…'}
      disclaimer="perfis registrados no tenant"
      miniViz={k ? ratioViz(k.users.active, k.users.total, T.success) : undefined}
      onClick={() => doNav(ctx, 'team:membros')}
    />
  )
}

export function KpiAdminInvitesWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const k = useAdminKpis()
  const sub = k == null
    ? '—'
    : k.invites.pending === 0
      ? 'nenhum pendente'
      : k.invites.nextExpiryDays == null
        ? `${k.invites.pending} pendente${k.invites.pending !== 1 ? 's' : ''}`
        : k.invites.nextExpiryDays <= 0 ? 'expira hoje' : `expira em ${k.invites.nextExpiryDays}d`
  return (
    <KpiCard
      value={k ? String(k.invites.pending) : '—'} label="Convites"
      sub={sub} disclaimer="convites pendentes de aceitação"
      color={k && k.invites.pending > 0 ? T.warn : undefined}
      alert={!!k && k.invites.pending > 0}
      miniViz={k ? ratioViz(k.invites.pending, Math.max(k.users.total, 1), T.warn) : undefined}
      onClick={() => doNav(ctx, 'team:convites')}
    />
  )
}

// ─── KPIs · PMO ───────────────────────────────────────────────────────────────

export function KpiPmoActiveProjectsWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const agg = liveAggregates()
  const rags = scopedProjects(agg?.rag ?? [])
  const healthy = rags.filter(r => r.rag === 'healthy').length
  return (
    <KpiCard
      value={String(scopedOr(agg?.counts?.activeProjects ?? 0, rags.length))} label="Projetos Ativos"
      sub={`${healthy} no prazo`} disclaimer="projetos ativos no tenant"
      miniViz={ratioViz(healthy, rags.length, T.success)}
      onClick={() => doNav(ctx, 'projects-list')}
    />
  )
}

export function KpiPmoAtRiskWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const agg = liveAggregates()
  const rags = scopedProjects(agg?.rag ?? [])
  const atRisk = scopedOr(agg?.counts?.atRisk ?? 0, rags.filter(r => r.rag !== 'healthy').length)
  const blocked = rags.filter(r => r.rag === 'blocked').length
  return (
    <KpiCard
      value={String(atRisk)} label="Em Risco / Atrasados"
      sub={`${blocked} crítico(s)`} disclaimer="projetos com RAG amarelo ou vermelho"
      color={T.warn} alert={atRisk > 0}
      miniViz={ratioViz(atRisk, rags.length, T.warn)}
      onClick={() => doNav(ctx, 'projects-list')}
    />
  )
}

export function KpiPredictabilityWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  const agg = liveAggregates()
  const pct = agg?.predictability ?? 0
  return (
    <KpiCard
      value={`${pct}%`} label="Previsibilidade"
      help="Percentual do planejado que foi efetivamente entregue."
      sub="meta: 80%" disclaimer="% do planejado efetivamente entregue"
      color={pct < 80 ? T.warn : T.success} alert={pct < 80}
      miniViz={ratioViz(pct, 100, pct < 80 ? T.warn : T.success)}
      onClick={() => doOpenDetail(ctx, 'velocity')}
    />
  )
}

export function KpiPlannedVsDoneWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  const agg = liveAggregates()
  const pct = agg?.consolidatedPct ?? 0
  return (
    <KpiCard
      value={`${pct}%`} label="Planejado × Concluído"
      sub={`${agg?.done ?? 0}/${agg?.planned ?? 0} itens`}
      disclaimer="itens concluídos sobre o total planejado"
      miniViz={ratioViz(pct, 100, T.accent)}
      onClick={() => doOpenDetail(ctx, 'velocity')}
    />
  )
}

// ─── KPIs · Project Manager ───────────────────────────────────────────────────

export function KpiPmProgressWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const sprint = scopedItems(getSprintItems(liveCurrentSprintName() ?? undefined))
  const done = sprint.filter(w => w.status === 'done').length
  const total = sprint.length || 1
  return (
    <KpiCard
      value={`${Math.round((done / total) * 100)}%`} label="Progresso do Projeto"
      help="Velocity = pontos concluídos por sprint. Burndown = pontos restantes ao longo da sprint."
      sub={`${done}/${sprint.length} itens concluídos`}
      disclaimer="% de tarefas concluídas na sprint ativa"
      miniViz={<BurndownChart variant="thumbnail" />}
      onClick={() => doNav(ctx, 'project')}
    />
  )
}

export function KpiPmDeadlineWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const rag = (scopedProjects(liveAggregates()?.rag ?? []))[0]
  return (
    <KpiCard
      value={rag?.daysLabel ?? '—'} label="Prazo Restante"
      sub={rag?.periodEnd ? `Entrega: ${rag.periodEnd}` : 'sem data definida'}
      disclaimer="dias até a data de entrega planejada"
      miniViz={rag ? ratioViz(rag.pct, 100, T.accent) : undefined}
      onClick={() => doNav(ctx, 'gantt')}
    />
  )
}

// ─── KPIs · Product Manager (métricas de produto do painel original) ──────────

export function KpiMauWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  return (
    <KpiCard
      value="930" label="MAU" sub="+8% vs mês ant."
      disclaimer="usuários únicos ativos nos últimos 30 dias" color={T.success}
      miniViz={<MiniSparkline data={[{ label: 'Jan', value: 720 }, { value: 750 }, { value: 800 }, { value: 860 }, { value: 900 }, { label: 'Jun', value: 930 }]} color="#34d399" />}
      onClick={() => doOpenDetail(ctx, 'health')}
    />
  )
}

export function KpiStickinessWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  return (
    <KpiCard
      value="7.5%" label="Stickiness" sub="DAU/MAU — meta 10-20%"
      disclaimer="frequência de uso: ativos diários ÷ mensais" color={T.warn}
      miniViz={<MiniSparkline data={[{ label: 'Jan', value: 6.1 }, { value: 6.4 }, { value: 6.8 }, { value: 7.0 }, { value: 7.2 }, { label: 'Jun', value: 7.5 }]} color="#f5a524" />}
      onClick={() => doOpenDetail(ctx, 'health')}
    />
  )
}

export function KpiChurnWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  return (
    <KpiCard
      value="3.2%" label="Churn Rate" sub="meta: <2%"
      disclaimer="taxa de abandono por tenant — sem impacto billing" color={T.crit} alert
      miniViz={<MiniSparkline data={[{ label: 'Jan', value: 2.8 }, { value: 2.9 }, { value: 3.0 }, { value: 3.1 }, { value: 3.2 }, { label: 'Jun', value: 3.2 }]} color="#ef4444" />}
      onClick={() => doOpenDetail(ctx, 'health')}
    />
  )
}

export function KpiAdoptionWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  return (
    <KpiCard
      value="52%" label="Adoção de Features" sub="base elegível"
      disclaimer="% médio de adoção sobre base elegível por feature"
      miniViz={<MiniBarChart data={[{ label: 'Jan', value: 38 }, { label: 'Feb', value: 42 }, { label: 'Mar', value: 46 }, { label: 'Abr', value: 49 }, { label: 'Mai', value: 51 }, { label: 'Jun', value: 52, current: true }]} />}
      onClick={() => doOpenDetail(ctx, 'health')}
    />
  )
}

// ─── KPIs · Product Owner ─────────────────────────────────────────────────────

function usePoMetrics(): PoCardMetrics | null {
  const [m, setM] = useState<PoCardMetrics | null>(null)
  const ids = scopeIds().join(',')
  useEffect(() => {
    let alive = true
    fetchPoCardMetrics(ids ? ids.split(',') : [])
      .then(v => { if (alive) setM(v) })
      .catch(err => { logger.error('home.po-metrics', err) })
    return () => { alive = false }
  }, [ids])
  return m
}

export function KpiPoReadyWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const sprintPts = scopedItems(getSprintItems(liveCurrentSprintName() ?? undefined)).reduce((s, w) => s + (w.points ?? 0), 0)
  const readyPts = scopedItems(getReadyItems()).reduce((s, w) => s + (w.points ?? 0), 0)
  const pct = sprintPts > 0 ? Math.round((readyPts / sprintPts) * 100) : null
  return (
    <KpiCard
      value={pct != null ? `${pct}%` : '—'} label="Cobertura Ready"
      sub={sprintPts > 0 ? 'pts prontos ÷ velocity' : 'sem sprint ativa'}
      disclaimer="pontos prontos ÷ velocidade média da sprint"
      miniViz={ratioViz(pct ?? 0, 100, T.accent)}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

export function KpiBacklogHealthWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const backlog = scopedItems(getBacklogWithAlerts())
  const healthy = backlog.filter(w => !w.tags?.some(t => t.startsWith('Sem '))).length
  const pct = backlog.length > 0 ? Math.round((healthy / backlog.length) * 100) : 100
  return (
    <KpiCard
      value={`${pct}%`} label="Saúde do Backlog" sub="itens saudáveis ÷ avaliáveis"
      disclaimer="itens saudáveis ÷ total de itens avaliáveis"
      color={pct < 60 ? T.warn : T.success} alert={pct < 60}
      miniViz={ratioViz(pct, 100, pct < 60 ? T.warn : T.success)}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

export function KpiCreatedVsFinalizedWidget(props: WidgetCtx) {
  const { openBoard } = props
  const ctx = props
  const m = usePoMetrics()
  return (
    <KpiCard
      value={m ? `${m.createdVsFinalized.finalized}/${m.createdVsFinalized.created}` : '—'}
      label="Criado vs Finalizado" sub="finalizados ÷ criados"
      disclaimer="itens finalizados vs criados no(s) projeto(s) selecionado(s)"
      color={T.success}
      miniViz={<MiniBarChart data={m?.createdVsFinalized.weekly ?? []} showAvg={false} />}
      onClick={() => doOpenBoard(ctx)}
    />
  )
}

export function KpiReleasesHealthWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const m = usePoMetrics()
  return (
    <KpiCard
      value={m ? `${m.releasesHealth.healthPct}%` : '—'} label="Saúde das Releases"
      sub={m ? `${m.releasesHealth.activeCount} ativas${m.releasesHealth.overdue ? ' · atrasada' : ''}` : 'sem releases ativas'}
      disclaimer="conclusão média das releases ativas (itens concluídos ÷ vinculados)"
      color={m?.releasesHealth.overdue ? T.warn : (m && m.releasesHealth.healthPct >= 70 ? T.success : T.warn)}
      alert={m?.releasesHealth.overdue ?? false}
      miniViz={<MiniBarChart data={m?.releasesHealth.perRelease ?? []} showAvg={false} />}
      onClick={() => doNav(ctx, 'releases')}
    />
  )
}

// ─── KPIs · Scrum Master ──────────────────────────────────────────────────────

export function KpiSprintHealthWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  const sprint = scopedItems(getSprintItems(liveCurrentSprintName() ?? undefined))
  const parados = sprint.filter(w => w.status === 'blocked' || (w.days_blocked ?? 0) >= 2)
  const active = sprint.length > 0
  const health = active ? Math.round(((sprint.length - parados.length) / sprint.length) * 100) : null
  return (
    <KpiCard
      value={health != null ? `${health}%` : '—'} label="Saúde da Sprint"
      help="Velocity = pontos concluídos por sprint. Burndown = pontos restantes ao longo da sprint."
      sub={active ? `${parados.length} parados` : 'Sem sprint ativa'}
      disclaimer="% de conclusão em relação à meta da sprint"
      color={health != null && health < 60 ? T.warn : T.success}
      alert={health != null && health < 60}
      miniViz={active ? <BurndownChart variant="thumbnail" /> : undefined}
      onClick={() => doOpenDetail(ctx, 'burndown')}
    />
  )
}

export function KpiImpedimentsWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const blocked = scopedItems(getBlockedItems())
  return (
    <KpiCard
      value={String(blocked.length)} label="Impedimentos" sub="ativos"
      disclaimer="impedimentos formais sem resolução registrada"
      color={T.crit} alert={blocked.length > 0}
      miniViz={ratioViz(blocked.length, scopedItems(liveItems()).length, T.crit)}
      onClick={() => doOpenScopedList(ctx, 'blocked')}
    />
  )
}

export function KpiSprintGoalWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const sprint = scopedItems(getSprintItems(liveCurrentSprintName() ?? undefined))
  const critical = sprint.filter(w => w.status === 'blocked' || w.priority === 'critical' || w.priority === 'high')
  const active = sprint.length > 0
  return (
    <KpiCard
      value={active ? String(critical.length) : '—'} label="Sprint Goal"
      help="Objetivo único que norteia a prioridade da sprint."
      sub={active ? 'itens críticos/parados na sprint' : 'Sem sprint ativa'}
      disclaimer="itens que ameaçam atingir o objetivo da sprint"
      color={critical.length > 0 ? T.warn : T.success} alert={critical.length > 0}
      miniViz={ratioViz(critical.length, sprint.length, T.warn)}
      onClick={() => doNav(ctx, 'project')}
    />
  )
}

// ─── KPIs · Tech Lead ─────────────────────────────────────────────────────────

const nf = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function deliveryMetrics() {
  return computeDeliveryMetrics(scopedDelivery(liveAggregates()?.deliveryRows ?? []))
}

/** Série de demandas concluídas por semana (últimas 6 semanas) para o card Vazão. */
function weeklyThroughput(): { label: string; value: number; current?: boolean }[] {
  const rows = scopedDelivery(liveAggregates()?.deliveryRows ?? [])
  const WEEK = 7 * 86400000
  const now = Date.now()
  const labels = ['S-5', 'S-4', 'S-3', 'S-2', 'S-1', 'Atual']
  return [5, 4, 3, 2, 1, 0].map((back, i) => {
    const end = now - back * WEEK
    const start = end - WEEK
    const value = rows.filter(r => {
      if (r.status !== 'done' || !r.completedAt) return false
      const t = new Date(r.completedAt).getTime()
      return !Number.isNaN(t) && t > start && t <= end
    }).length
    return { label: labels[i], value, ...(back === 0 ? { current: true } : {}) }
  })
}

export function KpiCriticalBugsWidget(props: WidgetCtx) {
  const { openBoard } = props
  const ctx = props
  const all = scopedItems(liveItems())
  const bugs = all.filter(w => w.type === 'bug' && (w.priority === 'critical' || w.priority === 'high')).length
  return (
    <KpiCard
      value={String(bugs)} label="Bugs Críticos" sub={bugs > 0 ? 'requer atenção' : 'tudo ok'}
      disclaimer="bugs P0/P1 bloqueando entrega ou em produção"
      color={T.crit} alert={bugs > 0}
      miniViz={ratioViz(bugs, all.filter(w => w.type === 'bug').length, T.crit)}
      onClick={() => doOpenBoard(ctx)}
    />
  )
}

export function KpiLeadTimeWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  const dm = deliveryMetrics()
  return (
    <KpiCard
      value={dm.leadTimeDias != null ? `${nf(dm.leadTimeDias)}d` : '—'} label="Lead Time"
      sub="início → conclusão" disclaimer="tempo médio do início da demanda até a conclusão"
      color={dm.leadTimeDias != null && dm.leadTimeDias > 14 ? T.warn : undefined}
      alert={dm.leadTimeDias != null && dm.leadTimeDias > 14}
      miniViz={ratioViz(Math.min(dm.leadTimeDias ?? 0, 30), 30, dm.leadTimeDias != null && dm.leadTimeDias > 14 ? T.warn : T.accent)}
      onClick={() => doOpenDetail(ctx, 'leadtime')}
    />
  )
}

export function KpiThroughputWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  const dm = deliveryMetrics()
  return (
    <KpiCard
      value={dm.vazaoSemana != null ? `${nf(dm.vazaoSemana)}/sem` : '—'} label="Vazão"
      sub="Concluídos por semana" disclaimer="demandas concluídas por semana no escopo"
      alert={dm.vazaoSemana != null && dm.vazaoSemana < 1}
      miniViz={<MiniBarChart data={weeklyThroughput()} />}
      onClick={() => doOpenDetail(ctx, 'velocity')}
    />
  )
}

export function KpiReworkWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  const dm = deliveryMetrics()
  return (
    <KpiCard
      value={dm.taxaBugsPct != null ? `${nf(dm.taxaBugsPct)}%` : '—'} label="% Retrabalho"
      sub="demandas que são correção" disclaimer="proporção de demandas que são correção"
      color={dm.taxaBugsPct != null && dm.taxaBugsPct > 20 ? T.warn : undefined}
      alert={dm.taxaBugsPct != null && dm.taxaBugsPct > 20}
      miniViz={ratioViz(dm.taxaBugsPct ?? 0, 100, dm.taxaBugsPct != null && dm.taxaBugsPct > 20 ? T.warn : T.accent)}
      onClick={() => doOpenDetail(ctx, 'leadtime')}
    />
  )
}

// ─── KPIs · Dev ───────────────────────────────────────────────────────────────

export function KpiMyItemsWidget(props: WidgetCtx) {
  const { onNav, userName } = props
  const ctx = props
  const mine = scopedItems(liveItems()).filter(w => w.assignee?.name === userName)
  const blocked = mine.filter(w => w.status === 'blocked').length
  const done = mine.filter(w => w.status === 'done').length
  return (
    <KpiCard
      value={String(mine.length)} label="Meus Itens Ativos"
      sub={`${blocked} bloqueado${blocked !== 1 ? 's' : ''}`}
      disclaimer="tarefas atribuídas a mim nesta sprint"
      miniViz={ratioViz(done, mine.length, T.accent)}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

export function KpiMyLateWidget(props: WidgetCtx) {
  const { onNav, userName } = props
  const ctx = props
  const today = new Date().toISOString().slice(0, 10)
  const mine = scopedItems(liveItems()).filter(w => w.assignee?.name === userName)
  const late = mine.filter(w => w.due_date && w.due_date <= today && w.status !== 'done')
  return (
    <KpiCard
      value={String(late.length)} label="Atrasados"
      sub={late.length ? 'prazo vencido ou hoje' : 'nenhum atrasado'}
      disclaimer="itens com prazo hoje ou já vencido"
      color={late.length ? T.crit : undefined} alert={late.length > 0}
      miniViz={ratioViz(late.length, mine.length, T.crit)}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

export function KpiMyBlockedWidget(props: WidgetCtx) {
  const { onNav, userName } = props
  const ctx = props
  const mine = scopedItems(liveItems()).filter(w => w.assignee?.name === userName)
  const blocked = scopedItems(getBlockedItems()).filter(w => w.assignee?.name === userName)
  return (
    <KpiCard
      value={String(blocked.length)} label="Meus Bloqueados" sub="aguardando desbloqueio"
      disclaimer="minhas tarefas aguardando desbloqueio externo"
      color={T.warn} alert={blocked.length > 0}
      miniViz={ratioViz(blocked.length, mine.length, T.warn)}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

// ─── KPIs · UX/UI (mesmos thumbnails do painel original) ──────────────────────

export function KpiUxFlowsWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  return (
    <KpiCard
      value="8" label="Fluxos em Design" sub="3 projetos"
      disclaimer="fluxos com trabalho de design em progresso"
      miniViz={<MiniBarChart data={[{ label: 'S10', value: 5 }, { label: 'S11', value: 7 }, { label: 'S12', value: 6 }, { label: 'S13', value: 8, current: true }]} showAvg={false} />}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

export function KpiUxPrototypesWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  return (
    <KpiCard
      value="3" label="Protótipos p/ Val." sub="aguardando PO/usuário"
      disclaimer="protótipos aguardando feedback de usuário ou PO" color={T.accent}
      miniViz={<MiniSparkline data={[{ label: 'S10', value: 1 }, { value: 2 }, { value: 4 }, { label: 'S13', value: 3 }]} color="#3b82f6" />}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

export function KpiUxPendingWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  return (
    <KpiCard
      value="4" label="Pendências Críticas" sub="1 acessibilidade"
      disclaimer="fluxos sem spec, protótipo ou validação completa" color={T.crit} alert
      miniViz={<MiniSparkline data={[{ label: 'S10', value: 6 }, { value: 5 }, { value: 5 }, { label: 'S13', value: 4 }]} color="#ef4444" />}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

export function KpiUxHandoffWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  return (
    <KpiCard
      value="1" label="Handoff Pronto" sub="Dashboard por Papel"
      disclaimer="entregas de design prontas para implementação" color={T.success}
      miniViz={<MiniBarChart data={[{ label: 'S10', value: 0 }, { label: 'S11', value: 2 }, { label: 'S12', value: 1 }, { label: 'S13', value: 1, current: true }]} showAvg={false} />}
      onClick={() => doNav(ctx, 'list')}
    />
  )
}

// ─── KPIs · QA ────────────────────────────────────────────────────────────────

export function KpiQaQueueWidget(props: WidgetCtx) {
  const { openBoard } = props
  const ctx = props
  const testing = scopedItems(getTestingItems())
  return (
    <KpiCard
      value={String(testing.length)} label="Aguardando Teste" sub="Ready for QA"
      disclaimer="itens em fila de QA ou em homologação ativa"
      miniViz={<MiniBarChart data={[{ label: 'S10', value: 8 }, { label: 'S11', value: 10 }, { label: 'S12', value: 7 }, { label: 'S13', value: testing.length, current: true }]} showAvg={false} />}
      onClick={() => doOpenBoard(ctx)}
    />
  )
}

export function KpiQaBugsWidget(props: WidgetCtx) {
  const { openBoard } = props
  const ctx = props
  const crit = scopedItems(liveItems()).filter(w => w.type === 'bug' && (w.priority === 'critical' || w.priority === 'high')).length
  return (
    <KpiCard
      value={String(crit)} label="Bugs Críticos" sub={crit > 0 ? 'requer atenção' : 'tudo ok'}
      disclaimer="bugs P0/P1 bloqueando entrega da sprint" color={T.crit} alert={crit > 0}
      miniViz={<MiniSparkline data={[{ label: 'S8', value: 9 }, { value: 7 }, { value: 8 }, { value: 6 }, { value: 5 }, { label: 'S13', value: crit }]} color="#ef4444" />}
      onClick={() => doOpenBoard(ctx)}
    />
  )
}

export function KpiQaRejectionWidget(props: WidgetCtx) {
  const { openDetail } = props
  const ctx = props
  return (
    <KpiCard
      value="28%" label="Taxa de Rejeição" sub="meta: <15%"
      disclaimer="% de itens devolvidos ao Dev pelo QA" color={T.warn} alert
      miniViz={<MiniSparkline data={[{ label: 'S8', value: 18 }, { value: 20 }, { value: 22 }, { value: 25 }, { value: 26 }, { label: 'S13', value: 28 }]} color="#f5a524" />}
      onClick={() => doOpenDetail(ctx, 'leadtime')}
    />
  )
}

export function KpiQaEvidenceWidget(props: WidgetCtx) {
  const { openBoard } = props
  const ctx = props
  return (
    <KpiCard
      value="6" label="Evidências Pendentes" sub="dev não submeteu"
      disclaimer="bugs sem evidência de reprodução registrada" color={T.warn}
      miniViz={<MiniBarChart data={[{ label: 'S10', value: 4 }, { label: 'S11', value: 7 }, { label: 'S12', value: 5 }, { label: 'S13', value: 6, current: true }]} showAvg={false} />}
      onClick={() => doOpenBoard(ctx)}
    />
  )
}

// ─── Projects (RAG) ───────────────────────────────────────────────────────────

export function ProjectsRagWidget(props: WidgetCtx) {
  const { onNav } = props
  const ctx = props
  const projects = scopedProjects(liveAggregates()?.rag ?? [])
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
          onClick={() => doNav(ctx, 'project', p.id)}
        />
      ))}
    </Scroll>
  )
}
