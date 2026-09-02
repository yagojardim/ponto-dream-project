import { useState } from 'react'
import { T } from '../components/ds/tokens'
import { signIn, INSPECTION_MODE_ENABLED } from '../lib/auth'
import { setRememberMe } from '../lib/authStorage'
import { loadProfileByAuthUserId, writeLoginAudit, touchAccess } from '../data/db/authProfile'
import { requestPasswordReset } from '../lib/passwordReset'


type LoginState = 'idle' | 'loading' | 'error' | 'success'

/** `role` só é enviado no atalho Inspection (dev). Login real chama sem role. */
interface Props {
  onSuccess: (role?: string) => void
  /** Abre a tela de auto-cadastro (Criar conta). */
  onCreateAccount?: () => void
  /** Pré-preenche o e-mail (ex.: vindo do cadastro quando o e-mail já existe). */
  initialEmail?: string
}


const ROLES = ['PMO', 'PM', 'P.O', 'SM', 'TechLead', 'Dev', 'UX/UI', 'QA']
const ROLE_COLORS: Record<string, string> = {
  PMO: '#a78bfa', PM: '#7d92ff', 'P.O': '#35c9ae', SM: '#e6b23c',
  TechLead: '#f0805c', Dev: '#38bdf8', 'UX/UI': '#f472b6', QA: '#4ade80',
}
const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  PMO:     { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  PM:      { bg: 'rgba(125,146,255,0.15)', color: '#7d92ff' },
  'P.O':   { bg: 'rgba(53,201,174,0.15)',  color: '#35c9ae' },
  SM:      { bg: 'rgba(230,178,60,0.15)',  color: '#e6b23c' },
  TechLead:{ bg: 'rgba(240,128,92,0.15)', color: '#f0805c' },
  Dev:     { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
  'UX/UI': { bg: 'rgba(244,114,182,0.15)',color: '#f472b6' },
  QA:      { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
}

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
      <rect width="32" height="32" rx="8" fill={T.accentDim} stroke={T.accentBorder}/>
      <path d="M16 6 L24 26 L19.5 26 L16 17 L12.5 26 L8 26 Z" fill={T.accent}/>
      <path d="M10.5 20 L21.5 20" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function CheckCircle() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="31" fill={T.successDim} stroke={T.success} strokeWidth="1.5"/>
      <path d="M20 32 L28 40 L44 24" stroke={T.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function LoginPage({ onSuccess, onCreateAccount, initialEmail }: Props) {
  const [loginState, setLoginState] = useState<LoginState>('idle')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(false)
  const [selectedRole, setSelectedRole] = useState('Dev')
  const [errorMsg, setErrorMsg] = useState('E-mail ou senha inválidos. Verifique e tente novamente.')
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
    if (!email || !password) return
    const mail = email.trim().toLowerCase()
    setLoginState('loading')

    setRememberMe(remember)                    // define localStorage vs sessionStorage
    const res = await signIn(mail, password)   // senha nunca é logada

    if (!res.ok || !res.user) {
      await writeLoginAudit('login_failed', { email: mail, reason: res.error })
      setErrorMsg('E-mail ou senha inválidos. Verifique e tente novamente.')
      setLoginState('error')
      return
    }

    const profile = await loadProfileByAuthUserId(res.user.id, res.user.email)
    if (!profile) {
      await writeLoginAudit('login_failed', { email: mail, reason: 'profile_not_found' })
      setErrorMsg('Usuário sem perfil ativo neste tenant. Fale com o Admin.')
      setLoginState('error')
      return
    }

    await writeLoginAudit('login_success', {
      email: mail, tenantId: profile.tenant_id, profileId: profile.user_id,
    })
    await touchAccess(profile.user_id, profile.tenant_id, null)
    onSuccess()
  }


  const isError = loginState === 'error'
  const isLoading = loginState === 'loading'
  const isSuccess = loginState === 'success'
  const canSubmit = email.length > 0 && password.length > 0 && !isLoading

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
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: ${T.accentBorder} !important; }
        .role-pill:hover { opacity: 0.85; }
        .ghost-btn:hover { background: rgba(125,146,255,0.08) !important; }
      `}</style>

      {/* LEFT BRAND PANEL */}
      <div style={{
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
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text1, lineHeight: 1.1 }}>Altech</div>
            <div style={{ fontSize: 11, color: T.accent, lineHeight: 1 }}>Project</div>
          </div>
        </div>

        {/* Hero tagline — vertically centered */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 32 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 700, color: T.text1, lineHeight: 1.25,
            margin: '0 0 12px 0', maxWidth: 340,
          }}>
            Gestão de projetos para times que entregam.
          </h1>
          <p style={{ fontSize: 14, color: T.text3, margin: '0 0 40px 0', lineHeight: 1.6 }}>
            Kanban · Backlog · Sprints · Roadmap · Relatórios — tudo num só lugar.
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
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Sprint 14 · 72% concluído</div>
              <div style={{ background: T.border, borderRadius: 4, height: 6, width: '100%' }}>
                <div style={{ background: T.success, borderRadius: 4, height: 6, width: '72%' }} />
              </div>
              <div style={{ fontSize: 10, color: T.success, marginTop: 4, textAlign: 'right' }}>72%</div>
            </div>

            {/* Card 2 — middle: Board mini */}
            <div style={{
              position: 'absolute', bottom: 36, left: 36,
              background: T.bgSurface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 12, boxShadow: T.shadow2,
              width: 220,
            }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 8 }}>Board · Sprint 14</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {['#6a7390', T.accent, T.success].map((c, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: T.text3, marginBottom: 4 }}>
                      {['Backlog', 'Em Dev', 'Done'][i]}
                    </div>
                    {[0,1,2].slice(0, 3 - i).map(j => (
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
              <div style={{ fontSize: 12, color: T.crit, fontWeight: 600 }}>
                🔴 PM-142 bloqueado
              </div>
            </div>
          </div>
        </div>

        {/* Role badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {ROLES.map(r => (
            <span key={r} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
              background: BADGE_COLORS[r].bg, color: BADGE_COLORS[r].color,
              border: `1px solid ${BADGE_COLORS[r].color}40`,
            }}>{r}</span>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ fontSize: 11, color: T.text3 }}>
          © 2025 Altech Agency · Privacidade · Termos
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div style={{
        width: '58%', minHeight: '100vh',
        background: T.bgPage,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', padding: '32px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Small logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
            <LogoMark size={24} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text1 }}>Altech</span>
              <span style={{ fontSize: 11, color: T.accent, marginLeft: 4 }}>Project</span>
            </div>
          </div>

          {!isSuccess ? (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text1, margin: '0 0 4px 0' }}>
                  Bem-vindo de volta
                </h2>
                <p style={{ fontSize: 13, color: T.text3, margin: 0 }}>
                  Acesse sua conta de gestão.
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
                    onChange={e => { setEmail(e.target.value); if (isError) setLoginState('idle') }}
                    placeholder="voce@empresa.com"
                    style={inputStyle(isError)}
                    autoComplete="email"
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
                      onChange={e => { setPassword(e.target.value); if (isError) setLoginState('idle') }}
                      placeholder="••••••••"
                      style={{ ...inputStyle(isError), paddingRight: 40 }}
                      autoComplete="current-password"
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

                {/* Remember + forgot */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: T.text2 }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      style={{ accentColor: T.accent, width: 14, height: 14 }}
                    />
                    Manter conectado
                  </label>
                  <a
                    href="#"
                    style={{ fontSize: 12, color: T.accent, textDecoration: 'none' }}
                    onClick={e => { e.preventDefault(); setForgotEmail(email); setForgotSent(false); setForgotOpen(true) }}
                  >
                    Esqueci a senha
                  </a>
                </div>

                {/* Error bar */}
                {isError && (
                  <div style={{
                    background: T.critDim,
                    border: `1px solid ${T.crit}30`,
                    borderRadius: 8, padding: 10, fontSize: 12, color: T.crit,
                  }}>
                    ⚠ {errorMsg}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    width: '100%', height: 42,
                    background: canSubmit ? T.accent : T.bgSurface2,
                    color: canSubmit ? 'white' : T.text3,
                    border: 'none', borderRadius: 8,
                    fontSize: 14, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s',
                  }}
                >
                  {isLoading ? <><Spinner /> Entrando…</> : 'Entrar'}
                </button>

                {onCreateAccount && (
                  <p style={{ fontSize: 12, color: T.text3, textAlign: 'center', margin: '4px 0 0' }}>
                    Não tem conta?{' '}
                    <a
                      href="#"
                      style={{ color: T.accent, textDecoration: 'none' }}
                      onClick={e => { e.preventDefault(); onCreateAccount() }}
                    >
                      Criar conta
                    </a>
                  </p>
                )}
              </div>
            </form>
          ) : (
            /* SUCCESS STATE */
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <CheckCircle />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text1, margin: '0 0 8px 0' }}>
                Login realizado!
              </h2>
              <p style={{ fontSize: 13, color: T.text3, margin: '0 0 24px 0' }}>
                Qual é o seu papel hoje?
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
                {ROLES.map(r => {
                  const selected = selectedRole === r
                  const c = ROLE_COLORS[r]
                  return (
                    <button
                      key={r}
                      className="role-pill"
                      onClick={() => setSelectedRole(r)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        border: `1px solid ${selected ? c : T.border}`,
                        background: selected ? `${c}20` : T.bgSurface2,
                        color: selected ? c : T.text2,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => onSuccess(selectedRole)}
                style={{
                  width: '100%', height: 42,
                  background: T.accent, color: 'white',
                  border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Acessar dashboard
              </button>
            </div>
          )}
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
              <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text1, margin: '0 0 6px' }}>Esqueci a senha</h3>
              <p style={{ fontSize: 12.5, color: T.text3, margin: '0 0 16px' }}>
                Informe seu e-mail e enviaremos um link para redefinir a senha.
              </p>

              {forgotSent ? (
                <div style={{ background: T.successDim, border: `1px solid ${T.success}40`, borderRadius: 8, padding: 10, fontSize: 12, color: T.success, marginBottom: 16 }}>
                  Se o e-mail existir, enviaremos um link de redefinição.
                </div>
              ) : (
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="voce@empresa.com"
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
                  {forgotBusy ? 'Enviando…' : 'Enviar link'}
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

        {/* Atalho de desenvolvimento — Inspection Mode atrás da flag */}
        {INSPECTION_MODE_ENABLED && !isSuccess && (
          <div style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            textAlign: 'center', fontSize: 11, color: T.text3,
          }}>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setLoginState('success')}
              style={{
                background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8,
                padding: '6px 12px', fontSize: 11, color: T.text2, cursor: 'pointer',
              }}
            >
              Entrar em modo Inspection (dev)
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
