import { useState, useRef, useEffect, useCallback } from 'react'
import { useClientPortal } from '../data/clientPortalStore'
import type {
  PortalScope, ScopeProject, ScopeSprint, ScopeDelivery, ScopeMilestone,
} from '../data/clientPortalStore'
import {
  getClientUnreadReplies, markReplyReadByClient, markAllClientRepliesRead,
  type ClientSignal,
} from '../data/clientSignals'
import {
  addClientMessage, addClientApproval, listThreadMessages, listProjectChat,
  markSignalReadByPo, DEFAULT_TENANT_ID, type ClientChatMessage,
} from '../data/db/clientPortal'
import { getClientPermissions, getClientAccess, updateClientPassword } from '../data/clientAccess'

/** Tenant real (Supabase) — nunca o mock. */
const MOCK_TENANT = { tenant_id: DEFAULT_TENANT_ID }

// Inspection Mode: the portal client is always "João Silva" (mock)
const CLIENT_AUTHOR = 'João Silva'


// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       '#0e1016',
  surface:  '#171a22',
  surface2: '#1e2230',
  border:   '#262b37',
  border2:  '#2f3547',
  txt:      '#e7eaf2',
  txt2:     '#a2a8ba',
  txt3:     '#6a7390',
  accent:   '#7d92ff',
  success:  '#35c9ae',
  warn:     '#e6b23c',
  crit:     '#f0805c',
  radius:   '12px',
}

const SEV_COLOR = { low: C.success, medium: C.warn, high: C.crit, critical: '#e03a50' }
const SEV_LABEL = { low: 'Baixo', medium: 'Médio', high: 'Alto', critical: 'Crítico' }

// ─── Local toast (portal is standalone — no global ToastProvider) ────────────
interface LocalToast { id: string; msg: string; type: 'success' | 'info' }

function useLocalToast() {
  const [toasts, setToasts] = useState<LocalToast[]>([])
  const add = useCallback((msg: string, type: LocalToast['type'] = 'success') => {
    const id = `t${Date.now()}`
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3800)
  }, [])
  return { toasts, add }
}

function LocalToastStack({ toasts }: { toasts: LocalToast[] }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl fade-rise pointer-events-auto"
          style={{
            background: C.surface,
            border: `1px solid ${t.type === 'success' ? C.success + '50' : C.accent + '50'}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            minWidth: 280,
          }}
        >
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: t.type === 'success' ? `${C.success}18` : `${C.accent}18` }}
          >
            {t.type === 'success'
              ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: C.success }}><path d="M2 6.5L5 9.5L11 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: C.accent }}><path d="M6.5 4v4M6.5 9v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            }
          </span>
          <p className="text-xs font-medium flex-1" style={{ color: C.txt }}>{t.msg}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Shared mini-components ───────────────────────────────────────────────────
function SevBadge({ level }: { level: keyof typeof SEV_COLOR }) {
  const c = SEV_COLOR[level]
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
      style={{ color: c, background: `${c}18`, borderColor: `${c}40` }}
    >
      {SEV_LABEL[level]}
    </span>
  )
}

function CardShell({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`flex flex-col ${className}`}
      style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderRight: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        borderLeft: `1px solid ${C.border}`,
        borderRadius: C.radius,
        boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-sm font-semibold" style={{ color: C.txt }}>{children}</span>
      {action}
    </div>
  )
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

// ─── Client comment thread ────────────────────────────────────────────────────
/** Resolve o project_id real (Supabase) a partir do nome exibido no portal. */
function portalProjectId(name: string): string | null {
  const p = PROJECTS.find(
    proj => proj.name === name || name.startsWith(proj.name) || proj.name.startsWith(name),
  )
  return p?.id ?? null
}

function ClientCommentInput({
  itemId, itemTitle, project, onSent,
}: {
  itemId: string; itemTitle: string; project: string
  onSent: (msg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [val, setVal]   = useState('')
  const canComment = getClientPermissions(MOCK_TENANT.tenant_id, CLIENT_AUTHOR).client_can_comment

  async function send() {
    const body = val.trim()
    const pid = portalProjectId(project)
    if (!body || !pid) return
    await addClientMessage({
      projectId: pid,
      body,
      author:    CLIENT_AUTHOR,
      source:    'client',
      itemId,
      itemTitle,
    })
    onSent(body)
    setVal('')
    setOpen(false)
  }


  if (!canComment) {
    return (
      <span className="text-[10px]" style={{ color: C.txt3 }}>Acesso somente leitura</span>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] font-medium h-6 px-2.5 rounded-lg transition-all"
        style={{ color: C.txt3, background: C.surface2, border: `1px solid ${C.border}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.accent; (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent + '60' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.txt3; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
      >
        + Comentar
      </button>
    )
  }

  return (
    <div
      className="mt-2 rounded-xl p-3 flex flex-col gap-2"
      style={{ background: C.surface2, border: `1px solid ${C.border2}` }}
    >
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Escreva seu comentário ou feedback..."
        rows={3}
        autoFocus
        className="w-full text-xs rounded-lg px-3 py-2 outline-none resize-none font-[inherit]"
        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.txt, caretColor: C.accent }}
        onFocus={e => { e.currentTarget.style.borderColor = C.accent + '80' }}
        onBlur={e => { e.currentTarget.style.borderColor = C.border }}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setVal('') } }}
      />
      <div className="flex items-center justify-between">
        <p className="text-[9px]" style={{ color: C.txt3 }}>Esc para cancelar · seu comentário é enviado ao responsável pelo projeto</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setOpen(false); setVal('') }}
            className="h-6 px-2.5 text-[10px] font-medium rounded-lg"
            style={{ color: C.txt3 }}
          >
            Cancelar
          </button>
          <button
            onClick={send}
            disabled={!val.trim()}
            className="h-6 px-3 text-[10px] font-semibold rounded-lg transition-all"
            style={{
              background: val.trim() ? C.accent : C.surface,
              color: val.trim() ? '#fff' : C.txt3,
              border: `1px solid ${val.trim() ? C.accent : C.border}`,
            }}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}

