import { useState, useEffect, useRef } from 'react'
import { T } from './ds/tokens'
import { getActiveUser } from '../data/session'
import { can } from '../data/permissions'
import { getMembers } from '../data/db/members'
import { listProjects } from '../data/db/projects'
import { listSprints, normalizeState } from '../data/db/sprints'
import {
  listBugEnvironments, createBugEnvironment,
  listTenantLabels, createTenantLabel,
} from '../data/db/catalogs'
import { logger } from '../utils/logger'


// ─── Create Issue — campos condicionais quando tipo=Bug
// Bug: passos, esperado vs encontrado, ambiente, evidência
// Epic: cor, trimestre alvo
// Story/Task: épico pai
// Subtask: issue pai

type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask'
type Priority  = 'critical' | 'high' | 'medium' | 'low'

export interface ModalMember { id: string; name: string }
export interface ModalSprint { id: string; name: string; state?: string }

interface CreateIssueModalProps {
  onClose:        () => void
  onCreate:       (data: Record<string, unknown>) => void
  defaultStatus?: string
  defaultSprintId?: string
  /** Membros reais do projeto (profiles ativos). Se ausente, carrega via projectId. */
  members?:       ModalMember[]
  /** Sprints reais do projeto. Se ausente, carrega via projectId. */
  sprints?:       ModalSprint[]
  /** Projeto de origem quando o modal é aberto fora do board (Header "+ Demanda"). */
  projectId?:     string
}

const TYPE_CFG: Record<IssueType, { icon: string; color: string; label: string; desc: string }> = {
  epic:    { icon:'⚡', color:T.warn,   label:'Epic',    desc:'Objetivo de grande escala' },
  story:   { icon:'◇', color:T.accent,  label:'Story',   desc:'Funcionalidade do usuário' },
  task:    { icon:'☑', color:T.text2,   label:'Task',    desc:'Trabalho técnico ou operacional' },
  bug:     { icon:'⬟', color:T.crit,   label:'Bug',     desc:'Erro ou comportamento inesperado' },
  subtask: { icon:'◻', color:T.text3,  label:'Subtask', desc:'Parte de outra issue' },
}

const PRIORITY_CFG: Record<Priority, { label: string; color: string; icon: string }> = {
  critical:{ label:'Crítica', color:T.crit,    icon:'↑↑' },
  high:    { label:'Alta',    color:T.warn,   icon:'↑'  },
  medium:  { label:'Média',   color:T.accent, icon:'→'  },
  low:     { label:'Baixa',   color:T.text3,  icon:'↓'  },
}


const EPICS = ['EP-01 Website Relaunch','EP-02 Infra & Eng','EP-03 Pesquisa & Conteúdo']
const BACKLOG_LABEL = 'Backlog'

const EPIC_COLORS = [T.accent, T.warn, T.success, T.crit, T.purple, '#38bdf8']

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold" style={{ color:T.text3 }}>
        {label}{required && <span style={{ color:T.crit }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, onFocus, onBlur }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      value={value} onChange={onChange} placeholder={placeholder}
      className="h-9 px-3 text-[13px] rounded-lg border outline-none w-full"
      style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1 }}
      onFocus={e=>{ e.currentTarget.style.borderColor=T.accent; onFocus?.(e) }}
      onBlur={e=>{  e.currentTarget.style.borderColor=T.border;  onBlur?.(e) }}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows=3 }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className="px-3 py-2 text-[13px] rounded-lg border outline-none resize-none font-[inherit] w-full"
      style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1 }}
      onFocus={e=>{e.currentTarget.style.borderColor=T.accent}}
      onBlur={e=>{e.currentTarget.style.borderColor=T.border}}
    />
  )
}

