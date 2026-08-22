import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { takeReportNav } from '@/lib/reportNav'
import { T } from '../components/ds/tokens'
import { WorkItemDetail } from '../components/WorkItemDetail'
import { useSession } from '../data/SessionContext'
import { can } from '../data/permissions'
import {
  listWorkItems, epicColor, PRIORITY_FROM_DB, uiStatusFromDb,
  type ListItemRow, type ListEpicRow, type ListFeatureRow, type ListSprintRow,
  type ListProfileRow, type ListProjectRow, type ListLabelRow, type ListFilters,
} from '../data/db/list'
import { updateWorkItemField } from '../data/db/workItem'

type SortKey = 'key' | 'title' | 'status' | 'priority' | 'assignee' | 'points' | 'epic' | 'feature' | 'sprint' | 'dueDate'
type SortDir = 'asc' | 'desc'
type GroupBy = 'none' | 'sprint' | 'epic'

const ALL_COLS = ['key','type','title','status','priority','assignee','points','epic','feature','sprint','labels','dueDate'] as const
type ColId = typeof ALL_COLS[number]

const DEFAULT_COLS: ColId[] = ['key','type','title','status','priority','assignee','points']
const COL_LABELS: Record<ColId, string> = {
  key:'Key', type:'Tipo', title:'Título', status:'Status', priority:'Prioridade',
  assignee:'Responsável', points:'Pts', epic:'Épico', feature:'Funcionalidade', sprint:'Sprint', labels:'Labels', dueDate:'Venc.',
}

/** Keys are UI status values (same format used by rows and by the filters). */
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  backlog:       { label:'Backlog',      color:T.text3,   bg:T.neutralDim   },
  todo:          { label:'A Fazer',      color:T.text2,   bg:`${T.text3}18` },
  'in-progress': { label:'Em andamento', color:T.accent,  bg:T.accentDim    },
  'in-review':   { label:'Em revisão',   color:T.warn,    bg:T.warnDim      },
  blocked:       { label:'Bloqueado',    color:T.crit,    bg:T.critDim      },
  done:          { label:'Concluído',    color:T.success, bg:T.successDim   },
}

const PRIORITY_CFG: Record<string, { label: string; color: string; icon: string }> = {
  critical:{ label:'Crítica', color:T.crit,   icon:'↑↑' },
  high:    { label:'Alta',    color:T.warn,   icon:'↑'  },
  medium:  { label:'Média',   color:T.accent, icon:'→'  },
  low:     { label:'Baixa',   color:T.text3,  icon:'↓'  },
}

/** Keys are UI type values; rows are normalised to them via TYPE_FROM_DB. */
const TYPE_ICON: Record<string, { icon: string; color: string; label: string }> = {
  story:{icon:'◇',color:T.accent,label:'História'}, bug:{icon:'⬟',color:T.crit,label:'Bug'},
  task:{icon:'☑',color:T.text2,label:'Tarefa'}, subtask:{icon:'◻',color:T.text3,label:'Subtarefa'},
  epic:{icon:'⚡',color:T.warn,label:'Épico'}, feature:{icon:'▣',color:T.purple,label:'Funcionalidade'},
}

const TYPE_FROM_DB: Record<string, string> = {
  story:'story', user_story:'story', historia:'story', 'história':'story',
  bug:'bug', erro:'bug', defeito:'bug',
  task:'task', tarefa:'task',
  subtask:'subtask', sub_task:'subtask', subtarefa:'subtask',
  epic:'epic', epico:'epic', 'épico':'epic',
  feature:'feature', funcionalidade:'feature',
}

function uiType(t: string): string {
  return TYPE_FROM_DB[(t ?? '').toLowerCase()] ?? t
}

