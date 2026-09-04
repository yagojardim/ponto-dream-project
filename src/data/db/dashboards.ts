/**
 * Altech Report Registry — single source of truth for all chart components.
 * Every chart reads real aggregates from Supabase (src/data/db/reports.ts) through
 * the ReportsDataProvider context, or from an explicit `data` prop.
 * Used by ReportsPage, DashboardHomePage tiles and the chart modal.
 */
import type { ReactElement, ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { T } from '../components/ds/tokens'
import { fetchReportsData, type ReportsData, type SprintBurndown } from './db/reports'
import { setReportNav, type ReportNavIntent } from '@/lib/reportNav'
import { liveProjects } from '@/data/db/homeLive'
import { buildAssistantInsights, type AssistantInsight, type InsightSeverity, type InsightNav } from '@/data/managementInsights'

const px = (n: number) => `${n}px`

// ─── Reports data context ─────────────────────────────────────────────────────

interface ReportsCtxValue {
  data: ReportsData | null
  loading: boolean
  error: string | null
  reload: () => void
}

const ReportsDataCtx = createContext<ReportsCtxValue>({ data: null, loading: false, error: null, reload: () => {} })

export function ReportsDataProvider({ projectIds, children }: { projectIds?: string[]; children: ReactNode }) {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = (projectIds ?? []).slice().sort().join(',')

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchReportsData(key ? key.split(',') : undefined)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [key])

  useEffect(() => load(), [load])

  return (
    <ReportsDataCtx.Provider value={{ data, loading, error, reload: load }}>
      {children}
    </ReportsDataCtx.Provider>
  )
}

export function useReportsData(): ReportsCtxValue {
  return useContext(ReportsDataCtx)
}

export interface ChartProps {
  variant?: 'thumbnail' | 'full'
  data?: ReportsData
  /** Extra props tolerated by legacy call sites. */
  [key: string]: unknown
}

/** Resolves the dataset for a chart: explicit prop first, context otherwise. */
function useChartState(explicit?: ReportsData) {
  const ctx = useContext(ReportsDataCtx)
  if (explicit) return { data: explicit, loading: false, error: null as string | null }
  return { data: ctx.data, loading: ctx.loading, error: ctx.error }
}

/**
 * Modo "fill": quando o gráfico é renderizado dentro de um card redimensionável
 * (painel do Início), a altura fixa em px dá lugar a 100% do container.
 */
const ChartFillCtx = createContext(false)

export function ChartFillProvider({ children }: { children: ReactNode }) {
  return <ChartFillCtx.Provider value={true}>{children}</ChartFillCtx.Provider>
}

function ChartMessage({ kind, text, height }: { kind: 'loading' | 'error' | 'empty'; text: string; height: number | string }) {
  if (kind === 'loading') {
    return (
      <div style={{ height, minHeight: 40, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 10, borderRadius: 5, background: T.bgSurface2, opacity: 1 - i * 0.25 }} />
        ))}
      </div>
    )
  }
  return (
    <div style={{
      height, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', fontSize: 11, padding: '0 12px',
      color: kind === 'error' ? T.crit : T.text3,
      border: `1px dashed ${kind === 'error' ? `${T.crit}55` : T.border}`, borderRadius: 8,
    }}>
      {text}
    </div>
  )
}

/** Wraps a chart with loading / error / empty handling — never an infinite spinner. */
function ChartFrame({ data, loading, error, height, isEmpty, emptyText, children }: {
  data: ReportsData | null
  loading: boolean
  error: string | null
  height: number
  isEmpty: boolean
  emptyText: string
  children: () => ReactElement
}): ReactElement {
  const fill = useContext(ChartFillCtx)
  const h: number | string = fill ? '100%' : height
  let inner: ReactElement
  if (loading && !data) inner = <ChartMessage kind="loading" text="" height={h} />
  else if (error) inner = <ChartMessage kind="error" text={error} height={h} />
  else if (!data || isEmpty) inner = <ChartMessage kind="empty" text={emptyText} height={h} />
  else inner = children()
  if (!fill) return inner
  return (
    <div className="altech-chart-fill" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {inner}
    </div>
  )
}

// ─── Chart Components ─────────────────────────────────────────────────────────

export function BurndownChart({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const bd = data?.burndown
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 60 : 180}
      isEmpty={!bd || bd.days.length === 0 || bd.total === 0}
      emptyText="Nenhuma sprint ativa com pontos estimados.">
      {() => {
        const b = bd!
        // Thumbnail usa um viewBox menor para os rótulos dos eixos ficarem legíveis no card.
        const W = th ? 220 : 520; const H = th ? 96 : 180
        const PAD = th ? { top: 8, right: 8, bottom: 16, left: 20 } : { top: 12, right: 16, bottom: 30, left: 36 }
        const cw = W - PAD.left - PAD.right
        const ch = H - PAD.top - PAD.bottom
        const n = b.days.length
        const maxPts = Math.max(1, b.total)
        const toX = (d: number) => PAD.left + (d / Math.max(1, n - 1)) * cw
        const toY = (p: number) => PAD.top + ch - (p / maxPts) * ch
        const idealPath = `M ${toX(0)} ${toY(b.ideal[0])} L ${toX(n - 1)} ${toY(b.ideal[n - 1])}`
        const real = b.actual.map((v, i) => [i, v] as [number, number]).filter(([, v]) => !Number.isNaN(v))
        let stepPath = ''
        real.forEach(([i, v], idx) => {
          stepPath += idx === 0 ? `M ${toX(i)} ${toY(v)}` : ` H ${toX(i)} V ${toY(v)}`
        })
        const lastReal = real.length ? real[real.length - 1] : null
        const areaPath = stepPath && lastReal
          ? `${stepPath} L ${toX(lastReal[0])} ${toY(0)} L ${toX(real[0][0])} ${toY(0)} Z`
          : ''
        const tickStep = Math.max(1, Math.ceil(maxPts / 4))
        const ticks = Array.from({ length: 5 }, (_, i) => i * tickStep).filter(t => t <= maxPts * 1.01)
        // Eixo X: no thumbnail só início/meio/fim; no full, a cada ~1/7.
        const dayIdxs = th
          ? [...new Set([0, Math.floor((n - 1) / 2), n - 1])].filter(i => i >= 0)
          : b.days.map((_, i) => i).filter(i => i % Math.ceil(n / 7) === 0)
        return (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            {ticks.map(t => <line key={t} x1={PAD.left} y1={toY(t)} x2={W - PAD.right} y2={toY(t)} stroke={T.border} strokeWidth={0.5} />)}
            {ticks.map(t => <text key={'t' + t} x={PAD.left - (th ? 4 : 6)} y={toY(t) + (th ? 3 : 4)} textAnchor="end" fontSize={th ? 7 : 9} fill={T.text3}>{t}</text>)}
            {dayIdxs.map(i => <text key={'d' + i} x={toX(i)} y={H - PAD.bottom + (th ? 11 : 14)} textAnchor="middle" fontSize={th ? 7 : 9} fill={T.text3}>{b.days[i]}</text>)}
            {areaPath && <path d={areaPath} fill={T.text1} fillOpacity={0.07} />}
            <path d={idealPath} stroke={T.accent} strokeWidth={th ? 1.6 : 1.5} strokeDasharray="5,3" fill="none" />
            {stepPath && <path d={stepPath} stroke={T.text1} strokeWidth={th ? 2 : 2} fill="none" />}
            {th && lastReal && <circle cx={toX(lastReal[0])} cy={toY(lastReal[1])} r={2.6} fill={T.text1} />}
            {!th && (
              <g transform={`translate(${W - PAD.right - 130}, ${PAD.top})`}>
                <line x1={0} y1={5} x2={18} y2={5} stroke={T.accent} strokeWidth={1.5} strokeDasharray="5,3" />
                <text x={22} y={9} fontSize={9} fill={T.text2}>Ideal</text>
                <line x1={0} y1={18} x2={18} y2={18} stroke={T.text1} strokeWidth={2} />
                <text x={22} y={22} fontSize={9} fill={T.text2}>Realizado ({b.sprintName})</text>
              </g>
            )}
          </svg>
        )
      }}
    </ChartFrame>
  )
}

/** Velocity agrupada por projeto (últimas sprints, alinhadas por recência). */
function VelocityGrouped({ series }: { series: { name: string; color: string; values: number[] }[] }) {
  const K = series[0]?.values.length ?? 4
  const labels = Array.from({ length: K }, (_, i) => (i === K - 1 ? 'atual' : `-${K - 1 - i}`))
  const W = 380, H = 180, PAD = { top: 16, right: 12, bottom: 24, left: 32 }
  const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom
  const slot = cw / K
  const rawMax = Math.max(1, ...series.flatMap(s => s.values))
  const maxV = rawMax * 1.2
  const n = Math.max(1, series.length), grp = slot * 0.74, bw = grp / n
  const x = (i: number) => PAD.left + i * slot, y = (val: number) => PAD.top + ch - (val / maxV) * ch
  const ticks = [...new Set([0, Math.round(rawMax / 2), rawMax])]
  const axisY = PAD.top + ch
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={T.border} strokeWidth={0.5} />
              <text x={PAD.left - 5} y={y(t) + 3} textAnchor="end" fontSize={9} fill={T.text3}>{t}</text>
            </g>
          ))}
          <text x={11} y={PAD.top + ch / 2} fontSize={8.5} fill={T.text2} transform={`rotate(-90 11 ${PAD.top + ch / 2})`} textAnchor="middle">pontos entregues</text>
          {labels.map((_, i) => series.map((s, j) => {
            const val = s.values[i]
            const bx = x(i) + (slot - grp) / 2 + j * bw
            return (
              <g key={`${i}-${j}`}>
                <rect x={bx} y={y(val)} width={Math.max(1, bw - 1.5)} height={axisY - y(val)} rx={1.5} fill={s.color} opacity={0.85} />
                {val > 0 && <text x={bx + (bw - 1.5) / 2} y={y(val) - 3} textAnchor="middle" fontSize={7.5} fill={T.text2}>{val}</text>}
              </g>
            )
          }))}
          <line x1={PAD.left} x2={W - PAD.right} y1={axisY} y2={axisY} stroke={T.border2} strokeWidth={0.8} />
          {labels.map((l, i) => <text key={l + i} x={x(i) + slot / 2} y={axisY + 13} textAnchor="middle" fontSize={8.5} fill={T.text3}>{l}</text>)}
        </svg>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 10.5, color: T.text3 }}>
        {series.map(s => <span key={s.name}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: s.color, marginRight: 5, verticalAlign: 'middle' }} />{s.name}</span>)}
      </div>
    </div>
  )
}

export function VelocityChart({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const v = data?.velocity
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 60 : 140}
      isEmpty={!v || v.sprints.length === 0}
      emptyText="Nenhuma sprint concluída ainda.">
      {() => {
        const vel = v!
        const byP = vel.byProject ?? []
        // Com mais de um projeto no escopo: barras agrupadas por projeto.
        if (!th && byP.length > 1) {
          const info = new Map(liveProjects().map(p => [p.id, p]))
          const series = byP.map(b => ({ name: info.get(b.projectId)?.name ?? 'Projeto', color: info.get(b.projectId)?.color ?? T.accent, values: b.values }))
          return <VelocityGrouped series={series} />
        }
        const W = 200; const H = 140
        const PAD = { top: 12, right: 8, bottom: th ? 4 : 28, left: th ? 4 : 28 }
        const cw = W - PAD.left - PAD.right
        const ch = H - PAD.top - PAD.bottom
        const maxV = Math.max(1, vel.max)
        const bw = (cw / vel.sprints.length) * 0.6
        const toY = (val: number) => PAD.top + ch - (val / maxV) * ch
        const toX = (i: number) => PAD.left + (i / vel.sprints.length) * cw + (cw / vel.sprints.length) * 0.2
        const ticks = [0, Math.round(maxV / 3), Math.round((2 * maxV) / 3), Math.round(maxV)]
        return (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            <line x1={PAD.left} y1={toY(vel.avg)} x2={W - PAD.right} y2={toY(vel.avg)} stroke={T.text3} strokeWidth={1} strokeDasharray="4,3" />
            {!th && <text x={W - PAD.right + 2} y={toY(vel.avg) + 4} fontSize={8} fill={T.text3}>avg</text>}
            {vel.sprints.map((s, i) => (
              <g key={s.label + i}>
                <rect x={toX(i)} y={toY(s.value)} width={bw} height={ch - (toY(s.value) - PAD.top)} rx={2} fill={i === vel.sprints.length - 1 ? '#b3beff' : T.accent} />
                {!th && <text x={toX(i) + bw / 2} y={toY(s.value) - 3} textAnchor="middle" fontSize={8} fill={T.text2}>{s.value}</text>}
                {!th && <text x={toX(i) + bw / 2} y={H - PAD.bottom + 12} textAnchor="middle" fontSize={8} fill={T.text3}>{s.label}</text>}
              </g>
            ))}
            {!th && ticks.map((t, i) => <text key={i} x={PAD.left - 4} y={toY(t) + 3} textAnchor="end" fontSize={8} fill={T.text3}>{t}</text>)}
          </svg>
        )
      }}
    </ChartFrame>
  )
}

