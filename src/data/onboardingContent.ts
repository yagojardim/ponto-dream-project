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
      { heading: 'Admin Master', text: 'A seção Admin Master mostra quem é o administrador principal. Use "Transferir" para passar o cargo a outro membro do time (requer confirmação).', image: '/help/tenant--admin-master.png', imageAlt: 'Admin Master com opção de transferência' },
    ],
  },
  modules: {
    title: 'Módulos',
    steps: [
      'Ative e desative módulos conforme a necessidade do time.',
      'Use "Trial" para experimentar antes de contratar.',
    ],
    guide: [
      { heading: 'Catálogo de módulos', text: 'A página Módulos lista os módulos disponíveis em cards. Cada card traz o nome, a descrição, o selo de estado (Ativo, Inativo, Trial) e os botões de ação (Ativar / Desativar / Iniciar Trial). Módulos ativos aparecem com destaque.', image: '/help/17-modulos.png', imageAlt: 'Catálogo de módulos com estado e ações' },
      { heading: 'Ativar e desativar', text: 'Clique em "Ativar" para ligar o módulo no tenant; em "Desativar" para suspendê-lo. Módulos desativados ficam com o card esmaecido.' },
      { heading: 'Trial (período de teste)', text: 'Use "Iniciar Trial" para experimentar o módulo por tempo limitado antes de contratar. O contador de dias restantes aparece no card.' },
    ],
  },
  automations: {
    title: 'Automações',
    steps: [
      'Crie regras "Quando → Então" para automatizar o fluxo.',
      'Ex.: Quando uma demanda mudar para Em Revisão → notifique o revisor.',
    ],
    guide: [
      { heading: 'Lista de automações', text: 'A tela Automações lista as regras ativas e inativas. Cada linha mostra o nome da automação, o gatilho (Quando…), a ação (Então…), o estado (Ativa/Inativa) e as opções de Editar e Excluir.', image: '/help/18-automacoes.png', imageAlt: 'Lista de automações com gatilho, ação e estado' },
      { heading: 'Criar automação', text: 'Em "+ Nova automação" você define: Quando (evento: mudança de status, atribuição, criação, etc.) e Então (ação: notificar, mover, atribuir, etc.). Combine várias condições e ações numa mesma regra.', image: '/help/automacoes--nova.png', imageAlt: 'Criar nova automação — Quando / Então' },
      { heading: 'Ativar e desativar', text: 'Use o toggle para ligar ou desligar uma automação sem excluí-la — útil para pausar regras temporariamente.' },
    ],
  },
  'client-access': {
    title: 'Criar Acesso Cliente',
    steps: [
      'Cadastre empresas e contatos para o Portal do Cliente.',
      'Defina quais projetos cada cliente enxerga.',
    ],
    guide: [
      { heading: 'Lista de acessos', text: 'A tela Criar Acesso Cliente lista as empresas e contatos cadastrados para o Portal. Cada linha mostra a Empresa, o Contato (nome + e-mail), os Projetos vinculados e o Status (Ativo/Inativo). Use "+ Novo acesso" para cadastrar.', image: '/help/19-client-access.png', imageAlt: 'Lista de acessos de clientes com empresa, contato e projetos' },
      { heading: 'Novo acesso', text: 'Em "+ Novo acesso" preencha Empresa, Nome do contato, E-mail e selecione os Projetos que esse cliente poderá acompanhar no portal.', image: '/help/client-access--novo.png', imageAlt: 'Formulário de novo acesso de cliente' },
      { heading: 'Editar e desativar', text: 'Na coluna Ações você edita os dados ou desativa o acesso — o cliente perde a visibilidade imediatamente.' },
    ],
  },
  'client-messages': {
    title: 'Mensagens do Cliente',
    steps: [
      'Veja e responda mensagens enviadas pelo Portal do Cliente.',
      'Atribua responsáveis internos para cada conversa.',
    ],
    guide: [
      { heading: 'Inbox de mensagens', text: 'Mensagens do Cliente funciona como um inbox: à esquerda ficam as conversas (empresa + assunto + data) e à direita o conteúdo da conversa selecionada, com o histórico de mensagens e o campo de resposta.', image: '/help/20-client-messages.png', imageAlt: 'Inbox de mensagens do cliente com conversa aberta' },
      { heading: 'Responder e atribuir', text: 'Digite a resposta no campo inferior e envie. Use "Atribuir" para definir quem do time interno cuida daquela conversa.' },
      { heading: 'Filtros e busca', text: 'Filtre por status (Aberta / Respondida / Fechada) e busque por empresa ou assunto para encontrar conversas rapidamente.' },
    ],
  },
  client: {
    title: 'Portal do Cliente',
    steps: [
      'Área externa onde o cliente acompanha seus projetos.',
      'Vê o progresso, envia mensagens e consulta entregas.',
    ],
    guide: [
      { heading: 'Visão do cliente', text: 'O Portal do Cliente é a área externa (acessada pelo slug do tenant) onde o cliente acompanha os projetos vinculados. Ele vê cards de progresso, a lista de demandas (com status e prioridade) e pode enviar mensagens ao time.', image: '/help/21-portal-cliente.png', imageAlt: 'Portal do Cliente com progresso e lista de demandas' },
      { heading: 'Mensagens', text: 'Na aba Mensagens o cliente inicia conversas e acompanha as respostas do time interno.' },
      { heading: 'Entregas (Releases)', text: 'Na aba Entregas o cliente consulta as releases publicadas, com descrição e lista de itens entregues.' },
    ],
  },
  team: {
    title: 'Time & Permissões',
    steps: [
      'Gerencie membros, papéis e squads.',
      'Convide novos membros por e-mail.',
    ],
    guide: [
      { heading: 'Lista de membros', text: 'A tela Time & Permissões lista todos os membros do tenant. Cada linha mostra Nome, E-mail, Papel (Admin, PO, Scrum Master, Tech Lead, Dev), Squad e Status (Ativo/Inativo). Use "+ Convidar" para adicionar pessoas.', image: '/help/22-time.png', imageAlt: 'Lista de membros com papel, squad e status' },
      { heading: 'Convidar membro', text: 'Em "+ Convidar" informe o e-mail, escolha o Papel e a Squad. O convidado recebe um link de ativação por e-mail.', image: '/help/time--convidar.png', imageAlt: 'Convidar novo membro' },
      { heading: 'Editar papel e squad', text: 'Na coluna Ações você altera o papel ou a squad de um membro, ou desativa o acesso dele ao tenant.' },
    ],
  },
  profile: {
    title: 'Perfil',
    steps: [
      'Edite seu nome, avatar e dados pessoais.',
      'Altere sua senha quando precisar.',
    ],
    guide: [
      { heading: 'Dados pessoais', text: 'Na página Perfil você edita Nome, E-mail (somente leitura), Avatar (URL ou upload) e Cargo. Clique em "Salvar" para aplicar.', image: '/help/23-perfil.png', imageAlt: 'Página de perfil com dados pessoais' },
      { heading: 'Alterar senha', text: 'Use a seção "Alterar senha" para trocar sua senha atual. Informe a senha atual e a nova (com confirmação).' },
    ],
  },
  preferences: {
    title: 'Preferências',
    steps: [
      'Ajuste tema, idioma e notificações.',
      'Escolha o fuso horário e o formato de data.',
    ],
    guide: [
      { heading: 'Tema e idioma', text: 'Em Preferências você escolhe o Tema (Claro / Escuro / Sistema), o Idioma e o Formato de data. As mudanças são aplicadas imediatamente.', image: '/help/24-preferencias.png', imageAlt: 'Preferências com tema, idioma e formato de data' },
      { heading: 'Notificações', text: 'Na seção Notificações você liga e desliga os canais (e-mail, push, in-app) e escolhe quais eventos geram alerta (atribuição, menção, mudança de status, etc.).' },
      { heading: 'Fuso horário', text: 'O Fuso horário define como datas e horários são exibidos para você em toda a plataforma.' },
    ],
  },
  login: {
    title: 'Login',
    steps: [
      'Acesse com e-mail e senha.',
      'Use "Esqueci a senha" para recuperar o acesso.',
    ],
    guide: [
      { heading: 'Entrar', text: 'Na tela de Login informe seu E-mail e Senha e clique em "Entrar". Se o tenant exigir, você verá a opção de login com Google (OAuth).', image: '/help/25-login.png', imageAlt: 'Tela de login com e-mail e senha' },
      { heading: 'Esqueci a senha', text: 'Clique em "Esqueci a senha" para receber um link de redefinição no seu e-mail cadastrado.' },
      { heading: 'Primeiro acesso (ativação)', text: 'Se você foi convidado, use o link de ativação recebido por e-mail para criar sua senha e acessar o tenant.' },
    ],
  },
  'client-login': {
    title: 'Login do Cliente',
    steps: [
      'Acesso exclusivo do cliente ao Portal.',
      'Use o slug do tenant + credenciais fornecidas.',
    ],
    guide: [
      { heading: 'Entrar no Portal', text: 'O cliente acessa o Portal pelo endereço público (slug) do tenant. Na tela de login ele informa E-mail e Senha (fornecidos pelo time interno) e clica em "Entrar".', image: '/help/26-client-login.png', imageAlt: 'Tela de login do Portal do Cliente' },
      { heading: 'Recuperar senha', text: 'Se o cliente esqueceu a senha, usa "Esqueci a senha" para receber o link de redefinição no e-mail cadastrado.' },
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
