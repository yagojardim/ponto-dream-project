import type { TourStep } from '@/components/onboarding/GuidedTour'
import type { RoleContext } from '@/data/session'

// Tours únicos por tela (iguais para todos os papéis).
export const TOUR_STEPS: Record<string, TourStep[]> = {
  'projects-list': [
    {
      selector: '[data-tour="new-project-btn"]',
      placement: 'bottom',
      title: 'Criar um projeto',
      body: 'Clique em “+ Novo Projeto” para abrir o formulário.',
      clickOnNext: '[data-tour="new-project-btn"]',
    },
    {
      selector: '[data-tour="project-basics"]',
      placement: 'right',
      title: 'Dados do projeto',
      body: 'Preencha os campos essenciais:',
      fields: [
        { label: 'Workspace', hint: 'sua organização (já vem preenchido).' },
        { label: 'Nome do projeto', hint: 'obrigatório — como o projeto será identificado.' },
        { label: 'Cliente', hint: 'para quem é o projeto (opcional).' },
      ],
    },
    {
      selector: '[data-tour="project-dates"]',
      placement: 'right',
      title: 'Tipo e período',
      body: 'Escolha Scrum ou Kanban e, se quiser, defina início e fim (alimenta Gantt/Timeline). Dá para ajustar depois.',
    },
    {
      selector: '[data-tour="project-save"]',
      placement: 'top',
      title: 'Criar',
      body: 'Revise e clique em “Criar” para salvar o projeto. (O tour não cria por você.)',
    },
  ],

  'boards-list': [
    {
      selector: '[data-tour="board-card"]',
      placement: 'bottom',
      title: 'Seus boards',
      body: 'Um quadro Kanban por projeto. Abra um board para trabalhar nele.',
      optional: true,
    },
    {
      selector: '[data-tour="board-tabs"]',
      placement: 'bottom',
      title: 'Board / Backlog / Sprints',
      body: 'Alterne entre o Kanban, o Backlog por sprint e a lista de Sprints.',
      optional: true,
    },
    {
      selector: '[data-tour="board-start-daily"]',
      placement: 'bottom',
      title: 'Iniciar Daily',
      body: 'Abre o board ao vivo para conduzir a daily.',
      optional: true,
    },
    {
      selector: '[data-tour="board-filters"]',
      placement: 'bottom',
      title: 'Filtros',
      body: 'Recorte o board por responsável, prioridade, tipo e funcionalidade.',
      optional: true,
    },
    {
      selector: '[data-tour="board-end-sprint"]',
      placement: 'bottom',
      title: 'Encerrar sprint',
      body: 'Ao fechar a sprint você decide o transbordo das demandas restantes e vê a velocity.',
      optional: true,
    },
  ],

  list: [
    {
      selector: '[data-tour="list-filters"]',
      placement: 'bottom',
      title: 'Filtrar demandas',
      body: 'Filtre por projeto, status, prioridade, tipo, responsável, sprint, épico e funcionalidade.',
    },
    {
      selector: '[data-tour="list-group"]',
      placement: 'bottom',
      title: 'Agrupar',
      body: 'Agrupe por Sprint ou Épico para revisar o que entra em cada ciclo.',
      optional: true,
    },
    {
      selector: '[data-tour="list-columns"]',
      placement: 'bottom',
      title: 'Colunas',
      body: 'Escolha quais colunas aparecem na tabela.',
      optional: true,
    },
    {
      selector: '[data-tour="list-export"]',
      placement: 'bottom',
      title: 'Exportar CSV',
      body: 'Leve os dados filtrados para fora em CSV.',
      optional: true,
    },
  ],

  calendar: [
    {
      selector: '[data-tour="cal-create"]',
      placement: 'bottom',
      title: 'Criar evento',
      body: 'Clique em “+ Criar” para agendar reuniões, cerimônias e marcos.',
    },
    {
      selector: '[data-tour="cal-views"]',
      placement: 'bottom',
      title: 'Mês / Semana / Dia',
      body: 'Alterne a visão do calendário; “Hoje” volta para o dia atual.',
    },
    {
      selector: '[data-tour="cal-sprint"]',
      placement: 'bottom',
      title: 'Sprint',
      body: 'Escolha a sprint para focar as cerimônias dela.',
      optional: true,
    },
    {
      selector: '[data-tour="cal-ceremonies"]',
      placement: 'bottom',
      title: 'Gerar cerimônias',
      body: 'Cria Daily, Planning, Review e Retro da sprint automaticamente.',
      optional: true,
    },
    {
      selector: '[data-tour="cal-integrate"]',
      placement: 'left',
      title: 'Integrar agenda',
      body: 'Conecte sua agenda Google para sincronizar os eventos.',
      optional: true,
    },
  ],
}

