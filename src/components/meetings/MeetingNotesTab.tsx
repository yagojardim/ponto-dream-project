// Meeting Intelligence — aba Notas do detalhe (Onda A, funciona já).
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { cardStyle, Avatar, formatDate } from '@/components/meetings/meetingUi'
import { IcPlus } from '@/components/meetings/icons'
import { listNotes, createNote, deleteNote, type MeetingNote } from '@/data/db/meetingNotes'

interface Props {
  meetingId: string
  currentUserId: string
  isAdmin: boolean
  onToast: (t: string) => void
}

export function MeetingNotesTab({ meetingId, currentUserId, isAdmin, onToast }: Props) {
  const [notes, setNotes]   = useState<MeetingNote[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [body, setBody]     = useState('')
  const [anchor, setAnchor] = useState('')
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const list = await listNotes(meetingId)
      if (alive) { setNotes(list); setLoading(false) }
    })()
    return () => { alive = false }
  }, [meetingId, reloadKey])

  async function save() {
    if (!body.trim() || saving) return
    setSaving(true)
    const id = await createNote({ meetingId, body, timeAnchor: anchor || null }, currentUserId)
    setSaving(false)
    if (id) {
      setBody(''); setAnchor(''); setAdding(false); setReloadKey(k => k + 1)
      onToast('Apontamento salvo.')
    } else onToast('Não foi possível salvar o apontamento.')
  }

  async function remove(id: string) {
    const ok = await deleteNote(id)
    if (ok) { setReloadKey(k => k + 1); onToast('Apontamento excluído.') }
    else onToast('Não foi possível excluir.')
  }

  const field: React.CSSProperties = {
    width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10,
    color: T.text1, fontSize: 13.5, fontFamily: 'inherit', padding: '10px 12px', outline: 'none',
  }

  return (
    <div style={{ ...cardStyle, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Notas da reunião</div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{ height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${T.accentBorder}`, background: T.accentDim, color: T.accent, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}
          ><IcPlus />Adicionar apontamento</button>
        )}
      </div>
      <p style={{ margin: '8px 0 16px', fontSize: 12.5, color: T.text3, lineHeight: 1.5 }}>
        Apontamentos da equipe — visíveis a quem tem acesso à reunião. A transcrição continua intacta.
      </p>

      {adding && (
        <div style={{ ...cardStyle, borderColor: T.accentBorder, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Escreva seu apontamento…"
            style={{ ...field, minHeight: 96, resize: 'vertical', lineHeight: 1.6 }}
            autoFocus
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12.5, color: T.text2, display: 'flex', alignItems: 'center', gap: 8 }}>
              Âncora no tempo (opcional)
              <input value={anchor} onChange={e => setAnchor(e.target.value)} placeholder="mm:ss" style={{ ...field, width: 88, padding: '8px 10px' }} />
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button onClick={() => { setAdding(false); setBody(''); setAnchor('') }} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={save} disabled={!body.trim() || saving} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: (!body.trim() || saving) ? 'not-allowed' : 'pointer', opacity: (!body.trim() || saving) ? 0.55 : 1, fontFamily: 'inherit' }}>{saving ? 'Salvando…' : 'Salvar apontamento'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: T.text3, fontSize: 13 }}>Carregando…</div>
      ) : notes.length === 0 ? (
        !adding && <div style={{ padding: 34, textAlign: 'center', color: T.text3, fontSize: 13 }}>Nenhum apontamento ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map(n => {
            const canDelete = isAdmin || n.authorId === currentUserId
            return (
              <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 11 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 9px', borderRadius: 999, background: T.bgSurface, border: `1px solid ${T.border}`, color: T.text2, fontSize: 11.5 }}>
                      <Avatar name={n.authorName ?? '—'} seed={n.authorId ?? n.id} size={16} />{n.authorName ?? '—'}
                    </span>
                    {n.timeAnchor && (
                      <span style={{ height: 22, padding: '0 9px', display: 'inline-flex', alignItems: 'center', borderRadius: 999, color: T.accent, border: `1px solid ${T.accentBorder}`, fontSize: 11.5 }}>↳ {n.timeAnchor}</span>
                    )}
                    <span style={{ fontSize: 11, color: T.text3 }}>{formatDate(n.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: T.text1, whiteSpace: 'pre-wrap' }}>{n.body}</div>
                </div>
                {canDelete && (
                  <button onClick={() => remove(n.id)} style={{ height: 30, padding: '0 10px', borderRadius: 8, background: 'transparent', border: `1px solid ${T.border}`, color: T.text3, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Excluir</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