function ClientSignalThread({ itemId, project, refresh }: {
  itemId: string; project: string; refresh: number
}) {
  const [messages, setMessages] = useState<ClientChatMessage[]>([])

  useEffect(() => {
    let alive = true
    const pid = portalProjectId(project)
    if (!pid) { setMessages([]); return }
    ;(async () => {
      const rows = await listThreadMessages(pid, itemId)
      if (!alive) return
      setMessages(rows)
      // O cliente visualizou a thread: marca os sinais como lidos no banco.
      await Promise.all(rows.filter(r => r.side === 'client').map(r => markSignalReadByPo(r.id)))
    })()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, project, refresh])

  if (!messages.length) return null

  return (
    <div className="mt-2 space-y-2">
      {messages.map(c => c.side === 'client' ? (
        <div
          key={c.id}
          className="rounded-xl px-3 py-2.5"
          style={{ background: `${C.accent}0C`, border: `1px solid ${C.accent}20` }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{ background: C.accent, color: '#fff' }}
            >{c.author.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()}</span>
            <span className="text-[10px] font-semibold" style={{ color: C.accent }}>{c.author}</span>
            <span className="text-[9px]" style={{ color: C.txt3 }}>{new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: C.txt2 }}>{c.body}</p>
        </div>
      ) : (
        <div
          key={c.id}
          className="ml-4 rounded-xl px-3 py-2.5"
          style={{ background: `${C.success}08`, border: `1px solid ${C.success}25` }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{ background: C.success, color: '#fff' }}
            >BA</span>
            <span className="text-[10px] font-semibold" style={{ color: C.success }}>{c.author}</span>
            <span
              className="text-[9px] px-1.5 py-px rounded-full"
              style={{ color: C.success, background: `${C.success}18` }}
            >resposta pública</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: C.txt2 }}>{c.body}</p>
        </div>
      ))}
    </div>
  )
}


// ─── Data (live, hydrated from Supabase via useClientPortal) ──────────────────
// These module-level bindings are refreshed by the portal shell on every render
// so the presentational sub-components below keep their original shape.
type LiveProject  = ScopeProject
type LiveDelivery = ScopeDelivery

let PROJECTS: LiveProject[] = []
let SPRINTS: ScopeSprint[] = []
let SPRINT_DELIVERIES: LiveDelivery[] = []
let VALIDATION_ITEMS: { id: string; title: string; project: string; dueDate: string }[] = []
let ROADMAP: ScopeMilestone[] = []
let RECENT_DELIVERIES: { id: string; title: string; project: string; date: string }[] = []
let RISKS: { id: string; title: string; sev: 'high' | 'medium' | 'low'; project: string; days: number; detail: string }[] = []

/** Projects the current portal client is allowed to see, mapped to view models. */
function applyScope(scope: PortalScope) {
  PROJECTS  = scope.projects
  SPRINTS   = scope.sprints
  ROADMAP   = scope.roadmap
  SPRINT_DELIVERIES = scope.deliveries.filter(d => d.status !== 'done')
    .concat(scope.deliveries.filter(d => d.status === 'done'))
  VALIDATION_ITEMS = scope.deliveries
    .filter(d => d.status === 'review')
    .map(d => ({ id: d.id, title: d.title, project: d.project, dueDate: d.due }))
  RECENT_DELIVERIES = scope.deliveries
    .filter(d => d.status === 'done')
    .slice(0, 6)
    .map(d => ({ id: d.id, title: d.title, project: d.project, date: d.date }))
  RISKS = scope.deliveries
    .filter(d => d.overdueDays > 0)
    .slice(0, 6)
    .map(d => ({
      id: `risk-${d.id}`,
      title: `${d.title} — prazo ultrapassado`,
      sev: (d.overdueDays > 7 ? 'high' : d.overdueDays > 2 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      project: d.project,
      days: d.overdueDays,
      detail: `A entrega estava prevista para ${d.due} e segue em andamento. A equipe está acompanhando e informará a nova previsão.`,
    }))
}

const DELIVERY_STATUS = {
  done:     { label: 'Concluído',   color: C.success },
  review:   { label: 'Em revisão',  color: C.warn    },
  progress: { label: 'Em andamento', color: C.accent  },
}


// ─── RISK OVERLAY ─────────────────────────────────────────────────────────────
function RiskOverlay({ risk, onClose }: { risk: typeof RISKS[0]; onClose: () => void }) {
  const c = SEV_COLOR[risk.sev]
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg flex flex-col fade-rise"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderTop: `3px solid ${c}`,
          borderRadius: C.radius,
          boxShadow: '0 32px 80px rgba(0,0,0,0.56)',
          maxHeight: '80vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <SevBadge level={risk.sev} />
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ color: C.txt3, background: C.surface2, border: `1px solid ${C.border}` }}
              >
                Somente leitura
              </span>
            </div>
            <h2 className="text-sm font-semibold leading-snug" style={{ color: C.txt }}>{risk.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
            style={{ color: C.txt3, background: C.surface2 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.txt }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.txt3 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.txt3 }}>Descrição do risco</p>
            <p className="text-sm leading-relaxed" style={{ color: C.txt2 }}>{risk.detail}</p>
          </div>

          {/* Metadata grid */}
          <div
            className="grid grid-cols-2 gap-3 p-4 rounded-xl"
            style={{ background: C.surface2, border: `1px solid ${C.border}` }}
          >
            {[
              { label: 'Projeto',    val: risk.project         },
              { label: 'Impacto',    val: `${risk.days} dia(s)` },
              { label: 'Severidade', val: SEV_LABEL[risk.sev]  },
              { label: 'Status',     val: 'Em tratamento'       },
            ].map(m => (
              <div key={m.label}>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: C.txt3 }}>{m.label}</p>
                <p className="text-xs font-medium" style={{ color: C.txt }}>{m.val}</p>
              </div>
            ))}
          </div>

          {/* Read-only notice */}
          <div
            className="flex items-start gap-2.5 p-3 rounded-xl"
            style={{ background: `${C.accent}0E`, border: `1px solid ${C.accent}25` }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: C.accent, flexShrink: 0, marginTop: 1 }}>
              <path d="M7 3.5v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <p className="text-xs" style={{ color: C.txt2 }}>
              Este item está sendo acompanhado pela equipe. Em caso de dúvidas, utilize o canal de comunicação do projeto.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CARD 1: Project progress bar ────────────────────────────────────────────
