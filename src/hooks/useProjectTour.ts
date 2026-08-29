import { useEffect, useState } from 'react'
import type { TourStep } from '@/components/onboarding/GuidedTour'
import { PROJECT_TOUR_STEPS } from '@/data/projectTourSteps'

// Barramento para iniciar o tour guiado de qualquer tela.
// O <GuidedTour /> vive no Shell (precisa cobrir sidebar + modais).
type Listener = (steps: TourStep[]) => void
const listeners = new Set<Listener>()

export function startTour(steps: TourStep[]) {
  listeners.forEach(l => l(steps))
}

/** Wrapper legado — inicia o tour de criação de projeto. */
export function startProjectTour() {
  startTour(PROJECT_TOUR_STEPS)
}

/** Estado do tour, usado apenas pelo Shell. */
export function useProjectTourState() {
  const [tourActive, setTourActive] = useState(false)
  const [activeSteps, setActiveSteps] = useState<TourStep[]>([])

  useEffect(() => {
    const l: Listener = (steps) => {
      setActiveSteps(steps)
      setTourActive(true)
    }
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  return {
    tourActive,
    activeSteps,
    startTour: (steps: TourStep[]) => {
      setActiveSteps(steps)
      setTourActive(true)
    },
    stopProjectTour: () => {
      setTourActive(false)
      setActiveSteps([])
    },
  }
}
