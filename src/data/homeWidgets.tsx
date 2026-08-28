/**
 * Altech — Home widget catalog (single source of truth).
 * Merges the native Início cards with every card of the Reports registry so both
 * can be dropped into the interactive Home grid.
 */
import type { ReactNode } from 'react'
import { REPORT_CARDS_LIST, ChartFillProvider, ReportsDataProvider } from '@/data/reportRegistry'
import {
  BlockedWidget, ReadyWidget, TestingWidget, BacklogAlertWidget, MyQueueWidget,
  ReviewQueueWidget, DesignQueueWidget,
  SprintWidget, ProjectsRagWidget,
  KpiBlockedWidget, KpiWipWidget, KpiSprintProgressWidget, KpiProjectsWidget, KpiDeliveredWidget,
  KpiAdminProjectsWidget, KpiAdminBoardsWidget, KpiAdminModulesWidget, KpiAdminUsersWidget, KpiAdminInvitesWidget,
  KpiPmoActiveProjectsWidget, KpiPmoAtRiskWidget, KpiPredictabilityWidget, KpiPlannedVsDoneWidget,
  KpiPmProgressWidget, KpiPmDeadlineWidget,
  KpiMauWidget, KpiStickinessWidget, KpiChurnWidget, KpiAdoptionWidget,
  KpiPoReadyWidget, KpiBacklogHealthWidget, KpiCreatedVsFinalizedWidget, KpiReleasesHealthWidget,
  KpiSprintHealthWidget, KpiImpedimentsWidget, KpiSprintGoalWidget,
  KpiCriticalBugsWidget, KpiLeadTimeWidget, KpiThroughputWidget, KpiReworkWidget,
  KpiMyItemsWidget, KpiMyLateWidget, KpiMyBlockedWidget,
  KpiUxFlowsWidget, KpiUxPrototypesWidget, KpiUxPendingWidget, KpiUxHandoffWidget,
  KpiQaQueueWidget, KpiQaBugsWidget, KpiQaRejectionWidget, KpiQaEvidenceWidget,
  type WidgetCtx,
} from '@/components/home/nativeWidgets'
import { SCard } from '@/components/ds/DashboardKit'
import { T } from '@/components/ds/tokens'
import {
  PmoRagCard, DeliveryRhythmCard, PmMainRagCard, PlannedVsDoneCard, TeamWorkloadCard,
  ConversionFunnelCard, FeatureAdoptionCard, RoadmapCard, PoTeamCard,
  StuckAgingCard, CeremoniesCard, MyActiveQueueCard, MyBlockedCard, RecentActivityCard,
  DesignValidationCard, DesignSystemAlertsCard, TestExecutionCard, QaCoverageCard,
  CriticalBlockersCard,
} from '@/components/home/panelBodyCards'
import { AdminUsersCard, AdminModulesCard, AdminAuditCard, ClientFeedCard } from '@/pages/DashboardHomePage'
import { MOCK_TENANT } from '@/data/session'

export type { WidgetCtx }

export type WidgetGroup = 'Início' | 'Relatórios'

export interface WidgetDef {
  id: string
  title: string
  group: WidgetGroup
  /** 'kpi' = card estreito da linha de topo; 'card' = card de corpo. */
  kind: 'kpi' | 'card'
  /** Largura padrão em colunas na composição original (12 = largura total). */
  defaultW: number
  /** 'fit' = conteúdo escala com o card (KPIs/gráficos); 'scroll' = listas roláveis. */
  overflow: 'fit' | 'scroll'
  /** Tamanho mínimo apresentável na grade (colunas / linhas). */
  minW: number
  minH: number
  /** true = o widget não traz moldura própria; o grid o envolve num SCard com o título. */
  framed?: boolean
  render: (ctx: WidgetCtx) => ReactNode
}

function kpi(id: string, title: string, render: (c: WidgetCtx) => ReactNode): WidgetDef {
  return { id, title, group: 'Início', kind: 'kpi', defaultW: 3, overflow: 'fit', minW: 2, minH: 2, render }
}
function list(id: string, title: string, render: (c: WidgetCtx) => ReactNode, framed = false): WidgetDef {
  return { id, title, group: 'Início', kind: 'card', defaultW: 6, overflow: 'scroll', minW: 3, minH: 2, framed, render }
}
/** Card de corpo dos painéis originais (traz o próprio SCard/WorkQueue). */
function card(id: string, title: string, defaultW: number, render: (c: WidgetCtx) => ReactNode): WidgetDef {
  return { id, title, group: 'Início', kind: 'card', defaultW, overflow: 'scroll', minW: 3, minH: 3, render }
}

