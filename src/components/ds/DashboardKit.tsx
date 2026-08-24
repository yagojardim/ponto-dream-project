/**
 * Altech DashboardKit — shared components for all 10 dashboard panels.
 * Single source of truth. Import from here, never duplicate in panel files.
 */
import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from 'react'
import { T } from './tokens'
import { HelpHint } from './HelpHint'
import { useSession } from '../../data/SessionContext'
import { can } from '../../data/permissions'
import {
  WorkItemDetail,
  type WorkItemData, type WIMember, type WISprint,
} from '../WorkItemDetail'
import { MOCK_USERS } from '../../data/session'

// ─── Types ────────────────────────────────────────────────────────────────────
export type RagStatus = 'healthy' | 'risk' | 'blocked'
export type WorkStatus =
  | 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done'
  | 'blocked' | 'ready' | 'testing' | 'cancelled'

export interface WorkItem {
  id: string
  key: string
  title: string
  type: 'story' | 'task' | 'bug' | 'epic' | 'subtask'
  status: WorkStatus
  priority: 'critical' | 'high' | 'medium' | 'low'
  assignee?: { name: string; initials: string; color: string }
  reporter?: { name: string; initials: string; color: string }
  sprint?: string
  project_id: string
  squad_id: string
  points?: number
  description?: string
  tags?: string[]
  created_at?: string
  due_date?: string
  days_blocked?: number
  history?: { when: string; action: string; by: string }[]
}

// ─── Status config ────────────────────────────────────────────────────────────
export function statusConfig(s: WorkStatus): { label: string; color: string } {
  const map: Record<WorkStatus, { label: string; color: string }> = {
    backlog:     { label: 'Backlog',        color: T.neutral },
    todo:        { label: 'A fazer',        color: T.text3 },
    'in-progress':{ label: 'Em Dev',        color: T.accent },
    'in-review': { label: 'Em Revisão',     color: T.indigo },
    done:        { label: 'Concluído',      color: T.success },
    blocked:     { label: 'Bloqueado',      color: T.crit },
    ready:       { label: 'Ready',          color: T.success },
    testing:     { label: 'Em Teste',       color: T.warn },
    cancelled:   { label: 'Cancelado',      color: T.neutral },
  }
  return map[s] ?? { label: s, color: T.neutral }
}

export function ragConfig(r: RagStatus): { label: string; color: string } {
  return {
    healthy: { label: 'Saudável',  color: T.success },
    risk:    { label: 'Em risco',  color: T.warn },
    blocked: { label: 'Bloqueado', color: T.crit },
  }[r]
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: WorkStatus }) {
  const { label, color } = statusConfig(status)
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color,
      background: `${color}18`, border: `1px solid ${color}33`,
      borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

// ─── ConditionalTag ───────────────────────────────────────────────────────────
export function ConditionalTag({ label, severity = 'warn' }: {
  label: string; severity?: 'warn' | 'crit' | 'info' | 'neutral'
}) {
  const c = severity === 'crit' ? T.crit : severity === 'info' ? T.accent : severity === 'neutral' ? T.neutral : T.warn
  return (
    <span style={{
      fontSize: 10, color: c, background: `${c}14`, border: `1px solid ${c}30`,
      borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Av({ initials, color, size = 24 }: {
  initials: string; color: string; size?: number
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 700, color: '#fff',
    }}>{initials}</div>
  )
}

// ─── UserAvatarStack ──────────────────────────────────────────────────────────
export function UserAvatarStack({ users, max = 3 }: {
  users: { initials: string; color: string; name: string }[]
  max?: number
}) {
  const shown = users.slice(0, max)
  const rest = users.length - max
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((u, i) => (
        <div key={u.name} title={u.name} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: max - i }}>
          <Av initials={u.initials} color={u.color} size={22} />
        </div>
      ))}
      {rest > 0 && (
        <div style={{
          marginLeft: -6, width: 22, height: 22, borderRadius: 99,
          background: T.bgSurface2, border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: T.text2,
        }}>+{rest}</div>
      )}
    </div>
  )
}

