import type { TourStep } from '@/components/onboarding/GuidedTour'
import type { RoleContext } from '@/data/session'

// Tours únicos por tela (iguais para todos os papéis).
export const TOUR_STEPS: Record<string, TourStep[]> = {
  // preenchido no PROMPT 2
}

// Tours que variam por papel (só onde o layout muda: home e dashboard).
export const TOUR_STEPS_BY_ROLE: Record<string, Partial<Record<RoleContext, TourStep[]>>> = {
  // preenchido no PROMPT 2
}

export function tourStepsFor(view: string, role?: RoleContext | null): TourStep[] {
  const byRole = role ? TOUR_STEPS_BY_ROLE[view]?.[role] : undefined
  return byRole ?? TOUR_STEPS[view] ?? []
}

export function hasTour(view: string, role?: RoleContext | null): boolean {
  return tourStepsFor(view, role).length > 0
}

// Id de persistência: por view, e por view:role onde varia por papel.
export function tourIdFor(view: string, role?: RoleContext | null): string {
  return role && TOUR_STEPS_BY_ROLE[view]?.[role] ? `${view}:${role}` : view
}
