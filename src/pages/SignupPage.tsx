import { useState } from 'react'
import { T } from '../components/ds/tokens'
import { signUpTenant } from '../data/db/signup'

interface Props {
  /** Volta para o Login. Se `email` vier, o Login pré-preenche o campo. */
  onGoToLogin: (email?: string) => void
}

const MIN_PASSWORD = 12

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill={T.accentDim} stroke={T.accentBorder} />
      <path d="M16 6 L24 26 L19.5 26 L16 17 L12.5 26 L8 26 Z" fill={T.accent} />
      <path d="M10.5 20 L21.5 20" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}

/** Força simples: comprimento + variedade (0–3). */
function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= MIN_PASSWORD) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  const map = [
    { label: 'Muito curta', color: T.crit },
    { label: 'Fraca', color: T.warn },
    { label: 'Boa', color: T.accent },
    { label: 'Forte', color: T.success },
  ]
  return { score, ...map[score] }
}

export default function SignupPage({ onGoToLogin }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const strength = passwordStrength(password)
  const canSubmit =
    name.trim().length > 0 &&
    emailValid &&
    password.length >= MIN_PASSWORD &&
    orgName.trim().length > 0 &&
    !busy

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const res = await signUpTenant({ name, email, password, orgName })
    if (res.ok) return // SessionContext detecta o login e o app libera sozinho.
    setBusy(false)
    if (res.reason === 'email_exists') {
      onGoToLogin(email.trim().toLowerCase()) // já tem conta → Login com e-mail preenchido
      return
    }
    setError(res.message ?? 'Não foi possível criar a conta.')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: T.bgSurface2,
    border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px',
    color: T.text1, fontSize: 13, outline: 'none', transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, color: T.text3, textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 6,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: ${T.accentBorder} !important; }
      `}</style>

      {/* LEFT BRAND PANEL */}
      <div style={{
        width: '42%', minHeight: '100vh',
        background: 'var(--brand-panel, linear-gradient(145deg, #080b11 0%, #0e1016 50%, #111827 100%))',
        display: 'flex', flexDirection: 'column', padding: '32px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={32} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text1, lineHeight: 1.1 }}>Altech</div>
            <div style={{ fontSize: 11, color: T.accent, lineHeight: 1 }}>Project</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 32 }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: T.text1, lineHeight: 1.25, margin: '0 0 12px 0', maxWidth: 360 }}>
            Comece a organizar os projetos do seu time.
          </h1>
          <p style={{ fontSize: 14, color: T.text3, margin: '0 0 32px 0', lineHeight: 1.6 }}>
            Crie sua conta em segundos. Kanban, Sprints, Roadmap e Relatórios num só lugar.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Sem cartão de crédito para começar', 'Convide seu time por e-mail', 'Comece pelo tour guiado'].map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.text2 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: T.successDim, border: `1px solid ${T.success}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4.5" stroke={T.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ fontSize: 11, color: T.text3 }}>© 2025 Altech Agency · Privacidade · Termos</div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div style={{
        width: '58%', minHeight: '100vh', background: T.bgPage,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative', padding: '32px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
            <LogoMark size={24} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text1 }}>Altech</span>
              <span style={{ fontSize: 11, color: T.accent, marginLeft: 4 }}>Project</span>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            <span style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent }} />
            <span style={{ flex: 1, height: 3, borderRadius: 2, background: T.border }} />
            <span style={{ flex: 1, height: 3, borderRadius: 2, background: T.border }} />
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 11, color: T.text3, margin: '0 0 4px' }}>Passo 1 de 3</p>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text1, margin: '0 0 4px 0' }}>Criar sua conta</h2>
              <p style={{ fontSize: 13, color: T.text3, margin: 0 }}>Você será o Admin Master desta conta.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input value={name} onChange={e => { setName(e.target.value); if (error) setError(null) }} placeholder="Seu nome" style={inputStyle} autoComplete="name" />
              </div>

              <div>
                <label style={labelStyle}>E-mail</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); if (error) setError(null) }} placeholder="voce@empresa.com" style={inputStyle} autoComplete="email" />
              </div>

              <div>
                <label style={labelStyle}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (error) setError(null) }}
                    placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
                    style={{ ...inputStyle, paddingRight: 56 }}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.text3, fontSize: 11 }}>
                    {showPass ? 'ocultar' : 'mostrar'}
                  </button>
                </div>
                {password.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
                      <div style={{ width: `${((strength.score + 1) / 4) * 100}%`, height: '100%', background: strength.color, transition: 'width .2s' }} />
                    </div>
                    <span style={{ fontSize: 11, color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Nome da organização</label>
                <input value={orgName} onChange={e => { setOrgName(e.target.value); if (error) setError(null) }} placeholder="Ex.: Minha Agência" style={inputStyle} autoComplete="organization" />
              </div>

              {error && (
                <div style={{ background: T.critDim, border: `1px solid ${T.crit}30`, borderRadius: 8, padding: 10, fontSize: 12, color: T.crit }}>
                  ⚠ {error}
                </div>
              )}

              <button type="submit" disabled={!canSubmit}
                style={{
                  width: '100%', height: 42, marginTop: 2,
                  background: canSubmit ? T.accent : T.bgSurface2, color: canSubmit ? 'white' : T.text3,
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s',
                }}>
                {busy ? <><Spinner /> Criando conta…</> : 'Criar conta'}
              </button>

              <p style={{ fontSize: 12, color: T.text3, textAlign: 'center', margin: '4px 0 0' }}>
                Já tem conta?{' '}
                <a href="#" style={{ color: T.accent, textDecoration: 'none' }}
                  onClick={e => { e.preventDefault(); onGoToLogin() }}>
                  Entrar
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
