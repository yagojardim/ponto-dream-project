// Meeting Intelligence — modal "Liberar acesso ao módulo" (Onda B, casca).
// Cria a linha de cota (com a cota padrão do cargo) para usuários que ainda não têm.
import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { overlayStyle, modalStyle, Avatar, formatMinutes } from '@/components/meetings/meetingUi'
import { IcUsers, IcClose, IcCheck, IcShield } from '@/components/meetings/icons'
import { getMembers, type MemberRow } from '@/data/db/members'
import { listTenantQuotas, grantModuleAccess } from '@/data/db/meetingQuotas'
import { quotaMinutesForRole } from '@/config/meetingFlags'

interface Props {
  onClose: () => void
  onDone: () => void
  onToast: (t: string) => void
}

export function AddUsersModal({ onClose, onDone, onToast }: Props) {
  const [candidates, setCandidates] = useState<MemberRow[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [members, quotas] = await Promise.all([getMembers(), listTenantQuotas()])
      if (!alive) return
      const withQuota = new Set(quotas.map(q => q.profileId))
      setCandidates(members.filter(m => !withQuota.has(m.id) && !m.tenant_owner))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  function toggle(id: string) {
    setSel(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function confirm() {
    if (sel.size === 0 || saving) return
    setSaving(true)
    const chosen = candidates.filter(c => sel.has(c.id)).map(c => ({ id: c.id, role: c.primary_role }))
    const n = await grantModuleAccess(chosen)
    setSaving(false)
    if (n > 0) { onDone(); onClose(); onToast(`${n} usuário(s) liberado(s) no módulo.`) }
    else onToast('Não foi possível liberar o acesso.')
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: T.accentDim, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent, flexShrink: 0 }}><IcUsers size={17} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: T.text1 }}>Liberar acesso ao módulo</div>
            <div style={{ fontSize: 12.5, color: T.text2 }}>Usuários que ainda não têm o Meeting Intelligence</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', display: 'inline-flex' }}><IcClose /></button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: T.purpleDim, border: `1px solid ${T.accentBorder}`, borderRadius: 10, fontSize: 13, lineHeight: 1.55, color: T.text1 }}>
            <span style={{ color: T.purple, flexShrink: 0, marginTop: 1 }}><IcShield /></span>
            <div>Cada usuário recebe a <b>cota padrão do cargo</b> (ajustável depois na tabela) e é avisado.</div>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: T.text3, fontSize: 13 }}>Carregando…</div>
          ) : candidates.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: T.text3, fontSize: 13 }}>Todos os usuários já têm o módulo liberado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflow: 'auto' }}>
              {candidates.map(m => {
                const on = sel.has(m.id)
                return (
                  <button key={m.id} onClick={() => toggle(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: on ? T.accentDim : T.bgSurface2, border: `1px solid ${on ? T.accentBorder : T.border}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Avatar name={m.name} seed={m.id} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: T.text1, fontSize: 13.5 }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: T.text3 }}>{m.primary_role ?? '—'} · cota padrão {formatMinutes(quotaMinutesForRole(m.primary_role))}</div>
                    </div>
                    <span style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${on ? T.accent : T.border2}`, background: on ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>{on && <IcCheck size={14} />}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', borderTop: `1px solid ${T.border}`, background: T.bgSurface2 }}>
          <span style={{ fontSize: 12, color: T.text3, display: 'inline-flex', alignItems: 'center', gap: 7 }}><IcUsers size={13} />{sel.size} selecionado(s)</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', height: 38, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={confirm} disabled={sel.size === 0 || saving} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: (sel.size === 0 || saving) ? 'not-allowed' : 'pointer', opacity: (sel.size === 0 || saving) ? 0.55 : 1, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}><IcCheck />Liberar acesso{sel.size ? ` (${sel.size})` : ''}</button>
        </div>
      </div>
    </div>
  )
}
