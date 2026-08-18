import { useEffect, useState } from 'react'
import { T } from './ds/tokens'
import { roleSupportsReportsAccess } from '../data/db/reportsGovernance'
import { type MockUser, type RoleContext, type DashboardType, DASHBOARD_CATALOG } from '../data/session'
import {
  fetchInviteOptions, createMember, checkMemberIdentity, ROLE_BY_DASHBOARD,
  type OptionRow, type ModuleOption,
} from '../data/db/invite'
import { DEFAULT_TENANT_ID } from '../data/db/timeline'
import {
  derivePermissions, getCompatibleDashboards, DEFAULT_DASHBOARD,
  capabilityVisibility, STEP4_CAPABILITIES, type Capability,
} from '../data/permissions'
import { generateTempPassword } from '../data/security'
import { copyToClipboard } from '../utils/copyToClipboard'


// ─── Helpers ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#6366F1','#A78BFA','#34d399','#f5a524','#e879f9','#60a5fa']

const INVITABLE_ROLES: { role: RoleContext; label: string; desc: string }[] = [
  { role: 'PMO',            label: 'PMO',              desc: 'Saúde e previsibilidade do portfólio' },
  { role: 'ProjectManager', label: 'Project Manager',  desc: 'Status, bloqueios e próximas ações do projeto' },
  { role: 'ProductManager', label: 'Product Manager',  desc: 'Valor gerado, adoção e saúde do produto' },
  { role: 'ProductOwner',   label: 'Product Owner',    desc: 'Qualidade, priorização e prontidão do backlog' },
  { role: 'ScrumMaster',   label: 'Scrum Master',     desc: 'Fluxo da sprint, impedimentos, cerimônias' },
  { role: 'TechLead',       label: 'Tech Lead',        desc: 'Saúde técnica, PRs, deploys e dívida técnica' },
  { role: 'Dev',            label: 'Dev',              desc: 'Fila ativa, PRs e ações pendentes' },
  { role: 'QA',             label: 'QA',               desc: 'Fila de testes, bugs críticos e cobertura' },
  { role: 'UX',             label: 'UX / UI',          desc: 'Design ativo, validações e handoffs' },
]

const MODULE_LABELS: Record<string, string> = {
  board: 'Board & Sprint', reports: 'Relatórios', roadmap: 'Roadmap',
  portfolio: 'Portfólio / PMO', analytics: 'Analytics', releases: 'Releases',
  integrations: 'Integrações', deployments: 'Deployments', config: 'Configurações', team: 'Gestão de Time',
}


function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6, height: 6,
          borderRadius: 99,
          background: i < current ? T.success : i === current ? T.accent : T.border2,
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  )
}

