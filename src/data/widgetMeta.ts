// Metadados de apresentação dos cards no modal "Adicionar card":
// categoria (tema), resumo de 1 linha e o tipo de thumbnail (mini-visualização).
// Chaveado pelo id do WidgetDef (ver src/data/homeWidgets.tsx).

export type WidgetViz =
  | 'number' | 'donut' | 'down' | 'bars' | 'rag' | 'burndown'
  | 'target' | 'progress' | 'lines' | 'alert' | 'list' | 'grid'

export interface WidgetMeta {
  category: string
  summary: string
  viz: WidgetViz
}

// Ordem de exibição das categorias no modal.
export const WIDGET_CATEGORY_ORDER: string[] = [
  'Visão geral',
  'Minha fila',
  'Produto & Adoção',
  'Backlog & Prontidão',
  'Sprint & Cerimônias',
  'Qualidade & Técnico',
  'Design / UX',
  'Portfólio & Gestão',
  'Administração',
  'Relatórios',
]

export const WIDGET_META: Record<string, WidgetMeta> = {
  // ── Visão geral ──
  'native.kpi-blocked':   { category: 'Visão geral', viz: 'alert',  summary: 'Quantas demandas estão bloqueadas agora.' },
  'native.kpi-wip':       { category: 'Visão geral', viz: 'number', summary: 'Itens em andamento (trabalho em progresso).' },
  'native.kpi-sprint':    { category: 'Visão geral', viz: 'burndown', summary: '% de conclusão da sprint atual.' },
  'native.kpi-projects':  { category: 'Visão geral', viz: 'number', summary: 'Quantos projetos estão no seu escopo.' },
  'native.kpi-delivered': { category: 'Visão geral', viz: 'bars',   summary: 'Demandas entregues no período.' },

  // ── Minha fila ──
  'native.kpi-my-items':   { category: 'Minha fila', viz: 'number', summary: 'Suas demandas ativas no momento.' },
  'native.kpi-my-late':    { category: 'Minha fila', viz: 'alert',  summary: 'Suas demandas com prazo estourado.' },
  'native.kpi-my-blocked': { category: 'Minha fila', viz: 'alert',  summary: 'Suas demandas bloqueadas aguardando ação.' },
  'native.blocked':        { category: 'Minha fila', viz: 'list',   summary: 'Lista das demandas bloqueadas.' },
  'native.my-queue':       { category: 'Minha fila', viz: 'list',   summary: 'Sua fila de trabalho priorizada.' },
  'native.ready':          { category: 'Minha fila', viz: 'list',   summary: 'Itens prontos para desenvolvimento.' },
  'native.testing':        { category: 'Minha fila', viz: 'list',   summary: 'Itens aguardando teste.' },
  'native.backlog-alert':  { category: 'Minha fila', viz: 'list',   summary: 'Backlog com pendências (critério, épico…).' },
  'native.my-active-queue':{ category: 'Minha fila', viz: 'list',   summary: 'Sua fila ativa detalhada.' },
  'native.my-blocked':     { category: 'Minha fila', viz: 'list',   summary: 'Seus itens bloqueados, em detalhe.' },
  'native.recent-activity':{ category: 'Minha fila', viz: 'list',   summary: 'Atividades recentes no seu escopo.' },

  // ── Produto & Adoção ──
  'native.kpi-mau':          { category: 'Produto & Adoção', viz: 'number', summary: 'Usuários ativos mensais do produto.' },
  'native.kpi-stickiness':   { category: 'Produto & Adoção', viz: 'donut',  summary: 'Razão DAU/MAU — recorrência de uso.' },
  'native.kpi-churn':        { category: 'Produto & Adoção', viz: 'down',   summary: '% de usuários que deixaram de usar.' },
  'native.kpi-adoption':     { category: 'Produto & Adoção', viz: 'bars',   summary: '% de usuários que usam cada recurso.' },
  'native.funnel':           { category: 'Produto & Adoção', viz: 'bars',   summary: 'Funil de conversão por etapa.' },
  'native.feature-adoption': { category: 'Produto & Adoção', viz: 'bars',   summary: 'Adoção das principais funcionalidades.' },

  // ── Backlog & Prontidão ──
  'native.kpi-po-ready':        { category: 'Backlog & Prontidão', viz: 'donut', summary: '% do backlog pronto para dev.' },
  'native.kpi-backlog-health':  { category: 'Backlog & Prontidão', viz: 'rag',   summary: 'Itens sem critério, épico ou estimativa.' },
  'native.kpi-created-vs-done': { category: 'Backlog & Prontidão', viz: 'lines', summary: 'Ritmo: abertas × concluídas.' },
  'native.kpi-releases-health': { category: 'Backlog & Prontidão', viz: 'progress', summary: 'Progresso e estado das releases.' },
  'native.po-team':             { category: 'Backlog & Prontidão', viz: 'grid',  summary: 'Time atuando no projeto.' },
  'native.stuck-aging':         { category: 'Backlog & Prontidão', viz: 'bars',  summary: 'Itens parados e aging do WIP.' },

  // ── Sprint & Cerimônias ──
  'native.kpi-sprint-health': { category: 'Sprint & Cerimônias', viz: 'burndown', summary: 'Saúde/burndown da sprint atual.' },
  'native.kpi-impediments':   { category: 'Sprint & Cerimônias', viz: 'alert',    summary: 'Impedimentos abertos na sprint.' },
  'native.kpi-sprint-goal':   { category: 'Sprint & Cerimônias', viz: 'target',   summary: 'Objetivo da sprint e progresso.' },
  'native.sprint':            { category: 'Sprint & Cerimônias', viz: 'list',     summary: 'Demandas da sprint atual.' },
  'native.ceremonies':        { category: 'Sprint & Cerimônias', viz: 'grid',     summary: 'Cerimônias agendadas da sprint.' },
  'native.delivery-rhythm':   { category: 'Sprint & Cerimônias', viz: 'lines',    summary: 'Ritmo de entrega ao longo do tempo.' },

  // ── Qualidade & Técnico ──
  'native.kpi-critical-bugs': { category: 'Qualidade & Técnico', viz: 'alert',  summary: 'Bugs críticos abertos.' },
  'native.kpi-leadtime':      { category: 'Qualidade & Técnico', viz: 'number', summary: 'Tempo médio da criação à entrega.' },
  'native.kpi-throughput':    { category: 'Qualidade & Técnico', viz: 'bars',   summary: 'Vazão: itens concluídos por período.' },
  'native.kpi-rework':        { category: 'Qualidade & Técnico', viz: 'donut',  summary: '% de retrabalho nas demandas.' },
  'native.kpi-qa-queue':      { category: 'Qualidade & Técnico', viz: 'number', summary: 'Itens aguardando teste.' },
  'native.kpi-qa-bugs':       { category: 'Qualidade & Técnico', viz: 'alert',  summary: 'Bugs críticos na visão de QA.' },
  'native.kpi-qa-rejection':  { category: 'Qualidade & Técnico', viz: 'down',   summary: 'Taxa de rejeição em testes.' },
  'native.kpi-qa-evidence':   { category: 'Qualidade & Técnico', viz: 'number', summary: 'Evidências de teste pendentes.' },
  'native.review-queue':      { category: 'Qualidade & Técnico', viz: 'list',   summary: 'Gargalos de PRs / revisão.' },
  'native.test-execution':    { category: 'Qualidade & Técnico', viz: 'list',   summary: 'Fila de execução de testes.' },
  'native.qa-coverage':       { category: 'Qualidade & Técnico', viz: 'bars',   summary: 'Aging e rejeição na visão de QA.' },

  // ── Design / UX ──
  'native.kpi-ux-flows':      { category: 'Design / UX', viz: 'number', summary: 'Fluxos em design no momento.' },
  'native.kpi-ux-prototypes': { category: 'Design / UX', viz: 'number', summary: 'Protótipos aguardando validação.' },
  'native.kpi-ux-pending':    { category: 'Design / UX', viz: 'alert',  summary: 'Pendências de UX críticas.' },
  'native.kpi-ux-handoff':    { category: 'Design / UX', viz: 'donut',  summary: '% de handoff pronto para dev.' },
  'native.design-queue':      { category: 'Design / UX', viz: 'list',   summary: 'Fila de design ativa.' },
  'native.design-validation': { category: 'Design / UX', viz: 'list',   summary: 'Validações de design em andamento.' },
  'native.design-system':     { category: 'Design / UX', viz: 'alert',  summary: 'Alertas do design system.' },

  // ── Portfólio & Gestão ──
  'native.kpi-pmo-active':     { category: 'Portfólio & Gestão', viz: 'number', summary: 'Projetos ativos no portfólio.' },
  'native.kpi-pmo-risk':       { category: 'Portfólio & Gestão', viz: 'alert',  summary: 'Projetos em risco ou atrasados.' },
  'native.kpi-predictability': { category: 'Portfólio & Gestão', viz: 'donut',  summary: 'Previsibilidade das entregas.' },
  'native.kpi-planned-done':   { category: 'Portfólio & Gestão', viz: 'bars',   summary: 'Planejado × concluído.' },
  'native.kpi-pm-progress':    { category: 'Portfólio & Gestão', viz: 'donut',  summary: 'Progresso geral do projeto.' },
  'native.kpi-pm-deadline':    { category: 'Portfólio & Gestão', viz: 'number', summary: 'Prazo restante do projeto.' },
  'native.projects-rag':       { category: 'Portfólio & Gestão', viz: 'rag',    summary: 'Semáforo RAG dos projetos.' },
  'native.pmo-rag':            { category: 'Portfólio & Gestão', viz: 'rag',    summary: 'Saúde por projeto (RAG).' },
  'native.pm-rag':             { category: 'Portfólio & Gestão', viz: 'rag',    summary: 'Saúde do projeto principal (RAG).' },
  'native.critical-blockers':  { category: 'Portfólio & Gestão', viz: 'alert',  summary: 'Bloqueadores críticos do portfólio.' },
  'native.planned-done':       { category: 'Portfólio & Gestão', viz: 'bars',   summary: 'Planejado × concluído, em detalhe.' },
  'native.team-workload':      { category: 'Portfólio & Gestão', viz: 'bars',   summary: 'Carga de trabalho do time.' },
  'native.roadmap':            { category: 'Portfólio & Gestão', viz: 'grid',   summary: 'Roadmap estratégico por período.' },

  // ── Administração ──
  'native.kpi-admin-projects': { category: 'Administração', viz: 'number', summary: 'Projetos do tenant.' },
  'native.kpi-admin-boards':   { category: 'Administração', viz: 'number', summary: 'Boards do tenant.' },
  'native.kpi-admin-modules':  { category: 'Administração', viz: 'number', summary: 'Módulos ativos no tenant.' },
  'native.kpi-admin-users':    { category: 'Administração', viz: 'number', summary: 'Usuários da conta.' },
  'native.kpi-admin-invites':  { category: 'Administração', viz: 'number', summary: 'Convites pendentes.' },
  'native.admin-users':        { category: 'Administração', viz: 'grid',   summary: 'Usuários e convites do tenant.' },
  'native.admin-modules':      { category: 'Administração', viz: 'grid',   summary: 'Módulos contratados/ativos.' },
  'native.admin-audit':        { category: 'Administração', viz: 'list',   summary: 'Auditoria de marcos do tenant.' },
  'native.client-feed':        { category: 'Administração', viz: 'list',   summary: 'Feed de sinais dos clientes.' },

  // ── Relatórios ──
  'report.burndown': { category: 'Relatórios', viz: 'burndown', summary: 'Story points restantes vs. ideal na sprint.' },
  'report.velocity': { category: 'Relatórios', viz: 'bars',     summary: 'Story points entregues por sprint.' },
  'report.cfd':      { category: 'Relatórios', viz: 'bars',     summary: 'Distribuição de itens por status (CFD).' },
  'report.bugs':     { category: 'Relatórios', viz: 'bars',     summary: 'Bugs abertos por severidade.' },
  'report.criados':  { category: 'Relatórios', viz: 'lines',    summary: 'Demandas criadas × resolvidas.' },
  'report.workload': { category: 'Relatórios', viz: 'bars',     summary: 'Story points ativos por pessoa.' },
  'report.aging':    { category: 'Relatórios', viz: 'bars',     summary: 'Dias no status atual por demanda.' },
  'report.leadtime': { category: 'Relatórios', viz: 'number',   summary: 'Lead time e cycle time médios.' },
  'report.health':   { category: 'Relatórios', viz: 'rag',      summary: 'Score de saúde do projeto (5 dimensões).' },
  'report.epic':     { category: 'Relatórios', viz: 'burndown', summary: 'Burndown por épico / release.' },
}

/** Metadados de um card, com fallback pela categoria do grupo (Início/Relatórios). */
export function widgetMetaFor(id: string, group: string, kind: 'kpi' | 'card'): WidgetMeta {
  const meta = WIDGET_META[id]
  if (meta) return meta
  const fallbackViz: WidgetViz = kind === 'kpi' ? 'number' : 'grid'
  return { category: group, summary: '', viz: fallbackViz }
}
