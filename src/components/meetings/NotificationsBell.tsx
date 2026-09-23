// Meeting Intelligence — sino de notificações na tela de Reuniões.
// (O ponto de integração "global" seria o Header do app; aqui fica na própria tela
// para não tocar o Header compartilhado.)
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { IcBell } from '@/components/meetings/icons'
import { formatDate } from '@/components/meetings/meetingUi'
import {
  listNotifications, markNotificationRead, markAllNotificationsRead,
  type MeetingNotification, type MeetingNotificationKind,
} from '@/data/db/meetingNotifications'

const KIND_COLOR: Record<MeetingNotificationKind, string> = {
  request: T.accent, approved: T.success, denied: T.crit, share: T.accent, usage: T.warn, module: T.purple,
}

export function NotificationsBell({ currentUser }: { currentUser: { id: string; isAdmin: boolean } }) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<MeetingNotification[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    void listNotifications({ profileId: currentUser.id, isAdmin: currentUser.isAdmin }).then(l => { if (alive) setList(l) })
    return () => { alive = false }
  }, [currentUser.id, currentUser.isAdmin, reloadKey])

  const unread = list.filter(n => !n.read).length

  async function markAll() {
    await markAllNotificationsRead({ profileId: currentUser.id, isAdmin: currentUser.isAdmin })
    setReloadKey(k => k + 1)
  }
  async function openItem(n: MeetingNotification) {
    if (!n.read) { await markNotificationRead(n.id); setReloadKey(k => k + 1) }
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="Notificações" style={{ position: 'relative', width: 38, height: 38, borderRadius: 9, border: `1px solid ${T.border}`, background: T.bgSurface2, color: T.text1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IcBell size={17} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: T.crit, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 46, right: 0, width: 360, maxWidth: 'calc(100vw - 32px)', background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 14, boxShadow: T.shadowModal, zIndex: 41, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
              <b style={{ fontSize: 14, color: T.text1 }}>Notificações</b>
              {unread > 0 && <button onClick={markAll} style={{ background: 'none', border: 0, color: T.accent, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Marcar todas como lidas</button>}
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {list.length === 0 ? (
                <div style={{ padding: 34, textAlign: 'center', color: T.text3, fontSize: 13 }}>Nenhuma notificação.</div>
              ) : list.map(n => (
                <button key={n.id} onClick={() => openItem(n)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '13px 16px', borderBottom: `1px solid ${T.border}`, background: n.read ? 'transparent' : T.accentDim, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: KIND_COLOR[n.kind], marginTop: 6, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: T.text1 }}>{n.body}</div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 3 }}>{formatDate(n.createdAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
