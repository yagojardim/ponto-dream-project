// Fonte única das dicas de onboarding (callouts inline + Central de Ajuda).
export interface OnboardingGuideBlock {
  heading?: string
  text: string
  image?: string
  imageAlt?: string
}

export interface OnboardingTip {
  title: string
  steps: string[]
  guide?: OnboardingGuideBlock[]
}

export const ONBOARDING_TIPS: Record<string, OnboardingTip> = {
  home: {
    title: 'Início',
    steps: [
      'Seu painel muda conforme o papel (Admin, PO, Scrum Master, Tech Lead, Dev).',
      'Os cards do topo resumem o essencial do seu escopo.',
      'Use o seletor de projetos para focar em um projeto específico.',
    ],
    guide: [
      { text: 'Seu painel muda conforme o papel: cards de resumo no topo e seletor de projetos.', image: '/help/00-inicio.png' },
      { text: 'Botão “+ Demanda” (topo): cria uma demanda de qualquer tela.', image: '/help/top--nova-demanda.png' },
      { text: 'Minha Fila — Suas demandas atribuídas, priorizadas.', image: '/help/01-minha-fila.png' },
    ],
  },
  'my-tasks': {
    title: 'Minha Fila',
    steps: [
      'Todas as demandas atribuídas a você.',
      'Priorize o que está bloqueado ou em revisão.',
    ],
    guide: [
      { text: 'Minha Fila — Suas demandas atribuídas, priorizadas.', image: '/help/01-minha-fila.png' },
    ],
  },
  calendar: {
    title: 'Calendário',
    steps: [
      'Prazos e cerimônias da sprint em um só lugar.',
      'Gere as cerimônias e conecte sua agenda Google.',
    ],
    guide: [
      { text: 'Prazos e cerimônias da sprint no calendário.', image: '/help/02-calendario.png' },
      { text: 'Alterne a visão: Mês / Semana / Dia / Hoje.', image: '/help/calendario--mes.png' },
      { text: 'Botão Criar: novo evento (use “mais opções” para os campos completos).', image: '/help/calendario--criar-mais-opcoes.png' },
      { text: 'Gerar cerimônias da sprint (daily/planning/review/retro).', image: '/help/02-calendario--gerar-cerimonias.png' },
      { text: 'Integrar sua agenda Google.', image: '/help/02-calendario--integrar-agenda.png' },
    ],
  },
  'projects-list': {
    title: 'Projetos',
    steps: [
      'Clique em + Novo Projeto para criar.',
      'No ⋯ de cada projeto você edita descrição, período e equipe.',
      'Ainda no ⋯ é possível finalizar ou arquivar o projeto.',
    ],
    guide: [
      { text: 'Lista de projetos; expanda para ver tarefas; menu ⋯ para editar/finalizar/arquivar.', image: '/help/03-projetos.png' },
      { text: '“+ Novo Projeto”: nome, cliente, chave, tipo (Scrum/Kanban), período.', image: '/help/03-projetos--novo-projeto.png' },
      { text: 'Parte de baixo do formulário: estrutura de trabalho (Funcionalidades/Pro) e responsável.', image: '/help/03-projetos--novo-projeto-baixo.png' },
    ],
  },
  'boards-list': {
    title: 'Boards',
    steps: [
      'Boards são seus quadros Kanban.',
      'Crie um board e abra para trabalhar nele.',
      'Arraste demandas entre as colunas para mudar o status.',
    ],
    guide: [
      { text: 'Lista de boards por projeto.', image: '/help/04-boards.png' },
      { text: 'Board Kanban: arraste os cards entre as colunas.', image: '/help/board--kanban.png' },
      { text: 'Visão Backlog: demandas agrupadas por sprint.', image: '/help/board--backlog.png' },
      { text: 'Visão Sprints: sprints e progresso.', image: '/help/board--sprints.png' },
      { text: 'Iniciar Daily (board ao vivo) e Filtros.', image: '/help/04-board--iniciar-daily.png' },
      { text: 'Nova sprint.', image: '/help/board--nova-sprint.png' },
      { text: 'Concluir Sprint: transbordar itens restantes para a próxima sprint ou voltar ao backlog.', image: '/help/board--concluir-sprint.png' },
      { text: 'Criar demanda — História.', image: '/help/board--criar-demanda-historia.png' },
      { text: 'Criar demanda — Bug (passos para reproduzir, resultado esperado × encontrado).', image: '/help/board--criar-demanda-bug.png' },
    ],
  },
  list: {
    title: 'Lista',
    steps: [
      'Visão em tabela de todas as demandas.',
      'Filtre por tipo, status, épico, responsável e funcionalidade.',
    ],
    guide: [
      { text: 'Tabela de todas as demandas.', image: '/help/05-lista.png' },
      { text: 'Agrupar por Sprint.', image: '/help/lista--sprint.png' },
      { text: 'Agrupar por Épico.', image: '/help/lista--epico.png' },
    ],
  },
  gantt: {
    title: 'Gantt',
    steps: [
      'Cronograma por datas, com dependências e prazos.',
      'O período cadastrado no projeto define a régua do gráfico.',
    ],
    guide: [
      { text: 'Cronograma com dependências e prazos.', image: '/help/06-gantt.png' },
    ],
  },
  timeline: {
    title: 'Timeline',
    steps: [
      'Linha do tempo em três níveis: Projeto → Funcionalidade → demanda.',
      'Arraste ou redimensione as barras para ajustar datas — as mudanças persistem.',
    ],
    guide: [
      { text: 'Linha do tempo Projeto → Funcionalidade → demanda; arraste as barras.', image: '/help/07-timeline.png' },
    ],
  },
  dashboard: {
    title: 'Dashboard Executivo',
    steps: [
      'Saúde do portfólio em um só lugar.',
      'Selecione 1 ou mais projetos para comparar indicadores.',
    ],
    guide: [
      { text: 'Saúde do portfólio; selecione 1+ projetos.', image: '/help/08-dashboard-executivo.png' },
    ],
  },
  storage: {
    title: 'Armazenamento',
    steps: [
      'Gerencie uploads do time.',
      'Acompanhe o consumo de armazenamento por projeto.',
    ],
    guide: [
      { text: 'Consumo de armazenamento por projeto.', image: '/help/09-armazenamento.png' },
      { text: 'Fazer upgrade de plano.', image: '/help/storage--upgrade.png' },
      { text: 'Abrir/gerenciar arquivos.', image: '/help/storage--arquivo.png' },
    ],
  },
  epics: {
    title: 'Épicos',
    steps: [
      'Organize o trabalho em épicos e funcionalidades.',
      'Em projetos Pro, veja a árvore completa com roll-up de pontos.',
    ],
    guide: [
      { text: 'Épicos do projeto; em projetos Pro, árvore Épico → Funcionalidade.', image: '/help/10-epicos.png' },
      { text: 'Criar épico.', image: '/help/10-epicos--novo.png' },
      { text: 'Nova funcionalidade.', image: '/help/epicos--nova-funcionalidade.png' },
      { text: 'Detalhe do épico.', image: '/help/epicos--detalhe.png' },
    ],
  },
  releases: {
    title: 'Releases',
    steps: [
      'Agrupe entregas por versão.',
      'Crie a release e vincule as demandas do projeto.',
      'Use Fechar release para separar entregues × retornados.',
    ],
    guide: [
      { text: 'Releases agrupadas por projeto.', image: '/help/11-releases.png' },
      { text: 'Nova release.', image: '/help/11-releases--nova-release.png' },
      { text: 'Editar release.', image: '/help/11-releases--editar.png' },
    ],
  },
  filters: {
    title: 'Filtros & Busca',
    steps: [
      'Monte buscas avançadas combinando condições (tipo, status, prioridade, responsável, sprint, épico).',
      'Use os operadores para refinar e encontrar demandas rapidamente.',
    ],
    guide: [
      { text: 'Busca avançada por condições.', image: '/help/12-filtros.png' },
      { text: 'Adicionar condição.', image: '/help/filtros--adicionar-condicao.png' },
    ],
  },
  navigator: {
    title: 'Issue Navigator',
    steps: [
      'Tabela de todas as demandas com colunas configuráveis, ordenação e busca rápida.',
      'Selecione vários itens para edição em massa (status, prioridade, responsável, sprint, épico).',
    ],
    guide: [
      { text: 'Tabela com colunas configuráveis e edição em massa.', image: '/help/13-issue-navigator.png' },
      { text: 'Escolher colunas.', image: '/help/navigator--colunas.png' },
      { text: 'Edição em massa (Bulk Change).', image: '/help/navigator--bulk-change.png' },
    ],
  },
  reports: {
    title: 'Relatórios',
    steps: [
      'Indicadores reais: velocity, burndown, CFD, RAG e workload.',
      'Filtre por projeto para comparar escopos.',
    ],
    guide: [
      { text: 'Indicadores: velocity, burndown, CFD, RAG, workload.', image: '/help/14-relatorios.png' },
      { text: 'Gerenciar atribuições de cards.', image: '/help/relatorios--atribuicoes.png' },
    ],
  },
  config: {
    title: 'Configurações',
    steps: ['Ajustes gerais da plataforma.'],
    guide: [
      { text: 'Configurações do projeto (abas).', image: '/help/15-configuracoes.png' },
      { text: 'Workflow.', image: '/help/config--workflow.png' },
      { text: 'Tipos de demanda (+ novo tipo).', image: '/help/config--tipos--novo.png' },
      { text: 'Componentes (+ novo componente).', image: '/help/config--componentes--novo.png' },
      { text: 'Labels (+ nova label).', image: '/help/config--labels--nova.png' },
      { text: 'Prioridades (+ adicionar).', image: '/help/config--prioridades--add.png' },
      { text: 'Config do Board (+ nova coluna).', image: '/help/config--board--nova-coluna.png' },
    ],
  },
  'tenant-settings': {
    title: 'Config. do Tenant',
    steps: [
      'Defina identidade, slug e dados do tenant.',
      'É aqui que você define o Admin Master.',
    ],
    guide: [
      { text: 'Identidade, slug e dados do tenant; Admin Master.', image: '/help/16-config-tenant.png' },
    ],
  },
  modules: {
    title: 'Módulos',
    steps: [
      'Vitrine de módulos premium da plataforma.',
      'Use Testar grátis (30 dias) ou solicite a ativação definitiva.',
    ],
    guide: [
      { text: 'Vitrine de módulos premium.', image: '/help/17-modulos.png' },
      { text: 'Abrir módulo (testar grátis / detalhes).', image: '/help/17-modulos--abrir-modulo.png' },
      { text: 'Gerenciar / contratar pacotes.', image: '/help/17-modulos--pacotes.png' },
    ],
  },
  automations: {
    title: 'Automações',
    steps: [
      'Crie regras no formato quando X → faça Y.',
      'Use para automatizar passos repetitivos do fluxo do time.',
    ],
    guide: [
      { text: 'Regras “quando X → faça Y”.', image: '/help/18-automacoes.png' },
      { text: 'Nova automação.', image: '/help/18-automacoes--nova.png' },
      { text: 'Adicionar condição.', image: '/help/automacoes--adicionar-condicao.png' },
      { text: 'Histórico de execução.', image: '/help/automacoes--log.png' },
    ],
  },
  'client-access': {
    title: 'Criar Acesso de Cliente',
    steps: [
      'Gere o acesso do cliente ao portal.',
      'Escolha o que ele pode ver, comentar e aprovar.',
    ],
    guide: [
      { text: 'Assistente de acesso do cliente — Passo 1: dados.', image: '/help/19-criar-acesso--dados.png' },
      { text: 'Passo 2: projetos compartilhados.', image: '/help/19-criar-acesso--projetos.png' },
      { text: 'Passo 3: permissão (Visualizador/Administrador) e responsáveis.', image: '/help/criar-acesso--permissao.png' },
    ],
  },
  'client-messages': {
    title: 'Mensagens do Cliente',
    steps: [
      'Chat com o cliente por projeto.',
      'Acompanhe threads de demandas e entregas.',
    ],
    guide: [
      { text: 'Chat com o cliente por projeto.', image: '/help/21-mensagens-cliente.png' },
      { text: 'Thread de uma demanda.', image: '/help/21-mensagens--thread.png' },
    ],
  },
  client: {
    title: 'Portal Cliente',
    steps: [
      'Acompanhe entregas, comente e aprove.',
      'Alterne entre o dashboard e as mensagens.',
    ],
    guide: [
      { text: 'Portal do Cliente (DashView) — visão do cliente.', image: '/help/dashview--principal.png' },
      { text: 'Mensagens no portal.', image: '/help/dashview--mensagens.png' },
      { text: 'Menu do perfil / Alterar senha.', image: '/help/dashview--alterar-senha.png' },
    ],
  },
  team: {
    title: 'Time & Permissões',
    steps: [
      'Cadastre novos usuários e defina o papel de cada um.',
      'As capabilities liberadas no cadastro controlam o acesso às telas.',
    ],
    guide: [
      { text: 'Membros, papéis e permissões.', image: '/help/20-time-permissoes.png' },
      { text: 'Aba Convites.', image: '/help/time--convites.png' },
      { text: 'Matriz de Permissões.', image: '/help/time--matriz.png' },
      { text: 'Aba Dashboards.', image: '/help/time--dashboards.png' },
      { text: 'Editar membro (dados / permissões / dashboard).', image: '/help/20-editar-membro.png' },
      { text: 'Gerar link de acesso.', image: '/help/20-time--gerar-link.png' },
      { text: 'Suspender / Desativar membro.', image: '/help/time--desativar.png' },
      { text: 'Convidar membro — assistente de 7 etapas.', image: '/help/20-convite-step1.png' },
    ],
  },
  profile: {
    title: 'Meu perfil',
    steps: [
      'Visualize e edite seus dados pessoais.',
      'Ajuste avatar, nome e e-mail.',
    ],
    guide: [
      { text: 'Seu perfil.', image: '/help/perfil--meu-perfil.png' },
    ],
  },
  preferences: {
    title: 'Preferências',
    steps: [
      'Ajuste notificações, idioma e comportamentos da conta.',
      'Configure preferências da plataforma.',
    ],
    guide: [
      { text: 'Preferências da conta.', image: '/help/perfil--preferencias.png' },
    ],
  },
  login: {
    title: 'Login — Gestão',
    steps: [
      'Acesse a área de gestão do Altech Project.',
      'Use “Esqueci a senha” para redefinir sua senha.',
    ],
    guide: [
      { text: 'Login + “Esqueci a senha”.', image: '/help/login-gestao--esqueci.png' },
    ],
  },
  'client-login': {
    title: 'Login — Portal',
    steps: [
      'Acesse o portal do cliente do Altech Project.',
      'Use “Esqueci minha senha” para redefinir sua senha.',
    ],
    guide: [
      { text: 'Login do cliente + “Esqueci minha senha”.', image: '/help/login-portal--esqueci.png' },
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
}
