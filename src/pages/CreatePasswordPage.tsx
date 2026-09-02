import { useState } from 'react'
import { T } from '../components/ds/tokens'
import { supabase } from '../integrations/supabase/client'
import { useSession } from '../data/SessionContext'
import { consumeToken, markPasswordChanged } from '../data/db/activationTokens'

interface Props {
  /** token bruto vindo do link /activate (opcional). */
  rawToken?: string | null
  onDone: () => void
}

const RULES = [
  { key: 'len',   label: 'Mínimo de 12 caracteres', test: (v: string) => v.length >= 12 },
  { key: 'upper', label: 'Uma letra maiúscula',      test: (v: string) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'Uma letra minúscula',      test: (v: string) => /[a-z]/.test(v) },
  { key: 'digit', label: 'Um número',                test: (v: string) => /[0-9]/.test(v) },
  { key: 'spec',  label: 'Um caractere especial',    test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

function strengthOf(v: string): number {
  return RULES.filter(r => r.test(v)).length
}

/** Traduz as mensagens de erro do Supabase Auth (que vêm em inglês) para PT-BR. */
function translateAuthError(msg: string): string {
  const m = (msg || '').toLowerCase()
  if (m.includes('different from the old') || m.includes('should be different') || m.includes('same as')) {
    return 'A nova senha deve ser diferente da senha anterior. Escolha outra.'
  }
  if (m.includes('at least') || m.includes('too short') || m.includes('minimum')) {
    return 'A senha é muito curta. Use pelo menos 12 caracteres.'
  }
  if (m.includes('weak') || m.includes('pwned') || m.includes('easy to guess') || m.includes('compromised') || m.includes('leaked')) {
    return 'Essa senha é considerada fraca ou já vazada em outros sites. Escolha uma mais forte.'
  }
  if (m.includes('session') || m.includes('token')) {
    return 'Sua sessão expirou. Faça login novamente para trocar a senha.'
  }
  return 'Não foi possível atualizar a senha. Tente uma senha diferente.'
}

export default function CreatePasswordPage({ rawToken, onDone }: Props) {
  const { activeUser, clearMustChangePassword } = useSession()
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const score = strengthOf(pwd)
  const allRulesOk = score === RULES.length
  const matches = pwd.length > 0 && pwd === confirm
  const canSubmit = allRulesOk && matches && !busy

  const barColor = score <= 2 ? T.crit : score < RULES.length ? T.warn : T.success
  const barLabel = score <= 2 ? 'Fraca' : score < RULES.length ? 'Média' : 'Forte'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password: pwd })
      if (upErr) { setError(translateAuthError(upErr.message)); setBusy(false); return }

      await markPasswordChanged(activeUser.user_id)
      if (rawToken) await consumeToken(rawToken)
      clearMustChangePassword()
      onDone()
    } catch {
      setError('Não foi possível atualizar a senha agora.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text1, marginBottom: 6 }}>Criar nova senha</h1>
        <p style={{ fontSize: 13, color: T.text3, marginBottom: 20 }}>
          Por segurança, defina uma nova senha para continuar usando o Altech Project.
        </p>

        <label style={{ fontSize: 12, color: T.text2, display: 'block', marginBottom: 6 }}>Nova senha</label>
        <input
          type="password" value={pwd} autoComplete="new-password"
          onChange={e => setPwd(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: T.bgSurface2, border: `1px solid ${T.border2}`, color: T.text1, fontSize: 13, marginBottom: 12 }}
        />

        <div style={{ height: 6, borderRadius: 3, background: T.bgSurface2, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${(score / RULES.length) * 100}%`, height: '100%', background: barColor, transition: 'width .2s' }} />
        </div>
        <div style={{ fontSize: 11, color: barColor, marginBottom: 12 }}>Força: {barLabel}</div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
          {RULES.map(r => {
            const ok = r.test(pwd)
            return (
              <li key={r.key} style={{ fontSize: 11.5, color: ok ? T.success : T.text3, display: 'flex', gap: 6, marginBottom: 3 }}>
                <span>{ok ? '✓' : '•'}</span>{r.label}
              </li>
            )
          })}
        </ul>

        <label style={{ fontSize: 12, color: T.text2, display: 'block', marginBottom: 6 }}>Confirmar senha</label>
        <input
          type="password" value={confirm} autoComplete="new-password"
          onChange={e => setConfirm(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: T.bgSurface2, border: `1px solid ${confirm && !matches ? T.crit : T.border2}`, color: T.text1, fontSize: 13 }}
        />
        {confirm.length > 0 && !matches && (
          <div style={{ fontSize: 11.5, color: T.crit, marginTop: 6 }}>As senhas não conferem.</div>
        )}

        {error && (
          <div style={{ marginTop: 14, fontSize: 12, color: T.crit, background: T.critDim, border: `1px solid ${T.crit}44`, borderRadius: 8, padding: '8px 10px' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={!canSubmit} style={{
          width: '100%', marginTop: 18, padding: '11px 16px', borderRadius: 9, border: 'none',
          background: canSubmit ? T.accent : T.bgSurface2, color: canSubmit ? '#fff' : T.text3,
          fontSize: 13.5, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  )
}
