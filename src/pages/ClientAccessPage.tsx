import { useState, useEffect } from 'react'
import { T } from '../components/ds/tokens'
import { generateTempPassword } from '../data/security'
import { createClientAccess } from '../data/clientAccess'
import { MOCK_TENANT } from '../data/session'
import { useSession } from '../data/SessionContext'
import { useClientPortal } from '../data/clientPortalStore'
import { copyToClipboard } from '../utils/copyToClipboard'
import {
  listProjectResponsibleCandidates, setProjectResponsibles,
  type ResponsibleCandidate,
} from '../data/db/clientPortal'

interface Props {
  onBack: () => void
}

const PROJ_PALETTE = ['#7d92ff', '#35c9ae', '#a78bfa', '#e6b23c', '#f0805c']

export default function ClientAccessPage({ onBack }: Props) {
  const { activeUser } = useSession()
  const portal = useClientPortal()
  const PROJECTS = portal.projects.map((p, i) => ({
    id: p.id,
    name: p.name,
    code: p.name.slice(0, 2).toUpperCase(),
    quarter: p.period_end ? p.period_end.slice(0, 7) : '—',
    status: p.status,
    issues: 0,
    color: PROJ_PALETTE[i % PROJ_PALETTE.length],
  }))
  const [step, setStep] = useState(1)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [permission, setPermission] = useState<'viewer' | 'admin'>('viewer')
  const [clientCanApprove, setClientCanApprove] = useState(false)
  const [clientCanPreview, setClientCanPreview] = useState(false)
  const [candidatesByProject, setCandidatesByProject] = useState<Record<string, ResponsibleCandidate[]>>({})
  const [responsibles, setResponsibles] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [generatedPwd, setGeneratedPwd] = useState('')
  const [copied, setCopied] = useState(false)
  const [pwdCopied, setPwdCopied] = useState(false)
  const [copyErr, setCopyErr] = useState('')

  // Carrega os candidatos elegíveis (membros do projeto com permissão de mensagens).
  useEffect(() => {
    let alive = true
    ;(async () => {
      const entries = await Promise.all(
        selectedProjects.map(async id => [id, await listProjectResponsibleCandidates(id)] as const),
      )
      if (!alive) return
      const map: Record<string, ResponsibleCandidate[]> = {}
      for (const [id, list] of entries) map[id] = list
      setCandidatesByProject(map)
      const valid = new Set(entries.flatMap(([, list]) => list.map(c => c.id)))
      setResponsibles(prev => prev.filter(id => valid.has(id)))
    })()
    return () => { alive = false }
  }, [selectedProjects])

  useEffect(() => {
    if (done) {
      const hash = Math.random().toString(36).slice(2, 10)
      setGeneratedUrl(`https://portal.altech.io/client/${hash}`)
      setGeneratedPwd(generateTempPassword())
    }
  }, [done])

  function toggleProject(id: string) {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function handleSubmit() {
    createClientAccess({
      tenant_id:          MOCK_TENANT.tenant_id,
      client_name:        clientName.trim(),
      client_email:       clientEmail.trim(),
      permission,
      client_can_approve: clientCanApprove,
      client_can_preview: clientCanPreview,
      project_names:      PROJECTS.filter(p => selectedProjects.includes(p.id)).map(p => p.name),
      actor_name:         activeUser?.name,
    })
    for (const projectId of selectedProjects) {
      const eligible = (candidatesByProject[projectId] ?? []).map(c => c.id)
      void setProjectResponsibles(
        projectId,
        responsibles.filter(id => eligible.includes(id)),
        activeUser?.name,
      )
    }
    setDone(true)
  }

  function reset() {
    setStep(1)
    setClientName('')
    setClientEmail('')
    setSelectedProjects([])
    setResponsibles([])
    setCandidatesByProject({})
    setPermission('viewer')
    setClientCanApprove(false)
    setClientCanPreview(false)
    setDone(false)
    setGeneratedUrl('')
    setGeneratedPwd('')
    setCopied(false)
    setPwdCopied(false)
  }

  async function copyUrl() {
    const ok = await copyToClipboard(generatedUrl)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    else { setCopyErr('Não foi possível copiar a URL. Selecione e copie manualmente.'); setTimeout(() => setCopyErr(''), 4000) }
  }

  async function copyPwd() {
    const ok = await copyToClipboard(generatedPwd)
    if (ok) { setPwdCopied(true); setTimeout(() => setPwdCopied(false), 2000) }
    else { setCopyErr('Não foi possível copiar a senha. Selecione e copie manualmente.'); setTimeout(() => setCopyErr(''), 4000) }
  }

  const selectedProjectObjs = PROJECTS.filter(p => selectedProjects.includes(p.id))
  const permissionLabel = permission === 'viewer' ? 'Visualizador' : 'Administrador'

  // --- Stepper ---
  function Stepper() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
        {[1, 2, 3].map((s, i) => {
          const isActive = step === s && !done
          const isCompleted = done || step > s
          const isPending = !isActive && !isCompleted
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  background: isCompleted ? T.success : isActive ? T.accent : 'transparent',
                  border: isPending ? `2px solid ${T.border}` : 'none',
                  color: isCompleted || isActive ? '#fff' : T.text3,
                  flexShrink: 0,
                }}>
                  {isCompleted ? '✓' : s}
                </div>
                <span style={{ fontSize: 11, color: isActive ? T.text1 : T.text3, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {['Dados do cliente', 'Projetos', 'Permissão'][i]}
                </span>
              </div>
              {i < 2 && (
                <div style={{
                  flex: 1, height: 2, background: step > s || done ? T.success : T.border,
                  margin: '0 12px', marginBottom: 20,
                }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // --- Confirmation ---
  if (done) {
    return (
      <div style={{ background: T.bgPage, minHeight: '100vh', padding: '40px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Stepper />
          <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text1, marginBottom: 8 }}>Acesso criado com sucesso!</div>
            <div style={{ fontSize: 14, color: T.text2, marginBottom: 24 }}>
              Acesso criado para <strong style={{ color: T.text1 }}>{clientName}</strong> ({clientEmail})
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
              {selectedProjectObjs.map(p => (
                <span key={p.id} style={{ background: T.accentDim, border: `1px solid ${T.accentBorder}`, color: T.accent, borderRadius: 20, padding: '3px 12px', fontSize: 13 }}>
                  {p.name}
                </span>
              ))}
            </div>
            <div style={{ marginBottom: 28 }}>
              <span style={{
                background: permission === 'viewer' ? T.bgSurface2 : T.accentDim,
                border: `1px solid ${permission === 'viewer' ? T.border2 : T.accentBorder}`,
                color: permission === 'viewer' ? T.text2 : T.accent,
                borderRadius: 20, padding: '3px 14px', fontSize: 13,
              }}>
                {permissionLabel}
              </span>
            </div>

            {/* URL section */}
            <div style={{ background: T.bgSurface2, borderLeft: `4px solid ${T.accent}`, borderRadius: 10, padding: 20, marginBottom: 16, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>URL do portal do cliente</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: T.accent, userSelect: 'all', flex: 1, wordBreak: 'break-all' }}>
                  {generatedUrl}
                </span>
                <button onClick={copyUrl} style={{
                  background: copied ? T.successDim : T.accentDim,
                  border: `1px solid ${copied ? T.success : T.accentBorder}`,
                  color: copied ? T.success : T.accent,
                  borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {copied ? '✓ Copiado!' : '📋 Copiar URL'}
                </button>
              </div>
            </div>

            {/* Password section — shown once */}
            {generatedPwd && (
              <div style={{
                background: T.bgSurface2,
                borderTop:    `1px solid ${T.border}`,
                borderRight:  `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
                borderLeft:   `4px solid ${T.accent}`,
                borderRadius: 10, padding: 20, marginBottom: 16, textAlign: 'left',
              }}>
                <div style={{ fontSize: 11, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Senha temporária — exibida uma única vez
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 18, color: T.accent, letterSpacing: '0.12em', userSelect: 'all', flex: 1 }}>
                    {generatedPwd}
                  </span>
                  <button onClick={copyPwd} style={{
                    background: pwdCopied ? T.successDim : T.accentDim,
                    border: `1px solid ${pwdCopied ? T.success : T.accentBorder}`,
                    color: pwdCopied ? T.success : T.accent,
                    borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {pwdCopied ? '✓ Copiado!' : '📋 Copiar senha'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: T.warn, marginTop: 12, lineHeight: 1.5 }}>
                  ⚠ Copie agora. O cliente deverá alterar no primeiro acesso. Após sair desta tela, a senha não será reexibida.
                  <span style={{ color: T.text3, display: 'block', marginTop: 4 }}>Inspection Mode — senha demonstrativa, sem hash real.</span>
                </div>
                {copyErr && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 7, background: `${T.crit}14`, border: `1px solid ${T.crit}50`, fontSize: 11, color: T.crit }}>
                    ✗ {copyErr}
                  </div>
                )}
              </div>
            )}

            {/* Notice box */}
            <div style={{ background: T.warnDim, border: `1px solid ${T.warn}`, borderRadius: 10, padding: 16, marginBottom: 28, textAlign: 'left', fontSize: 13, color: T.text2, lineHeight: 1.6 }}>
              📨 <strong style={{ color: T.warn }}>Credenciais enviadas automaticamente:</strong> login e senha temporária foram enviados para <strong style={{ color: T.text1 }}>{clientEmail}</strong>. O cliente deve alterar a senha no primeiro acesso. O e-mail é enviado pelo sistema do tenant Altech Agency.
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={reset} style={{
                background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2,
                borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
              }}>
                Criar outro acesso
              </button>
              <button onClick={onBack} style={{
                background: T.accent, border: 'none', color: '#fff',
                borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Step 1 ---
  const inputStyle: React.CSSProperties = {
    width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8,
    padding: '10px 12px', color: T.text1, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { fontSize: 13, color: T.text2, marginBottom: 6, display: 'block', fontWeight: 500 }
  const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: T.text1, marginBottom: 24 }

  return (
    <div style={{ background: T.bgPage, minHeight: '100vh', padding: '40px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Stepper />

        <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 36 }}>
          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <div style={sectionTitle}>Informações do cliente</div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Nome completo *</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>E-mail *</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="cliente@empresa.com"
                />
              </div>
              <div style={{ fontSize: 12, color: T.text3, marginBottom: 32, lineHeight: 1.6 }}>
                Um e-mail com login e senha temporária será enviado ao cliente automaticamente pelo sistema.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  disabled={!clientName.trim() || !clientEmail.trim()}
                  onClick={() => setStep(2)}
                  style={{
                    background: (!clientName.trim() || !clientEmail.trim()) ? T.border2 : T.accent,
                    border: 'none', color: '#fff', borderRadius: 8, padding: '10px 24px',
                    fontSize: 14, fontWeight: 600, cursor: (!clientName.trim() || !clientEmail.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (!clientName.trim() || !clientEmail.trim()) ? 0.5 : 1,
                  }}>
                  Próximo →
                </button>
                <button style={{ background: 'none', border: 'none', color: T.text3, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <div style={sectionTitle}>Selecione os projetos que este cliente poderá visualizar</div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ background: T.accentDim, border: `1px solid ${T.accentBorder}`, color: T.accent, borderRadius: 20, padding: '3px 12px', fontSize: 12 }}>
                  {selectedProjects.length} projeto(s) selecionado(s)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {PROJECTS.map(p => {
                  const selected = selectedProjects.includes(p.id)
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProject(p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                        background: selected ? T.accentDim : T.bgSurface2,
                        border: `1px solid ${selected ? T.accentBorder : T.border}`,
                        borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 5, border: `2px solid ${selected ? T.accent : T.border2}`,
                        background: selected ? T.accent : 'transparent', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff',
                      }}>
                        {selected && '✓'}
                      </div>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
                          {p.code} · {p.quarter} · {p.status} · {p.issues} issues abertas
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(1)} style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
                  ← Voltar
                </button>
                <button
                  disabled={selectedProjects.length === 0}
                  onClick={() => setStep(3)}
                  style={{
                    background: selectedProjects.length === 0 ? T.border2 : T.accent,
                    border: 'none', color: '#fff', borderRadius: 8, padding: '10px 24px',
                    fontSize: 14, fontWeight: 600, cursor: selectedProjects.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedProjects.length === 0 ? 0.5 : 1,
                  }}>
                  Próximo →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <div style={sectionTitle}>Nível de acesso</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {([
                  {
                    value: 'viewer' as const,
                    icon: '👁',
                    title: 'Visualizador',
                    desc: 'Pode ver o progresso dos projetos, status das issues, roadmap e relatórios. Não pode comentar ou interagir.',
                  },
                  {
                    value: 'admin' as const,
                    icon: '✏️',
                    title: 'Administrador do portal',
                    desc: 'Além de visualizar, pode deixar comentários, solicitar mudanças de prioridade e validar entregas.',
                  },
                ]).map(card => {
                  const selected = permission === card.value
                  return (
                    <div
                      key={card.value}
                      onClick={() => setPermission(card.value)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px',
                        background: selected ? T.accentDim : T.bgSurface2,
                        borderTop: `1px solid ${selected ? T.accentBorder : T.border}`,
                        borderRight: `1px solid ${selected ? T.accentBorder : T.border}`,
                        borderBottom: `1px solid ${selected ? T.accentBorder : T.border}`,
                        borderLeft: `4px solid ${selected ? T.accent : T.text3}`,
                        borderRadius: 10, cursor: 'pointer',
                      }}>
                      <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{card.icon}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text1, marginBottom: 4 }}>{card.title}</div>
                        <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>{card.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: T.text3, marginRight: 8 }}>Papel atribuído:</span>
                <span style={{
                  background: permission === 'admin' ? T.accentDim : T.bgSurface2,
                  border: `1px solid ${permission === 'admin' ? T.accentBorder : T.border2}`,
                  color: permission === 'admin' ? T.accent : T.text2,
                  borderRadius: 20, padding: '3px 14px', fontSize: 13,
                }}>
                  {permissionLabel}
                </span>
              </div>

              {/* ── Responsáveis pelas mensagens do cliente ── */}
              <div style={{
                background: T.bgSurface2, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: '20px 20px 16px', marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Responsáveis pelas mensagens
                </div>
                <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5, marginBottom: 14 }}>
                  Membros habilitados nos projetos selecionados que tratarão as mensagens deste cliente.
                </div>
                {selectedProjectObjs.map(p => {
                  const cands = candidatesByProject[p.id] ?? []
                  return (
                    <div key={p.id} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text1, marginBottom: 8 }}>{p.name}</div>
                      {cands.length === 0 ? (
                        <div style={{ fontSize: 11, color: T.text3 }}>
                          Nenhum membro habilitado para mensagens do cliente neste projeto.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {cands.map(c => {
                            const on = responsibles.includes(c.id)
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setResponsibles(prev =>
                                  prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id],
                                )}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  background: on ? T.accentDim : T.bgSurface,
                                  border: `1px solid ${on ? T.accentBorder : T.border}`,
                                  color: on ? T.accent : T.text2,
                                  borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                                }}
                              >
                                <span style={{
                                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                  border: `1.5px solid ${on ? T.accent : T.border2}`,
                                  background: on ? T.accent : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, color: '#fff',
                                }}>{on && '✓'}</span>
                                {c.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>


              {/* ── Capacidades granulares do portal ── */}
              <div style={{
                background: T.bgSurface2, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: '20px 20px 16px', marginBottom: 28,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                  Capacidades no portal do cliente
                </div>

                {/* Toggle: Aprovar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text1, marginBottom: 2 }}>Permitir aprovar entregas</div>
                    <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
                      O cliente poderá registrar aprovação nos itens "Aguardando sua validação". Recomendado apenas para times experientes.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClientCanApprove(v => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none',
                      background: clientCanApprove ? T.success : T.border2,
                      cursor: 'pointer', position: 'relative', flexShrink: 0,
                      transition: 'background 0.2s',
                    }}
                    aria-label="Alternar permissão de aprovação"
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: clientCanApprove ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', display: 'block',
                    }} />
                  </button>
                </div>

                {/* Toggle: Preview */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text1, marginBottom: 2 }}>Permitir ver preview</div>
                    <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
                      O cliente poderá visualizar pré-visualizações das entregas antes da validação final.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClientCanPreview(v => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none',
                      background: clientCanPreview ? T.success : T.border2,
                      cursor: 'pointer', position: 'relative', flexShrink: 0,
                      transition: 'background 0.2s',
                    }}
                    aria-label="Alternar permissão de preview"
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: clientCanPreview ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', display: 'block',
                    }} />
                  </button>
                </div>

                {/* Native capability: Comment */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12,
                  borderTop: `1px solid ${T.border}`,
                }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: T.success, flexShrink: 0 }}>
                    <path d="M2 3.5h10M2 6.5h7M2 9.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.success }}>Comentar: sempre habilitado</span>
                    <span style={{ fontSize: 11, color: T.text3, marginLeft: 8 }}>
                      Capacidade nativa — o cliente pode comentar em qualquer entrega. Não é possível desabilitar.
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(2)} style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
                  ← Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  style={{
                    background: T.success, border: 'none', color: '#fff',
                    borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>
                  Criar acesso e enviar convite
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