// ─── CFD helpers (área empilhada reutilizável + cards interpretativos) ────────
interface CfdLayer { label: string; color: string; data: number[] }

function StackedArea({ layers, dayLabels }: { layers: CfdLayer[]; dayLabels: string[] }) {
  const W = 520, H = 160, PAD = { top: 12, right: 8, bottom: 24, left: 34 }
  const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom
  const days = dayLabels.length
  const maxY = Math.max(1, ...dayLabels.map((_, d) => layers.reduce((a, l) => a + (l.data[d] ?? 0), 0))) * 1.1
  const toX = (d: number) => days <= 1 ? PAD.left + cw / 2 : PAD.left + (d / (days - 1)) * cw
  const toY = (v: number) => PAD.top + ch - (v / maxY) * ch
  const stacked = layers.map((_, li) => Array.from({ length: days }, (_, d) => { let sum = 0; for (let l = 0; l <= li; l++) sum += layers[l].data[d] ?? 0; return sum }))
  const areaPath = (top: number[], bottom: number[]) => {
    const fwd = top.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`)
    const bwd = bottom.slice().reverse().map((v, i) => `L ${toX(days - 1 - i)} ${toY(v)}`)
    return [...fwd, ...bwd, 'Z'].join(' ')
  }
  const ticks = [...new Set([0, Math.round(maxY / 2), Math.round(maxY)])]
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      {stacked.map((top, li) => {
        const bottom = li === 0 ? new Array<number>(days).fill(0) : stacked[li - 1]
        return <path key={li} d={areaPath(top, bottom)} fill={layers[li].color} opacity={0.45} />
      })}
      {ticks.map(t => <text key={t} x={PAD.left - 4} y={toY(t) + 4} textAnchor="end" fontSize={9} fill={T.text3}>{t}</text>)}
      <text x={10} y={PAD.top + ch / 2} fontSize={8.5} fill={T.text2} transform={`rotate(-90 10 ${PAD.top + ch / 2})`} textAnchor="middle">nº de itens</text>
      {dayLabels.map((d, i) => (i % 3 === 0 ? <text key={d + i} x={toX(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={9} fill={T.text3}>{d}</text> : null))}
    </svg>
  )
}

function CfdLegend({ layers }: { layers: CfdLayer[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 10.5, color: T.text3, marginTop: px(6) }}>
      {layers.map(l => <span key={l.label}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: l.color, marginRight: 5, verticalAlign: 'middle' }} />{l.label}</span>)}
    </div>
  )
}

function cfdStats(layers: CfdLayer[]) {
  const at = (i: number) => layers[i]?.data ?? []
  const last = (arr: number[]) => arr[arr.length - 1] ?? 0
  const first = (arr: number[]) => arr[0] ?? 0
  const backlog = last(at(0)), todo = last(at(1)), doing = last(at(2)), review = last(at(3)), done = last(at(4))
  return { backlog, todo, doing, review, done, deltaDone: done - first(at(4)), total: backlog + todo + doing + review + done, throughput: Math.round(((done - first(at(4))) / 2) * 10) / 10 }
}

function miniTiles(items: { l: string; v: string | number; c?: string; s?: string }[]) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: px(8) }}>
      {items.map(it => (
        <div key={it.l} style={{ background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 9, padding: `${px(8)} ${px(10)}` }}>
          <div style={{ fontSize: 10, color: T.text3 }}>{it.l}</div>
          <div style={{ fontSize: 17, fontWeight: 750, color: it.c ?? T.text1, lineHeight: 1.1, marginTop: 2 }}>{it.v}</div>
          {it.s && <div style={{ fontSize: 9.5, color: T.text3, marginTop: 2 }}>{it.s}</div>}
        </div>
      ))}
    </div>
  )
}

function CfdTiles({ layers, mode }: { layers: CfdLayer[]; mode: 'retro' | 'cliente' }) {
  const s = cfdStats(layers)
  if (mode === 'retro') {
    const revHot = s.review >= s.doing && s.review > 0
    return miniTiles([
      { l: 'Concluído', v: s.done, c: T.success, s: `+${s.deltaDone} na quinzena` },
      { l: 'Em andamento', v: s.doing, c: T.accent },
      { l: 'Em revisão', v: s.review, c: revHot ? T.warn : T.text1, s: revHot ? 'acumulando ⚠' : undefined },
      { l: 'A fazer/backlog', v: s.backlog + s.todo },
      { l: 'Throughput', v: `${s.throughput}/sem`, c: T.text1 },
    ])
  }
  const pct = Math.round((s.done / Math.max(1, s.total)) * 100)
  return miniTiles([
    { l: 'Entregue', v: s.done, c: T.success },
    { l: 'Em andamento', v: s.doing + s.review, c: T.accent },
    { l: 'A fazer', v: s.backlog + s.todo },
    { l: '% concluído', v: `${pct}%`, c: T.success },
  ])
}

/** Reduz as 5 camadas do CFD às 3 faixas da visão do cliente. */
function cfdTo3band(layers: CfdLayer[], days: number): CfdLayer[] {
  const sum2 = (a: number, b: number) => Array.from({ length: days }, (_, d) => (layers[a]?.data[d] ?? 0) + (layers[b]?.data[d] ?? 0))
  return [
    { label: 'A fazer', color: '#7d7d95', data: sum2(0, 1) },
    { label: 'Em andamento', color: T.accent, data: sum2(2, 3) },
    { label: 'Concluído', color: T.success, data: layers[4]?.data ?? [] },
  ]
}

export function CFDChart({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const cfd = data?.cfd
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 60 : 160}
      isEmpty={!cfd || cfd.days.length === 0 || cfd.layers.every(l => l.data.every(v => v === 0))}
      emptyText="Sem histórico de status no período.">
      {() => {
        const c = cfd!
        const W = 520; const H = 160
        const PAD = { top: th ? 4 : 12, right: 8, bottom: th ? 4 : 28, left: th ? 4 : 36 }
        const cw = W - PAD.left - PAD.right
        const ch = H - PAD.top - PAD.bottom
        const days = c.days.length
        const maxY = Math.max(1, c.max)
        const toX = (d: number) => PAD.left + (d / (days - 1)) * cw
        const toY = (v: number) => PAD.top + ch - (v / maxY) * ch
        const stacked = c.layers.map((_, li) =>
          Array.from({ length: days }, (_, d) => { let sum = 0; for (let l = 0; l <= li; l++) sum += c.layers[l].data[d]; return sum }))
        const areaPath = (top: number[], bottom: number[]) => {
          const fwd = top.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`)
          const bwd = bottom.slice().reverse().map((v, i) => `L ${toX(days - 1 - i)} ${toY(v)}`)
          return [...fwd, ...bwd, 'Z'].join(' ')
        }
        const ticks = [0, Math.round(maxY / 3), Math.round((2 * maxY) / 3), Math.round(maxY)]
        const chart = (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            {stacked.map((top, li) => {
              const bottom = li === 0 ? Array(days).fill(0) : stacked[li - 1]
              return <path key={li} d={areaPath(top, bottom)} fill={c.layers[li].color} opacity={0.35} />
            })}
            {stacked.map((top, li) => (
              <path key={li} d={top.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')} stroke={c.layers[li].color} strokeWidth={1.2} fill="none" />
            ))}
            {!th && c.days.map((d, i) => (i % 3 === 0
              ? <text key={d + i} x={toX(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={9} fill={T.text3}>{d}</text>
              : null))}
            {!th && ticks.map((t, i) => <text key={i} x={PAD.left - 4} y={toY(t) + 4} textAnchor="end" fontSize={9} fill={T.text3}>{t}</text>)}
            {!th && (
              <g transform={`translate(${PAD.left}, ${PAD.top - 2})`}>
                {c.layers.map((l, i) => (
                  <g key={i} transform={`translate(${i * 88}, 0)`}>
                    <rect x={0} y={-7} width={10} height={8} fill={l.color} opacity={0.6} rx={1} />
                    <text x={13} y={0} fontSize={8} fill={T.text2}>{l.label}</text>
                  </g>
                ))}
              </g>
            )}
          </svg>
        )
        if (th) return chart
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: px(10), height: '100%', minHeight: 0 }}>
            <div style={{ flex: '1 1 auto', minHeight: 0 }}>{chart}</div>
            <CfdTiles layers={c.layers} mode="retro" />
          </div>
        )
      }}
    </ChartFrame>
  )
}

