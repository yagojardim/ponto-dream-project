import { useState, useRef, useEffect, useMemo } from 'react'
import { useSession } from '@/data/SessionContext'
import {
  fetchTimelineData, projectColor, DB_STATUS_CFG,
  type TimelineData, type ProjectRow, type WorkItemRow,
} from '@/data/db/timeline'
import { fetchAssignedProjects } from '@/data/db/projects'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const MONTH_W = 60

interface GRow {
  id:         string
  name:       string
  isProject?: boolean
  color:      string
  /** Fractional month offset from the ruler origin. Null when the row has no dates. */
  start:      number | null
  end:        number | null
  pct?:       number
  projectId:  string
}

interface GProject {
  id:    string
  name:  string
  short: string
  color: string
}

interface MonthCell { key: string; label: string; year: number; month: number }

// ─── Date helpers ─────────────────────────────────────────────────────────────
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Absolute fractional month index (year*12 + month + day fraction). */
function absMonth(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth() + (d.getDate() - 1) / daysInMonth(d.getFullYear(), d.getMonth())
}

function shortName(name: string): string {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name
}

// ─── Gantt bar ────────────────────────────────────────────────────────────────
function GanttBar({ row }: { row: GRow }) {
  if (row.start === null || row.end === null) return null
  const left  = row.start * MONTH_W
  const width = Math.max((row.end - row.start) * MONTH_W, 4)
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 rounded flex items-center px-2 overflow-hidden"
      style={{
        left, width,
        height: row.isProject ? 24 : 16,
        background: row.color,
      }}
    >
      {row.pct !== undefined && width > 50 && (
        <span className="text-[10px] font-semibold text-white truncate">{row.pct}%</span>
      )}
    </div>
  )
}


// ─── Multi-select dropdown ────────────────────────────────────────────────────
interface ProjectDropdownProps {
  projects:  GProject[]
  selected:  Set<string>
  onChange:  (next: Set<string>) => void
}

