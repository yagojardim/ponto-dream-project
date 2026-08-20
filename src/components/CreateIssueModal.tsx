import { useState, useEffect } from 'react'
import { T } from './ds/tokens'
import { getActiveUser } from '../data/session'
import { can } from '../data/permissions'

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

const ENVIRONMENTS = ['iOS','Android','Web','Desktop','Todos']
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

export function CreateIssueModal({ onClose, onCreate, defaultStatus, defaultSprintId }: CreateIssueModalProps) {
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

  // Map defaultSprintId to a display string
  const defaultSprintLabel = defaultSprintId === 's14' ? SPRINTS[0]
    : defaultSprintId === 's15' ? SPRINTS[1]
    : SPRINTS[0]

  const [type,        setType]       = useState<IssueType>(allowedTypes[0] ?? 'task')
  const [summary,     setSummary]    = useState('')
  const [description, setDesc]       = useState('')
  const [priority,    setPriority]   = useState<Priority>('medium')
  const [assignee,    setAssignee]   = useState('')
  const [sprint,      setSprint]     = useState(defaultSprintLabel)
  const [epic,        setEpic]       = useState(EPICS[0])
  const [points,      setPoints]     = useState('')
  const [labels,      setLabels]     = useState('')
  const [parentIssue, setParent]     = useState('')
  // Epic-specific
  const [epicColor, setEpicColor] = useState<string>(T.warn)
  const [epicQuarter, setEpicQuarter]= useState('Q3 2025')
  // Bug-specific
  const [steps,       setSteps]      = useState(['','',''])
  const [expected,    setExpected]   = useState('')
  const [found,       setFound]      = useState('')
  const [environment, setEnv]        = useState('Todos')
  const [evidence,    setEvidence]   = useState('')
  const [createAnother, setCreateAnother] = useState(false)
  const [showCreated, setShowCreated] = useState(false)

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
    onCreate({ type, summary, description, priority, assignee, sprint, epic, points, labels, steps, expected, found, environment, evidence })
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
                  <NativeSelect value={environment} onChange={setEnv} options={ENVIRONMENTS} />
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
              <NativeSelect
                value={assignee || '—'}
                onChange={v=>setAssignee(v==='—'?'':v)}
                options={['—', ...ASSIGNEES.map(a=>a.name)]}
              />
            </Field>

            {!isEpic && (
              <Field label="Sprint">
                <NativeSelect value={sprint} onChange={setSprint} options={SPRINTS} />
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
