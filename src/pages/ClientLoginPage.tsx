import { useState } from 'react'
import { T } from '../components/ds/tokens'
import { portalLogin, type PortalLoginUser } from '../data/db/clientPortal'
import { savePortalSession } from '../lib/portalSession'
import { requestPasswordReset } from '../lib/passwordReset'


interface Props {
  onSuccess: (permission: 'viewer' | 'admin', mustChangePassword: boolean) => void
  onBack?: () => void
}

type PortalLoginState = 'idle' | 'loading' | 'error' | 'success-viewer' | 'success-admin'

const PA = '#34d399'
const PADim = 'rgba(52,211,153,0.12)'
const PABorder = 'rgba(52,211,153,0.30)'

function EyeOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeClosed() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M12 2a10 10 0 0 1 10 10"/>
    </svg>
  )
}

function LogoMark({ size = 32 }: { size?: number }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill={PADim} stroke={PABorder}/>
      <path d="M16 6 L24 26 L19.5 26 L16 17 L12.5 26 L8 26 Z" fill={PA}/>
      <path d="M10.5 20 L21.5 20" stroke={PA} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function CheckCircle() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="31" fill={PADim} stroke={PA} strokeWidth="1.5"/>
      <path d="M20 32 L28 40 L44 24" stroke={PA} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function ClientLoginPage({ onSuccess }: Props) {

  const [loginState, setLoginState] = useState<PortalLoginState>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const [errorMsg, setErrorMsg] = useState('')
  const [portalUser, setPortalUser] = useState<PortalLoginUser | null>(null)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotBusy, setForgotBusy] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotEmail.trim() || forgotBusy) return
    setForgotBusy(true)
    await requestPasswordReset(forgotEmail)   // e-mail nunca é logado
    setForgotBusy(false)
    setForgotSent(true)
  }

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
  const canSubmit = email.length > 0 && password.length > 0 && !isLoading

  function handleEnterPortal() {
    onSuccess(isAdmin ? 'admin' : 'viewer', portalUser?.mustChangePassword ?? false)
  }

  const inputStyle = (error: boolean): React.CSSProperties => ({
    width: '100%',
    boxSizing: 'border-box',
    background: T.bgSurface2,
    border: `1px solid ${error ? T.crit : T.border}`,
    borderRadius: 8,
    padding: '10px 12px',
    color: T.text1,
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.15s',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: ${PABorder} !important; }
        .client-link:hover { text-decoration: underline; }
        @media (max-width: 900px) {
          .client-left { display: none; }
          .client-right { width: 100% !important; }
          .client-card { width: 100% !important; max-width: 420px; }
        }
      `}</style>

      {/* LEFT BRAND PANEL */}
      <div className="client-left" style={{
        width: '42%',
        minHeight: '100vh',
        background: 'var(--brand-panel, linear-gradient(145deg, #080b11 0%, #0e1016 50%, #111827 100%))',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Logo row top-left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={32} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text1, lineHeight: 1.1 }}>Dash View</div>
            <div style={{ fontSize: 11, color: PA, lineHeight: 1 }}>by Altech Agency</div>
          </div>
        </div>

        {/* Hero tagline — vertically centered */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 32 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 700, color: T.text1, lineHeight: 1.25,
            margin: '0 0 12px 0', maxWidth: 360,
          }}>
            Acompanhe seu projeto em tempo real.
          </h1>
          <p style={{ fontSize: 14, color: T.text3, margin: '0 0 40px 0', lineHeight: 1.6, maxWidth: 360 }}>
            Entregas · Sprints · Aprovações — no seu portal.
          </p>

          {/* Floating preview cards */}
          <div style={{ position: 'relative', height: 180, width: '100%', maxWidth: 320 }}>
            {/* Card 1 — bottom: Sprint progress */}
            <div style={{
              position: 'absolute', bottom: 0, left: 10,
              background: T.bgSurface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 12, boxShadow: T.shadow2,
              width: 240, transform: 'rotate(-2deg)',
            }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Sprint 3 · 68% concluído</div>
              <div style={{ background: T.border, borderRadius: 4, height: 6, width: '100%' }}>
                <div style={{ background: PA, borderRadius: 4, height: 6, width: '68%' }} />
              </div>
              <div style={{ fontSize: 10, color: PA, marginTop: 4, textAlign: 'right' }}>68%</div>
            </div>

            {/* Card 2 — middle: Board mini */}
            <div style={{
              position: 'absolute', bottom: 36, left: 36,
              background: T.bgSurface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 12, boxShadow: T.shadow2,
              width: 220,
            }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 8 }}>Entregas · Aguardando aprovação</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {['#6a7390', PA, T.accent].map((c, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: T.text3, marginBottom: 4 }}>
                      {['A fazer', 'Revisão', 'Aprovado'][i]}
                    </div>
                    {[0, 1, 2].slice(0, 3 - i).map(j => (
                      <div key={j} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: c, marginBottom: 4,
                      }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3 — top: Alert chip */}
            <div style={{
              position: 'absolute', top: 0, left: 60,
              background: T.bgSurface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '8px 12px', boxShadow: T.shadow2,
              transform: 'rotate(2deg)',
            }}>
              <div style={{ fontSize: 12, color: PA, fontWeight: 600 }}>
                ✓ PO-18 aprovado pelo cliente
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ fontSize: 11, color: T.text3 }}>
          © {new Date().getFullYear()} Altech Agency · Privacidade · Termos
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div className="client-right" style={{
        width: '58%', minHeight: '100vh',
        background: T.bgPage,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', padding: '32px 24px',
      }}>
        <div className="client-card" style={{ width: '100%', maxWidth: 380 }}>

          {/* Small logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
            <LogoMark size={24} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text1 }}>Dash View</span>
              <span style={{ fontSize: 11, color: PA, marginLeft: 4 }}>by Altech Agency</span>
            </div>
          </div>

          {!isSuccess ? (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text1, margin: '0 0 4px 0' }}>
                  Acesse o portal do seu projeto
                </h2>
                <p style={{ fontSize: 13, color: T.text3, margin: 0 }}>
                  Entre com as credenciais enviadas por e-mail.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* E-mail field */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (loginState === 'error') setLoginState('idle') }}
                    placeholder="cliente@empresa.com"
                    style={inputStyle(loginState === 'error')}
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>

                {/* Senha field */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (loginState === 'error') setLoginState('idle') }}
                      placeholder="••••••••"
                      style={{ ...inputStyle(loginState === 'error'), paddingRight: 40 }}
                      autoComplete="current-password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: T.text3, padding: 2, display: 'flex', alignItems: 'center',
                      }}
                    >
                      {showPass ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                {/* Error bar */}
                {loginState === 'error' && (
                  <div style={{
                    background: T.critDim,
                    border: `1px solid ${T.crit}30`,
                    borderRadius: 8, padding: 10, fontSize: 12, color: T.crit,
                  }}>
                    ⚠ {errorMsg || 'Acesso não encontrado. Verifique suas credenciais ou entre em contato com a empresa que lhe concedeu acesso.'}
                  </div>
                )}

                {/* Forgot password link */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
                  <a
                    href="#"
                    className="client-link"
                    style={{ fontSize: 12, color: T.text3, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = T.accent }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = T.text3 }}
                    onClick={e => { e.preventDefault(); setForgotEmail(email); setForgotSent(false); setForgotOpen(true) }}
                  >
                    Esqueci minha senha
                  </a>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    width: '100%', height: 44,
                    background: canSubmit ? PA : T.bgSurface2,
                    color: canSubmit ? 'white' : T.text3,
                    border: 'none', borderRadius: 8,
                    fontSize: 14, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s',
                  }}
                >
                  {isLoading ? <><Spinner /> Verificando…</> : 'Entrar no portal'}
                </button>
              </div>
            </form>
          ) : (
            /* SUCCESS STATE */
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <CheckCircle />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text1, margin: '0 0 8px 0' }}>
                Bem-vindo ao portal!
              </h2>
              <div style={{ marginBottom: 24 }}>
                <span style={{
                  background: isAdmin ? PADim : T.bgSurface2,
                  border: `1px solid ${isAdmin ? PA : T.border2}`,
                  color: isAdmin ? PA : T.text2,
                  borderRadius: 20, padding: '3px 14px', fontSize: 12,
                }}>
                  Perfil carregado: {isAdmin ? 'Administrador do portal' : 'Visualizador'}
                </span>
              </div>
              <button
                onClick={handleEnterPortal}
                style={{
                  width: '100%', height: 44,
                  background: PA, color: 'white',
                  border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {isAdmin ? 'Abrir portal (Administrador)' : 'Abrir portal (Visualizador)'}
              </button>
            </div>
          )}

          {/* Bottom */}
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: T.text3, marginBottom: 6 }}>
              Não tem acesso?{' '}
              <a href="#" className="client-link" style={{ color: PA, textDecoration: 'none' }}>
                Solicite ao responsável do seu projeto.
              </a>
            </div>
          </div>
        </div>

        {forgotOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24,
            }}
            onClick={() => setForgotOpen(false)}
          >
            <form
              onClick={e => e.stopPropagation()}
              onSubmit={handleForgot}
              style={{ width: '100%', maxWidth: 380, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text1, margin: '0 0 6px' }}>Esqueci minha senha</h3>
              <p style={{ fontSize: 12.5, color: T.text3, margin: '0 0 16px' }}>
                Informe seu e-mail e enviaremos instruções para redefinir a senha.
              </p>

              {forgotSent ? (
                <div style={{ background: T.successDim, border: `1px solid ${T.success}40`, borderRadius: 8, padding: 10, fontSize: 12, color: T.success, marginBottom: 16 }}>
                  Se este e-mail tiver acesso, você receberá instruções para redefinir a senha.
                </div>
              ) : (
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="cliente@empresa.com"
                  autoComplete="email"
                  style={{ ...inputStyle(false), marginBottom: 16 }}
                />
              )}

              {!forgotSent && (
                <button
                  type="submit"
                  disabled={!forgotEmail.trim() || forgotBusy}
                  style={{
                    width: '100%', height: 40, borderRadius: 8, border: 'none', marginBottom: 10,
                    background: forgotEmail.trim() && !forgotBusy ? T.accent : T.bgSurface2,
                    color: forgotEmail.trim() && !forgotBusy ? 'white' : T.text3,
                    fontSize: 13.5, fontWeight: 600, cursor: forgotEmail.trim() && !forgotBusy ? 'pointer' : 'not-allowed',
                  }}
                >
                  {forgotBusy ? 'Enviando…' : 'Enviar'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                style={{ width: '100%', height: 36, borderRadius: 8, background: 'transparent', border: `1px solid ${T.border}`, color: T.text2, fontSize: 12.5, cursor: 'pointer' }}
              >
                {forgotSent ? 'Fechar' : 'Cancelar'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