function NativeSelect({ value, onChange, options }: { value:string; onChange:(v:string)=>void; options:string[] }) {
  return (
    <div className="relative">
      <select
        value={value} onChange={e=>onChange(e.target.value)}
        className="w-full h-9 px-3 pr-8 text-[13px] rounded-lg border outline-none appearance-none font-[inherit]"
        style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1, colorScheme:'dark' }}
        onFocus={e=>{e.currentTarget.style.borderColor=T.accent}}
        onBlur={e=>{e.currentTarget.style.borderColor=T.border}}
      >
        {options.map(o=><option key={o} value={o} style={{ background:T.bgSurface2 }}>{o}</option>)}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 3.5L5 6.5L8 3.5" stroke={T.text3} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

// Select com valor real (id) separado do rótulo exibido
function ValueSelect({ value, onChange, options }: { value:string; onChange:(v:string)=>void; options:{ value:string; label:string }[] }) {
  return (
    <div className="relative">
      <select
        value={value} onChange={e=>onChange(e.target.value)}
        className="w-full h-9 px-3 pr-8 text-[13px] rounded-lg border outline-none appearance-none font-[inherit]"
        style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1, colorScheme:'dark' }}
        onFocus={e=>{e.currentTarget.style.borderColor=T.accent}}
        onBlur={e=>{e.currentTarget.style.borderColor=T.border}}
      >
        {options.map(o=><option key={o.value || `_${o.label}`} value={o.value} style={{ background:T.bgSurface2 }}>{o.label}</option>)}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 3.5L5 6.5L8 3.5" stroke={T.text3} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

// ── Creatable combobox: lista opções do tenant e permite criar novas ─────────
function CreatableCombobox({
  options, value, values, onSelect, onCreate, placeholder, multiple = false,
}: {
  options: string[]
  value?: string
  values?: string[]
  onSelect: (v: string) => void
  onCreate: (v: string) => void | Promise<void>
  placeholder?: string
  multiple?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = query.trim()
  const selected = multiple ? (values ?? []) : []
  const filtered = options.filter(o =>
    (!q || o.toLowerCase().includes(q.toLowerCase())) &&
    (!multiple || !selected.some(s => s.toLowerCase() === o.toLowerCase())),
  )
  const canCreate = !!q && !options.some(o => o.toLowerCase() === q.toLowerCase())

  function commit(v: string, isNew: boolean) {
    if (isNew) void onCreate(v)
    else onSelect(v)
    setQuery('')
    if (!multiple) setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      {multiple && selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map(s => (
            <span key={s} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px]"
              style={{ background:T.accentDim, color:T.accent, border:`1px solid ${T.accentBorder}` }}>
              {s}
              <button onClick={()=>onSelect(s)} className="leading-none text-[12px]" style={{ color:T.accent }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        value={multiple ? query : (open ? query : (value ?? ''))}
        onChange={e=>{ setQuery(e.target.value); setOpen(true) }}
        onFocus={e=>{ setOpen(true); e.currentTarget.style.borderColor=T.accent }}
        onBlur={e=>{ e.currentTarget.style.borderColor=T.border }}
        onKeyDown={e=>{
          if (e.key === 'Enter' && q) { e.preventDefault(); commit(q, canCreate) }
        }}
        placeholder={placeholder}
        className="h-9 px-3 text-[13px] rounded-lg border outline-none w-full"
        style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1 }}
      />
      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute z-[70] left-0 right-0 top-full mt-1 rounded-lg overflow-hidden"
          style={{ background:T.bgSurface, border:`1px solid ${T.border}`, boxShadow:T.shadowModal, maxHeight:200, overflowY:'auto' }}>
          {canCreate && (
            <button onClick={()=>commit(q, true)}
              className="w-full text-left px-3 py-2 text-[12px]" style={{ color:T.accent }}>
              + Criar “{q}”
            </button>
          )}
          {filtered.map(o => (
            <button key={o} onClick={()=>commit(o, false)}
              className="w-full text-left px-3 py-2 text-[13px]" style={{ color:T.text1 }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=T.bgSurface2}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent'}}
            >{o}</button>
          ))}
        </div>
      )}
    </div>
  )
}


