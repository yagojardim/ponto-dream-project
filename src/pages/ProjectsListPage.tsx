import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '../components/ds/Avatar'
import { NewProjectModal, type NewProjectInput } from '../components/NewProjectModal'
import { WorkItemDetail } from '../components/WorkItemDetail'
import { useSession } from '../data/SessionContext'
import { can } from '../data/permissions'
import {
  listProjects, createProject, updateProject, projectColor, projectProgress,
  type ProjectRow, type ProjectTaskRow, type ProjectProfileRow, type ProjectBoardRow,
  type ProjectMemberRow,
} from '../data/db/projects'

// ─── View model ───────────────────────────────────────────────────────────────
type TaskStatus = 'em progresso' | 'concluído' | 'pendente' | 'planejamento'

interface SubTask {
  id:          string
  name:        string
  period:      string
  pct:         number
  status:      TaskStatus
  responsible: string
  type:        string
  parentId:    string | null
  children:    SubTask[]
}

interface Project {
  id:          string
  name:        string
  client:      string
  color:       string
  period:      string
  pct:         number
  status:      TaskStatus
  responsible: string
  boardId:     string | null
  tasks:       SubTask[]
  raw:         ProjectRow
}

const ITEM_STATUS_MAP: Record<string, TaskStatus> = {
  backlog: 'pendente',
  todo: 'pendente',
  in_progress: 'em progresso',
  in_review: 'em progresso',
  blocked: 'pendente',
  done: 'concluído',
}

