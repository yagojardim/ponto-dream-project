import { T } from '../ds/tokens'
import { useToast } from '../ds/Toast'
import { useOnboarding } from '@/hooks/useOnboarding'
import { ONBOARDING_TIPS } from '@/data/onboardingContent'

interface OnboardingTipProps {
  view: string
  forceOpen?: boolean
  onClose?: () => void
}

export function OnboardingTip({ view, forceOpen, onClose }: OnboardingTipProps) {
  const tip = ONBOARDING_TIPS[view]
  const { loaded, guideDisabled, isTipSeen, markTipSeen, disableGuide } = useOnboarding()
  const { toast } = useToast()

  const autoOpen = loaded && !guideDisabled && !isTipSeen(view)
  const open = forceOpen === true || autoOpen
  if (!open) return null
  if (!tip && forceOpen !== true) return null

  const shellStyle = {
    position: 'fixed' as const,
    top: 72,
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: 460,
    width: 'calc(100% - 32px)',
    zIndex: 1200,
    background: 'rgba(22,22,29,0.94)',
    backdropFilter: 'blur(6px)',
    border: `1px solid ${T.border}`,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
  }

  function handleDismiss() {
    if (forceOpen) onClose?.()
    else markTipSeen(view)
  }

  function handleUnderstood() {
    markTipSeen(view)
    onClose?.()
  }

  if (!tip) {
    return (
      <div role="note" className="rounded-xl p-4" style={shellStyle}>
        <div className="flex items-start justify-between gap-3">
          <p className="m-0 text-[13px]" style={{ color: T.text2 }}>Sem dica para esta tela ainda.</p>
          <button
            onClick={() => onClose?.()}
            aria-label="Fechar dica"
            className="h-5 w-5 rounded-full text-[11px] leading-none flex-shrink-0"
            style={{ background: T.bgSurface2, color: T.text3, border: `1px solid ${T.border}` }}
          >×</button>
        </div>
      </div>
    )
  }

  return (
    <div role="note" className="rounded-xl p-4" style={shellStyle}>
      <div className="flex items-start justify-between gap-3">
        <p className="m-0 text-[13px] font-semibold" style={{ color: T.text1 }}>
          💡 Como usar: {tip.title}
        </p>
        <button
          onClick={handleDismiss}
          aria-label="Fechar dica"
          className="h-5 w-5 rounded-full text-[11px] leading-none flex-shrink-0"
          style={{ background: T.bgSurface2, color: T.text3, border: `1px solid ${T.border}` }}
        >×</button>
      </div>
      <ul className="mt-2 mb-0 pl-4 flex flex-col gap-1">
        {tip.steps.map((s, i) => (
          <li key={i} className="text-[12px]" style={{ color: T.text2 }}>{s}</li>
        ))}
      </ul>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleUnderstood}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold"
          style={{ background: T.accent, color: '#fff' }}
        >
          Entendi
        </button>
        <button
          onClick={() => {
            disableGuide()
            onClose?.()
            toast({
              variant: 'info',
              title: 'Dicas desativadas',
              body: 'Elas continuam em Feedback & Suporte › Central de Ajuda.',
            })
          }}
          className="h-8 px-3 rounded-lg text-[12px] font-medium"
          style={{ background: 'transparent', color: T.text2, border: `1px solid ${T.border}` }}
        >
          Não mostrar mais dicas
        </button>
      </div>
    </div>
  )
}

export default OnboardingTip
