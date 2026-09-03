import { useState, useRef, useEffect } from 'react'
import { T } from './ds/tokens'
import { DB_STATUS_CFG } from '../data/db/timeline'
import {
  createRelease, updateRelease, linkItemsToRelease,
  type ReleaseItemRow, type ReleaseProjectRow, type ReleaseRow,
} from '../data/db/releases'
import { getActiveUser } from '../data/session'

const inputStyle: React.CSSProperties = {
  width:'100%', background:'#1e222c', border:'1px solid #262b37',
  borderRadius:8, padding:'8px 12px', color:'#e7eaf2', fontSize:13, outline:'none', boxSizing:'border-box',
}

const TYPE_GLYPH: Record<string, { icon: string; color: string }> = {
  story: { icon: '◇', color: T.accent }, bug: { icon: '⬟', color: T.crit },
  task: { icon: '☑', color: T.text2 }, subtask: { icon: '◻', color: T.text3 },
  epic: { icon: '⚡', color: T.warn }, feature: { icon: '▣', color: T.purple },
}
function typeGlyph(t: string) { return TYPE_GLYPH[t] ?? { icon: '•', color: T.text3 } }
function statusCfg(s: string) { return DB_STATUS_CFG[s] ?? { label: s, color: T.text3 } }

interface Props {
  onClose: () => void
  /** Called after the release was persisted so the list can refresh. */
  onSaved: () => void
  projects: ReleaseProjectRow[]
  /** All work items of the tenant — used to link real issues. */
  items: ReleaseItemRow[]
  /** When given, the modal edits this release instead of creating one. */
  release?: ReleaseRow | null
}

