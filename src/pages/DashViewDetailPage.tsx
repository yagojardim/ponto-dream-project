import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { LoadingState, EmptyState } from '@/components/ds/DashboardKit'
import { useSession } from '@/data/SessionContext'
import { copyToClipboard } from '@/utils/copyToClipboard'
import {
  fetchDashDetail, createClientPortalUsers, blockPortalUser, reactivatePortalUser,
  removePortalUser, updatePortalUser, resetPortalUserPassword,
  type DashDetail, type ClientPortalUserRow, type PortalRole,
} from '@/data/db/clientPortal'
import { generateTempPassword } from '@/data/security'

interface Props {
  projectId: string
  onBack: () => void
  onNav?: (view: string, targetId?: string) => void
}

const cardStyle: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden',
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  active:   { color: T.success, label: 'Ativo' },
  invited:  { color: T.warn,    label: 'Convidado' },
  pending:  { color: T.warn,    label: 'Convidado' },
  blocked:  { color: T.crit,    label: 'Bloqueado' },
  inactive: { color: T.text3,   label: 'Inativo' },
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { color: T.text3, label: status }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: meta.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
      {meta.label}
    </span>
  )
}

function RolePill({ role }: { role: PortalRole }) {
  const admin = role === 'portal-admin'
  return (
    <span style={{
      fontSize: 11, padding: '2px 9px', borderRadius: 20,
      color: admin ? T.purple : T.text2,
      background: admin ? T.purpleDim : T.bgSurface2,
      border: `1px solid ${admin ? T.purple + '4D' : T.border2}`,
    }}>
      {admin ? '◆ Admin do portal' : '◦ Visualizador'}
    </span>
  )
}

function ActionBtn({ label, color, onClick, disabled }: {
  label: string; color: string; onClick: () => void; disabled?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        fontSize: 11, padding: '3px 9px', borderRadius: 5,
        background: hov && !disabled ? `${color}20` : 'transparent',
        color: disabled ? T.text3 : hov ? color : T.text2,
        border: `1px solid ${disabled ? T.border : hov ? color + '55' : T.border}`,
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
      }}>{label}</button>
  )
}

const inputStyle: React.CSSProperties = {
  background: T.bgPage, border: `1px solid ${T.border2}`, borderRadius: 7,
  padding: '8px 11px', fontSize: 12, color: T.text1, outline: 'none', width: '100%',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.text3, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  )
}

function Switch({ on, onToggle, label, desc }: { on: boolean; onToggle: () => void; label: string; desc?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text1, marginBottom: desc ? 2 : 0 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <button type="button" onClick={onToggle} style={{
        width: 40, height: 22, borderRadius: 12, border: 'none',
        background: on ? T.success : T.border2, cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block',
        }} />
      </button>
    </div>
  )
}

function PasswordReveal({ password }: { password: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    const ok = await copyToClipboard(password)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }
  return (
    <div style={{
      background: T.bgPage, borderLeft: `4px solid ${T.accent}`, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: 16, marginTop: 4,
    }}>
      <div style={{ fontSize: 10.5, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        Senha temporária — exibida uma única vez
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 16, color: T.accent, letterSpacing: '0.1em', userSelect: 'all', flex: 1 }}>
          {password}
        </span>
        <button onClick={copy} style={{
          background: copied ? T.successDim : T.accentDim,
          border: `1px solid ${copied ? T.success : T.accentBorder}`,
          color: copied ? T.success : T.accent,
          borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0,
        }}>
          {copied ? '✓ Copiado!' : '📋 Copiar'}
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: T.text3, marginTop: 8, lineHeight: 1.5 }}>
        Copie e repasse ao usuário. Ele deve trocá-la no próximo acesso.
      </div>
    </div>
  )
}

