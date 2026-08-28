/**
 * Altech — Body cards of the original role panels, exposed as Home widgets.
 * The markup mirrors the panels of src/pages/DashboardHomePage.tsx so each role
 * keeps the exact card it had (SCard/WorkQueue/RagCard with their own frame).
 */
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import {
  SCard, RagCard, ProgressCard, ProgressBar, WorkQueue, SprintDonutCard,
  StatusBadge, ConditionalTag, Av, EmptyState, ActivityTimeline,
} from '@/components/ds/DashboardKit'
import {
  liveItems, liveAggregates, liveCurrentSprintName,
  getBlockedItems, getSprintItems, getTestingItems,
} from '@/data/db/homeLive'
import { fetchRecentAdminActivity, relativeTime, type AdminActivityRow } from '@/data/db/adminActivity'
import { logger } from '@/utils/logger'
import type { WidgetCtx } from '@/components/home/nativeWidgets'

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

export function DeliveryRhythmCard({ onNav }: WidgetCtx) {
  const agg = liveAggregates()
  return (
    <ProgressCard pct={agg?.consolidatedPct ?? 0} label="Ritmo de Entrega — Portfólio"
      velocity={`Velocity média: ${agg?.velocityAvg ?? 0}pt/sprint`} onClick={() => onNav('reports')} />
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

export function PlannedVsDoneCard({ onNav }: WidgetCtx) {
  const agg = liveAggregates()
  return (
    <ProgressCard pct={agg?.consolidatedPct ?? 0} label="Planejado × Concluído"
      velocity={`${agg?.donePoints ?? 0}pt concluídos de ${agg?.plannedPoints ?? 0}pt`}
      onClick={() => onNav('reports')} />
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
  return (
    <SCard title="Time Atuando no Projeto">
      {team.length === 0 ? <EmptyState message="Nenhuma demanda atribuída ainda." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {team.map(m => {
            const tag = workloadSeverity(m.active)
            return (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Av initials={m.initials} color={m.color} size={22} />
                <span style={{ flex: 1, fontSize: 12, color: T.text1 }}>{m.name}</span>
                <span style={{ fontSize: 10, color: T.text3 }}>{m.active}</span>
                <ConditionalTag label={tag.label} severity={tag.severity} />
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
const CERIMONIAS = [
  { name: 'Daily Standup',   data: 'Hoje 09h',   status: 'pendente' },
  { name: 'Sprint Review',   data: 'Sex 16h',    status: 'pendente' },
  { name: 'Retrospectiva',   data: 'Amanhã 14h', status: 'pendente' },
  { name: 'Sprint Planning', data: '28 jul 10h', status: 'planejado' },
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

export function CeremoniesCard() {
  return (
    <SCard title="Cerimônias & Ações de Facilitação">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {CERIMONIAS.map(c => (
          <div key={c.name} style={{ background: T.bgPage, borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text1 }}>{c.name}</div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>{c.data}</div>
            <div style={{ marginTop: 8 }}>
              <ConditionalTag label={c.status === 'pendente' ? 'Pendente' : 'Planejado'} severity={c.status === 'pendente' ? 'info' : 'neutral'} />
            </div>
          </div>
        ))}
      </div>
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
  return (
    <WorkQueue title="Meus Bloqueados" items={blocked} onOpen={onOpenItem} showDaysBlocked
      onViewAll={() => onNav('list')} emptyMsg="Nenhum item bloqueado." />
  )
}

export function RecentActivityCard({ userName }: WidgetCtx) {
  const [activity, setActivity] = useState<AdminActivityRow[]>([])
  useEffect(() => {
    let alive = true
    fetchRecentAdminActivity(6, { actorName: userName })
      .then(a => { if (alive) setActivity(a) })
      .catch(err => { logger.error('dev.activity', err); if (alive) setActivity([]) })
    return () => { alive = false }
  }, [userName])
  return (
    <SCard title="Atividade Recente">
      {activity.length === 0
        ? <EmptyState message="Sem atividade recente." />
        : <ActivityTimeline events={activity.map(a => ({ label: `${a.action} · ${a.entityType}`, date: relativeTime(a.createdAt), color: T.accent }))} />}
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

export function TestExecutionCard({ onNav, onOpenItem }: WidgetCtx) {
  const testing = scopedItems(getTestingItems())
  return (
    <SCard title="Fila de Execução de Testes">
      {testing.length === 0
        ? <EmptyState message="Nenhum item aguardando teste." action={{ label: 'Ver board', onClick: () => onNav('project') }} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {testing.map(item => (
              <div key={item.id} className="no-drag" onClick={() => onOpenItem(item)}
                style={{ background: T.bgPage, borderRadius: 7, padding: '9px 12px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.text3, width: 52 }}>{item.key}</span>
                  <span style={{ flex: 1, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</span>
                  <StatusBadge status={item.status} />
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                  <button onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: T.success, background: `${T.success}14`, border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Aprovar</button>
                  <button onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: T.crit, background: `${T.crit}14`, border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Reprovar</button>
                  <button onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: T.text3, background: `${T.text3}14`, border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Solicitar evidência</button>
                </div>
              </div>
            ))}
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
