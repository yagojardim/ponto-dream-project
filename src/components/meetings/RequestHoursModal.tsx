// Meeting Intelligence — modal "Solicitar mais horas" (Onda B, casca).
import { useState } from 'react'
import { T } from '@/components/ds/tokens'
import { overlayStyle, modalStyle, formatMinutes } from '@/components/meetings/meetingUi'
import { IcPlus, IcClose, IcClock, IcRefresh, IcShield } from '@/components/meetings/icons'
import { createRequest, type HourRequestType } from '@/data/db/meetingRequests'

interface Props {
  requester: { id: string; name: string; role: string | null }
  onClose: () => void
  onSubmitted: () => void
  onToast: (t: string) => void
}

const MIN = 30
const MAX = 600
const STEP = 30

export function RequestHoursModal({ requester, onClose, onSubmitted, onToast }: Props) {
  const [type, setType] = useState<HourRequestType>('temporaria')
  const [minutes, setMinutes] = useState(120)
  const [justification, setJustification] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!justification.trim()) { onToast('Escreva uma justificativa.'); return }
    setSaving(true)
    const ok = await createRequest({ type, minutes, justification }, requester)
    setSaving(false)
    if (ok) { onSubmitted(); onClose(); onToast('Solicitação enviada para a gestão.') }
    else onToast('Não foi possível enviar a solicitação.')
  }

  const opt = (val: HourRequestType, title: string, desc: string, icon: React.ReactNode) => {
    const on = type === val
    return (
      <button onClick={() => setType(val)} style={{
        flex: 1, minWidth: 180, textAlign: 'left', background: T.bgSurface2,
        border: `1px solid ${on ? T.accentBorder : T.border}`, borderRadius: 12, padding: '13px 14px',
        cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: 'inherit',
      }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: on ? T.accentDim : T.bgSurface, border: `1px solid ${on ? T.accentBorder : T.border}`, color: on ? T.accent : T.text3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
        <span>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: T.text1 }}>{title}</span>
          <span style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.4 }}>{desc}</span>
        </span>
      </button>
    )
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: T.accentDim, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent, flexShrink: 0 }}><IcPlus size={17} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: T.text1 }}>Solicitar mais horas</div>
            <div style={{ fontSize: 12.5, color: T.text2 }}>{requester.name}{requester.role ? ` · ${requester.role}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', display: 'inline-flex' }}><IcClose /></button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.text1 }}>1. Tipo da solicitação</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {opt('temporaria', 'Temporária', 'Vale só para este mês. Zera na renovação.', <IcClock size={14} />)}
              {opt('definitiva', 'Definitiva', 'Aumenta a sua cota base todo mês.', <IcRefresh size={14} />)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.text1 }}>
              2. Quantas horas {type === 'temporaria' ? '(neste mês)' : '(a mais por mês)'}
            </label>
            <input type="range" min={MIN} max={MAX} step={STEP} value={minutes} onChange={e => setMinutes(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.text3 }}>
              <span>30 min</span>
              <span style={{ color: T.text1, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatMinutes(minutes)}</span>
              <span>10 h</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.text1 }}>3. Justificativa</label>
            <textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="Explique por que precisa de mais horas (ex.: semana de kickoff com clientes novos)…"
              style={{ width: '100%', minHeight: 88, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text1, fontSize: 13.5, fontFamily: 'inherit', padding: '10px 12px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text3 }}>
            <IcShield />Vai para a fila de aprovação do administrador. Você é avisado da decisão.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', borderTop: `1px solid ${T.border}`, background: T.bgSurface2 }}>
          <button onClick={onClose} style={{ marginLeft: 'auto', height: 38, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}>{saving ? 'Enviando…' : 'Enviar solicitação'}</button>
        </div>
      </div>
    </div>
  )
}