export function BugsDonut({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const segs = data?.bugs ?? []
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 70 : 140}
      isEmpty={segs.length === 0}
      emptyText="Nenhum bug aberto. 🟢">
      {() => {
        const cx = 70; const cy = 70; const R = 50; const r = 28
        const total = segs.reduce((s, x) => s + x.val, 0)
        let angle = -Math.PI / 2
        const arcs = segs.map(seg => {
          const sweep = (seg.val / total) * 2 * Math.PI
          const x1 = cx + R * Math.cos(angle); const y1 = cy + R * Math.sin(angle)
          const x2 = cx + R * Math.cos(angle + sweep); const y2 = cy + R * Math.sin(angle + sweep)
          const x3 = cx + r * Math.cos(angle + sweep); const y3 = cy + r * Math.sin(angle + sweep)
          const x4 = cx + r * Math.cos(angle); const y4 = cy + r * Math.sin(angle)
          const large = sweep > Math.PI ? 1 : 0
          const d = segs.length === 1
            ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy} M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`
            : `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`
          angle += sweep
          return { ...seg, d }
        })
        const donut = (
          <svg width={th ? '100%' : 140} height={th ? undefined : 140} viewBox="0 0 140 140" style={th ? { display: 'block' } : undefined}>
            {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} fillRule="evenodd" />)}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight={700} fill={T.text1}>{total}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill={T.text3}>bugs</text>
          </svg>
        )
        if (th) return donut
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: px(16) }}>
            {donut}
            <div style={{ display: 'flex', flexDirection: 'column', gap: px(6) }}>
              {segs.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                  <span style={{ color: T.text2, fontSize: px(12) }}>{s.label}</span>
                  <span style={{ color: T.text1, fontSize: px(12), fontWeight: 600, marginLeft: 'auto' }}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        )
      }}
    </ChartFrame>
  )
}

function SmallMultiples({ series }: { series: { projectId: string; created: number[]; resolved: number[] }[] }) {
  const names = new Map(liveProjects().map(p => [p.id, p.name]))
  const maxV = Math.max(1, ...series.flatMap(p => [...p.created, ...p.resolved]))
  const W = 180; const H = 90
  const PAD = { top: 8, right: 6, bottom: 14, left: 18 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top - PAD.bottom
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
      {series.map(p => {
        const n = Math.max(2, p.created.length)
        const toX = (i: number) => PAD.left + (i / (n - 1)) * cw
        const toY = (v: number) => PAD.top + ch - (v / maxV) * ch
        const path = (d: number[]) => d.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')
        return (
          <div key={p.projectId} style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 10, color: T.text2, marginBottom: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{names.get(p.projectId) ?? p.projectId}</div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              {[0, maxV].map(t => (
                <g key={t}>
                  <line x1={PAD.left} y1={toY(t)} x2={W - PAD.right} y2={toY(t)} stroke={T.border} strokeWidth={0.5} />
                  <text x={PAD.left - 4} y={toY(t) + 3} textAnchor="end" fontSize={7} fill={T.text3}>{Math.round(t)}</text>
                </g>
              ))}
              <path d={path(p.created)} stroke={T.accent} strokeWidth={1.5} fill="none" />
              <path d={path(p.resolved)} stroke={T.success} strokeWidth={1.5} strokeDasharray="3 3" fill="none" />
            </svg>
          </div>
        )
      })}
    </div>
  )
}

export function CreatedVsResolved({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const cvr = data?.createdVsResolved
  const multi = false
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 60 : 160}
      isEmpty={!cvr || (cvr.created.every(v => v === 0) && cvr.resolved.every(v => v === 0))}
      emptyText="Nenhuma demanda criada ou resolvida desde o início do projeto.">
      {() => {
        if (multi) return <SmallMultiples series={cvr!.byProject} />
        const c = cvr!
        const W = 520; const H = th ? 60 : 160
        const PAD = { top: th ? 4 : 24, right: 8, bottom: th ? 4 : 28, left: th ? 4 : 36 }
        const cw = W - PAD.left - PAD.right
        const ch = H - PAD.top - PAD.bottom
        const weeks = Math.max(1, c.weeks.length)
        const labelStep = Math.ceil(weeks / 8)
        const maxV = Math.max(1, c.max)
        const toX = (i: number) => weeks === 1 ? PAD.left + cw / 2 : PAD.left + (i / (weeks - 1)) * cw
        const toY = (v: number) => PAD.top + ch - (v / maxV) * ch
        const linePath = (d: number[]) => d.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')
        const areaPath = (d: number[]) => linePath(d) + ` L ${toX(weeks - 1)} ${PAD.top + ch} L ${toX(0)} ${PAD.top + ch} Z`
        const ticks = [0, Math.round(maxV / 3), Math.round((2 * maxV) / 3), Math.round(maxV)].filter((v, i, a) => a.indexOf(v) === i)
        const sumC = c.created.length ? c.created[c.created.length - 1] : 0
        const sumR = c.resolved.length ? c.resolved[c.resolved.length - 1] : 0
        return (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            {ticks.map(t => (
              <g key={t}>
                <line x1={PAD.left} y1={toY(t)} x2={W - PAD.right} y2={toY(t)} stroke={T.border} strokeWidth={0.5} />
                {!th && <text x={PAD.left - 4} y={toY(t) + 4} textAnchor="end" fontSize={9} fill={T.text3}>{t}</text>}
              </g>
            ))}
            <line x1={PAD.left} y1={PAD.top + ch} x2={W - PAD.right} y2={PAD.top + ch} stroke={T.border} strokeWidth={1} />
            <path d={areaPath(c.created)} fill={T.warn} opacity={0.15} />
            <path d={areaPath(c.resolved)} fill={T.success} opacity={0.15} />
            <path d={linePath(c.created)} stroke={T.warn} strokeWidth={2} fill="none" />
            <path d={linePath(c.resolved)} stroke={T.success} strokeWidth={2} strokeDasharray="5,3" fill="none" />
            {c.created.map((v, i) => (
              <circle key={`c${i}`} cx={toX(i)} cy={toY(v)} r={3} fill={T.warn}>
                <title>{`${c.bucketTitles[i] ?? c.weeks[i]}\nCriados ${v} · Resolvidos ${c.resolved[i] ?? 0}`}</title>
              </circle>
            ))}
            {c.resolved.map((v, i) => (
              <circle key={`r${i}`} cx={toX(i)} cy={toY(v)} r={3} fill={T.success}>
                <title>{`${c.bucketTitles[i] ?? c.weeks[i]}\nCriados ${c.created[i] ?? 0} · Resolvidos ${v}`}</title>
              </circle>
            ))}
            {!th && c.weeks.map((w, i) => (
              (i % labelStep === 0 || i === weeks - 1) ? (
                <text key={`${w}-${i}`} x={toX(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={9} fill={T.text3}>{w}</text>
              ) : null
            ))}
            {!th && (
              <g transform={`translate(${PAD.left}, ${PAD.top - 16})`}>
                <line x1={0} y1={4} x2={14} y2={4} stroke={T.warn} strokeWidth={2} />
                <text x={18} y={8} fontSize={9} fill={T.text2}>Criados {sumC}</text>
                <line x1={92} y1={4} x2={106} y2={4} stroke={T.success} strokeWidth={2} />
                <text x={110} y={8} fontSize={9} fill={T.text2}>Resolvidos {sumR}</text>
              </g>

            )}
          </svg>
        )
      }}
    </ChartFrame>
  )
}

export function WorkloadChart({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const people = data?.workload ?? []
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 70 : 130}
      isEmpty={people.length === 0}
      emptyText="Nenhuma demanda ativa atribuída.">
      {() => {
        const maxPts = Math.max(1, ...people.map(p => p.pts)) * 1.1
        const color = (pts: number) => pts < maxPts * 0.55 ? T.success : pts <= maxPts * 0.85 ? T.warn : T.crit
        if (th) {
          const W = 200; const H = 100
          const barH = 10; const gap = 6; const labelW = 18
          return (
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              {people.slice(0, 6).map((p, i) => {
                const y = i * (barH + gap) + 4
                const bw = (p.pts / maxPts) * (W - labelW - 8)
                return (
                  <g key={i}>
                    <rect x={labelW + 4} y={y} width={W - labelW - 8} height={barH} rx={2} fill={T.bgSurface2} />
                    <rect x={labelW + 4} y={y} width={bw} height={barH} rx={2} fill={color(p.pts)} opacity={0.8} />
                  </g>
                )
              })}
            </svg>
          )
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: px(8) }}>
            {people.map((p, i) => (
              <div key={i} title={p.fullName} style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
                <div style={{ width: px(24), color: T.text2, fontSize: px(12), fontWeight: 600 }}>{p.name}</div>
                <div style={{ flex: 1, background: T.bgSurface2, borderRadius: px(4), height: px(14), overflow: 'hidden' }}>
                  <div style={{ width: `${(p.pts / maxPts) * 100}%`, height: '100%', background: color(p.pts), borderRadius: px(4), opacity: 0.8 }} />
                </div>
                <div style={{ width: px(36), color: color(p.pts), fontSize: px(12), fontWeight: 600 }}>{p.pts}pt</div>
              </div>
            ))}
          </div>
        )
      }}
    </ChartFrame>
  )
}

/** Lista de aging (full): rola quando expande, "Ver mais", e SÓ o código abre a demanda. */
function AgingList({ issues, onOpenItem }: {
  issues: { id: string; itemId: string; days: number; tag: string | null; color: string }[]
  onOpenItem?: (itemId: string) => void
}) {
  const [all, setAll] = useState(false)
  const maxDays = Math.max(1, ...issues.map(i => i.days)) * 1.1
  const shown = all ? issues : issues.slice(0, 5)
  const extra = issues.length - 5
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: px(6) }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: px(8), maxHeight: all ? px(220) : undefined, overflowY: all ? 'auto' : 'visible' }}>
        {shown.map(iss => (
          <div key={iss.itemId} style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
            <span
              className="no-drag"
              onClick={onOpenItem ? e => { e.stopPropagation(); onOpenItem(iss.itemId) } : undefined}
              title={onOpenItem ? 'Abrir demanda' : undefined}
              style={{ width: px(58), color: onOpenItem ? T.accent : T.text2, fontSize: px(11), fontFamily: 'monospace', cursor: onOpenItem ? 'pointer' : 'default', textDecoration: onOpenItem ? 'underline' : 'none' }}
            >{iss.id}</span>
            <div style={{ flex: 1, background: T.bgSurface2, borderRadius: px(4), height: px(14), overflow: 'hidden' }}>
              <div style={{ width: `${(iss.days / maxDays) * 100}%`, height: '100%', background: iss.color, borderRadius: px(4), opacity: 0.7 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: px(4), minWidth: px(72) }}>
              <span style={{ color: T.text1, fontSize: px(11), fontWeight: 600 }}>{iss.days}d</span>
              {iss.tag && (
                <span style={{ fontSize: px(9), fontWeight: 700, padding: '2px 5px', borderRadius: px(4), background: iss.color === T.crit ? T.critDim : T.warnDim, color: iss.color }}>{iss.tag}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {extra > 0 && (
        <button
          className="no-drag"
          onClick={e => { e.stopPropagation(); setAll(v => !v) }}
          style={{ alignSelf: 'center', fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >{all ? 'Ver menos ▴' : `Ver mais (${extra}) ▾`}</button>
      )}
    </div>
  )
}

export function AgingChart({ variant = 'full', data: explicit, onOpenItem }: ChartProps & { onOpenItem?: (itemId: string) => void }) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const issues = data?.aging ?? []
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 70 : 120}
      isEmpty={issues.length === 0}
      emptyText="Nenhum item em andamento.">
      {() => {
        const maxDays = Math.max(1, ...issues.map(i => i.days)) * 1.1
        if (th) {
          const W = 200; const H = 90
          const barH = 10; const gap = 7
          return (
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              {issues.slice(0, 5).map((iss, i) => {
                const y = i * (barH + gap) + 4
                return (
                  <g key={i}>
                    <rect x={4} y={y} width={W - 8} height={barH} rx={2} fill={T.bgSurface2} />
                    <rect x={4} y={y} width={(iss.days / maxDays) * (W - 8)} height={barH} rx={2} fill={iss.color} opacity={0.75} />
                  </g>
                )
              })}
            </svg>
          )
        }
        return <AgingList issues={issues} onOpenItem={onOpenItem} />
      }}
    </ChartFrame>
  )
}

// ─── Distribuição do Lead — agrupado por projeto, multiseleção, faixas ────────
// Eixo X em 2 camadas: dias exatos + categorias Rápidas (≤6d) / Médias (7-14d) /
// Longas (15d+). Reusado no card do board e no modal. Cada projeto = uma cor.
const LEAD_ZONES: { label: string; from: number; to: number; color: string }[] = [
  { label: 'Rápidas', from: 0, to: 1, color: T.success },
  { label: 'Médias', from: 2, to: 3, color: T.warn },
  { label: 'Longas', from: 4, to: 4, color: T.crit },
]

export function LeadDistChart({ data, compact = false }: { data: ReportsData; compact?: boolean }) {
  const lc = data.leadCycle
  const labels = lc.buckets.map(b => b.label)
  const info = new Map(liveProjects().map(p => [p.id, p]))
  const projs = lc.byProject.length > 0
    ? lc.byProject.map(bp => ({
        id: bp.projectId,
        name: info.get(bp.projectId)?.name ?? 'Projeto',
        color: info.get(bp.projectId)?.color ?? T.accent,
        buckets: bp.buckets,
      }))
    : [{ id: '__all__', name: 'Todos', color: T.accent, buckets: lc.buckets.map(b => b.value) }]
  const idsKey = projs.map(p => p.id).join(',')
  const [sel, setSel] = useState<Set<string>>(() => new Set(projs.map(p => p.id)))
  // Reseta a seleção quando o conjunto de projetos muda (troca de escopo).
  useEffect(() => { setSel(new Set(idsKey ? idsKey.split(',') : [])) }, [idsKey])
  const shown = projs.filter(p => sel.has(p.id))
  const chartProjs = shown.length > 0 ? shown : projs

  const W = 380; const H = 210
  const PAD = { top: 16, right: 12, bottom: 52, left: 40 }
  const cw = W - PAD.left - PAD.right; const ch = H - PAD.top - PAD.bottom
  const slot = cw / labels.length
  const rawMax = Math.max(1, ...chartProjs.flatMap(p => p.buckets))
  const maxV = rawMax * 1.25
  const xSlot = (i: number) => PAD.left + i * slot
  const toY = (v: number) => PAD.top + ch - (v / maxV) * ch
  const n = Math.max(1, chartProjs.length)
  const group = slot * 0.74; const bw = group / n
  const ticks = [...new Set([0, Math.round(rawMax / 2), rawMax])]
  const axisY = PAD.top + ch
  const bandY = axisY + 18; const bandH = 14

  function toggle(id: string) {
    setSel(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) } else next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
      {projs.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {projs.map(p => {
            const on = sel.has(p.id)
            return (
              <button
                key={p.id}
                className="no-drag"
                onClick={e => { e.stopPropagation(); toggle(p.id) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer',
                  color: on ? T.text1 : T.text3, background: on ? T.bgSurface2 : 'transparent',
                  border: `1px solid ${on ? T.border2 : T.border}`, borderRadius: 999, padding: '3px 9px',
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 3, background: on ? p.color : 'transparent', border: `1.5px solid ${p.color}`, flexShrink: 0 }} />
                {p.name}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={toY(t)} y2={toY(t)} stroke={T.border} strokeWidth={0.5} />
              <text x={PAD.left - 6} y={toY(t) + 3} textAnchor="end" fontSize={9} fill={T.text3}>{t}</text>
            </g>
          ))}
          <text x={12} y={PAD.top + ch / 2} fontSize={8.5} fill={T.text2} transform={`rotate(-90 12 ${PAD.top + ch / 2})`} textAnchor="middle">demandas concluídas</text>
          {labels.map((_, i) => chartProjs.map((p, j) => {
            const v = p.buckets[i]
            const bx = xSlot(i) + (slot - group) / 2 + j * bw
            return (
              <g key={`${i}-${p.id}`}>
                <rect x={bx} y={toY(v)} width={Math.max(1, bw - 1.5)} height={axisY - toY(v)} rx={1.5} fill={p.color} opacity={0.85}>
                  <title>{`${p.name} · ${labels[i]}: ${v} demanda(s)`}</title>
                </rect>
                {!compact && v > 0 && <text x={bx + (bw - 1.5) / 2} y={toY(v) - 3} textAnchor="middle" fontSize={8} fill={T.text2}>{v}</text>}
              </g>
            )
          }))}
          <line x1={PAD.left} x2={W - PAD.right} y1={axisY} y2={axisY} stroke={T.border2} strokeWidth={0.8} />
          {labels.map((b, i) => <text key={'d' + i} x={xSlot(i) + slot / 2} y={axisY + 12} textAnchor="middle" fontSize={8.5} fill={T.text3}>{b}</text>)}
          {LEAD_ZONES.map(z => {
            const x0 = xSlot(z.from) + 2; const x1 = xSlot(z.to + 1) - 2
            return (
              <g key={z.label}>
                <rect x={x0} y={bandY} width={x1 - x0} height={bandH} rx={4} fill={z.color} fillOpacity={0.16} stroke={z.color} strokeOpacity={0.4} strokeWidth={0.8} />
                <text x={(x0 + x1) / 2} y={bandY + bandH - 3.5} textAnchor="middle" fontSize={9} fontWeight={600} fill={z.color}>{z.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export function LeadCycleChart({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const lc = data?.leadCycle
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 60 : 140}
      isEmpty={!lc || lc.buckets.every(b => b.value === 0) || (lc.leadAvg === 0 && lc.cycleAvg === 0)}
      emptyText="Sem dados suficientes para medir lead/cycle time.">
      {() => {
        const l = lc!
        const W = 200; const H = 90
        const PAD = { top: 12, right: 8, bottom: th ? 4 : 20, left: th ? 4 : 30 }
        const cw = W - PAD.left - PAD.right
        const ch = H - PAD.top - PAD.bottom
        const rawMax = Math.max(1, ...l.buckets.map(b => b.value))
        const maxV = rawMax * 1.2
        const bw = (cw / l.buckets.length) * 0.65
        const toX = (i: number) => PAD.left + (i / l.buckets.length) * cw + (cw / l.buckets.length) * 0.175
        const toY = (v: number) => PAD.top + ch - (v / maxV) * ch
        const ticks = [0, 0.5, 1].map(f => Math.round(rawMax * f))
          .filter((v, i, arr) => arr.indexOf(v) === i)
        const histogram = (
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
            {!th && ticks.map(v => (
              <g key={v}>
                <line x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)} stroke={T.border} strokeWidth={0.4} />
                <text x={PAD.left - 4} y={toY(v) + 2.5} textAnchor="end" fontSize={7} fill={T.text3}>{v}</text>
              </g>
            ))}
            {!th && <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + ch} stroke={T.border} strokeWidth={0.5} />}
            {l.buckets.map((b, i) => (
              <g key={i}>
                <rect x={toX(i)} y={toY(b.value)} width={bw} height={ch - (toY(b.value) - PAD.top)} rx={2} fill={T.accent} opacity={0.7} />
                {!th && b.value > 0 && (
                  <text x={toX(i) + bw / 2} y={toY(b.value) - 3} textAnchor="middle" fontSize={7} fontWeight={600} fill={T.text2}>{b.value}</text>
                )}
                {!th && <text x={toX(i) + bw / 2} y={H - PAD.bottom + 11} textAnchor="middle" fontSize={8} fill={T.text3}>{b.label}</text>}
              </g>
            ))}
          </svg>
        )
        if (th) return histogram
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: px(10), height: '100%', minHeight: 0 }}>
            <div style={{ display: 'flex', gap: px(8), flex: '0 0 auto' }}>
              {[
                { label: 'Lead médio', value: `${l.leadAvg}d`, color: T.accent },
                { label: 'Cycle médio', value: `${l.cycleAvg}d`, color: T.success },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: T.bgSurface2, borderRadius: px(8), padding: `${px(8)} ${px(12)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: T.text2, fontSize: px(11) }}>{s.label}</span>
                  <span style={{ color: s.color, fontSize: px(17), fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: '1 1 auto', minHeight: px(120) }}>
              <LeadDistChart data={data!} />
            </div>
          </div>
        )
      }}
    </ChartFrame>
  )
}