const NATIVE: WidgetDef[] = [
  // KPIs genéricos
  kpi('native.kpi-blocked',   'KPI · Itens bloqueados',      c => <KpiBlockedWidget {...c} />),
  kpi('native.kpi-wip',       'KPI · Trabalho em andamento', c => <KpiWipWidget {...c} />),
  kpi('native.kpi-sprint',    'KPI · Progresso da sprint',   c => <KpiSprintProgressWidget {...c} />),
  kpi('native.kpi-projects',  'KPI · Projetos no escopo',    c => <KpiProjectsWidget {...c} />),
  kpi('native.kpi-delivered', 'KPI · Entregues',             c => <KpiDeliveredWidget {...c} />),

  // Admin Master
  kpi('native.kpi-admin-projects', 'KPI · Projetos (tenant)', c => <KpiAdminProjectsWidget {...c} />),
  kpi('native.kpi-admin-boards',   'KPI · Boards',            c => <KpiAdminBoardsWidget {...c} />),
  kpi('native.kpi-admin-modules',  'KPI · Módulos ativos',    c => <KpiAdminModulesWidget {...c} />),
  kpi('native.kpi-admin-users',    'KPI · Usuários',          c => <KpiAdminUsersWidget {...c} />),
  kpi('native.kpi-admin-invites',  'KPI · Convites',          c => <KpiAdminInvitesWidget {...c} />),

  // PMO / gestão de portfólio
  kpi('native.kpi-pmo-active',   'KPI · Projetos ativos',        c => <KpiPmoActiveProjectsWidget {...c} />),
  kpi('native.kpi-pmo-risk',     'KPI · Em risco / atrasados',   c => <KpiPmoAtRiskWidget {...c} />),
  kpi('native.kpi-predictability', 'KPI · Previsibilidade',      c => <KpiPredictabilityWidget {...c} />),
  kpi('native.kpi-planned-done', 'KPI · Planejado × Concluído',  c => <KpiPlannedVsDoneWidget {...c} />),

  // Project Manager
  kpi('native.kpi-pm-progress', 'KPI · Progresso do projeto', c => <KpiPmProgressWidget {...c} />),
  kpi('native.kpi-pm-deadline', 'KPI · Prazo restante',       c => <KpiPmDeadlineWidget {...c} />),

  // Product Manager
  kpi('native.kpi-mau',         'KPI · MAU',                  c => <KpiMauWidget {...c} />),
  kpi('native.kpi-stickiness',  'KPI · Stickiness',           c => <KpiStickinessWidget {...c} />),
  kpi('native.kpi-churn',       'KPI · Churn Rate',           c => <KpiChurnWidget {...c} />),
  kpi('native.kpi-adoption',    'KPI · Adoção de features',   c => <KpiAdoptionWidget {...c} />),

  // Product Owner
  kpi('native.kpi-po-ready',        'KPI · Cobertura Ready',      c => <KpiPoReadyWidget {...c} />),
  kpi('native.kpi-backlog-health',  'KPI · Saúde do backlog',     c => <KpiBacklogHealthWidget {...c} />),
  kpi('native.kpi-created-vs-done', 'KPI · Criado vs Finalizado', c => <KpiCreatedVsFinalizedWidget {...c} />),
  kpi('native.kpi-releases-health', 'KPI · Saúde das releases',   c => <KpiReleasesHealthWidget {...c} />),

  // Scrum Master
  kpi('native.kpi-sprint-health', 'KPI · Saúde da sprint', c => <KpiSprintHealthWidget {...c} />),
  kpi('native.kpi-impediments',   'KPI · Impedimentos',    c => <KpiImpedimentsWidget {...c} />),
  kpi('native.kpi-sprint-goal',   'KPI · Sprint Goal',     c => <KpiSprintGoalWidget {...c} />),

  // Tech Lead
  kpi('native.kpi-critical-bugs', 'KPI · Bugs críticos', c => <KpiCriticalBugsWidget {...c} />),
  kpi('native.kpi-leadtime',      'KPI · Lead Time',     c => <KpiLeadTimeWidget {...c} />),
  kpi('native.kpi-throughput',    'KPI · Vazão',         c => <KpiThroughputWidget {...c} />),
  kpi('native.kpi-rework',        'KPI · % Retrabalho',  c => <KpiReworkWidget {...c} />),

  // Dev
  kpi('native.kpi-my-items',   'KPI · Meus itens ativos', c => <KpiMyItemsWidget {...c} />),
  kpi('native.kpi-my-late',    'KPI · Meus atrasados',    c => <KpiMyLateWidget {...c} />),
  kpi('native.kpi-my-blocked', 'KPI · Meus bloqueados',   c => <KpiMyBlockedWidget {...c} />),

  // UX / UI
  kpi('native.kpi-ux-flows',      'KPI · Fluxos em design',       c => <KpiUxFlowsWidget {...c} />),
  kpi('native.kpi-ux-prototypes', 'KPI · Protótipos p/ validação', c => <KpiUxPrototypesWidget {...c} />),
  kpi('native.kpi-ux-pending',    'KPI · Pendências UX críticas',  c => <KpiUxPendingWidget {...c} />),
  kpi('native.kpi-ux-handoff',    'KPI · Handoff pronto',          c => <KpiUxHandoffWidget {...c} />),

  // QA
  kpi('native.kpi-qa-queue',     'KPI · Aguardando teste',     c => <KpiQaQueueWidget {...c} />),
  kpi('native.kpi-qa-bugs',      'KPI · Bugs críticos (QA)',   c => <KpiQaBugsWidget {...c} />),
  kpi('native.kpi-qa-rejection', 'KPI · Taxa de rejeição',     c => <KpiQaRejectionWidget {...c} />),
  kpi('native.kpi-qa-evidence',  'KPI · Evidências pendentes', c => <KpiQaEvidenceWidget {...c} />),

  // Listas / filas
  list('native.blocked',       'Bloqueados',                   c => <BlockedWidget {...c} />),
  list('native.my-queue',      'Minha fila',                   c => <MyQueueWidget {...c} />),
  list('native.sprint',        'Sprint atual',                 c => <SprintWidget {...c} />),
  list('native.ready',         'Prontos para desenvolvimento', c => <ReadyWidget {...c} />),
  list('native.testing',       'Aguardando teste',             c => <TestingWidget {...c} />),
  list('native.backlog-alert', 'Backlog com alerta',           c => <BacklogAlertWidget {...c} />),
  list('native.review-queue',  'Gargalos de PRs / revisão',    c => <ReviewQueueWidget {...c} />),
  list('native.design-queue',  'Fila de design ativa',         c => <DesignQueueWidget {...c} />),
  list('native.projects-rag',  'Saúde dos projetos (RAG)',     c => <ProjectsRagWidget {...c} />, true),

  // Cards de corpo dos painéis originais
  card('native.admin-users',    'Usuários & Convites',       6,  c => <AdminUsersCard onNav={c.onNav} />),
  card('native.admin-modules',  'Módulos',                   6,  c => <AdminModulesCard onNav={c.onNav} />),
  card('native.admin-audit',    'Auditoria',                 12, c => <AdminAuditCard projectIds={c.projectIds} />),
  card('native.client-feed',    'Client Feed',               12, () => <ClientFeedCard tenantId={MOCK_TENANT.tenant_id} />),
  card('native.pmo-rag',        'Saúde por Projeto (RAG)',   6,  c => <PmoRagCard {...c} />),
  card('native.critical-blockers', 'Bloqueadores Críticos',  6,  c => <CriticalBlockersCard {...c} />),
  card('native.delivery-rhythm', 'Ritmo de Entrega',         12, c => <DeliveryRhythmCard {...c} />),
  card('native.pm-rag',         'Projeto principal (RAG)',   6,  c => <PmMainRagCard {...c} />),
  card('native.planned-done',   'Planejado × Concluído',     6,  c => <PlannedVsDoneCard {...c} />),
  card('native.team-workload',  'Carga do Time',             12, () => <TeamWorkloadCard />),
  card('native.funnel',         'Funil de Conversão',        6,  () => <ConversionFunnelCard />),
  card('native.feature-adoption', 'Adoção de Features',      6,  () => <FeatureAdoptionCard />),
  card('native.roadmap',        'Roadmap Estratégico',       12, c => <RoadmapCard {...c} />),
  card('native.po-team',        'Time Atuando no Projeto',   6,  () => <PoTeamCard />),
  card('native.stuck-aging',    'Itens Parados + Aging WIP', 6,  c => <StuckAgingCard {...c} />),
  card('native.ceremonies',     'Cerimônias',                12, () => <CeremoniesCard />),
  card('native.my-active-queue', 'Minha Fila Ativa',         12, c => <MyActiveQueueCard {...c} />),
  card('native.my-blocked',     'Meus Bloqueados',           6,  c => <MyBlockedCard {...c} />),
  card('native.recent-activity', 'Atividade Recente',        6,  c => <RecentActivityCard {...c} />),
  card('native.design-validation', 'Validações em Andamento', 6, () => <DesignValidationCard />),
  card('native.design-system',  'Alertas do Design System',  6,  () => <DesignSystemAlertsCard />),
  card('native.test-execution', 'Fila de Execução de Testes', 6, c => <TestExecutionCard {...c} />),
  card('native.qa-coverage',    'Aging / Rejeição (QA)',     6,  c => <QaCoverageCard {...c} />),
]

