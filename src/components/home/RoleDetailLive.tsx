// Abas ao vivo dos modais do Admin Master ("Tenant") e do Product Manager ("Produto").
// Mesmo padrão do InicioDetailLive: busca no mount e mostra carregando / vazio /
// tabela com o dado real — nunca inventa número.
import { T } from '@/components/ds/tokens'
import { Msg, Table, Metric, useAsync, td, tdMuted } from '@/components/home/InicioDetailLive'
import {
  fetchAdminKpis, fetchAdminTenantLists, fetchMauMetrics,
  type AdminKpis, type AdminTenantLists, type MauMetrics,
} from '@/data/db/dashboards'
import { listModules, type ModuleView } from '@/data/db/modules'
import { useProductMetrics } from '@/data/db/engagement'

function Metrics({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '0 0 14px' }}>{children}</div>
}

const SITUATION_COLOR: Record<string, string> = { Ativo: T.success, Finalizado: T.accent, Arquivado: T.text3, Outro: T.text2 }

// ─── Admin Master · Tenant ───────────────────────────────────────────────────

export function AdminProjectsTabLive() {
  const { data, loading } = useAsync<AdminTenantLists>(() => fetchAdminTenantLists(), [])
  if (loading) return <Msg text="Carregando projetos…" />
  if (!data) return <Msg text="Não foi possível carregar os projetos agora." />
  const rows = data.projects
  const n = (s: string) => rows.filter(r => r.situation === s).length
  return (
    <>
      <Metrics>
        <Metric v={String(n('Ativo'))} k="Ativos" c={T.success} />
        <Metric v={String(n('Finalizado'))} k="Finalizados" />
        <Metric v={String(n('Arquivado'))} k="Arquivados" />
      </Metrics>
      {rows.length === 0
        ? <Msg text="Nenhum projeto cadastrado neste tenant." />
        : (
          <Table head={['Projeto', 'Situação']}>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.name}</td>
                <td style={{ ...td, color: SITUATION_COLOR[r.situation] }}>{r.situation}</td>
              </tr>
            ))}
          </Table>
        )}
    </>
  )
}

export function AdminBoardsTabLive() {
  const { data, loading } = useAsync<AdminTenantLists>(() => fetchAdminTenantLists(), [])
  if (loading) return <Msg text="Carregando boards…" />
  if (!data) return <Msg text="Não foi possível carregar os boards agora." />
  const boards = data.boards
  const projName = (id: string | null) => data.projects.find(p => p.id === id)?.name ?? '—'
  const active = boards.filter(b => !b.archived).length
  return (
    <>
      <Metrics>
        <Metric v={String(active)} k="Ativos" c={T.success} />
        <Metric v={String(boards.length - active)} k="Arquivados" />
      </Metrics>
      {boards.length === 0
        ? <Msg text="Nenhum board cadastrado neste tenant." />
        : (
          <Table head={['Board', 'Projeto', 'Situação']}>
            {boards.map(b => (
              <tr key={b.id}>
                <td style={td}>{b.name}</td>
                <td style={tdMuted}>{projName(b.projectId)}</td>
                <td style={{ ...td, color: b.archived ? T.text3 : T.success }}>{b.archived ? 'Arquivado' : 'Ativo'}</td>
              </tr>
            ))}
          </Table>
        )}
    </>
  )
}

const MODULE_LABEL: Record<string, string> = {
  operational: 'Ativo', implemented: 'Ativo', preview: 'Ativo', contracted: 'Contratado',
  deploying: 'Em implantação', pending: 'Pendente', 'not-contracted': 'Não contratado',
  planned: 'Planejado', 'coming-soon': 'Em breve', suspended: 'Suspenso', unavailable: 'Indisponível',
}

export function AdminModulesTabLive() {
  const mods = useAsync<ModuleView[]>(() => listModules(), [])
  const kpis = useAsync<AdminKpis>(() => fetchAdminKpis(), [])
  if (mods.loading || kpis.loading) return <Msg text="Carregando módulos…" />
  if (!mods.data && !kpis.data) return <Msg text="Não foi possível carregar os módulos agora." />
  const rows = mods.data ?? []
  const label = (s: string) => MODULE_LABEL[s] ?? s
  const color = (s: string) => (label(s) === 'Ativo' ? T.success : s === 'pending' ? T.warn : s === 'suspended' ? T.crit : T.text2)
  return (
    <>
      <Metrics>
        <Metric v={kpis.data ? String(kpis.data.modules.active) : '—'} k="Ativos" c={T.success} />
        <Metric v={kpis.data ? String(kpis.data.modules.total) : '—'} k="No catálogo" />
      </Metrics>
      {rows.length === 0
        ? <Msg text="Nenhum módulo no catálogo deste tenant." />
        : (
          <Table head={['Módulo', 'Situação']}>
            {rows.map(m => (
              <tr key={m.id}>
                <td style={td}>{m.name}</td>
                <td style={{ ...td, color: color(m.status) }}>{label(m.status)}</td>
              </tr>
            ))}
          </Table>
        )}
    </>
  )
}

