// Abas de detalhe que carregam do banco de dentro do modal (Fatia 5a).
// Cada componente busca no mount e mostra loading/vazio/tabela — sem inventar dado.
import { useEffect, useState, type ReactNode } from 'react'
import { T } from '@/components/ds/tokens'
import { liveProjects } from '@/data/db/homeLive'
import {
  fetchProjectDeadlines, fetchRejections, fetchEvidencePending,
  type DeadlineRow, type QaItemRow,
} from '@/data/db/inicioDetail'
import { fetchPoCardMetrics, type PoCardMetrics } from '@/data/db/dashboards'

function projName(id: string | null): string {
  if (!id) return '—'
  return liveProjects().find(p => p.id === id)?.name ?? '—'
}
function Msg({ text }: { text: string }) {
  return <div style={{ padding: '16px 4px', fontSize: 12.5, color: T.text3 }}>{text}</div>
}
function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead><tr>{head.map(h => (
          <th key={h} style={{ textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.text3, fontWeight: 600, padding: '2px 10px 8px', borderBottom: `1px solid ${T.border}` }}>{h}</th>
        ))}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
const td: React.CSSProperties = { padding: 10, borderBottom: `1px solid ${T.border}`, color: T.text1, verticalAlign: 'middle' }
const tdMuted: React.CSSProperties = { ...td, color: T.text2 }
const tdMono: React.CSSProperties = { ...td, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: T.text3 }

function useAsync<T2>(fn: () => Promise<T2>, deps: unknown[]): { data: T2 | null; loading: boolean } {
  const [data, setData] = useState<T2 | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fn().then(d => { if (alive) { setData(d); setLoading(false) } }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, loading }
}

/** Prazo por projeto (period_start/period_end): dias restantes e % decorrido. */
export function DeadlinesTabLive({ projectIds }: { projectIds: string[] }) {
  const { data, loading } = useAsync<DeadlineRow[]>(() => fetchProjectDeadlines(projectIds.length ? projectIds : undefined), [projectIds.join(',')])
  if (loading) return <Msg text="Carregando prazos…" />
  const rows = data ?? []
  const withDate = rows.filter(r => r.periodEnd)
  if (withDate.length === 0) return <Msg text="Nenhum projeto com prazo (data de fim) cadastrado no escopo." />
  return (
    <Table head={['Projeto', 'Início', 'Fim', 'Dias restantes', '% decorrido']}>
      {withDate.map(r => (
        <tr key={r.id}>
          <td style={td}>{r.name}</td>
          <td style={tdMuted}>{r.periodStart ? r.periodStart.slice(0, 10).split('-').reverse().join('/') : '—'}</td>
          <td style={tdMuted}>{r.periodEnd ? r.periodEnd.slice(0, 10).split('-').reverse().join('/') : '—'}</td>
          <td style={{ ...td, color: (r.daysLeft ?? 0) < 0 ? T.crit : (r.daysLeft ?? 99) <= 7 ? T.warn : T.text1 }}>{r.daysLeft != null ? `${r.daysLeft}d` : '—'}</td>
          <td style={tdMuted}>{r.pctElapsed != null ? `${r.pctElapsed}%` : '—'}</td>
        </tr>
      ))}
    </Table>
  )
}

/** Taxa de rejeição: itens devolvidos do QA para o dev (histórico de status). */
export function RejectionTabLive({ projectIds }: { projectIds: string[] }) {
  const { data, loading } = useAsync<QaItemRow[]>(() => fetchRejections(projectIds.length ? projectIds : undefined), [projectIds.join(',')])
  if (loading) return <Msg text="Carregando devoluções…" />
  const rows = data ?? []
  if (rows.length === 0) return <Msg text="Nenhuma devolução do QA registrada no escopo. 🟢" />
  return (
    <Table head={['Item', 'Demanda', 'Projeto', 'Devoluções']}>
      {rows.map(r => (
        <tr key={r.workItemId}>
          <td style={tdMono}>{r.key}</td>
          <td style={td}>{r.title}</td>
          <td style={tdMuted}>{projName(r.projectId)}</td>
          <td style={{ ...td, color: (r.count ?? 0) > 1 ? T.warn : T.text1 }}>{r.count ?? 1}×</td>
        </tr>
      ))}
    </Table>
  )
}

/** Evidências pendentes: bugs abertos sem anexo. */
export function EvidenceTabLive({ projectIds }: { projectIds: string[] }) {
  const { data, loading } = useAsync<QaItemRow[]>(() => fetchEvidencePending(projectIds.length ? projectIds : undefined), [projectIds.join(',')])
  if (loading) return <Msg text="Carregando bugs…" />
  const rows = data ?? []
  if (rows.length === 0) return <Msg text="Todos os bugs abertos têm evidência anexada. 🟢" />
  return (
    <Table head={['Item', 'Bug', 'Projeto', 'Evidência']}>
      {rows.map(r => (
        <tr key={r.workItemId}>
          <td style={tdMono}>{r.key}</td>
          <td style={td}>{r.title}</td>
          <td style={tdMuted}>{projName(r.projectId)}</td>
          <td style={{ ...td, color: T.warn }}>sem anexo</td>
        </tr>
      ))}
    </Table>
  )
}

/** Saúde das releases (fetchPoCardMetrics.releasesHealth, já existente). */
export function ReleasesTabLive({ projectIds }: { projectIds: string[] }) {
  const { data, loading } = useAsync<PoCardMetrics>(() => fetchPoCardMetrics(projectIds), [projectIds.join(',')])
  if (loading) return <Msg text="Carregando releases…" />
  const rh = data?.releasesHealth
  const per = rh?.perRelease ?? []
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '0 0 14px' }}>
        <Metric v={`${rh?.healthPct ?? 0}%`} k="Conclusão média" c={(rh?.healthPct ?? 0) >= 70 ? T.success : T.warn} />
        <Metric v={String(rh?.activeCount ?? 0)} k="Releases ativas" />
        <Metric v={rh?.overdue ? 'Sim' : 'Não'} k="Alguma atrasada" c={rh?.overdue ? T.crit : T.success} />
      </div>
      {per.length === 0
        ? <Msg text="Nenhuma release ativa no escopo." />
        : (
          <Table head={['Release', 'Conclusão']}>
            {per.map((r, i) => (
              <tr key={i}>
                <td style={td}>{r.label}</td>
                <td style={{ ...td, color: r.value >= 70 ? T.success : T.warn }}>{r.value}%</td>
              </tr>
            ))}
          </Table>
        )}
    </>
  )
}

function Metric({ v, k, c }: { v: string; k: string; c?: string }) {
  return (
    <div style={{ background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: c ?? T.text1 }}>{v}</div>
      <div style={{ fontSize: 10.5, color: T.text3, marginTop: 2 }}>{k}</div>
    </div>
  )
}