// ─── Modal: incluir usuário ────────────────────────────────────────────────
function AddUserModal({ projectId, actorName, onClose, onCreated }: {
  projectId: string; actorName?: string; onClose: () => void; onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<PortalRole>('viewer')
  const [canApprove, setCanApprove] = useState(false)
  const [canPreview, setCanPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  async function submit() {
    if (!name.trim() || !email.trim()) { setError('Preencha nome e e-mail.'); return }
    setSaving(true); setError('')
    const pwd = generateTempPassword()
    try {
      const created = await createClientPortalUsers({
        projectIds: [projectId],
        name: name.trim(),
        email: email.trim(),
        portalRole: role,
        canApprove,
        canPreview,
        canComment: true,
        tempPassword: pwd,
        actorName,
      })
      if (created.length === 0) throw new Error('Não foi possível incluir o usuário. Verifique os dados e tente novamente.')
      setTempPassword(pwd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao incluir usuário.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(9,9,11,0.80)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadowModal, width: 440, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 18px', borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ margin: 0, fontSize: 14.5, color: T.text1 }}>Incluir usuário no dash</h3>
          <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: T.text3, fontSize: 18, lineHeight: 1 }}>✕</span>
        </div>
        <div style={{ padding: 18 }}>
          {tempPassword ? (
            <>
              <div style={{ fontSize: 13, color: T.text2, marginBottom: 10 }}>
                Usuário <strong style={{ color: T.text1 }}>{name}</strong> incluído com sucesso.
              </div>
              <PasswordReveal password={tempPassword} />
            </>
          ) : (
            <>
              <Field label="Nome"><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Nome do usuário" /></Field>
              <Field label="E-mail"><input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@cliente.com" /></Field>
              <Field label="Papel">
                <select style={inputStyle} value={role} onChange={e => setRole(e.target.value as PortalRole)}>
                  <option value="viewer">Visualizador — só acompanha</option>
                  <option value="portal-admin">Admin do portal — gerencia e aprova</option>
                </select>
              </Field>
              <Switch on={canApprove} onToggle={() => setCanApprove(v => !v)} label="Permitir aprovar entregas" />
              <Switch on={canPreview} onToggle={() => setCanPreview(v => !v)} label="Permitir ver preview" />
              <div style={{ fontSize: 11, color: T.text3, marginTop: -4 }}>Comentar: sempre habilitado para todo cliente.</div>
              {error && <div style={{ marginTop: 12, fontSize: 12, color: T.crit }}>{error}</div>}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', padding: '14px 18px', borderTop: `1px solid ${T.border}` }}>
          {tempPassword ? (
            <button onClick={onCreated} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Concluir</button>
          ) : (
            <>
              <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => void submit()} disabled={saving} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Enviando…' : 'Incluir usuário'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal: editar usuário ─────────────────────────────────────────────────
function EditUserModal({ user, actorName, onClose, onSaved }: {
  user: ClientPortalUserRow; actorName?: string; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(user.name)
  const [role, setRole] = useState<PortalRole>(user.portal_role)
  const [canApprove, setCanApprove] = useState(user.can_approve)
  const [canPreview, setCanPreview] = useState(user.can_preview)
  const [canComment, setCanComment] = useState(user.can_comment)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetPwd, setResetPwd] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    const ok = await updatePortalUser(user.id, { name: name.trim() || user.name, portalRole: role, canApprove, canPreview, canComment }, actorName)
    setSaving(false)
    if (ok) onSaved()
    else setError('Não foi possível salvar as alterações. Tente novamente.')
  }

  async function resetPassword() {
    setResetting(true); setError('')
    const pwd = await resetPortalUserPassword(user.id, actorName)
    setResetting(false)
    if (pwd) setResetPwd(pwd)
    else setError('Não foi possível gerar a nova senha agora.')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(9,9,11,0.80)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadowModal, width: 460, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 18px', borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ margin: 0, fontSize: 14.5, color: T.text1 }}>Editar usuário</h3>
          <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: T.text3, fontSize: 18, lineHeight: 1 }}>✕</span>
        </div>
        <div style={{ padding: 18 }}>
          <Field label="Nome"><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Papel">
            <select style={inputStyle} value={role} onChange={e => setRole(e.target.value as PortalRole)}>
              <option value="viewer">Visualizador — só acompanha</option>
              <option value="portal-admin">Admin do portal — gerencia e aprova</option>
            </select>
          </Field>
          <Switch on={canApprove} onToggle={() => setCanApprove(v => !v)} label="Aprovar entregas" />
          <Switch on={canPreview} onToggle={() => setCanPreview(v => !v)} label="Ver prévias" />
          <Switch on={canComment} onToggle={() => setCanComment(v => !v)} label="Comentar" />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0 4px', borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>Reset de senha</div>
              <div style={{ fontSize: 11, color: T.text3 }}>Gera uma nova senha temporária para este usuário</div>
            </div>
            <button onClick={() => void resetPassword()} disabled={resetting} style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 7, background: 'transparent',
              border: `1px solid ${T.border2}`, color: T.text2, cursor: resetting ? 'default' : 'pointer', whiteSpace: 'nowrap',
            }}>
              {resetting ? 'Gerando…' : '↻ Resetar senha'}
            </button>
          </div>
          {resetPwd && <PasswordReveal password={resetPwd} />}

          {error && <div style={{ marginTop: 12, fontSize: 12, color: T.crit }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', padding: '14px 18px', borderTop: `1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
            {resetPwd ? 'Fechar' : 'Cancelar'}
          </button>
          <button onClick={() => void save()} disabled={saving} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashViewDetailPage({ projectId, onBack, onNav }: Props) {
  const { activeUser } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<DashDetail | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ClientPortalUserRow | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const data = await fetchDashDetail(projectId)
        if (!alive) return
        if (!data) { setError('Dash não encontrado.'); return }
        setDetail(data)
      } catch {
        if (alive) setError('Não foi possível carregar o dash.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [projectId, reloadKey])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(id)
  }, [toast])

  function reload() { setReloadKey(k => k + 1) }
  function showToast(msg: string) { setToast(msg) }

  async function toggleBlock(u: ClientPortalUserRow) {
    setBusyId(u.id)
    const ok = u.status === 'blocked'
      ? await reactivatePortalUser(u.id, activeUser.name)
      : await blockPortalUser(u.id, activeUser.name)
    setBusyId(null)
    if (ok) reload()
    else showToast('Não foi possível salvar a alteração. Tente novamente.')
  }

  async function confirmRemove(u: ClientPortalUserRow) {
    setBusyId(u.id)
    const ok = await removePortalUser(u.id, activeUser.name)
    setBusyId(null)
    setConfirmRemoveId(null)
    if (ok) reload()
    else showToast('Não foi possível remover o usuário. Tente novamente.')
  }

  const users = detail?.users ?? []
  const admins = users.filter(u => u.portal_role === 'portal-admin').length
  const viewers = users.length - admins
  const pending = users.filter(u => u.status === 'invited' || u.status === 'pending').length

  return (
    <div style={{ padding: 24, background: T.bgPage, minHeight: '100%' }}>
      <div onClick={onBack} style={{ fontSize: 12.5, color: T.accent, cursor: 'pointer', marginBottom: 14, display: 'inline-block' }}>
        ← Voltar para a gestão
      </div>

      {loading && <LoadingState rows={4} />}
      {!loading && error && <div style={{ ...cardStyle, padding: 16, color: T.crit, fontSize: 13 }}>{error}</div>}

      {!loading && !error && detail && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text1 }}>{detail.projectName}</h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: T.text2 }}>
                Cliente <strong style={{ color: T.text1 }}>{detail.clientName ?? '—'}</strong>
                {detail.createdAt && <> · criado em {fmtDate(detail.createdAt)}</>}
              </p>
            </div>
            {onNav && (
              <button onClick={() => onNav('client-access')} style={{
                fontSize: 12.5, padding: '7px 13px', borderRadius: 9, border: `1px solid ${T.border2}`,
                background: T.bgSurface2, color: T.text1, cursor: 'pointer',
              }}>+ Criar acesso (jornada padrão)</button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={cardStyle}>
              <div style={{ padding: '13px 15px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: T.text2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Usuários</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: T.text1, marginTop: 4 }}>{users.length}</div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{admins} admin · {viewers} viewer</div>
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ padding: '13px 15px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: T.text2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Convidados</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: pending > 0 ? T.warn : T.text1, marginTop: 4 }}>{pending}</div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>aguardando 1º acesso</div>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T.text1 }}>Usuários deste dash</h2>
              <button onClick={() => setAddOpen(true)} style={{
                marginLeft: 'auto', fontSize: 12, padding: '6px 12px', borderRadius: 7,
                background: T.accent, border: 'none', color: '#fff', cursor: 'pointer',
              }}>+ Incluir usuário</button>
            </div>

            {users.length === 0 ? (
              <div style={{ padding: '8px 0' }}><EmptyState message="Nenhum usuário neste dash." /></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {['Nome', 'E-mail', 'Papel', 'Aprovador', 'Status', ''].map(col => (
                      <th key={col} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: T.text3, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i === users.length - 1 ? 'none' : `1px solid ${T.border}` }}>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, fontWeight: 600, color: T.text1 }}>{u.name}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: T.text3, fontFamily: 'monospace' }}>{u.email}</td>
                      <td style={{ padding: '11px 16px' }}><RolePill role={u.portal_role} /></td>
                      <td style={{ padding: '11px 16px', fontSize: 12 }}>
                        {u.can_approve ? <span style={{ color: T.success }}>✓ Aprova</span> : <span style={{ color: T.text3 }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 16px' }}><StatusPill status={u.status} /></td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {confirmRemoveId === u.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 11, color: T.warn }}>Remover?</span>
                            <ActionBtn label="Sim" color={T.crit} disabled={busyId === u.id} onClick={() => void confirmRemove(u)} />
                            <ActionBtn label="Não" color={T.text2} onClick={() => setConfirmRemoveId(null)} />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <ActionBtn label="Editar" color={T.accent} onClick={() => setEditingUser(u)} />
                            <ActionBtn
                              label={u.status === 'blocked' ? 'Reativar' : 'Bloquear'}
                              color={u.status === 'blocked' ? T.success : T.warn}
                              disabled={busyId === u.id}
                              onClick={() => void toggleBlock(u)}
                            />
                            <ActionBtn label="Remover" color={T.crit} onClick={() => setConfirmRemoveId(u.id)} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, padding: '11px 14px', borderRadius: 10, background: T.critDim, border: `1px solid ${T.crit}30`, fontSize: 12, color: T.text2 }}>
            🔒 Bloquear um usuário revoga o acesso ao portal na hora, sem apagar o histórico dele. Para tirar de vez, use Remover.
          </div>
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1300,
          background: T.bgSurface, border: `1px solid ${T.border}`, color: T.text1,
          padding: '10px 16px', borderRadius: 12, boxShadow: T.shadowModal, fontSize: 13,
        }}>{toast}</div>
      )}

      {addOpen && (
        <AddUserModal
          projectId={projectId}
          actorName={activeUser.name}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); reload() }}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          actorName={activeUser.name}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); reload() }}
        />
      )}
    </div>
  )
}
