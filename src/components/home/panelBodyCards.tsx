/**
 * Altech — Body cards of the original role panels, exposed as Home widgets.
 * The markup mirrors the panels of src/pages/DashboardHomePage.tsx so each role
 * keeps the exact card it had (SCard/WorkQueue/RagCard with their own frame).
 */
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import {
  SCard, RagCard, ProgressCard, ProgressBar, WorkQueue, SprintDonutCard,
  StatusBadge, ConditionalTag, Av, EmptyState, ActivityTimeline, LoadingState,
  type WorkItem,
} from '@/components/ds/DashboardKit'
import {
  liveItems, liveAggregates, liveCurrentSprintName, liveProjects,
  getBlockedItems, getSprintItems, getTestingItems, useLiveDashboard,
} from '@/data/db/homeLive'
import { updateWorkItemField, addComment } from '@/data/db/workItem'
import { fetchRecentAdminActivity, relativeTime, type AdminActivityRow } from '@/data/db/adminActivity'
import {
  listCalendarEvents, EVENT_TYPE_LABEL, EVENT_TYPE_ICON,
  type DbCalendarEvent,
} from '@/data/db/calendarEvents'
import { humanizeActivity } from '@/data/activityLabels'
import { logger } from '@/utils/logger'
import { scopedItems, scopedProjects, type WidgetCtx } from '@/components/home/nativeWidgets'

// ─── PMO ──────────────────────────────────────────────────────────────────────

export function PmoRagCard({ onNav }: WidgetCtx) {
  const rags = scopedProjects(liveAggregates()?.rag ?? [])
  return (
    <SCard title="Saúde por Projeto (RAG)" help="Semáforo de saúde: 🟢 saudável · 🟡 em risco · 🔴 bloqueado.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rags.length === 0 && <EmptyState message="Nenhum projeto no escopo selecionado." />}
        {rags.map(r => (
          <RagCard key={r.id} name={r.name} squad={r.squad} rag={r.rag} pct={r.pct}
            daysLabel={r.daysLabel} reason={r.reason} onClick={() => onNav('project', r.id)} />
        ))}
      </div>
    </SCard>
  )
}

