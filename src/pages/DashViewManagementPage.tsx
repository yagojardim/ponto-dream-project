import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { KpiCard, EmptyState, LoadingState } from '@/components/ds/DashboardKit'
import {
  fetchDashViewOverview, EMPTY_DASHVIEW_OVERVIEW,
  type DashViewOverview, type DashViewRow,
} from '@/data/db/clientPortal'

interface Props { onNav?: (view: string, targetId?: string) => void }

const cardStyle: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden',
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`
}

function DashStatusPill({ status }: { status: DashViewRow['status'] }) {
  const active = status === 'active'
  const color = active ? T.success : T.warn
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {active ? 'Ativo' : 'Aguardando 1º acesso'}
    </span>
  )
}

export default function DashViewManagementPage({ onNav }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<DashViewOverview>(EMPTY_DASHVIEW_OVERVIEW)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const data = await fetchDashViewOverview()
        if (alive) setOverview(data)
      } catch {
        if (alive) setError('Não foi possível carregar a gestão do Dash View.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const staleDash = overview.dashes
    .filter(d => d.invitesStale > 0)
    .sort((a, b) => b.invitesStale - a.invitesStale)[0]

  return (
    <div style={{ padding: 24, background: T.bgPage, minHeight: '100%' }}>
      <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text1 }}>Gestão do Dash View</h1>
      <p style={{ margin: '6px 0 20px', fontSize: 13, color: T.text2 }}>
        Acompanhe os dashes compartilhados com clientes e os acessos concedidos — somente leitura.
      </p>

      {loading && <LoadingState rows={4} />}
      {!loading && error && <div style={{ ...cardStyle, padding: 16, color: T.crit, fontSize: 13 }}>{error}</div>}

      {!loading && !error && (
        <>
          {/* ── KPIs ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <KpiCard
              label="Dashes ativos"
              value={String(overview.dashesTotal)}
              sub={`de ${overview.projectsTotal} projeto(s) no tenant`}
              color={T.accent}
            />
            <KpiCard
              label="Usuários com acesso"
              value={String(overview.usersTotal)}
              sub={`${overview.usersActive} ativos · ${overview.usersInvited} convidados · ${overview.usersBlocked} bloqueados`}
              color={T.success}
            />
            <KpiCard
              label="Convites pendentes"
              value={String(overview.invitesPending)}
              sub="aguardando 1º acesso do cliente"
              color={T.warn}
            />
            <KpiCard
              label="Dashes inativos"
              value={String(overview.dashesInactive)}
              sub="sem acesso do cliente há 30+ dias"
              color={T.crit}
              alert={overview.dashesInactive > 0}
              onClick={() => onNav?.('dashview-inactive')}
            />
          </div>

          {/* ── Tabela de dashes ─────────────────────────────────── */}
          <div style={cardStyle}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px',
              borderBottom: `1px solid ${T.border}`,
            }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T.text1 }}>Dashes compartilhados</h2>
              <span style={{ fontSize: 11, color: T.text3 }}>({overview.dashesTotal})</span>
              <button onClick={() => onNav?.('dashview-new')} style={{
                marginLeft: 'auto', fontSize: 12, padding: '6px 12px', borderRadius: 7,
                background: T.accent, border: 'none', color: '#fff', cursor: 'pointer',
              }}>+ Novo Dash View</button>
            </div>

            {overview.dashes.length === 0 ? (
              <div style={{ padding: '8px 0' }}>
                <EmptyState message="Nenhum dash compartilhado com clientes ainda." />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {['Dash (projeto)', 'Cliente', 'Usuários', 'Criado em', 'Convites', 'Status'].map(col => (
                      <th key={col} style={{
                        padding: '9px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 600,
                        color: T.text3, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.dashes.map((d, i) => (
                    <tr
                      key={d.projectId}
                      onClick={() => onNav?.('dashview-detail', d.projectId)}
                      style={{ borderBottom: i === overview.dashes.length - 1 ? 'none' : `1px solid ${T.border}`, cursor: onNav ? 'pointer' : 'default' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = `${T.text3}0A` }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '11px 16px', fontSize: 12.5, fontWeight: 600, color: T.text1 }}>{d.projectName}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: T.text2 }}>{d.clientName ?? '—'}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: T.text2 }}>
                        {d.portalAdmins} admin · {d.viewers} viewer
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: T.text3 }}>{fmtDate(d.createdAt)}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5 }}>
                        {d.invitesPending > 0
                          ? (
                            <span style={{ color: d.invitesStale > 0 ? T.crit : T.warn }}>
                              ● {d.invitesPending} convite{d.invitesPending > 1 ? 's' : ''}
                              {d.invitesStale > 0 ? ` (${d.invitesStale} parado${d.invitesStale > 1 ? 's' : ''})` : ''}
                            </span>
                          )
                          : <span style={{ color: T.text3 }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 16px' }}><DashStatusPill status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {staleDash && (
            <div style={{
              display: 'flex', gap: 10, marginTop: 14, padding: '11px 14px', borderRadius: 10,
              background: T.warnDim, border: `1px solid ${T.warn}38`, fontSize: 12.5, color: T.text1,
            }}>
              <span>💡</span>
              <div>
                O dash <strong>{staleDash.projectName}</strong> tem {staleDash.invitesStale} convite
                {staleDash.invitesStale > 1 ? 's' : ''} parado{staleDash.invitesStale > 1 ? 's' : ''} há mais de 14 dias.
                Um follow-up rápido com o cliente costuma resolver.
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: T.text3, marginTop: 14 }}>
            Clique em um dash para ver e gerenciar os usuários, ou use{' '}
            <a onClick={() => onNav?.('dashview-new')} style={{ color: T.accent, cursor: 'pointer' }}>Novo Dash View</a>
            {' '}para compartilhar outro projeto.
          </p>
        </>
      )}
    </div>
  )
}
