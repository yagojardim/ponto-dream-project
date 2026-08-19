import { useState, useEffect, useRef, useCallback } from 'react'
import { T } from '../components/ds/tokens'
import { useSession } from '../data/SessionContext'
import { INSPECTION_MODE_ENABLED } from '../lib/auth'
import {
  listProjectsWithClientSignals, listProjectChat, addClientMessage,
  markProjectSignalsReadByPo, listResponsibleProjectIds, listResponsibleProjects,
  type ProjectSignalSummary, type ClientChatMessage,
} from '../data/db/clientPortal'

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '—'
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AV_COLORS = [T.accent, T.purple, T.warn, T.success, '#f97316']
function Av({ initials, size = 28 }: { initials: string; size?: number }) {
  const idx = initials.charCodeAt(0) % AV_COLORS.length
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: AV_COLORS[Number.isNaN(idx) ? 0 : idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff',
    }}>
      {initials}
    </div>
  )
}

// ─── Conversation list item ───────────────────────────────────────────────────
function ConvItem({ conv, active, onClick }: {
  conv: ProjectSignalSummary; active: boolean; onClick: () => void
}) {
  const isEmpty = conv.lastBody === 'Sem mensagens ainda'
  const preview = isEmpty
    ? conv.lastBody
    : conv.lastSource === 'management'
      ? `${conv.lastAuthor}: ${conv.lastBody}`
      : conv.lastBody

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
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: active ? `${T.accent}22` : T.bgSurface2,
        border: `1px solid ${active ? T.accentBorder : T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>💬</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: active ? T.accent : T.text1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {conv.name}
          </span>
          <span style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>{fmtDate(conv.lastAt)}</span>
        </div>
        <p style={{
          fontSize: 11, color: T.text2, margin: 0, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {preview.slice(0, 80)}
        </p>
        {conv.unread > 0 && (
          <div style={{ marginTop: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, background: T.accent, color: '#fff',
              borderRadius: 20, padding: '1px 7px',
            }}>
              {conv.unread} não {conv.unread === 1 ? 'lida' : 'lidas'}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: ClientChatMessage }) {
  const isMe = msg.side === 'management'
  return (
    <div style={{
      display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: 8, marginBottom: 12,
    }}>
      <Av initials={initialsOf(msg.author)} size={26} />
      <div style={{ maxWidth: '68%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          flexDirection: isMe ? 'row-reverse' : 'row',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: isMe ? T.accent : T.text2 }}>{msg.author}</span>
          <span style={{ fontSize: 10, color: T.text3 }}>{fmtTime(msg.createdAt)}</span>
          {msg.type === 'approval' && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: T.success,
              background: T.successDim, border: `1px solid ${T.success}40`,
              borderRadius: 20, padding: '1px 6px',
            }}>✓ Aprovação</span>
          )}
        </div>
        {msg.itemTitle && msg.type === 'approval' && (
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
function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
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
          height: 40, padding: '0 20px', borderRadius: 10, border: 'none',
          cursor: !val.trim() || disabled ? 'not-allowed' : 'pointer',
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
function ThreadPanel({ conv, authorName, onChanged }: {
  conv: ProjectSignalSummary
  authorName: string
  onChanged: () => void
}) {
  const [messages, setMessages] = useState<ClientChatMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    const rows = await listProjectChat(conv.projectId)
    setMessages(rows)
    setLoading(false)
  }, [conv.projectId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      await markProjectSignalsReadByPo(conv.projectId)
      const rows = await listProjectChat(conv.projectId)
      if (!alive) return
      setMessages(rows)
      setLoading(false)
      onChanged()
    })()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.projectId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(text: string) {
    await addClientMessage({
      projectId: conv.projectId, body: text, author: authorName, source: 'management',
    })
    await reload()
    onChanged()
  }

  const groups: { day: string; msgs: ClientChatMessage[] }[] = []
  for (const msg of messages) {
    const day = fmtDate(msg.createdAt)
    const last = groups[groups.length - 1]
    if (!last || last.day !== day) groups.push({ day, msgs: [msg] })
    else last.msgs.push(msg)
  }

  const clients = [...new Set(messages.filter(m => m.side === 'client').map(m => m.author))]

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
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text1 }}>{conv.name}</p>
          <p style={{ margin: 0, fontSize: 11, color: T.text3 }}>
            {clients.length ? `${clients.join(' · ')} · ` : ''}{messages.length} mensagens
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <p style={{ fontSize: 12, color: T.text3 }}>Carregando conversa…</p>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text1, marginBottom: 6 }}>Sem mensagens</p>
            <p style={{ fontSize: 13, color: T.text2 }}>Nenhuma mensagem do cliente neste projeto ainda.</p>
          </div>
        ) : groups.map(g => (
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

// ─── Harness (Inspection only) ────────────────────────────────────────────────
function SimulateClientMessage({ conv, onSent }: {
  conv: ProjectSignalSummary | null; onSent: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!conv || !text.trim()) return
    setBusy(true)
    await addClientMessage({
      projectId: conv.projectId,
      body: text.trim(),
      author: conv.clientName || 'Cliente (teste)',
      source: 'client',
    })
    setText('')
    setBusy(false)
    onSent()
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto',
    }}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Mensagem do cliente (teste)…"
        onKeyDown={e => { if (e.key === 'Enter') void send() }}
        style={{
          width: 220, background: T.bgSurface2, border: `1px solid ${T.border}`,
          borderRadius: 7, color: T.text1, fontSize: 12, padding: '6px 10px', outline: 'none',
        }}
      />
      <button
        onClick={() => void send()}
        disabled={!conv || !text.trim() || busy}
        style={{
          height: 30, padding: '0 12px', borderRadius: 7, border: `1px solid ${T.border}`,
          background: T.bgSurface2, color: T.text2, fontSize: 12, fontWeight: 600,
          cursor: !conv || !text.trim() || busy ? 'not-allowed' : 'pointer',
          opacity: !conv || !text.trim() || busy ? 0.5 : 1,
        }}
      >
        Simular mensagem do cliente
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientMessagesPage() {
  const { activeUser } = useSession()
  const isSupervisor = !!activeUser?.tenant_owner || activeUser?.role_context === 'Admin'
  const [convs, setConvs]       = useState<ProjectSignalSummary[]>([])
  const [myIds, setMyIds]       = useState<string[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)

  const reloadConvs = useCallback(async () => {
    const rows = await listProjectsWithClientSignals()
    setConvs(rows)
    setLoading(false)
  }, [])

  useEffect(() => { void reloadConvs() }, [reloadConvs])

  // Responsabilidade real: só vê os projetos em que é responsável (Admin vê tudo).
  useEffect(() => {
    let alive = true
    if (isSupervisor || !activeUser?.user_id) { setMyIds(null); return }
    ;(async () => {
      const ids = await listResponsibleProjectIds(activeUser.user_id)
      if (alive) setMyIds(ids)
    })()
    return () => { alive = false }
  }, [isSupervisor, activeUser?.user_id])

  const visible = isSupervisor ? convs : convs.filter(c => (myIds ?? []).includes(c.projectId))
  const filtered = visible.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const noResponsibility = !isSupervisor && myIds !== null && myIds.length === 0

  useEffect(() => {
    if (!selected && filtered.length > 0) setSelected(filtered[0].projectId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length])

  const authorName = activeUser?.name ?? 'Equipe Altech'
  const totalUnread = visible.reduce((s, c) => s + c.unread, 0)
  const activeConv = filtered.find(c => c.projectId === selected) ?? null

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
        {INSPECTION_MODE_ENABLED && (
          <SimulateClientMessage conv={activeConv} onSent={() => void reloadConvs()} />
        )}
      </div>

      {/* Body: left list + right thread */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: conversation list */}
        <div style={{
          width: 288, flexShrink: 0, borderRight: `1px solid ${T.border}`,
          background: T.bgSurface, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
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

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: T.text3 }}>Carregando conversas…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: T.text3 }}>Nenhuma conversa encontrada.</p>
              </div>
            ) : (
              filtered.map(c => (
                <ConvItem
                  key={c.projectId}
                  conv={c}
                  active={selected === c.projectId}
                  onClick={() => setSelected(c.projectId)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: thread */}
        {activeConv
          ? <ThreadPanel
              key={activeConv.projectId}
              conv={activeConv}
              authorName={authorName}
              onChanged={() => void reloadConvs()}
            />
          : <EmptyThread />
        }
      </div>
    </div>
  )
}