function userStatus(s: string | null): { text: string; color: string } {
  const k = (s ?? '').toLowerCase()
  if (k === 'active') return { text: 'Ativo', color: T.success }
  if (k === 'blocked' || k === 'suspended') return { text: 'Bloqueado', color: T.crit }
  if (k === 'invited' || k === 'pending') return { text: 'Pendente', color: T.warn }
  return { text: s ?? '—', color: T.text2 }
}

export function AdminUsersTabLive() {
  const lists = useAsync<AdminTenantLists>(() => fetchAdminTenantLists(), [])
  const kpis = useAsync<AdminKpis>(() => fetchAdminKpis(), [])
  if (lists.loading || kpis.loading) return <Msg text="Carregando usuários…" />
  if (!lists.data && !kpis.data) return <Msg text="Não foi possível carregar os usuários agora." />
  const users = lists.data?.users ?? []
  const k = kpis.data
  return (
    <>
      <Metrics>
        <Metric v={k ? String(k.users.total) : '—'} k="Usuários" />
        <Metric v={k ? String(k.users.active) : '—'} k="Ativos" c={T.success} />
        <Metric v={k ? String(k.users.blocked) : '—'} k="Bloqueados" c={k && k.users.blocked > 0 ? T.crit : undefined} />
        <Metric v={k ? String(k.invites.pending) : '—'} k="Convites pendentes" c={k && k.invites.pending > 0 ? T.warn : undefined} />
      </Metrics>
      {users.length === 0
        ? <Msg text="Nenhum usuário cadastrado neste tenant." />
        : (
          <Table head={['Usuário', 'Papel', 'Situação']}>
            {users.map(u => {
              const s = userStatus(u.status)
              return (
                <tr key={u.id}>
                  <td style={td}>{u.name}</td>
                  <td style={tdMuted}>{u.role ?? '—'}</td>
                  <td style={{ ...td, color: s.color }}>{s.text}</td>
                </tr>
              )
            })}
          </Table>
        )}
    </>
  )
}

// ─── Product Manager · Produto ───────────────────────────────────────────────

export function ProductMauTabLive() {
  const { data, loading } = useAsync<MauMetrics>(() => fetchMauMetrics(), [])
  if (loading) return <Msg text="Carregando acessos…" />
  if (!data) return <Msg text="Não foi possível carregar os acessos agora." />
  const pct = data.total > 0 ? Math.round((data.mau / data.total) * 100) : 0
  return (
    <>
      <Metrics>
        <Metric v={String(data.mau)} k="MAU (30 dias)" c={T.success} />
        <Metric v={String(data.wau)} k="Ativos na semana" />
        <Metric v={`${pct}%`} k="Da base" />
        <Metric v={String(data.neverLogged)} k="Nunca entraram" c={data.neverLogged > 0 ? T.warn : undefined} />
      </Metrics>
      <Msg text="O cadastro guarda só o último login de cada pessoa, então dá para medir ativos nos últimos 30 e 7 dias, mas ainda não uma série mês a mês." />
    </>
  )
}

export function ProductEngagementTabLive({ kind }: { kind: 'stickiness' | 'churn' | 'adoption' }) {
  const m = useProductMetrics()
  if (!m) return <Msg text="Carregando métricas de uso…" />
  if (!m.hasData) return <Msg text="Sem dados de uso ainda. As métricas aparecem conforme o time usa a plataforma." />
  const e = m.engagement
  if (kind === 'stickiness') {
    return (
      <Metrics>
        <Metric v={`${e.stickinessPct}%`} k="Stickiness (DAU/MAU)" c={e.stickinessPct < 10 ? T.warn : T.success} />
        <Metric v={String(e.averageDau)} k="Média de ativos por dia" />
        <Metric v={String(e.mau)} k="Ativos no mês" />
      </Metrics>
    )
  }
  if (kind === 'churn') {
    return e.churnPct == null
      ? <Msg text="Ainda não há base do mês anterior para calcular o churn." />
      : (
        <Metrics>
          <Metric v={`${e.churnPct}%`} k="Churn" c={e.churnPct > 2 ? T.crit : T.success} />
          <Metric v={String(e.mau)} k="Ativos no mês" />
        </Metrics>
      )
  }
  const feats = m.adoption.features
  const avg = feats.length ? Math.round(feats.reduce((s, f) => s + f.pct, 0) / feats.length) : 0
  return (
    <>
      <Metrics>
        <Metric v={`${avg}%`} k="Adoção média" c={avg >= 60 ? T.success : avg >= 30 ? T.accent : T.warn} />
        <Metric v={String(feats.length)} k="Áreas" />
        <Metric v={String(m.adoption.base)} k="Base" />
      </Metrics>
      {feats.length === 0
        ? <Msg text="Nenhuma área com uso registrado nos últimos 30 dias." />
        : (
          <Table head={['Área', 'Usuários', 'Uso']}>
            {feats.map(f => (
              <tr key={f.key}>
                <td style={td}>{f.label}</td>
                <td style={tdMuted}>{f.users}</td>
                <td style={{ ...td, color: f.pct >= 60 ? T.success : f.pct >= 30 ? T.accent : T.warn }}>{f.pct}%</td>
              </tr>
            ))}
          </Table>
        )}
    </>
  )
}