export function ProjectHealth({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const h = data?.health
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 80 : 150}
      isEmpty={!h || h.axes.length === 0 || data?.empty === true}
      emptyText="Sem dados suficientes para o score de saúde.">
      {() => {
        const axes = h!.axes
        const n = axes.length; const cx = 85; const cy = 75; const R = 55
        const score = h!.score
        const angleOf = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2
        const point = (i: number, frac: number): [number, number] => {
          const a = angleOf(i)
          return [cx + R * frac * Math.cos(a), cy + R * frac * Math.sin(a)]
        }
        const pentagon = (frac: number) =>
          Array.from({ length: n }, (_, i) => point(i, frac)).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z'
        const dotColor = (v: number) => v >= 80 ? T.success : v >= 60 ? T.warn : T.crit
        const info = new Map(liveProjects().map(p => [p.id, p]))
        const byP = h!.byProject ?? []
        const multi = !th && byP.length > 1
        const pathFor = (ax: { val: number }[]) => ax.map((a, i) => point(i, a.val / 100)).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z'
        const radar = (
          <svg width={th ? '100%' : 170} height={th ? undefined : 150} viewBox="0 0 170 150" style={th ? { display: 'block' } : undefined}>
            {[0.25, 0.5, 0.75, 1].map(f => <path key={f} d={pentagon(f)} stroke={T.border2} strokeWidth={0.8} fill="none" />)}
            {Array.from({ length: n }, (_, i) => { const [x, y] = point(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={T.border2} strokeWidth={0.8} /> })}
            {multi
              ? byP.map(bp => <path key={bp.projectId} d={pathFor(bp.axes)} fill="none" stroke={info.get(bp.projectId)?.color ?? T.accent} strokeWidth={1.4} />)
              : <path d={pathFor(axes)} fill={T.accentDim} stroke={T.accent} strokeWidth={1.5} />}
            {!th && axes.map((a, i) => { const [x, y] = point(i, 1.22); return <text key={i} x={x} y={y} textAnchor="middle" fontSize={8} fill={T.text2}>{a.label}</text> })}
            <circle cx={cx} cy={cy} r={20} fill={T.bgSurface2} />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={700} fill={T.text1}>{score}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize={7} fill={T.text3}>/100</text>
          </svg>
        )
        if (th) return radar
        return (
          <div style={{ display: 'flex', gap: px(16), alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {radar}
            <div style={{ display: 'flex', flexDirection: 'column', gap: px(6), paddingTop: px(12), minWidth: px(140) }}>
              {axes.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: px(6) }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(a.val), flexShrink: 0 }} />
                  <span style={{ color: T.text1, fontSize: px(11.5), fontWeight: 600 }}>{a.label}</span>
                  <b style={{ color: dotColor(a.val), fontSize: px(11.5), marginLeft: px(4) }}>{a.val}%</b>
                </div>
              ))}
              {multi && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: px(6), fontSize: px(10), color: T.text3 }}>
                  {byP.map(bp => (
                    <span key={bp.projectId}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: info.get(bp.projectId)?.color ?? T.accent, marginRight: 5, verticalAlign: 'middle' }} />
                      {info.get(bp.projectId)?.name ?? 'Projeto'} · {bp.score}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      }}
    </ChartFrame>
  )
}

