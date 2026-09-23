// Meeting Intelligence — modal Compartilhar reunião (Onda A, funciona já).
// Só o dono/admin abre este modal (gate no header do detalhe). Quem recebe a
// reunião não consome cota (regra do mockup).
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { overlayStyle, modalStyle, Avatar } from '@/components/meetings/meetingUi'
import { IcShare, IcCheck, IcClose, IcShield } from '@/components/meetings/icons'
import { getMembers, type MemberRow } from '@/data/db/members'
import { listShares, addShare, removeShare } from '@/data/db/meetingShares'

interface Props {
  meetingId: string
  meetingTitle: string
  ownerId: string
  currentUser: { id: string; name: string }
  onClose: () => void
  onChanged: () => void
  onToast: (t: string) => void
}

export function ShareMeetingModal({ meetingId, meetingTitle, ownerId, currentUser, onClose, onChanged, onToast }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [shared, setShared]   = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [all, shares] = await Promise.all([getMembers(), listShares(meetingId)])
      if (!alive) return
      setMembers(all.filter(m => m.id !== ownerId))
      setShared(new Set(shares.map(s => s.profileId)))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [meetingId, ownerId])

  async function toggle(m: MemberRow) {
    if (busy) return
    setBusy(m.id)
    const isOn = shared.has(m.id)
    const ok = isOn
      ? await removeShare(meetingId, m.id)
      : await addShare({ meetingId, meetingTitle, sharedWithId: m.id, sharedById: currentUser.id, sharedByName: currentUser.name })
    setBusy(null)
    if (!ok) { onToast('Não foi possível atualizar o compartilhamento.'); return }
    setShared(prev => {
      const next = new Set(prev)
      if (isOn) next.delete(m.id); else next.add(m.id)
      return next
    })
    onChanged()
    onToast(isOn ? 'Acesso removido.' : `Compartilhada com ${m.name}.`)
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: T.accentDim, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent, flexShrink: 0 }}><IcShare size={17} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: T.text1 }}>Compartilhar reunião</div>
            <div style={{ fontSize: 12.5, color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meetingTitle}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', display: 'inline-flex' }}><IcClose /></button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: T.purpleDim, border: `1px solid ${T.accentBorder}`, borderRadius: 10, fontSize: 13, lineHeight: 1.55, color: T.text1 }}>
            <span style={{ color: T.purple, flexShrink: 0, marginTop: 1 }}><IcShield /></span>
            <div>Quem receber <b>copia a transcrição e a ata, e adiciona notas</b> — <b>sem gastar a própria cota</b>.</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text1 }}>Pessoas do workspace</div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: T.text3, fontSize: 13 }}>Carregando…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: T.text3, fontSize: 13 }}>Ninguém mais no workspace.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflow: 'auto' }}>
              {members.map(m => {
                const on = shared.has(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m)}
                    disabled={busy === m.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: on ? T.accentDim : T.bgSurface2, border: `1px solid ${on ? T.accentBorder : T.border}`, borderRadius: 10, padding: '10px 12px', cursor: busy === m.id ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy === m.id ? 0.6 : 1 }}
                  >
                    <Avatar name={m.name} seed={m.id} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: T.text1, fontSize: 13.5 }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: T.text3 }}>{m.primary_role ?? '—'}</div>
                    </div>
                    <span style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${on ? T.accent : T.border2}`, background: on ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>{on && <IcCheck size={14} />}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', borderTop: `1px solid ${T.border}`, background: T.bgSurface2 }}>
          <span style={{ fontSize: 12, color: T.text3, display: 'inline-flex', alignItems: 'center', gap: 7 }}><IcShare />{shared.size} pessoa(s) com acesso, além de você.</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', height: 38, padding: '0 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Concluir</button>
        </div>
      </div>
    </div>
  )
}
