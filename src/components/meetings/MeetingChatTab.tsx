// Meeting Intelligence — aba Chat sobre a reunião (RAG). Onda B, casca CHAT_RAG_ENABLED.
import { useEffect, useRef, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { cardStyle } from '@/components/meetings/meetingUi'
import { IcSpark } from '@/components/meetings/icons'
import { askMeeting, type ChatTurn } from '@/data/db/meetingChat'

export function MeetingChatTab({ meetingId }: { meetingId: string }) {
  const [log, setLog] = useState<ChatTurn[]>([
    { role: 'bot', text: 'Posso responder sobre esta reunião. Pergunte, por exemplo: "quais foram as decisões?".' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [log])

  async function send() {
    const q = input.trim()
    if (!q || sending) return
    setInput('')
    setLog(l => [...l, { role: 'user', text: q }])
    setSending(true)
    const answer = await askMeeting(meetingId, q)
    setSending(false)
    setLog(l => [...l, { role: 'bot', text: answer }])
  }

  return (
    <div style={{ ...cardStyle, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: T.text3 }}>
        <span style={{ color: T.purple, display: 'inline-flex' }}><IcSpark size={13} /></span>
        Chat sobre a reunião (RAG) — responde com base na transcrição.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', height: 460 }}>
        <div ref={logRef} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px' }}>
          {log.map((m, i) => (
            <div key={i} style={{
              maxWidth: '78%', padding: '11px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6,
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? T.accent : T.bgSurface2,
              color: m.role === 'user' ? '#fff' : T.text1,
              border: m.role === 'user' ? 'none' : `1px solid ${T.border}`,
              borderBottomRightRadius: m.role === 'user' ? 4 : 12,
              borderBottomLeftRadius: m.role === 'user' ? 12 : 4,
            }}>{m.text}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            placeholder="Pergunte sobre esta reunião…"
            style={{ flex: 1, height: 42, padding: '0 14px', fontSize: 13.5, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text1, fontFamily: 'inherit', outline: 'none' }}
          />
          <button onClick={send} disabled={sending} style={{ height: 42, padding: '0 18px', borderRadius: 10, border: 'none', background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1, fontFamily: 'inherit' }}>Enviar</button>
        </div>
      </div>
    </div>
  )
}