// Bug — numbered step list
function StepsField({ steps, onChange }: { steps: string[]; onChange:(s:string[])=>void }) {
  function update(i: number, val: string) {
    const next = [...steps]
    next[i] = val
    onChange(next)
  }
  function add() { onChange([...steps, '']) }
  function remove(i: number) { onChange(steps.filter((_,j)=>j!==i)) }

  return (
    <div className="space-y-1.5">
      {steps.map((s,i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background:T.bgSurface2, color:T.text3 }}>{i+1}</span>
          <input
            value={s} onChange={e=>update(i,e.target.value)}
            placeholder={`Passo ${i+1}...`}
            className="flex-1 h-8 px-2.5 text-[12px] rounded-lg border outline-none"
            style={{ background:T.bgSurface2, border:`1px solid ${T.border}`, color:T.text1 }}
            onFocus={e=>{e.currentTarget.style.borderColor=T.accent}}
            onBlur={e=>{e.currentTarget.style.borderColor=T.border}}
          />
          {steps.length > 1 && (
            <button onClick={()=>remove(i)} className="w-6 h-6 flex items-center justify-center rounded text-[14px] leading-none flex-shrink-0" style={{ color:T.text3 }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=T.bgSurface2}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent'}}
            >×</button>
          )}
        </div>
      ))}
      <button onClick={add} className="text-[11px] font-medium transition-colors" style={{ color:T.text3 }}
        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color=T.accent}}
        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color=T.text3}}
      >+ Adicionar passo</button>
    </div>
  )
}

