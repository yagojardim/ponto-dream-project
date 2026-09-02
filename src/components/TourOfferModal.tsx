import { useState } from 'react'
import { T } from './ds/tokens'

interface Props {
  /** Cliente escolheu iniciar o tour guiado interativo. */
  onStart: () => void
  /** Cliente pulou / recusou — o tour fica disponível na Central de Ajuda. */
  onSkip: () => void
}

interface Slide { img: string; title: string; cap: string }

// Prints reutilizados da Central de Ajuda (public/help). Iguais para todos os perfis.
const SLIDES: Slide[] = [
  { img: '/help/00-inicio.png', title: 'Início', cap: 'Seu painel muda conforme o papel — cada perfil vê os indicadores que importam.' },
  { img: '/help/04-board--kanban.png', title: 'Board Kanban', cap: 'Arraste as demandas entre as colunas; inicie a daily ou encerre a sprint pelo board.' },
  { img: '/help/01-minha-fila.png', title: 'Minha Fila', cap: 'Tudo que está atribuído a você, agrupado e priorizado num só lugar.' },
  { img: '/help/02-calendario.png', title: 'Calendário', cap: 'Prazos e cerimônias da sprint; gere Daily, Planning, Review e Retro automaticamente.' },
  { img: '/help/05-lista.png', title: 'Lista de Demandas', cap: 'Filtre, agrupe e exporte as demandas do jeito que precisar.' },
]

type Phase = 'browse' | 'offer' | 'declined'

export function TourOfferModal({ onStart, onSkip }: Props) {
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>('browse')

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1100,
    background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  }
  const card: React.CSSProperties = {
    width: '100%', maxWidth: 640, background: T.bgSurface,
    border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.shadowModal,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }
  const last = i === SLIDES.length - 1

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: T.accentDim, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent, fontWeight: 700, fontSize: 12 }}>A</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>Altech <span style={{ color: T.accent }}>Project</span></span>
          </div>
          {phase === 'browse' && (
            <button onClick={onSkip} style={{ background: 'transparent', border: 'none', color: T.text3, fontSize: 12, cursor: 'pointer' }}>Pular</button>
          )}
        </div>

        {phase === 'browse' && (
          <>
            <div style={{ padding: '18px 22px 8px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.text3 }}>{i + 1} de {SLIDES.length}</p>
              <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: T.text1 }}>{SLIDES[i].title}</h3>
              <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgPage, overflow: 'hidden', aspectRatio: '16 / 9' }}>
                <img
                  src={SLIDES[i].img}
                  alt={SLIDES[i].title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
                />
              </div>
              <p style={{ margin: '12px 2px 0', fontSize: 13, color: T.text2, lineHeight: 1.5, minHeight: 40 }}>{SLIDES[i].cap}</p>
            </div>

            {/* Nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 18px' }}>
              <button
                onClick={() => setI(v => Math.max(0, v - 1))}
                disabled={i === 0}
                style={{ width: 34, height: 34, borderRadius: 8, background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text2, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1, fontSize: 16 }}
              >‹</button>

              <div style={{ display: 'flex', gap: 7 }}>
                {SLIDES.map((_, j) => (
                  <span
                    key={j}
                    onClick={() => setI(j)}
                    style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', background: j === i ? T.accent : T.border }}
                  />
                ))}
              </div>

              <button
                onClick={() => (last ? setPhase('offer') : setI(v => Math.min(SLIDES.length - 1, v + 1)))}
                style={{ minWidth: 34, height: 34, padding: last ? '0 14px' : 0, borderRadius: 8, background: T.accent, border: 'none', color: '#fff', cursor: 'pointer', fontSize: last ? 13 : 16, fontWeight: last ? 600 : 400 }}
              >{last ? 'Continuar' : '›'}</button>
            </div>
          </>
        )}

        {phase === 'offer' && (
          <div style={{ padding: '28px 24px 22px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.accentDim, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: T.text1 }}>Deseja iniciar o tour guiado pela plataforma?</h3>
            <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
              O tour interativo aponta os recursos direto na tela, passo a passo — mostrando só as telas liberadas para o seu perfil.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 22 }}>
              <button onClick={() => setPhase('declined')} style={{ height: 40, padding: '0 18px', borderRadius: 8, fontSize: 13, background: 'transparent', color: T.text2, border: `1px solid ${T.border}`, cursor: 'pointer' }}>Agora não</button>
              <button onClick={onStart} style={{ height: 40, padding: '0 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer' }}>Sim, iniciar tour</button>
            </div>
          </div>
        )}

        {phase === 'declined' && (
          <div style={{ padding: '28px 24px 22px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.successDim, border: `1px solid ${T.success}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: T.text1 }}>Sem problema!</h3>
            <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
              O tour guiado fica disponível quando você quiser em <strong style={{ color: T.text1 }}>Feedback &amp; Suporte › Central de Ajuda</strong>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
              <button onClick={onSkip} style={{ height: 40, padding: '0 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer' }}>Entendi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TourOfferModal
