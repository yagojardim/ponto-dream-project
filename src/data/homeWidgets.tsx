/**
 * Altech — Home widget catalog (single source of truth).
 * Merges the native Início cards with every card of the Reports registry so both
 * can be dropped into the interactive Home grid.
 */
import type { ReactNode } from 'react'
import { REPORT_CARDS_LIST, navigateToReport } from '@/data/reportRegistry'
import {
  BlockedWidget, ReadyWidget, TestingWidget, BacklogAlertWidget, MyQueueWidget,
  SprintWidget, ProjectsRagWidget,
  KpiBlockedWidget, KpiWipWidget, KpiSprintProgressWidget, KpiProjectsWidget, KpiDeliveredWidget,
  type WidgetCtx,
} from '@/components/home/nativeWidgets'
import { T } from '@/components/ds/tokens'

export type { WidgetCtx }

export type WidgetGroup = 'Início' | 'Relatórios'

export interface WidgetDef {
  id: string
  title: string
  group: WidgetGroup
  render: (ctx: WidgetCtx) => ReactNode
}

const NATIVE: WidgetDef[] = [
  { id: 'native.kpi-blocked',   title: 'KPI · Itens bloqueados',    group: 'Início', render: c => <KpiBlockedWidget {...c} /> },
  { id: 'native.kpi-wip',       title: 'KPI · Trabalho em andamento', group: 'Início', render: c => <KpiWipWidget {...c} /> },
  { id: 'native.kpi-sprint',    title: 'KPI · Progresso da sprint', group: 'Início', render: c => <KpiSprintProgressWidget {...c} /> },
  { id: 'native.kpi-projects',  title: 'KPI · Projetos no escopo',  group: 'Início', render: c => <KpiProjectsWidget {...c} /> },
  { id: 'native.kpi-delivered', title: 'KPI · Entregues',           group: 'Início', render: c => <KpiDeliveredWidget {...c} /> },
  { id: 'native.blocked',       title: 'Bloqueados',                group: 'Início', render: c => <BlockedWidget {...c} /> },
  { id: 'native.my-queue',      title: 'Minha fila',                group: 'Início', render: c => <MyQueueWidget {...c} /> },
  { id: 'native.sprint',        title: 'Sprint atual',              group: 'Início', render: c => <SprintWidget {...c} /> },
  { id: 'native.ready',         title: 'Prontos para desenvolvimento', group: 'Início', render: c => <ReadyWidget {...c} /> },
  { id: 'native.testing',       title: 'Aguardando teste',          group: 'Início', render: c => <TestingWidget {...c} /> },
  { id: 'native.backlog-alert', title: 'Backlog com alerta',        group: 'Início', render: c => <BacklogAlertWidget {...c} /> },
  { id: 'native.projects-rag',  title: 'Saúde dos projetos (RAG)',  group: 'Início', render: c => <ProjectsRagWidget {...c} /> },
]

const REPORTS: WidgetDef[] = REPORT_CARDS_LIST.map(entry => ({
  id: `report.${entry.id}`,
  title: entry.title,
  group: 'Relatórios' as const,
  render: (ctx: WidgetCtx) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: T.text3 }}>{entry.subtitle}</div>
      <entry.Component />
      <button
        className="no-drag"
        onClick={() => navigateToReport(entry, ctx.onNav)}
        style={{
          alignSelf: 'flex-start', fontSize: 11, color: T.accent,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        Abrir relatório →
      </button>
    </div>
  ),
}))

export const HOME_WIDGETS: WidgetDef[] = [...NATIVE, ...REPORTS]

export function getWidget(id: string): WidgetDef | undefined {
  return HOME_WIDGETS.find(w => w.id === id)
}

/** Widgets shown on the very first access, per dashboard/role. */
export function defaultWidgetIds(role: string): string[] {
  const base = ['native.kpi-blocked', 'native.kpi-wip', 'native.kpi-sprint', 'native.kpi-projects']
  switch (role) {
    case 'dev':           return [...base, 'native.my-queue', 'native.blocked', 'native.sprint']
    case 'qa':            return [...base, 'native.testing', 'native.blocked', 'native.sprint']
    case 'scrum-master':  return [...base, 'native.blocked', 'native.sprint', 'report.burndown']
    case 'product-owner':
    case 'product-manager': return [...base, 'native.ready', 'native.backlog-alert', 'native.projects-rag']
    case 'pmo':
    case 'admin':
    case 'project-manager': return [...base, 'native.projects-rag', 'native.blocked', 'native.sprint']
    default:              return [...base, 'native.my-queue', 'native.sprint']
  }
}
