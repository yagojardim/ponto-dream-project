// Meeting Intelligence — velocímetro de cota de horas (Onda B, casca).
import { T } from '@/components/ds/tokens'
import { cardStyle, formatMinutes } from '@/components/meetings/meetingUi'
import { IcPlus } from '@/components/meetings/icons'
import type { MeetingQuota } from '@/data/db/meetingQuotas'

export function quotaColor(pct: number): string {
  if (pct >= 100) return T.crit
  if (pct >= 80) return T.warn
  return T.success
}

/** Arco semicircular de consumo (0–100%). */
export function Gauge({ pct, size = 150 }: { pct: number; size?: number }) {
  const p = Math.max(0, Math.min(100, pct))
  const color = quotaColor(p)
  const R = 52
  const len = Math.PI * R
  const off = len * (1 - p / 100)
  return (
    <svg viewBox="0 0 120 74" width={size} height={Math.round(size * 0.62)} style={{ display: 'block' }}>
      <path d="M 8 60 A 52 52 0 0 1 112 60" fill="none" stroke={T.bgSurface2} strokeWidth={12} strokeLinecap="round" />
      <path d="M 8 60 A 52 52 0 0 1 112 60" fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" strokeDasharray={len.toFixed(1)} strokeDashoffset={off.toFixed(1)} />
      <text x={60} y={52} textAnchor="middle" fontSize={26} fontWeight={800} fill={T.text1} style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(p)}%</text>
    </svg>
  )
}

/** Mini card "Suas horas" (topo da lista, visão usuário). */
export function QuotaMeter({ quota, onRequest }: { quota: MeetingQuota; onRequest: () => void }) {
  const pct = quota.quotaMinutes > 0 ? Math.min(100, (quota.usedMinutes / quota.quotaMinutes) * 100) : 0
  const border = pct >= 100 ? `${T.crit}66` : pct >= 80 ? `${T.warn}66` : T.border
  return (
    <div style={{ ...cardStyle, padding: '8px 13px', display: 'flex', alignItems: 'center', gap: 11, borderColor: border }}>
      <div style={{ flexShrink: 0 }}><Gauge pct={pct} size={72} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: T.text3, fontWeight: 600, whiteSpace: 'nowrap' }}>
          Suas horas{quota.role ? ` · ${quota.role}` : ''}
        </div>
        <div style={{ fontSize: 13, color: T.text2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          <b style={{ color: T.text1 }}>{formatMinutes(quota.usedMinutes)}</b> / {formatMinutes(quota.quotaMinutes)}
        </div>
        <button onClick={onRequest} style={{ background: 'none', border: 0, padding: 0, marginTop: 2, color: T.accent, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcPlus size={11} />Solicitar mais
        </button>
      </div>
    </div>
  )
}
