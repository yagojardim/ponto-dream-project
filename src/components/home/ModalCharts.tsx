// Gráficos por sprint dos modais de detalhe do KPI. Ficam DENTRO do modal (que
// é renderizado sob ReportsDataProvider no HomeWidgetGrid), então podem chamar
// useReportsData(). Sem dado suficiente, mostram um aviso — nunca inventam série.
import { useReportsData } from '@/data/reportRegistry'
import { T } from '@/components/ds/tokens'

interface VelocitySeries { committed: number[]; completed: number[]; predictability: number[]; labels: string[]; n: number }

function seriesFromVelocity(data: { velocity?: { byProject?: { committed: number[]; completed: number[] }[] } } | null): VelocitySeries {
  const byP = data?.velocity?.byProject ?? []
  const n = byP.reduce((m, b) => Math.max(m, b.committed.length), 0)
  const committed = Array.from({ length: n }, (_, i) => byP.reduce((a, b) => a + (b.committed[i] ?? 0), 0))
  const completed = Array.from({ length: n }, (_, i) => byP.reduce((a, b) => a + (b.completed[i] ?? 0), 0))
  const predictability = committed.map((cv, i) => (cv > 0 ? Math.round((completed[i] / cv) * 100) : 0))
  const labels = Array.from({ length: n }, (_, i) => `S${i + 1}`)
  return { committed, completed, predictability, labels, n }
}

function ChartMsg({ text }: { text: string }) {
  return <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, color: T.text3, textAlign: 'center', padding: '0 12px' }}>{text}</div>
}

/** Linha com eixos X/Y (tendência por sprint). */
export function ModalLineChart({ values, labels, unit = '', color }: { values: number[]; labels: string[]; unit?: string; color: string }) {
  const W = 360, H = 150, PL = 34, PR = 14, PT = 16, PB = 26
  const pw = W - PL - PR, ph = H - PT - PB, base = PT + ph, n = values.length
  const mn = Math.min(...values), mx = Math.max(...values), span = (mx - mn) || 1
  const lo = mn - span * 0.25, hi = mx + span * 0.25
  const X = (i: number) => PL + (i / Math.max(1, n - 1)) * pw
  const Y = (v: number) => PT + ph - ((v - lo) / (hi - lo)) * ph
  const ticks = [lo, (lo + hi) / 2, hi]
  const d = values.map((v, i) => `${i ? 'L' : 'M'} ${X(i)} ${Y(v)}`).join(' ')
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <line x1={PL} y1={PT} x2={PL} y2={base} stroke={T.border2} />
      <line x1={PL} y1={base} x2={W - PR} y2={base} stroke={T.border2} />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={Y(t)} x2={W - PR} y2={Y(t)} stroke={T.border2} strokeWidth={0.5} strokeDasharray="2,3" />
          <text x={PL - 4} y={Y(t) + 3} textAnchor="end" fontSize={8} fill={T.text3}>{Math.round(t)}{unit}</text>
        </g>
      ))}
      <path d={`${d} L ${X(n - 1)} ${base} L ${X(0)} ${base} Z`} fill={color} fillOpacity={0.14} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={X(i)} cy={Y(v)} r={2.4} fill={color} />
          <text x={X(i)} y={base + 14} textAnchor="middle" fontSize={8} fill={T.text3}>{labels[i]}</text>
        </g>
      ))}
      <text x={X(n - 1) - 2} y={Y(values[n - 1]) - 6} textAnchor="end" fontSize={9.5} fontWeight={700} fill={T.text1}>{values[n - 1]}{unit}</text>
    </svg>
  )
}

/** Barras aninhadas com eixos: contorno = planejado (committed), preenchido = concluído (completed). */
export function ModalNestedChart({ committed, completed, labels, color }: { committed: number[]; completed: number[]; labels: string[]; color: string }) {
  const W = 360, H = 150, PL = 30, PR = 12, PT = 16, PB = 26
  const pw = W - PL - PR, ph = H - PT - PB, base = PT + ph, n = committed.length
  const mx = Math.max(1, ...committed, ...completed)
  const hi = Math.ceil(mx / 5) * 5 || 5
  const Y = (v: number) => base - (v / hi) * ph
  const slot = pw / n, bw = Math.min(38, slot * 0.5)
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <line x1={PL} y1={PT} x2={PL} y2={base} stroke={T.border2} />
      <line x1={PL} y1={base} x2={W - PR} y2={base} stroke={T.border2} />
      {[0, Math.round(hi / 2), hi].map((t, i) => (
        <g key={i}>
          {t !== 0 && <line x1={PL} y1={Y(t)} x2={W - PR} y2={Y(t)} stroke={T.border2} strokeWidth={0.5} strokeDasharray="2,3" />}
          <text x={PL - 4} y={Y(t) + 3} textAnchor="end" fontSize={8} fill={T.text3}>{t}</text>
        </g>
      ))}
      {committed.map((cv, i) => {
        const cx = PL + i * slot + slot / 2
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={Y(cv)} width={bw} height={base - Y(cv)} rx={2} fill="none" stroke={color} strokeWidth={1.3} opacity={0.55} />
            <rect x={cx - bw / 2} y={Y(completed[i])} width={bw} height={base - Y(completed[i])} rx={2} fill={color} opacity={0.9} />
            <text x={cx} y={Y(completed[i]) - 3} textAnchor="middle" fontSize={8} fill={T.text2}>{completed[i]}</text>
            <text x={cx} y={base + 14} textAnchor="middle" fontSize={8} fill={T.text3}>{labels[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Tendência de previsibilidade por sprint (série real dos relatórios). */
export function PredictabilityChartLive() {
  const { data, loading } = useReportsData()
  const s = seriesFromVelocity(data)
  if (loading && !data) return <ChartMsg text="Carregando a série…" />
  if (s.n < 2) return <ChartMsg text="Ainda não há sprints concluídas suficientes para a tendência." />
  return <ModalLineChart values={s.predictability} labels={s.labels} unit="%" color={T.success} />
}

/** Criado (contorno) × Finalizado (preenchido) por sprint (série real dos relatórios). */
export function CreatedFinalizedChartLive() {
  const { data, loading } = useReportsData()
  const s = seriesFromVelocity(data)
  if (loading && !data) return <ChartMsg text="Carregando a série…" />
  if (s.n < 1) return <ChartMsg text="Sem dados de sprint neste escopo." />
  return <ModalNestedChart committed={s.committed} completed={s.completed} labels={s.labels} color={T.accent} />
}
