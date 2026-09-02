import { useState } from 'react'
import { T } from './ds/tokens'
import { useSession } from '@/data/SessionContext'
import { assignOperationalRole } from '@/data/db/invite'
import { SIGNUP_ONBOARDING_KEY } from '@/data/db/signup'
import type { RoleContext } from '@/data/session'

interface Props {
  /** Concluiu o onboarding (fica no app). */
  onDone: () => void
  /** Ir para Time & Permissões para convidar o time. */
  onGoToTeam: () => void
}

const OPERATIONAL_ROLES: { role: RoleContext; label: string; desc: string }[] = [
  { role: 'Dev', label: 'Dev', desc: 'Implementação e fila de tarefas' },
  { role: 'ProductOwner', label: 'Product Owner', desc: 'Backlog, prioridação e prontidão' },
  { role: 'ProjectManager', label: 'Project Manager', desc: 'Status, bloqueios e prazos' },
  { role: 'PMO', label: 'PMO', desc: 'Saúde e previsibilidade do portfólio' },
  { role: 'ScrumMaster', label: 'Scrum Master', desc: 'Fluxo da sprint e cerimônias' },
  { role: 'TechLead', label: 'Tech Lead', desc: 'Saúde técnica, PRs e dívida' },
  { role: 'ProductManager', label: 'Product Manager', desc: 'Valor, adoção e saúde do produto' },
  { role: 'QA', label: 'QA', desc: 'Fila de testes e qualidade' },
  { role: 'UX', label: 'UX / UI', desc: 'Design, validação e handoffs' },
]

function clearFlag() {
  try { localStorage.removeItem(SIGNUP_ONBOARDING_KEY) } catch { /* storage indisponível */ }
}

export function SignupOnboarding({ onDone, onGoToTeam }: Props) {
  const { activeUser } = useSession()
  const [step, setStep] = useState<2 | 3>(2)
  const [role, setRole] = useState<RoleContext | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveRole() {
    if (!role || busy) return
    setBusy(true)
    setError(null)
    const ok = await assignOperationalRole(activeUser.user_id, role)
    setBusy(false)
    if (!ok) { setError('Não foi possível salvar o papel agora. Você pode ajustar depois em Time & Permissões.') ; return }
    setStep(3)
  }

  function finish() { clearFlag(); onDone() }
  function goTeam() { clearFlag(); onGoToTeam() }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  }
  const card: React.CSSProperties = {
    width: '100%', maxWidth: 520, background: T.bgSurface,
    border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.shadowModal,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, padding: '16px 24px 0' }}>
          <span style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent }} />
          <span style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent }} />
          <span style={{ flex: 1, height: 3, borderRadius: 2, background: step === 3 ? T.accent : T.border }} />
        </div>

        {step === 2 ? (
          <div style={{ padding: '16px 24px 24px' }}>
            <p style={{ fontSize: 11, color: T.text3, margin: '0 0 4px' }}>Passo 2 de 3</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text1, margin: '0 0 4px' }}>Seu perfil de trabalho</h2>
            <p style={{ fontSize: 13, color: T.text2, margin: '0 0 16px' }}>
              Você é o <strong style={{ color: T.accent }}>Admin Master</strong> desta conta. Escolha também o papel que vai usar no dia a dia — dá para alternar entre os dois depois.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {OPERATIONAL_ROLES.map(r => {
                const selected = role === r.role
                return (
                  <button
                    key={r.role}
                    onClick={() => setRole(r.role)}
                    title={r.desc}
                    style={{
                      padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                      background: selected ? T.accentDim : T.bgSurface2,
                      color: selected ? T.accent : T.text2,
                      border: `1px solid ${selected ? T.accentBorder : T.border}`,
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>

            {error && (
              <div style={{ background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: 10, fontSize: 12, color: T.warn, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={saveRole}
                disabled={!role || busy}
                style={{
                  height: 40, padding: '0 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
                  background: role && !busy ? T.accent : T.bgSurface2, color: role && !busy ? '#fff' : T.text3,
                  cursor: role && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? 'Salvando…' : 'Continuar'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px 24px 24px' }}>
            <p style={{ fontSize: 11, color: T.text3, margin: '0 0 4px' }}>Passo 3 de 3</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text1, margin: '0 0 4px' }}>Convide seu time</h2>
            <p style={{ fontSize: 13, color: T.text2, margin: '0 0 20px' }}>
              Adicione as pessoas do time em Time &amp; Permissões — cada uma recebe um convite por e-mail e define a própria senha no primeiro acesso. Você pode fazer isso agora ou depois.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <button
                onClick={finish}
                style={{
                  height: 40, padding: '0 18px', borderRadius: 8, fontSize: 13,
                  background: 'transparent', color: T.text2, border: `1px solid ${T.border}`, cursor: 'pointer',
                }}
              >
                Fazer isso depois
              </button>
              <button
                onClick={goTeam}
                style={{
                  height: 40, padding: '0 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
                  background: T.accent, color: '#fff', cursor: 'pointer',
                }}
              >
                Convidar time
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SignupOnboarding
