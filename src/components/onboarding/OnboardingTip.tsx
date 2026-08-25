import { useState } from 'react'
import { T } from '../ds/tokens'
import { useToast } from '../ds/Toast'
import { useOnboarding } from '@/hooks/useOnboarding'
import { ONBOARDING_TIPS } from '@/data/onboardingContent'

export function OnboardingTip({ view }: { view: string }) {
  const tip = ONBOARDING_TIPS[view]
  const { loaded, guideDisabled, isTipSeen, markTipSeen, disableGuide } = useOnboarding()
  const { toast } = useToast()
  const [reopened, setReopened] = useState(false)

  if (!tip) return null

  const autoOpen = loaded && !guideDisabled && !isTipSeen(view)
  const open = autoOpen || reopened

  return (
    <div className="px-6 pt-4">
      {open ? (
        <div
          role="note"
          className="rounded-xl p-4"
          style={{ background: T.accentDim, border: `1px solid ${T.accentBorder}` }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="m-0 text-[13px] font-semibold" style={{ color: T.text1 }}>
              💡 Como usar: {tip.title}
            </p>
            <button
              onClick={() => { setReopened(false); markTipSeen(view) }}
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
              onClick={() => { setReopened(false); markTipSeen(view) }}
              className="h-8 px-3 rounded-lg text-[12px] font-semibold"
              style={{ background: T.accent, color: '#fff' }}
            >
              Entendi
            </button>
            <button
              onClick={() => {
                setReopened(false)
                disableGuide()
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
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => setReopened(true)}
            title={`Como usar: ${tip.title}`}
            aria-label={`Como usar: ${tip.title}`}
            className="h-6 w-6 rounded-full text-[12px] font-semibold leading-none"
            style={{ background: T.bgSurface2, color: T.text3, border: `1px solid ${T.border}` }}
          >?</button>
        </div>
      )}
    </div>
  )
}

export default OnboardingTip
