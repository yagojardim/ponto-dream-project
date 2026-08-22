import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '../components/ds/Avatar'
import { NewProjectModal, type NewProjectInput } from '../components/NewProjectModal'
import { WorkItemDetail } from '../components/WorkItemDetail'
import { useSession } from '../data/SessionContext'
import { can } from '../data/permissions'
import {
  listProjects, createProject, updateProject, projectColor, projectProgress,
  type ProjectRow, type ProjectTaskRow, type ProjectProfileRow, type ProjectBoardRow,
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

type ProjectAction = 'complete' | 'reopen' | 'archive' | 'edit'

interface ConfirmState {
  open: boolean
  project: Project | null
  action: ProjectAction
}

// ─── Project row ──────────────────────────────────────────────────────────────
interface ProjectRowProps {
  project:     Project
  canManage:   boolean
  onOpenProj:  (p: Project) => void
  onOpenTask:  (task: SubTask, project: Project) => void
  onConfirm:   (p: Project, action: ProjectAction) => void
}

function ProjectListRow({ project, canManage, onOpenProj, onOpenTask, onConfirm }: ProjectRowProps) {
  const [expanded, setExpanded] = useState(true)
  const [openTasks, setOpenTasks] = useState<Record<string, boolean>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) {
      document.addEventListener('mousedown', close)
      return () => document.removeEventListener('mousedown', close)
    }
  }, [menuOpen])

  const rawStatus = project.raw.status
  const isCompleted = rawStatus === 'completed'
  const menuLabel = isCompleted ? 'Reabrir projeto' : 'Finalizar projeto'

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
            <div ref={menuRef} className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                style={{ color: '#546278' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#e8ecf4' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#546278' }}
                aria-label="Ações do projeto"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="3.5" r="1.2" fill="currentColor" />
                  <circle cx="7" cy="7" r="1.2" fill="currentColor" />
                  <circle cx="7" cy="10.5" r="1.2" fill="currentColor" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 py-1 rounded-lg fade-rise"
                  style={{
                    background: '#171a22',
                    border: '1px solid #2f3547',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    minWidth: 160,
                  }}
                >
                  <button
                    onClick={() => { setMenuOpen(false); onConfirm(project, isCompleted ? 'reopen' : 'complete') }}
                    className="w-full text-left px-3 py-2 text-[11px] transition-colors"
                    style={{ color: '#e8ecf4' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    {menuLabel}
                  </button>
                </div>
              )}
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
  const [boards, setBoards] = useState<ProjectBoardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, project: null, action: 'complete' })
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listProjects()
      setRows(data.projects)
      setTasks(data.tasks)
      setProfiles(data.profiles)
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
      actorName: activeUser.name,
    })
    await load()
  }

  function showToast(msg: string) {
    setToast({ msg, show: true })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }

  function handleConfirm(p: Project, action: 'complete' | 'reopen') {
    setConfirm({ open: true, project: p, action })
  }

  async function executeStatusUpdate() {
    if (!confirm.project) return
    const p = confirm.project
    const nextStatus = confirm.action === 'complete' ? 'completed' : 'active'
    try {
      await updateProject(p.raw, { status: nextStatus }, activeUser.name)
      await load()
      showToast(confirm.action === 'complete' ? 'Projeto finalizado' : 'Projeto reaberto')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao atualizar o projeto.')
    } finally {
      setConfirm({ open: false, project: null, action: 'complete' })
    }
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
                {projects.map(p => (
                  <ProjectListRow
                    key={p.id}
                    project={p}
                    canManage={canManageProjects}
                    onOpenProj={handleOpenProject}
                    onOpenTask={handleOpenTask}
                    onConfirm={handleConfirm}
                  />
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
          leads={profiles.map(p => ({
            id: p.id,
            name: p.name,
            initials: p.avatar_initials ?? p.name.slice(0, 2).toUpperCase(),
          }))}
          existingKeys={rows.map(r => r.key)}
          tenantName={tenantName}
        />
      )}

      {/* Confirm status change */}
      {confirm.open && confirm.project && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
          onClick={() => setConfirm({ open: false, project: null, action: 'complete' })}
        >
          <div
            className="w-full max-w-md p-5 rounded-xl fade-rise"
            style={{ background: '#1c2130', border: '1px solid #2f3547' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: '#e8ecf4' }}>
              {confirm.action === 'complete' ? 'Finalizar projeto' : 'Reabrir projeto'}
            </h3>
            <p className="text-xs mb-5 leading-relaxed" style={{ color: '#8a9ab8' }}>
              {confirm.action === 'complete'
                ? <>Finalizar <strong>{confirm.project.name}</strong>? As demandas em aberto continuarão registradas.</>
                : <>Reabrir <strong>{confirm.project.name}</strong>? O projeto voltará ao status ativo.</>}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm({ open: false, project: null, action: 'complete' })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: '#8a9ab8', border: '1px solid #2f3547' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                Cancelar
              </button>
              <button
                onClick={executeStatusUpdate}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#3B82F6', color: '#fff' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2563EB' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#3B82F6' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
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
