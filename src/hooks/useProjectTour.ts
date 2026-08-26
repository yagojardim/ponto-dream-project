import { useEffect, useState } from 'react'

// Pequeno barramento para iniciar o tour guiado de qualquer tela.
// O <GuidedTour /> vive no Shell (precisa cobrir sidebar + modais).
type Listener = () => void
const listeners = new Set<Listener>()

export function startProjectTour() {
  listeners.forEach(l => l())
}

/** Estado do tour, usado apenas pelo Shell. */
export function useProjectTourState() {
  const [tourActive, setTourActive] = useState(false)

  useEffect(() => {
    const l: Listener = () => setTourActive(true)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  return {
    tourActive,
    startTour: () => setTourActive(true),
    stopProjectTour: () => setTourActive(false),
  }
}
