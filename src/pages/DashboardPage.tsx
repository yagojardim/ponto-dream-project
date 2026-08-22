// Dashboard executivo — reads real aggregates from Supabase (src/data/db/dashboards.ts).
// Read-only: no writes happen from this screen.
import { useState, useRef, useEffect, useMemo } from 'react'
import { Avatar } from '../components/ds/Avatar'
import { WorkItemDetail } from '../components/WorkItemDetail'
import { T } from '../components/ds/tokens'
import {
  fetchDashboardAggregates,
  type DashboardAggregates, type RagProject, type FeatureAggregate,
} from '../data/db/dashboards'
import type { WorkItem, RagStatus } from '../components/ds/DashboardKit'

// ─── Color helpers ────────────────────────────────────────────────────────────
const STATUS: Record<RagStatus, { color: string; tint: string; border: string; label: string }> = {
  healthy: { color: '#06C18A', tint: 'rgba(6,193,138,0.12)',  border: 'rgba(6,193,138,0.3)',  label: 'Saudável'  },
  risk:    { color: '#F5A524', tint: 'rgba(245,165,36,0.12)', border: 'rgba(245,165,36,0.3)', label: 'Em risco'  },
  blocked: { color: '#F0455A', tint: 'rgba(240,69,90,0.12)',  border: 'rgba(240,69,90,0.3)',  label: 'Bloqueado' },
}

const DELIVERY_STATUS: Record<string, { color: string; tint: string; label: string }> = {
  'in-progress': { color: '#4d82ff', tint: 'rgba(77,130,255,0.12)', label: 'Em andamento' },
  'in-review':   { color: '#F5A524', tint: 'rgba(245,165,36,0.12)', label: 'Em revisão'   },
  testing:       { color: '#F5A524', tint: 'rgba(245,165,36,0.12)', label: 'Em teste'     },
  done:          { color: '#06C18A', tint: 'rgba(6,193,138,0.12)',  label: 'Concluído'    },
  blocked:       { color: '#F0455A', tint: 'rgba(240,69,90,0.12)',  label: 'Bloqueado'    },
  todo:          { color: '#8a9ab8', tint: 'rgba(138,154,184,0.12)', label: 'A fazer'     },
  ready:         { color: '#8a9ab8', tint: 'rgba(138,154,184,0.12)', label: 'Pronto'      },
  backlog:       { color: '#546278', tint: 'rgba(84,98,120,0.15)',  label: 'Backlog'      },
  cancelled:     { color: '#546278', tint: 'rgba(84,98,120,0.15)',  label: 'Cancelado'    },
}

function fmtDate(d?: string): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function fmtDateFull(d?: string): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Project multi-select dropdown ───────────────────────────────────────────
interface ProjectOption { id: string; name: string; color: string }