// ─── Issue search (real work items) ──────────────────────────────────────────
function IssueSearchDropdown({
  pool, alreadyListed, onAdd,
}: { pool: ReleaseItemRow[]; alreadyListed: Set<string>; onAdd: (item: ReleaseItemRow) => void }) {
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const [cursor, setCursor] = useState(-1)
  const ref      = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = query.trim().length < 1 ? [] : pool.filter(i => {
    if (alreadyListed.has(i.id)) return false
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
      e.preventDefault(); onAdd(results[cursor]); setQuery(''); setOpen(false); setCursor(-1)
    } else if (e.key === 'Escape') { setOpen(false); setQuery(''); setCursor(-1) }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#1e222c', border: `1px solid ${open ? T.accent : '#262b37'}`,
        borderRadius: 8, padding: '7px 12px', transition: 'border-color 0.15s',
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
          placeholder="Buscar issue por título ou key…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#e7eaf2' }}
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
          background: '#1e222c', border: '1px solid #262b37',
          borderRadius: 8, boxShadow: T.shadowModal, overflow: 'hidden',
        }}>
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: T.text3, textAlign: 'center' }}>
              Nenhuma issue encontrada para "{query}"
            </div>
          ) : (
            results.map((issue, idx) => {
              const sc = statusCfg(issue.status)
              const ti = typeGlyph(issue.type)
              const isCursor = idx === cursor
              return (
                <div
                  key={issue.id}
                  onMouseDown={e => { e.preventDefault(); onAdd(issue); setQuery(''); setOpen(false); setCursor(-1) }}
                  onMouseEnter={() => setCursor(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
                    background: isCursor ? `${T.accent}18` : 'transparent',
                    borderTop: idx > 0 ? '1px solid #262b37' : 'none', transition: 'background 0.1s',
                  }}
                >
                  <span style={{ color: ti.color, fontSize: 13, flexShrink: 0 }}>{ti.icon}</span>
                  <span style={{ fontSize: 11, color: T.text3, fontFamily: 'monospace', width: 62, flexShrink: 0 }}>{issue.key}</span>
                  <span style={{ fontSize: 12, color: '#e7eaf2', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</span>
                  <span style={{ fontSize: 10, color: sc.color, background: `${sc.color}18`, borderRadius: 20, padding: '1px 7px', flexShrink: 0 }}>{sc.label}</span>
                  <span style={{ fontSize: 10, color: T.accent, background: T.accentDim, borderRadius: 4, padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    + Adicionar
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

// ─── Modal ────────────────────────────────────────────────────────────────────
export function NewReleaseModal({ onClose, onSaved, projects, items, release }: Props) {
  const isEdit = !!release
  const activeUser = getActiveUser()

  const [projectId, setProjectId] = useState(release?.project_id ?? projects[0]?.id ?? '')
  const [version,  setVersion]  = useState(release?.version ?? '')
  const [name,     setName]     = useState(release?.name ?? '')
  const [date,     setDate]     = useState(release?.release_date ?? '')
  const [status,   setStatus]   = useState(release?.state ?? 'planned')
  const [notes,    setNotes]    = useState(release?.notes ?? '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  // Items already linked to this release plus the ones added through search.
  const linkedNow = items.filter(i => release && i.release_id === release.id)
  const [extra, setExtra] = useState<ReleaseItemRow[]>([])
  const [selected, setSelected] = useState<string[]>(() => linkedNow.map(i => i.id))

  const projectPool = items.filter(i => i.project_id === projectId)
  const linkable = [...extra, ...linkedNow, ...projectPool.filter(i => !i.release_id).slice(0, 8)]
    .filter((i, idx, arr) => arr.findIndex(x => x.id === i.id) === idx)

  const canSubmit = version.trim().length > 0 && name.trim().length > 0 && !!projectId

  function toggle(id: string) { setSelected(s => s.includes(id) ? s.filter(k => k !== id) : [...s, id]) }

  function addFromSearch(item: ReleaseItemRow) {
    setExtra(prev => prev.some(l => l.id === item.id) ? prev : [item, ...prev])
    setSelected(prev => prev.includes(item.id) ? prev : [...prev, item.id])
  }

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true); setError(null)
    try {
      if (release) {
        await updateRelease(release, {
          version: version.trim(), name: name.trim(), releaseDate: date || null,
          state: status, notes: notes || null,
        }, activeUser?.name ?? 'Sistema')
        const toLink = selected.filter(id => !linkedNow.some(i => i.id === id))
        if (toLink.length) await linkItemsToRelease(release.id, toLink, activeUser?.name)
      } else {
        await createRelease({
          projectId, version: version.trim(), name: name.trim(),
          releaseDate: date || null, state: status, notes: notes || null,
          itemIds: selected, actorName: activeUser?.name,
        })
      }
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  if (success) return (
    <div onClick={e=>{if(e.target===e.currentTarget){onSaved();onClose()}}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }}>
      <div style={{ background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:16,padding:40,boxShadow:T.shadowModal,width:400,textAlign:'center' }}>
        <div style={{ fontSize:48,marginBottom:12 }}>✅</div>
        <p style={{ fontSize:16,fontWeight:700,color:T.text1,marginBottom:6 }}>{isEdit ? 'Release atualizada!' : 'Release criada!'}</p>
        <p style={{ fontSize:22,fontWeight:800,color:T.accent,marginBottom:4 }}>{version} — {name}</p>
        {selected.length > 0 && (
          <p style={{ fontSize:12,color:T.text3,marginBottom:20 }}>{selected.length} issue{selected.length!==1?'s':''} vinculada{selected.length!==1?'s':''}</p>
        )}
        <div style={{ display:'flex',gap:10,justifyContent:'center' }}>
          <button onClick={()=>{onSaved();onClose()}} style={{ padding:'8px 20px',borderRadius:8,background:T.accent,color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer' }}>Ver releases →</button>
        </div>
      </div>
    </div>
  )

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }}>
      <div style={{ background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:16,padding:28,boxShadow:T.shadowModal,width:520,maxHeight:'90vh',overflowY:'auto' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
          <h2 style={{ margin:0,fontSize:18,fontWeight:700,color:T.text1 }}>{isEdit ? 'Editar Release' : 'Nova Release'}</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',color:T.text3,fontSize:20,cursor:'pointer',lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
          <div data-tour="nr-project">
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Projeto *</label>
            <select value={projectId} onChange={e=>{ setProjectId(e.target.value); setSelected([]) }} disabled={isEdit} style={inputStyle}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div data-tour="nr-version">
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Versão *</label>
            <input value={version} onChange={e=>setVersion(e.target.value)} placeholder="v1.3.0" style={inputStyle} />
          </div>

          <div data-tour="nr-name">
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Nome da release *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Pesquisa & SEO" style={inputStyle} />
          </div>

          <div data-tour="nr-when" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <div>
              <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Data planejada</label>
              <input type="date" value={date ?? ''} onChange={e=>setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={inputStyle}>
                <option value="planned">Planejada</option>
                <option value="in_progress">Em andamento</option>
                <option value="released">Lançada</option>
              </select>
            </div>
          </div>

          {/* Issues vinculadas */}
          <div data-tour="nr-issues">
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:8,display:'flex',alignItems:'center',gap:6,textTransform:'uppercase',letterSpacing:'.04em' }}>
              Issues vinculadas
              {selected.length > 0 && (
                <span style={{ color:T.accent, textTransform:'none', letterSpacing:0, fontWeight:700 }}>
                  · {selected.length} selecionada{selected.length!==1?'s':''}
                </span>
              )}
            </label>

            <IssueSearchDropdown
              pool={projectPool}
              alreadyListed={new Set(linkable.map(l => l.id))}
              onAdd={addFromSearch}
            />

            <div style={{ border:`1px solid ${T.border}`,borderRadius:8,overflow:'hidden',maxHeight:240,overflowY:'auto' }}>
              {linkable.length === 0 ? (
                <div style={{ padding:'10px 12px',fontSize:12,color:T.text3,textAlign:'center' }}>
                  Nenhuma issue disponível neste projeto.
                </div>
              ) : linkable.map((issue, i) => {
                const isSelected = selected.includes(issue.id)
                const sc = statusCfg(issue.status)
                return (
                  <label key={issue.id} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'8px 12px', cursor:'pointer',
                    background: isSelected ? T.accentDim : 'transparent',
                    borderTop: i > 0 ? `1px solid ${T.border}` : 'none', transition: 'background 0.1s',
                  }}>
                    <input type="checkbox" checked={isSelected} onChange={()=>toggle(issue.id)} style={{ accentColor:T.accent, flexShrink:0 }} />
                    <span style={{ fontSize:11,fontWeight:700,color:T.accent,flexShrink:0,fontFamily:'monospace' }}>{issue.key}</span>
                    <span style={{ fontSize:12,color:T.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1 }}>{issue.title}</span>
                    <span style={{ fontSize:10,color:sc.color,background:`${sc.color}18`,borderRadius:20,padding:'1px 7px',flexShrink:0 }}>{sc.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div data-tour="nr-notes">
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Notas de release</label>
            <textarea value={notes ?? ''} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="O que muda nesta release…" style={{ ...inputStyle,resize:'vertical',fontFamily:'inherit' }} />
          </div>

          {error && <p style={{ fontSize:12,color:T.crit,margin:0 }}>{error}</p>}
        </div>

        <div style={{ display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:`1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ padding:'8px 18px',borderRadius:8,background:'transparent',color:T.text2,border:`1px solid ${T.border}`,fontSize:13,cursor:'pointer' }}>Cancelar</button>
          <button data-tour="nr-save" onClick={()=>void handleSave()} disabled={!canSubmit || saving} style={{ padding:'8px 20px',borderRadius:8,background:canSubmit?T.accent:T.border,color:canSubmit?'#fff':T.text3,border:'none',fontSize:13,fontWeight:600,cursor:canSubmit?'pointer':'not-allowed',opacity:canSubmit&&!saving?1:.55 }}>
            {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar release'}
          </button>
        </div>
      </div>
    </div>
  )
}
