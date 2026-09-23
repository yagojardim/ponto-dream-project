// Meeting Intelligence — widget de horas para o board da Início (Onda B, casca).
// Registrado no catálogo só quando HOURS_QUOTA_ENABLED (ver src/data/homeWidgets.tsx),
// então fica invisível até a cota de horas ligar. framed: o grid o envolve num SCard.
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { useSession } from '@/data/SessionContext'
import { Gauge } from '@/components/meetings/QuotaMeter'
import { formatMinutes } from '@/components/meetings/meetingUi'
import { getMyQuota, getPool, listTenantQuotas } from '@/data/db/meetingQuotas'
import type { WidgetCtx } from '@/components/home/nativeWidgets'

export function MeetingHoursWidget({ ctx }: { ctx: WidgetCtx }) {
  const { activeUser, isTenantOwner } = useSession()
  const isAdmin = isTenantOwner || activeUser.role_context === 'Admin'
  const [state, setState] = useState<{ pct: number; used: number; total: number; label: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      if (isAdmin) {
        const [pool, quotas] = await Promise.all([getPool(), listTenantQuotas()])
        const total = pool.contractedMinutes + pool.extraMinutes
        const used = quotas.reduce((a, q) => a + q.usedMinutes, 0) || pool.usedMinutes
        if (alive) setState({ pct: total > 0 ? Math.min(100, (used / total) * 100) : 0, used, total, label: 'consumo do workspace' })
      } else {
        const q = await getMyQuota(activeUser.user_id)
        if (alive) setState(q ? { pct: q.quotaMinutes > 0 ? Math.min(100, (q.usedMinutes / q.quotaMinutes) * 100) : 0, used: q.usedMinutes, total: q.quotaMinutes, label: 'horas usadas no mês' } : null)
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [isAdmin, activeUser.user_id])

  if (loading) return <div style={{ padding: 20, color: T.text3, fontSize: 13 }}>Carregando…</div>
  if (!state) return <div style={{ padding: 20, color: T.text3, fontSize: 13 }}>Sem cota de horas atribuída.</div>

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 4px', height: '100%' }}>
      <div style={{ flexShrink: 0 }}><Gauge pct={state.pct} size={110} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
          <b style={{ color: T.text1 }}>{formatMinutes(state.used)}</b> de <b style={{ color: T.text1 }}>{formatMinutes(state.total)}</b>
        </div>
        <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2 }}>{state.label}</div>
        <button onClick={() => ctx.interactive && ctx.onNav('meetings')} style={{ marginTop: 8, background: 'none', border: 0, padding: 0, color: T.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Abrir Reuniões →</button>
      </div>
    </div>
  )
}
