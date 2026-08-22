import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { T } from '../components/ds/tokens'
import {
  fetchTimelineData, updateWorkItemDates, projectColor, epicColor, DB_STATUS_CFG,
  type TimelineData, type WorkItemRow,
} from '../data/db/timeline'
import { getUserPref, saveUserPref } from '../data/db/userPrefs'
import { useSession } from '../data/SessionContext'

const ROW_H = 52
const HEADER_H = 48
const MS_DAY = 86_400_000
const PREF_KEY = 'timeline.view'

// ─── Zoom ─────────────────────────────────────────────────────────────────────
type Zoom = 'week' | 'month' | 'quarter'
const ZOOM_PX: Record<Zoom, number> = { week: 28, month: 9, quarter: 3.4 }
const ZOOM_LABEL: Record<Zoom, string> = { week: 'Semana', month: 'Mês', quarter: 'Quarter' }

type GroupBy = 'project-epic' | 'sprint' | 'assignee' | 'epic'
const GROUP_LABEL: Record<GroupBy, string> = {
  'project-epic': 'Projeto → Épico',
  sprint: 'Sprint',
  assignee: 'Responsável',
  epic: 'Épico',
}

interface Filters {
  status: string
  type: string
  assignee: string
  sprint: string
  epic: string
}
const EMPTY_FILTERS: Filters = { status: '', type: '', assignee: '', sprint: '', epic: '' }

