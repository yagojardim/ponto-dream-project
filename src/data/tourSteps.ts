import type { TourStep } from '@/components/onboarding/GuidedTour'
import type { RoleContext } from '@/data/session'

// Tours únicos por tela (iguais para todos os papéis).
export const TOUR_STEPS: Record<string, TourStep[]> = {
  'projects-list': [
    {
      selector: '[data-tour="new-project-btn"]',
      placement: 'bottom',
      title: 'Criar um projeto',
      body: 'Clique em "+ Novo Projeto" para abrir o formulário.',
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
      selector: '[data-tour="project-key-type"]',
      placement: 'right',
      title: 'Chave e tipo',
      body: 'Mais dois campos importantes:',
      fields: [
        { label: 'Chave', hint: 'código curto em maiúsculas (ex.: WEB) usado como prefixo das demandas — WEB-101. Único no tenant.' },
        { label: 'Tipo', hint: 'Scrum (trabalho em sprints) ou Kanban (fluxo contínuo). Define as colunas padrão do board.' },
      ],
    },
    {
      selector: '[data-tour="project-dates"]',
      placement: 'right',
      title: 'Tipo e período',
      body: 'Escolha Scrum ou Kanban e, se quiser, defina início e fim (alimenta Gantt/Timeline). Dá para ajustar depois.',
    },
    {
      selector: '[data-tour="project-structure"]',
      placement: 'right',
      title: 'Estrutura, responsável e descrição',
      body: 'Para fechar o cadastro:',
      fields: [
        { label: 'Estrutura de trabalho', hint: 'ative "Usar Funcionalidades" para ter Épico → Funcionalidade → História; desligado é Épico → História.' },
        { label: 'Responsável', hint: 'lead do projeto — é adicionado automaticamente como membro.' },
        { label: 'Descrição', hint: 'objetivo/resumo do projeto (opcional).' },
      ],
    },

    {
      selector: '[data-tour="project-save"]',
      placement: 'top',
      title: 'Criar',
      body: 'Revise e clique em "Criar" para salvar o projeto. (O tour não cria por você.)',
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
      selector: '[data-tour="board-new"]',
      placement: 'bottom',
      title: 'Criar um board',
      body: 'Crie boards adicionais como visões filtradas do mesmo projeto (ex.: por squad, só bugs, por componente).',
      optional: true,
    },
    {
      selector: '[data-tour="board-switcher"]',
      placement: 'bottom',
      title: 'Trocar de board',
      body: 'Alterne entre os boards do projeto. O board padrão mostra todas as demandas.',
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
      body: 'Clique em "+ Criar" para agendar reuniões, cerimônias e marcos.',
    },
    {
      selector: '[data-tour="cal-views"]',
      placement: 'bottom',
      title: 'Mês / Semana / Dia',
      body: 'Alterne a visão do calendário; "Hoje" volta para o dia atual.',
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

  'my-tasks': [
    { selector: '[data-tour="mf-cards"]', navigateTo: 'my-tasks', placement: 'bottom', title: 'Resumo da sua fila', body: 'Os cards do topo resumem: Total, Em Dev, Em Revisão, Bloqueados, Prioridade Alta/Crítica e Concluídos.', optional: true },
    { selector: '[data-tour="mf-tools"]', placement: 'bottom', title: 'Filtrar, agrupar e ordenar', body: 'Busque por texto, agrupe por Status/Prioridade/Sprint/Projeto e ordene por Prioridade/Status/Prazo.', optional: true },
    { selector: '[data-tour="mf-board"]', placement: 'left', title: 'Ver board', body: 'Abre o Kanban do contexto atual para você atuar na demanda.', optional: true },
  ],

  epics: [
    { selector: '[data-tour="epics-card"]', navigateTo: 'epics', placement: 'bottom', title: 'Épicos por projeto', body: 'Cada épico mostra o anel de progresso, o detalhamento por status e o total de story points.', optional: true },
    { selector: '[data-tour="epics-issues"]', placement: 'bottom', title: 'Ver issues do épico', body: 'Expanda para ver as demandas que compõem o épico.', optional: true },
    { selector: '[data-tour="epics-new"]', placement: 'left', title: 'Novo épico', body: 'Crie um épico no projeto. Em projetos Pro dá para adicionar Funcionalidades dentro do épico.', optional: true, clickOnNext: '[data-tour="epics-new"]' },
  ],

  releases: [
    { selector: '[data-tour="releases-card"]', navigateTo: 'releases', placement: 'bottom', title: 'Releases por versão', body: 'Cada release traz versão, estado, progresso e as issues vinculadas. Em "Editar" você ajusta e fecha a release.', optional: true },
    { selector: '[data-tour="releases-new"]', placement: 'left', title: 'Nova release', body: 'Crie uma versão e vincule as demandas que entram na entrega.', optional: true, clickOnNext: '[data-tour="releases-new"]' },
  ],

  filters: [
    { selector: '[data-tour="filters-builder"]', navigateTo: 'filters', placement: 'right', title: 'Construtor de filtros', body: 'Escolha a lógica do grupo (AND/OR) e vá somando condições.', optional: true },
    { selector: '[data-tour="filters-add"]', placement: 'right', title: 'Adicionar condição', body: 'Cada condição refina a busca (tipo, status, prioridade, responsável, sprint, épico…).', optional: true },
    { selector: '[data-tour="filters-saved"]', placement: 'right', title: 'Filtros salvos', body: 'Salve buscas recorrentes e use "Aplicar como visão" para transformar o filtro numa visão.', optional: true },
  ],

  navigator: [
    { selector: '[data-tour="nav-quickfilter"]', navigateTo: 'navigator', placement: 'bottom', title: 'Filtro rápido', body: 'Busque e ordene por qualquer coluna (Chave, Status, Prioridade, Sprint, Épico, Prazo…).', optional: true },
    { selector: '[data-tour="nav-columns"]', placement: 'bottom', title: 'Colunas', body: 'Escolha quais colunas aparecem na tabela.', optional: true },
    { selector: '[data-tour="nav-bulk"]', placement: 'bottom', title: 'Edição em massa', body: 'Marque vários itens e use "Bulk Change" para alterar status/prioridade/responsável de uma vez. "Exportar" leva para CSV.', optional: true },
  ],

  reports: [
    { selector: '[data-tour="reports-cards"]', navigateTo: 'reports', placement: 'bottom', title: 'Indicadores', body: 'Burndown, Velocity, CFD, Bugs por Severidade, Criados vs Resolvidos e Workload por Pessoa.', optional: true },
    { selector: '[data-tour="reports-assign"]', placement: 'left', title: 'Liberar / atribuir relatórios', body: 'Controle quais relatórios ficam visíveis e para quais papéis, em "Gerenciar atribuições".', optional: true },
  ],

  config: [
    { selector: '[data-tour="config-tabs"]', navigateTo: 'config', placement: 'right', title: 'Abas de configuração', body: 'Workflow, Tipos de Demanda, Componentes, Labels, Prioridades e Config do Board.', optional: true },
    { selector: '[data-tour="config-workflow"]', placement: 'bottom', title: 'Editor de Workflow', body: 'Gerencie os status por categoria (arraste para reordenar, remova, adicione). Reflete no Board e na seleção de status das issues.', optional: true },
  ],

  'tenant-settings': [
    { selector: '[data-tour="tenant-slug"]', navigateTo: 'tenant-settings', placement: 'bottom', title: 'Endereço público (slug)', body: 'O slug é o endereço pelo qual o portal do cliente é acessado (mínimo 3 caracteres, minúsculas/números/hífen).', optional: true },
    { selector: '[data-tour="tenant-identity"]', placement: 'bottom', title: 'Identidade e localização', body: 'Nome de exibição, logo, cor primária, fuso horário e idioma. Clique em "Salvar alterações".', optional: true },
  ],

  modules: [
    { selector: '[data-tour="modules-counters"]', navigateTo: 'modules', placement: 'bottom', title: 'Vitrine de módulos', body: 'Contadores por situação (Implementados, Em preview, Solicitados, Disponíveis) e filtros por categoria.', optional: true },
    { selector: '[data-tour="modules-card"]', placement: 'bottom', title: 'Abrir um módulo', body: 'Cada card mostra estado e funcionalidades; abra para ver detalhes, testar grátis ou solicitar a ativação.', optional: true },
  ],

  automations: [
    { selector: '[data-tour="automations-list"]', navigateTo: 'automations', placement: 'right', title: 'Automações', body: 'Suas regras ativas/pausadas no formato "quando X → faça Y".', optional: true },
    { selector: '[data-tour="automations-editor"]', placement: 'left', title: 'Disparador → Condição → Ação', body: 'Monte a regra: gatilho, condição opcional e ação. Teste em "Executar agora" e acompanhe o Log de execuções.', optional: true },
    { selector: '[data-tour="automations-new"]', placement: 'left', title: 'Nova automação', body: 'Crie uma regra nova.', optional: true, clickOnNext: '[data-tour="automations-new"]' },
  ],

  team: [
    { selector: '[data-tour="team-tabs"]', navigateTo: 'team', placement: 'bottom', title: 'Membros e permissões', body: 'Abas: Membros, Convites, Matriz de Permissões e Dashboards.', optional: true },
    { selector: '[data-tour="team-invite"]', placement: 'left', title: 'Convidar membro', body: 'Assistente para cadastrar dados, papel, squad, módulos e dashboard.', optional: true, clickOnNext: '[data-tour="team-invite"]' },
    { selector: '[data-tour="team-actions"]', placement: 'left', title: 'Ações do membro', body: 'Editar, gerar link de acesso, suspender ou desativar cada membro.', optional: true },
  ],

  'client-access': [
    { selector: '[data-tour="ca-start"]', navigateTo: 'client-access', placement: 'bottom', title: 'Acesso do cliente', body: 'Assistente de 3 passos: Dados do cliente, Projetos compartilhados e Permissão.', optional: true },
    { selector: '[data-tour="ca-permission"]', placement: 'bottom', title: 'Permissão', body: 'Defina Visualizador ou Administrador e os responsáveis. Um e-mail com login e senha temporária é enviado ao cliente.', optional: true },
  ],

  timesheet: [
    { selector: '[data-tour="ts-new"]', navigateTo: 'timesheet', placement: 'bottom', title: 'Novo lançamento', body: 'Escolha a data, busque a demanda (nome/chave/épico), informe as horas e uma descrição opcional.', optional: true },
    { selector: '[data-tour="ts-filters"]', placement: 'bottom', title: 'Acompanhar', body: 'Filtre por Salvo/Enviado/Aprovado/Rejeitado e por mês.', optional: true },
    { selector: '[data-tour="ts-submit"]', placement: 'top', title: 'Enviar para aprovação', body: 'Escolha o período e envie os lançamentos salvos ao aprovador.', optional: true },
  ],

  'hours-approval': [
    { selector: '[data-tour="ha-filters"]', navigateTo: 'hours-approval', placement: 'bottom', title: 'Fila de aprovação', body: 'Lançamentos agrupados por colaborador; filtre por status e por squad.', optional: true },
    { selector: '[data-tour="ha-actions"]', placement: 'left', title: 'Aprovar ou rejeitar', body: 'Aprove/rejeite item a item, ou use "Aprovar todos / Rejeitar todos" por colaborador.', optional: true },
    { selector: '[data-tour="ha-export"]', placement: 'left', title: 'Exportar CSV', body: 'Leve os dados de horas para relatórios externos.', optional: true },
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
    body: 'Reorganize, inclua ou remova cards. "Restaurar padrão" volta ao layout do seu papel.',
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
    body: 'As demandas bloqueadas e há quanto tempo. "Ver todos" abre a lista.',
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

// ── Tours extras (sob demanda) — não entram em hasTour nem no auto-início ──
export const EXTRA_TOURS: Record<string, { id: string; label: string; steps: TourStep[] }[]> = {
  'boards-list': [
    {
      id: 'board-views',
      label: 'Trocar a visão: Board, Backlog e Sprints',
      steps: [
        { selector: '[data-tour="board-tabs"]', navigateTo: 'project', placement: 'bottom', title: 'As três visões do board', body: 'Alterne entre Board (a sprint atual em colunas), Backlog (demandas do projeto ainda sem sprint) e Sprints (planejar e acompanhar as sprints deste board).' },
      ],
    },
    {
      id: 'board-daily',
      label: 'Conduzir a Daily',
      steps: [
        { selector: '[data-tour="board-start-daily"]', navigateTo: 'project', placement: 'bottom', title: 'Iniciar a Daily', body: 'Clique aqui para abrir o modo Daily ao vivo. (O tour abre para você.) Requer a permissão Gerenciar Sprint.', clickOnNext: '[data-tour="board-start-daily"]' },
        { selector: '[data-tour="daily-members"]', placement: 'right', title: 'A fila do time', body: 'A daily percorre pessoa a pessoa. Quem está falando fica destacado e o cronômetro do topo mede o tempo de cada um — use "Limite por dev" para não estourar.', optional: true },
        { selector: '[data-tour="daily-next"]', placement: 'bottom', title: 'Passar a vez', body: 'Marca quem acabou de falar e avança para o próximo membro, zerando o cronômetro.', optional: true },
        { selector: '[data-tour="daily-board"]', placement: 'top', title: 'Atualizar ao vivo', body: 'Réplica do board da sprint. Arraste os cards entre as colunas para atualizar o status enquanto a pessoa fala — a mudança é salva na hora.', optional: true },
        { selector: '[data-tour="daily-end"]', placement: 'bottom', title: 'Encerrar a reunião', body: 'Fecha a daily e mostra o resumo: quantos membros falaram e o tempo total. (O tour não encerra por você.)', optional: true },
      ],
    },
    {
      id: 'board-close-sprint',
      label: 'Encerrar a sprint',
      steps: [
        { selector: '[data-tour="board-end-sprint"]', navigateTo: 'project', placement: 'bottom', title: 'Encerrar sprint', body: 'Clique aqui para abrir o encerramento da sprint. (O tour abre para você.) O botão só fica ativo com uma sprint ativa selecionada.', clickOnNext: '[data-tour="board-end-sprint"]' },
        { selector: '[data-tour="cs-summary"]', placement: 'bottom', title: 'Resumo da sprint', body: 'Concluídas, Restantes e Total das demandas — a base da velocity, calculada pelas concluídas.', optional: true },
        { selector: '[data-tour="cs-bulk"]', placement: 'bottom', title: 'Transbordo em massa', body: 'Atalhos para mandar todas as demandas restantes de uma vez: para a próxima sprint ou de volta ao backlog.', optional: true },
        { selector: '[data-tour="cs-items"]', placement: 'top', title: 'Destino por demanda', body: 'Ajuste caso a caso o destino de cada demanda não concluída — próxima sprint ou backlog.', optional: true },
        { selector: '[data-tour="cs-confirm"]', placement: 'top', title: 'Concluir', body: 'Ao confirmar, a velocity é registrada e as demandas restantes seguem o destino escolhido. Um comentário de conclusão é obrigatório. (O tour não conclui por você.)', optional: true },
      ],
    },
  ],
  calendar: [
    {
      id: 'calendar-create',
      label: 'Criar um evento (campo a campo)',
      steps: [
        { selector: '[data-tour="cal-create"]', navigateTo: 'calendar', placement: 'bottom', title: 'Criar um evento', body: 'Clique aqui para abrir o formulário de novo evento. (O tour abre para você.)', clickOnNext: '[data-tour="cal-create"]' },
        { selector: '[data-tour="cc-title"]', placement: 'right', title: 'Título', body: 'O nome do evento — único campo obrigatório. É o que aparece no calendário.', optional: true },
        { selector: '[data-tour="cc-type"]', placement: 'right', title: 'Tipo do evento', body: 'Reunião, Daily, Planning, Review, Retro… O tipo escolhido já define a cor do evento no calendário.', optional: true },
        { selector: '[data-tour="cc-when"]', placement: 'right', title: 'Quando acontece', body: 'Defina o período do evento:', fields: [{ label: 'Dia inteiro', hint: 'ative para eventos sem horário fixo (ocupam o dia todo).' }, { label: 'Data', hint: 'o dia do evento.' }, { label: 'Início e Fim', hint: 'o horário — aparece logo abaixo quando "Dia inteiro" está desligado.' }], optional: true },
        { selector: '[data-tour="cc-guests"]', placement: 'right', title: 'Convidados', body: 'Busque pessoas por nome ou e-mail e adicione como participantes. Some quantas quiser.', optional: true },
        { selector: '[data-tour="cc-meet"]', placement: 'right', title: 'Videochamada', body: 'Cole o link da reunião (Meet, Zoom…). Ele fica acessível no detalhe do evento, com botão de copiar.', optional: true },
        { selector: '[data-tour="cc-desc"]', placement: 'right', title: 'Descrição', body: 'Pauta, objetivo ou observações do evento (opcional). Fica sempre visível, sem precisar abrir "Mais opções".', optional: true },
        { selector: '[data-tour="cc-more"]', placement: 'right', title: 'Mais opções', body: 'Clique para abrir os campos avançados. (O tour abre para você.)', clickOnNext: '[data-tour="cc-more"]', optional: true },
        { selector: '[data-tour="cc-extra"]', placement: 'right', title: 'Campos avançados', body: 'Detalhes opcionais do evento:', fields: [{ label: 'Local', hint: 'onde acontece (sala, endereço).' }, { label: 'Cor', hint: 'sobrescreve a cor do tipo, se quiser.' }, { label: 'Work item', hint: 'vincula a uma demanda (ex.: ALT-139).' }, { label: 'Lembrete', hint: 'aviso antes do evento (5 min a 1 dia).' }], optional: true },
        { selector: '[data-tour="cc-save"]', placement: 'top', title: 'Salvar', body: 'Revise e clique em Salvar para criar o evento. (O tour não salva por você.)', optional: true },
      ],
    },
    {
      id: 'calendar-views',
      label: 'Ver por Mês, Semana e Dia',
      steps: [
        { selector: '[data-tour="cal-views"]', navigateTo: 'calendar', placement: 'bottom', title: 'Três formas de ver', body: 'O calendário tem três visões. Vamos passar por cada uma — a tela vai mudar a cada "Próximo".', clickOnNext: '[data-tour="cal-view-month"]' },
        { selector: '[data-tour="cal-view-month"]', placement: 'bottom', title: 'Mês', body: 'Panorama do mês inteiro: cada dia é uma célula com os eventos e prazos resumidos. Bom para enxergar o todo.', clickOnNext: '[data-tour="cal-view-week"]' },
        { selector: '[data-tour="cal-view-week"]', placement: 'bottom', title: 'Semana', body: 'Os 7 dias lado a lado numa grade de horários (08h–20h). O dia atual fica destacado e cada evento aparece no seu horário.', clickOnNext: '[data-tour="cal-view-day"]' },
        { selector: '[data-tour="cal-view-day"]', placement: 'bottom', title: 'Dia', body: 'Agenda detalhada de um único dia, hora a hora, com uma linha marcando o horário atual. Clique num horário livre para criar um evento ali.' },
      ],
    },
    {
      id: 'calendar-ceremonies',
      label: 'Gerar as cerimônias da sprint',
      steps: [
        { selector: '[data-tour="cal-sprint"]', navigateTo: 'calendar', placement: 'bottom', title: 'Escolha a sprint', body: 'Este seletor define de qual sprint as cerimônias serão geradas. É o alvo do botão ao lado.', optional: true },
        { selector: '[data-tour="cal-ceremonies"]', placement: 'bottom', title: 'Abrir o gerador', body: 'Clique para abrir o gerador de cerimônias da sprint escolhida. (O tour abre para você.)', clickOnNext: '[data-tour="cal-ceremonies"]', optional: true },
        { selector: '[data-tour="sc-slot"]', placement: 'bottom', title: 'Configurar cada cerimônia', body: 'Uma linha por cerimônia (Daily, Planning, Review, Retro…). Em cada uma você define:', fields: [{ label: 'Ativar', hint: 'a caixa liga/desliga a cerimônia na geração.' }, { label: 'Dias', hint: 'em quais dias da semana ela ocorre.' }, { label: 'Ocorrência', hint: 'todas as ocorrências, só a primeira ou só a última da sprint.' }, { label: 'Horário', hint: 'hora de início e fim.' }], optional: true },
        { selector: '[data-tour="sc-generate"]', placement: 'top', title: 'Gerar', body: 'Cria os eventos das cerimônias marcadas, já posicionados no calendário. A geração não duplica cerimônias já existentes. (O tour não gera por você.)', optional: true },
      ],
    },
    {
      id: 'calendar-integrate',
      label: 'Integrar a agenda do Google',
      steps: [
        { selector: '[data-tour="cal-integrate"]', navigateTo: 'calendar', placement: 'left', title: 'Integrar agenda', body: 'Clique para abrir o painel de integrações. (O tour abre para você.)', clickOnNext: '[data-tour="cal-integrate"]' },
        { selector: '[data-tour="gi-google"]', placement: 'bottom', title: 'Google Agenda', body: 'Clique em "Conectar" para abrir o login do Google e autorizar o acesso. Ao conectar, a sincronização roda automaticamente e surgem os botões "Sincronizar agora" e "Desconectar".', optional: true },
        { selector: '[data-tour="gi-note"]', placement: 'top', title: 'Como os eventos aparecem', body: 'Os eventos vindos do Google entram no calendário com o selo "G" e são somente leitura aqui. Teams e Outlook estão em construção.', optional: true },
      ],
    },
  ],
}

export function extraToursFor(view: string): { id: string; label: string; steps: TourStep[] }[] {
  return EXTRA_TOURS[view] ?? []
}
