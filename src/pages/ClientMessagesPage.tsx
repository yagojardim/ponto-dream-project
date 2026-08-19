import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { T } from '../components/ds/tokens'
import { useSession } from '../data/SessionContext'
import { INSPECTION_MODE_ENABLED } from '../lib/auth'
import {
  listProjectsWithClientSignals, listProjectChat, addClientMessage,
  markProjectSignalsReadByPo, listResponsibleProjectIds, listResponsibleProjects,
  listProjectResponsibleProfiles,
  type ProjectSignalSummary, type ClientChatMessage, type MentionProfile,
} from '../data/db/clientPortal'
import { create as createNotification } from '../data/db/notifications'

// ─── @menções ────────────────────────────────────────────────────────────────
const TODOS_MENTION: { id: '@todos'; name: 'Todos os responsáveis' } = {
  id: '@todos',
  name: 'Todos os responsáveis',
}
type MentionMenuItem = MentionProfile | typeof TODOS_MENTION

/** Detecta o token "@..." em edição imediatamente antes do cursor. */
function mentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const upto = text.slice(0, caret)
  const at = upto.lastIndexOf('@')
  if (at < 0) return null
  const before = at === 0 ? ' ' : upto[at - 1]
  if (!/\s/.test(before)) return null
  const query = upto.slice(at + 1)
  if (/\s/.test(query)) return null
  return { query, start: at }
}

function matchPeople(people: MentionProfile[], query: string): MentionProfile[] {
  const q = query.trim().toLowerCase()
  return people.filter(p => !q || p.name.toLowerCase().includes(q)).slice(0, 6)
}

function MentionMenu({ items, onPick }: { items: MentionProfile[]; onPick: (p: MentionProfile) => void }) {
  if (!items.length) return null
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 40,
      minWidth: 200, background: T.bgSurface, border: `1px solid ${T.border}`,
      borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,0.35)', overflow: 'hidden',
    }}>
      {items.map(p => (
        <button
          key={p.id}
          onMouseDown={e => { e.preventDefault(); onPick(p) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
            padding: '7px 10px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 12, color: T.text1,
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2)}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          <Av initials={initialsOf(p.name)} size={20} />
          {p.name}
        </button>
      ))}
    </div>
  )
}