export function EpicBurndown({ variant = 'full', data: explicit }: ChartProps) {
  const { data, loading, error } = useChartState(explicit)
  const th = variant === 'thumbnail'
  const eb = data?.epicBurndown
  return (
    <ChartFrame data={data} loading={loading} error={error} height={th ? 60 : 160}
      isEmpty={!eb || eb.epics.length === 0}
      emptyText="Nenhum épico com pontos estimados.">
      {() => {
        const e = eb!
        const W = 520; const H = 160
        const PAD = { top: th ? 6 : 24, right: 8, bottom: th ? 4 : 28, left: th ? 4 : 36 }
        const cw = W - PAD.left - PAD.right
        const ch = H - PAD.top - PAD.bottom
        const weeks = Math.max(1, e.weeks.length)
        const labelStep = Math.ceil(weeks / 8)
        const maxV = Math.max(1, e.max)
        const toX = (i: number) => weeks === 1 ? PAD.left + cw / 2 : PAD.left + (i / (weeks - 1)) * cw
        const toY = (v: number) => PAD.top + ch - (v / maxV) * ch
        const linePath = (d: number[]) => d.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')
        const ticks = [0, Math.round(maxV / 3), Math.round((2 * maxV) / 3), Math.round(maxV)]
        return (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            {ticks.map(t => <line key={t} x1={PAD.left} y1={toY(t)} x2={W - PAD.right} y2={toY(t)} stroke={T.border} strokeWidth={0.5} />)}
            {e.epics.map((ep, i) => <path key={i} d={linePath(ep.data)} stroke={ep.color} strokeWidth={th ? 2.5 : 2} fill="none" />)}
            {e.epics.map((ep, i) => ep.data.map((v, j) => (
              <circle key={`${i}-${j}`} cx={toX(j)} cy={toY(v)} r={th ? 2.5 : 3} fill={ep.color}>
                <title>{`${ep.label}\n${e.bucketTitles[j] ?? e.weeks[j]} · ${v} pts restantes`}</title>
              </circle>
            )))}
            {!th && e.weeks.map((w, i) => (
              (i % labelStep === 0 || i === weeks - 1) ? (
                <text key={`${w}-${i}`} x={toX(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={9} fill={T.text3}>{w}</text>
              ) : null
            ))}
            {!th && ticks.map((t, i) => <text key={i} x={PAD.left - 4} y={toY(t) + 4} textAnchor="end" fontSize={9} fill={T.text3}>{t}</text>)}
            {!th && (
              <g transform={`translate(${PAD.left}, ${PAD.top - 16})`}>
                {e.epics.map((ep, i) => (
                  <g key={i} transform={`translate(${i * 130}, 0)`}>
                    <line x1={0} y1={4} x2={12} y2={4} stroke={ep.color} strokeWidth={2} />
                    <text x={15} y={8} fontSize={9} fill={T.text2}>{ep.label.slice(0, 18)}</text>
                  </g>
                ))}
              </g>
            )}
          </svg>
        )
      }}
    </ChartFrame>
  )
}

// ─── Mini visualizations (KPI thumbnails) ─────────────────────────────────────
// The thumbnail kind is derived from the metric type, never chosen arbitrarily:
//   line  → time series / trend      bars → counts per category      donut → ratio

export type VizKind = 'line' | 'bars' | 'donut'

export interface VizSeries {
  kind: VizKind
  /** Values for line/bars. */
  values: number[]
  /** Optional comparison series (line only). */
  values2?: number[]
  /** 0–100 for donut. */
  ratio?: number
  color: string
  color2?: string
}

export interface ReportKpi {
  value: string
  sub?: string
  viz: VizSeries
}

function MiniLine({ s }: { s: VizSeries }) {
  const series = [s.values, ...(s.values2 ? [s.values2] : [])].filter(v => v.length > 1)
  if (series.length === 0) return null
  const all = series.flat()
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const W = 92; const H = 40; const P = 3
  const path = (vals: number[]) => vals
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${P + (i / (vals.length - 1)) * (W - P * 2)} ${P + (H - P * 2) - ((v - min) / range) * (H - P * 2)}`)
    .join(' ')
  const area = `${path(s.values)} L ${W - P} ${H - P} L ${P} ${H - P} Z`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={area} fill={s.color} fillOpacity={0.14} stroke="none" />
      {s.values2 && s.values2.length > 1 && (
        <path d={path(s.values2)} fill="none" stroke={s.color2 ?? T.text3} strokeWidth={1.4} strokeDasharray="3,2" />
      )}
      <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function MiniBars({ s }: { s: VizSeries }) {
  if (s.values.length === 0) return null
  const W = 92; const H = 40; const P = 3
  const max = Math.max(1, ...s.values)
  const n = s.values.length
  const gap = 2
  const bw = Math.max(3, (W - P * 2 - gap * (n - 1)) / n)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {s.values.map((v, i) => {
        const h = Math.max(1.5, (v / max) * (H - P * 2))
        return (
          <rect key={i} x={P + i * (bw + gap)} y={H - P - h} width={bw} height={h} rx={1.5}
            fill={s.color} fillOpacity={i === n - 1 ? 1 : 0.55} />
        )
      })}
    </svg>
  )
}

function MiniDonut({ s }: { s: VizSeries }) {
  const pct = Math.max(0, Math.min(100, Math.round(s.ratio ?? 0)))
  const R = 16; const SW = 5; const C = 2 * Math.PI * R
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" style={{ display: 'block' }}>
      <circle cx={20} cy={20} r={R} fill="none" stroke={T.border} strokeWidth={SW} />
      <circle cx={20} cy={20} r={R} fill="none" stroke={s.color} strokeWidth={SW} strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 20 20)" />
      <text x={20} y={23} textAnchor="middle" fontSize={10} fontWeight={700} fill={T.text1}>{pct}</text>
    </svg>
  )
}

/** Renders the mini visualization matching the metric type. */
export function ReportMiniViz({ viz }: { viz: VizSeries }) {
  if (viz.kind === 'donut') return <MiniDonut s={viz} />
  if (viz.kind === 'bars') return <MiniBars s={viz} />
  return <MiniLine s={viz} />
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export interface ReportEntry {
  id: string
  title: string
  subtitle: string
  span2: boolean
  Component: (props: ChartProps) => ReactElement
  /** Where clicking the card should take the user (already filtered). */
  nav: ReportNavIntent
  /** Message shown when the underlying query returns nothing. */
  emptyText: string
  /** Real KPI value + coherent thumbnail derived from the Supabase aggregates. */
  kpi: (d: ReportsData) => ReportKpi | null
}

const numFmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export const REPORT_REGISTRY: Record<string, ReportEntry> = {
  burndown: {
    id: 'burndown', title: 'Burndown Chart', span2: true,
    subtitle: 'Sprint ativa · Story points restantes vs. ideal',
    Component: BurndownChart,
    nav: { view: 'reports', reportId: 'burndown' },
    emptyText: 'Nenhuma sprint ativa com pontos estimados.',
    kpi: d => {
      const b = d.burndown
      const actual = b.actual.filter(v => !Number.isNaN(v))
      if (!b.sprintName || b.total === 0 || actual.length === 0) return null
      const remaining = actual[actual.length - 1]
      return {
        value: `${numFmt(remaining)} pts`,
        sub: `restantes de ${numFmt(b.total)} · ${b.sprintName}`,
        viz: { kind: 'line', values: actual, values2: b.ideal, color: T.accent, color2: T.text3 },
      }
    },
  },
  velocity: {
    id: 'velocity', title: 'Velocity Chart', span2: false,
    subtitle: 'Story points entregues por sprint concluída',
    Component: VelocityChart,
    nav: { view: 'reports', reportId: 'velocity' },
    emptyText: 'Nenhuma sprint concluída ainda.',
    kpi: d => {
      const v = d.velocity
      if (v.sprints.length === 0) return null
      return {
        value: `${numFmt(v.sprints[v.sprints.length - 1].value)} pts`,
        sub: `média ${numFmt(v.avg)} pts · ${v.sprints.length} sprints`,
        viz: { kind: 'bars', values: v.sprints.map(s => s.value), color: T.accent },
      }
    },
  },
  cfd: {
    id: 'cfd', title: 'CFD / Cumulative Flow', span2: true,
    subtitle: 'Distribuição de itens por status nos últimos 14 dias',
    Component: CFDChart,
    nav: { view: 'reports', reportId: 'cfd' },
    emptyText: 'Sem histórico de status nos últimos 14 dias.',
    kpi: d => {
      const c = d.cfd
      if (c.days.length === 0 || c.layers.length === 0) return null
      const totals = c.days.map((_, i) => c.layers.reduce((a, l) => a + (l.data[i] ?? 0), 0))
      if (totals.every(t => t === 0)) return null
      return {
        value: String(totals[totals.length - 1]),
        sub: 'itens em fluxo hoje',
        viz: { kind: 'line', values: totals, color: T.indigo },
      }
    },
  },
  bugs: {
    id: 'bugs', title: 'Bugs por Severidade', span2: false,
    subtitle: 'Bugs abertos no escopo selecionado',
    Component: BugsDonut,
    nav: { view: 'list', itemType: 'bug' },
    emptyText: 'Nenhum bug aberto.',
    kpi: d => {
      if (d.bugs.length === 0) return null
      const total = d.bugs.reduce((a, b) => a + b.val, 0)
      if (total === 0) return null
      return {
        value: String(total),
        sub: d.bugs.map(b => `${b.label} ${b.val}`).join(' · '),
        viz: { kind: 'bars', values: d.bugs.map(b => b.val), color: T.crit },
      }
    },
  },
  criados: {
    id: 'criados', title: 'Criados vs Resolvidos', span2: true,
    subtitle: 'Demandas criadas e resolvidas desde o início do projeto',
    Component: CreatedVsResolved,
    nav: { view: 'reports', reportId: 'criados' },
    emptyText: 'Nenhuma demanda criada ou resolvida desde o início do projeto.',
    kpi: d => {
      const c = d.createdVsResolved
      const sumC = c.created.length ? c.created[c.created.length - 1] : 0
      const sumR = c.resolved.length ? c.resolved[c.resolved.length - 1] : 0
      if (sumC === 0 && sumR === 0) return null
      return {
        value: `${sumC}/${sumR}`,
        sub: 'criadas / resolvidas desde o início do projeto',
        viz: { kind: 'line', values: c.created, values2: c.resolved, color: T.accent, color2: T.success },
      }
    },
  },
  workload: {
    id: 'workload', title: 'Workload por Pessoa', span2: false,
    subtitle: 'Story points ativos por membro da equipe',
    Component: WorkloadChart,
    nav: { view: 'team:membros' },
    emptyText: 'Nenhum item atribuído em andamento.',
    kpi: d => {
      if (d.workload.length === 0) return null
      const total = d.workload.reduce((a, w) => a + w.pts, 0)
      return {
        value: `${numFmt(total)} pts`,
        sub: `${d.workload.length} pessoas com carga ativa`,
        viz: { kind: 'bars', values: d.workload.map(w => w.pts), color: T.purple },
      }
    },
  },
  aging: {
    id: 'aging', title: 'Aging de Demandas', span2: false,
    subtitle: 'Dias no status atual por demanda em andamento',
    Component: AgingChart,
    nav: { view: 'list', itemStatus: 'in_progress' },
    emptyText: 'Nenhuma demanda em andamento.',
    kpi: d => {
      if (d.aging.length === 0) return null
      const max = Math.max(...d.aging.map(a => a.days))
      return {
        value: `${max}d`,
        sub: `mais antigo · ${d.aging.length} itens em andamento`,
        viz: { kind: 'bars', values: d.aging.map(a => a.days), color: T.warn },
      }
    },
  },
  leadtime: {
    id: 'leadtime', title: 'Lead Time & Cycle Time', span2: false,
    subtitle: 'Tempo médio de entrega e execução',
    Component: LeadCycleChart,
    nav: { view: 'reports', reportId: 'leadtime' },
    emptyText: 'Nenhum item concluído para medir lead time.',
    kpi: d => {
      const l = d.leadCycle
      if (l.leadAvg === 0 && l.cycleAvg === 0) return null
      return {
        value: `${numFmt(l.leadAvg)}d`,
        sub: `cycle ${numFmt(l.cycleAvg)}d`,
        viz: { kind: 'bars', values: l.buckets.map(b => b.value), color: T.accent },
      }
    },
  },
  health: {
    id: 'health', title: 'Saúde do Projeto', span2: false,
    subtitle: 'Score geral baseado em 5 dimensões reais',
    Component: ProjectHealth,
    nav: { view: 'reports', reportId: 'health' },
    emptyText: 'Sem dados suficientes para calcular a saúde.',
    kpi: d => {
      if (d.empty) return null
      const score = d.health.score
      return {
        value: `${score}%`,
        sub: 'score de saúde do portfólio',
        viz: { kind: 'donut', values: [], ratio: score, color: score >= 70 ? T.success : score >= 40 ? T.warn : T.crit },
      }
    },
  },
  epic: {
    id: 'epic', title: 'Epic / Release Burndown', span2: true,
    subtitle: 'Story points restantes por épico desde o início do projeto',
    Component: EpicBurndown,
    nav: { view: 'epics' },
    emptyText: 'Nenhum épico com pontos estimados.',
    kpi: d => {
      const e = d.epicBurndown
      if (e.epics.length === 0) return null
      const remaining = e.epics.reduce((a, ep) => a + (ep.data[ep.data.length - 1] ?? 0), 0)
      if (remaining === 0) return null
      const totals = e.weeks.map((_, i) => e.epics.reduce((a, ep) => a + (ep.data[i] ?? 0), 0))
      return {
        value: `${numFmt(remaining)} pts`,
        sub: `restantes em ${e.epics.length} épicos`,
        viz: { kind: 'line', values: totals, color: T.purple },
      }
    },
  },
}

export const REPORT_CARDS_LIST: ReportEntry[] = Object.values(REPORT_REGISTRY)

/** Navigates to the screen behind a report card, carrying its filter. */
export function navigateToReport(entry: ReportEntry, onNav?: (view: string, targetId?: string) => void): void {
  setReportNav(entry.nav)
  onNav?.(entry.nav.view)
}

/**
 * Real value + coherent thumbnail for a report card.
 * Handles loading / error / empty explicitly — never shows an invented number.
 */
export function ReportKpiPreview({ entry, compact = false }: { entry: ReportEntry; compact?: boolean }) {
  const { data, loading, error } = useReportsData()
  if (loading && !data) {
    return <div style={{ height: compact ? 40 : 48, borderRadius: 8, background: T.bgSurface2 }} />
  }
  if (error) {
    return <div style={{ fontSize: 11, color: T.crit }}>Falha ao carregar métrica.</div>
  }
  const kpi = data ? entry.kpi(data) : null
  if (!kpi) {
    return (
      <div style={{
        fontSize: 11, color: T.text3, border: `1px dashed ${T.border}`,
        borderRadius: 8, padding: '10px 12px', textAlign: 'center',
      }}>{entry.emptyText}</div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: compact ? 20 : 24, fontWeight: 700, color: T.text1, lineHeight: 1.1 }}>{kpi.value}</div>
        {kpi.sub && (
          <div style={{ fontSize: 10, color: T.text3, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {kpi.sub}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}><ReportMiniViz viz={kpi.viz} /></div>
    </div>
  )
}



// ─── Assistente de gestão (bloco reutilizável — topo dos modais) ──────────────
// Atenção passiva: OBSERVA + SUGERE, nunca decide/executa. Cada insight só
// explica o "porquê" e navega (o clique é do usuário). Card saudável = silêncio.

const SEVERITY_STYLE: Record<InsightSeverity, { dot: string; color: string; dim: string }> = {
  crit: { dot: '🔴', color: T.crit, dim: T.critDim },
  warn: { dot: '🟡', color: T.warn, dim: T.warnDim },
  info: { dot: '🔵', color: T.accent, dim: T.accentDim },
}

function AssistantPanel({ data, onNav, onClose }: {
  data: ReportsData
  onNav?: (view: string, targetId?: string) => void
  onClose: () => void
}) {
  const report = buildAssistantInsights(data)
  const hasAttention = report.insights.length > 0

  function go(nav?: InsightNav) {
    if (!onNav || !nav) return
    setReportNav({ view: nav.view, itemType: nav.itemType, itemStatus: nav.status })
    onClose()
    onNav(nav.view, nav.targetId)
  }

  return (
    <div style={{
      border: `1px solid ${T.border2}`, borderRadius: 12, overflow: 'hidden',
      background: T.bgSurface2, marginBottom: px(16),
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: px(10), padding: `${px(12)} ${px(14)}`,
        background: `linear-gradient(90deg, ${T.accentDim}, ${T.indigoDim})`,
        borderBottom: hasAttention ? `1px solid ${T.border}` : 'none',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, color: '#fff',
          background: `linear-gradient(135deg, ${T.accent}, ${T.indigo})`,
        }}>✦</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>Assistente de gestão</div>
          <div style={{ fontSize: 11, color: T.text2 }}>
            Analisou {report.analyzed} demanda{report.analyzed !== 1 ? 's' : ''}
            {hasAttention
              ? ` · ${report.insights.length} ponto${report.insights.length !== 1 ? 's' : ''} merece${report.insights.length === 1 ? '' : 'm'} seu olhar`
              : ' · nenhum ponto de atenção'}
          </div>
        </div>
      </div>

      {hasAttention ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {report.insights.map(ins => {
            const s = SEVERITY_STYLE[ins.severity]
            const clickable = !!(onNav && ins.nav)
            return (
              <InsightRow key={ins.id} ins={ins} style={s} clickable={clickable} onClick={() => go(ins.nav)} />
            )
          })}
          <div style={{ padding: `${px(8)} ${px(14)}`, fontSize: 10, color: T.text3, borderTop: `1px solid ${T.border}` }}>
            {report.passed} outra{report.passed !== 1 ? 's' : ''} verificaç{report.passed !== 1 ? 'ões' : 'ão'} passaram sem alertas.
          </div>
        </div>
      ) : (
        <div style={{ padding: `${px(14)} ${px(16)}`, display: 'flex', alignItems: 'center', gap: px(8) }}>
          <span style={{ fontSize: 15 }}>🟢</span>
          <span style={{ fontSize: 12, color: T.text2 }}>
            Nada exige atenção agora — as {report.totalChecks} verificações passaram. Fluxo saudável.
          </span>
        </div>
      )}
    </div>
  )
}

function InsightRow({ ins, style, clickable, onClick }: {
  ins: AssistantInsight
  style: { dot: string; color: string; dim: string }
  clickable: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: px(10), padding: `${px(11)} ${px(14)}`,
        borderTop: `1px solid ${T.border}`, borderLeft: `3px solid ${style.color}`,
        cursor: clickable ? 'pointer' : 'default',
        background: clickable && hover ? style.dim : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <span style={{ fontSize: 12, lineHeight: '18px', flexShrink: 0 }}>{style.dot}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text1 }}>{ins.title}</div>
        <div style={{ fontSize: 11.5, color: T.text2, marginTop: 2, lineHeight: 1.45 }}>{ins.detail}</div>
      </div>
      {clickable && (
        <span style={{ fontSize: 11, color: style.color, whiteSpace: 'nowrap', alignSelf: 'center', fontWeight: 600 }}>
          ver no board →
        </span>
      )}
    </div>
  )
}

// ─── Modal 1 — Progresso da sprint (burndown gerencial 1/N) ───────────────────

const LEVEL_STYLE: Record<SprintBurndown['level'], { color: string; label: string }> = {
  'on-track': { color: T.success, label: 'No prazo' },
  'at-risk': { color: T.warn, label: 'Em risco' },
  'critical': { color: T.crit, label: 'Crítico' },
}

function ProjectBurndownCard({ b, single }: { b: SprintBurndown; single: boolean }) {
  const name = liveProjects().find(p => p.id === b.projectId)?.name ?? 'Projeto'
  const lvl = LEVEL_STYLE[b.level]
  const W = single ? 640 : 340
  const H = single ? 220 : 150
  const PAD = { top: 12, right: 16, bottom: 26, left: 32 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top - PAD.bottom
  const n = b.days.length
  const maxPts = Math.max(1, b.total)
  const toX = (d: number) => PAD.left + (d / Math.max(1, n - 1)) * cw
  const toY = (p: number) => PAD.top + ch - (p / maxPts) * ch
  const idealPath = `M ${toX(0)} ${toY(b.ideal[0])} L ${toX(n - 1)} ${toY(b.ideal[n - 1])}`
  const real = b.actual.map((v, i) => [i, v] as [number, number]).filter(([, v]) => !Number.isNaN(v))
  let stepPath = ''
  real.forEach(([i, v], idx) => { stepPath += idx === 0 ? `M ${toX(i)} ${toY(v)}` : ` L ${toX(i)} ${toY(v)}` })
  const lastReal = real.length ? real[real.length - 1] : null
  const areaPath = stepPath && lastReal
    ? `${stepPath} L ${toX(lastReal[0])} ${toY(0)} L ${toX(real[0][0])} ${toY(0)} Z`
    : ''
  const tickStep = Math.max(1, Math.ceil(maxPts / 4))
  const ticks = Array.from({ length: 5 }, (_, i) => i * tickStep).filter(t => t <= maxPts * 1.01)
  const labelIdxs = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 0)
  const donePct = b.total > 0 ? Math.round((1 - b.remaining / b.total) * 100) : 0

  return (
    <div style={{
      border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden',
      borderLeft: `3px solid ${lvl.color}`, background: T.bgSurface,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: px(8), padding: `${px(10)} ${px(12)} ${px(4)}` }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11, color: T.text3 }}>{b.sprintName} · {b.days[0]}–{b.days[n - 1]}</div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: lvl.color, background: `${lvl.color}18`,
          border: `1px solid ${lvl.color}40`, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap',
        }}>{lvl.label}</div>
      </div>
      <div style={{ display: 'flex', gap: px(14), padding: `0 ${px(12)} ${px(4)}`, fontSize: 11, color: T.text2 }}>
        <span><strong style={{ color: T.text1 }}>{donePct}%</strong> concluído</span>
        <span><strong style={{ color: T.text1 }}>{numFmt(b.remaining)}</strong>/{numFmt(b.total)} pts</span>
        <span><strong style={{ color: b.daysLeft <= 2 ? T.warn : T.text1 }}>{b.daysLeft}</strong>d restantes</span>
      </div>
      <div style={{ padding: `${px(4)} ${px(8)} ${px(6)}` }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {ticks.map(t => <line key={t} x1={PAD.left} y1={toY(t)} x2={W - PAD.right} y2={toY(t)} stroke={T.border} strokeWidth={0.5} />)}
          {ticks.map(t => <text key={'t' + t} x={PAD.left - 5} y={toY(t) + 3} textAnchor="end" fontSize={8} fill={T.text3}>{t}</text>)}
          {labelIdxs.map(i => <text key={'d' + i} x={toX(i)} y={H - PAD.bottom + 15} textAnchor="middle" fontSize={8} fill={T.text3}>{b.days[i]}</text>)}
          {b.todayIndex >= 0 && (
            <>
              <line x1={toX(b.todayIndex)} y1={PAD.top} x2={toX(b.todayIndex)} y2={toY(0)} stroke={T.text3} strokeWidth={1} strokeDasharray="2,3" opacity={0.6} />
              <text x={toX(b.todayIndex)} y={PAD.top - 3} textAnchor="middle" fontSize={7.5} fill={T.text3}>hoje</text>
            </>
          )}
          {areaPath && <path d={areaPath} fill={lvl.color} fillOpacity={0.12} />}
          <path d={idealPath} stroke={T.accent} strokeWidth={1.6} strokeDasharray="6,4" fill="none" />
          {stepPath && <path d={stepPath} stroke={lvl.color} strokeWidth={2.4} fill="none" strokeLinejoin="round" />}
          {lastReal && <circle cx={toX(lastReal[0])} cy={toY(lastReal[1])} r={4.2} fill={lvl.color} stroke={T.bgSurface} strokeWidth={1.5} />}
          <g transform={`translate(${PAD.left}, ${H - 8})`}>
            <line x1={0} y1={-2} x2={14} y2={-2} stroke={T.accent} strokeWidth={1.5} strokeDasharray="5,3" />
            <text x={18} y={1} fontSize={8} fill={T.text3}>Ideal</text>
            <line x1={54} y1={-2} x2={68} y2={-2} stroke={lvl.color} strokeWidth={2} />
            <text x={72} y={1} fontSize={8} fill={T.text3}>Realizado</text>
          </g>
        </svg>
      </div>
      {b.reason && (
        <div style={{ padding: `${px(6)} ${px(12)} ${px(10)}`, fontSize: 11, color: lvl.color, display: 'flex', gap: px(6) }}>
          <span>⚠</span><span style={{ color: T.text2 }}>{b.reason}</span>
        </div>
      )}
    </div>
  )
}

function SprintProgressView({ data, onNav, onClose }: {
  data: ReportsData
  onNav?: (view: string, targetId?: string) => void
  onClose: () => void
}) {
  const sp = data.sprintProgress
  const sprints = sp.sprints
  const single = sprints.length === 1

  if (sprints.length === 0) {
    return (
      <>
        <AssistantPanel data={data} onNav={onNav} onClose={onClose} />
        <div style={{
          fontSize: 12, color: T.text3, border: `1px dashed ${T.border}`,
          borderRadius: 10, padding: '24px 16px', textAlign: 'center',
        }}>Nenhuma sprint ativa com pontos estimados no escopo selecionado.</div>
      </>
    )
  }

  return (
    <>
      <AssistantPanel data={data} onNav={onNav} onClose={onClose} />

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: px(14), marginBottom: px(16),
        padding: `${px(12)} ${px(14)}`, background: T.bgSurface2, borderRadius: 10, border: `1px solid ${T.border}`,
      }}>
        <SummaryStat label="Conclusão média" value={`${sp.summary.avgPct}%`} />
        <SummaryStat label="Menor prazo" value={sp.summary.daysLeftMin != null ? `${sp.summary.daysLeftMin}d` : '—'} />
        <SummaryStat label="No prazo" value={String(sp.summary.onTrack)} color={T.success} />
        <SummaryStat label="Em risco" value={String(sp.summary.atRisk)} color={sp.summary.atRisk > 0 ? T.warn : T.text1} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: single ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: px(14),
      }}>
        {sprints.map(b => <ProjectBurndownCard key={b.projectId + b.sprintName} b={b} single={single} />)}
      </div>
    </>
  )
}

function SummaryStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 88 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? T.text1, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Modal 2 — Lead Time & Cycle Time (gerencial) ─────────────────────────────

function LeadCycleView({ data, onNav, onClose }: {
  data: ReportsData
  onNav?: (view: string, targetId?: string) => void
  onClose: () => void
}) {
  const m = data.management
  const trendArrow = m.trendDir === 'up' ? '▲' : m.trendDir === 'down' ? '▼' : '→'
  const trendColor = m.trendDir === 'up' ? T.crit : m.trendDir === 'down' ? T.success : T.text3
  const wait = Math.round(m.leadAvg * (m.waitPct / 100) * 10) / 10
  const exec = Math.round((m.leadAvg - wait) * 10) / 10
  const waitFlex = m.leadAvg > 0 ? Math.max(4, m.waitPct) : 50
  const execFlex = m.leadAvg > 0 ? Math.max(4, 100 - m.waitPct) : 50

  if (m.sampleSize === 0) {
    return (
      <>
        <AssistantPanel data={data} onNav={onNav} onClose={onClose} />
        <div style={{
          fontSize: 12, color: T.text3, border: `1px dashed ${T.border}`,
          borderRadius: 10, padding: '24px 16px', textAlign: 'center',
        }}>Nenhum item concluído ainda para medir lead/cycle time no escopo selecionado.</div>
      </>
    )
  }

  const aged = data.aging.filter(a => a.days >= 15)
  const names = new Map(liveProjects().map(p => [p.id, p.name]))
  // Legenda dos prefixos das chaves (ex.: RAU → Rautaki) presentes no Aging.
  const agedLegend = [...new Map(
    aged.map(a => [a.id.split('-')[0], names.get(a.projectId) ?? a.id.split('-')[0]] as const),
  ).entries()]

  return (
    <>
      <AssistantPanel data={data} onNav={onNav} onClose={onClose} />

      {/* (2) Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: px(10), marginBottom: px(16) }}>
        <MetricTile label="Lead médio" value={`${numFmt(m.leadAvg)}d`} sub={`meta ${m.target}d`}
          badge={<span style={{ color: trendColor, fontSize: 12, fontWeight: 700 }}>{trendArrow}</span>} />
        <MetricTile label="Execução (cycle)" value={`${numFmt(m.cycleAvg)}d`} sub="em andamento → concluído" />
        <MetricTile label="Previsibilidade (P85)" value={`${numFmt(m.p85)}d`} sub="85% entregam até" />
        <MetricTile label="Dentro da meta" value={`${m.withinTargetPct}%`} sub={`≤ ${m.target}d`}
          valueColor={m.withinTargetPct >= 70 ? T.success : m.withinTargetPct >= 40 ? T.warn : T.crit} />
      </div>

      {/* (3) Lead = Espera + Execução */}
      <Section title="Lead = Espera (fila) + Execução (cycle)" hint="onde o tempo se perde">
        <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
          <div style={{ flex: waitFlex, background: T.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#000', whiteSpace: 'nowrap', padding: '0 4px', overflow: 'hidden' }}>Espera {numFmt(wait)}d</span>
          </div>
          <div style={{ flex: execFlex, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', padding: '0 4px', overflow: 'hidden' }}>Execução {numFmt(exec)}d</span>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, marginTop: px(8) }}>
          {m.waitPct > 50
            ? `A maior parte do lead (${m.waitPct}%) é espera em fila — o ganho está em priorização e redução de WIP, não em codar mais rápido.`
            : `O tempo se concentra na execução (${100 - m.waitPct}%) — a fila está saudável; foco em destravar o trabalho em andamento.`}
        </div>
      </Section>

      {/* (4) Distribuição do Lead */}
      <Section title="Distribuição do Lead Time" hint="por projeto · Rápidas · Médias · Longas">
        <div style={{ height: 240 }}><LeadDistChart data={data} /></div>
      </Section>

      {/* (5) Aging >15d */}
      <Section title={`Aging — itens parados há 15+ dias (${aged.length})`}>
        {aged.length === 0 ? (
          <div style={{ fontSize: 11.5, color: T.text3 }}>Nenhum item com mais de 15 dias parado no status atual. 🟢</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: px(6) }}>
            {aged.slice(0, 6).map(a => (
              <div key={a.itemId} style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
                <span style={{ width: 58, fontSize: 11, fontFamily: 'monospace', color: T.text2, flexShrink: 0 }}>{a.id}</span>
                <div style={{ flex: 1, height: 12, background: T.bgSurface2, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (a.days / Math.max(...aged.map(x => x.days))) * 100)}%`, height: '100%', background: a.color, opacity: 0.75 }} />
                </div>
                <span style={{ width: 40, fontSize: 11, fontWeight: 600, color: a.color, textAlign: 'right', flexShrink: 0 }}>{a.days}d</span>
              </div>
            ))}
          </div>
        )}
        {agedLegend.length > 0 && (
          <div style={{
            marginTop: px(10), paddingTop: px(8), borderTop: `1px solid ${T.border}`,
            display: 'flex', flexWrap: 'wrap', gap: px(4) + ' ' + px(12), fontSize: 10.5, color: T.text3,
          }}>
            <span style={{ color: T.text3 }}>Legenda:</span>
            {agedLegend.map(([prefix, name]) => (
              <span key={prefix}>
                <strong style={{ color: T.text2, fontFamily: 'monospace', fontWeight: 600 }}>{prefix}</strong> — {name}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* (6) Quebra por projeto */}
      {m.byProject.length > 0 && (
        <Section title="Quebra por projeto">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 380 }}>
              <thead>
                <tr style={{ color: T.text3, textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Projeto</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>Lead</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>Execução</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>Espera</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>Itens</th>
                </tr>
              </thead>
              <tbody>
                {m.byProject.map(p => (
                  <tr key={p.projectId} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: '6px 8px', color: T.text1, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names.get(p.projectId) ?? '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: p.lead > m.leadAvg * 1.5 ? T.warn : T.text1, fontWeight: 600 }}>{numFmt(p.lead)}d</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text2 }}>{numFmt(p.cycle)}d</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text2 }}>{numFmt(p.wait)}d</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text3 }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  )
}

function MetricTile({ label, value, sub, badge, valueColor }: {
  label: string; value: string; sub?: string; badge?: ReactNode; valueColor?: string
}) {
  return (
    <div style={{ background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: `${px(10)} ${px(12)}` }}>
      <div style={{ fontSize: 10.5, color: T.text3, marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: px(6) }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: valueColor ?? T.text1, lineHeight: 1 }}>{value}</span>
        {badge}
      </div>
      {sub && <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: px(16) }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: px(8), marginBottom: px(8) }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text1 }}>{title}</span>
        {hint && <span style={{ fontSize: 10.5, color: T.text3 }}>· {hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ─── Chips de projeto + views de análise (modais 1/N) ────────────────────────

function ScopeChips({ items, selected, onToggle }: {
  items: { id: string; name: string; color: string }[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (items.length <= 1) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: px(10) }}>
      {items.map(p => {
        const on = selected.has(p.id)
        return (
          <button key={p.id} className="no-drag" onClick={e => { e.stopPropagation(); onToggle(p.id) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer',
              color: on ? T.text1 : T.text3, background: on ? T.bgSurface2 : 'transparent',
              border: `1px solid ${on ? T.border2 : T.border}`, borderRadius: 999, padding: '3px 9px',
            }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: on ? p.color : 'transparent', border: `1.5px solid ${p.color}`, flexShrink: 0 }} />
            {p.name}
          </button>
        )
      })}
    </div>
  )
}

/** Seleção de escopo com reset quando o conjunto de projetos muda. */
function useScopeSel(ids: string[]) {
  const key = ids.join(',')
  const [sel, setSel] = useState<Set<string>>(() => new Set(ids))
  useEffect(() => { setSel(new Set(key ? key.split(',') : [])) }, [key])
  const toggle = (id: string) => setSel(prev => {
    const n = new Set(prev)
    if (n.has(id)) { if (n.size > 1) n.delete(id) } else n.add(id)
    return n
  })
  return [sel, toggle] as const
}

/** Sugestão consultiva (mesma casca dos insights). */
function AnalysisNote({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' | 'crit' }) {
  const color = tone === 'crit' ? T.crit : tone === 'warn' ? T.warn : T.accent
  return (
    <div style={{ display: 'flex', gap: px(8), padding: `${px(10)} ${px(12)}`, borderLeft: `3px solid ${color}`, background: T.bgSurface2, borderRadius: 8, fontSize: 12, color: T.text2, lineHeight: 1.45 }}>
      {text}
    </div>
  )
}

function CriadosAnalysisView({ data }: { data: ReportsData }) {
  const cvr = data.createdVsResolved
  const info = new Map(liveProjects().map(p => [p.id, p]))
  const items = cvr.byProject.map(b => ({
    id: b.projectId, name: info.get(b.projectId)?.name ?? 'Projeto', color: info.get(b.projectId)?.color ?? T.accent,
    created: b.created, resolved: b.resolved,
  }))
  const [sel, toggle] = useScopeSel(items.map(i => i.id))
  const shown = items.filter(i => sel.has(i.id))
  const use = shown.length ? shown : items
  const n = cvr.weeks.length
  const sumAt = (arrs: number[][], i: number) => arrs.reduce((a, arr) => a + (arr[i] ?? 0), 0)
  const created = Array.from({ length: n }, (_, i) => sumAt(use.map(u => u.created), i))
  const resolved = Array.from({ length: n }, (_, i) => sumAt(use.map(u => u.resolved), i))
  const sumC = created[n - 1] ?? 0, sumR = resolved[n - 1] ?? 0, gap = sumC - sumR
  const note = sel.size === 1
    ? `${use[0].name}: ${sumC} criados × ${sumR} resolvidos — backlog ${gap > 0 ? `cresceu ${gap}` : gap < 0 ? `reduziu ${-gap}` : 'estável'} neste projeto.`
    : `Agregado (${use.length} projeto${use.length !== 1 ? 's' : ''}): ${sumC} criados × ${sumR} resolvidos — gap de ${gap} itens. Selecione 1 projeto para a leitura individual.`

  const W = 620, H = 200
  const PAD = { top: 16, right: 14, bottom: 24, left: 34 }
  const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom
  const maxV = Math.max(1, ...created, ...resolved) * 1.15
  const x = (i: number) => n <= 1 ? PAD.left + cw / 2 : PAD.left + (i / (n - 1)) * cw
  const y = (v: number) => PAD.top + ch - (v / maxV) * ch
  const path = (d: number[]) => d.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const ticks = [...new Set([0, Math.round(maxV / 2.3), Math.round(maxV / 1.15)])]

  return (
    <>
      <ScopeChips items={items} selected={sel} onToggle={toggle} />
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={T.border} strokeWidth={0.5} />
            <text x={PAD.left - 5} y={y(t) + 3} textAnchor="end" fontSize={9} fill={T.text3}>{t}</text>
          </g>
        ))}
        <text x={11} y={PAD.top + ch / 2} fontSize={8.5} fill={T.text2} transform={`rotate(-90 11 ${PAD.top + ch / 2})`} textAnchor="middle">demandas (acumulado)</text>
        <path d={`${path(created)} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={T.warn} opacity={0.12} />
        <path d={path(created)} stroke={T.warn} strokeWidth={2} fill="none" />
        <path d={path(resolved)} stroke={T.success} strokeWidth={2} strokeDasharray="5,3" fill="none" />
        <text x={PAD.left} y={H - 5} fontSize={9} fill={T.text3}>{cvr.weeks[0]}</text>
        <text x={W - PAD.right} y={H - 5} textAnchor="end" fontSize={9} fill={T.text3}>{cvr.weeks[n - 1]}</text>
      </svg>
      <div style={{ display: 'flex', gap: px(16), margin: `${px(6)} 0 ${px(12)}`, fontSize: 11, color: T.text3 }}>
        <span><span style={{ display: 'inline-block', width: 14, borderTop: `2px solid ${T.warn}`, verticalAlign: 'middle', marginRight: 5 }} />Criados</span>
        <span><span style={{ display: 'inline-block', width: 14, borderTop: `2px dashed ${T.success}`, verticalAlign: 'middle', marginRight: 5 }} />Resolvidos</span>
      </div>
      <AnalysisNote text={note} tone={gap > 0 ? 'warn' : 'info'} />
    </>
  )
}

function EpicAnalysisView({ data }: { data: ReportsData }) {
  const info = new Map(liveProjects().map(p => [p.id, p]))
  const items = data.epicBurndown.byProject.map(b => ({
    id: b.projectId, name: info.get(b.projectId)?.name ?? 'Projeto', color: info.get(b.projectId)?.color ?? T.accent,
    remaining: b.remaining, prev: b.prev,
  }))
  const [sel, toggle] = useScopeSel(items.map(i => i.id))
  const shown = items.filter(i => sel.has(i.id))
  const use = shown.length ? shown : items
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: T.text3, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center' }}>Nenhum épico com pontos estimados no escopo.</div>
  }
  const max = Math.max(1, ...use.map(u => u.remaining))
  const trend = (u: { remaining: number; prev: number }) => u.remaining < u.prev ? { a: '▼', c: T.success } : u.remaining > u.prev ? { a: '▲', c: T.crit } : { a: '→', c: T.text3 }
  const sortedStalled = use.filter(u => u.remaining > 0 && u.remaining >= u.prev).sort((a, b) => b.remaining - a.remaining)
  const note = sel.size === 1
    ? (() => { const u = use[0]; return `${u.name}: ${u.remaining < u.prev ? `caindo de ${u.prev}→${u.remaining} pts — avançando para a entrega` : u.remaining > 0 ? `estagnou em ${u.remaining} pts — possivelmente travado (dependência?)` : 'sem pontos restantes'}.` })()
    : sortedStalled.length
      ? `${sortedStalled.length} projeto(s) com épicos parados — maior: ${sortedStalled[0].name} (${numFmt(sortedStalled[0].remaining)} pts). Selecione 1 projeto para o detalhe.`
      : 'Épicos avançando em todos os projetos selecionados.'
  return (
    <>
      <ScopeChips items={items} selected={sel} onToggle={toggle} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: px(8), marginBottom: px(12) }}>
        {use.map(u => {
          const tr = trend(u)
          return (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: px(8), fontSize: 12 }}>
              <span style={{ width: 120, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{u.name}</span>
              <div style={{ flex: 1, height: 12, background: T.bgSurface2, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (u.remaining / max) * 100)}%`, height: '100%', background: u.color, opacity: 0.8 }} />
              </div>
              <span style={{ width: 52, textAlign: 'right', fontWeight: 600, color: T.text1 }}>{numFmt(u.remaining)} pts</span>
              <span style={{ width: 16, textAlign: 'center', color: tr.c }}>{tr.a}</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 10.5, color: T.text3, marginBottom: px(10) }}>pontos restantes por projeto · ▼ avançando · ▲ subiu/estagnou</div>
      <AnalysisNote text={note} tone={sortedStalled.length ? 'warn' : 'info'} />
    </>
  )
}

function AgingAnalysisView({ data }: { data: ReportsData }) {
  const info = new Map(liveProjects().map(p => [p.id, p]))
  const all = data.aging
  const projItems = [...new Set(all.map(a => a.projectId))].map(pid => ({ id: pid, name: info.get(pid)?.name ?? 'Projeto', color: info.get(pid)?.color ?? T.accent }))
  const [sel, toggle] = useScopeSel(projItems.map(p => p.id))
  const rows = all.filter(a => sel.has(a.projectId)).sort((x, y) => y.days - x.days).slice(0, 8)
  if (all.length === 0) {
    return <div style={{ fontSize: 12, color: T.text3, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center' }}>Nenhum item em andamento para analisar.</div>
  }
  function suggestion(a: { id: string; days: number; tag: string | null; projectId: string }) {
    const pj = info.get(a.projectId)?.name ?? ''
    if (a.tag === 'Bloqueado') {
      return { tone: 'crit' as const, title: `${a.id} · bloqueada há ${a.days}d`, text: `Caminhos possíveis: retomar contato com quem/o que bloqueia · isolar a parte travada e seguir o resto · repriorizar se não for crítica agora.` }
    }
    if (a.tag === 'Atrasado') {
      return { tone: 'warn' as const, title: `${a.id} · atrasada · ${a.days}d parada`, text: `Caminhos possíveis: renegociar o prazo · reduzir o escopo da entrega · confirmar a prioridade com o time.` }
    }
    return { tone: 'warn' as const, title: `${a.id} · ${a.days}d no mesmo status${pj ? ` (${pj})` : ''}`, text: `Pode estar grande demais (fatiar em entregas menores) ou sem dono definido — vale confirmar o próximo passo.` }
  }
  return (
    <>
      <ScopeChips items={projItems} selected={sel} onToggle={toggle} />
      <div style={{ fontSize: 11.5, color: T.text3, marginBottom: px(10) }}>Analisou {rows.length} demanda{rows.length !== 1 ? 's' : ''} envelhecida{rows.length !== 1 ? 's' : ''} — sugestões de caminhos para destravar (a decisão é sua).</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: px(9) }}>
        {rows.map(a => {
          const s = suggestion(a)
          const color = s.tone === 'crit' ? T.crit : T.warn
          return (
            <div key={a.itemId} style={{ display: 'flex', gap: px(8), padding: `${px(10)} ${px(12)}`, borderLeft: `3px solid ${color}`, background: T.bgSurface2, borderRadius: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text1 }}>{s.title}</div>
                <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2, lineHeight: 1.45 }}>{s.text}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function VelocityAnalysisView({ data }: { data: ReportsData }) {
  const info = new Map(liveProjects().map(p => [p.id, p]))
  const items = data.velocity.byProject.map(b => ({ id: b.projectId, name: info.get(b.projectId)?.name ?? 'Projeto', color: info.get(b.projectId)?.color ?? T.accent, values: b.values }))
  const [sel, toggle] = useScopeSel(items.map(i => i.id))
  const shown = items.filter(i => sel.has(i.id))
  const use = shown.length ? shown : items
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: T.text3, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center' }}>Nenhuma sprint concluída para medir velocity.</div>
  }
  const avgOf = (vals: number[]) => { const nz = vals.filter(v => v > 0); return nz.length ? Math.round(nz.reduce((a, b) => a + b, 0) / nz.length) : 0 }
  const note = sel.size === 1
    ? `${use[0].name}: média de ${avgOf(use[0].values)} pts/sprint nas últimas ${use[0].values.filter(v => v > 0).length || use[0].values.length}.`
    : `Média por projeto: ${use.map(u => `${u.name} ${avgOf(u.values)}`).join(' · ')}. A média orienta quanto planejar por sprint.`
  return (
    <>
      <ScopeChips items={items} selected={sel} onToggle={toggle} />
      <div style={{ height: 220 }}><VelocityGrouped series={use.map(u => ({ name: u.name, color: u.color, values: u.values }))} /></div>
      <div style={{ marginTop: px(4) }}><AnalysisNote text={note} /></div>
    </>
  )
}

const HEALTH_MEANING: Record<string, string> = {
  Progresso: '% de itens concluídos',
  Qualidade: 'baixa taxa de bugs / retrabalho',
  Previsibilidade: 'quanto do comprometido foi entregue',
  Fluxo: 'idade dos itens em andamento (menor = melhor)',
  Risco: 'poucos itens bloqueados',
}

function HealthStrategyView({ data }: { data: ReportsData }) {
  const info = new Map(liveProjects().map(p => [p.id, p]))
  const items = data.health.byProject.map(b => ({ id: b.projectId, name: info.get(b.projectId)?.name ?? 'Projeto', color: info.get(b.projectId)?.color ?? T.accent, axes: b.axes, score: b.score }))
  const [sel, toggle] = useScopeSel(items.map(i => i.id))
  const shown = items.filter(i => sel.has(i.id))
  const use = shown.length ? shown : items
  const labels = data.health.axes.map(a => a.label)
  if (items.length === 0 || labels.length === 0) {
    return <div style={{ fontSize: 12, color: T.text3, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center' }}>Sem dados suficientes para a saúde.</div>
  }
  const agg = labels.map((_, i) => Math.round(use.reduce((a, u) => a + (u.axes[i]?.val ?? 0), 0) / use.length))
  const score = Math.round(agg.reduce((a, b) => a + b, 0) / agg.length)
  const dotColor = (v: number) => v >= 80 ? T.success : v >= 60 ? T.warn : T.crit
  let lowIdx = 0; agg.forEach((v, i) => { if (v < agg[lowIdx]) lowIdx = i })
  const target = Math.max(80, agg[lowIdx])
  const newScore = Math.round(agg.map((v, i) => (i === lowIdx ? target : v)).reduce((a, b) => a + b, 0) / agg.length)
  const lever = `Maior alavanca: ${labels[lowIdx]} (${agg[lowIdx]}%) — é a dimensão mais baixa e a que mais segura o score. Se subir para ${target}%, o score geral vai de ${score} para ${newScore}.`
  const riskIdx = labels.indexOf('Risco')
  const strong = labels.filter((_, i) => agg[i] >= 80).slice(0, 2)
  const clientSummary = `Projeto ${score >= 80 ? 'saudável' : score >= 60 ? 'em evolução' : 'em atenção'} (${score}/100): ${strong.length ? `${strong.join(' e ')} em bom nível` : 'sem destaques altos'}; ponto de atenção: ${labels[lowIdx]} (${agg[lowIdx]}%)${riskIdx >= 0 && agg[riskIdx] >= 80 ? '; sem risco crítico aberto' : ''}.`
  return (
    <>
      <ScopeChips items={items} selected={sel} onToggle={toggle} />
      <div style={{ fontSize: 20, fontWeight: 750, marginBottom: px(4) }}>{score}<span style={{ fontSize: 12, color: T.text3, fontWeight: 500 }}>/100</span></div>
      <div style={{ marginBottom: px(12) }}><AnalysisNote text={lever} tone="info" /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: px(6), marginBottom: px(12) }}>
        {labels.map((l, i) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: px(8), fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(agg[i]), flexShrink: 0 }} />
            <b style={{ color: T.text1, width: px(96), flexShrink: 0 }}>{l} {agg[i]}%</b>
            <span style={{ color: T.text3 }}>{HEALTH_MEANING[l] ?? ''}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: px(9) }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.success, marginBottom: px(5) }}>Resumo para o cliente</div>
        <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.5 }}>{clientSummary}</div>
      </div>
    </>
  )
}

