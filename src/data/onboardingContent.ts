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
      { text: 'Botão "+ Demanda" (topo): cria uma demanda de qualquer tela.', image: '/help/top--nova-demanda.png' },
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
      { heading: 'Cards de resumo (topo)', text: 'Os seis cards do topo resumem sua fila: Total (tudo atribuído a você), Em Dev (em desenvolvimento), Em Revisão, Bloqueados, P. Alta/Crit (prioridade alta ou crítica) e Concluídos. Servem de termômetro rápido antes de abrir a lista.', image: '/help/01-minha-fila.png', imageAlt: 'Minha Fila com cards de resumo, filtros e estado vazio' },
      { heading: 'Filtrar, agrupar e ordenar', text: 'Use "Filtrar issues…" para buscar por texto. Em Agrupar você separa por Status, Prioridade, Sprint ou Projeto. Em Ordenar escolhe Prioridade, Status ou Prazo. Assim você monta a visão da sua fila do jeito que trabalha.' },
      { heading: 'Ver board', text: 'O botão "Ver board" (canto superior direito) leva direto ao quadro Kanban do contexto atual, para você atuar na demanda sem sair procurando.' },
      { heading: 'Mostrar concluídas e estado vazio', text: 'Quando não há nada pendente aparece "Tudo concluído por aqui". Clique em "Mostrar concluídas" (ou no botão do topo) para reexibir o que você já finalizou e consultar o histórico.' },
    ],
  },
  calendar: {
    title: 'Calendário',
    steps: [
      'Prazos e cerimônias da sprint em um só lugar.',
      'Gere as cerimônias e conecte sua agenda Google.',
    ],
    guide: [
      { heading: 'Visão geral', text: 'O Calendário reúne prazos e cerimônias da sprint. Na barra de topo ficam: "+ Criar", as visões (Mês / Semana / Dia), o atalho "Hoje", o seletor de Sprint, "Gerar cerimônias da sprint", as setas de navegação e "Integrar agenda".', image: '/help/02-calendario.png', imageAlt: 'Calendário na visão Dia com cerimônias da sprint' },
      { heading: 'Visão Mês / Semana / Dia', text: 'Alterne entre Mês, Semana e Dia. Na Semana, o dia atual fica destacado e as cerimônias aparecem coloridas (ex.: Daily em verde, Planning em âmbar). Cada evento mostra horário e título.', image: '/help/calendario--semana.png', imageAlt: 'Calendário na visão Semana' },
      { heading: 'Visão "Hoje"', text: 'O botão "Hoje" abre o dia atual hora a hora, com uma linha marcando o horário corrente. Slots livres exibem "Clique para criar evento"; cerimônias aparecem como blocos (ex.: "Daily — Sprint 3", 09:00–09:15).', image: '/help/calendario--hoje.png', imageAlt: 'Calendário na visão Hoje com a linha do horário atual' },
      { heading: 'Criar evento', text: 'Em "+ Criar" você registra um evento novo. Use "mais opções" para abrir todos os campos (título, data/hora, descrição, participantes).', image: '/help/calendario--criar-mais-opcoes.png', imageAlt: 'Criação de evento com mais opções' },
      { heading: 'Gerar cerimônias da sprint', text: 'O botão "Gerar cerimônias da sprint" cria automaticamente Daily, Planning, Review e Retro da sprint selecionada, já posicionadas no calendário.', image: '/help/02-calendario--gerar-cerimonias.png', imageAlt: 'Gerar cerimônias da sprint' },
      { heading: 'Integrar sua agenda Google', text: 'Em "Integrar agenda" você conecta sua conta Google para sincronizar os eventos do calendário com a sua agenda pessoal.', image: '/help/02-calendario--integrar-agenda.png', imageAlt: 'Integração com a agenda Google' },
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
      { heading: 'Lista e contadores', text: 'O topo mostra o resumo do portfólio (ex.: "3 projetos · 1 em progresso · 59 tarefas · 53 concluídas"). Cada linha traz o nome do projeto (com o cliente logo abaixo), Período, Progresso (barra + %), Status (planejamento / em progresso) e o Responsável.', image: '/help/03-projetos.png', imageAlt: 'Lista de projetos com progresso, status e responsável' },
      { heading: 'Expandir e menu ⋯', text: 'Clique na setinha para expandir o projeto e ver suas tarefas. No menu ⋯ (coluna Ações) você edita descrição, período e equipe, além de finalizar ou arquivar o projeto.' },
      { heading: 'Novo Projeto — dados principais', text: 'Em "+ Novo Projeto" preencha Nome do projeto (obrigatório), Cliente, Chave (obrigatória) e o Tipo — Scrum ou Kanban. O Período (datas de início e fim) alimenta a régua do Gantt e da Timeline.', image: '/help/03-projetos--novo-projeto.png', imageAlt: 'Formulário Novo Projeto — dados principais' },
      { heading: 'Novo Projeto — estrutura e responsável', text: 'Na parte de baixo do formulário você ativa "Usar Funcionalidades" (estrutura de trabalho dos projetos Pro) e define o Responsável antes de clicar em Criar.', image: '/help/03-projetos--novo-projeto-baixo.png', imageAlt: 'Novo Projeto — estrutura de trabalho e responsável' },
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
      { heading: 'Lista de boards', text: 'A tela de Boards lista um quadro por projeto (ex.: "3 boards no escopo · 3 ativos"). Cada card mostra o board, o projeto, quantas colunas e quantos itens tem, e quando foi atualizado. Use a busca e os filtros Todos / Ativos / Arquivados para encontrar o quadro certo.', image: '/help/04-boards.png', imageAlt: 'Lista de boards agrupada por projeto' },
      { heading: 'Board Kanban', text: 'Dentro do board, as demandas ficam em colunas por status (Backlog, A Fazer, Em Andamento, Em Revisão, Concluído) — o número na coluna é a contagem de cards. Arraste um card entre colunas para mudar o status. Cada card traz a chave (ex.: PZERO-126), o épico, o título, os pontos e o responsável.', image: '/help/board--kanban.png', imageAlt: 'Board Kanban com colunas por status' },
      { heading: 'Abas Board / Backlog / Sprints', text: 'No topo do quadro há três abas: Board (Kanban), Backlog (demandas por sprint) e Sprints. Os números indicam a quantidade de itens em cada visão; os avatares à direita são o time do projeto.' },
      { heading: 'Barra de ações e Agrupar', text: 'Na barra do board você seleciona a sprint ativa, aciona "Iniciar Daily" (board ao vivo), abre "Filtros" e usa "Encerrar sprint". Em "Agrupar" dá para organizar os cards por Nenhum, Responsável ou Épico.', image: '/help/04-board--iniciar-daily.png', imageAlt: 'Barra do board com Iniciar Daily e Filtros' },
      { heading: 'Visão Backlog', text: 'A aba Backlog mostra as sprints com sua META, período e pontos concluídos. Dentro de cada sprint, as demandas aparecem em tabela (Chave, Título, Prioridade, Pontos) e podem ser arrastadas. Use "+ Adicionar issue" para incluir itens.', image: '/help/board--backlog.png', imageAlt: 'Visão Backlog com sprints e metas' },
      { heading: 'Visão Sprints', text: 'A aba Sprints reúne as sprints do projeto com seu progresso, para acompanhar o andamento de cada uma.', image: '/help/board--sprints.png', imageAlt: 'Visão Sprints com progresso' },
      { heading: 'Nova sprint', text: 'Em "Nova sprint" você cria uma sprint (nome, meta e período) para começar a planejar os itens.', image: '/help/board--nova-sprint.png', imageAlt: 'Criação de nova sprint' },
      { heading: 'Concluir sprint (transbordo)', text: 'Ao encerrar a sprint, o Altech mostra Concluídas, Restantes e Total, e a velocity da sprint. Para cada demanda restante você decide o destino — "Próxima sprint" ou "Backlog" (ou aplica para todas de uma vez). Escreva o comentário de conclusão e, se quiser, o motivo do transbordo.', image: '/help/board--concluir-sprint.png', imageAlt: 'Modal Concluir Sprint com transbordo e velocity' },
      { heading: 'Criar demanda — História', text: 'No modal de criação, o tipo História pede Projeto, Resumo, Épico, Descrição, Prioridade, Responsável, Sprint, Story Points e Labels.', image: '/help/board--criar-demanda-historia.png', imageAlt: 'Criar demanda do tipo História' },
      { heading: 'Criar demanda — Bug', text: 'Ao escolher o tipo Bug, aparecem os campos específicos: Passos para reproduzir, Resultado esperado × Resultado encontrado, Ambiente e Evidência (link ou arquivo).', image: '/help/board--criar-demanda-bug.png', imageAlt: 'Criar demanda do tipo Bug com passos e evidência' },
      { heading: 'Filtros do board', text: 'O botão "Filtros" refina o quadro por tipo, status, prioridade, responsável, épico e mais — útil para focar só no que interessa naquele momento.', image: '/help/04-board--filtros.png', imageAlt: 'Filtros do board' },
    ],
  },
  list: {
    title: 'Lista',
    steps: [
      'Visão em tabela de todas as demandas.',
      'Filtre por tipo, status, épico, responsável e funcionalidade.',
    ],
    guide: [
      { heading: 'Tabela de demandas', text: 'A Lista mostra todas as demandas em tabela, com Chave, Tipo, Título, Status (badge colorido: Backlog, A Fazer, Em andamento, Em revisão, Concluído), Prioridade (Crítica, Alta, Média, Baixa) e Responsável. Clique na chave para abrir a demanda; clique no cabeçalho para ordenar.', image: '/help/05-lista.png', imageAlt: 'Lista de demandas em tabela com status e prioridade' },
      { heading: 'Filtros', text: 'No topo você filtra por Projeto, Status, Prioridade, Tipo, Responsável, Sprint, Épico e Funcionalidade. Combine os filtros para chegar exatamente no recorte que precisa.' },
      { heading: 'Agrupar e exportar', text: 'Em "Agrupar" organize por Nenhum, Sprint ou Épico. Use "Colunas" para escolher o que aparece e "Exportar CSV" para levar os dados para fora.' },
      { heading: 'Agrupar por Sprint', text: 'Agrupando por Sprint, as demandas ficam separadas por sprint — bom para revisar o que entra em cada ciclo.', image: '/help/lista--sprint.png', imageAlt: 'Lista agrupada por Sprint' },
      { heading: 'Agrupar por Épico', text: 'Agrupando por Épico, você vê as demandas organizadas sob cada épico do projeto.', image: '/help/lista--epico.png', imageAlt: 'Lista agrupada por Épico' },
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
      { text: 'Regras "quando X → faça Y".', image: '/help/18-automacoes.png' },
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
      'Use "Esqueci a senha" para redefinir sua senha.',
    ],
    guide: [
      { text: 'Login + "Esqueci a senha".', image: '/help/login-gestao--esqueci.png' },
    ],
  },
  'client-login': {
    title: 'Login — Portal',
    steps: [
      'Acesse o portal do cliente do Altech Project.',
      'Use "Esqueci minha senha" para redefinir sua senha.',
    ],
    guide: [
      { text: 'Login do cliente + "Esqueci minha senha".', image: '/help/login-portal--esqueci.png' },
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
