import { useState } from 'react'
import { T } from '../components/ds/tokens'
import { portalLogin, type PortalLoginUser } from '../data/db/clientPortal'
import { savePortalSession } from '../lib/portalSession'


interface Props {
  onSuccess: (permission: 'viewer' | 'admin', mustChangePassword: boolean) => void
  onBack?: () => void
}

type PortalLoginState = 'idle' | 'loading' | 'error' | 'success-viewer' | 'success-admin'

const PA = '#34d399'
const PADim = 'rgba(52,211,153,0.12)'

export default function ClientLoginPage({ onSuccess }: Props) {

  const [loginState, setLoginState] = useState<PortalLoginState>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const [errorMsg, setErrorMsg] = useState('')
  const [portalUser, setPortalUser] = useState<PortalLoginUser | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoginState('loading')
    setErrorMsg('')
    try {
      const res = await portalLogin(email)
      if (!res.ok || !res.user) {
        setErrorMsg(res.error === 'unavailable' || res.error === 'server_error'
          ? 'Não foi possível validar o acesso agora. Tente novamente em instantes.'
          : 'Acesso não encontrado. Verifique suas credenciais ou entre em contato com a empresa que lhe concedeu acesso.')
        setLoginState('error')
        return
      }
      setPortalUser(res.user)
      savePortalSession({
        id: res.user.id, name: res.user.name, email: res.user.email, tenantId: res.user.tenantId,
      })

      setLoginState(res.user.permission === 'admin' ? 'success-admin' : 'success-viewer')
    } catch {
      setErrorMsg('Não foi possível validar o acesso agora. Tente novamente em instantes.')
      setLoginState('error')
    }
  }

  const isLoading = loginState === 'loading'
  const isSuccess = loginState === 'success-viewer' || loginState === 'success-admin'
  const isAdmin = loginState === 'success-admin'

  function handleEnterPortal() {
    onSuccess(isAdmin ? 'admin' : 'viewer', portalUser?.mustChangePassword ?? false)
  }

  const inputBase: React.CSSProperties = {
    width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8,
    padding: '10px 12px', color: T.text1, fontSize: 13, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: T.text2, marginBottom: 6, display: 'block', fontWeight: 500 }

  return (
    <div style={{
      background: '#080c10', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 420, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 40, boxShadow: T.shadowModal,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: PA, flexShrink: 0 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: '#e7eaf2' }}>Dash View</span>
          <span style={{
            fontSize: 10, color: T.text3, background: T.bgSurface2, borderRadius: 4,
            padding: '2px 6px', marginLeft: 2,
          }}>
            by Altech Agency
          </span>
        </div>

        <div style={{ height: 1, background: T.border, marginBottom: 20 }} />

        <div style={{ fontSize: 18, fontWeight: 700, color: T.text1, marginBottom: 6 }}>
          Acesse o portal do seu projeto
        </div>
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 24 }}>
          Entre com as credenciais enviadas por e-mail.
        </div>

        {/* Form */}
        {!isSuccess && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>E-mail</label>
              <input
                style={inputBase}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="cliente@empresa.com"
                disabled={isLoading}
                onFocus={e => (e.target.style.borderColor = PA)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputBase, paddingRight: 44 }}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  onFocus={e => (e.target.style.borderColor = PA)}
                  onBlur={e => (e.target.style.borderColor = T.border)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: T.text3, fontSize: 15, padding: 4,
                  }}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error bar */}
            {loginState === 'error' && (
              <div style={{
                background: 'rgba(240,128,92,0.1)', border: `1px solid ${T.crit}`, borderRadius: 8,
                padding: '10px 14px', fontSize: 12, color: T.crit, marginTop: 12, lineHeight: 1.5,
              }}>
                ⚠ {errorMsg || 'Acesso não encontrado. Verifique suas credenciais ou entre em contato com a empresa que lhe concedeu acesso.'}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              style={{
                width: '100%', background: (isLoading || !email || !password) ? T.border2 : PA,
                border: 'none', color: '#fff', height: 44, borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: (isLoading || !email || !password) ? 'not-allowed' : 'pointer',
                marginTop: 20, opacity: (isLoading || !email || !password) ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {isLoading ? (
                <>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                  Verificando…
                </>
              ) : 'Entrar no portal'}
            </button>
          </form>
        )}

        {/* Success state */}
        {isSuccess && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: PADim,
              border: `2px solid ${PA}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, margin: '0 auto 16px',
            }}>
              ✓
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text1, marginBottom: 8 }}>
              Bem-vindo ao portal!
            </div>
            <div style={{ marginBottom: 20 }}>
              <span style={{
                background: isAdmin ? PADim : T.bgSurface2,
                border: `1px solid ${isAdmin ? PA : T.border2}`,
                color: isAdmin ? PA : T.text2,
                borderRadius: 20, padding: '3px 14px', fontSize: 12,
              }}>
                Perfil carregado: {isAdmin ? 'Administrador do portal' : 'Visualizador'}
              </span>
            </div>

            <div style={{ fontSize: 12, color: T.text3, marginBottom: 16 }}>
              {isAdmin ? 'Acessando projetos com permissão de comentário…' : 'Acessando projetos…'}
            </div>

            {/* Skeleton project list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {[1, 2].map(i => (
                <div key={i} style={{
                  background: T.bgSurface2, borderRadius: 8, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.border2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 10, borderRadius: 4, background: T.border2, marginBottom: 6, width: i === 1 ? '60%' : '45%' }} />
                    <div style={{ height: 8, borderRadius: 4, background: T.border, width: '35%' }} />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleEnterPortal}
              style={{
                width: '100%', background: PA, border: 'none', color: '#fff',
                height: 44, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              {isAdmin ? 'Abrir portal (Administrador)' : 'Abrir portal (Visualizador)'}
            </button>
          </div>
        )}

        {/* Bottom */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: T.text3, marginBottom: 6 }}>
            Não tem acesso? Solicite ao responsável do seu projeto.
          </div>
          <div style={{ fontSize: 10, color: T.text3 }}>
            Ambiente: Dash View · Tenant: Altech Agency
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
