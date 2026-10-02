import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { LoadingState, EmptyState } from '@/components/ds/DashboardKit'
import { fetchDashViewOverview, INACTIVE_DASH_DAYS, type DashViewRow } from '@/data/db/clientPortal'

interface Props {
  onBack: () => void
  onNav: (view: string, targetId?: string) => void
}

const cardStyle: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden',
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`
}

export default function InactiveDashesPage({ onBack, onNav }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dashes, setDashes] = useState<DashViewRow[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError('')
      try {
        const overview = await fetchDashViewOverview()
        if (!alive) return
        setDashes(overview.dashes.filter(d => d.inactive).sort((a, b) => b.inactiveDays - a.inactiveDays))
      } catch {
        if (alive) setError('Não foi possível carregar os dashes inativos.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <div style={{ padding: 24, background: T.bgPage, minHeight: '100%' }}>
      <div onClick={onBack} style={{ fontSize: 12.5, color: T.accent, cursor: 'pointer', marginBottom: 14, display: 'inline-block' }}>
        ← Voltar para a gestão
      </div>

      <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text1 }}>Dashes inativos</h1>
      <p style={{ margin: '6px 0 20px', fontSize: 13, color: T.text2 }}>
        Dashes sem nenhum acesso do cliente há mais de {INACTIVE_DASH_DAYS} dias.
      </p>

      {loading && <LoadingState rows={4} />}
      {!loading && error && <div style={{ ...cardStyle, padding: 16, color: T.crit, fontSize: 13 }}>{error}</div>}

      {!loading && !error && (
        <>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T.text1 }}>Dashes inativos</h2>
              <span style={{ fontSize: 11, color: T.text3 }}>({dashes.length})</span>
            </div>

            {dashes.length === 0 ? (
              <div style={{ padding: '8px 0' }}>
                <EmptyState message={`Nenhum dash inativo — todos tiveram acesso nos últimos ${INACTIVE_DASH_DAYS} dias.`} />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {['Dash (projeto)', 'Cliente', 'Último acesso', 'Inativo há'].map(col => (
                      <th key={col} style={{
                        padding: '9px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 600,
                        color: T.text3, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashes.map((d, i) => (
                    <tr
                      key={d.projectId}
                      onClick={() => onNav('dashview-detail', d.projectId)}
                      style={{ borderBottom: i === dashes.length - 1 ? 'none' : `1px solid ${T.border}`, cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = `${T.text3}0A` }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '11px 16px', fontSize: 12.5, fontWeight: 600, color: T.text1 }}>{d.projectName}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: T.text2 }}>{d.clientName ?? '—'}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: T.text3 }}>
                        {d.lastAccessAt ? fmtDate(d.lastAccessAt) : 'nunca acessado'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: T.crit, fontWeight: 600 }}>{d.inactiveDays} dias</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{
            display: 'flex', gap: 10, marginTop: 14, padding: '11px 14px', borderRadius: 10,
            background: T.warnDim, border: `1px solid ${T.warn}38`, fontSize: 12, color: T.text2,
          }}>
            <span>⚠️</span>
            <div>Todo dash com mais de {INACTIVE_DASH_DAYS} dias sem acesso do usuário cadastrado é considerado inativo.</div>
          </div>
        </>
      )}
    </div>
  )
}
