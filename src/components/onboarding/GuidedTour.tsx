import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { T } from '../ds/tokens'

export interface TourStep {
  selector: string
  title: string
  body: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  navigateTo?: string
  advanceOn?: 'next' | 'target-appears'
}

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 8
const POP_W = 320

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/** Wait until a selector resolves (polling ~5s). */
function waitFor(selector: string, timeout = 5000): Promise<HTMLElement | null> {
  return new Promise(resolve => {
    const existing = document.querySelector(selector) as HTMLElement | null
    if (existing) { resolve(existing); return }
    const started = Date.now()
    const id = window.setInterval(() => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (el || Date.now() - started > timeout) {
        window.clearInterval(id)
        resolve(el)
      }
    }, 120)
  })
}

export function GuidedTour({
  steps,
  onNav,
  onFinish,
  onSkip,
}: {
  steps: TourStep[]
  onNav: (view: string) => void
  onFinish: () => void
  onSkip: () => void
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  const go = useCallback((next: number) => {
    setRect(null)
    targetRef.current = null
    setIndex(Math.max(0, Math.min(steps.length - 1, next)))
  }, [steps.length])

  // Resolve the target for the current step (navigating first if needed).
  useEffect(() => {
    let alive = true
    if (!step) return
    if (step.navigateTo) onNav(step.navigateTo)
    void waitFor(step.selector).then(el => {
      if (!alive || !el) return
      targetRef.current = el
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setRect(rectOf(el))
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, step?.selector])

  // Auto-advance when the next step's target appears (e.g. the user opened a modal).
  useEffect(() => {
    if (!step || step.advanceOn !== 'target-appears') return
    const next = steps[index + 1]
    if (!next) return
    const id = window.setInterval(() => {
      if (document.querySelector(next.selector)) {
        window.clearInterval(id)
        go(index + 1)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [index, step, steps, go])

  // Keep the spotlight glued to the target.
  useLayoutEffect(() => {
    function sync() {
      const el = targetRef.current ?? (step ? document.querySelector(step.selector) as HTMLElement | null : null)
      if (!el || !document.body.contains(el)) return
      targetRef.current = el
      setRect(rectOf(el))
    }
    const id = window.setInterval(sync, 300)
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [step])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onSkip() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])

  if (!step) return null

  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null

  // Popover position
  const vw = window.innerWidth
  const vh = window.innerHeight
  let popTop = vh / 2 - 80
  let popLeft = vw / 2 - POP_W / 2
  if (hole) {
    const placement = step.placement ?? (hole.left + hole.width + POP_W + 24 < vw ? 'right' : 'bottom')
    if (placement === 'right') { popTop = hole.top; popLeft = hole.left + hole.width + 14 }
    else if (placement === 'left') { popTop = hole.top; popLeft = hole.left - POP_W - 14 }
    else if (placement === 'top') { popTop = hole.top - 190; popLeft = hole.left }
    else { popTop = hole.top + hole.height + 14; popLeft = hole.left }
    popLeft = Math.max(12, Math.min(popLeft, vw - POP_W - 12))
    popTop = Math.max(12, Math.min(popTop, vh - 210))
  }

  return (
    <>
      {/* Spotlight overlay — a huge transparent hole punched with box-shadow */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none' }}>
        {hole ? (
          <div
            style={{
              position: 'fixed',
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              borderRadius: 10,
              boxShadow: `0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 2px ${T.accent}`,
              transition: 'all .18s ease',
            }}
          />
        ) : (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
        )}
      </div>

      <div
        role="dialog"
        aria-modal="false"
        aria-label={step.title}
        style={{
          position: 'fixed',
          top: popTop,
          left: popLeft,
          width: POP_W,
          zIndex: 2001,
          background: T.bgSurface,
          border: `1px solid ${T.border2}`,
          borderRadius: 14,
          boxShadow: T.shadowModal,
          padding: 16,
        }}
      >
        <button
          onClick={onSkip}
          aria-label="Fechar tour"
          style={{ position: 'absolute', top: 8, right: 10, background: 'transparent', border: 'none', color: T.text3, fontSize: 16, cursor: 'pointer' }}
        >×</button>

        <p className="m-0 text-[13px] font-semibold" style={{ color: T.text1 }}>{step.title}</p>
        <p className="mt-1.5 mb-0 text-[12px]" style={{ color: T.text2 }}>{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: T.text3 }}>{index + 1} de {steps.length}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className="h-7 px-2 rounded-md text-[11px]"
              style={{ background: 'transparent', color: T.text3, border: `1px solid ${T.border}` }}
            >Pular tour</button>
            {index > 0 && (
              <button
                onClick={() => go(index - 1)}
                className="h-7 px-3 rounded-md text-[11px]"
                style={{ background: T.bgSurface2, color: T.text2, border: `1px solid ${T.border}` }}
              >Anterior</button>
            )}
            <button
              onClick={() => (last ? onFinish() : go(index + 1))}
              className="h-7 px-3 rounded-md text-[11px] font-semibold"
              style={{ background: T.accent, color: '#fff', border: 'none' }}
            >{last ? 'Concluir' : 'Próximo'}</button>
          </div>
        </div>
      </div>
    </>
  )
}