function ProjectDropdown({ options, selected, onChange }: {
  options: ProjectOption[]; selected: Set<string>; onChange: (s: Set<string>) => void
}) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const allSelected = options.length > 0 && selected.size === options.length
  const filtered    = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) { if (next.size === 1) return; next.delete(id) } else { next.add(id) }
    onChange(next)
  }

  const triggerLabel = allSelected
    ? `Todos (${options.length})`
    : selected.size === 1 ? (options.find(o => selected.has(o.id))?.name ?? '1 projeto')
    : `${selected.size} projetos`

  const S: React.CSSProperties = { background: 'var(--bg-surface,#111d33)', border: '1px solid var(--border-subtle,#1c2c45)' }
  const chk = (on: boolean, c: string): React.CSSProperties => ({ width:14, height:14, borderRadius:4, flexShrink:0, border:`1.5px solid ${on?c:'#2d4060'}`, background:on?c:'transparent', display:'flex', alignItems:'center', justifyContent:'center' })

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 12px', borderRadius:8, cursor:'pointer', ...S, color:'var(--text-secondary,#8a9ab8)', fontSize:12, transition:'all 0.15s', whiteSpace:'nowrap' }}>
        <div style={{ display:'flex', gap:3 }}>
          {options.filter(o=>selected.has(o.id)).map(o=><span key={o.id} style={{ width:7,height:7,borderRadius:2,background:o.color }} />)}
        </div>
        <span>{triggerLabel}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.15s', color:'#546278' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:300, background:'var(--bg-surface,#111d33)', border:'1px solid var(--border-subtle,#1c2c45)', borderRadius:10, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:280, overflow:'hidden' }}>
          <div style={{ padding:'9px 11px', borderBottom:'1px solid var(--border-subtle,#1c2c45)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,0.3)', borderRadius:7, border:'1px solid #1c2c45', padding:'5px 9px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color:'#546278' }}><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/><path d="M9 9l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar projeto…" style={{ background:'none', border:'none', outline:'none', color:'var(--text-primary,#e8ecf4)', fontSize:12, width:'100%' }} />
            </div>
          </div>

          <div onClick={() => onChange(allSelected ? new Set([options[0].id]) : new Set(options.map(o=>o.id)))}
            style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 13px', cursor:'pointer', borderBottom:'1px solid var(--border-subtle,#1c2c45)' }}>
            <span style={chk(allSelected,'#4d82ff')}>
              {allSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            <span style={{ fontSize:12, color:'var(--text-secondary,#8a9ab8)', fontWeight:500 }}>Todos os projetos</span>
            <span style={{ marginLeft:'auto', fontSize:11, color:'#546278' }}>{options.length}</span>
          </div>

          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {filtered.map(o => {
              const on = selected.has(o.id)
              return (
                <div key={o.id} onClick={()=>toggle(o.id)}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 13px', cursor:'pointer', borderBottom:'1px solid var(--border-subtle,#1c2c45)' }}>
                  <span style={chk(on,o.color)}>
                    {on && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span style={{ width:8,height:8,borderRadius:2,background:o.color,flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--text-primary,#e8ecf4)', flex:1 }}>{o.name}</span>
                </div>
              )
            })}
            {filtered.length===0 && <div style={{ padding:'12px 13px', fontSize:12, color:'#546278', textAlign:'center' }}>Nenhum resultado</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Pill({ children, color, tint, border }: { children: React.ReactNode; color:string; tint:string; border:string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color, background:tint, border:`1px solid ${border}` }}>
      {children}
    </span>
  )
}

function SmallDonut({ pct, color, size=48 }: { pct:number; color:string; size?:number }) {
  const r=14, cx=size/2, cy=size/2, sw=4, circ=2*Math.PI*r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${(pct/100)*circ} ${circ-(pct/100)*circ}`}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}/>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="9" fontWeight="700" fill="#e8ecf4">{pct}%</text>
    </svg>
  )
}

/** Delivery curve built from the real per-project completion ratios. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const max = Math.max(1, ...points), W = 140, H = 40
  const coords = points.map((v,i)=>[(i/(points.length-1)*W).toFixed(1),(H-(v/max)*H).toFixed(1)])
  const linePath = coords.map(([x,y],i)=>`${i===0?'M':'L'}${x},${y}`).join('')
  const [lx,ly] = coords[coords.length-1]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <defs><linearGradient id="spark-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d82ff" stopOpacity="0.25"/><stop offset="100%" stopColor="#4d82ff" stopOpacity="0"/></linearGradient></defs>
      <path d={`${linePath}L${W},${H}L0,${H}Z`} fill="url(#spark-g)"/>
      <path d={linePath} stroke="#4d82ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={lx} cy={ly} r="3.5" fill="#4d82ff"/>
      <circle cx={lx} cy={ly} r="5.5" fill="#4d82ff" fillOpacity="0.2"/>
    </svg>
  )
}

function Section({ title, action, children }: { title:React.ReactNode; action?:React.ReactNode; children:React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background:'var(--bg-surface,#111d33)', border:'1px solid var(--border-subtle,#1c2c45)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom:'1px solid var(--border-subtle,#1c2c45)' }}>
        {title}{action}
      </div>
      {children}
    </div>
  )
}

function Skeleton({ height = 120 }: { height?: number }) {
  return <div style={{ height, borderRadius: 12, background: T.bgSurface2, border: `1px solid ${T.border}` }} />
}

// ─── Health card ──────────────────────────────────────────────────────────────
function HealthCard({ p, onOpen }: { p: RagProject; onOpen: () => void }) {
  const s = STATUS[p.rag]
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="flex flex-col gap-3 p-4 rounded-xl min-w-0 cursor-pointer"
      style={{ background:'var(--bg-surface,#111d33)', borderTop:`1px solid var(--border-subtle,#1c2c45)`, borderRight:`1px solid var(--border-subtle,#1c2c45)`, borderBottom:`1px solid var(--border-subtle,#1c2c45)`, borderLeft:`3px solid ${s.color}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono mb-1" style={{ color:'var(--text-muted,#546278)' }}>{p.squad}</p>
          <p className="text-sm font-semibold leading-tight truncate" style={{ color:'var(--text-primary,#e8ecf4)' }}>{p.name}</p>
        </div>
        <Pill color={s.color} tint={s.tint} border={s.border}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background:s.color }} />{s.label}
        </Pill>
      </div>
      {p.reason && (
        <p className="text-xs px-3 py-1.5 rounded-lg" style={{ color:s.color, background:s.tint, border:`1px solid ${s.border}` }}>{p.reason}</p>
      )}
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px]" style={{ color:'var(--text-muted,#546278)' }}>Progresso · {p.done}/{p.total} itens</span>
          <span className="text-[10px] font-semibold" style={{ color:'var(--text-secondary,#8a9ab8)' }}>{p.pct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--border-subtle,#1c2c45)' }}>
          <div className="h-full rounded-full" style={{ width:`${p.pct}%`, background:s.color }}/>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px]" style={{ color:'var(--text-muted,#546278)' }}>{p.daysLabel}</span>
        <span className="text-xs" style={{ color:'var(--primary,#4d82ff)' }}>Ver projeto →</span>
      </div>
    </div>
  )
}

// ─── Funcionalidades card ─────────────────────────────────────────────────────
function FeaturesCard({ f }: { f: FeatureAggregate }) {
  if (f.total === 0) {
    return (
      <div style={{ padding:'14px 16px', borderRadius:12, border:'1px dashed var(--border-subtle,#1c2c45)', fontSize:12, color:'var(--text-muted,#546278)' }}>
        Nenhuma funcionalidade nos projetos selecionados.
      </div>
    )
  }
  return (
    <div className="p-4 rounded-xl" style={{ background:'var(--bg-surface,#111d33)', border:'1px solid var(--border-subtle,#1c2c45)' }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color:T.purple, fontSize:13 }}>▣</span>
          <span className="text-sm font-semibold" style={{ color:'var(--text-primary,#e8ecf4)' }}>Funcionalidades</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color:T.purple, background:`${T.purple}1f` }}>
            {f.total} no escopo
          </span>
        </div>
        <span className="text-sm font-bold" style={{ color:T.purple }}>{f.pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background:'var(--border-subtle,#1c2c45)' }}>
        <div className="h-full rounded-full" style={{ width:`${f.pct}%`, background:T.purple }} />
      </div>
      <div className="flex justify-between mt-2 text-[10px]" style={{ color:'var(--text-muted,#546278)' }}>
        <span>{f.done}/{f.total} funcionalidades concluídas</span>
        <span>{f.donePoints} de {f.totalPoints} pontos concluídos</span>
      </div>
    </div>
  )
}

// ─── Projeto encerrado ────────────────────────────────────────────────────────
function ClosedProjectCard({ p, onOpen }: { p: RagProject; onOpen: () => void }) {
  const c = '#06C18A'
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="flex flex-col gap-3 p-4 rounded-xl min-w-0 cursor-pointer"
      style={{ background:'var(--bg-surface,#111d33)', border:'1px solid var(--border-subtle,#1c2c45)', opacity:0.92 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono mb-1" style={{ color:'var(--text-muted,#546278)' }}>{p.key}</p>
          <p className="text-sm font-semibold leading-tight truncate" style={{ color:'var(--text-primary,#e8ecf4)' }}>{p.name}</p>
        </div>
        <Pill color={c} tint="rgba(6,193,138,0.12)" border="rgba(6,193,138,0.3)">Concluído</Pill>
      </div>
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px]" style={{ color:'var(--text-muted,#546278)' }}>Progresso final · {p.done}/{p.total} itens</span>
          <span className="text-[10px] font-semibold" style={{ color:'var(--text-secondary,#8a9ab8)' }}>{p.pct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--border-subtle,#1c2c45)' }}>
          <div className="h-full rounded-full" style={{ width:`${p.pct}%`, background:c }}/>
        </div>
      </div>
      {p.finalizeNote && (
        <p className="text-xs" style={{ color:'var(--text-secondary,#8a9ab8)' }}>{p.finalizeNote}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px]" style={{ color:'var(--text-muted,#546278)' }}>
          {p.finalizedAt ? `Finalizado em ${fmtDate(p.finalizedAt)}` : 'Encerrado'}
        </span>
        <span className="text-xs" style={{ color:'var(--primary,#4d82ff)' }}>Ver projeto →</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage({ onNav }: { onNav?: (v: string, targetId?: string) => void }) {
  const [agg, setAgg]         = useState<DashboardAggregates | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)

  const selKey = selected ? [...selected].sort().join(',') : ''

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetchDashboardAggregates(selKey ? selKey.split(',') : undefined)
      .then(d => {
        if (!alive) return
        setAgg(d)
        setSelected(prev => prev ?? new Set(d.projects.map(p => p.id)))
        setLoading(false)
      })
      .catch((e: Error) => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [selKey])

  const projectOptions: ProjectOption[] = agg?.projects ?? []
  const visProjects = agg?.rag ?? []
  const blockers    = agg?.blockers ?? []
  const deliveries  = agg?.upcoming ?? []
  const sprint      = agg?.currentSprints?.[0] ?? null

  const activeProjects    = useMemo(() => visProjects.filter(p => p.status !== 'completed'), [visProjects])
  const completedProjects = useMemo(() => visProjects.filter(p => p.status === 'completed'), [visProjects])

  const consolidatedPct = agg?.consolidatedPct ?? 0
  const sparkPoints = useMemo(() => visProjects.map(p => p.donePoints), [visProjects])
  const projName = (id: string) => visProjects.find(p => p.id === id)?.name ?? ''

  return (
    <div className="p-5 space-y-5 overflow-y-auto h-full" style={{ maxWidth:1280, margin:'0 auto' }}>
      {openItemId && (
        <WorkItemDetail itemId={openItemId} mode="drawer" onUpdate={() => {}} onClose={() => setOpenItemId(null)} />
      )}

      {/* Page title + filter */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color:'var(--text-primary,#e8ecf4)' }}>Dashboard executivo</h1>
          <p className="text-xs mt-0.5" style={{ color:'var(--text-muted,#546278)' }}>
            Visão de saúde do portfólio
            {sprint && ` · ${sprint.name} · termina em ${fmtDate(sprint.endDate ?? undefined)}`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {projectOptions.length > 0 && selected && (
            <ProjectDropdown options={projectOptions} selected={selected} onChange={setSelected} />
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding:'12px 14px', borderRadius:10, background:`${T.crit}14`, border:`1px solid ${T.crit}44`, color:T.crit, fontSize:12, display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ flex:1 }}>{error}</span>
          <button onClick={() => setSelected(s => (s ? new Set(s) : s))} style={{ fontSize:11, color:T.crit, background:'none', border:`1px solid ${T.crit}55`, borderRadius:6, padding:'3px 10px', cursor:'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}

      {loading && !agg && (
        <div className="space-y-4">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            <Skeleton /><Skeleton /><Skeleton />
          </div>
          <Skeleton height={220} />
        </div>
      )}

      {!loading && !error && visProjects.length === 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'#546278', fontSize:13, border:'1px dashed #1c2c45', borderRadius:12 }}>
          Nenhum projeto no escopo selecionado.
        </div>
      )}

      {agg && visProjects.length > 0 && (
        <>
          {/* 1. Health row */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color:'var(--text-muted,#546278)' }}>
              Saúde dos projetos
            </p>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(Math.max(activeProjects.length,1),3)},1fr)`, gap:12 }}>
              {activeProjects.map(p => <HealthCard key={p.id} p={p} onOpen={() => onNav?.('project', p.id)} />)}
              {activeProjects.length === 0 && (
                <div style={{ padding:'18px', borderRadius:12, border:'1px dashed var(--border-subtle,#1c2c45)', fontSize:12, color:'var(--text-muted,#546278)' }}>
                  Nenhum projeto em andamento no escopo selecionado.
                </div>
              )}
            </div>
          </div>

          {/* 1b. Funcionalidades */}
          <FeaturesCard f={agg.features} />

          {/* 1c. Projetos encerrados */}
          {completedProjects.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color:'var(--text-muted,#546278)' }}>
                Projetos encerrados
              </p>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(completedProjects.length,3)},1fr)`, gap:12 }}>
                {completedProjects.map(p => <ClosedProjectCard key={p.id} p={p} onOpen={() => onNav?.('project', p.id)} />)}
              </div>
            </div>
          )}


          {/* 2. Main grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4 min-w-0">
              {/* Progress */}
              <Section title={
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color:'var(--text-primary,#e8ecf4)' }}>Planejado × Concluído</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color:'#06C18A', background:'rgba(6,193,138,0.12)' }}>
                    {agg.done}/{agg.planned} itens
                  </span>
                </div>
              }>
                <div className="px-5 py-4 space-y-4">
                  <div className="flex items-center gap-6">
                    <div className="flex-shrink-0 text-center" style={{ minWidth:70 }}>
                      <p className="text-4xl font-bold leading-none tracking-tight" style={{ color:'var(--text-primary,#e8ecf4)' }}>{consolidatedPct}%</p>
                      <p className="text-[10px] mt-1" style={{ color:'var(--text-muted,#546278)' }}>Consolidado</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background:'var(--border-subtle,#1c2c45)' }}>
                        <div className="h-full rounded-full" style={{ width:`${consolidatedPct}%`, background:'#4d82ff' }}/>
                      </div>
                      <div className="flex justify-between mt-2 text-[10px]" style={{ color:'var(--text-muted,#546278)' }}>
                        <span>{agg.donePoints} de {agg.plannedPoints} pontos concluídos</span>
                        <span>Velocity média: {agg.velocityAvg} pts/sprint · Previsibilidade {agg.predictability}%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop:'1px solid var(--border-subtle,#1c2c45)', paddingTop:14, display:'flex', flexDirection:'column', gap:10 }}>
                    <div className="flex items-end justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:'var(--text-muted,#546278)' }}>Por projeto</p>
                      <Sparkline points={sparkPoints} />
                    </div>
                    {visProjects.map(p=>{
                      const sc=STATUS[p.rag]
                      return (
                        <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <SmallDonut pct={p.pct} color={sc.color} size={40} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontSize:11, color:'var(--text-primary,#e8ecf4)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize:11, color:sc.color, fontWeight:700, flexShrink:0, marginLeft:8 }}>{p.pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--border-subtle,#1c2c45)' }}>
                              <div className="h-full rounded-full" style={{ width:`${p.pct}%`, background:sc.color }}/>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Section>

              {/* Blockers */}
              <Section
                title={
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background:'rgba(240,69,90,0.15)' }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 3.5v3M5.5 8v.5" stroke="#F0455A" strokeWidth="1.3" strokeLinecap="round"/><circle cx="5.5" cy="5.5" r="4.5" stroke="#F0455A" strokeWidth="1"/></svg>
                    </span>
                    <span className="text-sm font-semibold" style={{ color:'var(--text-primary,#e8ecf4)' }}>Impedimentos & bloqueios ativos</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color:'#F0455A', background:'rgba(240,69,90,0.15)' }}>{blockers.length}</span>
                  </div>
                }
                action={
                  <button className="text-xs transition-opacity hover:opacity-70" style={{ color:'var(--primary,#4d82ff)' }}
                    onClick={()=>onNav?.('list')}>
                    Ver todos
                  </button>
                }
              >
                <div>
                  {blockers.length === 0 && (
                    <p style={{ padding:'20px 16px', textAlign:'center', fontSize:12, color:'#546278' }}>Sem impedimentos nos projetos selecionados. 🟢</p>
                  )}
                  {blockers.map((b: WorkItem, i) => {
                    const dc = '#F0455A'
                    const db = 'rgba(240,69,90,0.12)'
                    return (
                      <div key={b.id}
                        role="button" tabIndex={0}
                        className="flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
                        style={{ borderBottom:i<blockers.length-1?'1px solid var(--border-subtle,#1c2c45)':'none' }}
                        onClick={() => setOpenItemId(b.id)}
                        onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setOpenItemId(b.id)}}}>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ color:dc, background:db, border:`1px solid ${dc}33` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background:dc }}/>
                          Bloqueado
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[10px] flex-shrink-0" style={{ color:'var(--text-muted,#546278)' }}>{b.key}</span>
                            <span className="text-sm truncate" style={{ color:'var(--text-primary,#e8ecf4)' }}>{b.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {b.assignee && <Avatar name={b.assignee.name} size="xs"/>}
                            <span className="text-xs" style={{ color:'var(--text-secondary,#8a9ab8)' }}>{b.assignee?.name ?? 'Sem responsável'}</span>
                            <span className="text-[10px]" style={{ color:'#546278', marginLeft:4 }}>· {projName(b.project_id)}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0" style={{ color:dc, background:db }}>{b.days_blocked ?? 0}d bloqueado</span>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>

            {/* Right: sprint */}
            <div className="min-w-0">
              <Section title={
                <div>
                  <p className="text-sm font-semibold" style={{ color:'var(--text-primary,#e8ecf4)' }}>{sprint?.name ?? 'Sprint atual'}</p>
                  <p className="text-[11px]" style={{ color:'var(--text-muted,#546278)' }}>
                    {sprint ? `Termina em ${fmtDate(sprint.endDate ?? undefined)}` : 'Nenhuma sprint ativa'}
                  </p>
                </div>
              }>
                <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border-subtle,#1c2c45)', display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center' }}>
                  {agg.currentSprints.length === 0 && (
                    <p style={{ fontSize:12, color:'#546278' }}>Nenhuma sprint ativa nos projetos selecionados.</p>
                  )}
                  {agg.currentSprints.map(s => (
                    <div key={s.id} role="button" tabIndex={0} onClick={() => onNav?.('project')}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:64, cursor:'pointer' }}>
                      <SmallDonut pct={s.pct} color={s.pct >= 70 ? '#06C18A' : s.pct >= 40 ? '#F5A524' : '#F0455A'} size={56}/>
                      <span style={{ fontSize:10, color:'var(--text-muted,#546278)', textAlign:'center', maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {s.projectName}
                      </span>
                      <span style={{ fontSize:9, color:'#546278' }}>{s.done}/{s.total} itens</span>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-2" style={{ borderBottom:'1px solid var(--border-subtle,#1c2c45)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:'var(--text-muted,#546278)' }}>Entregas próximas</p>
                </div>

                {deliveries.length === 0 && (
                  <p style={{ padding:'16px', textAlign:'center', fontSize:12, color:'#546278' }}>Sem entregas com prazo definido.</p>
                )}

                {deliveries.map((d, i)=>{
                  const st = DELIVERY_STATUS[d.status] ?? DELIVERY_STATUS.backlog
                  return (
                    <div key={d.id}
                      role="button" tabIndex={0}
                      className="flex items-center gap-2.5 px-4 py-3 transition-colors cursor-pointer"
                      style={{ borderBottom:i<deliveries.length-1?'1px solid var(--border-subtle,#1c2c45)':'none' }}
                      onClick={() => setOpenItemId(d.id)}
                      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setOpenItemId(d.id)}}}>
                      {d.assignee && <Avatar name={d.assignee.name} size="xs"/>}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate font-medium" style={{ color:'var(--text-primary,#e8ecf4)' }}>{d.title}</p>
                        <p className="text-[10px] mt-0.5" style={{ color:'var(--text-muted,#546278)' }}>
                          {(d.assignee?.name.split(' ')[0]) ?? 'Sem responsável'} · {fmtDate(d.due_date)}
                        </p>
                      </div>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ color:st.color, background:st.tint }}>
                        {st.label}
                      </span>
                    </div>
                  )
                })}
              </Section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
