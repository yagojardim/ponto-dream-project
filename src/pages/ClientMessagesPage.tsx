import { useState, useEffect, useRef } from 'react'
import { T } from '../components/ds/tokens'
import { useClientPortal } from '../data/clientPortalStore'
import { useSession } from '../data/SessionContext'
import { MOCK_TENANT } from '../data/session'
import {
  getProjectsWithSignals, getSignalsForProject,
  addManagementMessage, markProjectReadByPo,
  type ClientSignal,
} from '../data/clientSignals'
import { listResponsibleProjectIds } from '../data/db/clientPortal'

// ─── Chat message (flattened view over ClientSignal) ─────────────────────────
interface ChatMsg {
  id:        string
  side:      'client' | 'management'
  author:    string
  initials:  string
  body:      string
  timestamp: string
  badge?:    'approval' | 'comment'
  itemTitle?: string
}

function flattenToChat(signals: ClientSignal[]): ChatMsg[] {
  const msgs: ChatMsg[] = []
  for (const s of signals) {
    if (s.source === 'management') {
      msgs.push({
        id: s.id + '_m', side: 'management',
        author: s.author, initials: s.author_initials,
        body: s.body ?? '', timestamp: s.created_at,
      })
    } else {
      // Client bubble
      const isApproval = s.type === 'approval'
      msgs.push({
        id: s.id + '_c', side: 'client',
        author: s.author, initials: s.author_initials,
        body: isApproval ? `Aprovação registrada: "${s.item_title}"` : (s.body ?? ''),
        timestamp: s.created_at,
        badge: s.type,
        itemTitle: s.item_title,
      })
      // Management po_reply inline
      if (s.po_reply) {
        const initials = (s.po_reply_by ?? 'EA').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        msgs.push({
          id: s.id + '_r', side: 'management',
          author: s.po_reply_by ?? 'Equipe Altech', initials,
          body: s.po_reply,
          timestamp: new Date(new Date(s.created_at).getTime() + 60_000).toISOString(),
          itemTitle: s.item_title,
        })
      }
    }
  }
  return msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${d.getDate()} ${months[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AV_COLORS: Record<string, string> = {
  JS: T.accent, MF: T.purple, CM: T.warn, BA: T.success, LF: '#f97316',
  EA: T.success,
}
function Av({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: AV_COLORS[initials] ?? T.text3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff',
    }}>
      {initials}
    </div>
  )
}

// ─── Conversation list item ───────────────────────────────────────────────────
function ConvItem({
  project, unread, latest, active, onClick,
}: {
  project: string; unread: number; latest: ClientSignal; active: boolean; onClick: () => void
}) {
  const preview = latest.source === 'management'
    ? `Você: ${latest.body ?? ''}`
    : latest.po_reply
      ? `Você: ${latest.po_reply}`
      : latest.type === 'approval'
        ? `✓ ${latest.item_title}`
        : (latest.body ?? '')

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        background: active ? `${T.accent}12` : 'transparent',
        borderRight: active ? `3px solid ${T.accent}` : '3px solid transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {/* Project icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: active ? `${T.accent}22` : T.bgSurface2,
        border: `1px solid ${active ? T.accentBorder : T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>
        💬
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: active ? T.accent : T.text1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {project}
          </span>
          <span style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>{fmtDate(latest.created_at)}</span>
        </div>
        <p style={{
          fontSize: 11, color: T.text2, margin: 0, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {preview.slice(0, 80)}
        </p>
        {unread > 0 && (
          <div style={{ marginTop: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, background: T.accent, color: '#fff',
              borderRadius: 20, padding: '1px 7px',
            }}>
              {unread} não {unread === 1 ? 'lida' : 'lidas'}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: ChatMsg }) {
  const isMe = msg.side === 'management'
  return (
    <div style={{
      display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: 8, marginBottom: 12,
    }}>
      <Av initials={msg.initials} size={26} />
      <div style={{ maxWidth: '68%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          flexDirection: isMe ? 'row-reverse' : 'row',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: isMe ? T.accent : T.text2 }}>{msg.author}</span>
          <span style={{ fontSize: 10, color: T.text3 }}>{fmtTime(msg.timestamp)}</span>
          {msg.badge === 'approval' && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: T.success,
              background: T.successDim, border: `1px solid ${T.success}40`,
              borderRadius: 20, padding: '1px 6px',
            }}>✓ Aprovação</span>
          )}
        </div>
        {msg.itemTitle && msg.badge && (
          <div style={{ fontSize: 10, color: T.text3, marginBottom: 3, fontStyle: 'italic' }}>
            Re: {msg.itemTitle}
          </div>
        )}
        <div style={{
          padding: '9px 13px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isMe ? T.accentDim : T.bgSurface2,
          border: `1px solid ${isMe ? T.accentBorder : T.border}`,
          fontSize: 13, color: T.text1, lineHeight: 1.5, wordBreak: 'break-word',
        }}>
          {msg.body}
        </div>
      </div>
    </div>
  )
}

// ─── Day separator ────────────────────────────────────────────────────────────
function DaySep({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      <span style={{ fontSize: 10, color: T.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  )
}

// ─── Composer ─────────────────────────────────────────────────────────────────
function Composer({
  onSend, disabled,
}: { onSend: (text: string) => void; disabled?: boolean }) {
  const [val, setVal] = useState('')

  function submit() {
    const t = val.trim()
    if (!t) return
    onSend(t)
    setVal('')
  }

  return (
    <div style={{
      borderTop: `1px solid ${T.border}`, padding: '14px 16px',
      background: T.bgSurface, display: 'flex', gap: 10, alignItems: 'flex-end',
    }}>
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={disabled ? 'Selecione uma conversa para responder…' : 'Digite sua resposta ao cliente…'}
        disabled={disabled}
        rows={2}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        style={{
          flex: 1, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10,
          color: T.text1, fontSize: 13, padding: '9px 12px', resize: 'none', outline: 'none',
          fontFamily: 'inherit', lineHeight: 1.5,
          opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'text',
        }}
        onFocus={e => { e.target.style.borderColor = T.accent }}
        onBlur={e => { e.target.style.borderColor = T.border }}
      />
      <button
        onClick={submit}
        disabled={!val.trim() || disabled}
        style={{
          height: 40, padding: '0 20px', borderRadius: 10, border: 'none', cursor: !val.trim() || disabled ? 'not-allowed' : 'pointer',
          background: !val.trim() || disabled ? T.border2 : T.accent, color: '#fff',
          fontSize: 13, fontWeight: 600, flexShrink: 0, transition: 'background 0.15s',
          opacity: !val.trim() || disabled ? 0.5 : 1,
        }}
      >
        Enviar
      </button>
    </div>
  )
}

// ─── Thread panel ─────────────────────────────────────────────────────────────
function ThreadPanel({ project, tenantId, authorName, authorInitials, onSent }: {
  project: string; tenantId: string
  authorName: string; authorInitials: string
  onSent: () => void
}) {
  const [tick, setTick] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  void tick

  const signals  = getSignalsForProject(project, tenantId)
  const messages = flattenToChat(signals)

  useEffect(() => {
    markProjectReadByPo(project, tenantId)
    setTick(t => t + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function handleSend(text: string) {
    addManagementMessage(project, tenantId, text, authorName, authorInitials)
    markProjectReadByPo(project, tenantId)
    setTick(t => t + 1)
    onSent()
  }

  // Group messages by day for day separators
  const groups: { day: string; msgs: ChatMsg[] }[] = []
  for (const msg of messages) {
    const day = fmtDate(msg.timestamp)
    const last = groups[groups.length - 1]
    if (!last || last.day !== day) groups.push({ day, msgs: [msg] })
    else last.msgs.push(msg)
  }

  // Get distinct client names
  const clients = [...new Set(signals.filter(s => s.source !== 'management').map(s => s.author))]

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 300 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text1, marginBottom: 6 }}>Sem mensagens</p>
            <p style={{ fontSize: 13, color: T.text2 }}>Nenhuma mensagem do cliente neste projeto ainda.</p>
          </div>
        </div>
        <Composer onSend={handleSend} />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Thread header */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
        background: T.bgSurface, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: T.accentDim,
          border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>💬</div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text1 }}>{project}</p>
          <p style={{ margin: 0, fontSize: 11, color: T.text3 }}>
            {clients.join(' · ')} · {messages.length} mensagens
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            fontSize: 10, color: T.text3, background: T.bgSurface2, border: `1px solid ${T.border}`,
            borderRadius: 6, padding: '3px 8px',
          }}>
            Somente gestão interna — nunca visível ao cliente como chat
          </span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {groups.map(g => (
          <div key={g.day}>
            <DaySep label={g.day} />
            {g.msgs.map(msg => <Bubble key={msg.id} msg={msg} />)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer onSend={handleSend} />
    </div>
  )
}

// ─── Empty right panel ────────────────────────────────────────────────────────
function EmptyThread() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, background: T.bgSurface2,
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 16px',
        }}>💬</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: T.text1, marginBottom: 8 }}>Mensagens do Cliente</p>
        <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.6 }}>
          Selecione um projeto na lista à esquerda para ver a conversa completa e responder ao cliente.
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientMessagesPage() {
  const portal = useClientPortal()
  const { activeUser } = useSession()
  const isSupervisor = !!activeUser?.tenant_owner || activeUser?.role_context === 'Admin'
  const [myProjectNames, setMyProjectNames] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [tick, setTick]         = useState(0)
  void tick

  // Responsabilidade real: só vê os projetos em que é responsável (Admin vê tudo).
  useEffect(() => {
    let alive = true
    if (isSupervisor || !activeUser?.user_id) { setMyProjectNames(null); return }
    ;(async () => {
      const ids = await listResponsibleProjectIds(activeUser.user_id)
      if (!alive) return
      const byId = new Map(portal.projects.map(p => [p.id, p.name]))
      setMyProjectNames(ids.map(id => byId.get(id)).filter((n): n is string => !!n))
    })()
    return () => { alive = false }
  }, [isSupervisor, activeUser?.user_id, portal.projects])

  const allProjects = getProjectsWithSignals(MOCK_TENANT.tenant_id)
  const projects = isSupervisor
    ? allProjects
    : allProjects.filter(p => (myProjectNames ?? []).includes(p.project))
  const filtered = projects.filter(p =>
    p.project.toLowerCase().includes(search.toLowerCase())
  )
  const noResponsibility = !isSupervisor && (myProjectNames?.length ?? 0) === 0

  const authorName     = activeUser?.name ?? 'Equipe Altech'
  const authorInitials = (activeUser?.name ?? 'Equipe Altech').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()

  // Auto-select first project if none selected
  useEffect(() => {
    if (!selected && filtered.length > 0) setSelected(filtered[0].project)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length])

  function handleSent() {
    setTick(t => t + 1)
  }

  const totalUnread = projects.reduce((s, p) => s + p.unread, 0)

  if (noResponsibility) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif', padding: 24,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: T.bgSurface2,
            border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
          }}>💬</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: T.text1, marginBottom: 8 }}>Nenhuma conversa atribuída</p>
          <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.6 }}>
            Você ainda não é responsável pelas mensagens de nenhum projeto. Peça ao administrador para atribuir a responsabilidade.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      background: T.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Page header */}
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
        background: T.bgSurface, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text1 }}>Mensagens do Cliente</p>
        {totalUnread > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, background: T.accent, color: '#fff',
            borderRadius: 20, padding: '2px 10px',
          }}>
            {totalUnread} não {totalUnread === 1 ? 'lida' : 'lidas'}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.text3 }}>
          Tenant: {MOCK_TENANT.tenant_id} · Somente sinais do seu escopo
        </span>
      </div>

      {/* Body: left list + right thread */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: conversation list */}
        <div style={{
          width: 288, flexShrink: 0, borderRight: `1px solid ${T.border}`,
          background: T.bgSurface, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar projeto…"
              style={{
                width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`,
                borderRadius: 7, color: T.text1, fontSize: 12, padding: '6px 10px', outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = T.accent)}
              onBlur={e => (e.target.style.borderColor = T.border)}
            />
          </div>

          {/* Project list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: T.text3 }}>Nenhuma conversa encontrada.</p>
              </div>
            ) : (
              filtered.map(p => (
                <ConvItem
                  key={p.project}
                  project={p.project}
                  unread={p.unread}
                  latest={p.latest}
                  active={selected === p.project}
                  onClick={() => { setSelected(p.project); setTick(t => t + 1) }}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: thread */}
        {selected
          ? <ThreadPanel
              key={selected}
              project={selected}
              tenantId={MOCK_TENANT.tenant_id}
              authorName={authorName}
              authorInitials={authorInitials}
              onSent={handleSent}
            />
          : <EmptyThread />
        }
      </div>
    </div>
  )
}