/** Relatórios de DEMANDAS: o clique abre o board; os demais abrem o detalhe in-place. */
const DEMAND_REPORTS = new Set<string>(['criados', 'bugs', 'aging'])

const REPORTS: WidgetDef[] = REPORT_CARDS_LIST.map(entry => ({
  id: `report.${entry.id}`,
  title: entry.title,
  group: 'Relatórios' as const,
  kind: 'card' as const,
  defaultW: 6,
  overflow: 'fit' as const,
  minW: 3,
  minH: 3,
  render: (ctx: WidgetCtx) => (
    <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ChartFillProvider>
          <ReportsDataProvider projectIds={ctx.projectIds.size > 0 ? [...ctx.projectIds] : undefined}>
            <entry.Component />
          </ReportsDataProvider>
        </ChartFillProvider>
      </div>
      <button
        className="no-drag"
        onClick={() => (DEMAND_REPORTS.has(entry.id) ? ctx.openBoard() : ctx.openDetail(entry.id))}
        style={{
          flex: '0 0 auto', alignSelf: 'flex-start', fontSize: 11, color: T.accent,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        {DEMAND_REPORTS.has(entry.id) ? 'Abrir board →' : 'Ver detalhes'}
      </button>
    </div>
  ),


}))

export const HOME_WIDGETS: WidgetDef[] = [...NATIVE, ...REPORTS]

export function getWidget(id: string): WidgetDef | undefined {
  return HOME_WIDGETS.find(w => w.id === id)
}

/**
 * Composição original de cada painel por papel: KPIs de topo na ordem do mural,
 * seguidos das filas/listas e dos cards de relatório do board de composição.
 */
const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: [
    'native.kpi-admin-projects', 'native.kpi-admin-boards', 'native.kpi-admin-modules',
    'native.kpi-admin-users', 'native.kpi-admin-invites',
    'native.admin-users', 'native.admin-modules', 'native.admin-audit',
    'report.health', 'native.projects-rag',
  ],
  pmo: [
    'native.kpi-pmo-active', 'native.kpi-pmo-risk', 'native.kpi-predictability', 'native.kpi-planned-done',
    'native.pmo-rag', 'native.critical-blockers', 'native.delivery-rhythm', 'native.client-feed',
    'report.velocity', 'report.criados',
  ],
  'project-manager': [
    'native.kpi-pm-progress', 'native.kpi-pm-deadline', 'native.kpi-blocked', 'native.kpi-predictability',
    'native.pm-rag', 'native.planned-done', 'native.sprint', 'native.critical-blockers',
    'native.team-workload', 'native.client-feed',
    'report.burndown', 'report.workload',
  ],
  'product-manager': [
    'native.kpi-mau', 'native.kpi-stickiness', 'native.kpi-churn', 'native.kpi-adoption',
    'native.funnel', 'native.feature-adoption', 'native.roadmap',
    'report.criados', 'report.health',
  ],
  'product-owner': [
    'native.kpi-po-ready', 'native.kpi-backlog-health', 'native.kpi-created-vs-done', 'native.kpi-releases-health',
    'native.backlog-alert', 'native.ready', 'native.client-feed', 'native.po-team',
    'report.criados', 'report.aging',
  ],
  'scrum-master': [
    'native.kpi-sprint-health', 'native.kpi-impediments', 'native.kpi-sprint-goal', 'native.kpi-wip',
    'native.blocked', 'native.stuck-aging', 'native.ceremonies',
    'report.burndown', 'report.cfd',
  ],
  'tech-lead': [
    'native.kpi-critical-bugs', 'native.kpi-leadtime', 'native.kpi-throughput', 'native.kpi-rework',
    'native.review-queue', 'native.client-feed',
    'report.leadtime',
  ],
  dev: [
    'native.kpi-my-items', 'native.kpi-my-late', 'native.kpi-my-blocked',
    'native.my-active-queue', 'native.my-blocked', 'native.recent-activity', 'native.client-feed',
    'report.burndown',
  ],
  ux: [
    'native.kpi-ux-flows', 'native.kpi-ux-prototypes', 'native.kpi-ux-pending', 'native.kpi-ux-handoff',
    'native.design-queue', 'native.design-validation', 'native.design-system',
    'report.workload',
  ],
  qa: [
    'native.kpi-qa-queue', 'native.kpi-qa-bugs', 'native.kpi-qa-rejection', 'native.kpi-qa-evidence',
    'native.test-execution', 'native.qa-coverage',
    'report.bugs', 'report.criados',
  ],
}

/** Widgets shown on the very first access, per dashboard/role. */
export function defaultWidgetIds(role: string): string[] {
  return ROLE_DEFAULTS[role] ?? [
    'native.kpi-blocked', 'native.kpi-wip', 'native.kpi-sprint', 'native.kpi-projects',
    'native.my-queue', 'native.sprint',
  ]
}