interface TimelinePrefs {
  zoom: Zoom
  groupBy: GroupBy
  filters: Filters
  collapsed: string[]
  projects: string[]
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
function toIso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(iso: string, n: number): string {
  const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d)
}
function diffDays(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / MS_DAY)
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = toDate(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function monthLabel(iso: string): string {
  const d = toDate(iso)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

interface Span { start: string; end: string }

// ─── Project multi-select dropdown ───────────────────────────────────────────
interface ProjectOption { id: string; label: string; color: string }

function ProjectDropdown({
  options, selected, onChange,
}: { options: ProjectOption[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const allSelected = options.length > 0 && selected.size === options.length
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) {
      if (next.size === 1) return // keep at least one
      next.delete(id)
    } else {
      next.add(id)
    }
    onChange(next)
  }

  function toggleAll() {
    if (options.length === 0) return
    onChange(allSelected ? new Set([options[0].id]) : new Set(options.map(o => o.id)))
  }

  const label = allSelected
    ? `Todos (${options.length})`
    : selected.size === 1
      ? (options.find(o => selected.has(o.id))?.label ?? '1 projeto')
      : `${selected.size} projetos`

  const chkSt = (checked: boolean, color: string): React.CSSProperties => ({
    width: 14, height: 14, borderRadius: 4, flexShrink: 0,
    border: `1.5px solid ${checked ? color : T.border2}`,
    background: checked ? color : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  })

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
          background: open ? T.bgSurface2 : T.bgPage,
          border: `1px solid ${open ? T.accent : T.border}`,
          color: T.text2, fontSize: 12, transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', gap: 3 }}>
          {options.filter(o => selected.has(o.id)).slice(0, 6).map(o => (
            <span key={o.id} style={{ width: 7, height: 7, borderRadius: 2, background: o.color }} />
          ))}
        </div>
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: T.text3 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
          boxShadow: T.shadowModal, minWidth: 260, overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '9px 11px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: T.bgPage, borderRadius: 7, border: `1px solid ${T.border}`, padding: '5px 9px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: T.text3 }}>
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M9 9l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar projeto…"
                style={{ background: 'none', border: 'none', outline: 'none', color: T.text1, fontSize: 12, width: '100%' }} />
            </div>
          </div>

          {/* All toggle */}
          <div onClick={toggleAll}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.bgSurface2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
            <span style={chkSt(allSelected, T.accent)}>
              {allSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            <span style={{ fontSize: 12, color: T.text2, fontWeight: 500 }}>Todos os projetos</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: T.text3 }}>{options.length}</span>
          </div>

          {/* Options */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.map(o => {
              const checked = selected.has(o.id)
              return (
                <div key={o.id} onClick={() => toggle(o.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.bgSurface2 }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                  <span style={chkSt(checked, o.color)}>
                    {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: o.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.text1, flex: 1 }}>{o.label}</span>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '12px 13px', fontSize: 12, color: T.text3, textAlign: 'center' }}>Nenhum resultado</div>
            )}
          </div>

          {!allSelected && options.length > 0 && (
            <div style={{ padding: '8px 13px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { onChange(new Set(options.map(o => o.id))); setOpen(false) }}
                style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
                Limpar — mostrar todos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Small native-select filter ───────────────────────────────────────────────
function FilterSelect({
  label, value, options, onChange,
}: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const active = value !== ''
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      title={label}
      style={{
        height: 28, padding: '0 8px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        background: active ? T.accentDim : T.bgPage,
        border: `1px solid ${active ? T.accent : T.border}`,
        color: active ? T.accent : T.text2, outline: 'none', maxWidth: 170,
      }}
    >
      <option value="">{label}: todos</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TimelineSkeleton() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 160, height: 14, borderRadius: 5, background: T.bgSurface2, opacity: 0.9 }} />
          <div style={{
            height: 22, borderRadius: 6, background: T.bgSurface2,
            width: `${25 + ((i * 37) % 50)}%`, marginLeft: `${(i * 23) % 25}%`,
            animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.08}s`,
          }} />
        </div>
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }`}</style>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type Row =
  | { kind: 'group'; id: string; level: 0 | 1; label: string; color: string; count: number }
  | { kind: 'item'; id: string; item: WorkItemRow; color: string }

export default function TimelinePage() {
  const { activeUser } = useSession()
  const profileId = activeUser?.user_id ?? ''

  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [spans, setSpans] = useState<Record<string, Span>>({})
  const [selectedProjects, setSelectedProjects] = useState<Set<string> | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; startX: number; orig: Span } | null>(null)
  const [saving, setSaving] = useState<Set<string>>(new Set())

  // Scroll-sync + resizable sidebar refs/state
  const leftBodyRef = useRef<HTMLDivElement>(null)
  const rightBodyRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)
  const [sidebarWidth, setSidebarWidth] = useState(470)

  // View preferences (persisted in the database, per user)

  const [zoom, setZoom] = useState<Zoom>('month')
  const [groupBy, setGroupBy] = useState<GroupBy>('project-epic')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [prefsReady, setPrefsReady] = useState(false)

  const DAY_PX = ZOOM_PX[zoom]

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) { setLoading(false); setError('Tempo esgotado ao consultar o Supabase.') }
    }, 12_000)

    fetchTimelineData()
      .then(d => {
        if (cancelled) return
        setData(d)
        setSpans(buildSpans(d))
        setSelectedProjects(prev => prev ?? new Set(d.projects.map(p => p.id)))
        setError(null)
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) { clearTimeout(timer); setLoading(false) } })

    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  // ── Load saved preferences (database) ───────────────────────────────────────
  useEffect(() => {
    if (!profileId) { setPrefsReady(true); return }
    let cancelled = false
    void getUserPref<Partial<TimelinePrefs>>(profileId, PREF_KEY).then(p => {
      if (cancelled) return
      if (p) {
        if (p.zoom && p.zoom in ZOOM_PX) setZoom(p.zoom)
        if (p.groupBy && p.groupBy in GROUP_LABEL) setGroupBy(p.groupBy)
        if (p.filters) setFilters({ ...EMPTY_FILTERS, ...p.filters })
        if (Array.isArray(p.collapsed)) setCollapsed(new Set(p.collapsed))
        if (Array.isArray(p.projects) && p.projects.length > 0) setSelectedProjects(new Set(p.projects))
      }
      setPrefsReady(true)
    })
    return () => { cancelled = true }
  }, [profileId])

  // ── Persist preferences (database, debounced) ───────────────────────────────
  useEffect(() => {
    if (!prefsReady || !profileId) return
    const payload: TimelinePrefs = {
      zoom, groupBy, filters,
      collapsed: [...collapsed],
      projects: selectedProjects ? [...selectedProjects] : [],
    }
    const t = setTimeout(() => { void saveUserPref(profileId, PREF_KEY, payload) }, 500)
    return () => clearTimeout(t)
  }, [prefsReady, profileId, zoom, groupBy, filters, collapsed, selectedProjects])

  /** Derives each item's span: own dates → sprint dates → project period. */
  function buildSpans(d: TimelineData): Record<string, Span> {
    const sprintById = new Map(d.sprints.map(s => [s.id, s]))
    const projectById = new Map(d.projects.map(p => [p.id, p]))
    const out: Record<string, Span> = {}
    d.workItems.forEach(wi => {
      const sprint = wi.sprint_id ? sprintById.get(wi.sprint_id) : null
      const project = projectById.get(wi.project_id)
      const end = wi.due_date ?? sprint?.end_date ?? project?.period_end ?? null
      const start = wi.start_date ?? sprint?.start_date ?? (end ? addDays(end, -5) : project?.period_start ?? null)
      if (!start || !end) return
      out[wi.id] = { start, end: diffDays(start, end) < 1 ? addDays(start, 1) : end }
    })
    return out
  }

  const projectOptions: ProjectOption[] = useMemo(
    () => (data?.projects ?? []).map((p, i) => ({ id: p.id, label: p.name, color: projectColor(p, i) })),
    [data],
  )
  const projectColorById = useMemo(
    () => new Map(projectOptions.map(o => [o.id, o.color])),
    [projectOptions],
  )
  const profileById = useMemo(
    () => new Map((data?.profiles ?? []).map(p => [p.id, p])),
    [data],
  )
  const epicById = useMemo(() => new Map((data?.epics ?? []).map(e => [e.id, e])), [data])
  const sprintById = useMemo(() => new Map((data?.sprints ?? []).map(s => [s.id, s])), [data])

  // ── Filter options (always derived from real data) ──────────────────────────
  const statusOptions = useMemo(() => {
    const set = new Set((data?.workItems ?? []).map(w => w.status).filter(Boolean) as string[])
    return [...set].map(s => ({ value: s, label: DB_STATUS_CFG[s]?.label ?? s }))
  }, [data])
  const typeOptions = useMemo(() => {
    const set = new Set((data?.workItems ?? []).map(w => w.type).filter(Boolean) as string[])
    return [...set].map(t => ({ value: t, label: t }))
  }, [data])
  const assigneeOptions = useMemo(() => {
    const ids = new Set((data?.workItems ?? []).map(w => w.assignee_id).filter(Boolean) as string[])
    const out = [...ids].map(id => ({ value: id, label: profileById.get(id)?.name ?? 'Sem nome' }))
    out.push({ value: '__none', label: 'Sem responsável' })
    return out
  }, [data, profileById])
  const sprintOptions = useMemo(() => {
    const out = (data?.sprints ?? []).map(s => ({ value: s.id, label: s.name }))
    out.push({ value: '__none', label: 'Sem sprint' })
    return out
  }, [data])
  const epicOptions = useMemo(() => {
    const out = (data?.epics ?? []).map(e => ({ value: e.id, label: e.name }))
    out.push({ value: '__none', label: 'Sem épico' })
    return out
  }, [data])

  // ── Filtered items ──────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!data || !selectedProjects) return []
    return data.workItems.filter(w => {
      if (!spans[w.id]) return false
      if (!selectedProjects.has(w.project_id)) return false
      if (filters.status && w.status !== filters.status) return false
      if (filters.type && w.type !== filters.type) return false
      if (filters.assignee) {
        if (filters.assignee === '__none' ? !!w.assignee_id : w.assignee_id !== filters.assignee) return false
      }
      if (filters.sprint) {
        if (filters.sprint === '__none' ? !!w.sprint_id : w.sprint_id !== filters.sprint) return false
      }
      if (filters.epic) {
        if (filters.epic === '__none' ? !!w.epic_id : w.epic_id !== filters.epic) return false
      }
      return true
    })
  }, [data, selectedProjects, spans, filters])

  const toggleGroup = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // ── Row building per grouping mode ──────────────────────────────────────────
  const rows: Row[] = useMemo(() => {
    if (!data) return []
    const out: Row[] = []

    if (groupBy === 'project-epic') {
      data.projects.forEach(project => {
        const items = filteredItems.filter(w => w.project_id === project.id)
        if (items.length === 0) return
        const color = projectColorById.get(project.id) ?? T.accent
        const pKey = `project:${project.id}`
        out.push({ kind: 'group', id: pKey, level: 0, label: project.name, color, count: items.length })
        if (collapsed.has(pKey)) return

        const epics = data.epics.filter(e => e.project_id === project.id)
        epics.forEach(epic => {
          const epicItems = items.filter(i => i.epic_id === epic.id)
          if (epicItems.length === 0) return
          const ec = epicColor(epic.color)
          const eKey = `project:${project.id}:epic:${epic.id}`
          out.push({ kind: 'group', id: eKey, level: 1, label: epic.name, color: ec, count: epicItems.length })
          if (collapsed.has(eKey)) return
          epicItems.forEach(item => out.push({ kind: 'item', id: item.id, item, color: ec }))
        })

        const orphans = items.filter(i => !i.epic_id || !epics.some(e => e.id === i.epic_id))
        if (orphans.length > 0) {
          const oKey = `project:${project.id}:epic:__none`
          out.push({ kind: 'group', id: oKey, level: 1, label: 'Sem épico', color: T.text3, count: orphans.length })
          if (!collapsed.has(oKey)) orphans.forEach(item => out.push({ kind: 'item', id: item.id, item, color: T.text3 }))
        }
      })
      return out
    }

    // Flat groupings
    const buckets = new Map<string, { label: string; color: string; items: WorkItemRow[] }>()
    const ensure = (key: string, label: string, color: string) => {
      let b = buckets.get(key)
      if (!b) { b = { label, color, items: [] }; buckets.set(key, b) }
      return b
    }

    filteredItems.forEach(item => {
      if (groupBy === 'sprint') {
        const s = item.sprint_id ? sprintById.get(item.sprint_id) : null
        const key = `sprint:${s?.id ?? '__none'}`
        ensure(key, s?.name ?? 'Sem sprint', s ? T.accent : T.text3).items.push(item)
      } else if (groupBy === 'assignee') {
        const p = item.assignee_id ? profileById.get(item.assignee_id) : null
        const key = `assignee:${p?.id ?? '__none'}`
        ensure(key, p?.name ?? 'Sem responsável', p?.avatar_color ?? T.text3).items.push(item)
      } else {
        const e = item.epic_id ? epicById.get(item.epic_id) : null
        const key = `epic:${e?.id ?? '__none'}`
        ensure(key, e?.name ?? 'Sem épico', e ? epicColor(e.color) : T.text3).items.push(item)
      }
    })

    ;[...buckets.entries()]
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .forEach(([key, b]) => {
        out.push({ kind: 'group', id: key, level: 0, label: b.label, color: b.color, count: b.items.length })
        if (collapsed.has(key)) return
        b.items.forEach(item => out.push({ kind: 'item', id: item.id, item, color: b.color }))
      })

    return out
  }, [data, filteredItems, groupBy, collapsed, projectColorById, epicById, sprintById, profileById])

  const rowIndexById = useMemo(() => {
    const m: Record<string, number> = {}
    rows.forEach((r, i) => { if (r.kind === 'item') m[r.id] = i })
    return m
  }, [rows])

  const visibleItems = rows.filter(r => r.kind === 'item') as Extract<Row, { kind: 'item' }>[]

  // ── Time domain: starts at the PROJECT start (period_start → created_at) ────
  const { domainStart, totalDays } = useMemo(() => {
    const all = filteredItems.map(r => spans[r.id]).filter(Boolean)
    const projectStarts = (data?.projects ?? [])
      .filter(p => !selectedProjects || selectedProjects.has(p.id))
      .map(p => (p.period_start ?? p.created_at ?? null))
      .filter((v): v is string => !!v)
      .map(v => v.slice(0, 10))
    const projectEnds = (data?.projects ?? [])
      .filter(p => !selectedProjects || selectedProjects.has(p.id))
      .map(p => p.period_end ?? null)
      .filter((v): v is string => !!v)
      .map(v => v.slice(0, 10))
    const starts = [...projectStarts, ...all.map(s => s.start)]
    if (starts.length === 0) return { domainStart: toIso(new Date()), totalDays: 30 }
    const min = starts.reduce((a, b) => (b < a ? b : a))
    const today = toIso(new Date())
    const ends = [...all.map(s => s.end), ...projectEnds, today]
    const end = ends.reduce((a, b) => (b > a ? b : a))
    return { domainStart: min, totalDays: Math.max(30, diffDays(min, end) + 4) }
  }, [filteredItems, spans, data, selectedProjects])

  const todayIso = toIso(new Date())
  const todayIdx = diffDays(domainStart, todayIso)

  const barLeft = useCallback((iso: string) => diffDays(domainStart, iso) * DAY_PX, [domainStart, DAY_PX])
  const barWidth = useCallback((s: Span) => Math.max(DAY_PX * 1.5, diffDays(s.start, s.end) * DAY_PX), [DAY_PX])

  // Sprint markers for visible projects
  const sprintMarkers = useMemo(() => {
    if (!data || !selectedProjects) return []
    return data.sprints
      .filter(s => selectedProjects.has(s.project_id) && s.start_date)
      .map(s => ({ id: s.id, label: s.name, idx: diffDays(domainStart, s.start_date!) }))
      .filter(s => s.idx >= 0 && s.idx < totalDays)
  }, [data, selectedProjects, domainStart, totalDays])

  // ── Ruler ticks per zoom ────────────────────────────────────────────────────
  interface Tick { idx: number; label: string; sub: string }
  const ticks: Tick[] = useMemo(() => {
    const out: Tick[] = []
    if (zoom === 'week') {
      for (let i = 0; i < totalDays; i += 7) {
        const d = toDate(addDays(domainStart, i))
        out.push({
          idx: i,
          label: `Sem ${Math.floor(i / 7) + 1}`,
          sub: `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        })
      }
      return out
    }
    const start = toDate(domainStart)
    const endIso = addDays(domainStart, totalDays)
    if (zoom === 'month') {
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
      while (toIso(cursor) < endIso) {
        const idx = diffDays(domainStart, toIso(cursor))
        out.push({ idx: Math.max(0, idx), label: MONTHS[cursor.getUTCMonth()], sub: String(cursor.getUTCFullYear()) })
        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      }
      return out
    }
    const qMonth = Math.floor(start.getUTCMonth() / 3) * 3
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), qMonth, 1))
    while (toIso(cursor) < endIso) {
      const idx = diffDays(domainStart, toIso(cursor))
      out.push({
        idx: Math.max(0, idx),
        label: `Q${Math.floor(cursor.getUTCMonth() / 3) + 1}`,
        sub: String(cursor.getUTCFullYear()),
      })
      cursor.setUTCMonth(cursor.getUTCMonth() + 3)
    }
    return out
  }, [zoom, domainStart, totalDays])

  // ── Dependency curves — recomputed from spans + row map on every render ─────
  const curves = useMemo(() => {
    if (!data) return []
    return data.dependencies.map(dep => {
      const from = spans[dep.source_id], to = spans[dep.target_id]
      const fr = rowIndexById[dep.source_id], tr = rowIndexById[dep.target_id]
      if (!from || !to || fr == null || tr == null) return null // hidden when a side is filtered out
      const x1 = barLeft(from.start) + barWidth(from)
      const x2 = barLeft(to.start)
      const y1 = fr * ROW_H + ROW_H / 2
      const y2 = tr * ROW_H + ROW_H / 2
      return { key: `${dep.source_id}-${dep.target_id}`, x1, y1, x2, y2, cx: (x1 + x2) / 2 }
    }).filter(Boolean) as { key: string; x1: number; y1: number; x2: number; y2: number; cx: number }[]
  }, [data, spans, rowIndexById, barLeft, barWidth])

  // ── Drag → persist ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const span = spans[id]
    if (!span) return
    setDragging({ id, startX: e.clientX, orig: span })
  }, [spans])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dayDelta = Math.round((e.clientX - dragging.startX) / DAY_PX)
    setSpans(prev => {
      const next = { start: addDays(dragging.orig.start, dayDelta), end: addDays(dragging.orig.end, dayDelta) }
      const cur = prev[dragging.id]
      if (cur && cur.start === next.start && cur.end === next.end) return prev
      return { ...prev, [dragging.id]: next }
    })
  }, [dragging, DAY_PX])

  const onMouseUp = useCallback(() => {
    if (!dragging || !data) { setDragging(null); return }
    const { id, orig } = dragging
    setDragging(null)
    const span = spans[id]
    if (!span || (span.start === orig.start && span.end === orig.end)) return
    const item = data.workItems.find(w => w.id === id)
    if (!item) return

    setSaving(s => new Set(s).add(id))
    updateWorkItemDates(item, span.start, span.end)
      .then(() => {
        setData(d => d && ({
          ...d,
          workItems: d.workItems.map(w => w.id === id ? { ...w, start_date: span.start, due_date: span.end } : w),
        }))
        setSaveError(null)
      })
      .catch((err: unknown) => {
        setSpans(prev => ({ ...prev, [id]: orig }))
        setSaveError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setSaving(s => { const n = new Set(s); n.delete(id); return n }))
  }, [dragging, spans, data])

  // ── Scroll sync between sidebar and grid ────────────────────────────────────
  function syncScroll(from: 'left' | 'right') {
    if (syncing.current) return
    const src = from === 'left' ? leftBodyRef.current : rightBodyRef.current
    const dst = from === 'left' ? rightBodyRef.current : leftBodyRef.current
    if (!src || !dst) return
    syncing.current = true
    dst.scrollTop = src.scrollTop
    requestAnimationFrame(() => { syncing.current = false })
  }

  // ── Resizable sidebar ───────────────────────────────────────────────────────
  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    function onMove(ev: MouseEvent) {
      const next = Math.min(800, Math.max(120, startW + (ev.clientX - startX)))
      setSidebarWidth(next)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const showMeta = sidebarWidth >= 420
  const showTitle = sidebarWidth >= 260

  const gridW = totalDays * DAY_PX

  const svgH = rows.length * ROW_H

  const rangeLabel = visibleItems.length > 0
    ? `${monthLabel(domainStart)} — ${monthLabel(addDays(domainStart, totalDays - 1))}`
    : 'Sem período'

  const sidebarTitle = groupBy === 'project-epic'
    ? 'PROJETO / ÉPICO / ISSUE'
    : `${GROUP_LABEL[groupBy].toUpperCase()} / ISSUE`

  const filtersActive = Object.values(filters).some(Boolean)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: T.bgPage, height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'inherit', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${T.border}`, background: T.bgSurface, flexShrink: 0 }}>
        <span style={{ color: T.text1, fontWeight: 700, fontSize: 15 }}>Roadmap — {rangeLabel}</span>
        <span style={{ color: T.text3, fontSize: 12 }}>Arraste as barras para reposicionar</span>
        {saving.size > 0 && <span style={{ color: T.accent, fontSize: 11 }}>salvando…</span>}
        {saveError && <span style={{ color: T.crit, fontSize: 11 }}>Falha ao salvar: {saveError}</span>}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Zoom toggle */}
          <div style={{ display: 'flex', border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {(['week', 'month', 'quarter'] as Zoom[]).map(z => (
              <button key={z} onClick={() => setZoom(z)}
                style={{
                  padding: '5px 11px', fontSize: 12, cursor: 'pointer', border: 'none',
                  background: zoom === z ? T.accent : T.bgPage,
                  color: zoom === z ? '#fff' : T.text2,
                }}>
                {ZOOM_LABEL[z]}
              </button>
            ))}
          </div>

          {selectedProjects && projectOptions.length > 0 && (
            <ProjectDropdown options={projectOptions} selected={selectedProjects} onChange={setSelectedProjects} />
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: `1px solid ${T.border}`, background: T.bgSurface, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: T.text3, fontWeight: 700 }}>AGRUPAR POR</span>
        <select
          value={groupBy}
          onChange={e => setGroupBy(e.target.value as GroupBy)}
          style={{
            height: 28, padding: '0 8px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            background: T.bgPage, border: `1px solid ${T.border}`, color: T.text1, outline: 'none',
          }}
        >
          {(Object.keys(GROUP_LABEL) as GroupBy[]).map(g => (
            <option key={g} value={g}>{GROUP_LABEL[g]}</option>
          ))}
        </select>

        <span style={{ width: 1, height: 20, background: T.border, margin: '0 4px' }} />

        <FilterSelect label="Status" value={filters.status} options={statusOptions} onChange={v => setFilters(f => ({ ...f, status: v }))} />
        <FilterSelect label="Tipo" value={filters.type} options={typeOptions} onChange={v => setFilters(f => ({ ...f, type: v }))} />
        <FilterSelect label="Responsável" value={filters.assignee} options={assigneeOptions} onChange={v => setFilters(f => ({ ...f, assignee: v }))} />
        <FilterSelect label="Sprint" value={filters.sprint} options={sprintOptions} onChange={v => setFilters(f => ({ ...f, sprint: v }))} />
        <FilterSelect label="Épico" value={filters.epic} options={epicOptions} onChange={v => setFilters(f => ({ ...f, epic: v }))} />

        {filtersActive && (
          <button onClick={() => setFilters(EMPTY_FILTERS)}
            style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
            Limpar filtros
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: T.text3, fontSize: 11 }}>{visibleItems.length} itens</span>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: T.accent, display: 'inline-block' }} />
          <span style={{ color: T.text3, fontSize: 11 }}>Em andamento</span>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: T.success, display: 'inline-block' }} />
          <span style={{ color: T.text3, fontSize: 11 }}>Concluído</span>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: T.crit, display: 'inline-block' }} />
          <span style={{ color: T.text3, fontSize: 11 }}>Bloqueado</span>
        </div>
      </div>

      {/* Loading */}
      {loading && <TimelineSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div style={{ margin: 20, padding: 16, borderRadius: 10, border: `1px solid ${T.crit}55`, background: T.critDim, color: T.text1, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: T.crit }}>Erro ao carregar a Timeline</div>
          <div style={{ color: T.text2 }}>{error}</div>
        </div>
      )}

      {/* Body */}
      {!loading && !error && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: sidebarWidth, flexShrink: 0, background: T.bgSurface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: HEADER_H, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0, gap: 0 }}>
              <span style={{ flex: 1, color: T.text3, fontSize: 10, fontWeight: 700 }}>{showTitle ? sidebarTitle : '#'}</span>
              {showMeta && (
                <>
                  <span style={{ width: 90, flexShrink: 0, color: T.text3, fontSize: 10, fontWeight: 700 }}>Status</span>
                  <span style={{ width: 66, flexShrink: 0, color: T.text3, fontSize: 10, fontWeight: 700 }}>Início</span>
                  <span style={{ width: 66, flexShrink: 0, color: T.text3, fontSize: 10, fontWeight: 700 }}>Venc.</span>
                </>
              )}
            </div>
            <div ref={leftBodyRef} onScroll={() => syncScroll('left')} style={{ flex: 1, overflowY: 'auto' }}>

              {rows.map(row => {
                if (row.kind === 'group') {
                  const isCollapsed = collapsed.has(row.id)
                  const top = row.level === 0
                  return (
                    <div key={`g-${row.id}`} onClick={() => toggleGroup(row.id)}
                      style={{
                        height: ROW_H, display: 'flex', alignItems: 'center', cursor: 'pointer',
                        padding: top ? '0 12px' : '0 12px 0 22px',
                        borderBottom: `1px solid ${T.border}`,
                        background: top ? `${row.color}14` : T.bgSurface2,
                        borderLeft: top ? `3px solid ${row.color}` : 'none',
                      }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                        style={{ marginRight: 6, flexShrink: 0, color: row.color, transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }}>
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {!top && <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0, marginRight: 7 }} />}
                      <span style={{
                        color: row.color, fontWeight: top ? 700 : 600, fontSize: 12,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: showTitle ? 1 : undefined,
                      }}>{row.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: T.text3 }}>{row.count}</span>
                    </div>
                  )
                }
                const wi = row.item
                const span = spans[row.id]
                const statusCfg = DB_STATUS_CFG[wi.status]
                const statusLabel = statusCfg?.label ?? wi.status
                const statusColor = statusCfg?.color ?? T.text3
                return (
                  <div key={`i-${row.id}`}
                    style={{ height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 12px 0 32px', borderBottom: `1px solid ${T.border}`, background: hovered === row.id ? T.bgSurface2 : T.bgSurface }}
                    onMouseEnter={() => setHovered(row.id)} onMouseLeave={() => setHovered(null)}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: T.accent, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{wi.key}</span>
                      {showTitle && (
                        <span style={{ color: T.text2, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={wi.title}>{wi.title}</span>
                      )}
                    </div>
                    {showMeta && (
                      <>
                        <div style={{ width: 90, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: `${statusColor}18`, color: statusColor }}>
                            {statusLabel}
                          </span>
                        </div>
                        <div style={{ width: 66, flexShrink: 0, fontSize: 10, color: T.text3 }}>{fmtDate(span?.start)}</div>
                        <div style={{ width: 66, flexShrink: 0, fontSize: 10, color: T.text3 }}>{fmtDate(span?.end)}</div>
                      </>
                    )}
                  </div>
                )
              })}
              {rows.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: T.text3, fontSize: 12, textAlign: 'center', padding: 12 }}>
                  Nenhum item no período
                </div>
              )}
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            style={{ width: 6, cursor: 'col-resize', flexShrink: 0, background: 'transparent',
              borderRight: `1px solid ${T.border}` }}
            onMouseEnter={e => (e.currentTarget.style.background = T.accent + '40')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          />

          {/* Timeline grid */}
          <div ref={rightBodyRef} onScroll={() => syncScroll('right')} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>

            {rows.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.text3, fontSize: 13 }}>
                Nenhum item no período
              </div>
            ) : (
              <div
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                style={{ width: gridW, minWidth: gridW, position: 'relative', userSelect: 'none' }}
              >
                {/* Time axis header */}
                <div style={{ height: HEADER_H, borderBottom: `1px solid ${T.border}`, position: 'relative', background: T.bgSurface }}>
                  {zoom === 'week' && Array.from({ length: totalDays }, (_, i) => i).map(i => {
                    const d = toDate(addDays(domainStart, i))
                    return (
                      <div key={i} style={{ position: 'absolute', left: i * DAY_PX, top: 0, width: DAY_PX, height: HEADER_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }}>
                        <span style={{ fontSize: 9, color: i === todayIdx ? T.accent : T.text3, fontWeight: i === todayIdx ? 700 : 400 }}>{d.getUTCDate()}</span>
                      </div>
                    )
                  })}
                  {ticks.map((t, ti) => {
                    const next = ticks[ti + 1]
                    const width = ((next ? next.idx : totalDays) - t.idx) * DAY_PX
                    return (
                      <div key={`${t.idx}-${t.label}`}
                        style={{
                          position: 'absolute', left: t.idx * DAY_PX, top: 2, width, paddingLeft: 4,
                          borderLeft: `1px solid ${T.border}`, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden',
                          background: zoom === 'quarter' && ti % 2 === 1 ? `${T.bgSurface2}` : 'transparent',
                        }}
                      >
                        <div style={{ fontSize: 10, color: T.text2, fontWeight: 700 }}>{t.label}</div>
                        <div style={{ fontSize: 9, color: T.text3 }}>{t.sub}</div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ position: 'relative', height: svgH }}>
                  {/* Vertical grid lines (per tick — evita milhares de nós nos zooms largos) */}
                  {ticks.map(t => (
                    <div key={`gl-${t.idx}-${t.label}`} style={{ position: 'absolute', left: t.idx * DAY_PX, top: 0, bottom: 0, width: 1, background: T.border, opacity: 0.4, zIndex: 1 }} />
                  ))}

                  {/* Sprint markers */}
                  {sprintMarkers.map(sm => (
                    <div key={sm.id} style={{ position: 'absolute', left: sm.idx * DAY_PX, top: 0, bottom: 0, width: 1, zIndex: 2 }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, borderLeft: `1.5px dashed ${T.accent}`, opacity: 0.4 }} />
                      {zoom !== 'quarter' && (
                        <div style={{ position: 'absolute', top: 4, left: 3, fontSize: 9, color: T.accent, background: T.bgPage, padding: '0 3px', borderRadius: 2, fontWeight: 700, opacity: 0.8, whiteSpace: 'nowrap' }}>{sm.label}</div>
                      )}
                    </div>
                  ))}

                  {/* Today marker */}
                  {todayIdx >= 0 && todayIdx < totalDays && (
                    <div style={{ position: 'absolute', left: todayIdx * DAY_PX, top: 0, bottom: 0, width: 2, background: T.accent, opacity: 0.7, zIndex: 4 }} />
                  )}

                  {/* Row stripes / group bands */}
                  {rows.map((row, i) => (
                    <div key={`r-${i}`} style={{
                      position: 'absolute', left: 0, right: 0, top: i * ROW_H, height: ROW_H,
                      borderBottom: `1px solid ${T.border}`,
                      background: row.kind === 'group'
                        ? (row.level === 0 ? `${row.color}14` : T.bgSurface2)
                        : i % 2 === 0 ? 'transparent' : `${T.bgSurface}44`,
                    }} />
                  ))}

                  {/* Bars */}
                  {visibleItems.map(row => {
                    const span = spans[row.id]
                    const rowAbs = rowIndexById[row.id]
                    if (!span || rowAbs == null) return null
                    const wi = row.item
                    const color = wi.is_blocked ? T.crit : (DB_STATUS_CFG[wi.status]?.color ?? T.text3)
                    const left = barLeft(span.start)
                    const width = barWidth(span)
                    const isDragging = dragging?.id === row.id
                    const isHov = hovered === row.id
                    const profile = wi.assignee_id ? profileById.get(wi.assignee_id) : null
                    const initials = profile?.avatar_initials ?? profile?.name?.slice(0, 1) ?? ''

                    return (
                      <div
                        key={row.id}
                        onMouseDown={e => onMouseDown(e, row.id)}
                        onMouseEnter={() => setHovered(row.id)}
                        onMouseLeave={() => setHovered(null)}
                        title={`${wi.key} — ${wi.title}\n${span.start} → ${span.end}`}
                        style={{
                          position: 'absolute',
                          top: rowAbs * ROW_H + 10,
                          left, width,
                          height: ROW_H - 20,
                          background: `${color}28`,
                          border: `1.5px solid ${color}`,
                          borderRadius: 5,
                          cursor: isDragging ? 'grabbing' : 'grab',
                          display: 'flex', alignItems: 'center', padding: '0 6px', gap: 4, overflow: 'hidden',
                          zIndex: isDragging ? 10 : 2,
                          opacity: saving.has(row.id) ? 0.6 : 1,
                          boxShadow: isDragging ? T.shadowModal : isHov ? '0 4px 18px rgba(0,0,0,0.4)' : 'none',
                          transform: isDragging ? 'scale(1.02)' : 'none',
                          transition: isDragging ? 'none' : 'box-shadow 0.15s, transform 0.15s',
                        }}
                      >
                        {width > 44 && <span style={{ fontSize: 9, fontWeight: 700, color, flexShrink: 0 }}>{wi.key}</span>}
                        {width > 140 && (
                          <span style={{ fontSize: 9, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {wi.title}
                          </span>
                        )}
                        {width > 180 && initials && (
                          <span style={{ fontSize: 8, fontWeight: 700, background: profile?.avatar_color ?? T.text3, color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {initials.slice(0, 2)}
                          </span>
                        )}
                      </div>
                    )
                  })}

                  {/* SVG dependency overlay — same positioned container as the bars */}
                  <svg
                    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 6, overflow: 'visible' }}
                    width={gridW}
                    height={svgH}
                  >
                    <defs>
                      <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L6,3 z" fill={T.accent} opacity={0.6} />
                      </marker>
                    </defs>
                    {curves.map(c => (
                      <path
                        key={c.key}
                        d={`M ${c.x1} ${c.y1} C ${c.cx} ${c.y1}, ${c.cx} ${c.y2}, ${c.x2} ${c.y2}`}
                        stroke={T.accent}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        fill="none"
                        opacity={0.45}
                        markerEnd="url(#dep-arrow)"
                      />
                    ))}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
