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
  MiniBarChart, MiniSparkline, SCard, ConditionalTag, Av, statusConfig,
  type WorkItem, type ProjectOption,
} from '@/components/ds/DashboardKit'
import { BurndownChart, ReportMiniViz, useReportsData } from '@/data/reportRegistry'
import { PredictabilityChartLive, CreatedFinalizedChartLive } from '@/components/home/ModalCharts'
import {
  liveItems, liveProjects, liveAggregates, liveCurrentSprintName,
  getBlockedItems, getSprintItems, getReadyItems, getTestingItems, getBacklogWithAlerts,
} from '@/data/db/homeLive'
import {
  fetchAdminKpis, fetchAdminInicioData, fetchPoCardMetrics, computeDeliveryMetrics,
  type AdminKpis, type AdminInicioData, type PoCardMetrics,
} from '@/data/db/dashboards'
import { listModules } from '@/data/db/modules'
import { logger } from '@/utils/logger'
import { setListPrefilter } from '@/data/listPrefilter'
import { setMyTasksFocus } from '@/data/myTasksPrefilter'
import type { KpiDetailConfig } from '@/components/home/KpiDetailModal'

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
  /** Abre o modal de detalhe do KPI (framework declarativo por perfil). */
  openKpiDetail: (config: KpiDetailConfig) => void
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
function doKpiDetail(ctx: WidgetCtx, config: KpiDetailConfig) {
  if (!ctx.interactive) return
  ctx.openKpiDetail(config)
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

/**
 * Barras de QUANTIDADE (não %) — uma barra colorida por categoria com o número no
 * topo. Usada nos KPIs do PMO para ler o volume por saúde (verde / âmbar / vermelho).
 */
function qtyBars(items: { value: number; color: string }[]) {
  const max = Math.max(1, ...items.map(i => i.value))
  const W = 96, H = 44, P = 3, labelH = 13
  const n = items.length
  const gap = 10
  const bw = Math.max(10, (W - P * 2 - gap * (n - 1)) / n)
  const chartH = H - labelH
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {items.map((it, i) => {
        const x = P + i * (bw + gap)
        const h = Math.max(2, (it.value / max) * (chartH - P))
        const y = P + labelH + (chartH - P - h)
        return (
          <g key={i}>
            <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={11} fontWeight={700}
              fill={it.value === 0 ? T.text3 : T.text1}>{it.value}</text>
            <rect x={x} y={y} width={bw} height={h} rx={2}
              fill={it.color} fillOpacity={it.value === 0 ? 0.22 : 0.9} />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Mini "planejado × concluído": o contorno é o planejado (committed) e o
 * preenchido é o concluído (completed), um dentro do outro, por sprint.
 */
function plannedDoneViz(committed: number[], completed: number[]) {
  const n = committed.length
  if (n === 0) return null
  const W = 96, H = 44, P = 3, gap = 2
  const max = Math.max(1, ...committed, ...completed)
  const bw = Math.max(3, (W - P * 2 - gap * (n - 1)) / n)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {committed.map((cv, i) => {
        const x = P + i * (bw + gap)
        const ch = Math.max(1, (cv / max) * (H - P * 2))
        const dh = Math.max(0, ((completed[i] ?? 0) / max) * (H - P * 2))
        return (
          <g key={i}>
            <rect x={x} y={H - P - ch} width={bw} height={ch} rx={1.5} fill="none" stroke={T.accent} strokeWidth={1} opacity={0.5} />
            <rect x={x} y={H - P - dh} width={bw} height={dh} rx={1.5} fill={T.accent} opacity={0.9} />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Agrega as séries reais de velocity (planejado/concluído por sprint) já no
 * escopo do ReportsDataProvider do board. Sem provider → séries vazias (fallback).
 */
function useDeliverySeries() {
  const { data } = useReportsData()
  const byP = data?.velocity.byProject ?? []
  const sprintCount = byP.reduce((m, b) => Math.max(m, b.committed.length), 0)
  const committed = Array.from({ length: sprintCount }, (_, i) => byP.reduce((a, b) => a + (b.committed[i] ?? 0), 0))
  const completed = Array.from({ length: sprintCount }, (_, i) => byP.reduce((a, b) => a + (b.completed[i] ?? 0), 0))
  const predictability = committed.map((cv, i) => (cv > 0 ? Math.round((completed[i] / cv) * 100) : 0))
  return { committed, completed, predictability }
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

/** Itens em revisão / bugs — gargalos técnicos do painel do Tech Lead.
 *  Enriquecido: revisor (ou "sem reviewer"), tempo parado (days_blocked) e marca de bug.
 *  Ordena os mais críticos no topo (sem revisor → mais dias parados). */
export function ReviewQueueWidget(props: WidgetCtx) {
  const ctx = props
  const items = scopedItems(liveItems()).filter(w => w.status === 'in-review' || w.type === 'bug')
  const rows = [...items].sort((a, b) => {
    const noRevA = a.assignee ? 0 : 1
    const noRevB = b.assignee ? 0 : 1
    if (noRevA !== noRevB) return noRevB - noRevA          // sem revisor primeiro
    return (b.days_blocked ?? 0) - (a.days_blocked ?? 0)   // mais parado primeiro
  })
  const noReviewer = items.filter(w => !w.assignee).length

  const viewAll = items.length > 0 ? (
    <button onClick={e => { e.stopPropagation(); doOpenBoard(ctx) }}
      style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver board →</button>
  ) : undefined

  return (
    <SCard title={`Gargalos de PRs / Issues em revisão (${items.length})`} action={viewAll}
      style={{ border: 'none', background: 'transparent' }}
      help={noReviewer > 0 ? `${noReviewer} sem revisor — prioridade de atribuição.` : undefined}>
      {rows.length === 0
        ? <EmptyState message="Nenhum gargalo no momento. 🟢" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.slice(0, 20).map(w => {
              const d = w.days_blocked ?? 0
              return (
                <div key={w.id} className="no-drag" onClick={() => doOpenItem(ctx, w)}
                  style={{ background: T.bgPage, borderRadius: 7, padding: '8px 10px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: w.type === 'bug' ? T.crit : T.purple, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.text3, width: 56, flexShrink: 0 }}>{w.key}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{w.title}</span>
                    {d > 0 && <ConditionalTag label={`${d}d parado`} severity={d >= 3 ? 'crit' : 'warn'} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    {w.assignee
                      ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Av initials={w.assignee.initials} color={w.assignee.color} size={18} />
                          <span style={{ fontSize: 10.5, color: T.text3 }}>revisor: {w.assignee.name}</span>
                        </span>
                      )
                      : <ConditionalTag label="sem reviewer" severity="warn" />}
                    {w.type === 'bug' && <ConditionalTag label="bug" severity="crit" />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </SCard>
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
      onClick={() => doKpiDetail(ctx, buildBlockedDetail(ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildScrumDetail(3, ctx.onNav))}
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

function useAdminInicio(): AdminInicioData | null {
  const [data, setData] = useState<AdminInicioData | null>(null)
  useEffect(() => {
    let alive = true
    fetchAdminInicioData()
      .then(d => { if (alive) setData(d) })
      .catch(err => { logger.error('home.admin-inicio', err) })
    return () => { alive = false }
  }, [])
  return data
}

const ACTIVE_MODULE_STATUSES = ['operational', 'implemented', 'preview', 'trial', 'active']

/** Carrossel dos módulos ativos do tenant: alterna o nome a cada 3s, com rodapé
 *  que leva à Central de Módulos. Usado no card "Módulos ativos" do Admin. */
function ModuleCarousel({ onOpen }: { onOpen: () => void }) {
  const [names, setNames] = useState<string[]>([])
  const [i, setI] = useState(0)
  useEffect(() => {
    let alive = true
    listModules()
      .then(mods => { if (alive) setNames(mods.filter(m => ACTIVE_MODULE_STATUSES.includes((m.status ?? '').toLowerCase())).map(m => m.name)) })
      .catch(err => { logger.error('home.admin-modules', err) })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (names.length <= 1) return
    const t = setInterval(() => setI(n => (n + 1) % names.length), 3000)
    return () => clearInterval(t)
  }, [names.length])
  const cur = names[i % Math.max(1, names.length)]
  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6, paddingTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cur ?? 'Nenhum módulo ativo'}
        </span>
      </div>
      {names.length > 1 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {names.map((_, j) => <span key={j} style={{ width: 5, height: 5, borderRadius: 99, background: j === i ? T.accent : T.border2 }} />)}
        </div>
      )}
      <button onClick={e => { e.stopPropagation(); onOpen() }}
        style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, alignSelf: 'flex-start' }}>
        Abrir central de módulos →
      </button>
    </div>
  )
}

export function KpiAdminProjectsWidget(props: WidgetCtx) {
  const ctx = props
  const d = useAdminInicio()
  const p = d?.projects
  const total = p ? p.active + p.finished + p.archived : 0
  return (
    <KpiCard
      value={p ? String(total) : '—'} label="Projetos"
      sub={p ? `${p.active} ativo${p.active !== 1 ? 's' : ''}` : 'carregando…'}
      disclaimer="quantidade: ativos / finalizados / arquivados"
      miniViz={p ? qtyBars([{ value: p.active, color: T.accent }, { value: p.finished, color: T.success }, { value: p.archived, color: T.text3 }]) : undefined}
      onClick={() => doNav(ctx, 'projects-list')}
    />
  )
}

export function KpiAdminBoardsWidget(props: WidgetCtx) {
  const ctx = props
  const d = useAdminInicio()
  const b = d?.boards
  const total = b ? b.active + b.archived : 0
  return (
    <KpiCard
      value={b ? String(total) : '—'} label="Boards"
      sub={b ? `${b.active} ativo${b.active !== 1 ? 's' : ''}` : 'carregando…'}
      disclaimer="quantidade: ativos / arquivados"
      miniViz={b ? qtyBars([{ value: b.active, color: T.indigo }, { value: b.archived, color: T.text3 }]) : undefined}
      onClick={() => doNav(ctx, 'boards-list')}
    />
  )
}

export function KpiAdminModulesWidget(props: WidgetCtx) {
  const ctx = props
  const k = useAdminKpis()
  return (
    <KpiCard
      value={k ? String(k.modules.active) : '—'} label="Módulos ativos"
      sub={k ? `de ${k.modules.total} no catálogo` : 'carregando…'}
      disclaimer="módulos habilitados para este tenant"
      miniViz={<ModuleCarousel onOpen={() => doNav(ctx, 'modules')} />}
      onClick={() => doNav(ctx, 'modules')}
    />
  )
}

export function KpiAdminUsersWidget(props: WidgetCtx) {
  const ctx = props
  const k = useAdminKpis()
  const d = useAdminInicio()
  const series = d?.signupsWeekly ?? []
  return (
    <KpiCard
      value={k ? String(k.users.total) : '—'} label="Usuários"
      sub={k ? `${k.users.active} ativo${k.users.active !== 1 ? 's' : ''}${k.users.blocked ? ` · ${k.users.blocked} bloqueado(s)` : ''}` : 'carregando…'}
      disclaimer="crescimento de cadastros por semana"
      miniViz={series.length > 1
        ? <ReportMiniViz viz={{ kind: 'line', values: series, color: T.success }} />
        : (k ? ratioViz(k.users.active, k.users.total, T.success) : undefined)}
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
  const ctx = props
  const agg = liveAggregates()
  const rags = scopedProjects(agg?.rag ?? [])
  const healthy = rags.filter(r => r.rag === 'healthy').length
  const blocked = rags.filter(r => r.rag === 'blocked').length
  const atRisk = Math.max(0, rags.length - healthy - blocked)
  return (
    <KpiCard
      value={String(scopedOr(agg?.counts?.activeProjects ?? 0, rags.length))} label="Projetos Ativos"
      sub={`${healthy} no prazo`} disclaimer="projetos por saúde: no prazo / em risco / bloqueados"
      miniViz={qtyBars([{ value: healthy, color: T.success }, { value: atRisk, color: T.warn }, { value: blocked, color: T.crit }])}
      onClick={() => doNav(ctx, 'projects-list')}
    />
  )
}

export function KpiPmoAtRiskWidget(props: WidgetCtx) {
  const ctx = props
  const agg = liveAggregates()
  const rags = scopedProjects(agg?.rag ?? [])
  const atRisk = scopedOr(agg?.counts?.atRisk ?? 0, rags.filter(r => r.rag !== 'healthy').length)
  const blocked = rags.filter(r => r.rag === 'blocked').length
  const warnOnly = Math.max(0, atRisk - blocked)
  return (
    <KpiCard
      value={String(atRisk)} label="Em Risco / Atrasados"
      sub={`${blocked} crítico(s)`} disclaimer="quantidade: em risco (âmbar) / crítico (vermelho)"
      color={T.warn} alert={atRisk > 0}
      miniViz={qtyBars([{ value: warnOnly, color: T.warn }, { value: blocked, color: T.crit }])}
      onClick={() => doNav(ctx, 'projects-list')}
    />
  )
}

export function KpiPredictabilityWidget(props: WidgetCtx) {
  const ctx = props
  const { predictability } = useDeliverySeries()
  const agg = liveAggregates()
  const pct = agg?.predictability ?? 0
  const color = pct < 80 ? T.warn : T.success
  return (
    <KpiCard
      value={`${pct}%`} label="Previsibilidade"
      help="Percentual do planejado que foi efetivamente entregue, sprint a sprint."
      sub="meta: 80%" disclaimer="tendência do % planejado entregue por sprint"
      color={color} alert={pct < 80}
      miniViz={predictability.length > 1
        ? <ReportMiniViz viz={{ kind: 'line', values: predictability, color }} />
        : ratioViz(pct, 100, color)}
      onClick={() => doKpiDetail(ctx, buildPredictabilityDetail())}
    />
  )
}

export function KpiPlannedVsDoneWidget(props: WidgetCtx) {
  const ctx = props
  const { committed, completed } = useDeliverySeries()
  const agg = liveAggregates()
  const pct = agg?.consolidatedPct ?? 0
  return (
    <KpiCard
      value={`${pct}%`} label="Planejado × Concluído"
      sub={`${agg?.done ?? 0}/${agg?.planned ?? 0} itens`}
      disclaimer="concluído (preenchido) dentro do planejado (contorno), por sprint"
      miniViz={committed.length > 0
        ? plannedDoneViz(committed, completed)
        : ratioViz(pct, 100, T.accent)}
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
      onClick={() => doKpiDetail(ctx, buildBacklogDetail(0, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildBacklogDetail(1, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildBacklogDetail(2, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildScrumDetail(0, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildScrumDetail(1, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildScrumDetail(2, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildEngDetail(0, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildEngDetail(1, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildEngDetail(2, ctx.onNav))}
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
      onClick={() => doKpiDetail(ctx, buildEngDetail(3, ctx.onNav))}
    />
  )
}

// ─── KPIs · Dev ───────────────────────────────────────────────────────────────

/** Abre a Minha Fila já focada no recorte do card (respeita o modo edição). */
function doMyFocus(ctx: WidgetCtx, focus: 'active' | 'late' | 'blocked') {
  if (!ctx.interactive) return
  setMyTasksFocus(focus)
  ctx.onNav('my-tasks')
}

export function KpiMyItemsWidget(props: WidgetCtx) {
  const { userName } = props
  const ctx = props
  const mine = scopedItems(liveItems()).filter(w => w.assignee?.name === userName)
  const active = mine.filter(w => w.status !== 'done' && w.status !== 'cancelled').length
  const done = mine.filter(w => w.status === 'done').length
  const blocked = mine.filter(w => w.status === 'blocked').length
  return (
    <KpiCard
      value={String(mine.length)} label="Meus Itens Ativos"
      sub={`${blocked} bloqueado${blocked !== 1 ? 's' : ''}`}
      disclaimer="quantidade: em andamento / concluídos"
      miniViz={qtyBars([{ value: active, color: T.accent }, { value: done, color: T.success }])}
      onClick={() => doMyFocus(ctx, 'active')}
    />
  )
}

export function KpiMyLateWidget(props: WidgetCtx) {
  const { userName } = props
  const ctx = props
  const today = new Date().toISOString().slice(0, 10)
  const mine = scopedItems(liveItems()).filter(w => w.assignee?.name === userName && w.status !== 'done')
  const late = mine.filter(w => w.due_date && w.due_date <= today).length
  const onTime = Math.max(0, mine.length - late)
  return (
    <KpiCard
      value={String(late)} label="Atrasados"
      sub={late ? 'prazo vencido ou hoje' : 'nenhum atrasado'}
      disclaimer="quantidade: atrasados / no prazo"
      color={late ? T.crit : undefined} alert={late > 0}
      miniViz={qtyBars([{ value: late, color: T.crit }, { value: onTime, color: T.success }])}
      onClick={() => doMyFocus(ctx, 'late')}
    />
  )
}

export function KpiMyBlockedWidget(props: WidgetCtx) {
  const { userName } = props
  const ctx = props
  const mine = scopedItems(liveItems()).filter(w => w.assignee?.name === userName && w.status !== 'done')
  const blocked = mine.filter(w => w.status === 'blocked').length
  const flowing = Math.max(0, mine.length - blocked)
  return (
    <KpiCard
      value={String(blocked)} label="Meus Bloqueados" sub="aguardando desbloqueio"
      disclaimer="quantidade: bloqueados / fluindo"
      color={T.warn} alert={blocked > 0}
      miniViz={qtyBars([{ value: blocked, color: T.warn }, { value: flowing, color: T.accent }])}
      onClick={() => doMyFocus(ctx, 'blocked')}
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

/** Projeto (id/nome/cor) de um item, para as linhas do modal. */
function itemProject(w: WorkItem): ProjectOption | undefined {
  const p = liveProjects().find(x => x.id === w.project_id)
  return p ? { id: p.id, name: p.name, color: p.color } : undefined
}
function sevLabel(w: WorkItem): string {
  return w.priority === 'critical' ? 'Crítico' : w.priority === 'high' ? 'Alto' : w.priority === 'medium' ? 'Médio' : 'Baixo'
}

/** Config do modal de detalhe do QA (abas com dado REAL: fila de teste + bugs). */
function buildQaDetail(initialTab: number, onNav: (v: string, t?: string) => void): KpiDetailConfig {
  const testing = scopedItems(getTestingItems())
  const bugs = scopedItems(liveItems()).filter(w => w.type === 'bug' && w.status !== 'done' && (w.priority === 'critical' || w.priority === 'high'))
  return {
    title: 'QA', subtitle: 'detalhe dos indicadores', initialTab,
    footerAction: { label: 'Abrir board →', onClick: () => onNav('boards-list') },
    tabs: [
      {
        id: 'fila', label: 'Aguardando teste', count: testing.length,
        intro: 'Itens na fila de QA (prontos para teste ou em homologação). Clique numa linha para abrir a demanda no board.',
        table: {
          columns: [
            { key: 'key', header: 'Item', kind: 'mono' },
            { key: 't', header: 'Demanda' },
            { key: 'proj', header: 'Projeto', kind: 'project' },
            { key: 'st', header: 'Status', kind: 'pill' },
            { key: 'who', header: 'Responsável', kind: 'muted' },
          ],
          rows: testing.map(w => ({ item: w, project: itemProject(w), cells: { key: w.key, t: w.title, st: w.status, who: w.assignee?.name ?? '—' } })),
          emptyText: 'Nada aguardando teste neste escopo.',
        },
        note: testing.length > 0 ? { text: 'Ordene pelos que estão parados há mais tempo — abrir a demanda pelo item leva direto ao board.' } : undefined,
      },
      {
        id: 'bugs', label: 'Bugs críticos', count: bugs.length,
        intro: 'Bugs abertos com severidade crítica ou alta. Clique para abrir no board.',
        table: {
          columns: [
            { key: 'key', header: 'Item', kind: 'mono' },
            { key: 't', header: 'Bug' },
            { key: 'proj', header: 'Projeto', kind: 'project' },
            { key: 'sev', header: 'Severidade', kind: 'pill' },
            { key: 'st', header: 'Status', kind: 'pill' },
          ],
          rows: bugs.map(w => ({ item: w, project: itemProject(w), cells: { key: w.key, t: w.title, sev: sevLabel(w), st: w.status } })),
          emptyText: 'Nenhum bug crítico aberto neste escopo. 🟢',
        },
      },
    ],
  }
}

/** Linha de tabela do modal a partir de um item do board. */
function itemRow(w: WorkItem, cells: Record<string, string>): { item: WorkItem; project: ProjectOption | undefined; cells: Record<string, string> } {
  return { item: w, project: itemProject(w), cells }
}
const COL_ITEM = { key: 'key', header: 'Item', kind: 'mono' as const }
const COL_PROJ = { key: 'proj', header: 'Projeto', kind: 'project' as const }
const COL_ST = { key: 'st', header: 'Status', kind: 'pill' as const }
const num = (v: number | null | undefined, suf = ''): string => (v == null ? '—' : `${v}${suf}`)

/** Modal do Scrum Master (título neutro "Sprint" — o card pode ser reusado por outros papéis). */
function buildScrumDetail(initialTab: number, onNav: (v: string, t?: string) => void): KpiDetailConfig {
  const agg = liveAggregates()
  const sprint = scopedItems(getSprintItems())
  const notDone = sprint.filter(w => w.status !== 'done' && w.status !== 'cancelled')
  const blocked = scopedItems(getBlockedItems())
  const wip = scopedItems(liveItems()).filter(w => ['in-progress', 'in-review', 'testing'].includes(w.status))
  const inReview = wip.filter(w => w.status === 'in-review').length
  const sprints = agg?.currentSprints ?? []
  const tDone = sprints.reduce((a, s) => a + s.done, 0)
  const tTotal = sprints.reduce((a, s) => a + s.total, 0)
  const pct = tTotal ? Math.round((tDone / tTotal) * 100) : (agg?.consolidatedPct ?? 0)
  return {
    title: 'Sprint', subtitle: 'detalhe dos indicadores', initialTab,
    footerAction: { label: 'Abrir board →', onClick: () => onNav('boards-list') },
    tabs: [
      { id: 'saude', label: 'Saúde da sprint', count: `${pct}%`,
        intro: 'Progresso da sprint e o que ainda não fechou. Clique num item para abri-lo no board.',
        metrics: [{ v: `${pct}%`, k: 'Concluído', c: T.success }, { v: `${tDone}/${tTotal}`, k: 'Itens' }, { v: String(notDone.length), k: 'Em aberto', c: notDone.length ? T.warn : T.text2 }],
        chart: <BurndownChart variant="full" />, chartTitle: 'Burndown da sprint',
        table: { columns: [COL_ITEM, { key: 't', header: 'Demanda' }, COL_PROJ, COL_ST, { key: 'pts', header: 'Pts', kind: 'muted' }],
          rows: notDone.map(w => itemRow(w, { key: w.key, t: w.title, st: statusConfig(w.status).label, pts: w.points != null ? String(w.points) : '—' })),
          emptyText: 'Sprint fechada — nada em aberto. 🟢' } },
      { id: 'imped', label: 'Impedimentos', count: blocked.length,
        intro: 'Itens bloqueados: com quem estão e há quanto tempo. Clique para abrir no board.',
        table: { columns: [COL_ITEM, { key: 't', header: 'Demanda' }, COL_PROJ, { key: 'who', header: 'Com quem', kind: 'muted' }, { key: 'age', header: 'Parado há', kind: 'pill' }],
          rows: blocked.map(w => itemRow(w, { key: w.key, t: w.title, who: w.assignee?.name ?? '—', age: `${w.days_blocked ?? 0}d` })),
          emptyText: 'Nenhum impedimento aberto. 🟢' },
        note: blocked.length ? { text: 'Acompanhe de perto os que dependem de áreas externas ao time — costumam ser os que mais atrasam.' } : undefined },
      { id: 'goal', label: 'Sprint Goal', count: `${agg?.consolidatedPct ?? 0}%`,
        intro: 'Andamento consolidado em relação ao planejado da sprint.',
        metrics: [{ v: `${agg?.consolidatedPct ?? 0}%`, k: 'Progresso', c: T.accent }, { v: `${agg?.done ?? 0}/${agg?.planned ?? 0}`, k: 'Itens planejados' }],
        note: { text: 'Se o goal já está perto, os itens de fora dele podem entrar como extra, sem pressão.' } },
      { id: 'wip', label: 'WIP', count: wip.length,
        intro: 'Trabalho em andamento agora (em dev, revisão ou teste).',
        metrics: [{ v: String(wip.length), k: 'Em andamento', c: T.accent }, { v: String(inReview), k: 'Em revisão' }],
        table: { columns: [COL_ITEM, { key: 't', header: 'Demanda' }, COL_PROJ, COL_ST, { key: 'who', header: 'Responsável', kind: 'muted' }],
          rows: wip.map(w => itemRow(w, { key: w.key, t: w.title, st: statusConfig(w.status).label, who: w.assignee?.name ?? '—' })) },
        note: inReview >= 3 ? { text: 'Vários itens em revisão ao mesmo tempo — se começar a acumular, talvez valha um limite só para revisão.' } : undefined },
    ],
  }
}

/** Modal do Tech Lead (título neutro "Engenharia"). */
function buildEngDetail(initialTab: number, onNav: (v: string, t?: string) => void): KpiDetailConfig {
  const agg = liveAggregates()
  const d = agg?.delivery
  const items = scopedItems(liveItems())
  const bugs = items.filter(w => w.type === 'bug' && w.status !== 'done' && (w.priority === 'critical' || w.priority === 'high'))
  const review = items.filter(w => w.status === 'in-review')
  const done = items.filter(w => w.status === 'done')
  const allBugs = items.filter(w => w.type === 'bug')
  return {
    title: 'Engenharia', subtitle: 'detalhe dos indicadores', initialTab,
    footerAction: { label: 'Abrir board →', onClick: () => onNav('boards-list') },
    tabs: [
      { id: 'bugs', label: 'Bugs críticos', count: bugs.length,
        intro: 'Bugs abertos com severidade crítica ou alta. Clique para abrir no board.',
        table: { columns: [COL_ITEM, { key: 't', header: 'Bug' }, COL_PROJ, { key: 'sev', header: 'Severidade', kind: 'pill' }, COL_ST],
          rows: bugs.map(w => itemRow(w, { key: w.key, t: w.title, sev: sevLabel(w), st: statusConfig(w.status).label })),
          emptyText: 'Nenhum bug crítico aberto. 🟢' } },
      { id: 'lead', label: 'Lead Time', count: num(d?.leadTimeDias, 'd'),
        intro: 'Tempo médio do início à conclusão. Abaixo, os itens em revisão — onde o tempo costuma ficar preso.',
        metrics: [{ v: num(d?.leadTimeDias, 'd'), k: 'Lead time', c: T.accent }, { v: num(d?.cycleTimeDias, 'd'), k: 'Cycle time' }, { v: String(review.length), k: 'Em revisão' }],
        table: { columns: [COL_ITEM, { key: 't', header: 'Demanda' }, COL_PROJ, { key: 'who', header: 'Responsável', kind: 'muted' }, { key: 'age', header: 'Parado há', kind: 'muted' }],
          rows: review.map(w => itemRow(w, { key: w.key, t: w.title, who: w.assignee?.name ?? '—', age: `${w.days_blocked ?? 0}d` })),
          emptyText: 'Nada preso em revisão. 🟢' },
        note: review.length ? { text: 'Boa parte do tempo fica no code review. Se rolar limitar quantas revisões acontecem ao mesmo tempo, o lead time tende a cair.' } : undefined },
      { id: 'vazao', label: 'Vazão', count: num(d?.vazaoSemana, '/sem'),
        intro: 'Itens concluídos por semana e os já entregues no escopo.',
        metrics: [{ v: num(d?.vazaoSemana, '/sem'), k: 'Vazão', c: T.accent }, { v: String(done.length), k: 'Concluídos (escopo)' }],
        chart: <MiniBarChart data={weeklyThroughput()} />, chartTitle: 'Concluídos por semana',
        table: { columns: [COL_ITEM, { key: 't', header: 'Demanda' }, COL_PROJ, { key: 'pts', header: 'Pts', kind: 'muted' }],
          rows: done.slice(0, 30).map(w => itemRow(w, { key: w.key, t: w.title, pts: w.points != null ? String(w.points) : '—' })),
          emptyText: 'Nada concluído ainda neste escopo.' } },
      { id: 'rework', label: '% Retrabalho', count: num(d?.taxaBugsPct, '%'),
        intro: 'Percentual de esforço em bugs. Abaixo, os bugs do escopo.',
        metrics: [{ v: num(d?.taxaBugsPct, '%'), k: 'Retrabalho (bugs)', c: (d?.taxaBugsPct ?? 0) > 20 ? T.warn : T.accent }, { v: String(allBugs.length), k: 'Bugs no escopo' }],
        table: { columns: [COL_ITEM, { key: 't', header: 'Bug' }, COL_PROJ, { key: 'sev', header: 'Severidade', kind: 'pill' }, COL_ST],
          rows: allBugs.map(w => itemRow(w, { key: w.key, t: w.title, sev: sevLabel(w), st: statusConfig(w.status).label })),
          emptyText: 'Sem bugs no escopo. 🟢' },
        note: { text: 'O retrabalho costuma subir quando o requisito muda no meio da sprint — fechar o escopo logo após o planning ajuda a segurar.' } },
    ],
  }
}

/** Modal do Product Owner (título neutro "Backlog & Entregas"). */
function buildBacklogDetail(initialTab: number, onNav: (v: string, t?: string) => void): KpiDetailConfig {
  const agg = liveAggregates()
  const ready = scopedItems(getReadyItems())
  const backlog = scopedItems(getBacklogWithAlerts())
  return {
    title: 'Backlog & Entregas', subtitle: 'detalhe dos indicadores', initialTab,
    footerAction: { label: 'Abrir backlog →', onClick: () => onNav('list') },
    tabs: [
      { id: 'ready', label: 'Cobertura Ready', count: ready.length,
        intro: 'Histórias prontas para desenvolvimento (refinadas). Clique para abrir no board.',
        metrics: [{ v: String(ready.length), k: 'Prontas', c: T.success }],
        table: { columns: [COL_ITEM, { key: 't', header: 'História' }, COL_PROJ, COL_ST, { key: 'pts', header: 'Pts', kind: 'muted' }],
          rows: ready.map(w => itemRow(w, { key: w.key, t: w.title, st: statusConfig(w.status).label, pts: w.points != null ? String(w.points) : '—' })),
          emptyText: 'Nada pronto para iniciar neste escopo.' } },
      { id: 'backlog', label: 'Saúde do backlog', count: backlog.length,
        intro: 'Itens do backlog com algum alerta (sem estimativa, sem critério ou parados). Clique para abrir.',
        table: { columns: [COL_ITEM, { key: 't', header: 'Demanda' }, COL_PROJ, COL_ST],
          rows: backlog.map(w => itemRow(w, { key: w.key, t: w.title, st: statusConfig(w.status).label })),
          emptyText: 'Backlog sem itens em alerta. 🟢' },
        note: backlog.length ? { text: 'Um refino focado nos itens em alerta deixa o backlog bem mais previsível.' } : undefined },
      { id: 'cf', label: 'Criado × Finalizado', count: `${agg?.consolidatedPct ?? 0}%`,
        intro: 'Volume planejado vs. concluído no escopo carregado.',
        metrics: [{ v: String(agg?.planned ?? 0), k: 'Planejado' }, { v: String(agg?.done ?? 0), k: 'Concluído', c: T.success }, { v: `${agg?.consolidatedPct ?? 0}%`, k: 'Aderência' }],
        chart: <CreatedFinalizedChartLive />, chartTitle: 'Criado (contorno) × Finalizado (preenchido) por sprint',
        note: { insight: true, text: 'Para stakeholders: o time conclui a maior parte do que entra por sprint. Quando o preenchido acompanha o contorno, o fluxo está saudável.' } },
    ],
  }
}

/** Modal genérico "Bloqueados" (card compartilhado por vários papéis). */
function buildBlockedDetail(onNav: (v: string, t?: string) => void): KpiDetailConfig {
  const blocked = scopedItems(getBlockedItems())
  return {
    title: 'Bloqueados', subtitle: 'itens aguardando desbloqueio', initialTab: 0,
    footerAction: { label: 'Abrir board →', onClick: () => onNav('boards-list') },
    tabs: [{ id: 'blk', label: 'Bloqueados', count: blocked.length,
      intro: 'Itens parados aguardando desbloqueio: com quem estão e há quanto tempo. Clique para abrir no board.',
      table: { columns: [COL_ITEM, { key: 't', header: 'Demanda' }, COL_PROJ, { key: 'who', header: 'Com quem', kind: 'muted' }, { key: 'age', header: 'Parado há', kind: 'pill' }],
        rows: blocked.map(w => itemRow(w, { key: w.key, t: w.title, who: w.assignee?.name ?? '—', age: `${w.days_blocked ?? 0}d` })),
        emptyText: 'Nenhum item bloqueado. 🟢' },
      note: blocked.length ? { text: 'Os que dependem de áreas externas merecem acompanhamento mais de perto.' } : undefined }],
  }
}

/** Modal genérico "Previsibilidade" (card compartilhado PMO/PM). */
function buildPredictabilityDetail(): KpiDetailConfig {
  const agg = liveAggregates()
  return {
    title: 'Previsibilidade', subtitle: 'planejado vs. entregue', initialTab: 0,
    tabs: [{ id: 'prev', label: 'Previsibilidade', count: `${agg?.predictability ?? 0}%`,
      intro: 'Percentual do planejado que o time efetivamente entregou.',
      metrics: [{ v: `${agg?.predictability ?? 0}%`, k: 'Previsibilidade', c: (agg?.predictability ?? 0) < 80 ? T.warn : T.success }, { v: `${agg?.consolidatedPct ?? 0}%`, k: 'Consolidado' }, { v: String(agg?.velocityAvg ?? 0), k: 'Velocity média' }],
      chart: <PredictabilityChartLive />, chartTitle: '% do planejado entregue, por sprint',
      note: { insight: true, text: 'Para stakeholders: acima de 80% indica estimativas confiáveis. A linha mostra a evolução sprint a sprint.' } }],
  }
}

export function KpiQaQueueWidget(props: WidgetCtx) {
  const ctx = props
  const testing = scopedItems(getTestingItems())
  return (
    <KpiCard
      value={String(testing.length)} label="Aguardando Teste" sub="Ready for QA"
      disclaimer="itens em fila de QA ou em homologação ativa"
      miniViz={<MiniBarChart data={[{ label: 'S10', value: 8 }, { label: 'S11', value: 10 }, { label: 'S12', value: 7 }, { label: 'S13', value: testing.length, current: true }]} showAvg={false} />}
      onClick={() => doKpiDetail(ctx, buildQaDetail(0, ctx.onNav))}
    />
  )
}

export function KpiQaBugsWidget(props: WidgetCtx) {
  const ctx = props
  const crit = scopedItems(liveItems()).filter(w => w.type === 'bug' && (w.priority === 'critical' || w.priority === 'high')).length
  return (
    <KpiCard
      value={String(crit)} label="Bugs Críticos" sub={crit > 0 ? 'requer atenção' : 'tudo ok'}
      disclaimer="bugs P0/P1 bloqueando entrega da sprint" color={T.crit} alert={crit > 0}
      miniViz={<MiniSparkline data={[{ label: 'S8', value: 9 }, { value: 7 }, { value: 8 }, { value: 6 }, { value: 5 }, { label: 'S13', value: crit }]} color="#ef4444" />}
      onClick={() => doKpiDetail(ctx, buildQaDetail(1, ctx.onNav))}
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