export function DeliveryRhythmCard({ openDetail }: WidgetCtx) {
  const agg = liveAggregates()
  const rag = scopedProjects(agg?.rag ?? [])
  const velAvg = agg?.velocityAvg ?? 0

  // Sem projeto no escopo (ou dados ainda não carregados): mantém o cartão de portfólio.
  if (rag.length === 0) {
    return (
      <ProgressCard pct={agg?.consolidatedPct ?? 0} label="Ritmo de Entrega — Portfólio"
        velocity={`Velocity média: ${velAvg}pt/sprint`} onClick={() => openDetail('velocity')} />
    )
  }

  const single = rag.length === 1
  const done = rag.reduce((s, r) => s + r.done, 0)
  const total = rag.reduce((s, r) => s + r.total, 0)
  const donePts = rag.reduce((s, r) => s + (r.donePoints ?? 0), 0)
  const plannedPts = rag.reduce((s, r) => s + (r.points ?? 0), 0)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const rows = [...rag].sort((a, b) => a.pct - b.pct)  // menor progresso primeiro (atenção no topo)

  return (
    <div className="no-drag" onClick={() => openDetail('velocity')}
      style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: T.text1, lineHeight: 1 }}>{pct}%</div>
        <div style={{ paddingBottom: 3, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: T.text2 }}>
            {single ? `Ritmo de Entrega — ${rows[0].name}` : `Ritmo de Entrega — ${rag.length} projetos`}
          </div>
          <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>
            {donePts}pt concluídos de {plannedPts}pt · velocity média {velAvg}pt/sprint
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}><ProgressBar pct={pct} color={T.accent} height={5} /></div>

      {!single && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span title={r.name} style={{ width: 92, flexShrink: 0, fontSize: 11, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              <div style={{ flex: 1, height: 8, background: T.bgSurface2, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${r.pct}%`, height: '100%', background: r.color || T.accent, opacity: 0.9 }} />
              </div>
              <span style={{ width: 34, textAlign: 'right', fontSize: 11, fontWeight: 700, color: T.text1 }}>{r.pct}%</span>
              <span style={{ width: 52, textAlign: 'right', fontSize: 10, color: T.text3 }}>{r.done}/{r.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Project Manager ──────────────────────────────────────────────────────────

export function PmMainRagCard({ onNav }: WidgetCtx) {
  const agg = liveAggregates()
  const mainRag = (scopedProjects(agg?.rag ?? []))[0]
  const sprintName = liveCurrentSprintName()
  if (!mainRag) return <EmptyState message="Nenhum projeto no escopo selecionado." />
  return (
    <RagCard name={mainRag.name} squad={`${mainRag.squad}${sprintName ? ` · ${sprintName}` : ''}`}
      rag={mainRag.rag} pct={mainRag.pct} daysLabel={mainRag.daysLabel} reason={mainRag.reason}
      onClick={() => onNav('project', mainRag.id)} />
  )
}

export function PlannedVsDoneCard({ openDetail }: WidgetCtx) {
  const agg = liveAggregates()
  return (
    <ProgressCard pct={agg?.consolidatedPct ?? 0} label="Planejado × Concluído"
      velocity={`${agg?.donePoints ?? 0}pt concluídos de ${agg?.plannedPoints ?? 0}pt`}
      onClick={() => openDetail('velocity')} />
  )
}

export function TeamWorkloadCard() {
  const team = (liveAggregates()?.workload ?? []).slice(0, 6).map(w => ({
    name: w.name, i: w.initials, c: w.color, ativas: w.active, cap: 5,
  }))
  return (
    <SCard title="Carga do Time">
      {team.length === 0 ? <EmptyState message="Nenhuma demanda atribuída ainda." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {team.map(m => (
            <div key={m.name} style={{ background: T.bgPage, borderRadius: 7, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Av initials={m.i} color={m.c} size={22} />
                <span style={{ fontSize: 11, color: T.text1 }}>{m.name}</span>
              </div>
              <ProgressBar pct={(m.ativas / m.cap) * 100} color={m.ativas > m.cap ? T.crit : T.accent} />
              <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>{m.ativas}/{m.cap} issues</div>
              {m.ativas > m.cap && <ConditionalTag label="Sobrecarga" severity="crit" />}
            </div>
          ))}
        </div>
      )}
    </SCard>
  )
}

// ─── Product Manager ──────────────────────────────────────────────────────────

const FUNNEL = [
  { stage: 'Visitantes',   value: 12400 },
  { stage: 'Cadastros',    value: 3100 },
  { stage: 'Ativação',     value: 1860 },
  { stage: 'Engajamento',  value: 930 },
  { stage: 'Retenção D30', value: 560 },
]
const FEATURES = [
  { name: 'Board Kanban',   adocao: 84 },
  { name: 'Relatórios',     adocao: 52 },
  { name: 'Portal Cliente', adocao: 31 },
  { name: 'Automações',     adocao: 12 },
]
const ROADMAP = [
  { epic: 'Portal do Cliente v2', quarter: 'Q3 2025', status: 'Em andamento', valor: 'Retenção' },
  { epic: 'Automações',           quarter: 'Q4 2025', status: 'Planejado',    valor: 'Eficiência' },
  { epic: 'Relatórios avançados', quarter: 'Q4 2025', status: 'Planejado',    valor: 'Expansão' },
]

export function ConversionFunnelCard() {
  return (
    <SCard title="Funil de Conversão / Ativação">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FUNNEL.map((f, i) => (
          <div key={f.stage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: T.text2 }}>{f.stage}</span>
              <span style={{ fontSize: 11, color: T.text1 }}>{f.value.toLocaleString('pt-BR')}</span>
            </div>
            <ProgressBar pct={i === 0 ? 100 : (f.value / FUNNEL[0].value) * 100} color={T.accent} />
          </div>
        ))}
      </div>
    </SCard>
  )
}

export function FeatureAdoptionCard() {
  return (
    <SCard title="Adoção de Features (base elegível)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FEATURES.map(f => (
          <div key={f.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: T.text1 }}>{f.name}</span>
              <span style={{ fontSize: 11, color: f.adocao >= 60 ? T.success : f.adocao >= 30 ? T.warn : T.crit }}>{f.adocao}%</span>
            </div>
            <ProgressBar pct={f.adocao} color={f.adocao >= 60 ? T.success : f.adocao >= 30 ? T.accent : T.crit} />
          </div>
        ))}
      </div>
    </SCard>
  )
}

export function RoadmapCard({ onNav }: WidgetCtx) {
  return (
    <SCard title="Roadmap Estratégico">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {ROADMAP.map(r => (
          <div key={r.epic} className="no-drag" onClick={() => onNav('epics')}
            style={{ background: T.bgPage, borderRadius: 8, padding: '12px 14px', cursor: 'pointer' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>{r.epic}</div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>{r.quarter}</div>
            <div style={{ marginTop: 8 }}>
              <ConditionalTag label={r.status} severity={r.status === 'Em andamento' ? 'info' : 'neutral'} />
            </div>
            <div style={{ fontSize: 10, color: T.success, marginTop: 8 }}>↑ {r.valor}</div>
          </div>
        ))}
      </div>
    </SCard>
  )
}

// ─── Product Owner ────────────────────────────────────────────────────────────

function workloadSeverity(active: number): { label: string; severity: 'neutral' | 'warn' | 'crit' } {
  if (active === 0) return { label: 'sem demanda', severity: 'neutral' }
  if (active <= 4) return { label: 'saudável', severity: 'neutral' }
  if (active === 5) return { label: 'atenção', severity: 'warn' }
  return { label: 'sobrecarga', severity: 'crit' }
}

export function PoTeamCard() {
  const team = liveAggregates()?.workload ?? []
  const projMap = new Map(liveProjects().map(p => [p.id, p]))
  // Projetos presentes na carga do time (submenu por projeto).
  const projIds = [...new Set(team.flatMap(m => m.byProject.map(b => b.projectId)))]
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const active = sel.size === 0 ? new Set(projIds) : sel
  const toggle = (id: string) => setSel(prev => {
    const base = prev.size === 0 ? new Set(projIds) : new Set(prev)
    if (base.has(id)) { if (base.size > 1) base.delete(id) } else base.add(id)
    return base
  })
  const rows = team
    .map(m => ({ m, bp: m.byProject.filter(b => active.has(b.projectId)) }))
    .filter(x => x.bp.length > 0)

  return (
    <SCard title="Time Atuando no Projeto">
      {team.length === 0 ? <EmptyState message="Nenhuma demanda atribuída ainda." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projIds.length > 1 && (
            <div className="no-drag" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {projIds.map(id => {
                const on = active.has(id); const p = projMap.get(id)
                return (
                  <button key={id} onClick={e => { e.stopPropagation(); toggle(id) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, cursor: 'pointer',
                      color: on ? T.text1 : T.text3, background: on ? T.bgSurface2 : 'transparent',
                      border: `1px solid ${on ? T.border2 : T.border}`, borderRadius: 999, padding: '2px 8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: on ? (p?.color ?? T.accent) : 'transparent', border: `1.5px solid ${p?.color ?? T.accent}` }} />
                    {p?.name ?? 'Projeto'}
                  </button>
                )
              })}
            </div>
          )}
          {rows.map(({ m, bp }) => {
            const activeCount = bp.reduce((a, b) => a + b.active, 0)
            const tag = workloadSeverity(activeCount)
            const maxPts = Math.max(1, ...bp.map(b => b.points ?? 0))
            const opened = open === m.profileId
            return (
              <div key={m.profileId}>
                <div className="no-drag" onClick={() => setOpen(opened ? null : m.profileId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <Av initials={m.initials} color={m.color} size={22} />
                  <span style={{ flex: 1, fontSize: 12, color: T.text1 }}>{m.name}</span>
                  <span style={{ display: 'flex', gap: 3 }}>
                    {bp.map(b => <span key={b.projectId} title={projMap.get(b.projectId)?.name} style={{ width: 8, height: 8, borderRadius: '50%', background: projMap.get(b.projectId)?.color ?? T.accent }} />)}
                  </span>
                  <span style={{ fontSize: 10, color: T.text3, minWidth: 14, textAlign: 'right' }}>{activeCount}</span>
                  <ConditionalTag label={tag.label} severity={tag.severity} />
                </div>
                {opened && (
                  <div style={{ padding: '6px 0 6px 30px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {bp.map(b => (
                      <div key={b.projectId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <span style={{ width: 96, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projMap.get(b.projectId)?.name ?? 'Projeto'}</span>
                        <div style={{ flex: 1, height: 8, background: T.bgSurface2, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (b.points / maxPts) * 100)}%`, height: '100%', background: projMap.get(b.projectId)?.color ?? T.accent, opacity: 0.85 }} />
                        </div>
                        <span style={{ width: 34, textAlign: 'right', fontWeight: 600, color: T.text2 }}>{b.points}pt</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </SCard>
  )
}

// ─── Scrum Master ─────────────────────────────────────────────────────────────

const AGING = [
  { col: 'Em Dev',     avg: 2.1 },
  { col: 'Em Revisão', avg: 4.3 },
  { col: 'Em Teste',   avg: 3.8 },
]

export function StuckAgingCard({ onOpenItem }: WidgetCtx) {
  const sprint = scopedItems(getSprintItems(liveCurrentSprintName() ?? undefined))
  const parados = sprint.filter(w => w.status === 'blocked' || (w.days_blocked ?? 0) >= 2)
  return (
    <SCard title="Itens Parados + Aging WIP" help="Há quantos dias cada demanda está parada na coluna atual.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        {parados.length === 0
          ? <EmptyState message="Nenhum item parado." />
          : parados.map(p => (
            <div key={p.id} className="no-drag" onClick={() => onOpenItem(p)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgPage, borderRadius: 6, padding: '7px 10px', cursor: 'pointer' }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.text3, width: 52 }}>{p.key}</span>
              <span style={{ flex: 1, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.title}</span>
              {p.days_blocked && <ConditionalTag label={`${p.days_blocked}d`} severity={p.days_blocked >= 3 ? 'crit' : 'warn'} />}
              <StatusBadge status={p.status} />
            </div>
          ))}
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Aging médio por coluna</div>
        {AGING.map(a => (
          <div key={a.col} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: T.text2, width: 80, flexShrink: 0 }}>{a.col}</span>
            <div style={{ flex: 1 }}><ProgressBar pct={(a.avg / 7) * 100} color={a.avg > 3 ? T.crit : T.warn} /></div>
            <span style={{ fontSize: 10, color: T.text3, width: 30, flexShrink: 0 }}>{a.avg}d</span>
          </div>
        ))}
      </div>
    </SCard>
  )
}

