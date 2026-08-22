import { useState, useRef, useEffect, useCallback } from 'react'
import { WorkItemDetail } from '../components/WorkItemDetail'
import { T } from '../components/ds/tokens'
import {
  listEpics, createEpicIssue, linkItemToEpic, createEpic, createFeature, nextEpicKey, epicColor as epicColorOf,
  type EpicsData, type EpicItemRow, type EpicRow,
} from '../data/db/epics'
import { listProjects, projectUsesFeatures } from '../data/db/projects'
import { DB_STATUS_CFG } from '../data/db/timeline'
import { getActiveUser } from '../data/session'
import { can } from '../data/permissions'

const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const

const TYPE_GLYPH: Record<string, { icon: string; color: string }> = {
  story: { icon: '◇', color: T.accent }, bug: { icon: '⬟', color: T.crit },
  task: { icon: '☑', color: T.text2 }, subtask: { icon: '◻', color: T.text3 },
  epic: { icon: '⚡', color: T.warn }, feature: { icon: '▣', color: T.purple },
}
function typeGlyph(t: string) { return TYPE_GLYPH[t] ?? { icon: '•', color: T.text3 } }
function statusCfg(s: string) { return DB_STATUS_CFG[s] ?? { label: s, color: T.text3 } }

function NewMenuItem({
  icon, iconColor, title, desc, onClick,
}: {
  icon: string; iconColor: string; title: string; desc: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
        width: '100%', background: 'transparent', border: 'none', textAlign: 'left',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.bgSurface2 }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${iconColor}18`, color: iconColor, fontSize: 14,
      }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13, color: T.text1, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 11, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</span>
      </div>
    </button>
  )
}

// ─── Issue search dropdown (link an existing item into the epic) ──────────────
function IssueSearchDropdown({
  epicId, color, items, onLink,
}: { epicId: string; color: string; items: EpicItemRow[]; onLink: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = query.trim().length < 1 ? [] : items.filter(i => {
    if (i.epic_id === epicId) return false
    const q = query.toLowerCase()
    return i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)
  }).slice(0, 8)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(''); setCursor(-1) }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && cursor >= 0 && results[cursor]) {
      e.preventDefault(); onLink(results[cursor].id); setQuery(''); setOpen(false); setCursor(-1)
    } else if (e.key === 'Escape') { setOpen(false); setQuery(''); setCursor(-1) }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: T.bgSurface2, border: `1px solid ${color}50`,
        borderRadius: 8, padding: '7px 12px',
        boxShadow: open ? `0 0 0 2px ${color}20` : 'none', transition: 'box-shadow 0.15s',
      }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="5.5" cy="5.5" r="4" stroke={T.text3} strokeWidth="1.2"/>
          <path d="M8.5 8.5l2 2" stroke={T.text3} strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1) }}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar e adicionar issues por título ou key…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.text2 }}
        />
        {query && (
          <button
            onMouseDown={e => { e.preventDefault(); setQuery(''); setOpen(false); setCursor(-1); inputRef.current?.focus() }}
            style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: T.bgSurface2, border: `1px solid ${T.border2}`,
          borderRadius: 8, boxShadow: T.shadowModal, overflow: 'hidden',
        }}>
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: T.text3, textAlign: 'center' }}>
              Nenhuma issue fora do épico corresponde a "{query}"
            </div>
          ) : (
            results.map((item, idx) => {
              const sc = statusCfg(item.status)
              const ti = typeGlyph(item.type)
              const isCursor = idx === cursor
              return (
                <div
                  key={item.id}
                  onMouseDown={e => { e.preventDefault(); onLink(item.id); setQuery(''); setOpen(false); setCursor(-1) }}
                  onMouseEnter={() => setCursor(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
                    background: isCursor ? `${color}18` : 'transparent',
                    borderTop: idx > 0 ? `1px solid ${T.border}` : 'none', transition: 'background 0.1s',
                  }}
                >
                  <span style={{ color: ti.color, fontSize: 13, flexShrink: 0 }}>{ti.icon}</span>
                  <span style={{ fontSize: 11, color: T.text3, fontFamily: 'monospace', width: 62, flexShrink: 0 }}>{item.key}</span>
                  <span style={{ fontSize: 12, color: T.text1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                  <span style={{ fontSize: 10, color: sc.color, background: `${sc.color}18`, borderRadius: 20, padding: '1px 7px', flexShrink: 0 }}>{sc.label}</span>
                  <span style={{ fontSize: 10, color, background: `${color}14`, borderRadius: 4, padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    + Vincular
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── Inline "create issue in this epic" form ──────────────────────────────────
function InlineCreateIssue({
  color, busy, onCreate,
}: { color: string; busy: boolean; onCreate: (title: string, type: string) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('story')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 12, fontSize: 12, color: T.text3, background: 'transparent',
          border: `1px dashed ${T.border2}`, borderRadius: 8, padding: '8px 16px',
          cursor: 'pointer', width: '100%', textAlign: 'left',
        }}
      >
        + Criar issue neste épico
      </button>
    )
  }

  return (
    <div style={{
      marginTop: 12, display: 'flex', gap: 8, alignItems: 'center',
      background: T.bgSurface2, border: `1px solid ${color}40`, borderRadius: 8, padding: 8,
    }}>
      <select value={type} onChange={e => setType(e.target.value)}
        style={{ background: T.bgSurface, color: T.text2, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, padding: '5px 6px' }}>
        <option value="story">Story</option>
        <option value="task">Task</option>
        <option value="bug">Bug</option>
      </select>
      <input
        autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { onCreate(title.trim(), type); setTitle(''); setOpen(false) } if (e.key === 'Escape') setOpen(false) }}
        placeholder="Título da issue…"
        style={{ flex: 1, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 6, outline: 'none', fontSize: 12, color: T.text1, padding: '6px 8px' }}
      />
      <button
        disabled={!title.trim() || busy}
        onClick={() => { if (title.trim()) { onCreate(title.trim(), type); setTitle(''); setOpen(false) } }}
        style={{
          fontSize: 12, fontWeight: 600, color: '#fff', background: color, opacity: !title.trim() || busy ? 0.5 : 1,
          border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
        }}
      >{busy ? 'Criando…' : 'Criar'}</button>
      <button onClick={() => { setOpen(false); setTitle('') }}
        style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function DonutRing({ pct, size = 48, color }: { pct: number; size?: number; color: string }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border2} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={T.text1}
        style={{ fontSize: 11, fontWeight: 700 }}>
        {pct}%
      </text>
    </svg>
  )
}

function Avatar({ initials, color, size = 26 }: { initials: string; color?: string | null; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color || T.text3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>{initials}</div>
  )
}

function StateBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: 32, textAlign: 'center', fontSize: 13, color: T.text3,
    }}>{children}</div>
  )
}

const fieldStyle: React.CSSProperties = {
  width: '100%', background: T.bgSurface2, border: `1px solid ${T.border2}`,
  borderRadius: 8, padding: '8px 10px', fontSize: 12, color: T.text1, outline: 'none',
}
const labelStyle: React.CSSProperties = { fontSize: 11, color: T.text3, display: 'block', marginBottom: 4 }


// ─── "New epic" modal ─────────────────────────────────────────────────────────
function NewEpicModal({
  projects, profiles, busy, error, suggestedKey, onKeyRefresh, onClose, onCreate,
}: {
  projects: EpicsData['projects']
  profiles: EpicsData['profiles']
  busy: boolean
  error: string | null
  suggestedKey: string
  onKeyRefresh: (projectId: string) => void
  onClose: () => void
  onCreate: (input: {
    projectId: string; name: string; key?: string
    description?: string | null; quarter?: string | null; ownerId?: string | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [projectId, setProjectId] = useState(projects.length === 1 ? projects[0].id : '')
  const [ownerId, setOwnerId] = useState('')
  const [quarter, setQuarter] = useState('')
  const [description, setDescription] = useState('')

  const canSave = name.trim().length > 0 && projectId.length > 0 && !busy

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(8,10,14,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480, background: T.bgSurface,
        border: `1px solid ${T.border2}`, borderRadius: 12, boxShadow: T.shadowModal,
        padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>Novo épico</div>

        <div>
          <label style={labelStyle}>Nome *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Autenticação e Perfis" style={fieldStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Projeto *</label>
            <select
              value={projectId}
              onChange={e => { setProjectId(e.target.value); onKeyRefresh(e.target.value) }}
              style={fieldStyle}
            >
              <option value="">Selecionar…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ width: 130 }}>
            <label style={labelStyle}>Key</label>
            <input value={key} onChange={e => setKey(e.target.value)} placeholder={suggestedKey || 'EP-01'} style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Owner</label>
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)} style={fieldStyle}>
              <option value="">Sem owner</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ width: 130 }}>
            <label style={labelStyle}>Quarter</label>
            <input value={quarter} onChange={e => setQuarter(e.target.value)} placeholder="Q3 2026" style={fieldStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Descrição</label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)} rows={3}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </div>

        {error && <div style={{ fontSize: 12, color: T.crit }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer' }}
          >Cancelar</button>
          <button
            disabled={!canSave}
            onClick={() => onCreate({
              projectId, name: name.trim(), key: key.trim() || undefined,
              description: description.trim() || null,
              quarter: quarter.trim() || null,
              ownerId: ownerId || null,
            })}
            style={{
              fontSize: 12, padding: '7px 14px', borderRadius: 8, border: 'none',
              background: canSave ? T.accent : T.neutralDim, color: canSave ? '#fff' : T.text3,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >{busy ? 'Criando…' : 'Criar épico'}</button>
        </div>
      </div>
    </div>
  )
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function EpicsPage() {
  const [data, setData] = useState<EpicsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>({})
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({})
  const [detailId, setDetailId] = useState<string | null>(null)
  const [newEpicOpen, setNewEpicOpen] = useState(false)
  const [newEpicProjectId, setNewEpicProjectId] = useState<string>('')
  const [newEpicError, setNewEpicError] = useState<string | null>(null)
  const [suggestedKey, setSuggestedKey] = useState('')
  const [featureProjects, setFeatureProjects] = useState<Set<string>>(new Set())
  const [featureEpic, setFeatureEpic] = useState<{ id: string; name: string } | null>(null)
  const [featureName, setFeatureName] = useState('')
  const [featureDesc, setFeatureDesc] = useState('')
  const [featureError, setFeatureError] = useState<string | null>(null)
  const [featureProjectId, setFeatureProjectId] = useState<string | null>(null)
  const [featureEpicId, setFeatureEpicId] = useState('')
  const [newMenuProjectId, setNewMenuProjectId] = useState<string | null>(null)
  const newMenuRef = useRef<HTMLDivElement>(null)

  const activeUser = getActiveUser()
  const canCreateFeature = can(activeUser?.permissions ?? [], 'create:feature')
  const canCreateEpic = can(activeUser?.permissions ?? [], 'create:epic')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { projects } = await listProjects()
        if (!alive) return
        setFeatureProjects(new Set(projects.filter(p => projectUsesFeatures(p)).map(p => p.id)))
      } catch { /* silencioso — sem features disponíveis */ }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!newMenuProjectId) return
    function handleMouse(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuProjectId(null)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNewMenuProjectId(null)
    }
    document.addEventListener('mousedown', handleMouse)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouse)
      document.removeEventListener('keydown', handleKey)
    }
  }, [newMenuProjectId])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await listEpics()) }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleCreate(epic: EpicRow, title: string, type: string) {
    setBusy(true)
    try {
      await createEpicIssue({
        epicId: epic.id, projectId: epic.project_id, title, type, actorName: activeUser?.name,
      })
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }

  async function handleLink(epicId: string, itemId: string) {
    setBusy(true)
    try { await linkItemToEpic(itemId, epicId, activeUser?.name ?? 'Sistema'); await load() }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }

  const refreshSuggestedKey = useCallback(async (projectId: string) => {
    if (!projectId) { setSuggestedKey(''); return }
    try { setSuggestedKey(await nextEpicKey(projectId)) }
    catch { setSuggestedKey('') }
  }, [])

  function openNewEpic(projectId: string) {
    setNewEpicProjectId(projectId)
    setNewEpicError(null)
    setNewEpicOpen(true)
    void refreshSuggestedKey(projectId)
  }

  async function handleCreateEpic(input: {
    projectId: string; name: string; key?: string
    description?: string | null; quarter?: string | null; ownerId?: string | null
  }) {
    setBusy(true); setNewEpicError(null)
    try {
      await createEpic({ ...input, actorName: activeUser?.name })
      setNewEpicOpen(false)
      setNewEpicProjectId('')
      await load()
    } catch (err) { setNewEpicError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }

  function openNewFeature(epic: EpicRow) {
    setFeatureEpic({ id: epic.id, name: epic.name })
    setFeatureProjectId(null); setFeatureEpicId('')
    setFeatureName(''); setFeatureDesc(''); setFeatureError(null)
  }

  function openNewFeatureForProject(projectId: string) {
    setFeatureEpic(null); setFeatureProjectId(projectId); setFeatureEpicId('')
    setFeatureName(''); setFeatureDesc(''); setFeatureError(null)
  }

  function closeFeatureModal() {
    setFeatureEpic(null); setFeatureProjectId(null); setFeatureEpicId('')
  }

  async function handleCreateFeature() {
    const epicId = featureEpic?.id ?? featureEpicId
    if (!epicId || !featureName.trim()) return
    setBusy(true); setFeatureError(null)
    try {
      await createFeature({
        epicId,
        name: featureName.trim(),
        description: featureDesc.trim() || null,
        actorName: activeUser?.name,
      })
      closeFeatureModal()
      await load()
    } catch (err) { setFeatureError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }


  const epics = data?.epics ?? []
  const items = data?.items ?? []
  const profileById = new Map((data?.profiles ?? []).map(p => [p.id, p]))

  const projects = (data?.projects ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))

  const isOpen = (id: string) => openProjects[id] !== false

  return (
    <>
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: T.text1 }}>Épicos</span>
        <span style={{ fontSize: 13, color: T.text3, background: T.neutralDim, borderRadius: 20, padding: '2px 10px' }}>
          {epics.length} épicos
        </span>
      </div>

      {loading && <StateBox>Carregando épicos…</StateBox>}
      {!loading && error && (
        <StateBox><span style={{ color: T.crit }}>Erro ao carregar épicos: {error}</span></StateBox>
      )}
      {!loading && !error && projects.length === 0 && (
        <StateBox>Nenhum projeto cadastrado neste tenant.</StateBox>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!loading && !error && projects.map(project => {
          const projectEpics = epics.filter(e => e.project_id === project.id)
          const open = isOpen(project.id)
          const hasFeatures = featureProjects.has(project.id)
          return (
            <div key={project.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Project accordion header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '12px 16px',
              }}>
                <button
                  onClick={() => setOpenProjects(prev => ({ ...prev, [project.id]: !open }))}
                  style={{
                    background: 'none', border: 'none', color: T.text2, cursor: 'pointer',
                    fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22,
                  }}
                  aria-label={open ? 'Recolher projeto' : 'Expandir projeto'}
                >
                  {open ? '▾' : '▸'}
                </button>

                <span style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>{project.name}</span>
                <span style={{ fontSize: 12, color: T.text3, background: T.neutralDim, borderRadius: 20, padding: '2px 10px' }}>
                  {projectEpics.length} {projectEpics.length === 1 ? 'épico' : 'épicos'}
                </span>

                {hasFeatures && (
                  <span style={{
                    fontSize: 11, color: T.purple, background: T.purpleDim,
                    borderRadius: 20, padding: '2px 10px', fontWeight: 600,
                  }}>
                    Funcionalidades
                  </span>
                )}

                <div style={{ flex: 1 }} />

                {canCreateEpic && (
                  <div ref={newMenuRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => {
                        if (!hasFeatures) { setNewMenuProjectId(null); openNewEpic(project.id); return }
                        setNewMenuProjectId(prev => (prev === project.id ? null : project.id))
                      }}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: '7px 14px',
                        borderRadius: 8, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      + Novo {hasFeatures && <span style={{ fontSize: 10 }}>▾</span>}
                    </button>

                    {newMenuProjectId === project.id && hasFeatures && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 80,
                        minWidth: 210, background: T.bgSurface, border: `1px solid ${T.border2}`,
                        borderRadius: 10, boxShadow: T.shadowModal, padding: 4, overflow: 'hidden',
                      }}>
                        <NewMenuItem
                          icon="⚡"
                          iconColor={T.warn}
                          title="Épico"
                          desc="Agrupador de planejamento"
                          onClick={() => { setNewMenuProjectId(null); openNewEpic(project.id) }}
                        />
                        <NewMenuItem
                          icon="▣"
                          iconColor={T.purple}
                          title="Funcionalidade"
                          desc="Recurso dentro de um épico"
                          onClick={() => { setNewMenuProjectId(null); openNewFeatureForProject(project.id) }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded project body */}
              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingLeft: 4, paddingRight: 4 }}>
                  {projectEpics.length === 0 ? (
                    <p style={{ fontSize: 13, color: T.text3, padding: '8px 12px' }}>
                      Nenhum épico neste projeto ainda.
                    </p>
                  ) : (
                    projectEpics.map(epic => {
                      const color = epicColorOf(epic.color)
                      const epicItems = items.filter(i => i.epic_id === epic.id)
                      const done = epicItems.filter(i => i.status === 'done').length
                      const total = epicItems.length
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0
                      const points = epicItems.reduce((s, i) => s + Number(i.story_points ?? 0), 0)
                      const features = (data?.features ?? []).filter(f => f.epic_id === epic.id)
                      const assignees = [...new Set(epicItems.map(i => i.assignee_id).filter(Boolean))] as string[]
                      const isExpanded = expanded[epic.id]
                      const owner = epic.owner_id ? profileById.get(epic.owner_id) : undefined

                      const statusCounts = Object.fromEntries(
                        STATUSES.map(s => [s, epicItems.filter(i => i.status === s).length])
                      )

                      const renderItem = (item: EpicItemRow) => {
                                      const ti = typeGlyph(item.type)
                                      const sc = statusCfg(item.status)
                                      const isActive = detailId === item.id
                                      const p = item.assignee_id ? profileById.get(item.assignee_id) : undefined
                                      return (
                                        <div
                                          key={item.id}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => setDetailId(item.id)}
                                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailId(item.id) } }}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 10px', borderRadius: 8,
                                            background: isActive ? `${color}14` : T.bgSurface2,
                                            border: `1px solid ${isActive ? color + '60' : T.border}`,
                                            cursor: 'pointer', transition: 'all 0.12s', outline: 'none',
                                          }}
                                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `${color}0A`; e.currentTarget.style.borderColor = `${color}40` }}
                                          onMouseLeave={e => { e.currentTarget.style.background = isActive ? `${color}14` : T.bgSurface2; e.currentTarget.style.borderColor = isActive ? `${color}60` : T.border }}
                                        >
                                          <span style={{ color: ti.color, fontSize: 14, flexShrink: 0 }}>{ti.icon}</span>
                                          <span style={{ fontSize: 11, color: T.text3, fontFamily: 'monospace', width: 62, flexShrink: 0 }}>{item.key}</span>
                                          <span style={{ fontSize: 13, color: T.text1, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.title}
                                          </span>
                                          {item.is_blocked && <span style={{ fontSize: 11, color: T.crit }}>🔴</span>}
                                          <span style={{
                                            fontSize: 11, color: sc.color, background: `${sc.color}18`,
                                            borderRadius: 20, padding: '2px 8px', flexShrink: 0,
                                          }}>{sc.label}</span>
                                          {p && <Avatar initials={p.avatar_initials ?? p.name.slice(0, 2).toUpperCase()} color={p.avatar_color} size={22} />}
                                          <span style={{
                                            fontSize: 11, color: T.text3, background: T.neutralDim,
                                            borderRadius: 4, padding: '1px 6px', flexShrink: 0,
                                          }}>{Number(item.story_points ?? 0)}pt</span>
                                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: isActive ? 1 : 0.3, transition: 'opacity 0.12s' }}>
                                            <path d="M4 2.5l3.5 3.5L4 9.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                        </div>
                                      )
                      }

                      return (
                        <div key={epic.id} style={{
                          background: T.bgSurface, border: `1px solid ${T.border}`,
                          borderRadius: 12, overflow: 'hidden',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex',
                        }}>
                          <div style={{ width: 6, minHeight: 180, background: color, flexShrink: 0 }} />

                          <div style={{ flex: 1, padding: '20px 24px', minWidth: 0 }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'monospace', letterSpacing: 1 }}>
                                {epic.key}
                              </span>
                              <span style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>{epic.name}</span>
                              {epic.quarter && (
                                <span style={{
                                  fontSize: 11, color: T.text3, background: T.neutralDim,
                                  borderRadius: 20, padding: '2px 10px', border: `1px solid ${T.border}`,
                                }}>{epic.quarter}</span>
                              )}
                              {owner && (
                                <div style={{ marginLeft: 'auto' }}>
                                  <Avatar initials={owner.avatar_initials ?? owner.name.slice(0, 2).toUpperCase()} color={owner.avatar_color} size={28} />
                                </div>
                              )}
                            </div>

                            {epic.description && (
                              <p style={{ fontSize: 13, color: T.text2, margin: '0 0 16px', lineHeight: 1.5 }}>{epic.description}</p>
                            )}

                            {/* Progress + stats row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginBottom: 16 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <DonutRing pct={pct} color={color} />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>{done}/{total} issues</div>
                                  <div style={{ fontSize: 11, color: T.text3 }}>concluídas</div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {STATUSES.map(s => {
                                  const cnt = statusCounts[s] ?? 0
                                  const cfg = statusCfg(s)
                                  return (
                                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                                      <span style={{ fontSize: 12, color: cnt > 0 ? T.text2 : T.text3 }}>{cnt}</span>
                                      <span style={{ fontSize: 11, color: T.text3 }}>{cfg.label}</span>
                                    </div>
                                  )
                                })}
                              </div>

                              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: T.text3 }}>Story points:</span>
                                <span style={{
                                  fontSize: 12, fontWeight: 700, color, background: `${color}18`,
                                  borderRadius: 6, padding: '2px 8px',
                                }}>{points}</span>
                              </div>
                            </div>

                            {/* Features */}
                            {(features.length > 0 || (hasFeatures && canCreateFeature)) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                                <span style={{ fontSize: 11, color: T.text3 }}>Funcionalidades:</span>
                                {features.map(f => (
                                  <span key={f.id} title={f.description ?? undefined} style={{
                                    fontSize: 11, color: T.text2, background: T.bgSurface2,
                                    border: `1px solid ${T.border}`, borderRadius: 20, padding: '2px 10px',
                                  }}>{f.name}</span>
                                ))}
                                {hasFeatures && canCreateFeature && (
                                  <button
                                    onClick={() => openNewFeature(epic)}
                                    style={{
                                      fontSize: 11, color: T.purple, background: T.purpleDim,
                                      border: `1px dashed ${T.purple}55`, borderRadius: 20,
                                      padding: '2px 10px', cursor: 'pointer', fontWeight: 600,
                                    }}
                                  >+ Funcionalidade</button>
                                )}
                              </div>
                            )}

                            {/* Assignees */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                              {assignees.slice(0, 6).map(id => {
                                const p = profileById.get(id)
                                return <Avatar key={id} initials={p?.avatar_initials ?? p?.name.slice(0, 2).toUpperCase() ?? '??'} color={p?.avatar_color} size={24} />
                              })}
                              {assignees.length > 6 && (
                                <span style={{ fontSize: 11, color: T.text3, marginLeft: 4 }}>+{assignees.length - 6}</span>
                              )}
                            </div>

                            {/* Expand button */}
                            <button
                              onClick={() => setExpanded(prev => ({ ...prev, [epic.id]: !prev[epic.id] }))}
                              style={{
                                fontSize: 12, color, background: `${color}18`,
                                border: `1px solid ${color}40`, borderRadius: 6, padding: '5px 14px',
                                cursor: 'pointer', fontWeight: 600,
                              }}
                            >
                              {isExpanded ? '▲ Ocultar issues' : `▼ Ver issues (${total})`}
                            </button>

                            {/* Expanded issue list */}
                            {isExpanded && (
                              <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                                {hasFeatures ? (
                                {(() => {
                                  const groups: { id: string; name: string; list: typeof epicItems }[] = [
                                    ...features.map(f => ({ id: f.id, name: f.name, list: epicItems.filter(i => i.feature_id === f.id) })),
                                  ]
                                  const orphans = epicItems.filter(i => !i.feature_id || !features.some(f => f.id === i.feature_id))
                                  if (orphans.length > 0) groups.push({ id: `${epic.id}__nofeature`, name: 'Sem funcionalidade', list: orphans })
                                  if (groups.length === 0) return <p style={{ fontSize: 13, color: T.text3 }}>Nenhuma funcionalidade neste épico.</p>
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {groups.map(g => {
                                        const gOpen = !!expandedFeatures[g.id]
                                        const gDone = g.list.filter(i => i.status === 'done')
                                        const donePts = gDone.reduce((s, i) => s + Number(i.story_points ?? 0), 0)
                                        const totalPts = g.list.reduce((s, i) => s + Number(i.story_points ?? 0), 0)
                                        const gpct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0
                                        return (
                                          <div key={g.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgSurface2 }}>
                                            <div
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => setExpandedFeatures(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedFeatures(prev => ({ ...prev, [g.id]: !prev[g.id] })) } }}
                                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', outline: 'none' }}
                                            >
                                              <span style={{ fontSize: 11, color: T.text3, width: 10, flexShrink: 0 }}>{gOpen ? '▾' : '▸'}</span>
                                              <span style={{ color: T.purple, fontSize: 13, flexShrink: 0 }}>▣</span>
                                              <span style={{ fontSize: 13, fontWeight: 600, color: T.text1, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                                              <span style={{ fontSize: 11, color: T.text3, flexShrink: 0 }}>{gDone.length}/{g.list.length} itens</span>
                                              <div style={{ width: 70, height: 6, borderRadius: 4, background: T.neutralDim, overflow: 'hidden', flexShrink: 0 }}>
                                                <div style={{ width: `${gpct}%`, height: '100%', background: T.purple }} />
                                              </div>
                                              <span style={{ fontSize: 11, fontWeight: 700, color: T.purple, width: 34, textAlign: 'right', flexShrink: 0 }}>{gpct}%</span>
                                              <span style={{ fontSize: 11, color: T.text3, background: T.neutralDim, borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>{donePts}/{totalPts}pt</span>
                                            </div>
                                            {gOpen && (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px 10px' }}>
                                                {g.list.length === 0
                                                  ? <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>Nenhuma issue nesta funcionalidade.</p>
                                                  : g.list.map(item => renderItem(item))}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })()}
                                ) : epicItems.length === 0 ? (
                                  <p style={{ fontSize: 13, color: T.text3 }}>Nenhuma issue neste épico.</p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {epicItems.map(item => renderItem(item))}
                                  </div>
                                )}

                                <IssueSearchDropdown
                                  epicId={epic.id}
                                  color={color}
                                  items={items.filter(i => i.project_id === epic.project_id)}
                                  onLink={id => void handleLink(epic.id, id)}
                                />

                                <InlineCreateIssue
                                  color={color}
                                  busy={busy}
                                  onCreate={(title, type) => void handleCreate(epic, title, type)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>

    {/* WorkItemDetail drawer — reads and persists the real row */}
    {detailId && (
      <WorkItemDetail
        itemId={detailId}
        mode="drawer"
        onUpdate={() => { /* persistence happens inside the panel */ }}
        onClose={() => { setDetailId(null); void load() }}
      />
    )}

    {newEpicOpen && (
      <NewEpicModal
        projects={newEpicProjectId ? (data?.projects ?? []).filter(p => p.id === newEpicProjectId) : (data?.projects ?? [])}
        profiles={data?.profiles ?? []}
        busy={busy}
        error={newEpicError}
        suggestedKey={suggestedKey}
        onKeyRefresh={id => { void refreshSuggestedKey(id) }}
        onClose={() => { setNewEpicOpen(false); setNewEpicProjectId('') }}
        onCreate={input => { void handleCreateEpic(input) }}
      />
    )}

    {(featureEpic || featureProjectId) && (
      <div
        onClick={e => { if (e.target === e.currentTarget) closeFeatureModal() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(8,10,14,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
      >
        <div style={{
          width: '100%', maxWidth: 440, background: T.bgSurface,
          border: `1px solid ${T.border2}`, borderRadius: 12, boxShadow: T.shadowModal,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>Nova funcionalidade</div>
          {featureEpic ? (
            <div style={{ fontSize: 12, color: T.text3 }}>Épico: {featureEpic.name}</div>
          ) : (
            (() => {
              const projectEpicOptions = epics.filter(e => e.project_id === featureProjectId)
              return projectEpicOptions.length === 0 ? (
                <div style={{ fontSize: 12, color: T.text3 }}>
                  Crie um Épico antes de adicionar uma Funcionalidade.
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Épico *</label>
                  <select value={featureEpicId} onChange={e => setFeatureEpicId(e.target.value)} style={fieldStyle}>
                    <option value="">Selecione um épico…</option>
                    {projectEpicOptions.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )
            })()
          )}

          <div>
            <label style={labelStyle}>Nome *</label>
            <input value={featureName} onChange={e => setFeatureName(e.target.value)}
              placeholder="Ex.: Login com Google" style={fieldStyle} />
          </div>

          <div>
            <label style={labelStyle}>Descrição</label>
            <textarea value={featureDesc} onChange={e => setFeatureDesc(e.target.value)} rows={3}
              style={{ ...fieldStyle, resize: 'vertical' }} />
          </div>

          {featureError && <div style={{ fontSize: 12, color: T.crit }}>{featureError}</div>}

          {(() => {
            const canSubmit = Boolean(featureName.trim()) && Boolean(featureEpic?.id ?? featureEpicId) && !busy
            return (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button onClick={closeFeatureModal}
                  style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer' }}
                >Cancelar</button>
                <button
                  disabled={!canSubmit}
                  onClick={() => { void handleCreateFeature() }}
                  style={{
                    fontSize: 12, padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: canSubmit ? T.purple : T.neutralDim,
                    color: canSubmit ? '#fff' : T.text3,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                  }}
                >{busy ? 'Criando…' : 'Criar'}</button>
              </div>
            )
          })()}
        </div>
      </div>
    )}


    </>
  )
}