function ProgressCard({ project }: { project: typeof PROJECTS[0] }) {
  const c = project.status === 'at-risk' ? C.warn : C.success
  return (
    <CardShell>
      <CardTitle>
        Evolução do projeto
        <Pill color={c} label={project.status === 'at-risk' ? 'Em risco' : 'No prazo'} />
      </CardTitle>
      <div className="px-5 py-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="text-5xl font-bold tabular-nums" style={{ color: C.txt }}>{project.progress}</span>
            <span className="text-2xl font-bold" style={{ color: C.txt2 }}>%</span>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: C.txt2 }}>{project.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: C.txt3 }}>{project.sprint}</p>
          </div>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${c}cc, ${c})` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px]" style={{ color: C.txt3 }}>
          {[0, 25, 50, 75, 100].map(v => <span key={v}>{v}%</span>)}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          {[
            { label: 'Tarefas concluídas', val: '84 / 124'   },
            { label: 'Sprint atual',        val: project.sprintPct + '%' },
            { label: 'Prazo',               val: '14 ago 2025' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className="text-sm font-bold tabular-nums" style={{ color: C.txt }}>{m.val}</p>
              <p className="text-[10px] mt-0.5" style={{ color: C.txt3 }}>{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  )
}

// ─── CARD 2: Sprint deliveries (client-safe, replaces Burndown) ───────────────
function SprintDeliveriesCard({ projectFilter, onComment }: { projectFilter: Set<string>; onComment: (msg: string) => void }) {
  const [refresh, setRefresh] = useState(0)
  const projectNames = new Set(PROJECTS.filter(p => projectFilter.has(p.id)).map(p => p.name))
  const items = SPRINT_DELIVERIES.filter(d => projectNames.size === 0 || projectNames.has(d.project))

  return (
    <CardShell>
      <CardTitle>Entregas desta sprint</CardTitle>
      <div className="px-4 py-3 space-y-3">
        {items.map(d => {
          const s = DELIVERY_STATUS[d.status]
          return (
            <div
              key={d.id}
              className="px-3 py-2.5 rounded-xl"
              style={{ background: C.surface2, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-xs leading-snug" style={{ color: C.txt }}>{d.title}</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}35` }}
                >
                  {s.label}
                </span>
                <ClientCommentInput
                  itemId={d.id} itemTitle={d.title} project={d.project}
                  onSent={_msg => { setRefresh(r => r + 1); onComment('Feedback enviado à equipe responsável.') }}
                />
              </div>
              <ClientSignalThread itemId={d.id} project={d.project} refresh={refresh} />
            </div>
          )
        })}
      </div>
    </CardShell>
  )
}

// ─── CARD 3: Project count ────────────────────────────────────────────────────
function ProjectCountCard({ count }: { count: number }) {
  const onTrack = PROJECTS.filter(p => p.status === 'on-track').length
  const atRisk  = PROJECTS.filter(p => p.status === 'at-risk').length
  return (
    <CardShell>
      <CardTitle>Projetos</CardTitle>
      <div className="px-5 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="text-6xl font-bold tabular-nums leading-none" style={{ color: C.txt }}>{count}</span>
          <div className="space-y-1.5">
            <Pill color={C.success} label={`${onTrack} no prazo`} />
            <br />
            <Pill color={C.warn}    label={`${atRisk} em risco`} />
          </div>
        </div>
        <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
          {PROJECTS.map(p => {
            const c = p.status === 'at-risk' ? C.warn : C.success
            return (
              <div key={p.id} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                <span className="flex-1 text-xs truncate" style={{ color: C.txt2 }}>{p.name}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: C.txt }}>{p.progress}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </CardShell>
  )
}

// ─── CARD 4: Active sprint ────────────────────────────────────────────────────
function ActiveSprintCard() {
  return (
    <CardShell>
      <CardTitle>Sprint ativa</CardTitle>
      <div className="px-4 py-3 space-y-3">
        {SPRINTS.map(s => {
          const c = s.status === 'at-risk' ? C.warn : C.success
          return (
            <div
              key={s.name}
              className="p-3 rounded-xl"
              style={{ background: C.surface2, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium truncate" style={{ color: C.txt }}>{s.name}</span>
                <span className="text-xs font-bold tabular-nums ml-2 flex-shrink-0" style={{ color: c }}>{s.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: c }} />
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: C.txt3 }}>Termina em {s.ends}</p>
            </div>
          )
        })}
      </div>
    </CardShell>
  )
}

// ─── CARD 5: Risks ────────────────────────────────────────────────────────────
function RisksCard() {
  const [activeRisk, setActiveRisk] = useState<typeof RISKS[0] | null>(null)
  return (
    <>
      <CardShell>
        <CardTitle>
          Riscos abertos
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ color: C.crit, background: `${C.crit}20` }}
          >
            {RISKS.length}
          </span>
        </CardTitle>
        <div className="px-4 py-3 space-y-2">
          {RISKS.map(r => {
            const c = SEV_COLOR[r.sev]
            return (
              <button
                key={r.id}
                onClick={() => setActiveRisk(r)}
                className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                style={{ background: C.surface2, border: `1px solid ${C.border}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = c + '60'; (e.currentTarget as HTMLButtonElement).style.background = `${c}08` }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.background = C.surface2 }}
              >
                <span className="w-1 h-full min-h-[32px] rounded-full flex-shrink-0 mt-0.5" style={{ background: c }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug mb-1 truncate" style={{ color: C.txt }}>{r.title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SevBadge level={r.sev} />
                    <span className="text-[10px]" style={{ color: C.txt3 }}>{r.project}</span>
                    <span className="text-[10px]" style={{ color: C.txt3 }}>· {r.days}d impacto</span>
                  </div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: C.txt3, flexShrink: 0, marginTop: 2 }}>
                  <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )
          })}
        </div>
      </CardShell>
      {activeRisk && <RiskOverlay risk={activeRisk} onClose={() => setActiveRisk(null)} />}
    </>
  )
}

// ─── CARD 6: Awaiting client validation ──────────────────────────────────────
function ValidationCard({ onComment }: { onComment: (msg: string) => void }) {
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const [refresh, setRefresh] = useState(0)

  const perms = getClientPermissions(MOCK_TENANT.tenant_id, CLIENT_AUTHOR)

  function handleSent(_msg: string) {
    setRefresh(r => r + 1)
    onComment(`Comentário enviado — a equipe responsável será notificada.`)
  }

  return (
    <CardShell style={{ borderLeft: `3px solid ${C.success}` }}>
      <CardTitle>
        Aguardando sua validação
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ color: C.success, background: `${C.success}20` }}
        >
          {VALIDATION_ITEMS.length - approved.size} pendentes
        </span>
      </CardTitle>
      <div className="px-4 py-3 space-y-2">
        {VALIDATION_ITEMS.map(v => {
          const done = approved.has(v.id)
          return (
            <div
              key={v.id}
              className="p-3 rounded-xl transition-all"
              style={{
                background: done ? `${C.success}08` : C.surface2,
                border: `1px solid ${done ? C.success + '40' : C.border}`,
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug" style={{ color: done ? C.txt3 : C.txt, textDecoration: done ? 'line-through' : 'none' }}>{v.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: C.txt3 }}>{v.project} · Prazo: {v.dueDate}</p>
                </div>
              </div>
              {!done ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {perms.client_can_preview && (
                    <button
                      className="h-7 px-3 rounded-lg text-xs font-medium transition-all"
                      style={{ background: C.surface, border: `1px solid ${C.border2}`, color: C.txt2 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border2 }}
                    >
                      Ver preview
                    </button>
                  )}
                  {perms.client_can_approve && (
                    <button
                      onClick={() => {
                        setApproved(prev => new Set([...prev, v.id]))
                        addClientSignal({
                          type: 'approval', item_id: v.id, item_title: v.title,
                          project: v.project, tenant_id: MOCK_TENANT.tenant_id,
                          responsible_po: 'u_po', author: 'João Silva',
                          author_initials: 'JS', created_at: new Date().toISOString(),
                          read_by_po: false,
                        })
                        onComment(`✓ Aprovação registrada: "${v.title}"`)
                      }}
                      className="h-7 px-3 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: C.success, color: '#fff' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                    >
                      Aprovar
                    </button>
                  )}
                  {/* Comment is always available — native capability */}
                  <ClientCommentInput
                    itemId={v.id} itemTitle={v.title} project={v.project}
                    onSent={handleSent}
                  />
                  {!perms.client_can_approve && !perms.client_can_preview && (
                    <span className="text-[10px]" style={{ color: C.txt3 }}>
                      Aguardando avaliação da equipe
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[10px] font-semibold" style={{ color: C.success }}>✓ Aprovado por você</p>
              )}
              {/* Show client thread: own comments + PO replies */}
              <ClientSignalThread itemId={v.id} refresh={refresh} />
            </div>
          )
        })}
      </div>
    </CardShell>
  )
}

// ─── CARD 7: Published roadmap ────────────────────────────────────────────────
function RoadmapCard() {
  return (
    <CardShell>
      <CardTitle>Roadmap publicado</CardTitle>
      <div className="px-5 py-4">
        <div className="relative pl-4" style={{ borderLeft: `2px solid ${C.border2}` }}>
          {ROADMAP.map((m, i) => (
            <div key={m.id} className={`relative ${i < ROADMAP.length - 1 ? 'pb-5' : ''}`}>
              {/* Dot */}
              <span
                className="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full"
                style={{ background: C.accent, boxShadow: `0 0 0 3px ${C.surface}` }}
              />
              <div className="pl-4">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 inline-block"
                  style={{ color: C.accent, background: `${C.accent}18`, border: `1px solid ${C.accent}30` }}
                >
                  {m.date}
                </span>
                <p className="text-xs font-semibold mt-1" style={{ color: C.txt }}>{m.title}</p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: C.txt3 }}>{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  )
}

// ─── CARD 8: Recent deliveries ────────────────────────────────────────────────
function RecentDeliveriesCard() {
  return (
    <CardShell>
      <CardTitle>Entregas recentes</CardTitle>
      <div className="px-4 py-3 space-y-2">
        {RECENT_DELIVERIES.map(d => (
          <div
            key={d.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: C.surface2, border: `1px solid ${C.border}` }}
          >
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${C.success}18` }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: C.success }}>
                <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: C.txt }}>{d.title}</p>
              <p className="text-[10px] mt-0.5" style={{ color: C.txt3 }}>{d.project} · {d.date}</p>
            </div>
            <button
              className="h-6 px-2.5 rounded-md text-[10px] font-semibold flex-shrink-0 transition-all"
              style={{ color: C.accent, background: `${C.accent}12`, border: `1px solid ${C.accent}30` }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.accent}22` }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.accent}12` }}
            >
              Ver demo
            </button>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-xs">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: C.surface2, border: `1px solid ${C.border}` }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ color: C.txt3 }}>
            <rect x="4" y="4" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <rect x="16" y="4" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <rect x="4" y="16" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <rect x="16" y="16" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold" style={{ color: C.txt }}>Nenhum projeto selecionado</p>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: C.txt2 }}>
            Selecione um ou mais projetos no seletor acima para visualizar o dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── CLIENT NOTIFICATION BELL ────────────────────────────────────────────────