interface Row {
  id: string
  key: string
  type: string
  title: string
  status: string
  priority: string
  assigneeId: string | null
  assignee: string
  points: number
  epicId: string | null
  featureId: string | null
  sprintId: string | null
  labels: string[]
  dueDate: string
  blocked: boolean
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:22, height:22, borderRadius:'50%', fontSize:10, fontWeight:700,
      background: color, color:'#fff',
    }}>{initials}</span>
  )
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function buildRows(
  items: ListItemRow[],
  labels: ListLabelRow[],
  profiles: ListProfileRow[],
): Row[] {
  const byItem = new Map<string, string[]>()
  labels.forEach(l => {
    const list = byItem.get(l.work_item_id) ?? []
    list.push(l.name)
    byItem.set(l.work_item_id, list)
  })
  const profileById = new Map(profiles.map(p => [p.id, p]))
  return items.map(i => {
    const p = i.assignee_id ? profileById.get(i.assignee_id) : undefined
    return {
      id: i.id,
      key: i.key,
      type: uiType(i.type),
      title: i.title,
      // Normalise to the UI enums so display, filters and edits all speak the same language.
      status: uiStatusFromDb(i.status),
      priority: PRIORITY_FROM_DB[(i.priority ?? '').toLowerCase()] ?? 'medium',
      assigneeId: i.assignee_id,
      assignee: p?.avatar_initials ?? (p?.name.slice(0, 2).toUpperCase() ?? '—'),
      points: Number(i.story_points ?? 0),
      epicId: i.epic_id,
      featureId: i.feature_id,
      sprintId: i.sprint_id,
      labels: byItem.get(i.id) ?? [],
      dueDate: fmtDate(i.due_date),
      blocked: !!i.is_blocked,
    }
  })
}