export function CreateIssueModal({ onClose, onCreate, defaultStatus, defaultSprintId, members, sprints, projectId }: CreateIssueModalProps) {
  // Permission-gated issue types
  const activeUser = getActiveUser()
  const perms = activeUser?.permissions ?? []
  const canCreateProjects = can(perms, 'project:create')
  const allowedTypes: IssueType[] = (['epic','story','task','bug','subtask'] as IssueType[]).filter(t => {
    if (!canCreateProjects) return t === 'story' || t === 'subtask' || t === 'bug'
    if (t === 'epic')    return can(perms, 'create:epic')
    if (t === 'story')   return can(perms, 'create:story')
    if (t === 'task')    return can(perms, 'create:task')
    if (t === 'bug')     return can(perms, 'create:bug')
    if (t === 'subtask') return can(perms, 'create:subtask')
    return false
  })

  // ── Dados reais (membros do tenant + sprints do projeto). Sempre do banco:
  // props podem chegar vazias, então o modal se auto-hidrata.
  const [loadedMembers, setLoadedMembers] = useState<ModalMember[]>([])
  const [loadedSprints, setLoadedSprints] = useState<ModalSprint[]>([])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const profiles = await getMembers()
        if (!alive) return
        setLoadedMembers(
          profiles
            .filter(p => p.status !== 'inactive')
            .map(p => ({ id: p.id, name: p.name || p.email }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      } catch (err) {
        logger.error('CreateIssueModal: falha ao carregar membros do tenant', err)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        let pid = projectId
        if (!pid) {
          const { projects } = await listProjects()
          pid = (projects.find(p => p.status === 'active') ?? projects[0])?.id
        }
        if (!pid) return
        const rows = await listSprints(pid)
        if (!alive) return
        setLoadedSprints(rows.map(s => ({ id: s.id, name: s.name, state: normalizeState(s.state) })))
      } catch (err) {
        logger.error('CreateIssueModal: falha ao carregar sprints do projeto', err)
      }
    })()
    return () => { alive = false }
  }, [projectId])

  const memberOptions: ModalMember[] = loadedMembers.length ? loadedMembers : (members ?? [])
  const sprintOptions: ModalSprint[] = (loadedSprints.length ? loadedSprints : (sprints ?? []))
    .filter(s => s.state !== 'completed')

  const [sprintTouched, setSprintTouched] = useState(false)


  const [type,        setType]       = useState<IssueType>(allowedTypes[0] ?? 'task')
  const [summary,     setSummary]    = useState('')
  const [description, setDesc]       = useState('')
  const [priority,    setPriority]   = useState<Priority>('medium')
  const [assigneeId,  setAssigneeId] = useState('')
  const [sprintId,    setSprintId]   = useState(defaultSprintId ?? '')

  // Default = sprint ativa quando o chamador não indicou uma sprint
  useEffect(() => {
    if (defaultSprintId || sprintTouched) return
    const active = sprintOptions.find(s => s.state === 'active')
    if (active && !sprintId) setSprintId(active.id)
  }, [defaultSprintId, sprintTouched, sprintOptions, sprintId])



  const [epic,        setEpic]       = useState(EPICS[0])
  const [points,      setPoints]     = useState('')
  const [labelList,   setLabelList]  = useState<string[]>([])
  const [parentIssue, setParent]     = useState('')
  // Epic-specific
  const [epicColor, setEpicColor] = useState<string>(T.warn)
  const [epicQuarter, setEpicQuarter]= useState('Q3 2025')
  // Bug-specific
  const [steps,       setSteps]      = useState(['','',''])
  const [expected,    setExpected]   = useState('')
  const [found,       setFound]      = useState('')
  const [environment, setEnv]        = useState('')
  const [evidence,    setEvidence]   = useState('')
  const [createAnother, setCreateAnother] = useState(false)
  const [showCreated, setShowCreated] = useState(false)

  // Catálogos creatable por tenant
  const [envOptions, setEnvOptions] = useState<string[]>([])
  const [labelOptions, setLabelOptions] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [envs, labs] = await Promise.all([listBugEnvironments(), listTenantLabels()])
        if (!alive) return
        setEnvOptions(envs.map(e => e.name))
        setLabelOptions(labs.map(l => l.name))
      } catch (err) {
        logger.error('CreateIssueModal: falha ao carregar catálogos do tenant', err)
      }
    })()
    return () => { alive = false }
  }, [])

  async function handleCreateEnv(name: string) {
    const created = await createBugEnvironment(name)
    const value = created?.name ?? name.trim()
    setEnvOptions(prev => (prev.some(o => o.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value].sort()))
    setEnv(value)
  }

  async function handleCreateLabel(name: string) {
    const created = await createTenantLabel(name)
    const value = created?.name ?? name.trim()
    setLabelOptions(prev => (prev.some(o => o.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value].sort()))
    setLabelList(prev => (prev.some(l => l.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value]))
  }

  function toggleLabel(name: string) {
    setLabelList(prev => (prev.some(l => l.toLowerCase() === name.toLowerCase())
      ? prev.filter(l => l.toLowerCase() !== name.toLowerCase())
      : [...prev, name]))
  }


  useEffect(() => {
    if (showCreated) {
      const t = setTimeout(() => setShowCreated(false), 2000)
      return () => clearTimeout(t)
    }
  }, [showCreated])

  const cfg = TYPE_CFG[type]
  const isBug     = type === 'bug'
  const isEpic    = type === 'epic'
  const isSubtask = type === 'subtask'
  const needsEpic = type === 'story' || type === 'task'

  function handleSubmit() {
    if (!summary.trim()) return
    const assigneeName = memberOptions.find(m => m.id === assigneeId)?.name ?? ''
    const sprintName = sprintOptions.find(s => s.id === sprintId)?.name ?? BACKLOG_LABEL
    onCreate({ type, summary, description, priority, assigneeId: assigneeId || null, assignee: assigneeName, sprintId: sprintId || null, sprint: sprintName, epic, points, labels: labelList.join(', '), labelList, steps, expected, found, environment, evidence })

    if (createAnother) {
      setSummary('')
      setDesc('')
      setPriority('medium')
      setShowCreated(true)
    } else {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-8 pb-8 fade-rise overflow-y-auto"
      style={{ background:'rgba(8,10,14,0.75)', backdropFilter:'blur(5px)' }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}
    >
      <div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{ width:640, background:T.bgSurface, border:`1px solid ${T.border2}`, boxShadow:T.shadowModal, maxHeight:'calc(100vh - 64px)' }}
      >
        {/* Toast */}
        {showCreated && (
          <div style={{
            background: T.successDim, borderBottom: `1px solid ${T.success}`,
            color: T.success, fontSize: 12, fontWeight: 600,
            padding: '8px 20px', textAlign: 'center', flexShrink: 0,
          }}>Issue criada!</div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom:`1px solid ${T.border}` }}>
          <div className="flex items-center gap-2.5">
            <span className="text-[16px]" style={{ color:cfg.color }}>{cfg.icon}</span>
            <p className="text-[15px] font-bold" style={{ color:T.text1 }}>Criar issue</p>
            <span className="text-[11px] px-2 py-0.5 rounded-lg" style={{ background:`${cfg.color}18`, color:cfg.color }}>{cfg.label}</span>
            {defaultStatus && (
              <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium" style={{ background:T.accentDim, color:T.accent, border:`1px solid ${T.accentBorder}` }}>
                → {defaultStatus === 'in-progress' ? 'Em andamento' : defaultStatus === 'in-review' ? 'Em revisão' : defaultStatus === 'todo' ? 'A Fazer' : defaultStatus === 'done' ? 'Concluído' : defaultStatus}
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-lg leading-none" style={{ color:T.text3 }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=T.bgSurface2}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent'}}
          >×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Type selector — only shows types the current user can create */}
          <Field label="Tipo">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(TYPE_CFG) as [IssueType, typeof TYPE_CFG[IssueType]][]).filter(([k]) => allowedTypes.includes(k)).map(([k,v]) => (
                <button
                  key={k}
                  onClick={()=>setType(k)}
                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center transition-all"
                  style={{
                    background: type===k?`${v.color}18`:'transparent',
                    border: `1.5px solid ${type===k?v.color:T.border}`,
                  }}
                >
                  <span className="text-[15px]" style={{ color:v.color }}>{v.icon}</span>
                  <span className="text-[10px] font-semibold" style={{ color: type===k?v.color:T.text3 }}>{v.label}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Summary */}
          <Field label="Resumo" required>
            <TextInput
              value={summary} onChange={e=>setSummary((e.target as HTMLInputElement).value)}
              placeholder="Descreva o problema ou funcionalidade..."
            />
          </Field>

          {/* Parent (subtask) */}
          {isSubtask && (
            <Field label="Issue pai" required>
              <TextInput
                value={parentIssue} onChange={e=>setParent((e.target as HTMLInputElement).value)}
                placeholder="PM-xxx"
              />
            </Field>
          )}

          {/* Epic color + quarter (epic only) */}
          {isEpic && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor do épico">
                <div className="flex items-center gap-2">
                  {EPIC_COLORS.map(c=>(
                    <button key={c} onClick={()=>setEpicColor(c)}
                      className="w-6 h-6 rounded-full transition-all"
                      style={{ background:c, outline: epicColor===c?`2px solid white`:'2px solid transparent', outlineOffset:2 }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Trimestre alvo">
                <NativeSelect value={epicQuarter} onChange={setEpicQuarter} options={['Q1 2025','Q2 2025','Q3 2025','Q4 2025','Q1 2026']} />
              </Field>
            </div>
          )}

          {/* Epic parent (story/task) */}
          {needsEpic && (
            <Field label="Épico">
              <NativeSelect value={epic} onChange={setEpic} options={['—', ...EPICS]} />
            </Field>
          )}

          {/* Description */}
          <Field label="Descrição">
            <Textarea value={description} onChange={e=>setDesc((e.target as HTMLTextAreaElement).value)} placeholder="Contexto adicional..." rows={3} />
          </Field>

          {/* ── Bug-specific fields ───────────────────────────────────────── */}
          {isBug && (
            <>
              <div className="h-px" style={{ background:T.border }} />
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color:T.crit }}>⬟ Campos de Bug</span>
                <div className="flex-1 h-px" style={{ background:T.border }} />
              </div>

              <Field label="Passos para reproduzir" required>
                <StepsField steps={steps} onChange={setSteps} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Resultado esperado" required>
                  <Textarea value={expected} onChange={e=>setExpected((e.target as HTMLTextAreaElement).value)} placeholder="O que deveria acontecer..." rows={2} />
                </Field>
                <Field label="Resultado encontrado" required>
                  <Textarea value={found} onChange={e=>setFound((e.target as HTMLTextAreaElement).value)} placeholder="O que aconteceu na prática..." rows={2} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Ambiente" required>
                  <CreatableCombobox
                    options={envOptions}
                    value={environment}
                    onSelect={setEnv}
                    onCreate={handleCreateEnv}
                    placeholder="Selecionar ou criar ambiente..."
                  />
                </Field>
                <Field label="Evidência (link ou arquivo)">
                  <TextInput value={evidence} onChange={e=>setEvidence((e.target as HTMLInputElement).value)} placeholder="https://... ou nome do arquivo" />
                </Field>
              </div>
            </>
          )}

          {/* ── Common metadata ──────────────────────────────────────────── */}
          <div className="h-px" style={{ background:T.border }} />
          <div className="grid grid-cols-2 gap-3">

            <Field label="Prioridade">
              <div className="grid grid-cols-4 gap-1">
                {(Object.entries(PRIORITY_CFG) as [Priority, typeof PRIORITY_CFG[Priority]][]).map(([k,v]) => (
                  <button
                    key={k}
                    onClick={()=>setPriority(k)}
                    className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-center transition-all"
                    style={{
                      background: priority===k?`${v.color}18`:'transparent',
                      border:`1px solid ${priority===k?v.color:T.border}`,
                    }}
                  >
                    <span className="text-[11px] font-bold" style={{ color:v.color }}>{v.icon}</span>
                    <span className="text-[9px]" style={{ color:priority===k?v.color:T.text3 }}>{v.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Responsável">
              <ValueSelect
                value={assigneeId}
                onChange={setAssigneeId}
                options={[{ value:'', label: memberOptions.length ? '—' : 'Sem membros disponíveis' }, ...memberOptions.map(m=>({ value:m.id, label:m.name }))]}
              />
            </Field>

            {!isEpic && (
              <Field label="Sprint">
                <ValueSelect
                  value={sprintId}
                  onChange={v=>{ setSprintTouched(true); setSprintId(v) }}
                  options={[...sprintOptions.map(s=>({ value:s.id, label: s.state === 'active' ? `${s.name} (Ativa)` : s.name })), { value:'', label: BACKLOG_LABEL }]}
                />
              </Field>
            )}


            <Field label="Story Points">
              <TextInput
                value={points}
                onChange={e=>setPoints((e.target as HTMLInputElement).value)}
                placeholder="0"
                type="number"
              />
            </Field>

            <Field label="Labels">
              <TextInput
                value={labels}
                onChange={e=>setLabels((e.target as HTMLInputElement).value)}
                placeholder="Eng, Design, ..."
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderTop:`1px solid ${T.border}` }}
        >
          <label className="flex items-center gap-2 cursor-pointer h-8 px-1">
            <input
              type="checkbox"
              checked={createAnother}
              onChange={e => setCreateAnother(e.target.checked)}
              style={{ accentColor: T.accent }}
            />
            <span className="text-[12px]" style={{ color: T.text3 }}>Criar outro</span>
          </label>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-8 px-4 text-[13px] font-medium rounded-lg" style={{ color:T.text2 }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=T.bgSurface2}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent'}}
            >Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={!summary.trim()}
              className="h-8 px-4 text-[13px] font-semibold rounded-lg text-white transition-all"
              style={{ background:summary.trim()?T.accent:`${T.accent}50`, cursor:summary.trim()?'pointer':'not-allowed' }}
              onMouseEnter={e=>{ if(summary.trim()) (e.currentTarget as HTMLButtonElement).style.filter='brightness(1.15)' }}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.filter='none'}}
            >Criar issue</button>
          </div>
        </div>
      </div>
    </div>
  )
}