function CFDAnalysisView({ data }: { data: ReportsData }) {
  const info = new Map(liveProjects().map(p => [p.id, p]))
  const items = data.cfd.byProject.map(b => ({ id: b.projectId, name: info.get(b.projectId)?.name ?? 'Projeto', color: info.get(b.projectId)?.color ?? T.accent, layers: b.layers }))
  const [sel, toggle] = useScopeSel(items.map(i => i.id))
  const [tab, setTab] = useState<'retro' | 'cliente'>('retro')
  const chosen = (() => { const u = items.filter(i => sel.has(i.id)); return u.length ? u : items })()
  const days = data.cfd.days
  const summed: CfdLayer[] = data.cfd.layers.map((L, li) => ({ label: L.label, color: L.color, data: days.map((_, d) => chosen.reduce((a, p) => a + (p.layers[li]?.data[d] ?? 0), 0)) }))
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: T.text3, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center' }}>Sem histórico de status no período.</div>
  }
  const three = cfdTo3band(summed, days.length)
  const tabBtn = (v: 'retro' | 'cliente', label: string) => (
    <button onClick={() => setTab(v)} className="no-drag" style={{
      fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
      background: tab === v ? T.accent : T.bgSurface2, border: `1px solid ${tab === v ? T.accent : T.border}`, color: tab === v ? '#fff' : T.text2,
    }}>{label}</button>
  )
  const activeLayers = tab === 'retro' ? summed : three
  return (
    <>
      <ScopeChips items={items} selected={sel} onToggle={toggle} />
      <div style={{ display: 'flex', gap: px(6), marginBottom: px(8) }}>{tabBtn('retro', 'Retrospectiva (time)')}{tabBtn('cliente', 'Cliente (dashview)')}</div>
      <div style={{ height: 200 }}><StackedArea layers={activeLayers} dayLabels={days} /></div>
      <CfdLegend layers={activeLayers} />
      <div style={{ marginTop: px(10) }}><CfdTiles layers={summed} mode={tab} /></div>
      {tab === 'cliente' && (
        <div style={{ marginTop: px(8), fontSize: 11.5, color: T.text2, lineHeight: 1.5 }}>
          A área verde cresce = entregas acontecendo. Se a faixa do meio engorda, sinalizamos gargalo e agimos. Foco em <b style={{ color: T.text1 }}>progresso e previsibilidade</b>.
        </div>
      )}
    </>
  )
}