export default function ListPage() {
  const { activeUser } = useSession()
  const canEdit = can(activeUser.permissions, 'edit:workitem')

  const [cols, setCols] = useState<ColId[]>(DEFAULT_COLS)
  const [colsOpen, setColsOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('key')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [search, setSearch] = useState('')
  const [editCell, setEditCell] = useState<{key:string;col:ColId}|null>(null)
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const colsRef = useRef<HTMLDivElement>(null)

  // Query filters applied server-side
  const [fProject, setFProject] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fPriority, setFPriority] = useState('')
  const [fType, setFType] = useState('')
  const [fAssignee, setFAssignee] = useState('')
  const [fSprint, setFSprint] = useState('')
  const [fEpic, setFEpic] = useState('')
  // Deep link from a report/KPI card: open the list already filtered.
  useEffect(() => {
    const intent = takeReportNav('list')
    if (!intent) return
    if (intent.itemType) setFType(uiType(intent.itemType))
    if (intent.itemStatus) setFStatus(uiStatusFromDb(intent.itemStatus))
  }, [])

  const [items, setItems] = useState<ListItemRow[]>([])
  const [labels, setLabels] = useState<ListLabelRow[]>([])
  const [epics, setEpics] = useState<ListEpicRow[]>([])
  const [sprints, setSprints] = useState<ListSprintRow[]>([])
  const [profiles, setProfiles] = useState<ListProfileRow[]>([])
  const [projects, setProjects] = useState<ListProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filters: ListFilters = useMemo(() => ({
    projectId: fProject || undefined,
    status: fStatus || undefined,
    priority: fPriority || undefined,
    type: fType || undefined,
    assigneeId: fAssignee || undefined,
    sprintId: fSprint || undefined,
    epicId: fEpic || undefined,
    search: search.trim() || undefined,
  }), [fProject, fStatus, fPriority, fType, fAssignee, fSprint, fEpic, search])

  const load = useCallback(async (f: ListFilters) => {
    setLoading(true)
    setError(null)
    try {
      const data = await listWorkItems(f)
      setItems(data.items)
      setLabels(data.labels)
      setEpics(data.epics)
      setSprints(data.sprints)
      setProfiles(data.profiles)
      setProjects(data.projects)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar as issues.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { void load(filters) }, 200)
    return () => clearTimeout(t)
  }, [filters, load])

  const rows = useMemo(() => buildRows(items, labels, profiles), [items, labels, profiles])

  const sorted = useMemo(() => {
    const epicName = (id: string | null) => epics.find(e => e.id === id)?.name ?? ''
    const sprintName = (id: string | null) => sprints.find(s => s.id === id)?.name ?? ''
    const val = (r: Row): string => {
      switch (sortKey) {
        case 'key': return r.key
        case 'title': return r.title
        case 'status': return r.status
        case 'priority': return r.priority
        case 'assignee': return r.assignee
        case 'points': return String(r.points).padStart(6, '0')
        case 'epic': return epicName(r.epicId)
        case 'sprint': return sprintName(r.sprintId)
        case 'dueDate': return r.dueDate
      }
    }
    return [...rows].sort((a, b) => sortDir === 'asc'
      ? val(a).localeCompare(val(b))
      : val(b).localeCompare(val(a)))
  }, [rows, sortKey, sortDir, epics, sprints])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function toggleCol(c: ColId) {
    setCols(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  const actorProfileId = profiles.find(p => p.name === activeUser.name)?.id ?? null

  /** Optimistic inline edit persisted to Supabase (audited). */
  async function persistField(
    row: Row,
    field: 'title' | 'status' | 'priority' | 'assignee_id',
    value: string | null,
    previous: string | null,
  ) {
    setItems(prev => prev.map(i => i.id === row.id
      ? { ...i, [field === 'assignee_id' ? 'assignee_id' : field]: value } as ListItemRow
      : i))
    try {
      await updateWorkItemField(row.id, field, value, previous, {
        actorName: activeUser.name, actorId: actorProfileId,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar a alteração.')
      void load(filters)
    }
  }

  function groupRows(): { label: string; items: Row[] }[] {
    if (groupBy === 'none') return [{ label: '', items: sorted }]
    const groups: Record<string, Row[]> = {}
    sorted.forEach(r => {
      const k = (groupBy === 'sprint' ? r.sprintId : r.epicId) ?? '__none__'
      if (!groups[k]) groups[k] = []
      groups[k].push(r)
    })
    return Object.entries(groups).map(([k, list]) => ({
      label: k === '__none__'
        ? (groupBy === 'sprint' ? 'Sem sprint' : 'Sem épico')
        : (groupBy === 'sprint'
          ? (sprints.find(s => s.id === k)?.name ?? k)
          : (epics.find(e => e.id === k)?.name ?? k)),
      items: list,
    }))
  }

  const groups = groupRows()

  // ── CSV export of the currently visible rows (filters + sort + selected columns) ──
  function cellText(row: Row, col: ColId): string {
    switch (col) {
      case 'key': return row.key
      case 'type': return TYPE_ICON[row.type]?.label ?? row.type
      case 'title': return row.title
      case 'status': return STATUS_CFG[row.status]?.label ?? row.status
      case 'priority': return PRIORITY_CFG[row.priority]?.label ?? row.priority
      case 'assignee': return profiles.find(p => p.id === row.assigneeId)?.name ?? '—'
      case 'points': return String(row.points)
      case 'epic': return epics.find(e => e.id === row.epicId)?.name ?? '—'
      case 'sprint': return sprints.find(s => s.id === row.sprintId)?.name ?? '—'
      case 'labels': return row.labels.join('; ')
      case 'dueDate': return row.dueDate
      default: return ''
    }
  }

  function csvEscape(v: string): string {
    return /[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }

  function exportCsv() {
    const visible = groups.flatMap(g => g.items)
    const lines = [
      cols.map(c => csvEscape(COL_LABELS[c])).join(','),
      ...visible.map(r => cols.map(c => csvEscape(cellText(r, c))).join(',')),
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `demandas-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }


  const colW: Record<ColId, number | string> = {
    key: 90, type: 44, title: 260, status: 130, priority: 110,
    assignee: 90, points: 56, epic: 130, sprint: 110, labels: 120, dueDate: 80,
  }

  function renderCell(row: Row, col: ColId) {
    const isEditing = editCell?.key === row.key && editCell?.col === col
    const startEdit = () => { if (canEdit) setEditCell({ key: row.key, col }) }
    const stopEdit = () => setEditCell(null)

    const cellStyle: React.CSSProperties = {
      padding:'0 10px', display:'flex', alignItems:'center',
      width: colW[col], minWidth: colW[col], maxWidth: colW[col],
      overflow:'hidden', whiteSpace:'nowrap',
      border: isEditing ? `1.5px solid ${T.accent}` : 'none',
      borderRadius: isEditing ? 4 : 0,
      background: isEditing ? T.accentDim : 'transparent',
      cursor: 'pointer',
    }

    if (col === 'key') return (
      <div style={{ ...cellStyle, cursor: 'default' }}>
        <button
          onClick={() => setSelectedId(row.id)}
          aria-label={`Abrir detalhe de ${row.key}`}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: T.accent, fontWeight: 600, fontSize: 12,
            textDecoration: 'underline', textDecorationColor: `${T.accent}55`,
            textUnderlineOffset: 3,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecorationColor = T.accent }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecorationColor = `${T.accent}55` }}
          onFocus={e => { (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${T.accent}` }}
          onBlur={e => { (e.currentTarget as HTMLButtonElement).style.outline = 'none' }}
        >
          {row.key}
        </button>
      </div>
    )
    if (col === 'type') {
      const t = TYPE_ICON[row.type] ?? { icon: '☑', color: T.text2, label: row.type }
      return <div style={{...cellStyle,justifyContent:'center'}}><span style={{color:t.color,fontSize:14}}>{t.icon}</span></div>
    }
    if (col === 'title') {
      if (isEditing) return (
        <div style={cellStyle}>
          <input
            autoFocus
            defaultValue={row.title}
            onBlur={e => { const v = e.target.value; stopEdit(); if (v !== row.title) void persistField(row, 'title', v, row.title) }}
            onKeyDown={e => { if(e.key==='Enter'||e.key==='Escape') (e.target as HTMLInputElement).blur() }}
            style={{ background:'transparent', border:'none', outline:'none', color:T.text1, width:'100%', fontSize:13 }}
          />
        </div>
      )
      return (
        <div style={cellStyle} onClick={startEdit} title={row.title}>
          {row.blocked && <span style={{color:T.crit,marginRight:4,fontSize:10}}>⛔</span>}
          <span style={{color:T.text1,fontSize:13,overflow:'hidden',textOverflow:'ellipsis'}}>{row.title}</span>
        </div>
      )
    }
    if (col === 'status') {
      const cfg = STATUS_CFG[row.status] ?? { label: row.status, color: T.text2, bg: T.neutralDim }
      if (isEditing) return (
        <div style={cellStyle}>
          <select
            autoFocus
            value={row.status}
            onChange={e => { const v = e.target.value; stopEdit(); void persistField(row, 'status', v, row.status) }}
            onBlur={stopEdit}
            style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1, borderRadius:4, fontSize:12, padding:'2px 4px' }}
          >
            {Object.keys(STATUS_CFG).map(s => (
              <option key={s} value={s}>{STATUS_CFG[s].label}</option>
            ))}
          </select>
        </div>
      )
      return (
        <div style={cellStyle} onClick={startEdit}>
          <span style={{ background:cfg.bg, color:cfg.color, borderRadius:4, padding:'2px 7px', fontSize:11, fontWeight:600 }}>{cfg.label}</span>
        </div>
      )
    }
    if (col === 'priority') {
      const cfg = PRIORITY_CFG[row.priority] ?? PRIORITY_CFG.medium
      if (isEditing) return (
        <div style={cellStyle}>
          <select
            autoFocus
            value={row.priority}
            onChange={e => { const v = e.target.value; stopEdit(); void persistField(row, 'priority', v, row.priority) }}
            onBlur={stopEdit}
            style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1, borderRadius:4, fontSize:12, padding:'2px 4px' }}
          >
            {Object.keys(PRIORITY_CFG).map(p => (
              <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>
            ))}
          </select>
        </div>
      )
      return (
        <div style={cellStyle} onClick={startEdit}>
          <span style={{color:cfg.color,marginRight:4,fontWeight:700,fontSize:11}}>{cfg.icon}</span>
          <span style={{color:cfg.color,fontSize:11}}>{cfg.label}</span>
        </div>
      )
    }
    if (col === 'assignee') {
      const profile = profiles.find(p => p.id === row.assigneeId)
      if (isEditing) return (
        <div style={cellStyle}>
          <select
            autoFocus
            value={row.assigneeId ?? ''}
            onChange={e => { const v = e.target.value || null; stopEdit(); void persistField(row, 'assignee_id', v, row.assigneeId) }}
            onBlur={stopEdit}
            style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1, borderRadius:4, fontSize:12, padding:'2px 4px' }}
          >
            <option value="">Não atribuído</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )
      return (
        <div style={cellStyle} onClick={startEdit}>
          <Avatar initials={row.assignee} color={profile?.avatar_color ?? T.text3} />
          <span style={{color:T.text2,fontSize:12,marginLeft:6}}>{row.assignee}</span>
        </div>
      )
    }
    if (col === 'points') return <div style={{...cellStyle,justifyContent:'center'}}><span style={{color:T.text2,fontSize:12}}>{row.points}</span></div>
    if (col === 'epic') {
      const epic = epics.find(e => e.id === row.epicId)
      return <div style={cellStyle}><span style={{color: epic ? epicColor(epic.color) : T.text3, fontSize:11}}>{epic?.name ?? '—'}</span></div>
    }
    if (col === 'sprint') {
      const sp = sprints.find(s => s.id === row.sprintId)
      return <div style={cellStyle}><span style={{color:T.text2,fontSize:11}}>{sp?.name ?? '—'}</span></div>
    }
    if (col === 'labels') return (
      <div style={{...cellStyle,gap:4}}>
        {row.labels.slice(0,2).map(l => (
          <span key={l} style={{background:T.neutralDim,color:T.text2,borderRadius:3,padding:'1px 5px',fontSize:10}}>{l}</span>
        ))}
      </div>
    )
    if (col === 'dueDate') return <div style={cellStyle}><span style={{color:T.text3,fontSize:12}}>{row.dueDate}</span></div>
    return <div style={cellStyle} />
  }

  const sortableCols: Partial<Record<ColId, SortKey>> = {
    key:'key', title:'title', status:'status', priority:'priority',
    assignee:'assignee', points:'points', dueDate:'dueDate',
  }

  const selectStyle: React.CSSProperties = {
    background:T.bgSurface2, border:`1px solid ${T.border}`, borderRadius:6,
    color:T.text2, padding:'5px 8px', fontSize:12, outline:'none', cursor:'pointer',
  }

  return (
    <>
    <div style={{ background:T.bgPage, height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderBottom:`1px solid ${T.border}`, background:T.bgSurface, flexWrap:'wrap' }}>
        <span style={{ color:T.text1, fontWeight:700, fontSize:15, marginRight:8 }}>Backlog</span>
        <input
          placeholder="Filtrar por título…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, borderRadius:6, color:T.text1, padding:'5px 10px', fontSize:13, width:200, outline:'none' }}
        />
        <select value={fProject} onChange={e => setFProject(e.target.value)} style={selectStyle} aria-label="Projeto">
          <option value="">Todos os projetos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={selectStyle} aria-label="Status">
          <option value="">Status</option>
          {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
        </select>
        <select value={fPriority} onChange={e => setFPriority(e.target.value)} style={selectStyle} aria-label="Prioridade">
          <option value="">Prioridade</option>
          {Object.keys(PRIORITY_CFG).map(p => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
        </select>
        <select value={fType} onChange={e => setFType(e.target.value)} style={selectStyle} aria-label="Tipo">
          <option value="">Tipo</option>
          {Object.keys(TYPE_ICON).map(t => <option key={t} value={t}>{TYPE_ICON[t].label}</option>)}
        </select>
        <select value={fAssignee} onChange={e => setFAssignee(e.target.value)} style={selectStyle} aria-label="Responsável">
          <option value="">Responsável</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fSprint} onChange={e => setFSprint(e.target.value)} style={selectStyle} aria-label="Sprint">
          <option value="">Sprint</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={fEpic} onChange={e => setFEpic(e.target.value)} style={selectStyle} aria-label="Épico">
          <option value="">Épico</option>
          {epics.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <span style={{color:T.text3,fontSize:13,marginLeft:4}}>Agrupar:</span>
        {(['none','sprint','epic'] as GroupBy[]).map(g => (
          <button key={g} onClick={() => setGroupBy(g)} style={{
            padding:'4px 10px', borderRadius:5, fontSize:12, cursor:'pointer',
            background: groupBy===g ? T.accentDim : 'transparent',
            color: groupBy===g ? T.accent : T.text2,
            border: `1px solid ${groupBy===g ? T.accent : T.border}`,
          }}>
            {g==='none'?'Nenhum':g==='sprint'?'Sprint':'Épico'}
          </button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:8,position:'relative'}} ref={colsRef}>
          <button onClick={() => setColsOpen(o=>!o)} style={{
            padding:'5px 12px', borderRadius:5, fontSize:12, cursor:'pointer',
            background: colsOpen ? T.accentDim : T.bgSurface2,
            color: colsOpen ? T.accent : T.text2,
            border:`1px solid ${colsOpen ? T.accent : T.border}`,
          }}>Colunas ▾</button>
          {colsOpen && (
            <div style={{
              position:'absolute', top:34, right:0, zIndex:50,
              background:T.bgSurface2, border:`1px solid ${T.border2}`, borderRadius:8,
              padding:'10px 14px', minWidth:160, boxShadow:T.shadowModal,
            }}>
              {ALL_COLS.map(c => (
                <label key={c} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', cursor:'pointer', color:T.text2, fontSize:13 }}>
                  <input type="checkbox" checked={cols.includes(c)} onChange={()=>toggleCol(c)} style={{accentColor:T.accent}} />
                  {COL_LABELS[c]}
                </label>
              ))}
            </div>
          )}
          <button onClick={exportCsv} disabled={loading || rows.length === 0} style={{
            padding:'5px 12px', borderRadius:5, fontSize:12,
            cursor: loading || rows.length === 0 ? 'not-allowed' : 'pointer',
            opacity: loading || rows.length === 0 ? 0.5 : 1,
            background:T.bgSurface2, color:T.text2, border:`1px solid ${T.border}`,
          }}>Exportar CSV ↓</button>
        </div>
      </div>

      {error && (
        <div style={{ padding:'10px 20px', fontSize:12, color:T.crit, borderBottom:`1px solid ${T.border}` }}>{error}</div>
      )}

      {/* Table */}
      <div style={{ flex:1, overflowX:'auto', overflowY:'auto', minHeight:0 }}>
        {loading ? (
          <div style={{ padding:20, display:'flex', flexDirection:'column', gap:8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height:34, borderRadius:6, background:T.bgSurface2, opacity:0.6 }} />
            ))}
          </div>
        ) : rows.length === 0 && !error ? (
          <div style={{ padding:40, textAlign:'center', color:T.text3, fontSize:13 }}>
            Nenhuma issue encontrada
          </div>
        ) : (
        <table style={{ borderCollapse:'collapse', width:'max-content', minWidth:'100%' }}>
          <thead style={{ position:'sticky', top:0, zIndex:10 }}>
            <tr style={{ background:T.bgSurface, borderBottom:`1px solid ${T.border}` }}>
              {cols.map(col => {
                const sk = sortableCols[col]
                const active = sk && sortKey === sk
                return (
                  <th
                    key={col}
                    onClick={sk ? () => toggleSort(sk) : undefined}
                    style={{
                      width: colW[col], minWidth: colW[col], maxWidth: colW[col],
                      padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:700,
                      color: active ? T.accent : T.text3,
                      cursor: sk ? 'pointer' : 'default',
                      userSelect:'none', whiteSpace:'nowrap',
                      borderBottom: active ? `2px solid ${T.accent}` : `2px solid transparent`,
                      background:T.bgSurface,
                    }}
                  >
                    {COL_LABELS[col]}{active ? (sortDir==='asc'?' ↑':' ↓') : ''}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <React.Fragment key={group.label}>
                {groupBy !== 'none' && (
                  <tr key={`g-${group.label}`}>
                    <td colSpan={cols.length} style={{ padding:'8px 12px', background:T.bgSurface2, borderBottom:`1px solid ${T.border}` }}>
                      <button
                        onClick={() => setCollapsed(c => ({...c,[group.label]:!c[group.label]}))}
                        style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}
                      >
                        <span style={{color:T.text3,fontSize:12}}>{collapsed[group.label]?'▶':'▼'}</span>
                        <span style={{color:T.text2,fontWeight:700,fontSize:13}}>{group.label}</span>
                        <span style={{color:T.text3,fontSize:11}}>{group.items.length} issues · {group.items.reduce((s,i)=>s+i.points,0)} pts</span>
                      </button>
                    </td>
                  </tr>
                )}
                {!collapsed[group.label] && group.items.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom:`1px solid ${T.border}`,
                      background: idx % 2 === 0 ? T.bgPage : T.bgSurface,
                      transition:'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.bgSurface2)}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? T.bgPage : T.bgSurface)}
                  >
                    {cols.map(col => (
                      <td key={col} style={{ padding:0, height:38 }}>
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>

    {selectedId && (
      <WorkItemDetail
        itemId={selectedId}
        onUpdate={() => { void load(filters) }}
        onClose={() => { setSelectedId(null); void load(filters) }}
        mode="drawer"
      />
    )}
    </>
  )
}
