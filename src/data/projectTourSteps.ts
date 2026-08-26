import type { TourStep } from '@/components/onboarding/GuidedTour'

export const PROJECT_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="nav-projects"]',
    navigateTo: 'projects-list',
    placement: 'right',
    title: 'Comece por Projetos',
    body: 'Tudo começa aqui. Esta é a área de Projetos & Tarefas.',
  },
  {
    selector: '[data-tour="new-project-btn"]',
    placement: 'bottom',
    title: 'Novo projeto',
    body: 'Clique em “+ Novo Projeto” para abrir o formulário.',
    advanceOn: 'target-appears',
  },
  {
    selector: '[data-tour="project-name"]',
    placement: 'right',
    title: 'Nome e cliente',
    body: 'Dê um nome ao projeto e informe o cliente responsável.',
  },
  {
    selector: '[data-tour="project-dates"]',
    placement: 'right',
    title: 'Período (opcional)',
    body: 'Defina início e fim para aparecer na Timeline/Gantt — dá para ajustar depois.',
  },
  {
    selector: '[data-tour="project-save"]',
    placement: 'top',
    title: 'Criar o projeto',
    body: 'Pronto! Clique em Criar para salvar o projeto.',
  },
]
