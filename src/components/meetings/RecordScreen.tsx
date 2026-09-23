// Meeting Intelligence — tela "Gravar reunião" (mockup renderRecord). Onda B, casca.
// A UI e o cronômetro são reais; a CAPTURA de áudio (MediaRecorder) e o envio ao
// motor de transcrição entram ao ligar RECORDING_ENABLED / TRANSCRIPTION_ENABLED.
import { useEffect, useRef, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { pageStyle, cardStyle } from '@/components/meetings/meetingUi'
import { IcCheck, IcSpark, IcShield } from '@/components/meetings/icons'

interface Props {
  title: string
  onCancel: () => void
  onToast: (t: string) => void
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function RecordScreen({ title, onCancel, onToast }: Props) {
  const [phase, setPhase] = useState<'recording' | 'stopped'>('recording')
  const [seconds, setSeconds] = useState(0)
  const [shareAudio, setShareAudio] = useState(true)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (phase !== 'recording') return
    timer.current = window.setInterval(() => setSeconds(s => s + 1), 1000)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [phase])

  function startTranscription() {
    // Ponto de integração: subir o áudio + acionar o motor de transcrição.
    onToast('Transcrição indisponível até configurar o motor de gravação/transcrição.')
    onCancel()
  }

  const bars = Array.from({ length: 11 })

  return (
    <div style={pageStyle}>
      <style>{`@keyframes mi-pulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes mi-eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}`}</style>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 14, fontFamily: 'inherit' }}>‹ Reuniões</button>
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: T.text1 }}>{title || 'Gravar reunião'}</h1>
        <p style={{ margin: '6px 0 20px', fontSize: 14, color: T.text2 }}>Gravação na própria aba — sem instalar nada.</p>

        <div style={{ ...cardStyle, padding: 24 }}>
          {phase === 'recording' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '34px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.crit, fontWeight: 600, fontSize: 13 }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: T.crit, animation: 'mi-pulse 1.2s ease-in-out infinite' }} />GRAVANDO
              </div>
              <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: T.text1 }}>{fmtDur(seconds)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 48 }}>
                {bars.map((_, i) => (
                  <span key={i} style={{ width: 5, height: '100%', borderRadius: 3, background: T.accent, transformOrigin: 'center', animation: 'mi-eq 1s ease-in-out infinite', animationDelay: `${(i * 0.08).toFixed(2)}s` }} />
                ))}
              </div>
              <button onClick={() => setPhase('stopped')} style={{ height: 44, padding: '0 18px', borderRadius: 8, background: T.critDim, color: T.crit, border: `1px solid ${T.crit}4D`, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: T.crit, display: 'inline-block' }} />Encerrar gravação
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: T.successDim, border: `1px solid ${T.success}4D`, color: T.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcCheck size={20} /></span>
                <div><div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Gravação encerrada</div><div style={{ fontSize: 12.5, color: T.text2 }}>Duração {fmtDur(seconds)}</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                <button onClick={onCancel} style={{ height: 40, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Descartar</button>
                <button onClick={startTranscription} style={{ marginLeft: 'auto', height: 44, padding: '0 18px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}><IcSpark size={16} />Iniciar transcrição</button>
              </div>
            </div>
          )}
        </div>

        {phase === 'recording' && (
          <div style={{ ...cardStyle, padding: '14px 18px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>Também capturar o áudio da call</div>
              <div style={{ fontSize: 12, color: T.text3 }}>Para reuniões remotas de fone. Abre o compartilhamento de aba do navegador (Chrome/Edge).</div>
            </div>
            <button onClick={() => setShareAudio(v => !v)} aria-label="Capturar áudio da call" style={{ width: 38, height: 22, borderRadius: 999, background: shareAudio ? T.accent : T.border2, position: 'relative', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: shareAudio ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'left .2s' }} />
            </button>
          </div>
        )}

        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text3, marginTop: 14 }}>
          <IcShield />Consentimento do módulo registrado. Avise os participantes antes de gravar.
        </p>
      </div>
    </div>
  )
}
