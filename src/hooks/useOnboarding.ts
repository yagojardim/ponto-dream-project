import { useCallback, useEffect, useState } from 'react'
import { useSession } from '@/data/SessionContext'
import { getUserPref, saveUserPref } from '@/data/db/userPrefs'
import { logger } from '@/utils/logger'

const PREF_KEY = 'onboarding'

export interface OnboardingState {
  welcomeDone: boolean
  guideDisabled: boolean
  tips: Record<string, boolean>
}

const EMPTY: OnboardingState = { welcomeDone: false, guideDisabled: false, tips: {} }

export function useOnboarding() {
  const { activeUser } = useSession()
  const userId = activeUser?.user_id ?? ''
  const [state, setState] = useState<OnboardingState>(EMPTY)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    if (!userId) { setLoaded(false); return }
    setLoaded(false)
    getUserPref<OnboardingState>(userId, PREF_KEY)
      .then(v => {
        if (!alive) return
        setState({
          welcomeDone: Boolean(v?.welcomeDone),
          guideDisabled: Boolean(v?.guideDisabled),
          tips: v?.tips ?? {},
        })
        setLoaded(true)
      })
      .catch(err => {
        logger.error('onboarding.load', err, { userId })
        if (alive) { setState(EMPTY); setLoaded(true) }
      })
    return () => { alive = false }
  }, [userId])

  const persist = useCallback((next: OnboardingState) => {
    if (!userId) return
    try {
      void saveUserPref(userId, PREF_KEY, next).catch(err => logger.error('onboarding.save', err))
    } catch (err) {
      logger.error('onboarding.save', err, { userId })
    }
  }, [userId])

  const markWelcomeDone = useCallback(() => {
    setState(prev => { const next = { ...prev, welcomeDone: true }; persist(next); return next })
  }, [persist])

  const disableGuide = useCallback(() => {
    setState(prev => { const next = { ...prev, guideDisabled: true }; persist(next); return next })
  }, [persist])

  const markTipSeen = useCallback((view: string) => {
    setState(prev => {
      const next = { ...prev, tips: { ...prev.tips, [view]: true } }
      persist(next)
      return next
    })
  }, [persist])

  const isTipSeen = useCallback((view: string) => Boolean(state.tips[view]), [state.tips])

  return {
    loaded,
    welcomeDone: state.welcomeDone,
    guideDisabled: state.guideDisabled,
    markWelcomeDone,
    disableGuide,
    isTipSeen,
    markTipSeen,
  }
}