function ProjectDropdown({ projects, selected, onChange }: ProjectDropdownProps) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const containerRef          = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const allSelected = selected.size === projects.length
  const filtered    = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  function toggleProject(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    if (next.size === 0) return // always keep at least one
    onChange(next)
  }

  function toggleAll() {
    onChange(allSelected ? new Set([projects[0].id]) : new Set(projects.map(p => p.id)))
  }

  // Button label
  let triggerLabel: string
  if (allSelected) {
    triggerLabel = `Todos os projetos (${projects.length})`
  } else if (selected.size === 1) {
    triggerLabel = projects.find(p => selected.has(p.id))?.short ?? '1 projeto'
  } else {
    triggerLabel = `${selected.size} projetos`
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', borderRadius: 8,
          background: open ? '#1e2d45' : '#111d30',
          border: `1px solid ${open ? '#2d4870' : '#1c2c45'}`,
          color: '#c8d4e8', fontSize: 12, cursor: 'pointer',
          transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}
      >
        {/* Color dots for selected */}
        <div style={{ display: 'flex', gap: 3 }}>
          {projects.filter(p => selected.has(p.id)).map(p => (
            <span key={p.id} style={{ width: 7, height: 7, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          ))}
        </div>
        <span>{triggerLabel}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: '#546278' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          background: '#0d1829', border: '1px solid #1c2c45', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 280, overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #162032' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0a1525', borderRadius: 7, border: '1px solid #1c2c45', padding: '5px 10px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#546278', flexShrink: 0 }}>
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M9 9l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar projeto…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#c8d4e8', fontSize: 12, width: '100%' }}
              />
            </div>
          </div>

          {/* Todos toggle */}
          <div
            onClick={toggleAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', cursor: 'pointer',
              borderBottom: '1px solid #162032',
              background: 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            <span style={{
              width: 14, height: 14, borderRadius: 4, flexShrink: 0,
              border: `1.5px solid ${allSelected ? '#4d82ff' : '#2d4060'}`,
              background: allSelected ? '#4d82ff' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {allSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            <span style={{ fontSize: 12, color: '#8a9ab8', fontWeight: 500 }}>Todos os projetos</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#3a4d65' }}>{projects.length}</span>
          </div>

          {/* Project list */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#3a4d65', textAlign: 'center' }}>Nenhum projeto encontrado</div>
            )}
            {filtered.map(p => {
              const checked = selected.has(p.id)
              return (
                <div
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', cursor: 'pointer',
                    borderBottom: '1px solid #0d1525',
                    background: 'transparent', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${checked ? p.color : '#2d4060'}`,
                    background: checked ? p.color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#c8d4e8', flex: 1 }}>{p.name}</span>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          {!allSelected && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid #162032', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { onChange(new Set(projects.map(p => p.id))); setOpen(false) }}
                style={{ fontSize: 11, color: '#4d82ff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Limpar filtro — mostrar todos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type LoadState = 'loading' | 'ready' | 'error'

const EMPTY_DATA: TimelineData = {
  projects: [], epics: [], sprints: [], workItems: [], features: [], dependencies: [], profiles: [],
}

export default function GanttPage() {
  const { activeUser } = useSession()
  const tenantId  = activeUser.tenant_id
  const profileId = activeUser.user_id
  const permKey   = useMemo(
    () => (Array.isArray(activeUser.permissions) ? activeUser.permissions : []).join(','),
    [activeUser.permissions],
  )

  const [data, setData]       = useState<TimelineData>(EMPTY_DATA)
  const [state, setState]     = useState<LoadState>('loading')
  const [allowedIds, setAllowedIds] = useState<string[] | null>(null)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [selectedProjects,  setSelectedProjects]  = useState<Set<string> | null>(null)

  useEffect(() => {
    let alive = true
    setState('loading')
    async function load() {
      try {
        const [timeline, assigned] = await Promise.all([
          fetchTimelineData(),
          fetchAssignedProjects({
            tenantId, profileId,
            permissions: permKey ? permKey.split(',') : [],
          }),
        ])
        if (!alive) return
        setData(timeline)
        setAllowedIds(assigned.map(p => p.id))
        setState('ready')
      } catch {
        if (!alive) return
        setData(EMPTY_DATA)
        setAllowedIds([])
        setState('error')
      }
    }
    void load()
    return () => { alive = false }
  }, [tenantId, profileId, permKey])

  // Projects the profile may see, in the same order returned by the timeline read.
  const projects: GProject[] = useMemo(() => {
    const allow = new Set(allowedIds ?? [])
    return data.projects
      .filter(p => allow.has(p.id))
      .map((p, i) => ({
        id: p.id,
        name: p.name,
        short: shortName(p.name),
        color: projectColor(p as ProjectRow, i),
      }))
  }, [data.projects, allowedIds])

  // Default selection = every allowed project.
  useEffect(() => {
    setSelectedProjects(prev => {
      if (prev && [...prev].every(id => projects.some(p => p.id === id)) && prev.size > 0) return prev
      return new Set(projects.map(p => p.id))
    })
  }, [projects])

  const selected = selectedProjects ?? new Set(projects.map(p => p.id))

  // ── Build ruler + rows ──────────────────────────────────────────────────────
  const { months, rows, todayOffset } = useMemo(() => {
    const visibleProjects = projects.filter(p => selected.has(p.id))
    const byProject = new Map<string, WorkItemRow[]>()
    for (const item of data.workItems) {
      if (!item.project_id || !selected.has(item.project_id)) continue
      const list = byProject.get(item.project_id) ?? []
      list.push(item)
      byProject.set(item.project_id, list)
    }

    interface Span { start: Date | null; end: Date | null }
    const projectSpan = new Map<string, Span>()
    const itemSpan    = new Map<string, Span>()
    const dates: Date[] = []

    for (const p of visibleProjects) {
      const raw = data.projects.find(x => x.id === p.id)
      let start = parseDate(raw?.period_start)
      let end   = parseDate(raw?.period_end)
      const items = byProject.get(p.id) ?? []

      for (const it of items) {
        const s = parseDate(it.start_date)
        const e = parseDate(it.due_date)
        const from = s ?? e
        const to   = e ?? s
        if (from && to) itemSpan.set(it.id, { start: from, end: to })
        else itemSpan.set(it.id, { start: null, end: null })
        if (from) dates.push(from)
        if (to) dates.push(to)
      }

      if (!start || !end) {
        const spans = items.map(it => itemSpan.get(it.id)).filter((s): s is Span => !!s && !!s.start && !!s.end)
        if (spans.length > 0) {
          const min = spans.reduce((a, b) => (b.start! < a ? b.start! : a), spans[0].start!)
          const max = spans.reduce((a, b) => (b.end! > a ? b.end! : a), spans[0].end!)
          start = start ?? min
          end   = end ?? max
        }
      }
      projectSpan.set(p.id, { start, end })
      if (start) dates.push(start)
      if (end) dates.push(end)
    }

    const today = new Date()
    dates.push(today)

    if (dates.length === 0) {
      return { months: [] as MonthCell[], rows: [] as GRow[], todayOffset: 0 }
    }

    const minDate = dates.reduce((a, b) => (b < a ? b : a), dates[0])
    const maxDate = dates.reduce((a, b) => (b > a ? b : a), dates[0])
    const originAbs = minDate.getFullYear() * 12 + minDate.getMonth()
    const lastAbs   = maxDate.getFullYear() * 12 + maxDate.getMonth()
    const count     = Math.max(1, lastAbs - originAbs + 1)

    const monthCells: MonthCell[] = Array.from({ length: count }, (_, i) => {
      const abs   = originAbs + i
      const year  = Math.floor(abs / 12)
      const month = abs % 12
      return { key: `${year}-${month}`, label: MONTH_ABBR[month], year, month }
    })

    const offset = (d: Date | null): number | null => (d ? absMonth(d) - originAbs : null)

    const built: GRow[] = []
    for (const p of visibleProjects) {
      const span  = projectSpan.get(p.id)
      const items = byProject.get(p.id) ?? []
      const done  = items.filter(it => it.status === 'done').length
      built.push({
        id: p.id, projectId: p.id, name: p.name, isProject: true, color: p.color,
        start: offset(span?.start ?? null),
        end: offset(span?.end ?? null),
        pct: items.length > 0 ? Math.round((done / items.length) * 100) : undefined,
      })
      if (collapsedProjects.has(p.id)) continue
      for (const it of items) {
        const s = itemSpan.get(it.id)
        const startOff = offset(s?.start ?? null)
        const endOff   = offset(s?.end ?? null)
        built.push({
          id: it.id, projectId: p.id,
          name: it.key ? `${it.key} · ${it.title}` : it.title,
          color: DB_STATUS_CFG[it.status]?.color ?? p.color,
          start: startOff,
          end: endOff === null ? null : Math.max(endOff, (startOff ?? endOff) + 0.08),
        })
      }
    }

    return { months: monthCells, rows: built, todayOffset: absMonth(today) - originAbs }
  }, [projects, selected, data.projects, data.workItems, collapsedProjects])

  function toggleProject(id: string) {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const visibleProjects = projects.filter(p => selected.has(p.id))
  const totalW = Math.max(months.length, 1) * MONTH_W
  const todayMonthIdx = months.findIndex(m => m.year === new Date().getFullYear() && m.month === new Date().getMonth())
  const todayLabel = `${MONTH_ABBR[new Date().getMonth()].charAt(0)}${MONTH_ABBR[new Date().getMonth()].slice(1).toLowerCase()} ${new Date().getFullYear()}`

  // Quarter bands above the month ruler (calendar quarters).
  const quarters = useMemo(() => {
    const nowY = new Date().getFullYear()
    const nowQ = Math.floor(new Date().getMonth() / 3) + 1
    const out: { key: string; label: string; span: number; current: boolean }[] = []
    months.forEach(m => {
      const q = Math.floor(m.month / 3) + 1
      const key = `${m.year}-Q${q}`
      const last = out[out.length - 1]
      if (last && last.key === key) last.span += 1
      else out.push({ key, label: `Q${q} ${m.year}`, span: 1, current: m.year === nowY && q === nowQ })
    })
    return out
  }, [months])

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#080f1c' }}>
      {/* Sub-header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0 gap-4"
        style={{ borderBottom: '1px solid #162032' }}
      >
        {/* Left: legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {visibleProjects.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: '#546278' }}>
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: p.color }} />
              {p.short}
            </div>
          ))}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {projects.length > 0 && (
            <ProjectDropdown
              projects={projects}
              selected={selected}
              onChange={setSelectedProjects}
            />
          )}
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#546278' }}>
            <span style={{ display: 'inline-block', width: 20, borderTop: '1px dashed #F0455A', opacity: 0.7 }} />
            Hoje ({todayLabel})
          </div>
        </div>
      </div>

      {/* Scrollable gantt body */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: 200 + totalW }}>
          {/* Quarter + month headers */}
          <div className="sticky top-0 z-10" style={{ background: '#0a1525', borderBottom: '1px solid #162032' }}>
            {/* Quarter band */}
            <div className="flex" style={{ borderBottom: '1px solid #162032' }}>
              <div className="flex-shrink-0" style={{ width: 200, borderRight: '1px solid #162032' }} />
              <div className="flex" style={{ width: totalW }}>
                {quarters.map((q, i) => (
                  <div
                    key={q.key}
                    className="flex-shrink-0 text-center py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      width: q.span * MONTH_W,
                      color: q.current ? '#4d82ff' : '#546278',
                      borderRight: '1px solid #162032',
                      background: i % 2 === 0 ? 'rgba(77,130,255,0.04)' : 'transparent',
                    }}
                  >
                    {q.label}
                  </div>
                ))}
              </div>
            </div>
            {/* Month row */}
            <div className="flex">
              <div
                className="flex-shrink-0 flex items-center px-4 py-2.5"
                style={{ width: 200, borderRight: '1px solid #162032' }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#3a4d65' }}>
                  Tarefa / Projeto
                </span>
              </div>
              <div className="flex relative" style={{ width: totalW }}>
                {months.map((m, i) => (
                  <div
                    key={m.key}
                    className="flex-shrink-0 text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ width: MONTH_W, color: i === todayMonthIdx ? '#4d82ff' : '#3a4d65', borderRight: '1px solid #162032' }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* States */}
          {state === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#3a4d65', fontSize: 13 }}>
              Carregando dados do Gantt…
            </div>
          )}
          {state === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#F0455A', fontSize: 13 }}>
              Não foi possível carregar o Gantt agora.
            </div>
          )}
          {state === 'ready' && rows.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#3a4d65', fontSize: 13 }}>
              Nenhum projeto disponível para exibir
            </div>
          )}

          {/* Rows */}
          {rows.map((row, i) => {
            const isProj = row.isProject
            const isCollapsed = isProj && collapsedProjects.has(row.id)

            return (
              <div
                key={row.id}
                className="flex items-center transition-colors"
                style={{
                  height: isProj ? 40 : 32,
                  borderBottom: '1px solid #0d1a2d',
                  background: isProj ? (i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent') : 'transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isProj ? (i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent') : 'transparent' }}
              >
                {/* Label */}
                <div
                  className="flex-shrink-0 flex items-center gap-2 px-4"
                  style={{ width: 200, borderRight: '1px solid #162032', height: '100%' }}
                >
                  {isProj ? (
                    <>
                      <button
                        onClick={() => toggleProject(row.id)}
                        className="w-4 h-4 flex items-center justify-center flex-shrink-0 transition-transform"
                        style={{ color: '#3a4d65', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                        aria-label={isCollapsed ? 'Expandir' : 'Ocultar'}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M2 1.5L5.5 4L2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: row.color }} />
                      <span className="text-xs font-semibold truncate" style={{ color: '#c8d4e8' }}>{row.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="flex-shrink-0" style={{ width: 16 }} />
                      <span className="w-1 h-1 rounded-full flex-shrink-0 ml-2" style={{ background: row.color, opacity: 0.6 }} />
                      <span className="text-xs truncate ml-1" style={{ color: '#546278' }}>{row.name}</span>
                    </>
                  )}
                </div>

                {/* Bar area */}
                <div className="relative flex-1" style={{ height: '100%', width: totalW }}>
                  {months.map((m, mi) => (
                    <div
                      key={m.key}
                      className="absolute top-0 bottom-0"
                      style={{
                        left: mi * MONTH_W, width: MONTH_W,
                        borderRight: '1px solid #0d1a2d',
                        background: mi === todayMonthIdx ? 'rgba(77,130,255,0.03)' : 'transparent',
                      }}
                    />
                  ))}
                  <div
                    className="absolute top-0 bottom-0 z-10"
                    style={{ left: todayOffset * MONTH_W, width: 1, background: '#F0455A', opacity: 0.8 }}
                  />
                  <GanttBar row={row} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