const PROJECT_STATUS_MAP: Record<string, TaskStatus> = {
  planned: 'planejamento',
  planning: 'planejamento',
  active: 'em progresso',
  in_progress: 'em progresso',
  on_hold: 'pendente',
  paused: 'pendente',
  completed: 'concluído',
  done: 'concluído',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}`
}

function fmtPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return 'Sem período'
  const endLabel = end ? `${fmtDate(end)}/${end.slice(2, 4)}` : '—'
  return `${fmtDate(start)} – ${endLabel}`
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const statusCfg: Record<TaskStatus, { color: string; bg: string; border: string; label: string }> = {
  'em progresso': { color: '#4d82ff', bg: '#0e1d3a', border: '#1e3a7a', label: 'em progresso' },
  'concluído':    { color: '#06C18A', bg: '#0a2520', border: '#0f4030', label: 'concluído' },
  'pendente':     { color: '#8a9ab8', bg: '#151f30', border: '#1c2c45', label: 'pendente' },
  'planejamento': { color: '#a78bfa', bg: '#1a1040', border: '#2d1a6b', label: 'planejamento' },
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const c = statusCfg[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border"
      style={{ color: c.color, background: c.bg, borderColor: c.border }}
      onClick={e => e.stopPropagation()}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
      {c.label}
    </span>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[80px]" onClick={e => e.stopPropagation()}>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1c2c45' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: pct === 100 ? '#06C18A' : color }}
        />
      </div>
      <span className="text-[11px] w-6 text-right flex-shrink-0" style={{ color: '#8a9ab8' }}>{pct}%</span>
    </div>
  )
}

function countAllTasks(project: Project): number {
  return project.tasks.reduce((s, t) => s + 1 + t.children.length, 0)
}

function countDone(project: Project): number {
  return project.tasks.reduce(
    (s, t) => s + (t.status === 'concluído' ? 1 : 0) + t.children.filter(c => c.status === 'concluído').length,
    0,
  )
}

// ─── Project row ──────────────────────────────────────────────────────────────
interface ProjectRowProps {
  project:     Project
  canManage:   boolean
  onOpenProj:  (p: Project) => void
  onOpenTask:  (task: SubTask, project: Project) => void
  onEdit:      (p: Project) => void
}

function ProjectListRow({ project, canManage, onOpenProj, onOpenTask, onEdit }: ProjectRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [openTasks, setOpenTasks] = useState<Record<string, boolean>>({})



  return (
    <>
      {/* Project header row */}
      <tr
        role="button"
        tabIndex={0}
        className="cursor-pointer transition-colors"
        onClick={() => onOpenProj(project)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenProj(project) } }}
        style={{ borderBottom: '1px solid #1c2c45' }}
        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
      >
        <td className="pl-4 py-3 pr-2" style={{ width: 24 }}>
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            onKeyDown={e => e.stopPropagation()}
            className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-white/10 flex-shrink-0"
            style={{ color: '#546278' }}
            aria-label={expanded ? 'Ocultar tarefas' : 'Expandir tarefas'}
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className="transition-transform"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: project.color }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#e8ecf4' }}>{project.name}</p>
              <p className="text-[11px] truncate" style={{ color: '#546278' }}>{project.client}</p>
            </div>
          </div>
        </td>
        <td className="py-3 pr-6 text-[11px] whitespace-nowrap" style={{ color: '#546278' }}>{project.period}</td>
        <td className="py-3 pr-6" style={{ minWidth: 120 }}>
          <ProgressBar pct={project.pct} color={project.color} />
        </td>
        <td className="py-3 pr-6">
          <StatusBadge status={project.status} />
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Avatar name={project.responsible} size="xs" />
            <span className="text-xs" style={{ color: '#8a9ab8' }}>{project.responsible}</span>
          </div>
        </td>
        <td className="py-3 pr-4" style={{ width: 40 }}>
          {canManage && (
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={e => { e.stopPropagation(); onEdit(project) }}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                style={{ color: '#546278' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#e8ecf4' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#546278' }}
                aria-label="Editar projeto"
                title="Editar projeto"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="3.5" r="1.2" fill="currentColor" />
                  <circle cx="7" cy="7" r="1.2" fill="currentColor" />
                  <circle cx="7" cy="10.5" r="1.2" fill="currentColor" />
                </svg>
              </button>
            </div>
          )}
        </td>

      </tr>

      {/* Tasks and sub-tasks */}
      {expanded && project.tasks.length === 0 && (
        <tr style={{ borderBottom: '1px solid #162032' }}>
          <td />
          <td colSpan={5} className="py-2 pl-12 text-[11px]" style={{ color: '#3a4d65' }}>
            Nenhuma tarefa neste projeto
          </td>
        </tr>
      )}
      {expanded && project.tasks.map((task) => {
        const hasChildren = task.children.length > 0
        const isOpen = openTasks[task.id] ?? false
        return (
          <>
            <tr
              key={task.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors"
              onClick={() => onOpenTask(task, project)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTask(task, project) } }}
              style={{ borderBottom: '1px solid #162032' }}
              onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
            >
              <td className="pl-4 py-2 pr-2" style={{ width: 24 }}>
                {hasChildren && (
                  <button
                    onClick={e => { e.stopPropagation(); setOpenTasks(prev => ({ ...prev, [task.id]: !isOpen })) }}
                    onKeyDown={e => e.stopPropagation()}
                    className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-white/10 flex-shrink-0"
                    style={{ color: '#546278' }}
                    aria-label={isOpen ? 'Recolher subtarefas' : 'Expandir subtarefas'}
                  >
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="none"
                      className="transition-transform"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                      <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2.5">
                  {!hasChildren && (
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: project.color, opacity: 0.5 }} />
                  )}
                  <span className="text-xs truncate" style={{ color: '#8a9ab8' }}>{task.name}</span>
                  {hasChildren && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{ color: '#546278', borderColor: '#1c2c45' }}
                    >
                      {task.children.length} subtarefa{task.children.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2 pr-6 text-[11px] whitespace-nowrap" style={{ color: '#3a4d65' }}>{task.period}</td>
              <td className="py-2 pr-6" style={{ minWidth: 120 }}>
                <ProgressBar pct={task.pct} color={project.color} />
              </td>
              <td className="py-2 pr-6">
                <StatusBadge status={task.status} />
              </td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Avatar name={task.responsible} size="xs" />
                  <span className="text-[11px] truncate max-w-[90px]" style={{ color: '#546278' }}>{task.responsible}</span>
                </div>
              </td>
            </tr>
            {hasChildren && isOpen && task.children.map(child => (
              <tr
                key={child.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer transition-colors"
                onClick={() => onOpenTask(child, project)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTask(child, project) } }}
                style={{ borderBottom: '1px solid #162032' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
              >
                <td className="pl-4 py-2 pr-2" style={{ width: 24 }} />
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2.5 pl-8">
                    <span
                      className="text-[10px] w-4 h-4 flex items-center justify-center border rounded-sm flex-shrink-0"
                      style={{ borderColor: '#3a4d65', color: '#3a4d65' }}
                    >
                      ◻
                    </span>
                    <span className="text-xs truncate" style={{ color: '#8a9ab8' }}>{child.name}</span>
                  </div>
                </td>
                <td className="py-2 pr-6 text-[11px] whitespace-nowrap" style={{ color: '#3a4d65' }}>{child.period}</td>
                <td className="py-2 pr-6" style={{ minWidth: 120 }}>
                  <ProgressBar pct={child.pct} color={project.color} />
                </td>
                <td className="py-2 pr-6">
                  <StatusBadge status={child.status} />
                </td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Avatar name={child.responsible} size="xs" />
                    <span className="text-[11px] truncate max-w-[90px]" style={{ color: '#546278' }}>{child.responsible}</span>
                  </div>
                </td>
              </tr>
            ))}
          </>
        )
      })}
    </>
  )
}

// ─── Edit project modal ───────────────────────────────────────────────────────
const inputStyle = { background: '#141926', border: '1px solid #2f3547', color: '#e8ecf4' } as const

interface EditProjectModalProps {
  project:   Project
  tasks:     ProjectTaskRow[]
  members:   ProjectMemberRow[]
  profiles:  ProjectProfileRow[]
  actorName: string
  onClose:   () => void
  onDone:    (msg: string, close: boolean) => Promise<void> | void
}

function EditProjectModal({ project, tasks, members, profiles, actorName, onClose, onDone }: EditProjectModalProps) {
  const raw = project.raw
  const own = useMemo(() => tasks.filter(t => t.project_id === raw.id), [tasks, raw.id])

  const derivedStart = useMemo(() => {
    const ds = own.map(t => t.start_date).filter((d): d is string => !!d).sort()
    return ds[0] ?? ''
  }, [own])
  const derivedEnd = useMemo(() => {
    const ds = own.map(t => t.due_date).filter((d): d is string => !!d).sort()
    return ds[ds.length - 1] ?? ''
  }, [own])

  const team = useMemo(() => {
    const byId = new Map(profiles.map(p => [p.id, p]))
    const ids = new Set<string>()
    for (const m of members) if (m.project_id === raw.id && m.profile_id) ids.add(m.profile_id)
    for (const t of own) if (t.assignee_id) ids.add(t.assignee_id)
    if (raw.lead_id) ids.add(raw.lead_id)
    return [...ids].map(id => byId.get(id)).filter((p): p is ProjectProfileRow => !!p)
  }, [members, profiles, own, raw.id, raw.lead_id])

  const [name, setName] = useState(raw.name ?? '')
  const [desc, setDesc] = useState(raw.description ?? '')
  const [start, setStart] = useState(raw.period_start ?? derivedStart)
  const [end, setEnd] = useState(raw.period_end ?? derivedEnd)
  const [mode, setMode] = useState<'none' | 'complete' | 'archive'>('none')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const isCompleted = raw.status === 'completed'

  async function run(fn: () => Promise<void>, msg: string, close: boolean) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      await onDone(msg, close)
      setMode('none'); setNote('')
    } catch (e) {
      await onDone(e instanceof Error ? e.message : 'Falha ao atualizar o projeto.', false)
    } finally {
      setBusy(false)
    }
  }

  const save = () => run(
    () => updateProject(raw, {
      name: name.trim() || raw.name,
      description: desc.trim() || null,
      periodStart: start || null,
      periodEnd: end || null,
    }, actorName),
    'Projeto atualizado', false,
  )

  const finalize = () => {
    const now = new Date().toISOString()
    const metadata = {
      ...((raw.metadata ?? {}) as Record<string, unknown>),
      finalize_note: note.trim(), finalized_by: actorName, finalized_at: now,
    }
    return run(() => updateProject(raw, { status: 'completed', metadata }, actorName), 'Projeto finalizado', true)
  }

  const reopen = () => run(() => updateProject(raw, { status: 'active' }, actorName), 'Projeto reaberto', false)

  const archive = () => {
    const now = new Date().toISOString()
    const metadata = {
      ...((raw.metadata ?? {}) as Record<string, unknown>),
      archive_note: note.trim(), archived_by: actorName, archived_at: now,
    }
    return run(() => updateProject(raw, { archivedAt: now, metadata }, actorName), 'Projeto arquivado', true)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-xl fade-rise flex flex-col"
        style={{ maxWidth: 640, maxHeight: '85vh', background: '#1c2130', border: '1px solid #2f3547' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2f3547' }}>
          <span className="w-2.5 h-2.5 rounded-sm mt-1.5 flex-shrink-0" style={{ background: project.color }} />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate" style={{ color: '#e8ecf4' }}>
              Editar projeto — {project.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-[11px] px-1.5 py-0.5 rounded border" style={{ color: '#8a9ab8', borderColor: '#2f3547' }}>
                {raw.key}
              </span>
              <span className="text-[11px]" style={{ color: '#546278' }}>{project.client}</span>
              <StatusBadge status={project.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ color: '#8a9ab8', background: '#141926' }}
            aria-label="Fechar"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: '#8a9ab8' }}>Nome do projeto</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-xs outline-none"
              style={inputStyle}
              placeholder="Nome do projeto"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: '#8a9ab8' }}>Descrição</span>
            <textarea
              rows={4}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y"
              style={inputStyle}
              placeholder="Descreva o objetivo do projeto…"
            />
          </label>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: '#8a9ab8' }}>Período</p>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#546278' }}>Início</span>
                <input
                  type="date" value={start} onChange={e => setStart(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg text-xs outline-none" style={inputStyle}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#546278' }}>Fim</span>
                <input
                  type="date" value={end} onChange={e => setEnd(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg text-xs outline-none" style={inputStyle}
                />
              </label>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium mb-2" style={{ color: '#8a9ab8' }}>Equipe ativa</p>
            {team.length === 0 ? (
              <p className="text-xs" style={{ color: '#546278' }}>Nenhum membro atribuído</p>
            ) : (
              <div className="flex flex-wrap gap-2" style={{ maxHeight: 160, overflowY: 'auto' }}>
                {team.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: '#141926' }}>
                    <Avatar name={m.name} size="xs" color={m.avatar_color ?? undefined} initials={m.avatar_initials ?? undefined} />
                    <span className="text-xs truncate" style={{ color: '#8a9ab8', maxWidth: 140 }}>{m.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => { void save() }}
              disabled={busy}
              className="px-3.5 py-2 rounded-lg text-xs font-medium"
              style={{ background: '#3B82F6', color: '#fff', opacity: busy ? 0.5 : 1 }}
            >
              {busy ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>

          {/* Lifecycle zone */}
          <div className="pt-4 flex flex-col gap-3" style={{ borderTop: '1px solid #2f3547' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#546278' }}>
              Ciclo de vida
            </p>

            <div className="flex flex-wrap gap-2">
              {isCompleted ? (
                <button
                  onClick={() => { void reopen() }}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ color: '#8a9ab8', border: '1px solid #2f3547' }}
                >
                  Reabrir projeto
                </button>
              ) : (
                <button
                  onClick={() => { setMode(m => (m === 'complete' ? 'none' : 'complete')); setNote('') }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ color: '#06C18A', border: '1px solid #0f4030', background: '#0a2520' }}
                >
                  Finalizar projeto
                </button>
              )}
              <button
                onClick={() => { setMode(m => (m === 'archive' ? 'none' : 'archive')); setNote('') }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: '#f0805c', border: '1px solid #4a2018', background: '#2a1210' }}
              >
                Arquivar projeto
              </button>
            </div>

            {mode !== 'none' && (
              <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: '#141926', border: '1px solid #2f3547' }}>
                <span className="text-[11px] font-medium" style={{ color: '#8a9ab8' }}>
                  Observação <span style={{ color: '#f0805c' }}>*</span>
                </span>
                <textarea
                  rows={3}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y"
                  style={{ background: '#0f131d', border: '1px solid #2f3547', color: '#e8ecf4' }}
                  placeholder={mode === 'archive'
                    ? 'Por que este projeto está sendo arquivado?'
                    : 'Registre o encerramento do projeto…'}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setMode('none'); setNote('') }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ color: '#8a9ab8', border: '1px solid #2f3547' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { void (mode === 'archive' ? archive() : finalize()) }}
                    disabled={busy || note.trim().length === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: mode === 'archive' ? '#b23c22' : '#0f7a58',
                      color: '#fff',
                      opacity: busy || note.trim().length === 0 ? 0.45 : 1,
                      cursor: busy || note.trim().length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {mode === 'archive' ? 'Confirmar arquivamento' : 'Confirmar finalização'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// ─── Mapping ──────────────────────────────────────────────────────────────────
function buildProjects(
  rows: ProjectRow[],
  tasks: ProjectTaskRow[],
  profiles: ProjectProfileRow[],
  boards: ProjectBoardRow[],
): Project[] {
  const profileById = new Map(profiles.map(p => [p.id, p]))

  function toSubTask(t: ProjectTaskRow): SubTask {
    return {
      id: t.id,
      name: `${t.key} · ${t.title}`,
      period: fmtPeriod(t.start_date, t.due_date),
      pct: t.status === 'done' ? 100 : (t.progress ?? 0),
      status: ITEM_STATUS_MAP[t.status] ?? 'pendente',
      responsible: (t.assignee_id && profileById.get(t.assignee_id)?.name) || 'Não atribuído',
      type: t.type ?? '',
      parentId: t.parent_id ?? null,
      children: [],
    }
  }

  return rows.map((p, i) => {
    const own = tasks.filter(t => t.project_id === p.id)
    const board = boards.find(b => b.project_id === p.id) ?? null
    const top = own.filter(t => t.parent_id == null)
    const sub = own.filter(t => t.parent_id != null)
    return {
      id: p.id,
      name: p.name,
      client: p.client_name ?? '—',
      color: projectColor(p, i),
      period: fmtPeriod(p.period_start, p.period_end),
      pct: projectProgress(own),
      status: PROJECT_STATUS_MAP[p.status] ?? 'pendente',
      responsible: (p.lead_id && profileById.get(p.lead_id)?.name) || 'Sem responsável',
      boardId: board?.id ?? null,
      tasks: top.map(t => ({ ...toSubTask(t), children: sub.filter(s => s.parent_id === t.id).map(toSubTask) })),
      raw: p,
    }
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────
interface Props {
  onNav?: (v: string, targetId?: string) => void
}

export default function ProjectsListPage({ onNav }: Props) {
  const { activeUser, tenantName, isTenantOwner } = useSession()
  const canManageProjects = can(activeUser.permissions, 'project:create') || isTenantOwner
  const canEdit = can(activeUser.permissions, 'edit:workitem')

  const [newProjOpen, setNewProjOpen] = useState(false)
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [tasks, setTasks] = useState<ProjectTaskRow[]>([])
  const [profiles, setProfiles] = useState<ProjectProfileRow[]>([])
  const [members, setMembers] = useState<ProjectMemberRow[]>([])
  const [boards, setBoards] = useState<ProjectBoardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Project | null>(null)
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listProjects()
      setRows(data.projects)
      setTasks(data.tasks)
      setProfiles(data.profiles)
      setMembers(data.members)
      setBoards(data.boards)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar os projetos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const projects = useMemo(
    () => buildProjects(rows, tasks, profiles, boards),
    [rows, tasks, profiles, boards],
  )

  /**
   * Projetos agrupados por Cliente (Cliente → Projetos), case-insensitive:
   * "Cobasi" e "cobasi" caem no mesmo grupo. Rótulo prefere a variante com maiúscula.
   * "Sem cliente" vai por último.
   */
  const projectsByClient = useMemo(() => {
    const groups = new Map<string, { label: string; items: Project[] }>()
    for (const p of projects) {
      const raw = p.client && p.client !== '—' ? p.client.trim() : 'Sem cliente'
      const key = raw.toLowerCase()
      let g = groups.get(key)
      if (!g) { g = { label: raw, items: [] }; groups.set(key, g) }
      else if (/[A-Z]/.test(raw) && !/[A-Z]/.test(g.label)) g.label = raw
      g.items.push(p)
    }
    return [...groups.values()].sort((a, b) =>
      a.label.toLowerCase() === 'sem cliente' ? 1
        : b.label.toLowerCase() === 'sem cliente' ? -1
          : a.label.localeCompare(b.label),
    )
  }, [projects])

  // Keep the open modal in sync with reloaded data
  useEffect(() => {
    setEditing(prev => (prev ? projects.find(p => p.id === prev.id) ?? null : null))
  }, [projects])

  const totalTasks = projects.reduce((s, p) => s + countAllTasks(p), 0)
  const inProgress = projects.filter(p => p.status === 'em progresso').length
  const done       = projects.reduce((s, p) => s + countDone(p), 0)

  function handleOpenProject(p: Project) {
    onNav?.('project', p.id)
  }

  function handleOpenTask(task: SubTask) {
    setDetailItemId(task.id)
  }

  async function handleCreateProject(input: NewProjectInput) {
    await createProject({
      name: input.name,
      key: input.key,
      description: input.description || null,
      clientName: input.clientName,
      boardType: input.boardType,
      leadId: input.leadId,
      usesFeatures: input.usesFeatures,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      actorName: activeUser.name,
    })
    await load()
  }

  function showToast(msg: string) {
    setToast({ msg, show: true })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }



  return (
    <>
      <div className="flex flex-col h-full" style={{ background: 'var(--bg-page, #0d1321)' }}>
        {/* Page header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1c2c45' }}>
          <div>
            <h1 className="text-base font-bold" style={{ color: '#e8ecf4' }}>Projetos & Tarefas</h1>
            <p className="text-xs mt-0.5" style={{ color: '#546278' }}>
              {loading
                ? 'Carregando…'
                : <>{projects.length} projetos &nbsp;·&nbsp; {inProgress} em progresso &nbsp;·&nbsp; {totalTasks} tarefas &nbsp;·&nbsp; {done} concluída{done !== 1 ? 's' : ''}</>}
            </p>
          </div>
          {can(activeUser.permissions, 'project:create') && (
            <button
              onClick={() => setNewProjOpen(true)}
              data-tour="new-project-btn"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110"
              style={{ background: '#4d82ff' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Novo Projeto
            </button>
          )}
        </div>

        {error && (
          <div className="px-6 py-3 text-xs" style={{ color: '#ff6b6b', borderBottom: '1px solid #1c2c45' }}>
            {error}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded animate-pulse" style={{ background: '#151f30' }} />
              ))}
            </div>
          ) : projects.length === 0 && !error ? (
            <div className="p-10 text-center text-sm" style={{ color: '#546278' }}>
              Nenhum projeto encontrado
            </div>
          ) : (
            <table className="w-full border-collapse" style={{ minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1c2c45', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ width: 24 }} />
                  {['Nome', 'Período', 'Progresso', 'Status', 'Responsável', 'Ações'].map(h => (
                    <th
                      key={h}
                      className="py-2.5 pr-6 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: '#546278' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectsByClient.map(group => (
                  <Fragment key={group.label.toLowerCase()}>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid #1c2c45' }}>
                      <td colSpan={7} className="py-2 px-6">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3B82F6' }} />
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#8aa0bd' }}>
                            {group.label}
                          </span>
                          <span className="text-[10px]" style={{ color: '#546278' }}>
                            · {group.items.length} {group.items.length === 1 ? 'projeto' : 'projetos'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map(p => (
                      <ProjectListRow
                        key={p.id}
                        project={p}
                        canManage={canManageProjects}
                        onOpenProj={handleOpenProject}
                        onOpenTask={handleOpenTask}
                        onEdit={setEditing}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Task detail drawer — real work item from the database */}
      {detailItemId && (
        <WorkItemDetail
          itemId={detailItemId}
          mode="drawer"
          onUpdate={canEdit ? () => { void load() } : () => {}}
          onClose={() => { setDetailItemId(null); void load() }}
        />
      )}

      {newProjOpen && (
        <NewProjectModal
          onClose={() => setNewProjOpen(false)}
          onSuccess={() => { setNewProjOpen(false); onNav?.('project') }}
          onCreate={handleCreateProject}
          leads={profiles
            .filter(p => p.can_create_projects)
            .map(p => ({
              id: p.id,
              name: p.name,
              initials: p.avatar_initials ?? p.name.slice(0, 2).toUpperCase(),
            }))}
          clients={[...new Set(rows.map(r => r.client_name).filter((c): c is string => !!c && c.trim().length > 0))].sort((a, b) => a.localeCompare(b))}
          existingKeys={rows.map(r => r.key)}
          tenantName={tenantName}
        />
      )}

      {/* Unified project edit modal */}
      {editing && (
        <EditProjectModal
          project={editing}
          tasks={tasks}
          members={members}
          profiles={profiles}
          actorName={activeUser.name}
          onClose={() => setEditing(null)}
          onDone={async (msg, close) => {
            await load()
            showToast(msg)
            if (close) setEditing(null)
          }}
        />
      )}


      {/* Inline toast */}
      {toast.show && (
        <div
          className="fixed bottom-5 right-5 z-[100] px-4 py-2.5 rounded-lg text-xs font-medium shadow-lg fade-rise"
          style={{ background: '#1c2130', color: '#e8ecf4', border: '1px solid #2f3547' }}
        >
          {toast.msg}
        </div>
      )}
    </>
  )
}