// ─── Small section label ──────────────────────────────────────────────────────
function SLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, color: T.text2 }}>
        {label}{required && <span style={{ color: T.crit, marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: T.bgPage, border: `1px solid ${T.border2}`, borderRadius: 7,
  padding: '8px 11px', fontSize: 12, color: T.text1, outline: 'none', width: '100%',
}

// ─── Main modal ───────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void
  onSuccess?: (user: MockUser) => void
}

const TOTAL_STEPS = 7

export default function InviteMemberModal({ onClose, onSuccess }: Props) {
  // Step state
  const [step, setStep] = useState(0)

  // Step 1 — basic data
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [lang, setLang]           = useState('pt-BR')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])

  // Step 2 — role
  const [role, setRole] = useState<RoleContext | null>(null)

  // Step 3 — dashboards
  const [defaultDash, setDefaultDash] = useState<DashboardType | null>(null)
  const [extraDashes, setExtraDashes] = useState<DashboardType[]>([])

  // Step 4 — conditional opt-ins
  const [reportsAccess, setReportsAccess] = useState(false)
  const [optIns, setOptIns] = useState<Set<Capability>>(new Set())
  const [approvedSquads, setApprovedSquads] = useState<string[]>([])

  // Step 5 — links (opções reais do tenant)
  const [projectOpts, setProjectOpts] = useState<OptionRow[]>([])
  const [squadOpts, setSquadOpts]     = useState<OptionRow[]>([])
  const [moduleOpts, setModuleOpts]   = useState<ModuleOption[]>([])
  const [optsLoading, setOptsLoading] = useState(true)
  const [projects, setProjects] = useState<string[]>([])
  const [squads,   setSquads]   = useState<string[]>([])
  const [modules,  setModules]  = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [homonym, setHomonym] = useState<{ name: string; email: string } | null>(null)

  useEffect(() => {
    let alive = true
    void fetchInviteOptions().then(opts => {
      if (!alive) return
      setProjectOpts(opts.projects)
      setSquadOpts(opts.squads)
      setModuleOpts(opts.modules)
      setModules(opts.modules.map(m => m.key))
      setOptsLoading(false)
    })
    return () => { alive = false }
  }, [])


  // Step 6 — status
  const [status, setStatus] = useState<'active' | 'invited'>('invited')

  // Step 6 (confirmation) — generated password shown once
  const [generatedPwd, setGeneratedPwd] = useState('')
  const [pwdCopied, setPwdCopied] = useState(false)
  const [pwdCopyErr, setPwdCopyErr] = useState('')

  // ── Auto-configure on role select ──────────────────────────────────────────
  function selectRole(r: RoleContext) {
    setRole(r)
    if (!roleSupportsReportsAccess(r)) setReportsAccess(false)
    setDefaultDash(DEFAULT_DASHBOARD[r])
    setExtraDashes([])
    setOptIns(new Set())
    // Módulos habilitados vêm do tenant (tenant_modules) — todos marcados por padrão.
    setModules(moduleOpts.map(m => m.key))
  }

  // ── Toggle extra dashboard ─────────────────────────────────────────────────
  function toggleExtra(id: DashboardType) {
    setExtraDashes(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  function toggleOptIn(cap: Capability) {
    setOptIns(prev => {
      const next = new Set(prev)
      next.has(cap) ? next.delete(cap) : next.add(cap)
      return next
    })
  }

  function toggleMulti<T>(val: T, arr: T[], set: (a: T[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  // ── Validation per step ────────────────────────────────────────────────────
  function canAdvance(): boolean {
    switch (step) {
      case 0: return fullName.trim().length > 1 && /\S+@\S+\.\S+/.test(email)
      case 1: return role !== null
      case 2: return defaultDash !== null
      case 3: return true
      case 4: return projects.length > 0
      case 5: return true
      default: return true
    }
  }

  // ── Submit (step 5 → step 6) — persiste no banco real ──────────────────────
  async function handleSubmit(skipHomonymCheck = false) {
    if (!role || !defaultDash || saving) return
    setSaving(true)
    setSaveErr('')
    setHomonym(null)

    // Identidade: e-mail duplicado bloqueia; nome repetido apenas avisa.
    const check = await checkMemberIdentity(fullName, email)
    if (check.emailTaken) {
      setSaving(false)
      setSaveErr('Já existe um usuário com este e-mail neste tenant.')
      return
    }
    if (!skipHomonymCheck && check.sameName) {
      setSaving(false)
      setHomonym(check.sameName)
      return
    }


    const allDashes: DashboardType[] = [defaultDash, ...extraDashes.filter(d => d !== defaultDash)]
    const homeRoles: RoleContext[] = [
      role,
      ...allDashes.map(d => ROLE_BY_DASHBOARD[d]).filter((r): r is RoleContext => !!r),
    ].filter((r, i, arr) => arr.indexOf(r) === i)

    const profileId = await createMember({
      name: fullName.trim(),
      email: email.trim(),
      phone,
      locale: lang,
      avatarColor,
      avatarInitials: initials(fullName),
      role,
      homeRoles,
      dashboards: allDashes,
      defaultDashboard: defaultDash,
      projectIds: projects,
      squadIds: squads,
      modules,
      status,
      reportsAccess: roleSupportsReportsAccess(role) ? reportsAccess : false,
      canCreateProjects:
        capabilityVisibility(role, 'project:create') === 'on'
        || optIns.has('project:create' as Capability),
      canHandleClientMessages:
        capabilityVisibility(role, 'access:client-messages') === 'on'
        || optIns.has('access:client-messages' as Capability),

    })

    setSaving(false)
    if (!profileId) {
      setSaveErr('Não foi possível criar o membro. Verifique os dados e tente novamente.')
      return
    }

    const hasApproveHours = capabilityVisibility(role, 'approve:hours') === 'on' || optIns.has('approve:hours' as Capability)
    const user: MockUser = {
      user_id: profileId,
      tenant_id: DEFAULT_TENANT_ID,
      name: fullName.trim(),
      email: email.trim().toLowerCase(),
      avatar_initials: initials(fullName),
      avatar_color: avatarColor,
      role_context: role,
      project_id: projects[0] ?? '*',
      squad_id: squads[0] ?? '*',
      modules_enabled: modules,
      permissions: derivePermissions(role, [...optIns]),
      assigned_dashboards: [],
      password_must_change: true,
      available_roles: homeRoles,
      approved_squads: hasApproveHours ? approvedSquads : undefined,
    }

    setGeneratedPwd(generateTempPassword())
    setStep(6)
    onSuccess?.(user)
  }


  function handleFinish() {
    setGeneratedPwd('')
    onClose()
  }

  async function copyPwd() {
    const ok = await copyToClipboard(generatedPwd)
    if (ok) { setPwdCopied(true); setTimeout(() => setPwdCopied(false), 2000) }
    else { setPwdCopyErr('Não foi possível copiar. Selecione e copie manualmente.'); setTimeout(() => setPwdCopyErr(''), 4000) }
  }

  const compatibleDashes = role ? getCompatibleDashboards(role) : []

  // ── Step content ───────────────────────────────────────────────────────────
  const stepTitles = [
    'Dados básicos',
    'Função operacional',
    'Dashboards',
    'Permissões condicionais',
    'Vínculos',
    'Status inicial',
    'Senha temporária',
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(9,9,11,0.80)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: T.bgSurface, border: `1px solid ${T.border}`,
        borderRadius: 14, boxShadow: T.shadowModal,
        width: 560, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>Convidar Membro</div>
            <div style={{ fontSize: 11, color: T.text3, marginTop: 3 }}>
              Passo {step + 1} de {TOTAL_STEPS} — {stepTitles[step]}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StepDots total={TOTAL_STEPS} current={step} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', flex: 1, overflowY: 'auto' }}>

          {/* ── Step 0: Dados básicos ─────────────────────────────── */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Avatar preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 99,
                  background: avatarColor, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff',
                  flexShrink: 0,
                }}>
                  {fullName ? initials(fullName) : '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <SLabel>Cor do avatar</SLabel>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {AVATAR_COLORS.map(c => (
                      <button key={c} onClick={() => setAvatarColor(c)} style={{
                        width: 22, height: 22, borderRadius: 99, background: c, border: 'none', cursor: 'pointer',
                        outline: avatarColor === c ? `2px solid white` : '2px solid transparent', outlineOffset: 2,
                      }} />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Nome completo" required>
                  <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex.: Ana Lima" />
                </Field>
                <Field label="E-mail" required>
                  <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@empresa.com" />
                </Field>
                <Field label="Telefone (opcional)">
                  <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+55 11 99999-9999" />
                </Field>
                <Field label="Idioma">
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={lang} onChange={e => setLang(e.target.value)}>
                    <option value="pt-BR">Português (BR)</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 1: Função operacional ────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: T.text2, marginBottom: 8 }}>
                Selecione a função operacional do usuário.
              </div>
              {INVITABLE_ROLES.map(({ role: r, label, desc }) => (
                <button key={r} onClick={() => selectRole(r)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
                  padding: '11px 14px', borderRadius: 9,
                  background: role === r ? `${T.accent}14` : T.bgPage,
                  borderTop:    `1px solid ${role === r ? T.accent : T.border}`,
                  borderRight:  `1px solid ${role === r ? T.accent : T.border}`,
                  borderBottom: `1px solid ${role === r ? T.accent : T.border}`,
                  borderLeft:   `3px solid ${role === r ? T.accent : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: 99, marginTop: 1,
                    background: role === r ? T.accent : T.border2, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {role === r && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>{label}</div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Dashboards ────────────────────────────────── */}
          {step === 2 && role && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <SLabel>Dashboard padrão (obrigatório)</SLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {compatibleDashes.map(id => {
                    const def = DASHBOARD_CATALOG[id]
                    const isDefault = id === DEFAULT_DASHBOARD[role]
                    return (
                      <button key={id} onClick={() => setDefaultDash(id)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                        padding: '9px 12px', borderRadius: 8,
                        background: defaultDash === id ? `${T.accent}14` : T.bgPage,
                        border: `1px solid ${defaultDash === id ? T.accent : T.border}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          background: defaultDash === id ? T.accent : T.border2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {defaultDash === id && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, color: T.text1 }}>{def?.label ?? id}</span>
                          {isDefault && (
                            <span style={{ fontSize: 9, color: T.accent, background: `${T.accent}18`, borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>Sugerido</span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: T.text3 }}>{def?.description?.slice(0,40)}…</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <SLabel>Dashboards adicionais (multi-select)</SLabel>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 8 }}>
                  Compatíveis com o tier do papel. Ex.: Dev com adicional PM para ver saúde do projeto.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {compatibleDashes.filter(id => id !== defaultDash).map(id => {
                    const def = DASHBOARD_CATALOG[id]
                    const on = extraDashes.includes(id)
                    return (
                      <button key={id} onClick={() => toggleExtra(id)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                        padding: '8px 12px', borderRadius: 7,
                        background: on ? `${T.indigo}10` : T.bgPage,
                        border: `1px solid ${on ? T.indigo : T.border}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        <div style={{
                          width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                          background: on ? T.indigo : T.border2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {on && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 12, color: T.text1 }}>{def?.label ?? id}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Permissões condicionais ──────────────────── */}
          {step === 3 && role && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12, color: T.text2 }}>
                Opt-ins começam desligados (menor privilégio). Capacidades travadas em ✅ são concedidas automaticamente pelo papel.
              </div>

              {roleSupportsReportsAccess(role) && (
                <div style={{
                  padding: '13px 15px', borderRadius: 9,
                  background: reportsAccess ? `${T.accent}0A` : T.bgPage,
                  border: `1px solid ${reportsAccess ? T.accent : T.border}`,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <button
                    onClick={() => setReportsAccess(v => !v)}
                    style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      background: reportsAccess ? T.accent : T.border2,
                      border: `1.5px solid ${reportsAccess ? T.accent : T.border2}`,
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', marginTop: 1,
                    }}
                  >
                    {reportsAccess && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                  </button>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>
                      Acesso a Relatórios e Insights
                    </span>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 3 }}>
                      Libera a tela "Relatórios e Insights" no menu deste usuário.
                    </div>
                  </div>
                </div>
              )}

              {STEP4_CAPABILITIES.map(({ cap, label, desc }) => {
                const vis = capabilityVisibility(role, cap)
                if (vis === 'hidden') return null

                const isLocked = vis === 'on'
                const isChecked = isLocked || optIns.has(cap)

                return (
                  <div key={cap} style={{
                    padding: '13px 15px', borderRadius: 9,
                    background: isChecked ? `${T.accent}0A` : T.bgPage,
                    border: `1px solid ${isChecked ? T.accent : T.border}`,
                    opacity: isLocked ? 0.8 : 1,
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
                    <button
                      onClick={() => !isLocked && toggleOptIn(cap)}
                      style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        background: isChecked ? T.accent : T.border2,
                        border: `1.5px solid ${isChecked ? T.accent : T.border2}`,
                        cursor: isLocked ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', marginTop: 1,
                      }}
                    >
                      {isChecked && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                    </button>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>{label}</span>
                        {isLocked && (
                          <span style={{ fontSize: 9, color: T.success, background: `${T.success}18`, border: `1px solid ${T.success}33`, borderRadius: 4, padding: '1px 5px' }}>
                            Papel garante ✅
                          </span>
                        )}
                        {!isLocked && (
                          <span style={{ fontSize: 9, color: T.warn, background: `${T.warn}18`, border: `1px solid ${T.warn}33`, borderRadius: 4, padding: '1px 5px' }}>
                            Opt-in
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.text3, marginTop: 3 }}>{desc}</div>
                    </div>
                  </div>
                )
              })}

              {/* Lançar horas — informational */}
              {(() => {
                const vis = capabilityVisibility(role, 'log:hours')
                if (vis === 'hidden') return null
                return (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: `${T.success}08`, border: `1px solid ${T.success}22` }}>
                    <span style={{ fontSize: 11, color: T.success }}>
                      ✓ Lançar horas — habilitado para este papel
                    </span>
                  </div>
                )
              })()}

              {/* Squads que aprova — visible when approve:hours is on or opted-in */}
              {(() => {
                const vis = capabilityVisibility(role, 'approve:hours')
                const hasApprove = vis === 'on' || (vis !== 'hidden' && optIns.has('approve:hours' as Capability))
                if (!hasApprove) return null
                return (
                  <div style={{ padding: '14px 15px', borderRadius: 9, background: `${T.accent}06`, border: `1px solid ${T.accent}30` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text1, marginBottom: 4 }}>Squads que aprova</div>
                    <div style={{ fontSize: 11, color: T.text3, marginBottom: 10 }}>Selecione os squads cujos lançamentos este usuário poderá revisar. Pode ser alterado depois.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {squadOpts.map(s => {
                        const on = approvedSquads.includes(s.id)
                        return (
                          <button key={s.id} onClick={() => setApprovedSquads(prev => on ? prev.filter(x => x !== s.id) : [...prev, s.id])} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 7, cursor: 'pointer',
                            background: on ? `${T.accent}14` : T.bgPage,
                            border: `1px solid ${on ? T.accent : T.border}`,
                            transition: 'all 0.15s',
                          }}>
                            <div style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, background: on ? T.accent : T.border2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {on && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 12, color: T.text1 }}>{s.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {STEP4_CAPABILITIES.every(({ cap }) => capabilityVisibility(role, cap) === 'hidden') &&
               capabilityVisibility(role, 'log:hours') === 'hidden' &&
               capabilityVisibility(role, 'approve:hours') === 'hidden' && (
                <div style={{ padding: '16px', textAlign: 'center', color: T.text3, fontSize: 12 }}>
                  Nenhuma permissão condicional disponível para este papel.
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Vínculos ─────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <SLabel>Projetos</SLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
{!optsLoading && projectOpts.length === 0 && (
                    <div style={{ fontSize: 11, color: T.text3 }}>Nenhum projeto cadastrado no tenant.</div>
                  )}
                  {optsLoading && <div style={{ fontSize: 11, color: T.text3 }}>Carregando…</div>}
                  {projectOpts.map(p => {
                    const on = projects.includes(p.id)
                    return (
                      <button key={p.id} onClick={() => toggleMulti(p.id, projects, setProjects)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 7, textAlign: 'left',
                        background: on ? `${T.accent}12` : T.bgPage,
                        border: `1px solid ${on ? T.accent : T.border}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        <div style={{ width: 15, height: 15, borderRadius: 4, background: on ? T.accent : T.border2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {on && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 12, color: T.text1 }}>{p.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <SLabel>Squads</SLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
{!optsLoading && squadOpts.length === 0 && (
                    <div style={{ fontSize: 11, color: T.text3 }}>Nenhum squad cadastrado no tenant.</div>
                  )}
                  {optsLoading && <div style={{ fontSize: 11, color: T.text3 }}>Carregando…</div>}
                  {squadOpts.map(s => {
                    const on = squads.includes(s.id)
                    return (
                      <button key={s.id} onClick={() => toggleMulti(s.id, squads, setSquads)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 7, textAlign: 'left',
                        background: on ? `${T.accent}12` : T.bgPage,
                        border: `1px solid ${on ? T.accent : T.border}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        <div style={{ width: 15, height: 15, borderRadius: 4, background: on ? T.accent : T.border2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {on && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 12, color: T.text1 }}>{s.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <SLabel>Módulos habilitados</SLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
{!optsLoading && moduleOpts.length === 0 && (
                    <div style={{ fontSize: 11, color: T.text3 }}>Nenhum módulo habilitado cadastrado no tenant.</div>
                  )}
                  {optsLoading && <div style={{ fontSize: 11, color: T.text3 }}>Carregando…</div>}
                  {moduleOpts.map(({ key: m, name: mName }) => {
                    const on = modules.includes(m)
                    return (
                      <button key={m} onClick={() => toggleMulti(m, modules, setModules)} style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6,
                        background: on ? `${T.indigo}18` : T.bgPage,
                        border: `1px solid ${on ? T.indigo : T.border}`,
                        color: on ? T.indigo : T.text3, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        {MODULE_LABELS[m] ?? mName}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Status inicial ────────────────────────────── */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Summary card */}
              <div style={{ background: T.bgPage, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 99,
                    background: avatarColor, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {initials(fullName || 'NM')}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{fullName || '—'}</div>
                    <div style={{ fontSize: 11, color: T.text3 }}>{email}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { k: 'Papel', v: INVITABLE_ROLES.find(r => r.role === role)?.label ?? '—' },
                    { k: 'Dashboard padrão', v: defaultDash ? (DASHBOARD_CATALOG[defaultDash]?.label ?? defaultDash) : '—' },
                    { k: 'Adicionais', v: extraDashes.length > 0 ? `${extraDashes.length} dashboard(s)` : 'Nenhum' },
                    { k: 'Projetos', v: projectOpts.filter(p => projects.includes(p.id)).map(p => p.name).join(', ') || '—' },
                    { k: 'Permissões geradas', v: `${derivePermissions(role!, [...optIns]).length} cap.` },
                  ].map(row => (
                    <div key={row.k} style={{ fontSize: 11 }}>
                      <div style={{ color: T.text3 }}>{row.k}</div>
                      <div style={{ color: T.text1, fontWeight: 500 }}>{row.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <SLabel>Status inicial</SLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['active', 'invited'] as const).map(s => (
                    <button key={s} onClick={() => setStatus(s)} style={{
                      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                      background: status === s ? (s === 'active' ? `${T.success}14` : `${T.accent}14`) : T.bgPage,
                      border: `1px solid ${status === s ? (s === 'active' ? T.success : T.accent) : T.border}`,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: status === s ? (s === 'active' ? T.success : T.accent) : T.text2 }}>
                        {s === 'active' ? '✓ Ativo imediatamente' : '✉ Enviar convite'}
                      </div>
                      <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>
                        {s === 'active' ? 'Perfil criado, acesso liberado agora' : 'Recebe e-mail com link de ativação'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {saveErr && (
                <div style={{ padding: '8px 12px', borderRadius: 7, background: `${T.crit}14`, border: `1px solid ${T.crit}50`, fontSize: 11, color: T.crit }}>
                  ✗ {saveErr}
                </div>
              )}

              {homonym && (
                <div style={{ padding: '10px 12px', borderRadius: 7, background: `${T.warn}14`, border: `1px solid ${T.warn}50`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, color: T.text1 }}>
                    Já existe um usuário chamado <strong>{homonym.name}</strong> cadastrado (e-mail: {homonym.email}).
                    Deseja seguir com o cadastro ou modificar?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => void handleSubmit(true)} style={{
                      padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: T.accent, color: '#fff', fontSize: 11, fontWeight: 600,
                    }}>
                      Seguir mesmo assim
                    </button>
                    <button onClick={() => { setHomonym(null); setStep(0) }} style={{
                      padding: '6px 14px', borderRadius: 7, border: `1px solid ${T.border}`,
                      background: 'none', color: T.text2, fontSize: 11, cursor: 'pointer',
                    }}>
                      Modificar
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
          {/* ── Step 6: Senha temporária (exibida uma única vez) ─── */}
          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 99, background: avatarColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {initials(fullName || 'NM')}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{fullName}</div>
                  <div style={{ fontSize: 11, color: T.text3 }}>{email}</div>
                </div>
                <div style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '3px 10px',
                  borderRadius: 20, background: `${T.success}18`, border: `1px solid ${T.success}40`,
                  color: T.success,
                }}>
                  Membro criado ✓
                </div>
              </div>

              {/* Password block */}
              <div style={{
                background: T.bgPage,
                borderTop:    `1px solid ${T.border}`,
                borderRight:  `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
                borderLeft:   `4px solid ${T.accent}`,
                borderRadius: 10, padding: 20,
              }}>
                <div style={{ fontSize: 11, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Senha temporária gerada
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 18, color: T.accent,
                    letterSpacing: '0.12em', userSelect: 'all', flex: 1,
                  }}>
                    {generatedPwd}
                  </span>
                  <button onClick={copyPwd} style={{
                    background: pwdCopied ? `${T.success}18` : `${T.accent}18`,
                    border: `1px solid ${pwdCopied ? T.success : T.accentBorder}`,
                    color: pwdCopied ? T.success : T.accent,
                    borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', flexShrink: 0,
                  }}>
                    {pwdCopied ? '✓ Copiado!' : '📋 Copiar'}
                  </button>
                </div>
              </div>

              {pwdCopyErr && (
                <div style={{ padding: '8px 12px', borderRadius: 7, background: `${T.crit}14`, border: `1px solid ${T.crit}50`, fontSize: 11, color: T.crit }}>
                  ✗ {pwdCopyErr}
                </div>
              )}

              {/* Warning */}
              <div style={{
                background: `${T.warn}0D`, border: `1px solid ${T.warn}40`,
                borderRadius: 10, padding: '14px 16px', fontSize: 12, color: T.text2, lineHeight: 1.7,
              }}>
                <div style={{ fontWeight: 600, color: T.warn, marginBottom: 6 }}>⚠ Exibida uma única vez</div>
                <ul style={{ margin: 0, paddingLeft: 16, color: T.text2 }}>
                  <li>Copie e envie a senha por canal seguro para <strong style={{ color: T.text1 }}>{email}</strong>.</li>
                  <li>O membro deverá alterar a senha no primeiro acesso.</li>
                  <li>Após fechar este painel, a senha não será reexibida.</li>
                  <li style={{ color: T.text3, fontSize: 11, marginTop: 4 }}>Inspection Mode — senha demonstrativa, sem hash real.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          {step < 6 ? (
            <button onClick={() => step === 0 ? onClose() : setStep(s => s - 1)} style={{
              padding: '8px 18px', borderRadius: 7, border: `1px solid ${T.border}`,
              background: 'none', color: T.text2, fontSize: 12, cursor: 'pointer',
            }}>
              {step === 0 ? 'Cancelar' : '← Voltar'}
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step < 6 && (
              <span style={{ fontSize: 10, color: T.text3 }}>
                {step + 1}/{TOTAL_STEPS}
              </span>
            )}
            {step < 5 ? (
              <button
                onClick={() => canAdvance() && setStep(s => s + 1)}
                disabled={!canAdvance()}
                style={{
                  padding: '8px 22px', borderRadius: 7, border: 'none', cursor: canAdvance() ? 'pointer' : 'not-allowed',
                  background: canAdvance() ? T.accent : T.border2,
                  color: canAdvance() ? '#fff' : T.text3, fontSize: 12, fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                Próximo →
              </button>
            ) : step === 5 ? (
              <button onClick={() => void handleSubmit()} disabled={saving} style={{
                padding: '8px 22px', borderRadius: 7, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? T.border2 : status === 'active' ? T.success : T.accent,
                color: '#fff', fontSize: 12, fontWeight: 600,
              }}>
                {saving ? 'Salvando…' : status === 'active' ? '✓ Criar perfil' : '✉ Enviar convite'}
              </button>
            ) : (
              <button onClick={handleFinish} style={{
                padding: '8px 22px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: T.success, color: '#fff', fontSize: 12, fontWeight: 600,
              }}>
                ✓ Concluir e fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
