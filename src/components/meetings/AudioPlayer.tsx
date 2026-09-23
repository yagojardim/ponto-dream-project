// Meeting Intelligence — player + baixar áudio (Onda B, casca RECORDING).
// Só renderiza quando há audio_url (gravação). Baixar disponível apenas ao dono.
import { useRef, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { cardStyle } from '@/components/meetings/meetingUi'
import { IcPlay, IcPause, IcDownload } from '@/components/meetings/icons'

interface Props {
  audioUrl: string
  canDownload: boolean
}

export function AudioPlayer({ audioUrl, canDownload }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [pct, setPct] = useState(0)

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause() } else { void el.play() }
    setPlaying(p => !p)
  }

  function onTime() {
    const el = audioRef.current
    if (!el || !el.duration) return
    setPct((el.currentTime / el.duration) * 100)
  }

  return (
    <div style={{ ...cardStyle, padding: '11px 16px', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <audio ref={audioRef} src={audioUrl} onTimeUpdate={onTime} onEnded={() => { setPlaying(false); setPct(0) }} style={{ display: 'none' }} />
      <button onClick={toggle} style={{ width: 38, height: 38, padding: 0, borderRadius: 999, background: T.accent, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
        {playing ? <IcPause /> : <IcPlay />}
      </button>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: T.border2, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: T.accent, borderRadius: 3 }} />
      </div>
      {canDownload
        ? <a href={audioUrl} download style={{ height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.bgSurface2, color: T.text1, fontSize: 12.5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}><IcDownload />Baixar áudio</a>
        : <span style={{ fontSize: 12, color: T.text3, flexShrink: 0 }}>Ouvir gravação</span>}
    </div>
  )
}