// Tours que variam por papel (só onde o layout muda: home e dashboard).
const HOME_TOUR: TourStep[] = [
  {
    selector: '[data-tour="home-cards"]',
    placement: 'bottom',
    title: 'Seu painel muda conforme o papel',
    body: 'Os cards do topo resumem o essencial do SEU escopo. O detalhe de cada card, por perfil, está na Central de Ajuda (Início).',
  },
  {
    selector: '[data-tour="home-projects"]',
    placement: 'left',
    title: 'Focar por projeto',
    body: 'Filtre os cards por um ou mais projetos.',
  },
  {
    selector: '[data-tour="home-edit"]',
    placement: 'left',
    title: 'Editar painel',
    body: 'Reorganize, inclua ou remova cards. “Restaurar padrão” volta ao layout do seu papel.',
  },
  {
    selector: '[data-tour="home-add"]',
    placement: 'bottom',
    title: 'Adicionar card',
    body: 'Acrescente indicadores ao seu Início.',
    optional: true,
  },
  {
    selector: '[data-tour="home-role"]',
    placement: 'left',
    title: 'Trocar de papel',
    body: 'Se você tem mais de um papel, alterne aqui — o painel se ajusta ao papel ativo.',
    optional: true,
  },
]

const DASH_TOUR: TourStep[] = [
  {
    selector: '[data-tour="dash-projects"]',
    placement: 'left',
    title: 'Selecionar projetos',
    body: 'Escolha 1 ou mais projetos para comparar indicadores.',
  },
  {
    selector: '[data-tour="dash-health"]',
    placement: 'bottom',
    title: 'Saúde dos projetos',
    body: 'Cada projeto aparece Saudável ou Bloqueado, com progresso e itens travados.',
  },
  {
    selector: '[data-tour="dash-impediments"]',
    placement: 'top',
    title: 'Impedimentos',
    body: 'As demandas bloqueadas e há quanto tempo. “Ver todos” abre a lista.',
    optional: true,
  },
]

const ALL_ROLES: RoleContext[] = [
  'Admin', 'PMO', 'ProjectManager', 'ProductManager', 'ProductOwner',
  'ScrumMaster', 'TechLead', 'Dev', 'UX', 'QA',
]

function byRole(steps: TourStep[]): Partial<Record<RoleContext, TourStep[]>> {
  return Object.fromEntries(ALL_ROLES.map(r => [r, steps])) as Partial<Record<RoleContext, TourStep[]>>
}

export const TOUR_STEPS_BY_ROLE: Record<string, Partial<Record<RoleContext, TourStep[]>>> = {
  home: byRole(HOME_TOUR),
  dashboard: byRole(DASH_TOUR),
}

export function tourStepsFor(view: string, role?: RoleContext | null): TourStep[] {
  const byRoleSteps = role ? TOUR_STEPS_BY_ROLE[view]?.[role] : undefined
  return byRoleSteps ?? TOUR_STEPS[view] ?? []
}

export function hasTour(view: string, role?: RoleContext | null): boolean {
  return tourStepsFor(view, role).length > 0
}

// Id de persistência: por view, e por view:role onde varia por papel.
export function tourIdFor(view: string, role?: RoleContext | null): string {
  return role && TOUR_STEPS_BY_ROLE[view]?.[role] ? `${view}:${role}` : view
}
