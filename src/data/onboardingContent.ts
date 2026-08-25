// Fonte única das dicas de onboarding (callouts inline + Central de Ajuda).
export interface OnboardingTip {
  title: string
  steps: string[]
}

export const ONBOARDING_TIPS: Record<string, OnboardingTip> = {
  home: {
    title: 'Início',
    steps: [
      'Seu painel muda conforme o papel (Admin, PO, Scrum Master, Tech Lead, Dev).',
      'Os cards do topo resumem o essencial do seu escopo.',
      'Use o seletor de projetos para focar em um projeto específico.',
    ],
  },
  'projects-list': {
    title: 'Projetos',
    steps: [
      'Clique em + Novo Projeto para criar.',
      'No ⋯ de cada projeto você edita descrição, período e equipe.',
      'Ainda no ⋯ é possível finalizar ou arquivar o projeto.',
    ],
  },
  'boards-list': {
    title: 'Boards',
    steps: [
      'Boards são seus quadros Kanban.',
      'Crie um board e abra para trabalhar nele.',
      'Arraste demandas entre as colunas para mudar o status.',
    ],
  },
  list: {
    title: 'Lista',
    steps: [
      'Visão em tabela de todas as demandas.',
      'Filtre por tipo, status, épico, responsável e funcionalidade.',
    ],
  },
  gantt: {
    title: 'Gantt',
    steps: [
      'Cronograma por datas, com dependências e prazos.',
      'O período cadastrado no projeto define a régua do gráfico.',
    ],
  },
  timeline: {
    title: 'Timeline',
    steps: [
      'Linha do tempo em três níveis: Projeto → Funcionalidade → demanda.',
      'Arraste ou redimensione as barras para ajustar datas — as mudanças persistem.',
    ],
  },
  epics: {
    title: 'Épicos',
    steps: [
      'Organize o trabalho em épicos e funcionalidades.',
      'Em projetos Pro, veja a árvore completa com roll-up de pontos.',
    ],
  },
  storage: {
    title: 'Armazenamento',
    steps: [
      'Gerencie uploads do time.',
      'Acompanhe o consumo de armazenamento por projeto.',
    ],
  },
  modules: {
    title: 'Módulos',
    steps: [
      'Vitrine de módulos premium da plataforma.',
      'Use Testar grátis (30 dias) ou solicite a ativação definitiva.',
    ],
  },
  automations: {
    title: 'Automações',
    steps: [
      'Crie regras no formato quando X → faça Y.',
      'Use para automatizar passos repetitivos do fluxo do time.',
    ],
  },
  'tenant-settings': {
    title: 'Config. do Tenant',
    steps: [
      'Defina identidade, slug e dados do tenant.',
      'É aqui que você define o Admin Master.',
    ],
  },
  config: {
    title: 'Configurações',
    steps: ['Ajustes gerais da plataforma.'],
  },
  team: {
    title: 'Time & Permissões',
    steps: [
      'Cadastre novos usuários e defina o papel de cada um.',
      'As capabilities liberadas no cadastro controlam o acesso às telas.',
    ],
  },
  'client-access': {
    title: 'Criar Acesso de Cliente',
    steps: [
      'Gere o acesso do cliente ao portal.',
      'Escolha o que ele pode ver, comentar e aprovar.',
    ],
  },
  client: {
    title: 'Portal Cliente',
    steps: [
      'Acompanhe entregas, comente e aprove.',
      'Alterne entre o dashboard e as mensagens.',
    ],
  },
  reports: {
    title: 'Relatórios',
    steps: [
      'Indicadores reais: velocity, burndown, CFD, RAG e workload.',
      'Filtre por projeto para comparar escopos.',
    ],
  },
  timesheet: {
    title: 'Lançar horas',
    steps: [
      'Registre horas por demanda.',
      'Envie o período para aprovação quando terminar.',
    ],
  },
  'hours-approval': {
    title: 'Aprovar horas',
    steps: [
      'Aprove ou reprove os lançamentos da sua squad.',
      'Exporte os dados em CSV quando precisar.',
    ],
  },
  'my-tasks': {
    title: 'Minha Fila',
    steps: [
      'Todas as demandas atribuídas a você.',
      'Priorize o que está bloqueado ou em revisão.',
    ],
  },
  calendar: {
    title: 'Calendário',
    steps: [
      'Prazos e cerimônias da sprint em um só lugar.',
      'Gere as cerimônias e conecte sua agenda Google.',
    ],
  },
  releases: {
    title: 'Releases',
    steps: [
      'Agrupe entregas por versão.',
      'Crie a release e vincule as demandas do projeto.',
      'Use Fechar release para separar entregues × retornados.',
    ],
  },
}
