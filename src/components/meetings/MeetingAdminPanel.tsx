// Meeting Intelligence — Gestão do módulo (admin). Onda B, casca oculta por HOURS_QUOTA_ENABLED.
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { cardStyle, Avatar, formatMinutes } from '@/components/meetings/meetingUi'
import { quotaColor } from '@/components/meetings/QuotaMeter'
import { IcBell, IcCheck, IcPlus } from '@/components/meetings/icons'
import { AddUsersModal } from '@/components/meetings/AddUsersModal'
import { RechargeCard } from '@/components/meetings/RechargeCard'
import { MEETING_FLAGS } from '@/config/meetingFlags'
import { getPool, listTenantQuotas, type MeetingPool, type MeetingQuota } from '@/data/db/meetingQuotas'
import { listRequests, approveRequest, denyRequest, type HourRequest } from '@/data/db/meetingRequests'

interface Props {
  currentUser: { id: string; name: string; isAdmin: boolean }
  onToast: (t: string) => void
}

const EMPTY_POOL: MeetingPool = { contractedMinutes: 0, extraMinutes: 0, usedMinutes: 0, renovaAt: null }

export function MeetingAdminPanel({ currentUser, onToast }: Props) {
  const [pool, setPool] = useState<MeetingPool>(EMPTY_POOL)
  const [quotas, setQuotas] = useState<MeetingQuota[]>([])
  const [requests, setRequests] = useState<HourRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [grants, setGrants] = useState<Record<string, number>>({})
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [denyReason, setDenyReason] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [p, q, r] = await Promise.all([getPool(), listTenantQuotas(), listRequests('pending')])
      if (!alive) return
      setPool(p); setQuotas(q); setRequests(r)
      setGrants(Object.fromEntries(r.map(x => [x.id, x.minutes])))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [reloadKey])

  const contracted = pool.contractedMinutes + pool.extraMinutes
  const used = pool.usedMinutes
  const restantes = Math.max(0, contracted - used)
  const pct = contracted > 0 ? Math.min(100, (used / contracted) * 100) : 0
  const color = quotaColor(pct)
  const sortedQuotas = [...quotas].sort((a, b) => {
    const pa = a.quotaMinutes > 0 ? a.usedMinutes / a.quotaMinutes : 0
    const pb = b.quotaMinutes > 0 ? b.usedMinutes / b.quotaMinutes : 0
    return pb - pa
  })

  async function approve(req: HourRequest) {
    const granted = grants[req.id] ?? req.minutes
    const ok = await approveRequest(req, granted, currentUser.id)
    if (ok) { setReloadKey(k => k + 1); onToast(`Aprovado: +${formatMinutes(granted)} para ${req.requesterName}.`) }
    else onToast('Não foi possível aprovar.')
  }

  async function confirmDeny(req: HourRequest) {
    if (!denyReason.trim()) { onToast('Escreva o motivo da recusa.'); return }
    const ok = await denyRequest(req, denyReason, currentUser.id)
    if (ok) { setDenyingId(null); setDenyReason(''); setReloadKey(k => k + 1); onToast(`Solicitação de ${req.requesterName} negada.`) }
    else onToast('Não foi possível recusar.')
  }

  const kpi = (label: string, value: string, sub?: string, col?: string) => (
    <div style={{ flex: 1, minWidth: 130, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: T.text3, marginBottom: 7, fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 22, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em', color: col ?? T.text1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.text3, marginTop: 3 }}>{sub}</div>}
    </div>
  )

  if (loading) return <div style={{ ...cardStyle, padding: 40, textAlign: 'center', color: T.text3 }}>Carregando gestão…</div>

  return (
    <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Consumo do mês */}
        <div style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Consumo do mês</div>
            {pool.renovaAt && <div style={{ fontSize: 12.5, color: T.text3 }}>Renova em {pool.renovaAt}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.02em', color, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</span>
            <span style={{ fontSize: 13.5, color: T.text2, paddingBottom: 6 }}>{formatMinutes(used)} de {formatMinutes(contracted)} usadas</span>
          </div>
          <div style={{ height: 14, borderRadius: 8, background: T.bgSurface2, overflow: 'hidden', border: `1px solid ${T.border}` }}>
            <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: color, borderRadius: '8px 0 0 8px' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {kpi('Contratadas', formatMinutes(contracted), `${formatMinutes(pool.contractedMinutes)} + ${formatMinutes(pool.extraMinutes)} extras`)}
            {kpi('Usadas', formatMinutes(used), `${quotas.length} usuário(s)`)}
            {kpi('Restantes', formatMinutes(restantes), 'até a renovação', restantes <= 0 ? T.crit : undefined)}
          </div>
        </div>

        {/* Fila de solicitações */}
        {requests.length > 0 && (
          <div style={{ ...cardStyle, padding: '8px 8px 4px', borderColor: T.accentBorder }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 10px' }}>
              <span style={{ color: T.accent, display: 'inline-flex' }}><IcBell size={15} /></span>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Solicitações de horas</div>
              <span style={{ height: 22, padding: '0 9px', display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}`, fontSize: 11.5 }}>{requests.length} pendente(s)</span>
            </div>
            {requests.map(r => (
              <div key={r.id} style={{ padding: '14px 16px', borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 6 }}>
                      <b style={{ color: T.text1 }}>{r.requesterName}</b>
                      <span style={{ fontSize: 11.5, color: T.text3 }}>{r.requesterRole ?? '—'}</span>
                      <span style={{ height: 20, padding: '0 8px', display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: `1px solid ${r.type === 'definitiva' ? `${T.purple}66` : T.border}`, color: r.type === 'definitiva' ? T.purple : T.text2, fontSize: 11 }}>{r.type === 'definitiva' ? 'Definitiva' : 'Temporária'}</span>
                      <span style={{ height: 20, padding: '0 8px', display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: `1px solid ${T.accentBorder}`, color: T.accent, fontSize: 11 }}>+{formatMinutes(r.minutes)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>"{r.justification}"</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 11, color: T.text3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      Conceder (min)
                      <input type="number" step={30} min={30} value={grants[r.id] ?? r.minutes}
                        onChange={e => setGrants(g => ({ ...g, [r.id]: Number(e.target.value) }))}
                        style={{ width: 70, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgSurface2, color: T.text1, fontSize: 12.5, padding: '0 8px', fontFamily: 'inherit' }} />
                    </label>
                    <button onClick={() => { setDenyingId(denyingId === r.id ? null : r.id); setDenyReason('') }} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Negar</button>
                    <button onClick={() => approve(r)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><IcCheck />Aprovar</button>
                  </div>
                </div>
                {denyingId === r.id && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} placeholder="Motivo da recusa (o usuário verá esta mensagem)…"
                      style={{ width: '100%', minHeight: 64, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text1, fontSize: 13, fontFamily: 'inherit', padding: '9px 11px', outline: 'none', resize: 'vertical' }} autoFocus />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setDenyingId(null); setDenyReason('') }} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                      <button onClick={() => confirmDeny(r)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: T.crit, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Confirmar recusa</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Cota por usuário */}
        <div style={{ ...cardStyle, padding: '8px 8px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px 10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Cota por usuário</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: T.text3 }}>{quotas.length} com o módulo</span>
              <button onClick={() => setAddOpen(true)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.accentBorder}`, background: 'transparent', color: T.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}><IcPlus />Liberar acesso</button>
            </div>
          </div>
          {quotas.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: T.text3, fontSize: 13 }}>Ninguém com o módulo ainda. Use <b>Liberar acesso</b>.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '11px 12px', borderBottom: `1px solid ${T.border}`, color: T.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Usuário</th>
                  <th style={{ textAlign: 'left', padding: '11px 12px', borderBottom: `1px solid ${T.border}`, color: T.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Consumo (usado / cota)</th>
                  <th style={{ textAlign: 'right', padding: '11px 12px', borderBottom: `1px solid ${T.border}`, color: T.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>% da cota</th>
                </tr></thead>
                <tbody>
                  {sortedQuotas.map(u => {
                    const p = u.quotaMinutes > 0 ? Math.min(100, (u.usedMinutes / u.quotaMinutes) * 100) : 0
                    const c = quotaColor(p)
                    return (
                      <tr key={u.profileId}>
                        <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <Avatar name={u.name} seed={u.profileId} size={30} />
                            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, color: T.text1 }}>{u.name}</div><div style={{ fontSize: 11.5, color: T.text3 }}>{u.role ?? '—'}</div></div>
                          </div>
                        </td>
                        <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}`, minWidth: 210 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, height: 8, borderRadius: 5, background: T.bgSurface2, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${p}%`, background: c, borderRadius: 5 }} /></div>
                            <span style={{ fontVariantNumeric: 'tabular-nums', color: T.text1, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatMinutes(u.usedMinutes)} / {formatMinutes(u.quotaMinutes)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: c, fontWeight: 600 }}>{Math.round(p)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {MEETING_FLAGS.BILLING_ENABLED && (
        <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
          <RechargeCard poolMinutes={contracted} buyerId={currentUser.id} onPurchased={() => setReloadKey(k => k + 1)} onToast={onToast} />
        </div>
      )}

      {addOpen && <AddUsersModal onClose={() => setAddOpen(false)} onDone={() => setReloadKey(k => k + 1)} onToast={onToast} />}
    </div>
  )
}