function ClientNotifBell({
  tick, onRead,
}: {
  tick: number; onRead: (msg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [localTick, setLocalTick] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  void tick
  void localTick

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const unread = getClientUnreadReplies(MOCK_TENANT.tenant_id, CLIENT_AUTHOR)

  function handleClick(sig: ClientSignal) {
    markReplyReadByClient(sig.id)
    setLocalTick(t => t + 1)
    setOpen(false)
    onRead(`${sig.po_reply_by ?? 'Equipe Altech'} respondeu: "${(sig.po_reply ?? '').slice(0, 80)}${(sig.po_reply ?? '').length > 80 ? '…' : ''}"`)
  }

  function handleMarkAll() {
    markAllClientRepliesRead(MOCK_TENANT.tenant_id, CLIENT_AUTHOR)
    setLocalTick(t => t + 1)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: open ? `${C.accent}18` : C.surface2,
          border: `1px solid ${open ? C.accent + '60' : C.border}`,
          color: C.txt2,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent + '60'; (e.currentTarget as HTMLButtonElement).style.color = C.accent }}
        onMouseLeave={e => { if (!open) { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.txt2 } }}
        aria-label="Notificações"
      >
        {/* Bell icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2a5 5 0 00-5 5v2.5L2 11h12l-1-1.5V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {/* Badge */}
        {unread.length > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: C.crit, color: '#fff', padding: '0 3px' }}
          >
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-50 fade-rise"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            boxShadow: '0 24px 64px rgba(0,0,0,0.56)',
            width: 360,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: C.txt }}>Notificações</span>
              {unread.length > 0 && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: C.crit, color: '#fff' }}
                >
                  {unread.length} nova{unread.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {unread.length > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-[10px] transition-colors"
                style={{ color: C.txt3, background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.accent }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.txt3 }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto py-1">
            {unread.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-8">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: C.surface2 }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: C.txt3 }}>
                    <path d="M9 3a6 6 0 00-6 6v2.5L2 13h14l-1-1.5V9a6 6 0 00-6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M7.5 14.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-xs text-center" style={{ color: C.txt3 }}>Nenhuma notificação não lida</p>
              </div>
            ) : (
              unread.map(sig => (
                <button
                  key={sig.id}
                  onClick={() => handleClick(sig)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.accent}08` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: C.success, color: '#fff' }}
                  >
                    EA
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: C.txt }}>
                      {sig.po_reply_by ?? 'Equipe Altech'} respondeu seu comentário
                    </p>
                    <p className="text-[10px] leading-snug mb-1 line-clamp-2" style={{ color: C.txt2 }}>
                      "{sig.po_reply}"
                    </p>
                    <p className="text-[9px]" style={{ color: C.txt3 }}>
                      {sig.item_title} · {sig.project}
                    </p>
                  </div>
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: C.accent }} />
                </button>
              ))
            )}
          </div>

          {/* Footer note */}
          <div
            className="px-4 py-2.5 text-[9px] text-center"
            style={{ borderTop: `1px solid ${C.border}`, color: C.txt3 }}
          >
            Notificações deste tenant · {MOCK_TENANT.tenant_id.replace('ten_', '')}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FIRST-ACCESS CHANGE PASSWORD MODAL ──────────────────────────────────────
function validateNewPassword(pwd: string): string[] {
  const errors: string[] = []
  if (pwd.length < 8 || pwd.length > 16)  errors.push('Entre 8 e 16 caracteres')
  if (!/[a-zA-Z]/.test(pwd))              errors.push('Pelo menos uma letra')
  if (!/\d/.test(pwd))                    errors.push('Pelo menos um número')
  if (!/[@#$%!^&*_\-+=]/.test(pwd))       errors.push('Pelo menos um caractere especial (@#$%!^&*_-+=)')
  return errors
}

function ChangePasswordModal({ onSaved, onClose, voluntary = false }: { onSaved: () => void; onClose?: () => void; voluntary?: boolean }) {
  const [pwd1, setPwd1]       = useState('')
  const [pwd2, setPwd2]       = useState('')
  const [show1, setShow1]     = useState(false)
  const [show2, setShow2]     = useState(false)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving]   = useState(false)

  const errors1  = validateNewPassword(pwd1)
  const mismatch = pwd1 !== pwd2 && pwd2.length > 0
  const valid    = errors1.length === 0 && pwd1 === pwd2 && pwd2.length > 0

  function handleSave() {
    if (!valid) return
    setSaving(true)
    const rec = getClientAccess(MOCK_TENANT.tenant_id, CLIENT_AUTHOR)
    if (rec) updateClientPassword(rec.id, pwd1)
    setTimeout(() => {
      setSaving(false)
      onSaved()
    }, 600)
  }

  const fieldBase: React.CSSProperties = {
    width: '100%', background: C.bg, border: `1px solid ${C.border2}`,
    borderRadius: 8, padding: '10px 40px 10px 12px', color: C.txt, fontSize: 13,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(8,10,14,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md fade-rise"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderTop: `3px solid ${C.accent}`,
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          padding: 36,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}30` }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: C.accent }}>
              <rect x="3" y="8" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6 8V6a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="9" cy="12.5" r="1" fill="currentColor" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-base font-bold" style={{ color: C.txt }}>
              {voluntary ? 'Alterar senha' : 'Primeiro acesso'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: C.txt3 }}>
              {voluntary ? 'Atualize sua senha de acesso ao portal.' : 'Por segurança, defina uma nova senha antes de continuar.'}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fechar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txt3, padding: '2px 6px', fontSize: 20, lineHeight: 1, flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.txt }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.txt3 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Field 1 */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: C.txt2 }}>Nova senha</label>
          <div style={{ position: 'relative' }}>
            <input
              type={show1 ? 'text' : 'password'}
              value={pwd1}
              onChange={e => { setPwd1(e.target.value); setTouched(true) }}
              placeholder="••••••••"
              autoFocus
              style={{
                ...fieldBase,
                borderColor: touched && errors1.length > 0 ? C.crit + '80' : C.border2,
              }}
              onFocus={e => (e.target.style.borderColor = C.accent + '80')}
              onBlur={e => (e.target.style.borderColor = touched && errors1.length > 0 ? C.crit + '80' : C.border2)}
            />
            <button
              type="button"
              onClick={() => setShow1(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.txt3, fontSize: 14, padding: 4 }}
            >
              {show1 ? '🙈' : '👁'}
            </button>
          </div>
          {/* Inline requirements */}
          {touched && (
            <div className="mt-2 space-y-1">
              {[
                { label: 'Entre 8 e 16 caracteres', ok: pwd1.length >= 8 && pwd1.length <= 16 },
                { label: 'Pelo menos uma letra',    ok: /[a-zA-Z]/.test(pwd1) },
                { label: 'Pelo menos um número',    ok: /\d/.test(pwd1) },
                { label: 'Caractere especial (@#$%!^&*_-+=)', ok: /[@#$%!^&*_\-+=]/.test(pwd1) },
              ].map(req => (
                <div key={req.label} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold flex-shrink-0" style={{ color: req.ok ? C.success : C.crit }}>
                    {req.ok ? '✓' : '✗'}
                  </span>
                  <span className="text-[10px]" style={{ color: req.ok ? C.success : C.txt3 }}>{req.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Field 2 */}
        <div className="mb-6">
          <label className="block text-xs font-medium mb-1.5" style={{ color: C.txt2 }}>Repetir nova senha</label>
          <div style={{ position: 'relative' }}>
            <input
              type={show2 ? 'text' : 'password'}
              value={pwd2}
              onChange={e => setPwd2(e.target.value)}
              placeholder="••••••••"
              style={{
                ...fieldBase,
                borderColor: mismatch ? C.crit + '80' : C.border2,
              }}
              onFocus={e => (e.target.style.borderColor = C.accent + '80')}
              onBlur={e => (e.target.style.borderColor = mismatch ? C.crit + '80' : C.border2)}
            />
            <button
              type="button"
              onClick={() => setShow2(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.txt3, fontSize: 14, padding: 4 }}
            >
              {show2 ? '🙈' : '👁'}
            </button>
          </div>
          {mismatch && (
            <p className="text-[10px] mt-1.5" style={{ color: C.crit }}>✗ As senhas não coincidem</p>
          )}
          {valid && (
            <p className="text-[10px] mt-1.5" style={{ color: C.success }}>✓ Senhas coincidem</p>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          className="w-full h-11 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: valid && !saving ? C.accent : C.border2,
            color: valid && !saving ? '#fff' : C.txt3,
            border: 'none', cursor: valid && !saving ? 'pointer' : 'not-allowed',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando…' : 'Salvar nova senha'}
        </button>

        {/* Inspection Mode notice */}
        <p className="text-[9px] text-center mt-4" style={{ color: C.txt3 }}>
          Inspection Mode — senha demonstrativa, sem hash real. Não utilize senhas reais.
        </p>
      </div>
    </div>
  )
}

// ─── CLIENT PROFILE MENU ─────────────────────────────────────────────────────
function ClientProfileMenu({
  onLogout, onChangePassword,
}: {
  onLogout: () => void; onChangePassword: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const menuItems = [
    {
      label: 'Meu perfil',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
      action: () => { setOpen(false) },
      disabled: true,
    },
    {
      label: 'Alterar senha',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="7" cy="9.5" r="1" fill="currentColor" />
        </svg>
      ),
      action: () => { setOpen(false); onChangePassword() },
    },
    {
      label: 'Sair',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      action: () => { setOpen(false); onLogout() },
      danger: true,
    },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Menu de perfil"
        className="flex items-center gap-2 h-9 px-2 rounded-xl transition-all"
        style={{
          background: open ? `${C.accent}18` : C.surface2,
          border: `1px solid ${open ? C.accent + '60' : C.border}`,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent + '60' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
      >
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${C.accent}, #5b6ef7)`, color: '#fff' }}
        >
          JS
        </div>
        <span className="text-xs font-medium hidden sm:block" style={{ color: C.txt }}>João Silva</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: C.txt3, flexShrink: 0 }}>
          <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-50 py-1 fade-rise"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            boxShadow: '0 24px 64px rgba(0,0,0,0.56)',
            minWidth: 200,
          }}
        >
          {/* Profile info row */}
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${C.accent}, #5b6ef7)`, color: '#fff' }}
              >
                JS
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: C.txt }}>João Silva</p>
                <p className="text-[10px]" style={{ color: C.txt3 }}>joao.silva@cliente.com</p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {menuItems.map(item => (
              <button
                key={item.label}
                onClick={item.action}
                disabled={item.disabled}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: item.disabled ? 'default' : 'pointer',
                  color: item.danger ? C.crit : item.disabled ? C.txt3 : C.txt2,
                  opacity: item.disabled ? 0.5 : 1,
                }}
                onMouseEnter={e => {
                  if (!item.disabled) {
                    (e.currentTarget as HTMLButtonElement).style.background = item.danger ? `${C.crit}10` : `${C.accent}08`
                    if (!item.danger) (e.currentTarget as HTMLButtonElement).style.color = C.txt
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = item.danger ? C.crit : item.disabled ? C.txt3 : C.txt2;
                }}
              >
                <span style={{ color: 'inherit', flexShrink: 0 }}>{item.icon}</span>
                <span className="text-xs">{item.label}</span>
                {item.disabled && (
                  <span
                    className="ml-auto text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: C.border, color: C.txt3 }}
                  >
                    em breve
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2 text-[9px] text-center"
            style={{ borderTop: `1px solid ${C.border}`, color: C.txt3 }}
          >
            Inspection Mode · Dash View by Altech
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CLIENT CHAT ──────────────────────────────────────────────────────────────
interface ChatBubble {
  id: string
  side: 'client' | 'management'
  author: string
  initials: string
  body: string
  timestamp: string
  badge?: string
  itemTitle?: string
}

function flattenClientThread(signals: ClientSignal[], clientAuthor: string): ChatBubble[] {
  const bubbles: ChatBubble[] = []
  for (const sig of signals) {
    const isClientSig = sig.author === clientAuthor && sig.source !== 'management'
    const isMgmtSig = sig.source === 'management'
    if (!isClientSig && !isMgmtSig) continue

    if (isClientSig) {
      bubbles.push({
        id: sig.id,
        side: 'client',
        author: clientAuthor,
        initials: 'JS',
        body: sig.body ?? (sig.type === 'approval' ? '✓ Item aprovado' : ''),
        timestamp: sig.created_at,
        badge: sig.type === 'approval' ? '✓ Aprovação' : undefined,
        itemTitle: sig.item_title,
      })
    } else {
      const inits = sig.author.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      bubbles.push({
        id: sig.id,
        side: 'management',
        author: sig.author,
        initials: inits,
        body: sig.body ?? '',
        timestamp: sig.created_at,
        itemTitle: sig.item_title,
      })
    }

    // PO reply on a client signal
    if (sig.po_reply && isClientSig) {
      const replyTs = new Date(sig.created_at)
      replyTs.setSeconds(replyTs.getSeconds() + 60)
      bubbles.push({
        id: `${sig.id}_r`,
        side: 'management',
        author: sig.po_reply_by ?? 'Equipe Altech',
        initials: 'EA',
        body: sig.po_reply,
        timestamp: replyTs.toISOString(),
        itemTitle: sig.item_title,
      })
    }
  }
  bubbles.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return bubbles
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function fmtDay(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch { return '' }
}

function sigProjectId(sigProject: string): string | null {
  const p = PROJECTS.find(
    proj => proj.name === sigProject || sigProject.startsWith(proj.name) || proj.name.startsWith(sigProject),
  )
  return p?.id ?? null
}

function ClientChatPanel({ onToast }: { onToast: (msg: string) => void }) {
  const [selId, setSelId] = useState<string>(PROJECTS[0]?.id ?? '')
  const chatCanComment = getClientPermissions(MOCK_TENANT.tenant_id, CLIENT_AUTHOR).client_can_comment
  const [draft, setDraft] = useState('')
  const [tick, setTick] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  void tick

  // Unread per project (management replies the client hasn't read)
  const allUnread = getClientUnreadReplies(MOCK_TENANT.tenant_id, CLIENT_AUTHOR)
  const unreadByProject = new Map<string, number>()
  for (const sig of allUnread) {
    const pid = sigProjectId(sig.project)
    if (pid) unreadByProject.set(pid, (unreadByProject.get(pid) ?? 0) + 1)
  }

  const project = PROJECTS.find(p => p.id === selId) ?? PROJECTS[0]
  const rawSignals = project ? getSignalsForProject(project.name, MOCK_TENANT.tenant_id) : []
  const thread = flattenClientThread(rawSignals, CLIENT_AUTHOR)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [selId, tick])

  function handleSend() {
    const body = draft.trim()
    if (!body || !project || !chatCanComment) return
    addClientSignal({
      project: project.name,
      tenant_id: MOCK_TENANT.tenant_id,
      type: 'comment',
      body,
      author: CLIENT_AUTHOR,
      author_initials: 'JS',
      item_id: `portal-chat-${Date.now()}`,
      item_title: 'Chat geral do projeto',
      responsible_po: 'u_po',
      created_at: new Date().toISOString(),
      read_by_po: false,
    })
    setDraft('')
    setTick(t => t + 1)
    onToast('Mensagem enviada.')
  }

  // Group thread by day
  type DayGroup = { day: string; bubbles: ChatBubble[] }
  const grouped: DayGroup[] = []
  for (const b of thread) {
    const day = new Date(b.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const last = grouped[grouped.length - 1]
    if (last && last.day === day) { last.bubbles.push(b) }
    else grouped.push({ day, bubbles: [b] })
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs" style={{ color: C.txt3 }}>Nenhum projeto compartilhado com você ainda.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: project list */}
      <div
        className="flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ width: 240, borderRight: `1px solid ${C.border}`, background: C.surface }}
      >
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.txt3 }}>
            Seus projetos
          </p>
        </div>
        {PROJECTS.map(p => {
          const active = p.id === selId
          const unread = unreadByProject.get(p.id) ?? 0
          return (
            <button
              key={p.id}
              onClick={() => setSelId(p.id)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-0"
              style={{
                background: active ? `${C.accent}12` : 'transparent',
                borderLeft: `3px solid ${active ? C.accent : 'transparent'}`,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = `${C.accent}06` }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5"
                style={{ background: active ? `${C.accent}28` : C.surface2, color: active ? C.accent : C.txt3, border: `1px solid ${active ? C.accent + '40' : C.border}` }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold truncate flex-1" style={{ color: active ? C.txt : C.txt2 }}>
                    {p.name}
                  </p>
                  {unread > 0 && (
                    <span
                      className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{ background: C.crit, color: '#fff', padding: '0 3px' }}
                    >
                      {unread}
                    </span>
                  )}
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: C.txt3 }}>{p.sprint}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Right: thread + composer */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: C.bg }}>
        {/* Thread header */}
        <div
          className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: `${C.accent}20`, color: C.accent, border: `1px solid ${C.accent}30` }}
          >
            {project.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: C.txt }}>{project.name}</p>
            <p className="text-[10px]" style={{ color: C.txt3 }}>{project.sprint} · Chat com a equipe</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-1">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: C.txt3 }}>
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: C.txt }}>Nenhuma mensagem ainda</p>
                <p className="text-xs mt-1" style={{ color: C.txt3 }}>Envie uma mensagem para iniciar a conversa.</p>
              </div>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.day}>
                {/* Day separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px" style={{ background: C.border }} />
                  <span className="text-[10px] px-2" style={{ color: C.txt3 }}>{group.day}</span>
                  <div className="flex-1 h-px" style={{ background: C.border }} />
                </div>
                {group.bubbles.map(b => {
                  const isClient = b.side === 'client'
                  return (
                    <div
                      key={b.id}
                      className={`flex items-end gap-2.5 mb-3 ${isClient ? 'flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                        style={{
                          background: isClient ? `linear-gradient(135deg, ${C.accent}, #5b6ef7)` : `${C.success}28`,
                          color: isClient ? '#fff' : C.success,
                          border: `1px solid ${isClient ? C.accent + '40' : C.success + '30'}`,
                        }}
                      >
                        {b.initials}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isClient ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        style={{
                          background: isClient ? `${C.accent}22` : C.surface,
                          border: `1px solid ${isClient ? C.accent + '30' : C.border}`,
                        }}
                      >
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[10px] font-semibold" style={{ color: isClient ? C.accent : C.success }}>
                            {b.author}
                          </span>
                          {b.badge && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded-full"
                              style={{ background: `${C.success}20`, color: C.success, border: `1px solid ${C.success}30` }}
                            >
                              {b.badge}
                            </span>
                          )}
                        </div>
                        {b.itemTitle && b.itemTitle !== 'Chat geral do projeto' && (
                          <p className="text-[9px] mb-1" style={{ color: C.txt3 }}>
                            re: {b.itemTitle}
                          </p>
                        )}
                        <p className="text-[12px] leading-relaxed" style={{ color: C.txt }}>{b.body}</p>
                        <p className="text-[9px] mt-1 text-right" style={{ color: C.txt3 }}>{fmtTime(b.timestamp)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Composer — hidden for read-only (viewer) portal access */}
        <div
          className="flex-shrink-0 px-6 py-4"
          style={{ borderTop: `1px solid ${C.border}`, background: C.surface }}
        >
          {!chatCanComment && (
            <p className="text-[11px] text-center py-2" style={{ color: C.txt3 }}>
              Seu acesso é somente leitura. Fale com a equipe Altech para poder responder.
            </p>
          )}
          {chatCanComment && <div
            className="flex items-end gap-3 rounded-2xl px-4 py-3"
            style={{ background: C.surface2, border: `1px solid ${C.border2}` }}
          >
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Digite uma mensagem para a equipe… (Enter para enviar)"
              rows={1}
              className="flex-1 resize-none bg-transparent text-[13px] outline-none"
              style={{
                color: C.txt, fontFamily: 'inherit',
                maxHeight: 80, overflowY: 'auto',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              className="flex-shrink-0 h-8 px-4 rounded-xl text-[12px] font-semibold transition-all"
              style={{
                background: draft.trim() ? C.accent : C.border2,
                color: draft.trim() ? '#fff' : C.txt3,
                border: 'none',
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Enviar
            </button>
          </div>}
          <p className="text-[9px] mt-2 text-center" style={{ color: C.txt3 }}>
            Suas mensagens são visíveis para a equipe Altech · Inspection Mode
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── PROJECT SELECTOR ────────────────────────────────────────────────────────
function ProjectSelector({ selected, onToggle }: { selected: Set<string>; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const label = selected.size === 0
    ? 'Selecionar projeto...'
    : selected.size === 1
      ? PROJECTS.find(p => selected.has(p.id))?.name ?? ''
      : `${selected.size} projetos selecionados`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium transition-all"
        style={{
          background: C.surface2,
          border: `1px solid ${open ? C.accent : C.border}`,
          color: selected.size === 0 ? C.txt3 : C.txt,
          minWidth: 220,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: C.accent, flexShrink: 0 }}>
          <rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="8" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <span className="flex-1 text-left truncate">{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: C.txt3, flexShrink: 0 }}>
          <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-30 py-1 fade-rise"
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', minWidth: 240 }}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.txt3 }}>Projetos disponíveis</p>
          {PROJECTS.map(p => {
            const checked = selected.has(p.id)
            const c = p.status === 'at-risk' ? C.warn : C.success
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{ background: checked ? `${C.accent}10` : 'transparent' }}
                onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: checked ? C.accent : C.surface2, border: `1px solid ${checked ? C.accent : C.border2}` }}
                >
                  {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: C.txt }}>{p.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: C.txt3 }}>{p.sprint}</p>
                </div>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── PORTAL HEADER ────────────────────────────────────────────────────────────
function PortalHeader({
  selected, onToggle, notifTick, onNotifRead,
  isChatMode, onChatToggle, onLogout, onChangePasswordRequest,
}: {
  selected: Set<string>; onToggle: (id: string) => void
  notifTick: number; onNotifRead: (msg: string) => void
  isChatMode: boolean; onChatToggle: () => void
  onLogout: () => void; onChangePasswordRequest: () => void
}) {
  const unreadCount = getClientUnreadReplies(MOCK_TENANT.tenant_id, CLIENT_AUTHOR).length

  return (
    <header
      className="flex items-center justify-between gap-4 px-8 py-3 flex-shrink-0"
      style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${C.accent}, #5b6ef7)` }}
        >
          A
        </div>
        <div>
          <p className="text-sm font-bold leading-tight" style={{ color: C.txt }}>Altech Agency</p>
          <p className="text-[10px]" style={{ color: C.txt3 }}>Portal do cliente</p>
        </div>
      </div>

      {/* Center: project selector or tab label */}
      <div className="flex items-center gap-3 flex-1 justify-center">
        {!isChatMode
          ? <ProjectSelector selected={selected} onToggle={onToggle} />
          : (
            <span className="text-sm font-semibold" style={{ color: C.txt }}>
              Minhas mensagens
            </span>
          )
        }
      </div>

      {/* Right: chat toggle + bell + profile */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Chat / Dashboard toggle */}
        <button
          onClick={onChatToggle}
          className="relative flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: isChatMode ? `${C.accent}18` : C.surface2,
            border: `1px solid ${isChatMode ? C.accent + '60' : C.border}`,
            color: isChatMode ? C.accent : C.txt2,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent + '60'; (e.currentTarget as HTMLButtonElement).style.color = C.accent }}
          onMouseLeave={e => { if (!isChatMode) { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.txt2 } }}
          aria-label={isChatMode ? 'Voltar ao dashboard' : 'Abrir mensagens'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 9a1 1 0 01-1 1H4l-2 2V3a1 1 0 011-1h8a1 1 0 011 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span>{isChatMode ? 'Dashboard' : 'Mensagens'}</span>
          {!isChatMode && unreadCount > 0 && (
            <span
              className="min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: C.crit, color: '#fff', padding: '0 3px' }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <ClientNotifBell tick={notifTick} onRead={onNotifRead} />

        <ClientProfileMenu onLogout={onLogout} onChangePassword={onChangePasswordRequest} />
      </div>
    </header>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function ClientPortalPage({
  mustChangePassword = false,
  onPasswordChanged,
  onLogout,
}: {
  mustChangePassword?: boolean
  onPasswordChanged?: () => void
  onLogout?: () => void
}) {
  const { toasts, add: showToast } = useLocalToast()
  const portal = useClientPortal()
  applyScope(portal.scope)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Select every visible project as soon as the client scope hydrates.
  useEffect(() => {
    setSelected(prev => {
      const valid = new Set([...prev].filter(id => PROJECTS.some(p => p.id === id)))
      return valid.size > 0 ? prev : new Set(PROJECTS.map(p => p.id))
    })
  }, [portal.scope])
  const [notifTick, setNotifTick] = useState(0)
  const [showPwdModal, setShowPwdModal] = useState(mustChangePassword)
  const [showVoluntaryPwdModal, setShowVoluntaryPwdModal] = useState(false)
  const [portalView, setPortalView] = useState<'dashboard' | 'chat'>('dashboard')

  function handlePasswordSaved() {
    setShowPwdModal(false)
    setShowVoluntaryPwdModal(false)
    onPasswordChanged?.()
    showToast('Senha atualizada com sucesso.', 'success')
  }

  function toggleProject(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleNotifRead(msg: string) {
    showToast(msg, 'info')
    setNotifTick(t => t + 1)
  }

  const isSingle = selected.size === 1
  const singleProject = isSingle ? PROJECTS.find(p => selected.has(p.id)) : null
  const isEmpty = selected.size === 0

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <PortalHeader
        selected={selected}
        onToggle={toggleProject}
        notifTick={notifTick}
        onNotifRead={handleNotifRead}
        isChatMode={portalView === 'chat'}
        onChatToggle={() => setPortalView(v => v === 'chat' ? 'dashboard' : 'chat')}
        onLogout={onLogout ?? (() => {})}
        onChangePasswordRequest={() => setShowVoluntaryPwdModal(true)}
      />

      {portalView === 'chat' ? (
        <div className="flex-1 overflow-hidden">
          <ClientChatPanel onToast={msg => showToast(msg, 'info')} />
        </div>
      ) : (
        <>
          {/* State label strip */}
          <div
            className="flex items-center gap-2 px-8 py-2 flex-shrink-0"
            style={{ background: `${C.accent}08`, borderBottom: `1px solid ${C.border}` }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: C.accent }}>
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5 4v3M5 3v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-[11px]" style={{ color: C.txt3 }}>
              {isEmpty
                ? 'Selecione um projeto no seletor acima'
                : isSingle
                  ? `Visualizando: ${singleProject?.name} — ${singleProject?.sprint}`
                  : `Visão consolidada: ${selected.size} projetos selecionados`}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {isEmpty ? (
              <EmptyState />
            ) : (
              <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', alignItems: 'start' }}>
                {isSingle && singleProject && (
                  <>
                    <ProgressCard project={singleProject} />
                    <SprintDeliveriesCard
                      projectFilter={selected}
                      onComment={msg => { showToast(msg); setNotifTick(t => t + 1) }}
                    />
                  </>
                )}
                <ProjectCountCard count={PROJECTS.length} />
                <ActiveSprintCard />
                <RisksCard />
                <ValidationCard onComment={showToast} />
                <RoadmapCard />
                <RecentDeliveriesCard />
              </div>
            )}
          </div>
        </>
      )}

      <LocalToastStack toasts={toasts} />

      {/* Blocking first-access modal */}
      {showPwdModal && <ChangePasswordModal onSaved={handlePasswordSaved} />}

      {/* Voluntary password change modal */}
      {showVoluntaryPwdModal && (
        <ChangePasswordModal
          onSaved={handlePasswordSaved}
          onClose={() => setShowVoluntaryPwdModal(false)}
          voluntary
        />
      )}
    </div>
  )
}