/** Formata o horário de uma cerimônia de forma relativa (Hoje/Amanhã/dia da semana). */
function ceremonyWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((dd.getTime() - day0.getTime()) / 86400000)
  const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diff === 0) return `Hoje · ${hh}`
  if (diff === 1) return `Amanhã · ${hh}`
  if (diff > 1 && diff < 7) return `${d.toLocaleDateString('pt-BR', { weekday: 'short' })} · ${hh}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${hh}`
}

export function CeremoniesCard({ projectIds, onNav }: WidgetCtx) {
  const [events, setEvents] = useState<DbCalendarEvent[] | null>(null)
  useEffect(() => {
    let alive = true
    const now = new Date()
    const to = new Date(now.getTime() + 21 * 86400000)  // próximas 3 semanas
    listCalendarEvents(undefined, now.toISOString(), to.toISOString())
      .then(list => { if (alive) setEvents(list) })
      .catch(err => { logger.error('sm.ceremonies', err); if (alive) setEvents([]) })
    return () => { alive = false }
  }, [])

  const projMap = new Map(liveProjects().map(p => [p.id, p]))
  // Segue o filtro da Início: N projetos → só os do escopo (+ eventos gerais sem projeto).
  const scoped = (events ?? []).filter(e =>
    projectIds.size === 0 || e.projectId === null || projectIds.has(e.projectId))
  const showTag = projectIds.size !== 1  // marca o projeto quando há 0 ou N no escopo

  const projTag = (e: DbCalendarEvent) => {
    if (!showTag) return null
    const p = e.projectId ? projMap.get(e.projectId) : null
    const name = p?.name ?? 'Geral'
    const color = p?.color ?? T.text3
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.text3 }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />{name}
      </span>
    )
  }

  const next = scoped[0]
  const rest = scoped.slice(1, 6)

  return (
    <SCard title="Cerimônias & Ações de Facilitação"
      help="Próximas cerimônias da agenda (calendar_events), seguindo o filtro de projetos da Início.">
      {events === null ? <LoadingState rows={3} />
        : scoped.length === 0 ? (
          <EmptyState message="Nenhuma cerimônia agendada para os próximos dias."
            action={{ label: 'Abrir calendário', onClick: () => onNav('calendar') }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Próxima cerimônia em destaque */}
            <div className="no-drag" onClick={() => onNav('calendar')}
              style={{ background: T.bgPage, border: `1px solid ${next.color}55`, borderLeft: `3px solid ${next.color}`,
                borderRadius: 8, padding: '11px 13px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{EVENT_TYPE_ICON[next.eventType]}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: next.color }}>
                  {EVENT_TYPE_LABEL[next.eventType]}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: T.text1 }}>{ceremonyWhen(next.startIso)}</span>
              </div>
              <div style={{ fontSize: 13, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{next.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                {projTag(next)}
                {next.location && <span style={{ fontSize: 10, color: T.text3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>📍 {next.location}</span>}
              </div>
            </div>

            {/* Próximas */}
            {rest.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {rest.map(e => (
                  <div key={e.id} className="no-drag" onClick={() => onNav('calendar')}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 4px', cursor: 'pointer', borderTop: `1px solid ${T.border}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: e.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.title}</span>
                    {projTag(e)}
                    <span style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>{ceremonyWhen(e.startIso)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </SCard>
  )
}

// ─── Dev ──────────────────────────────────────────────────────────────────────

export function MyActiveQueueCard({ onNav, onOpenItem, userName }: WidgetCtx) {
  const myItems = scopedItems(liveItems()).filter(w => w.assignee?.name === userName)
  const done = myItems.filter(w => w.status === 'done').length
  return (
    <SprintDonutCard sprintName="Minha Fila Ativa" done={done} total={myItems.length}
      items={myItems} onOpen={onOpenItem} onViewSprint={() => onNav('project')} />
  )
}

export function MyBlockedCard({ onNav, onOpenItem, userName }: WidgetCtx) {
  const blocked = scopedItems(getBlockedItems()).filter(w => w.assignee?.name === userName)
  const projMap = new Map(liveProjects().map(p => [p.id, p]))
  const multi = new Set(blocked.map(b => b.project_id)).size > 1  // tag de projeto só quando há N
  const shown = blocked.slice(0, 5)
  const reasonOf = (w: WorkItem) => (w.history && w.history.length ? w.history[w.history.length - 1].action : null)

  const viewAll = blocked.length > 0 ? (
    <button onClick={e => { e.stopPropagation(); onNav('list') }}
      style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver todos →</button>
  ) : undefined

  return (
    <SCard title={`Meus Bloqueados ${blocked.length > 0 ? `(${blocked.length})` : ''}`} action={viewAll}>
      {shown.length === 0
        ? <EmptyState message="Nenhum item bloqueado. 🟢" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map(w => {
              const days = w.days_blocked ?? 0
              const p = multi ? projMap.get(w.project_id) : null
              const reason = reasonOf(w)
              return (
                <div key={w.id} className="no-drag" onClick={() => onOpenItem(w)}
                  style={{ background: T.bgPage, borderRadius: 7, padding: '8px 10px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.text3, width: 52, flexShrink: 0 }}>{w.key}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{w.title}</span>
                    <ConditionalTag label={days > 0 ? `${days}d parado` : 'bloqueado'} severity={days >= 3 ? 'crit' : 'warn'} />
                  </div>
                  {(p || reason) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                      {p && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.text3 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: p.color, flexShrink: 0 }} />{p.name}
                        </span>
                      )}
                      {reason && <span style={{ fontSize: 10, color: T.text3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>⛔ {reason}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
    </SCard>
  )
}

export function RecentActivityCard({ userName }: WidgetCtx) {
  const [activity, setActivity] = useState<AdminActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<string | null>(null)  // filtro por tipo de entidade (null = tudo)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchRecentAdminActivity(20, { actorName: userName })
      .then(a => { if (alive) { setActivity(a); setLoading(false) } })
      .catch(err => { logger.error('dev.activity', err); if (alive) { setActivity([]); setLoading(false) } })
    return () => { alive = false }
  }, [userName])

  const views = activity.map(a => ({ row: a, v: humanizeActivity(a) }))
  const types = [...new Set(views.map(x => x.v.entityLabel))]
  const filtered = type ? views.filter(x => x.v.entityLabel === type) : views
  const events = filtered.slice(0, 8).map(x => ({
    label: x.v.label, sub: x.v.sub, date: relativeTime(x.row.createdAt), color: x.v.color,
  }))

  return (
    <SCard title="Atividade Recente" help="Suas ações recentes registradas no histórico da conta.">
      {loading ? <LoadingState rows={3} />
        : activity.length === 0 ? <EmptyState message="Sem atividade recente." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {types.length > 1 && (
              <div className="no-drag" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Tudo', ...types].map(t => {
                  const val = t === 'Tudo' ? null : t
                  const on = type === val
                  return (
                    <button key={t} onClick={() => setType(val)}
                      style={{ fontSize: 10.5, cursor: 'pointer', color: on ? T.text1 : T.text3,
                        background: on ? T.bgSurface2 : 'transparent', border: `1px solid ${on ? T.border2 : T.border}`,
                        borderRadius: 999, padding: '2px 9px' }}>{t}</button>
                  )
                })}
              </div>
            )}
            {events.length === 0 ? <EmptyState message="Nada neste filtro." /> : <ActivityTimeline events={events} />}
          </div>
        )}
    </SCard>
  )
}

// ─── UX / UI ──────────────────────────────────────────────────────────────────

const VALIDACOES = [
  { item: 'Board Kanban v2',  feedback: 'Aprovado pelo PO',              status: 'in-review' as const },
  { item: 'Modal de criação', feedback: 'Dev devolveu — acessibilidade', status: 'blocked'   as const },
  { item: 'Filtros avançados', feedback: 'Aguardando usuário teste',     status: 'testing'   as const },
]
const DS_ALERTS = [
  { component: 'Button', issue: 'Variante ghost ausente no tema escuro' },
  { component: 'Badge',  issue: 'Tamanho inconsistente com Figma' },
]

export function DesignValidationCard() {
  return (
    <SCard title="Design QA / Validação">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {VALIDACOES.map(v => (
          <div key={v.item} style={{ background: T.bgPage, borderRadius: 7, padding: '9px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.text1 }}>{v.item}</span>
              <StatusBadge status={v.status} />
            </div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>{v.feedback}</div>
          </div>
        ))}
      </div>
    </SCard>
  )
}

export function DesignSystemAlertsCard() {
  return (
    <SCard title="Design System — Inconsistências">
      {DS_ALERTS.length === 0
        ? <EmptyState message="Design System consistente. ✅" />
        : DS_ALERTS.map(a => (
          <div key={a.component} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ConditionalTag label={a.component} severity="info" />
            <span style={{ fontSize: 11, color: T.text2 }}>{a.issue}</span>
          </div>
        ))}
    </SCard>
  )
}

// ─── QA ───────────────────────────────────────────────────────────────────────

const COBERTURA = [
  { criterio: 'Critérios de aceite validados', pct: 68 },
  { criterio: 'Casos de teste documentados',   pct: 45 },
  { criterio: 'Regressão coberta',             pct: 82 },
]

export function TestExecutionCard({ openBoard, onOpenItem, userName }: WidgetCtx) {
  const { reload } = useLiveDashboard()          // subscribe + refetch após gravar
  const [busy, setBusy] = useState<string | null>(null)
  const [handled, setHandled] = useState<Set<string>>(new Set())   // aprovados/reprovados somem
  const [requested, setRequested] = useState<Set<string>>(new Set())
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const testing = scopedItems(getTestingItems()).filter(i => !handled.has(i.id))
  const hide = (id: string) => setHandled(prev => new Set(prev).add(id))

  // Aprovar → status done (sai da fila, avança no Board). Grava em work_items + histórico.
  async function approve(item: WorkItem) {
    setBusy(item.id)
    try {
      await updateWorkItemField(item.id, 'status', 'done', item.status, { actorName: userName })
      hide(item.id); reload()
    } catch (err) { logger.error('qa.approve', err) } finally { setBusy(null) }
  }

  // Reprovar → devolve ao Dev (in-progress) com comentário obrigatório.
  async function reject(item: WorkItem) {
    const text = note.trim()
    if (!text) return
    setBusy(item.id)
    try {
      await addComment(item.id, `Reprovado no teste: ${text}`, { actorName: userName })
      await updateWorkItemField(item.id, 'status', 'in-progress', item.status, { actorName: userName })
      hide(item.id); setRejectId(null); setNote(''); reload()
    } catch (err) { logger.error('qa.reject', err) } finally { setBusy(null) }
  }

  async function requestEvidence(item: WorkItem) {
    setBusy(item.id)
    try {
      await addComment(item.id, 'Evidência de teste solicitada pela QA.', { actorName: userName })
      setRequested(prev => new Set(prev).add(item.id))
    } catch (err) { logger.error('qa.evidence', err) } finally { setBusy(null) }
  }

  const btn = (color: string) => ({
    fontSize: 10, color, background: `${color}14`, border: 'none' as const,
    borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
  })

  return (
    <SCard title={`Fila de Execução de Testes ${testing.length > 0 ? `(${testing.length})` : ''}`}>
      {testing.length === 0
        ? <EmptyState message="Nenhum item aguardando teste." action={{ label: 'Ver board', onClick: () => openBoard() }} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {testing.map(item => {
              const isRejecting = rejectId === item.id
              const isBusy = busy === item.id
              return (
                <div key={item.id} className="no-drag"
                  style={{ background: T.bgPage, borderRadius: 7, padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => onOpenItem(item)}>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.text3, width: 52 }}>{item.key}</span>
                    <span style={{ flex: 1, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</span>
                    {requested.has(item.id) && <ConditionalTag label="evidência pedida" severity="info" />}
                    <StatusBadge status={item.status} />
                  </div>
                  {isRejecting ? (
                    <div style={{ marginTop: 7 }}>
                      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                        placeholder="Motivo da reprovação (obrigatório)…"
                        style={{ width: '100%', resize: 'vertical', fontSize: 11, color: T.text1, background: T.bgSurface,
                          border: `1px solid ${T.border2}`, borderRadius: 6, padding: '6px 8px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                        <button disabled={isBusy || !note.trim()} onClick={() => void reject(item)}
                          style={{ ...btn(T.crit), opacity: note.trim() ? 1 : 0.5 }}>Confirmar devolução</button>
                        <button onClick={() => { setRejectId(null); setNote('') }} style={btn(T.text3)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                      <button disabled={isBusy} onClick={() => void approve(item)} style={btn(T.success)}>Aprovar</button>
                      <button disabled={isBusy} onClick={() => setRejectId(item.id)} style={btn(T.crit)}>Reprovar</button>
                      <button disabled={isBusy} onClick={() => void requestEvidence(item)} style={btn(T.text3)}>Solicitar evidência</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
    </SCard>
  )
}

export function QaCoverageCard({ onNav, onOpenItem }: WidgetCtx) {
  const retest = scopedItems(liveItems()).filter(w => w.type === 'bug' && w.status === 'testing')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <WorkQueue title="Bugs para Reteste" items={retest} onOpen={onOpenItem}
        onViewAll={() => onNav('list')} emptyMsg="Nenhum bug aguardando reteste." />
      <SCard title="Cobertura / Critérios Validados">
        {COBERTURA.map(c => (
          <div key={c.criterio} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: T.text2 }}>{c.criterio}</span>
              <span style={{ fontSize: 10, color: c.pct >= 70 ? T.success : T.warn }}>{c.pct}%</span>
            </div>
            <ProgressBar pct={c.pct} color={c.pct >= 70 ? T.success : T.warn} />
          </div>
        ))}
      </SCard>
    </div>
  )
}

// ─── Blocked queue (shared body card) ─────────────────────────────────────────

export function CriticalBlockersCard({ onNav, onOpenItem }: WidgetCtx) {
  const blocked = scopedItems(getBlockedItems())
  return (
    <WorkQueue title="Bloqueadores Críticos" items={blocked} onOpen={onOpenItem}
      showDaysBlocked onViewAll={() => onNav('list')}
      emptyMsg="Nenhum bloqueador ativo. Boa sinal! 🟢" />
  )
}