// ─── Chart Modal ──────────────────────────────────────────────────────────────

/** Título/subtítulo próprios das visões gerenciais (sobrepõem o entry do registry). */
const MGMT_HEADERS: Record<string, { title: string; subtitle: string }> = {
  burndown: { title: 'Progresso da sprint', subtitle: 'Burndown por projeto · datas reais da sprint' },
  leadtime: { title: 'Lead Time & Cycle Time', subtitle: 'Onde o tempo se perde, da criação à entrega' },
  criados: { title: 'Criados vs Resolvidos', subtitle: 'Ritmo de criação × conclusão · análise por projeto' },
  epic: { title: 'Epic / Release Burndown', subtitle: 'Pontos restantes por projeto · o que avança e o que trava' },
  aging: { title: 'Aging de Demandas', subtitle: 'O que está travando — caminhos possíveis por demanda' },
  velocity: { title: 'Velocity', subtitle: 'Pontos entregues por sprint · por projeto' },
  health: { title: 'Saúde do Projeto', subtitle: 'Leitura estratégica · maior alavanca e efeito' },
  cfd: { title: 'Fluxo de Trabalho (CFD)', subtitle: 'Retrospectiva do time e visão do cliente' },
}

export function ReportChartModal({ reportId, onClose, onNav }: {
  reportId: string
  onClose: () => void
  onNav?: (view: string, targetId?: string) => void
}) {
  const entry = REPORT_REGISTRY[reportId]
  const { data, loading, error } = useReportsData()
  if (!entry) return null
  const Chart = entry.Component
  const scoped = data?.scopeProjectIds ?? null
  const mgmt = MGMT_HEADERS[reportId]
  const isMgmt = !!mgmt
  const header = mgmt ?? { title: entry.title, subtitle: entry.subtitle }

  let body: ReactElement
  if (isMgmt && loading && !data) {
    body = <ChartMessage kind="loading" text="" height={200} />
  } else if (isMgmt && error) {
    body = <ChartMessage kind="error" text={error} height={120} />
  } else if (isMgmt && data && reportId === 'burndown') {
    body = <SprintProgressView data={data} onNav={onNav} onClose={onClose} />
  } else if (isMgmt && data && reportId === 'leadtime') {
    body = <LeadCycleView data={data} onNav={onNav} onClose={onClose} />
  } else if (isMgmt && data && reportId === 'criados') {
    body = <CriadosAnalysisView data={data} />
  } else if (isMgmt && data && reportId === 'epic') {
    body = <EpicAnalysisView data={data} />
  } else if (isMgmt && data && reportId === 'aging') {
    body = <AgingAnalysisView data={data} />
  } else if (isMgmt && data && reportId === 'velocity') {
    body = <VelocityAnalysisView data={data} />
  } else if (isMgmt && data && reportId === 'health') {
    body = <HealthStrategyView data={data} />
  } else if (isMgmt && data && reportId === 'cfd') {
    body = <CFDAnalysisView data={data} />
  } else {
    body = <Chart />
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1300, backdropFilter: 'blur(2px)' }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1301, width: isMgmt ? 'min(1040px, 96vw)' : 'min(760px, 95vw)', maxHeight: isMgmt ? '90vh' : '85vh',
        background: T.bgSurface, border: `1px solid ${T.border2}`,
        borderRadius: 16, boxShadow: T.shadowModal,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>{header.title}</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>{header.subtitle}</div>
            {scoped && (
              <div style={{
                display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 600,
                color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accent}33`,
                borderRadius: 4, padding: '2px 7px',
              }}>
                Escopo: {scoped.length} projeto{scoped.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 7, background: `${T.text3}14`, border: 'none', color: T.text2, cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
          >×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {body}
        </div>
        <div style={{ padding: '10px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ fontSize: 12, color: T.text2, background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 14px', cursor: 'pointer' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Hook: open a chart modal from any panel ──────────────────────────────────
export function useChartModal(onNav?: (view: string, targetId?: string) => void) {
  const [openId, setOpenId] = useState<string | null>(null)
  const modal = openId ? <ReportChartModal reportId={openId} onClose={() => setOpenId(null)} onNav={onNav} /> : null
  return { openChart: setOpenId, chartModal: modal }
}