// ─── SectionCard wrapper ──────────────────────────────────────────────────────
export function SCard({ title, action, children, style, bodyStyle, help, helpTitle }: {
  title: string; action?: ReactNode; children: ReactNode; style?: CSSProperties; bodyStyle?: CSSProperties
  help?: string; helpTitle?: string
}) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: 16, minWidth: 0, overflowX: 'auto', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: T.text1 }}>
          {title}
          {help && <HelpHint text={help} title={helpTitle} label={`Ajuda sobre ${title}`} />}
        </span>
        {action}
      </div>
      {bodyStyle
        ? <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...bodyStyle }}>{children}</div>
        : children}
    </div>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color, height = 4 }: {
  pct: number; color?: string; height?: number
}) {
  return (
    <div style={{ height, background: T.bgPage, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color ?? T.accent, borderRadius: 99, transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ─── MiniBarChart — compact bar chart for KpiCard right pane ─────────────────
export function MiniBarChart({ data, showAvg = true }: {
  data: { label: string; value: number; current?: boolean }[]
  showAvg?: boolean
}) {
  if (!data.length) return null
  const max   = Math.max(...data.map(d => d.value))
  const avg   = Math.round(data.reduce((s, d) => s + d.value, 0) / data.length)
  const yMax  = Math.ceil(max * 1.3 / 5) * 5 || 5
  const n     = data.length
  const vW = 180, vH = 88, pL = 20, pR = 16, pT = 14, pB = 14
  const iW = vW - pL - pR, iH = vH - pT - pB
  const gap = 3
  const bW  = Math.max(6, (iW - gap * (n - 1)) / n)
  const yp  = (v: number) => pT + iH - (v / yMax) * iH
  const avgY = yp(avg)
  const ticks = Array.from(new Set([0, Math.round(yMax / 2), yMax]))
  return (
    <svg viewBox={`0 0 ${vW} ${vH}`} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
      {ticks.map(v => (
        <text key={v} x={pL - 3} y={yp(v) + 3} textAnchor="end" fontSize={7} fill={T.text3}>{v}</text>
      ))}
      {showAvg && (
        <>
          <line x1={pL} y1={avgY} x2={vW - pR} y2={avgY}
            stroke={T.border} strokeWidth={0.8} strokeDasharray="3 2" />
          <text x={vW - pR + 2} y={avgY + 3} fontSize={6} fill={T.text3}>avg</text>
        </>
      )}
      {data.map((d, i) => {
        const bx = pL + i * (bW + gap)
        const bH = Math.max(2, (d.value / yMax) * iH)
        const by = yp(d.value)
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={bx} y={by} width={bW} height={bH} rx={1.5}
              fill={d.current ? '#93c5fd' : '#3b82f6'} />
            <text x={bx + bW / 2} y={by - 2} textAnchor="middle" fontSize={6.5} fill={T.text2} fontWeight="600">
              {d.value}
            </text>
            <text x={bx + bW / 2} y={vH - 1} textAnchor="middle" fontSize={6.5} fill={T.text3}>
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── MiniSparkline — compact trend line for KpiCard right pane ────────────────
export function MiniSparkline({ data, color }: {
  data: { label?: string; value: number }[]
  color?: string
}) {
  if (data.length < 2) return null
  const vals = data.map(d => d.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const vW = 180, vH = 88, pL = 22, pR = 4, pT = 10, pB = 14
  const iW = vW - pL - pR, iH = vH - pT - pB
  const xp = (i: number) => pL + (i / (data.length - 1)) * iW
  const yp = (v: number) => pT + iH - ((v - min) / range) * iH
  const pts  = data.map((d, i) => `${xp(i)},${yp(d.value)}`).join(' ')
  const fill = `${xp(0)},${vH - pB} ${pts} ${xp(data.length - 1)},${vH - pB}`
  const lc   = color ?? T.accent
  const last  = vals[vals.length - 1]
  return (
    <svg viewBox={`0 0 ${vW} ${vH}`} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
      <polygon points={fill} fill={lc} fillOpacity={0.13} />
      <polyline points={pts} fill="none" stroke={lc} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xp(data.length - 1)} cy={yp(last)} r={2.5} fill={lc} />
      <text x={pL - 3} y={pT + 3}        textAnchor="end" fontSize={7} fill={T.text3}>{max}</text>
      <text x={pL - 3} y={vH - pB + 3}   textAnchor="end" fontSize={7} fill={T.text3}>{min}</text>
      {data[0]?.label && (
        <text x={xp(0)} y={vH} textAnchor="middle" fontSize={6.5} fill={T.text3}>{data[0].label}</text>
      )}
      {data[data.length - 1]?.label && (
        <text x={xp(data.length - 1)} y={vH} textAnchor="middle" fontSize={6.5} fill={T.text3}>
          {data[data.length - 1].label}
        </text>
      )}
    </svg>
  )
}

// ─── KpiCard — clicking navigates to filtered list ────────────────────────────
export function KpiCard({ value, label, sub, miniViz, disclaimer, color, alert, onClick, help, helpTitle }: {
  value: string; label: string; sub?: string; miniViz?: ReactNode; disclaimer?: string
  color?: string; alert?: boolean; onClick?: () => void
  help?: string; helpTitle?: string
}) {
  const [hovered, setHovered] = useState(false)
  const clickable  = !!onClick
  const hasMiniViz = !!miniViz
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered && clickable ? T.bgSurface2 : T.bgSurface,
        borderTop:    `1px solid ${alert ? T.crit : hovered && clickable ? T.accent : T.border}`,
        borderRight:  `1px solid ${alert ? T.crit : hovered && clickable ? T.accent : T.border}`,
        borderBottom: `1px solid ${alert ? T.crit : hovered && clickable ? T.accent : T.border}`,
        borderLeft:   alert ? `3px solid ${T.crit}` : `1px solid ${hovered && clickable ? T.accent : T.border}`,
        borderRadius: 10, padding: '14px 16px',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'all 0.15s', userSelect: 'none',
        display: 'flex', flexDirection: hasMiniViz ? 'row' : 'column',
        gap: hasMiniViz ? 10 : 0,
        minWidth: 0,
      }}
    >
      {/* Left: text content */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: hasMiniViz ? '0 0 42%' : 1 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: color ?? T.text1, lineHeight: 1 }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.text2, marginTop: 4 }}>
          {label}
          {help && <span onClick={e => e.stopPropagation()}><HelpHint text={help} title={helpTitle} label={`Ajuda sobre ${label}`} /></span>}
        </div>
        {sub && <div style={{ fontSize: 10, color: T.text3, marginTop: 2, fontWeight: 500 }}>{sub}</div>}
        {disclaimer && hasMiniViz && (
          <div style={{
            marginTop: 'auto', paddingTop: 7,
            fontSize: 9, color: T.text3,
            whiteSpace: 'normal', wordBreak: 'break-word',
            borderTop: `1px solid ${T.border}`,
            fontStyle: 'italic', letterSpacing: '0.01em', lineHeight: 1.4,
          }}>{disclaimer}</div>
        )}
        {clickable && (
          <div style={{ fontSize: 10, color: T.accent, marginTop: 4, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
            Ver lista →
          </div>
        )}
      </div>
      {/* Right: mini visualization */}
      {hasMiniViz && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch' }}>
          {miniViz}
        </div>
      )}
    </div>
  )
}

// ─── ProjectMultiSelect — shared multi-select for project filtering ───────────
export interface ProjectOption { id: string; name: string; color?: string }

export function ProjectMultiSelect({
  projects, selected, onChange,
}: {
  projects: ProjectOption[]
  selected: Set<string>
  onChange: (s: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const allSelected = selected.size >= projects.length
  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) { if (next.size === 1) return; next.delete(id) }
    else { next.add(id) }
    onChange(next)
  }

  const label = allSelected
    ? `Todos (${projects.length})`
    : selected.size === 1
    ? projects.find(p => selected.has(p.id))?.name ?? '1 projeto'
    : `${selected.size} projetos`

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => e.key === 'Escape' && setOpen(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
          background: T.bgSurface, border: `1px solid ${open ? T.accent : T.border}`,
          color: T.text2, fontSize: 12, transition: 'border-color 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="1" y="1.5" width="10" height="1.5" rx="0.75" fill="currentColor"/>
          <rect x="1" y="5" width="7" height="1.5" rx="0.75" fill="currentColor"/>
          <rect x="1" y="8.5" width="9" height="1.5" rx="0.75" fill="currentColor"/>
        </svg>
        <span style={{ color: allSelected ? T.text2 : T.accent, fontWeight: allSelected ? 400 : 600 }}>
          Projetos: {label}
        </span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M1.5 2.5L4 5L6.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: T.bgSurface, border: `1px solid ${T.border}`,
          borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.5)', minWidth: 220, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: T.bgPage, borderRadius: 6, border: `1px solid ${T.border}`, padding: '5px 8px',
            }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <circle cx="4.5" cy="4.5" r="3.5" stroke={T.text3} strokeWidth="1.1"/>
                <path d="M7.5 7.5l2 2" stroke={T.text3} strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar projeto…"
                onKeyDown={e => e.key === 'Escape' && setOpen(false)}
                style={{ background: 'none', border: 'none', outline: 'none', color: T.text1, fontSize: 12, width: '100%' }}
              />
            </div>
          </div>

          <_ProjRow
            checked={allSelected}
            color={T.accent}
            label="Todos os projetos"
            count={projects.length}
            onClick={() => onChange(
              allSelected
                ? new Set([projects[0]?.id].filter(Boolean) as string[])
                : new Set(projects.map(p => p.id))
            )}
          />

          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map(p => (
              <_ProjRow
                key={p.id}
                checked={selected.has(p.id)}
                color={p.color}
                label={p.name}
                onClick={() => toggle(p.id)}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px', fontSize: 12, color: T.text3, textAlign: 'center' }}>
                Nenhum projeto encontrado
              </div>
            )}
          </div>

          {!allSelected && (
            <div style={{ padding: '7px 12px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: T.text3 }}>{selected.size} selecionado{selected.size !== 1 ? 's' : ''}</span>
              <button
                onClick={() => { onChange(new Set(projects.map(p => p.id))); setOpen(false) }}
                style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}
              >Mostrar todos</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function _ProjRow({ checked, color, label, count, onClick }: {
  checked: boolean; color?: string; label: string; count?: number; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', cursor: 'pointer',
        background: hov ? T.bgSurface2 : 'transparent',
        borderBottom: `1px solid ${T.border}`,
        transition: 'background 0.1s',
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${checked ? (color ?? T.accent) : T.border}`,
        background: checked ? (color ?? T.accent) : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      {color && !count && <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: 12, color: T.text1, flex: 1 }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: 10, color: T.text3 }}>{count}</span>}
    </div>
  )
}

// ─── RagCard — entity (project) card with RAG status ─────────────────────────
export function RagCard({ name, squad, rag, pct, daysLabel, reason, onClick }: {
  name: string; squad?: string; rag: RagStatus; pct: number
  daysLabel: string; reason?: string; onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const { label, color } = ragConfig(rag)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.bgSurface2 : T.bgSurface,
        borderTop:    `1px solid ${hovered ? color : T.border}`,
        borderRight:  `1px solid ${hovered ? color : T.border}`,
        borderBottom: `1px solid ${hovered ? color : T.border}`,
        borderLeft:   `3px solid ${color}`,
        borderRadius: 10, padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s', minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>{name}</div>
          {squad && <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{squad}</div>}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, color, background: `${color}18`,
          border: `1px solid ${color}33`, borderRadius: 4, padding: '2px 7px', flexShrink: 0,
        }}>{label}</span>
      </div>
      {reason && rag !== 'healthy' && (
        <div style={{ marginBottom: 8 }}>
          <ConditionalTag label={reason} severity={rag === 'blocked' ? 'crit' : 'warn'} />
        </div>
      )}
      <ProgressBar pct={pct} color={color} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: T.text3 }}>{pct}% concluído</span>
        <span style={{ fontSize: 10, color: T.text3 }}>{daysLabel}</span>
      </div>
      {onClick && (
        <div style={{ fontSize: 10, color: T.accent, marginTop: 8, opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
          Ver projeto →
        </div>
      )}
    </div>
  )
}

// ─── ProgressCard — big % + sparkline + velocity ──────────────────────────────
export function ProgressCard({ pct, label, velocity, sprintData, onClick }: {
  pct: number; label: string; velocity?: string; sprintData?: number[]; onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const data = sprintData ?? [28, 32, 35, 30, 38, 42, 38, 44]
  const max = Math.max(...data)
  const w = 280; const h = 48
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.bgSurface2 : T.bgSurface,
        border: `1px solid ${hovered ? T.accent : T.border}`,
        borderRadius: 10, padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: T.text1, lineHeight: 1 }}>{pct}%</div>
        <div style={{ paddingBottom: 4 }}>
          <div style={{ fontSize: 12, color: T.text2 }}>{label}</div>
          {velocity && <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{velocity}</div>}
        </div>
      </div>
      <ProgressBar pct={pct} color={T.accent} height={5} />
      {/* Sparkline */}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ marginTop: 10, width: '100%', height: 36 }}>
        <defs>
          <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={T.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={pts.join(' ')} fill="none" stroke={T.accent} strokeWidth="1.5" />
        <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill="url(#spk)" />
        {data.map((v, i) => (
          <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - (v / max) * h} r="2" fill={T.accent} />
        ))}
      </svg>
    </div>
  )
}

// ─── WorkItemRow — single work item line in a queue ───────────────────────────
export function WorkItemRow({ item, onOpen, showDaysBlocked }: {
  item: WorkItem; onOpen: (item: WorkItem) => void; showDaysBlocked?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const { color } = statusConfig(item.status)
  return (
    <div
      onClick={() => onOpen(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: hovered ? T.bgSurface2 : T.bgPage,
        border: `1px solid ${hovered ? T.border2 : 'transparent'}`,
        borderRadius: 7, padding: '8px 10px', cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {/* Type dot */}
      <div style={{ width: 6, height: 6, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.text3, width: 52, flexShrink: 0 }}>{item.key}</span>
      <span style={{ flex: 1, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</span>
      {item.points !== undefined && item.points > 0 && (
        <span style={{ fontSize: 10, color: T.text3, background: `${T.text3}14`, padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>{item.points}pt</span>
      )}
      {showDaysBlocked && item.days_blocked && (
        <ConditionalTag label={`${item.days_blocked}d bloqueado`} severity={item.days_blocked >= 3 ? 'crit' : 'warn'} />
      )}
      {item.assignee && <Av initials={item.assignee.initials} color={item.assignee.color} size={20} />}
      <StatusBadge status={item.status} />
    </div>
  )
}

// ─── WorkQueue — titled list of work items with header counter ────────────────
export function WorkQueue({ title, items, onOpen, onViewAll, emptyMsg, showDaysBlocked, maxItems = 5 }: {
  title: string; items: WorkItem[]; onOpen: (item: WorkItem) => void
  onViewAll?: () => void; emptyMsg?: string; showDaysBlocked?: boolean; maxItems?: number
}) {
  const shown = items.slice(0, maxItems)
  const viewAllAction = onViewAll ? (
    <button
      onClick={e => { e.stopPropagation(); onViewAll() }}
      style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >Ver todos →</button>
  ) : undefined

  return (
    <SCard title={`${title} ${items.length > 0 ? `(${items.length})` : ''}`} action={viewAllAction}>
      {shown.length === 0
        ? <EmptyState message={emptyMsg ?? 'Nenhum item no momento.'} />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {shown.map(item => (
              <WorkItemRow key={item.id} item={item} onOpen={onOpen} showDaysBlocked={showDaysBlocked} />
            ))}
          </div>
      }
    </SCard>
  )
}

// ─── SprintDonut + delivery list ──────────────────────────────────────────────
export function SprintDonutCard({ sprintName, done, total, items, onOpen, onViewSprint }: {
  sprintName: string; done: number; total: number
  items: WorkItem[]; onOpen: (item: WorkItem) => void; onViewSprint?: () => void
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const r = 30; const circ = 2 * Math.PI * r
  const stroke = circ * (1 - pct / 100)
  return (
    <SCard title={sprintName} action={
      onViewSprint
        ? <button onClick={onViewSprint} style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver sprint →</button>
        : undefined
    }>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Donut */}
        <div
          onClick={onViewSprint}
          style={{ cursor: onViewSprint ? 'pointer' : 'default', flexShrink: 0 }}
          title="Ver sprint"
        >
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={r} fill="none" stroke={T.bgPage} strokeWidth="8" />
            <circle cx="36" cy="36" r={r} fill="none" stroke={T.success} strokeWidth="8"
              strokeDasharray={circ} strokeDashoffset={stroke}
              strokeLinecap="round" transform="rotate(-90 36 36)" />
            <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill={T.text1}>{pct}%</text>
          </svg>
          <div style={{ fontSize: 10, color: T.text3, textAlign: 'center', marginTop: 2 }}>{done}/{total} pts</div>
        </div>
        {/* List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
          {items.slice(0, 5).map(item => (
            <WorkItemRow key={item.id} item={item} onOpen={onOpen} />
          ))}
          {items.length === 0 && <EmptyState message="Nenhuma entrega nesta sprint." />}
        </div>
      </div>
    </SCard>
  )
}

// ─── WorkItem → WorkItemData adapter ─────────────────────────────────────────

const AVAILABLE_MEMBERS: WIMember[] = MOCK_USERS.map(u => ({
  id: u.user_id, initials: u.avatar_initials, name: u.name,
}))

const AVAILABLE_SPRINTS: WISprint[] = [
  { id: 's13', name: 'Sprint 13' },
  { id: 's14', name: 'Sprint 14' },
  { id: 's15', name: 'Sprint 15' },
]

const AVAILABLE_LABELS  = ['Design','Web','Research','Content','Mobile','Eng','UX','SEO','Brand','Hero']
const AVAILABLE_VERSIONS = ['v2.3.0','v2.4.0','v2.4.1','v2.5.0']

const AVAILABLE_EPICS = [
  { id:'EP-01', label:'Website Relaunch',    color:'#3B82F6' },
  { id:'EP-02', label:'Infra & Eng',         color:'#F59E0B' },
  { id:'EP-03', label:'Pesquisa & Conteúdo', color:'#A78BFA' },
]

function workItemToWID(item: WorkItem): WorkItemData {
  return {
    key:              item.key,
    type:             item.type,
    title:            item.title,
    status:           item.status === 'blocked' ? 'in-progress' : item.status === 'ready' ? 'todo' : item.status === 'testing' ? 'in-review' : item.status === 'cancelled' ? 'done' : (item.status as string),
    priority:         item.priority,
    labels:           item.tags ?? [],
    assigneeInitials: item.assignee?.initials ?? '',
    assigneeName:     item.assignee?.name,
    reporterInitials: item.reporter?.initials,
    reporterName:     item.reporter?.name,
    description:      item.description,
    dueDate:          item.due_date,
    points:           item.points,
    sprintName:       item.sprint,
    fixVersions:      [],
    history:          [],
    createdAt:        item.created_at ?? '—',
    updatedAt:        '—',
    availableEpics:   AVAILABLE_EPICS,
    availableMembers: AVAILABLE_MEMBERS,
    availableSprints: AVAILABLE_SPRINTS,
    availableLabels:  AVAILABLE_LABELS,
    availableVersions:AVAILABLE_VERSIONS,
  }
}

// ─── WorkItemDetailDrawer ─────────────────────────────────────────────────────
export function WorkItemDetailDrawer({ item, onClose, onNav }: {
  item: WorkItem; onClose: () => void; onNav?: (view: string, targetId?: string) => void
}) {
  const { activeUser } = useSession()
  const canEdit = can(activeUser.permissions, 'edit:workitem')
  const [editing, setEditing] = useState(false)
  const [wid, setWid] = useState<WorkItemData>(() => workItemToWID(item))

  const { label: statusLabel, color: statusColor } = statusConfig(item.status)
  const history = item.history ?? [
    { when: 'há 5d', action: 'Issue criada',              by: item.reporter?.name ?? 'Sistema' },
    { when: 'há 3d', action: `Movida para ${statusLabel}`, by: item.assignee?.name ?? '—' },
  ]

  // When editing, render the full WorkItemDetail in drawer mode
  if (editing) {
    return (
      <WorkItemDetail
        mode="drawer"
        data={wid}
        onClose={() => setEditing(false)}
        onUpdate={updated => {
          setWid(updated)
          // Sync tags back to item shape (best-effort — WorkItem is a dashboard view type)
          item.title       = updated.title
          item.priority    = updated.priority as WorkItem['priority']
          item.assignee    = updated.assigneeInitials
            ? { initials: updated.assigneeInitials, name: updated.assigneeName ?? updated.assigneeInitials, color: '#3B82F6' }
            : item.assignee
          item.points      = updated.points
          item.description = updated.description
          item.due_date    = updated.dueDate
          item.tags        = updated.labels
        }}
      />
    )
  }

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: T.bgOverlay, zIndex: 900 }} />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: T.bgSurface, borderLeft: `1px solid ${T.border}`,
        boxShadow: T.shadowModal, zIndex: 901, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: T.text3 }}>{item.key}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: statusColor,
            background: `${statusColor}18`, border: `1px solid ${statusColor}33`,
            borderRadius: 4, padding: '2px 7px',
          }}>{statusLabel}</span>
          <div style={{ flex: 1 }} />
          {onNav && (
            <button onClick={() => onNav('issue', item.id)} style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
              Abrir no projeto →
            </button>
          )}
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, background: 'none', cursor: 'pointer', color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text1, margin: 0, marginBottom: 14, lineHeight: 1.4 }}>{wid.title}</h2>
          {/* Metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 16 }}>
            {[
              { label: 'Responsável', value: (wid.assigneeName ?? wid.assigneeInitials) || '—' },
              { label: 'Reporter',    value: wid.reporterName ?? wid.reporterInitials ?? '—' },
              { label: 'Prioridade',  value: wid.priority.charAt(0).toUpperCase() + wid.priority.slice(1) },
              { label: 'Sprint',      value: wid.sprintName ?? '—' },
              { label: 'Estimativa',  value: wid.points ? `${wid.points}pt` : '—' },
              { label: 'Prazo',       value: wid.dueDate ?? '—' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 10, color: T.text3, marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: T.text1 }}>{m.value}</div>
              </div>
            ))}
          </div>
          {/* Tags */}
          {wid.labels && wid.labels.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
              {wid.labels.map(t => <ConditionalTag key={t} label={t} severity="neutral" />)}
            </div>
          )}
          {/* Description */}
          <div style={{ background: T.bgPage, borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Descrição</div>
            <p style={{ fontSize: 12, color: T.text2, lineHeight: 1.6, margin: 0 }}>
              {wid.description ?? 'Nenhuma descrição adicionada.'}
            </p>
          </div>
          {/* History */}
          <div style={{ fontSize: 11, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Histórico</div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 1, background: T.border }} />
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, paddingLeft: 20, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 3, top: 5, width: 7, height: 7, borderRadius: 99, background: T.accent, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: T.text1 }}>{h.action}</div>
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 1 }}>{h.by} · {h.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          {canEdit ? (
            <button
              onClick={() => setEditing(true)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', background: T.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Editar issue
            </button>
          ) : (
            <button
              disabled
              title="Requer permissão para editar (edit:workitem)"
              style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.text3, fontSize: 12, cursor: 'not-allowed' }}
            >
              Editar issue
            </button>
          )}
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'none', color: T.text2, fontSize: 12, cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────
export interface FilterState {
  project_id: string
  squad_id: string
  sprint: string
}

export function FilterBar({ filters, onChange, projects, squads, sprints }: {
  filters: FilterState
  onChange: (f: FilterState) => void
  projects: { id: string; name: string }[]
  squads:   { id: string; name: string }[]
  sprints:  string[]
}) {
  function sel(key: keyof FilterState, value: string) {
    const newVal = filters[key] === value ? '' : value
    onChange({ ...filters, [key]: newVal })
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      <span style={{ fontSize: 10, color: T.text3, marginRight: 2 }}>Filtrar:</span>
      {projects.map(p => (
        <button key={p.id} onClick={() => sel('project_id', p.id)} style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 5,
          border: `1px solid ${filters.project_id === p.id ? T.accent : T.border}`,
          background: filters.project_id === p.id ? `${T.accent}18` : 'transparent',
          color: filters.project_id === p.id ? T.accent : T.text2, cursor: 'pointer', transition: 'all 0.12s',
        }}>{p.name}</button>
      ))}
      {squads.map(s => (
        <button key={s.id} onClick={() => sel('squad_id', s.id)} style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 5,
          border: `1px solid ${filters.squad_id === s.id ? T.indigo : T.border}`,
          background: filters.squad_id === s.id ? `${T.indigo}18` : 'transparent',
          color: filters.squad_id === s.id ? T.indigo : T.text2, cursor: 'pointer', transition: 'all 0.12s',
        }}>{s.name}</button>
      ))}
      {sprints.map(sp => (
        <button key={sp} onClick={() => sel('sprint', sp)} style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 5,
          border: `1px solid ${filters.sprint === sp ? T.success : T.border}`,
          background: filters.sprint === sp ? `${T.success}18` : 'transparent',
          color: filters.sprint === sp ? T.success : T.text2, cursor: 'pointer', transition: 'all 0.12s',
        }}>{sp}</button>
      ))}
      {(filters.project_id || filters.squad_id || filters.sprint) && (
        <button onClick={() => onChange({ project_id: '', squad_id: '', sprint: '' })} style={{
          fontSize: 10, padding: '3px 8px', borderRadius: 5, border: `1px solid ${T.border}`,
          background: 'none', color: T.text3, cursor: 'pointer',
        }}>Limpar ✕</button>
      )}
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ message, action }: {
  message: string; action?: { label: string; onClick: () => void }
}) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 12px' }}>
      <div style={{ fontSize: 22, marginBottom: 6, opacity: 0.5 }}>○</div>
      <div style={{ fontSize: 12, color: T.text3 }}>{message}</div>
      {action && (
        <button onClick={action.onClick} style={{ marginTop: 10, fontSize: 11, color: T.accent, background: `${T.accent}14`, border: 'none', borderRadius: 5, padding: '4px 12px', cursor: 'pointer' }}>
          {action.label}
        </button>
      )}
    </div>
  )
}

// ─── LoadingState (skeleton) ──────────────────────────────────────────────────
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: 99, background: T.border, flexShrink: 0 }} />
          <div style={{ height: 10, borderRadius: 4, background: T.border, flex: 1, opacity: 1 - i * 0.2 }} />
          <div style={{ height: 10, borderRadius: 4, background: T.border, width: 40, opacity: 0.5 }} />
        </div>
      ))}
    </div>
  )
}

// ─── PermissionDeniedState ────────────────────────────────────────────────────
export function PermissionDeniedState({ resource }: { resource?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 12px' }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
      <div style={{ fontSize: 12, color: T.text3 }}>
        Sem permissão para ver {resource ?? 'este conteúdo'}.
      </div>
      <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>
        Contate o administrador do tenant.
      </div>
    </div>
  )
}

// ─── AuditFeed ────────────────────────────────────────────────────────────────
export interface AuditEntry {
  action: string; user: string; by: string; when: string; icon?: string
}
export function AuditFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <EmptyState message="Nenhuma atividade registrada." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 10, position: 'relative' }}>
          {i < entries.length - 1 && (
            <div style={{ position: 'absolute', left: 9, top: 18, bottom: 0, width: 1, background: T.border }} />
          )}
          <div style={{ width: 18, height: 18, borderRadius: 99, background: `${T.accent}20`, border: `1px solid ${T.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, flexShrink: 0, zIndex: 1 }}>
            {e.icon ?? '●'}
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.text1 }}>{e.action}</div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>
              {e.user !== e.by ? `Usuário: ${e.user} · ` : ''}{e.by} · {e.when}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── ActivityTimeline ─────────────────────────────────────────────────────────
export function ActivityTimeline({ events }: { events: { label: string; sub?: string; date: string; color?: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 8, height: 8, borderRadius: 99, background: e.color ?? T.accent, flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: T.text1 }}>{e.label}</div>
            {e.sub && <div style={{ fontSize: 10, color: T.text3, marginTop: 1 }}>{e.sub}</div>}
          </div>
          <div style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>{e.date}</div>
        </div>
      ))}
    </div>
  )
}

// ─── DashboardSwitcher ────────────────────────────────────────────────────────
export function DashboardSwitcher({ dashboards, active, onSwitch }: {
  dashboards: { dashboard_id: string; label: string }[]
  active: string
  onSwitch: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {dashboards.map(d => {
        const isActive = d.dashboard_id === active
        return (
          <button key={d.dashboard_id} onClick={() => onSwitch(d.dashboard_id)} style={{
            fontSize: 12, fontWeight: isActive ? 600 : 400,
            color: isActive ? T.accent : T.text2,
            background: isActive ? `${T.accent}18` : 'transparent',
            border: `1px solid ${isActive ? T.accent : T.border}`,
            borderRadius: 6, padding: '4px 12px', cursor: 'pointer', transition: 'all 0.15s',
          }}>{d.label}</button>
        )
      })}
    </div>
  )
}
