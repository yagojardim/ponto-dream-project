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
      'Seu painel muda conforme o papel (Admin, PMO, PM, Product Manager, PO, Scrum Master, Tech Lead, Dev, UX, QA).',
      'Os cards do topo resumem o essencial do seu escopo.',
      'Use o seletor de projetos para focar em um projeto específico.',
    ],
    guide: [
      { heading: 'Um board por papel', text: 'O Início é um board de widgets que muda conforme o seu papel — cada perfil vê os indicadores que importam para ele. Você pode reorganizar os cards arrastando, incluir ou remover em "Editar painel" e voltar ao padrão em "Restaurar padrão". O seletor "Projetos" no topo direito foca os cards em um ou mais projetos. Abaixo, o que cada perfil encontra no seu Início.' },
      { heading: 'Botão + Demanda', text: 'O botão "+ Demanda" (topo) cria uma demanda de qualquer tela, sem precisar abrir um board antes.', image: '/help/top--nova-demanda.png', imageAlt: 'Botão + Demanda no topo' },
      { heading: 'Início do Admin', text: 'Visão de administração do tenant. Cards do topo: Projetos (total e quantos ativos), Boards (quadros ativos), Módulos ativos (habilitados no plano), Usuários (perfis registrados, com ativos e bloqueados) e Convites (pendentes de aceitação). Abaixo: Gestão de Usuários (ativar / inativar / suspender e convidar), Módulos (ativar ou solicitar) e Auditoria — Marcos do Tenant (eventos recentes).', image: '/help/inicioadmin.png', imageAlt: 'Início do perfil Admin' },
      { heading: 'Início do PMO', text: 'Visão de portfólio. Cards: Projetos Ativos (e quantos no prazo), Em Risco / Atrasados (projetos com RAG amarelo ou vermelho), Previsibilidade (% do planejado efetivamente entregue vs. a meta) e Planejado × Concluído (itens concluídos sobre o total). Abaixo: Saúde por Projeto (RAG), Bloqueadores Críticos e Ritmo de Entrega do portfólio (velocity média).', image: '/help/iniciopmo.png', imageAlt: 'Início do perfil PMO' },
      { heading: 'Início do Project Manager', text: 'Foco no projeto. Cards: Progresso do Projeto (% de tarefas concluídas na sprint ativa), Prazo Restante (dias até a entrega planejada), Itens bloqueados (que precisam de desbloqueio) e Previsibilidade. Abaixo: Projeto principal (RAG), Planejado × Concluído, a Sprint atual e Bloqueadores Críticos.', image: '/help/inicioprojectmanager.png', imageAlt: 'Início do perfil Project Manager' },
      { heading: 'Início do Product Manager', text: 'Foco em produto e valor. Cards: MAU (usuários únicos ativos no mês), Stickiness (DAU/MAU), Churn Rate (taxa de abandono, com meta) e Adoção de Features. Abaixo: Funil de Conversão / Ativação (Visitantes → Cadastros → Ativação → Engajamento → Retenção), Adoção de Features por recurso e Roadmap Estratégico.', image: '/help/inicioproductmanager.png', imageAlt: 'Início do perfil Product Manager' },
      { heading: 'Início do Product Owner', text: 'Foco no backlog. Cards: Cobertura Ready (pontos prontos ÷ velocity), Saúde do Backlog (itens saudáveis ÷ avaliáveis), Criado vs Finalizado e Saúde das Releases. Abaixo: Backlog com alerta (itens que precisam de refino), Prontos para desenvolvimento e Mensagens do Cliente.', image: '/help/inicioproductowner.png', imageAlt: 'Início do perfil Product Owner' },
      { heading: 'Início do Scrum Master', text: 'Foco no fluxo da sprint. Cards: Saúde da Sprint (% de conclusão em relação à meta), Impedimentos (ativos, sem resolução registrada), Sprint Goal (itens críticos ou parados que ameaçam a meta) e Trabalho em andamento (WIP: em progresso, revisão ou teste). Abaixo: Bloqueados, Itens Parados + Aging WIP (aging médio por coluna) e Cerimônias & Ações de Facilitação (Daily, Planning, Review, Retro).', image: '/help/inicioscrummaster.png', imageAlt: 'Início do perfil Scrum Master' },
      { heading: 'Início do Tech Lead', text: 'Foco em qualidade técnica e entrega. Cards: Bugs Críticos (P0/P1 bloqueando entrega ou em produção), Lead Time (início → conclusão), Vazão (concluídas por semana) e % Retrabalho (demandas que são correção). Abaixo: Gargalos de PRs / Issues em revisão, Mensagens do Cliente, Lead Time & Cycle Time e Bugs por Severidade.', image: '/help/iniciotechlead.png', imageAlt: 'Início do perfil Tech Lead' },
      { heading: 'Início do Dev', text: 'Foco no seu dia a dia. Cards: Meus Itens Ativos (tarefas atribuídas a você na sprint), Atrasados (com prazo hoje ou vencido) e Meus Bloqueados (aguardando desbloqueio externo). Abaixo: Minha Fila Ativa (suas demandas da sprint com o progresso), Meus Bloqueados e Atividade Recente.', image: '/help/iniciodev.png', imageAlt: 'Início do perfil Dev' },
      { heading: 'Início do UX', text: 'Foco em design. Cards: Fluxos em Design (em progresso), Protótipos para Validação (aguardando PO ou usuário), Pendências Críticas (fluxos sem spec, protótipo ou validação) e Handoff Pronto (entregas prontas para implementação). Abaixo: Fila de design ativa, Design QA / Validação, Design System — Inconsistências e Workload por Pessoa.', image: '/help/inicioux.png', imageAlt: 'Início do perfil UX' },
      { heading: 'Início do QA', text: 'Foco em teste. Cards: Aguardando Teste (Ready for QA), Bugs Críticos (P0/P1 bloqueando a sprint), Taxa de Rejeição (itens devolvidos ao Dev, com meta) e Evidências Pendentes (bugs sem evidência de reprodução). Abaixo: Fila de Execução de Testes (aprovar / reprovar / solicitar evidência), Cobertura / Critérios Validados, Bugs por Severidade e Criados vs Resolvidos.', image: '/help/inicioqa.png', imageAlt: 'Início do perfil QA' },
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
      { heading: 'Cronograma por projeto', text: 'O Gantt mostra um cronograma por datas. À esquerda ficam os projetos (com bolinha de cor) e, expandindo, suas demandas; à direita, a régua por trimestre/mês com as barras posicionadas no período. Use o seletor "Todos os projetos" para focar em um projeto e a marca "Hoje" para se localizar no tempo.', image: '/help/06-gantt.png', imageAlt: 'Gráfico Gantt com barras por projeto e mês' },
    ],
  },
  timeline: {
    title: 'Timeline',
    steps: [
      'Linha do tempo em três níveis: Projeto → Funcionalidade → demanda.',
      'Arraste ou redimensione as barras para ajustar datas — as mudanças persistem.',
    ],
    guide: [
      { heading: 'Roadmap arrastável', text: 'A Timeline é o roadmap do período (ex.: "jul 2026 — set 2026"). A hierarquia é Projeto → Épico → Issue, e cada issue tem uma barra na linha do tempo. Arraste ou redimensione as barras para ajustar datas — as mudanças persistem. As cores indicam o estado: Em andamento (azul), Concluído (verde) e Bloqueado (vermelho).', image: '/help/07-timeline.png', imageAlt: 'Timeline / Roadmap com barras arrastáveis por issue' },
      { heading: 'Visões e agrupamento', text: 'Alterne entre Semana, Mês e Quarter e escolha o seletor de projetos. Em "Agrupar por" use Projeto → Épico e refine com os filtros de Status, Tipo, Responsável, Sprint e Épico. As faixas verticais marcam as sprints (Sprint 1, Sprint 2…).' },
    ],
  },
  dashboard: {
    title: 'Dashboard Executivo',
    steps: [
      'Saúde do portfólio em um só lugar.',
      'Selecione 1 ou mais projetos para comparar indicadores.',
    ],
    guide: [
      { heading: 'Saúde dos projetos', text: 'No topo, cada projeto vira um card com selo Saudável ou Bloqueado, o progresso (barra + %) e, quando há impedimentos, quantos itens estão bloqueados. Use o seletor no canto para escolher 1 ou mais projetos e comparar.', image: '/help/08-dashboard-executivo.png', imageAlt: 'Dashboard executivo com saúde dos projetos e indicadores' },
      { heading: 'Funcionalidades e Planejado × Concluído', text: 'A faixa "Funcionalidades" mostra o avanço do escopo Pro (concluídas × pontos). Em "Planejado × Concluído" aparece o consolidado (% e pontos concluídos), com Velocity média e Previsibilidade, além do recorte por projeto.' },
      { heading: 'Sprint atual e entregas próximas', text: 'O painel lateral resume a Sprint atual e as Entregas próximas dos projetos selecionados — quando não há sprint ou prazo, ele avisa.' },
      { heading: 'Impedimentos & bloqueios ativos', text: 'A seção de impedimentos lista as demandas travadas com o selo Bloqueado e há quanto tempo (ex.: "1d bloqueado"). Use "Ver todos" para a lista completa.' },
    ],
  },
  storage: {
    title: 'Armazenamento',
    steps: [
      'Gerencie uploads do time.',
      'Acompanhe o consumo de armazenamento por projeto.',
    ],
    guide: [
      { heading: 'Consumo do tenant e plano', text: 'A Gestão de Armazenamento mostra o consumo de anexos por tenant e por projeto (somente leitura). O card do topo traz o total usado sobre o limite do plano (ex.: "6.9 MB de 1.00 GB"), o número de arquivos, o plano atual e o botão "Fazer upgrade".', image: '/help/09-armazenamento.png', imageAlt: 'Gestão de Armazenamento com consumo do tenant e por projeto' },
      { heading: 'Ativos, finalizados e arquivados', text: 'Os três cards separam o consumo por situação do projeto: Ativos, Finalizados e Pausados / Arquivados, cada um com a quantidade de projetos e a fatia do consumo total.' },
      { heading: 'Consumo por projeto e arquivos', text: 'A tabela lista os projetos com ID, data de criação, quem criou, o consumo, a fatia (barra) e os botões "Arquivos" (gerenciar os anexos) e "Abrir" (ir ao projeto).' },
      { heading: 'Fazer upgrade', text: 'Ao clicar em "Fazer upgrade" você amplia o limite de armazenamento do tenant.', image: '/help/storage--upgrade.png', imageAlt: 'Upgrade de plano de armazenamento' },
      { heading: 'Abrir / gerenciar arquivos', text: 'Em "Arquivos" você abre a lista de anexos do projeto para consultar ou gerenciar o que foi enviado.', image: '/help/storage--arquivo.png', imageAlt: 'Gerenciamento de arquivos do projeto' },
    ],
  },
  epics: {
    title: 'Épicos',
    steps: [
      'Organize o trabalho em épicos e funcionalidades.',
      'Em projetos Pro, veja a árvore completa com roll-up de pontos.',
    ],
    guide: [
      { heading: 'Épicos por projeto', text: 'A tela agrupa os épicos por projeto (ex.: "21 épicos"). Cada épico é um card com código (EP-01), título, um anel de progresso (% concluído), a contagem de issues (ex.: "3/3 concluídas"), o detalhamento por status (Backlog, A Fazer, Em andamento, Em revisão, Concluído), o total de Story Points e os responsáveis.', image: '/help/10-epicos.png', imageAlt: 'Épicos agrupados por projeto com anel de progresso' },
      { heading: 'Ver issues do épico', text: 'Use "▼ Ver issues (N)" dentro do card para expandir e ver as demandas que compõem aquele épico.', image: '/help/epicos--detalhe.png', imageAlt: 'Detalhe do épico com suas issues' },
      { heading: 'Criar épico', text: 'O botão "+ Novo" (por projeto) cria um épico novo.', image: '/help/10-epicos--novo.png', imageAlt: 'Criar épico' },
      { heading: 'Nova funcionalidade', text: 'Em projetos Pro, você adiciona Funcionalidades dentro do épico, formando a árvore Épico → Funcionalidade → demanda com roll-up de pontos.', image: '/help/epicos--nova-funcionalidade.png', imageAlt: 'Nova funcionalidade dentro do épico' },
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
      { heading: 'Releases por projeto', text: 'As releases ficam agrupadas por projeto. Cada card traz a versão (ex.: "v1.0.0"), o nome, a data, o selo de estado (Lançada), a contagem de issues (ex.: "51/51"), a descrição, a barra de progresso e "▼ Ver issues" para abrir a lista vinculada. Use "Editar" para ajustar a release.', image: '/help/11-releases.png', imageAlt: 'Releases agrupadas por projeto com versão e progresso' },
      { heading: 'Nova release', text: 'Em "+ Nova release" você cria uma versão (nome, descrição e período) e vincula as demandas do projeto que entram naquela entrega.', image: '/help/11-releases--nova-release.png', imageAlt: 'Criação de nova release' },
      { heading: 'Editar release', text: 'Em "Editar" você ajusta os dados da release e, ao fechá-la, separa o que foi entregue do que retornou.', image: '/help/11-releases--editar.png', imageAlt: 'Edição de release' },
    ],
  },
  filters: {
    title: 'Filtros & Busca',
    steps: [
      'Monte buscas avançadas combinando condições (tipo, status, prioridade, responsável, sprint, épico).',
      'Use os operadores para refinar e encontrar demandas rapidamente.',
    ],
    guide: [
      { heading: 'Construtor de filtros', text: 'À esquerda fica o Construtor de Filtros: escolha a lógica do grupo (AND / OR) e vá adicionando condições (tipo, status, prioridade, responsável, sprint, épico…). À direita o resultado atualiza em tempo real, mostrando quantas issues foram encontradas.', image: '/help/12-filtros.png', imageAlt: 'Construtor de filtros com condições e resultado' },
      { heading: 'Adicionar condição', text: 'Cada "+ Adicionar condição" cria uma nova regra. Combinando várias com AND/OR você monta buscas bem específicas.', image: '/help/filtros--adicionar-condicao.png', imageAlt: 'Adicionar condição ao filtro' },
      { heading: 'Filtros salvos e Aplicar como visão', text: 'Salve buscas recorrentes em "Filtros salvos" (ex.: "Bugs críticos", "Minhas issues abertas") e reutilize quando quiser. "Aplicar como visão" transforma o filtro atual numa visão da lista de resultados.' },
    ],
  },
  navigator: {
    title: 'Issue Navigator',
    steps: [
      'Tabela de todas as demandas com colunas configuráveis, ordenação e busca rápida.',
      'Selecione vários itens para edição em massa (status, prioridade, responsável, sprint, épico).',
    ],
    guide: [
      { heading: 'Tabela avançada', text: 'O Issue Navigator é a tabela mais completa de demandas: colunas de Chave, Tipo, Título, Status, Prioridade, Responsável, Sprint, Pontos, Épico e Prazo — todas ordenáveis. Use "Filtro rápido…" para buscar e o rodapé mostra quantas demandas estão sendo exibidas.', image: '/help/13-issue-navigator.png', imageAlt: 'Issue Navigator com tabela configurável e seleção múltipla' },
      { heading: 'Escolher colunas', text: 'Em "Colunas" você liga e desliga as colunas para ver só o que importa.', image: '/help/navigator--colunas.png', imageAlt: 'Escolha de colunas do Issue Navigator' },
      { heading: 'Edição em massa (Bulk Change)', text: 'Marque os checkboxes de várias demandas e use "Bulk Change" para alterar status, prioridade, responsável, sprint ou épico de todas de uma vez. "Exportar" leva a seleção para CSV.', image: '/help/navigator--bulk-change.png', imageAlt: 'Edição em massa (Bulk Change)' },
    ],
  },
  reports: {
    title: 'Relatórios',
    steps: [
      'Indicadores reais: velocity, burndown, CFD, RAG e workload.',
      'Filtre por projeto para comparar escopos.',
    ],
    guide: [
      { heading: 'Painel de indicadores', text: 'Relatórios & Insights reúne as métricas de desempenho e saúde do projeto em cards: Burndown Chart (restante × ideal), Velocity Chart (pontos por sprint com a média), CFD / Cumulative Flow (distribuição por status nos últimos dias), Bugs por Severidade, Criados vs Resolvidos e Workload por Pessoa.', image: '/help/14-relatorios.png', imageAlt: 'Relatórios & Insights com Burndown, Velocity e CFD' },
      { heading: 'Liberar e atribuir relatórios', text: 'Cada card tem "✓ Liberado" e "Atribuir": você controla quais relatórios ficam visíveis e para quais papéis/dashboards eles são liberados.' },
      { heading: 'Gerenciar atribuições', text: 'O botão "Gerenciar atribuições" abre a central onde você define, de uma vez, quais relatórios cada perfil enxerga.', image: '/help/relatorios--atribuicoes.png', imageAlt: 'Gerenciar atribuições de relatórios' },
    ],
  },
  config: {
    title: 'Configurações',
    steps: ['Ajustes gerais da plataforma.'],
    guide: [
      { heading: 'Editor de Workflow', text: 'Em Configurações, a aba Workflow gerencia os status e as categorias do fluxo (A Fazer, Em Andamento, Concluído). Arraste os status para reordenar, remova com o ×, ou use "+ Adicionar status". Essas configurações refletem no Board e na seleção de status das issues.', image: '/help/config--workflow.png', imageAlt: 'Editor de Workflow com status por categoria' },
      { heading: 'Tipos de demanda', text: 'Na aba Tipos de Demanda você cadastra e edita os tipos disponíveis (ex.: História, Bug) com "+ novo tipo".', image: '/help/config--tipos--novo.png', imageAlt: 'Novo tipo de demanda' },
      { heading: 'Componentes', text: 'Em Componentes você cria os componentes do projeto para classificar as demandas por parte do sistema.', image: '/help/config--componentes--novo.png', imageAlt: 'Novo componente' },
      { heading: 'Labels', text: 'Na aba Labels você cria e organiza as etiquetas usadas nas demandas.', image: '/help/config--labels--nova.png', imageAlt: 'Nova label' },
      { heading: 'Prioridades', text: 'Em Prioridades você ajusta os níveis (ex.: Crítica, Alta, Média, Baixa) usados no projeto.', image: '/help/config--prioridades--add.png', imageAlt: 'Adicionar prioridade' },
      { heading: 'Config do Board', text: 'Em Config do Board você define as colunas do quadro (ex.: "+ nova coluna"), casando o board com o seu fluxo.', image: '/help/config--board--nova-coluna.png', imageAlt: 'Nova coluna do board' },
    ],
  },
  'tenant-settings': {
    title: 'Config. do Tenant',
    steps: [
      'Defina identidade, slug e dados do tenant.',
      'É aqui que você define o Admin Master.',
    ],
    guide: [
      { heading: 'Endereço público (slug)', text: 'A seção "Endereço público" mostra o slug atual e o status do tenant, e permite trocar o slug (mínimo 3 caracteres, apenas letras minúsculas, números e hífen) — é o endereço pelo qual o portal do cliente é acessado.', image: '/help/16-config-tenant.png', imageAlt: 'Configurações do Tenant — endereço público e identidade' },
      { heading: 'Identidade e localização', text: 'Em "Identidade e localização" você define o Nome de exibição, a URL do logo, a Cor primária (com o hex), o Fuso horário e o Idioma. Clique em "Salvar alterações" para aplicar.' },
    ],
  },
  modules: {
    title: 'Módulos',
    steps: [
      'Vitrine de módulos premium da plataforma.',
      'Use Testar grátis (30 dias) ou solicite a ativação definitiva.',
    ],
    guide: [
      { heading: 'Vitrine de módulos', text: 'Módulos da Plataforma é a vitrine dos recursos premium (ex.: "1 ativo · 1 contratado · 8 no catálogo"). Os contadores do topo separam Implementados, Em preview, Solicitados e Disponíveis, e as abas filtram por categoria (Inteligência e automação, Integrações, Experiência externa, Governança, Segurança…). O aviso lembra que a ativação passa por análise, sem cobrança automática.', image: '/help/17-modulos.png', imageAlt: 'Vitrine de Módulos da Plataforma' },
      { heading: 'Abrir um módulo', text: 'Cada card traz o nome, o estado (Operacional, Incluído, Em breve), a descrição e a lista de funcionalidades. Abra o módulo para ver os detalhes e testar grátis quando disponível.', image: '/help/17-modulos--abrir-modulo.png', imageAlt: 'Detalhe de um módulo' },
      { heading: 'Gerenciar / contratar pacotes', text: 'Em pacotes você gerencia o que está contratado e solicita a ativação definitiva dos módulos.', image: '/help/17-modulos--pacotes.png', imageAlt: 'Pacotes e contratação de módulos' },
    ],
  },
  automations: {
    title: 'Automações',
    steps: [
      'Crie regras no formato quando X → faça Y.',
      'Use para automatizar passos repetitivos do fluxo do time.',
    ],
    guide: [
      { heading: 'Automações ativas', text: 'A coluna da esquerda lista suas automações (ex.: "Demanda movida para Done → Notificar QA"), com um ponto verde/cinza indicando ativa ou pausada. Selecione uma para editar ou use "+ Nova automação".', image: '/help/18-automacoes.png', imageAlt: 'Lista de automações ativas' },
      { heading: 'Disparador → Condição → Ação', text: 'A regra tem três blocos: Disparador (o gatilho, ex.: "Demanda movida de status", com De/Para status), Condição (opcional, para refinar) e Ação (o que fazer, ex.: "Enviar notificação" com mensagem que aceita variáveis como {title} e {status}). No topo você ativa/desativa, testa em "Executar agora" e clica em "Salvar".', image: '/help/18-automacoes--nova.png', imageAlt: 'Editor de automação com disparador, condição e ação' },
      { heading: 'Adicionar condição', text: 'Em "Adicionar condição" você restringe quando a automação roda (ex.: só para bugs críticos).', image: '/help/automacoes--adicionar-condicao.png', imageAlt: 'Adicionar condição à automação' },
      { heading: 'Log de execuções', text: 'O "Log de execuções" registra cada disparo com data/hora, o disparador, o resultado (Sucesso/erro) e os detalhes — útil para auditar e depurar a regra.', image: '/help/automacoes--log.png', imageAlt: 'Log de execuções da automação' },
    ],
  },
  'client-access': {
    title: 'Criar Acesso de Cliente',
    steps: [
      'Gere o acesso do cliente ao portal.',
      'Escolha o que ele pode ver, comentar e aprovar.',
    ],
    guide: [
      { heading: 'Passo 1 — Dados do cliente', text: 'O assistente tem 3 passos (Dados do cliente · Projetos · Permissão). No passo 1 você informa Nome completo e E-mail — o sistema envia automaticamente um e-mail com login e senha temporária para o cliente.', image: '/help/19-criar-acesso--dados.png', imageAlt: 'Assistente de acesso do cliente — passo 1, dados' },
      { heading: 'Passo 2 — Projetos compartilhados', text: 'No passo 2 você escolhe quais projetos o cliente vai acompanhar no portal.', image: '/help/19-criar-acesso--projetos.png', imageAlt: 'Passo 2 — projetos compartilhados' },
      { heading: 'Passo 3 — Permissão', text: 'No passo 3 você define o nível de acesso (Visualizador ou Administrador) e os responsáveis pelo relacionamento com o cliente.', image: '/help/criar-acesso--permissao.png', imageAlt: 'Passo 3 — permissão e responsáveis' },
    ],
  },
  'client-messages': {
    title: 'Mensagens do Cliente',
    steps: [
      'Chat com o cliente por projeto.',
      'Acompanhe threads de demandas e entregas.',
    ],
    guide: [
      { heading: 'Conversas por projeto', text: 'À esquerda ficam as conversas, uma por projeto, com a última mensagem e o tempo. À direita abre o chat do projeto selecionado, com o histórico por data e as mensagens do time. Você pode mencionar (@todos, @pessoa) e responder pelo campo "Digite sua resposta ao cliente…".', image: '/help/21-mensagens-cliente.png', imageAlt: 'Mensagens do Cliente — conversas por projeto e chat' },
      { heading: 'Thread de uma demanda', text: 'As conversas podem estar amarradas a uma demanda específica (thread), para tratar dúvidas e entregas daquele item sem se misturar com o resto.', image: '/help/21-mensagens--thread.png', imageAlt: 'Thread de mensagens de uma demanda' },
      { heading: 'Simular mensagem do cliente', text: 'O "Simular mensagem do cliente" (topo) permite testar como a conversa chega, útil para validar o fluxo antes de liberar ao cliente real.' },
    ],
  },
  client: {
    title: 'Portal Cliente',
    steps: [
      'Acompanhe entregas, comente e aprove.',
      'Alterne entre o dashboard e as mensagens.',
    ],
    guide: [
      { heading: 'Visão do cliente (DashView)', text: 'É a tela que o cliente vê. O topo mostra o projeto selecionado e o que está sendo visualizado. Os cards trazem: Evolução do projeto (status, %, tarefas concluídas, sprint atual e prazo), Entregas desta sprint, Projetos (no prazo × em risco), Sprint ativa, Riscos abertos, Aguardando sua validação (pendências), Roadmap publicado e Entregas recentes.', image: '/help/dashview--principal.png', imageAlt: 'Portal do Cliente (DashView) com os cards de acompanhamento' },
      { heading: 'Mensagens no portal', text: 'Pelo botão "Mensagens", o cliente troca mensagens com o time direto do portal.', image: '/help/dashview--mensagens.png', imageAlt: 'Mensagens no portal do cliente' },
      { heading: 'Menu do perfil / alterar senha', text: 'No menu do usuário (canto superior direito) o cliente acessa a conta e pode alterar a senha.', image: '/help/dashview--alterar-senha.png', imageAlt: 'Menu do perfil e alterar senha no portal' },
    ],
  },
  team: {
    title: 'Time & Permissões',
    steps: [
      'Cadastre novos usuários e defina o papel de cada um.',
      'As capabilities liberadas no cadastro controlam o acesso às telas.',
    ],
    guide: [
      { heading: 'Membros e status', text: 'Time & Permissões gerencia os membros do tenant. Os contadores mostram Total, Ativos, Inativos e Suspensos. A tabela traz cada membro com o papel (e o Tier), a squad, o status (Ativo), os módulos liberados (chips como board, reports, portfolio, roadmap) e as ações — Editar, Gerar link, Suspender e Desativar. Use "+ Convidar membro" para adicionar alguém.', image: '/help/20-time-permissoes.png', imageAlt: 'Time & Permissões com membros, papéis e módulos' },
      { heading: 'Convites', text: 'A aba Convites acompanha os convites pendentes enviados ao time.', image: '/help/time--convites.png', imageAlt: 'Aba de convites' },
      { heading: 'Matriz de Permissões', text: 'A Matriz de Permissões mostra, em grade, o que cada papel pode fazer — a referência para conferir e ajustar acessos.', image: '/help/time--matriz.png', imageAlt: 'Matriz de Permissões' },
      { heading: 'Dashboards', text: 'A aba Dashboards controla quais painéis cada membro/papel enxerga.', image: '/help/time--dashboards.png', imageAlt: 'Aba Dashboards' },
      { heading: 'Editar membro', text: 'Em "Editar" você ajusta os dados, as permissões e o dashboard do membro.', image: '/help/20-editar-membro.png', imageAlt: 'Editar membro' },
      { heading: 'Gerar link de acesso', text: 'Em "Gerar link" você cria um link de acesso para o membro entrar.', image: '/help/20-time--gerar-link.png', imageAlt: 'Gerar link de acesso' },
      { heading: 'Suspender / Desativar', text: 'Use Suspender (bloqueio temporário) ou Desativar (encerrar o acesso) para controlar quem entra.', image: '/help/time--desativar.png', imageAlt: 'Suspender ou desativar membro' },
      { heading: 'Convidar membro (assistente)', text: 'O convite é um assistente de várias etapas onde você define dados, papel, squad, módulos e dashboard antes de enviar.', image: '/help/20-convite-step1.png', imageAlt: 'Assistente de convite de membro' },
    ],
  },
  profile: {
    title: 'Meu perfil',
    steps: [
      'Visualize e edite seus dados pessoais.',
      'Ajuste avatar, nome e e-mail.',
    ],
    guide: [
      { heading: 'Dados da conta', text: 'Meu perfil mostra seus dados de conta — Nome, E-mail, Papel e Organização. Eles são de leitura; para alterações de cadastro, fale com o administrador do tenant.', image: '/help/perfil--meu-perfil.png', imageAlt: 'Meu perfil com dados da conta' },
      { heading: 'Segurança / trocar senha', text: 'No bloco Segurança, o botão "Trocar senha" envia um link seguro para você definir uma nova senha.' },
    ],
  },
  preferences: {
    title: 'Preferências',
    steps: [
      'Ajuste notificações, idioma e comportamentos da conta.',
      'Configure preferências da plataforma.',
    ],
    guide: [
      { heading: 'Tema e idioma', text: 'Preferências guarda ajustes salvos apenas neste navegador. Em Tema você escolhe Escuro ou Claro (o Altech é otimizado para o escuro) e em Idioma seleciona o idioma da interface (Português (Brasil); outros em construção).', image: '/help/perfil--preferencias.png', imageAlt: 'Preferências — tema e idioma' },
    ],
  },
  login: {
    title: 'Login — Gestão',
    steps: [
      'Acesse a área de gestão do Altech Project.',
      'Use "Esqueci a senha" para redefinir sua senha.',
    ],
    guide: [
      { heading: 'Entrar na gestão', text: 'A tela de login da gestão pede e-mail e senha (com opção de exibir a senha e "Manter conectado"). Se esquecer a senha, use "Esqueci a senha": informe o e-mail e o sistema envia um link para redefinir.', image: '/help/login-gestao--esqueci.png', imageAlt: 'Login da gestão com o modal Esqueci a senha' },
    ],
  },
  'client-login': {
    title: 'Login — Portal',
    steps: [
      'Acesse o portal do cliente do Altech Project.',
      'Use "Esqueci minha senha" para redefinir sua senha.',
    ],
    guide: [
      { heading: 'Entrar no portal', text: 'A tela de login do portal do cliente pede e-mail e senha. Se esquecer a senha, use "Esqueci minha senha": informe o e-mail e o sistema envia um link para redefinir.', image: '/help/login-portal--esqueci.png', imageAlt: 'Login do portal do cliente com Esqueci minha senha' },
    ],
  },
  timesheet: {
    title: 'Lançar horas',
    steps: [
      'Registre horas por demanda.',
      'Envie o período para aprovação quando terminar.',
    ],
    guide: [
      { heading: 'Novo lançamento', text: 'Em Lançar Horas você registra o tempo por demanda. No card "Novo lançamento" escolha a Data, busque a Demanda (por nome, chave ou épico), informe as Horas e uma Descrição opcional, e clique em OK.', image: '/help/hours--novo-lancamento.png', imageAlt: 'Lançar horas — novo lançamento por demanda' },
      { heading: 'Filtrar seus lançamentos', text: 'Os filtros Todos / Salvo / Enviado / Aprovado / Rejeitado e o seletor de mês ajudam a acompanhar a situação de cada lançamento.' },
      { heading: 'Enviar para aprovação', text: 'No card "Enviar lançamentos para aprovação", escolha o período (mês) e clique em "Enviar para aprovação" para mandar os lançamentos salvos ao aprovador.' },
      { heading: 'Exportar CSV', text: 'Exporte seus lançamentos em CSV quando precisar levar os dados para fora.', image: '/help/hours--exportar-csv.png', imageAlt: 'Exportar lançamentos de horas em CSV' },
    ],
  },
  'hours-approval': {
    title: 'Aprovar horas',
    steps: [
      'Aprove ou reprove os lançamentos da sua squad.',
      'Exporte os dados em CSV quando precisar.',
    ],
    guide: [
      { heading: 'Fila de aprovação por colaborador', text: 'Aprovar Horas agrupa os lançamentos por colaborador, com o total de horas e a quantidade de lançamentos. Os filtros Todos / Enviado / Aprovado / Rejeitado e o seletor de squad ajudam a focar. Cada linha traz Colaborador, Data, Projeto, Demanda, Horas, Descrição e Status.', image: '/help/hours--aprovar.png', imageAlt: 'Aprovar horas — fila por colaborador' },
      { heading: 'Aprovar ou rejeitar', text: 'Aprove ou rejeite lançamento a lançamento (✓ / ✕) ou use "Aprovar todos" / "Rejeitar todos" no cabeçalho de cada colaborador.' },
      { heading: 'Exportar CSV', text: 'Use "Exportar CSV" (ou o CSV por colaborador) para levar os dados de horas para relatórios externos.', image: '/help/hours--exportar-csv.png', imageAlt: 'Exportar horas em CSV' },
    ],
  },
}
