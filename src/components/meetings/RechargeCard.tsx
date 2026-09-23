// Meeting Intelligence — card "Contratar mais horas" (Onda B, casca até pagamento).
import { useState } from 'react'
import { T } from '@/components/ds/tokens'
import { cardStyle, formatMinutes, formatBRL } from '@/components/meetings/meetingUi'
import { IcPlus, IcShield } from '@/components/meetings/icons'
import { MEETING_PRICING } from '@/config/meetingFlags'
import { purchaseHours, priceCentsForHours } from '@/data/db/meetingBilling'

interface Props {
  poolMinutes: number
  buyerId: string
  onPurchased: () => void
  onToast: (t: string) => void
}

export function RechargeCard({ poolMinutes, buyerId, onPurchased, onToast }: Props) {
  const { rechargeMinHours, rechargeMaxHours, rechargeStepHours, hourlyRateBRL } = MEETING_PRICING
  const [hours, setHours] = useState(Math.max(rechargeMinHours, 10))
  const [saving, setSaving] = useState(false)

  const priceCents = priceCentsForHours(hours)
  const newTotalMinutes = poolMinutes + hours * 60

  async function buy() {
    if (saving) return
    setSaving(true)
    const id = await purchaseHours({ hours, method: 'pix', buyerId })
    setSaving(false)
    if (id) { onPurchased(); onToast(`Contratação de ${hours}h registrada (${formatBRL(priceCents)}).`) }
    else onToast('Não foi possível registrar a contratação.')
  }

  return (
    <div style={{ ...cardStyle, padding: '22px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 600, color: T.text1 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: T.accentDim, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent, flexShrink: 0 }}><IcPlus size={15} /></span>
        Contratar mais horas
      </div>
      <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.55 }}>
        Aumenta o pool do workspace. Use para liberar mais horas às cotas quando o pool estiver no limite.
      </p>
      <input type="range" min={rechargeMinHours} max={rechargeMaxHours} step={rechargeStepHours} value={hours} onChange={e => setHours(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.text3, fontVariantNumeric: 'tabular-nums' }}>
        <span>{rechargeMinHours}h</span><span>25h</span><span>50h</span><span>{rechargeMaxHours}h</span>
      </div>
      <div style={{ background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, color: T.text2 }}>Horas</span>
          <b style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', color: T.text1 }}>{hours} h</b>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', color: T.accent, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(priceCents)}</span>
          <span style={{ fontSize: 12, color: T.text3 }}>no total · {formatBRL(hourlyRateBRL * 100)}/h</span>
        </div>
        <div style={{ fontSize: 11.5, color: T.text3, marginTop: 6 }}>Novo total do mês: <b style={{ color: T.text1 }}>{formatMinutes(newTotalMinutes)}</b></div>
      </div>
      <button onClick={buy} disabled={saving} style={{ width: '100%', height: 46, borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <IcPlus size={16} />Contratar horas
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 11.5, color: T.text3 }}>
        {MEETING_PRICING.paymentMethods.map(pm => (
          <span key={pm} style={{ height: 22, padding: '0 9px', display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: T.bgSurface, border: `1px solid ${T.border}`, color: T.text2 }}>{pm === 'pix' ? 'Pix' : 'Cartão'}</span>
        ))}
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text3 }}><IcShield />Só administradores contratam horas. Cobrança via Pix ou cartão.</span>
    </div>
  )
}