/** Renderiza o corpo destacando os tokens @Nome mencionados. */
function renderBody(body: string, names: string[]) {
  if (!names.length) return body
  const escaped = names
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`@(${escaped.join('|')})`, 'g')
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    if (m.index > last) out.push(body.slice(last, m.index))
    out.push(
      <span key={`${m.index}-${m[0]}`} style={{ color: T.accent, fontWeight: 700 }}>{m[0]}</span>,
    )
    last = m.index + m[0].length
  }
  if (last < body.length) out.push(body.slice(last))
  return out
}

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
          <span style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>{isEmpty ? '' : fmtDate(conv.lastAt)}</span>
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
function Bubble({ msg, people }: { msg: ClientChatMessage; people: MentionProfile[] }) {
  const mentionedNames = people.filter(p => msg.mentions.includes(p.id)).map(p => p.name)
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
          {renderBody(msg.body, mentionedNames)}
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
function Composer({ onSend, disabled, people }: {
  onSend: (text: string, mentions: string[]) => void
  disabled?: boolean
  people: MentionProfile[]
}) {
  const [val, setVal] = useState('')
  const [menu, setMenu] = useState<{ items: MentionProfile[]; start: number } | null>(null)
  const [picked, setPicked] = useState<MentionProfile[]>([])
  const taRef = useRef<HTMLTextAreaElement>(null)

  function syncMenu(text: string, caret: number) {
    const q = mentionQuery(text, caret)
    if (!q) { setMenu(null); return }
    setMenu({ items: matchPeople(people, q.query), start: q.start })
  }

  function pick(p: MentionProfile) {
    if (!menu) return
    const caret = taRef.current?.selectionStart ?? val.length
    const next = `${val.slice(0, menu.start)}@${p.name} ${val.slice(caret)}`
    setVal(next)
    setPicked(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, p]))
    setMenu(null)
    requestAnimationFrame(() => taRef.current?.focus())
  }

  function submit() {
    const t = val.trim()
    if (!t) return
    const ids = picked.filter(p => t.includes(`@${p.name}`)).map(p => p.id)
    onSend(t, ids)
    setVal('')
    setPicked([])
    setMenu(null)
  }

  return (
    <div style={{
      borderTop: `1px solid ${T.border}`, padding: '14px 16px',
      background: T.bgSurface, display: 'flex', gap: 10, alignItems: 'flex-end',
    }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
      {menu && <MentionMenu items={menu.items} onPick={pick} />}
      <textarea
        ref={taRef}
        value={val}
        onChange={e => { setVal(e.target.value); syncMenu(e.target.value, e.target.selectionStart ?? 0) }}
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
        onBlur={e => { e.target.style.borderColor = T.border; setMenu(null) }}
      />
      </div>
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

async function notifyMentions(
  mentions: string[], author: string, conv: ProjectSignalSummary, body: string,
) {
  await Promise.all(mentions.map(id => createNotification({
    profileId: id,
    type: 'mention',
    title: `${author} mencionou você em "${conv.name}"`,
    body,
    entityType: 'client_messages_project',
    entityId: conv.projectId,
  })))
}

// ─── Thread panel ─────────────────────────────────────────────────────────────
function ThreadPanel({ conv, authorName, onChanged }: {
  conv: ProjectSignalSummary
  authorName: string
  onChanged: () => void
}) {
  const [messages, setMessages] = useState<ClientChatMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [people, setPeople]     = useState<MentionProfile[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const rows = await listProjectResponsibleProfiles(conv.projectId)
      if (alive) setPeople(rows)
    })()
    return () => { alive = false }
  }, [conv.projectId])

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

  async function handleSend(text: string, mentions: string[]) {
    await addClientMessage({
      projectId: conv.projectId, body: text, author: authorName, source: 'management', mentions,
    })
    await notifyMentions(mentions, authorName, conv, text)
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
            {g.msgs.map(msg => <Bubble key={msg.id} msg={msg} people={people} />)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer onSend={handleSend} people={people} />
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
  const [people, setPeople] = useState<MentionProfile[]>([])
  const [menu, setMenu] = useState<{ items: MentionProfile[]; start: number } | null>(null)
  const [picked, setPicked] = useState<MentionProfile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    if (!conv) { setPeople([]); return }
    ;(async () => {
      const rows = await listProjectResponsibleProfiles(conv.projectId)
      if (alive) setPeople(rows)
    })()
    return () => { alive = false }
  }, [conv?.projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(p: MentionProfile) {
    if (!menu) return
    const caret = inputRef.current?.selectionStart ?? text.length
    setText(`${text.slice(0, menu.start)}@${p.name} ${text.slice(caret)}`)
    setPicked(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, p]))
    setMenu(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  async function send() {
    if (!conv || !text.trim()) return
    setBusy(true)
    const body = text.trim()
    const author = conv.clientName || 'Cliente (teste)'
    const mentions = picked.filter(p => body.includes(`@${p.name}`)).map(p => p.id)
    await addClientMessage({ projectId: conv.projectId, body, author, source: 'client', mentions })
    await notifyMentions(mentions, author, conv, body)
    setText('')
    setPicked([])
    setBusy(false)
    onSent()
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto',
    }}>
      <div style={{ position: 'relative' }}>
        {menu && <MentionMenu items={menu.items} onPick={pick} />}
        <input
          ref={inputRef}
          value={text}
          onChange={e => {
            setText(e.target.value)
            const q = mentionQuery(e.target.value, e.target.selectionStart ?? 0)
            setMenu(q ? { items: matchPeople(people, q.query), start: q.start } : null)
          }}
          placeholder="Mensagem do cliente (teste)…"
          onKeyDown={e => { if (e.key === 'Enter' && !menu) void send() }}
          onBlur={() => setMenu(null)}
          style={{
            width: 220, background: T.bgSurface2, border: `1px solid ${T.border}`,
            borderRadius: 7, color: T.text1, fontSize: 12, padding: '6px 10px', outline: 'none',
          }}
        />
      </div>
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
    if (!activeUser?.user_id) { setConvs([]); setLoading(false); return }
    const [signals, responsible] = await Promise.all([
      listProjectsWithClientSignals(),
      listResponsibleProjects(activeUser.user_id, isSupervisor),
    ])
    const merged = new Map<string, ProjectSignalSummary>()
    for (const r of responsible) merged.set(r.projectId, r)
    for (const s of signals) merged.set(s.projectId, s)
    const rows = [...merged.values()].sort((a, b) => {
      const aEmpty = a.lastBody === 'Sem mensagens ainda'
      const bEmpty = b.lastBody === 'Sem mensagens ainda'
      if (aEmpty && !bEmpty) return 1
      if (!aEmpty && bEmpty) return -1
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    })
    setConvs(rows)
    setLoading(false)
  }, [activeUser?.user_id, isSupervisor])

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
