import React, { useState, useEffect } from 'react'
import { T } from '../components/ds/tokens'
import {
  MOCK_USERS, MOCK_TENANT, DASHBOARD_CATALOG,
  deactivateMockUser, blockMockUser,
  type MockUser, type RoleContext, type DashboardType, type UserDashboard,
} from '../data/session'
import {
  type Capability, PERMISSION_MATRIX, ROLE_TIER, derivePermissions,
  capabilityVisibility,
} from '../data/permissions'
import { getTenantOwnerEmails, getMembers } from '../data/db/members'
import {
  fetchProfileReportsAccess, saveProfileReportsAccess, roleSupportsReportsAccess,
} from '../data/db/reportsGovernance'
import { issueToken, setPasswordMustChange, auditPasswordResetRequested, activationLink } from '../data/db/activationTokens'
import { copyToClipboard } from '../utils/copyToClipboard'
import { useSession } from '../data/SessionContext'
import { can } from '../data/permissions'
import {
  getInvitesForTenant, cancelInvite, resendInvite,
  countPendingInvites, type Invite, type InviteStatus,
} from '../data/invites'

// ─── Types ────────────────────────────────────────────────────────────────────

type UserWithStatus = MockUser & { status?: 'active' | 'inactive' | 'blocked' }
type Tab = 'membros' | 'convites' | 'permissoes' | 'dashboards'

// ─── Audit log (session-persistent) ──────────────────────────────────────────

interface AuditEntry { ts: string; who: string; target: string; field: string; from: string; to: string }
const _AUDIT: AuditEntry[] = []

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_MODULES = ['board','reports','portfolio','roadmap','config','team','modules','audit','releases','analytics','integrations','deployments']

const SQUADS = ['squad_platform','squad_growth','squad_design','squad_ops']
const SQUAD_LABELS: Record<string,string> = {
  squad_platform:'Platform', squad_growth:'Growth', squad_design:'Design', squad_ops:'Ops', '*':'— todos —',
}

const ROLES_ORDER: RoleContext[] = [
  'Admin','PMO','ProjectManager','ProductManager','ProductOwner',
  'ScrumMaster','TechLead','Dev','QA','UX',
]

const ROLE_LABELS: Record<RoleContext, string> = {
  Admin:'Admin', PMO:'PMO', ProjectManager:'Proj. Manager',
  ProductManager:'Prod. Manager', ProductOwner:'Product Owner',
  ScrumMaster:'Scrum Master', TechLead:'Tech Lead',
  Dev:'Dev', QA:'QA', UX:'UX / UI',
}

const ROLE_COLORS: Record<RoleContext, string> = {
  Admin:'#7d92ff', PMO:'#35c9ae', ProjectManager:'#f5a524',
  ProductManager:'#a78bfa', ProductOwner:'#f0455a', ScrumMaster:'#60a5fa',
  TechLead:'#34d399', Dev:'#fb923c', QA:'#fbbf24', UX:'#e879f9',
}

const CAP_LABELS: Record<Capability, string> = {
  'create:epic':'Criar Épicos', 'create:feature':'Criar Funcionalidades',
  'access:dashview':'Dashboard Executivo', 'approve:hours':'Aprovar Horas',
  'log:hours':'Lançar Horas', 'create:story':'Criar Histórias',
  'create:task':'Criar Tarefas', 'create:bug':'Criar Bugs',
  'create:subtask':'Criar Subtarefas', 'backlog:prioritize':'Priorizar Backlog',
  'sprint:manage':'Gerenciar Sprint', 'board:manage':'Gerenciar Board',
  'accept:functional':'Aceite Funcional', 'signoff:qa':'Sign-off QA',
  'project:create':'Criar Projetos', 'users:manage':'Gerenciar Usuários',
  'module:request':'Solicitar Módulos', 'access:client-portal':'Portal do Cliente',
  'access:client-messages':'Mensagens do Cliente',
  'manage:dashboard-cards':'Gerenciar Cards de Dashboard', 'edit:workitem':'Editar Work Items',
  'access:discovery':'Busca Avançada & Issue Navigator',
}


const CAP_GROUPS: { label: string; caps: Capability[] }[] = [
  { label:'Estratégico', caps:['create:epic','create:feature','access:dashview','project:create','users:manage','module:request','access:client-portal'] },
  { label:'Discovery', caps:['access:discovery'] },
  { label:'Planejamento', caps:['backlog:prioritize','sprint:manage','board:manage','accept:functional','signoff:qa'] },
  { label:'Criação de itens', caps:['create:story','create:task','create:bug','create:subtask','edit:workitem'] },
  { label:'Horas', caps:['approve:hours','log:hours'] },
  { label:'Admin', caps:['manage:dashboard-cards'] },
]


const STATUS_COLOR: Record<'active'|'inactive'|'blocked', string> = {
  active:T.success, inactive:T.neutral, blocked:T.warn,
}
const STATUS_LABEL: Record<'active'|'inactive'|'blocked', string> = {
  active:'Ativo', inactive:'Inativo', blocked:'Suspenso',
}

function ud(user_id: string, dashboard_id: DashboardType, is_default: boolean): UserDashboard {
  return {
    id:`ud_${user_id}_${dashboard_id}`, tenant_id:MOCK_TENANT.tenant_id,
    user_id, dashboard_id, is_default, status:'active',
    created_at:'2025-01-10T09:00:00Z', created_by:'sys',
    updated_at:new Date().toISOString(), updated_by:'sys',
  }
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function userStatus(u: UserWithStatus): 'active'|'inactive'|'blocked' {
  return u.status ?? 'active'
}

function Av({ user, size=32 }: { user: MockUser; size?: number }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:user.avatar_color,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.34, fontWeight:700, color:'#fff', flexShrink:0, letterSpacing:'-0.02em',
    }}>{user.avatar_initials}</div>
  )
}

function ActionBtn({ label, color, onClick, disabled }: { label:string; color:string; onClick:()=>void; disabled?:boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        fontSize:11, padding:'3px 9px', borderRadius:5,
        background:hov&&!disabled?`${color}20`:'transparent',
        color:disabled?T.text3:hov?color:T.text2,
        border:`1px solid ${disabled?T.border:hov?color+'55':T.border}`,
        cursor:disabled?'not-allowed':'pointer', transition:'all 0.12s',
      }}>{label}</button>
  )
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, fontWeight:600, color:T.text3, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
      {children}
    </div>
  )
}

function inputStyle(): React.CSSProperties {
  return { width:'100%', background:T.bgSurface2, border:`1px solid ${T.border2}`, borderRadius:8, color:T.text1, padding:'7px 11px', fontSize:13, outline:'none', boxSizing:'border-box' as const }
}

function TabBar({ active, onChange, pendingCount }: { active:Tab; onChange:(t:Tab)=>void; pendingCount:number }) {
  const tabs: { id:Tab; label:string; badge?:number }[] = [
    { id:'membros',    label:'Membros' },
    { id:'convites',   label:'Convites', badge: pendingCount > 0 ? pendingCount : undefined },
    { id:'permissoes', label:'Matriz de Permissões' },
    { id:'dashboards', label:'Dashboards' },
  ]
  return (
    <div className="flex gap-1" style={{ borderBottom:`1px solid ${T.border}` }}>
      {tabs.map(t => (
        <button key={t.id} onClick={()=>onChange(t.id)} style={{
          padding:'8px 16px', fontSize:13, fontWeight:active===t.id?600:400,
          color:active===t.id?T.text1:T.text2, background:'transparent',
          borderBottom:active===t.id?`2px solid ${T.accent}`:'2px solid transparent',
          transition:'all 0.15s', marginBottom:-1,
          display:'flex', alignItems:'center', gap:6,
        }}>
          {t.label}
          {t.badge !== undefined && (
            <span style={{ fontSize:10, fontWeight:700, background:T.warn, color:'#fff', borderRadius:99, padding:'0px 6px', lineHeight:'16px' }}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Edit draft type ─────────────────────────────────────────────────────────

interface EditDraft {
  role: RoleContext; squad: string; status: 'active'|'inactive'|'blocked'
  modules: string[]; dashboards: DashboardType[]; defaultDash: DashboardType|null; optIns: Capability[]
  reportsAccess: boolean
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user, activeUserName, onClose, onSave, isOwner = false,
}: {
  user:           UserWithStatus
  activeUserName: string
  onClose:        ()=>void
  onSave:         (patch: EditDraft)=>void
  isOwner?:       boolean
}) {
  void activeUserName
  const [step, setStep] = useState<'basics'|'permissions'|'dashboards'>('basics')

  const currentDashIds = user.assigned_dashboards.map(d => d.dashboard_id as DashboardType)
  const currentDefault = (user.assigned_dashboards.find(d=>d.is_default)?.dashboard_id ?? currentDashIds[0] ?? null) as DashboardType|null

  // Detect existing opt-ins: perms the user has that aren't in their role's defaults
  const roleDefaultPerms = derivePermissions(user.role_context)
  const existingOptIns = (user.permissions ?? []).filter(p => !roleDefaultPerms.includes(p)) as Capability[]

  const [draft, setDraft] = useState<EditDraft>({
    role:        user.role_context,
    squad:       user.squad_id,
    status:      userStatus(user),
    modules:     [...user.modules_enabled],
    dashboards:  [...currentDashIds],
    defaultDash: currentDefault,
    optIns:      existingOptIns,
    reportsAccess: false,
  })

  // Carrega o flag atual de acesso a Relatórios (profiles.reports_access).
  useEffect(() => {
    let alive = true
    void fetchProfileReportsAccess(user.user_id).then(v => {
      if (alive) setDraft(d => ({ ...d, reportsAccess: v }))
    })
    return () => { alive = false }
  }, [user.user_id])

  function patch(p: Partial<EditDraft>) { setDraft(d=>({...d,...p})) }

  // When role changes, reset opt-ins to empty and suggest dashboards reset
  function changeRole(r: RoleContext) {
    patch({ role:r, optIns:[], reportsAccess: roleSupportsReportsAccess(r) ? draft.reportsAccess : false })
  }

  function toggleModule(m: string) {
    patch({ modules: draft.modules.includes(m) ? draft.modules.filter(x=>x!==m) : [...draft.modules, m] })
  }

  function toggleDash(d: DashboardType) {
    let next = draft.dashboards.includes(d) ? draft.dashboards.filter(x=>x!==d) : [...draft.dashboards, d]
    let def = draft.defaultDash
    if (!next.includes(def!)) def = next[0] ?? null
    patch({ dashboards:next, defaultDash:def })
  }

  function toggleOptIn(cap: Capability) {
    const rule = PERMISSION_MATRIX[cap]
    if (!rule.optIn.includes(draft.role)) return // not toggleable for this role
    patch({ optIns: draft.optIns.includes(cap) ? draft.optIns.filter(c=>c!==cap) : [...draft.optIns, cap] })
  }

  const isAdmin = user.user_id === 'u_admin' || isOwner

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:T.bgSurface, border:`1px solid ${T.border2}`, borderRadius:16, boxShadow:T.shadowModal, width:560, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <Av user={user} size={40} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:T.text1 }}>{user.name}</div>
            <div style={{ fontSize:11, color:T.text3 }}>{user.email}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:T.text3, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Step tabs */}
        <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          {(['basics','permissions','dashboards'] as const).map(s => (
            <button key={s} onClick={()=>setStep(s)} style={{
              padding:'8px 18px', fontSize:12, fontWeight:step===s?600:400,
              color:step===s?T.accent:T.text2, borderBottom:step===s?`2px solid ${T.accent}`:'2px solid transparent',
              background:'transparent', marginBottom:-1, cursor:'pointer',
            }}>
              {s==='basics'?'Dados básicos':s==='permissions'?'Permissões':'Dashboards'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding:24, overflowY:'auto', flex:1 }}>

          {step === 'basics' && (
            <>
              <Field label="Função / Papel operacional">
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {ROLES_ORDER.map(r => (
                    <button key={r} onClick={()=>!isAdmin&&changeRole(r)} disabled={isAdmin}
                      style={{
                        padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                        background:draft.role===r?`${ROLE_COLORS[r]}22`:`${T.bgSurface2}`,
                        color:draft.role===r?ROLE_COLORS[r]:T.text2,
                        border:`1.5px solid ${draft.role===r?ROLE_COLORS[r]+88:T.border}`,
                        cursor:isAdmin?'not-allowed':'pointer',
                      }}>
                      {ROLE_LABELS[r]} <span style={{ fontSize:10, opacity:0.6 }}>T{ROLE_TIER[r]}</span>
                    </button>
                  ))}
                </div>
                {isAdmin && <p style={{ fontSize:11, color:T.text3, marginTop:6 }}>{isOwner ? 'Admin Master do tenant — não pode ser removido/rebaixado.' : 'O papel Admin não pode ser alterado.'}</p>}
              </Field>

              <Field label="Squad">
                <select value={draft.squad} onChange={e=>patch({squad:e.target.value})}
                  style={{ ...inputStyle(), fontFamily:'inherit' }}>
                  {isAdmin && <option value="*">— todos —</option>}
                  {SQUADS.map(s=><option key={s} value={s}>{SQUAD_LABELS[s]}</option>)}
                </select>
              </Field>

              <Field label="Status do usuário">
                <div style={{ display:'flex', gap:8 }}>
                  {(['active','inactive','blocked'] as const).map(st=>(
                    <button key={st} onClick={()=>!isAdmin&&patch({status:st})} disabled={isAdmin}
                      style={{
                        padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:500,
                        background:draft.status===st?`${STATUS_COLOR[st]}20`:'transparent',
                        color:draft.status===st?STATUS_COLOR[st]:T.text2,
                        border:`1.5px solid ${draft.status===st?STATUS_COLOR[st]+66:T.border}`,
                        cursor:isAdmin?'not-allowed':'pointer',
                      }}>{STATUS_LABEL[st]}</button>
                  ))}
                </div>
              </Field>

              <Field label="Módulos habilitados">
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {ALL_MODULES.map(m=>(
                    <button key={m} onClick={()=>toggleModule(m)}
                      style={{
                        padding:'4px 10px', borderRadius:5, fontSize:11,
                        background:draft.modules.includes(m)?T.accentDim:'transparent',
                        color:draft.modules.includes(m)?T.accent:T.text3,
                        border:`1px solid ${draft.modules.includes(m)?T.accentBorder:T.border}`,
                        cursor:'pointer',
                      }}>{m}</button>
                  ))}
                </div>
              </Field>

              <Field label="Acesso a Relatórios e Insights">
                {roleSupportsReportsAccess(draft.role) ? (
                  <button onClick={()=>patch({ reportsAccess: !draft.reportsAccess })}
                    style={{
                      display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8,
                      background:draft.reportsAccess?T.accentDim:'transparent',
                      border:`1px solid ${draft.reportsAccess?T.accentBorder:T.border}`,
                      cursor:'pointer', width:'100%', textAlign:'left',
                    }}>
                    <span style={{
                      width:16, height:16, borderRadius:4, flexShrink:0,
                      background:draft.reportsAccess?T.accent:T.border2,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#fff', fontSize:10,
                    }}>{draft.reportsAccess?'✓':''}</span>
                    <span style={{ fontSize:12, color:T.text1 }}>
                      Liberar a tela "Relatórios e Insights" para este usuário
                    </span>
                  </button>
                ) : (
                  <p style={{ fontSize:11, color:T.text3, margin:0 }}>
                    {isAdmin
                      ? 'Admin Master sempre tem acesso a Relatórios e Insights.'
                      : 'Disponível apenas para PMO, Project Manager, Product Owner e Tech Lead.'}
                  </p>
                )}
              </Field>
            </>
          )}

          {step === 'permissions' && (
            <>
              <p style={{ fontSize:12, color:T.text2, marginBottom:14 }}>
                <span style={{ color:T.success }}>●</span> Padrão do papel &nbsp;·&nbsp;
                <span style={{ color:T.accent }}>○</span> Opt-in (clique para habilitar/desabilitar) &nbsp;·&nbsp;
                <span style={{ color:T.text3 }}>—</span> Não disponível
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {(Object.entries(PERMISSION_MATRIX) as [Capability, typeof PERMISSION_MATRIX[Capability]][]).map(([cap, rule])=>{
                  const vis = capabilityVisibility(draft.role, cap)
                  void vis
                  const isOptIn = rule.optIn.includes(draft.role)
                  const isGranted = draft.optIns.includes(cap)
                  const isDefault = rule.default.includes(draft.role)
                  const isHidden  = rule.hidden.includes(draft.role) || (!isDefault && !isOptIn)

                  return (
                    <div key={cap} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8,
                      background:isDefault?`${T.success}08`:isGranted?`${T.accent}08`:'transparent',
                      border:`1px solid ${isDefault?T.success+'22':isGranted?T.accent+'22':T.border}`,
                    }}>
                      <span style={{ flex:1, fontSize:12, color:isHidden?T.text3:T.text1 }}>{CAP_LABELS[cap] ?? cap}</span>
                      {isDefault && <span title="Padrão do papel" style={{ fontSize:14, color:T.success }}>●</span>}
                      {isOptIn && !isDefault && (
                        <button onClick={()=>toggleOptIn(cap)} title={isGranted?'Revogar opt-in':'Conceder opt-in'}
                          style={{
                            width:24, height:24, borderRadius:'50%', border:`1.5px solid ${isGranted?T.accent:T.border2}`,
                            background:isGranted?T.accentDim:'transparent', color:isGranted?T.accent:T.text3,
                            fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                          }}>{isGranted?'○':'○'}</button>
                      )}
                      {isHidden && <span style={{ fontSize:13, color:T.border }}>—</span>}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {step === 'dashboards' && (
            <>
              <p style={{ fontSize:12, color:T.text2, marginBottom:14 }}>
                Selecione os dashboards e defina qual é o padrão (aberto ao entrar no sistema).
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(Object.values(DASHBOARD_CATALOG)).map(d=>{
                  const isAssigned = draft.dashboards.includes(d.dashboard_id)
                  const isDefault  = draft.defaultDash === d.dashboard_id
                  return (
                    <div key={d.dashboard_id} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10,
                      background:isAssigned?T.accentDim:'transparent',
                      border:`1px solid ${isAssigned?T.accentBorder:T.border}`,
                    }}>
                      <input type="checkbox" checked={isAssigned} onChange={()=>toggleDash(d.dashboard_id)}
                        style={{ width:14, height:14, accentColor:T.accent, cursor:'pointer' }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:isAssigned?T.text1:T.text2 }}>{d.label}</div>
                        <div style={{ fontSize:10, color:T.text3 }}>{d.question}</div>
                      </div>
                      {isAssigned && (
                        <button onClick={()=>patch({defaultDash:d.dashboard_id})}
                          style={{
                            fontSize:11, padding:'3px 10px', borderRadius:20,
                            background:isDefault?T.accent:'transparent',
                            color:isDefault?'#fff':T.text2,
                            border:`1px solid ${isDefault?T.accent:T.border}`,
                            cursor:'pointer', fontWeight:isDefault?600:400,
                          }}>{isDefault?'★ Padrão':'Definir padrão'}</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px', borderTop:`1px solid ${T.border}`, display:'flex', justifyContent:'flex-end', gap:10, flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:8, background:'transparent', border:`1px solid ${T.border2}`, color:T.text2, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={()=>onSave(draft)} style={{ padding:'8px 22px', borderRadius:8, background:T.accent, border:'none', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Salvar alterações</button>
        </div>
      </div>
    </div>
  )
}

// ─── Members tab ──────────────────────────────────────────────────────────────

function MembersTab({ onInvite, canManage }: { onInvite:()=>void; canManage:boolean }) {
  const { activeUser, setActiveUser } = useSession()
  const [users, setUsers] = useState<UserWithStatus[]>(()=>[...MOCK_USERS] as UserWithStatus[])
  const [filter, setFilter] = useState<'all'|'active'|'inactive'|'blocked'>('all')
  const [confirmId, setConfirmId] = useState<string|null>(null)
  const [confirmAction, setConfirmAction] = useState<'deactivate'|'block'|null>(null)
  const [editingUser, setEditingUser] = useState<UserWithStatus|null>(null)
  const [toast, setToast] = useState<string|null>(null)
  const [ownerEmails, setOwnerEmails] = useState<Set<string>>(()=>new Set())
  const [profileIds, setProfileIds] = useState<Record<string,string>>({})
  const [resetLink, setResetLink] = useState<{ name:string; url:string }|null>(null)
  const [generating, setGenerating] = useState<string|null>(null)

  useEffect(()=>{
    let alive = true
    getTenantOwnerEmails().then(set=>{ if (alive) setOwnerEmails(set) })
    getMembers().then(rows=>{
      if (!alive) return
      const map: Record<string,string> = {}
      rows.forEach(r=>{ if (r.email) map[r.email.toLowerCase()] = r.id })
      setProfileIds(map)
    })
    return ()=>{ alive = false }
  }, [])

  async function generateResetLink(u: UserWithStatus) {
    const profileId = profileIds[(u.email ?? '').toLowerCase()]
    if (!profileId) { showToast('Perfil não encontrado no banco para este membro'); return }
    setGenerating(u.user_id)
    const raw = await issueToken(profileId, 'password_reset', 24)
    if (!raw) { setGenerating(null); showToast('Não foi possível gerar o link agora'); return }
    await setPasswordMustChange(profileId, true)
    await auditPasswordResetRequested(profileId, 24)
    setResetLink({ name: u.name, url: activationLink(raw) })
    setGenerating(null)
  }

  function isTenantOwner(u: UserWithStatus) {
    return ownerEmails.has((u.email ?? '').toLowerCase()) || (ownerEmails.size === 0 && u.user_id === 'u_admin')
  }

  function showToast(msg: string) { setToast(msg); setTimeout(()=>setToast(null), 3000) }

  const visible = users.filter(u=>filter==='all'||userStatus(u)===filter)

  function applyAction(userId: string, action: 'deactivate'|'block') {
    if (action==='deactivate') deactivateMockUser(userId)
    else blockMockUser(userId)
    setUsers(prev=>prev.map(u=>u.user_id===userId?{...u,status:action==='deactivate'?'inactive':'blocked'}:u))
    setConfirmId(null); setConfirmAction(null)
  }

  function reactivate(userId: string) {
    const u = MOCK_USERS.find(u=>u.user_id===userId)
    if (u) (u as UserWithStatus).status = 'active'
    setUsers(prev=>prev.map(u=>u.user_id===userId?{...u,status:'active'}:u))
  }

  function handleSave(userId: string, draft: EditDraft) {
    const target = users.find(u=>u.user_id===userId)
    if (!target) return

    // Build audit entries
    const who = activeUser.name
    const changes: [string,string,string][] = []
    if (draft.role !== target.role_context) changes.push(['Papel', ROLE_LABELS[target.role_context], ROLE_LABELS[draft.role]])
    if (draft.squad !== target.squad_id) changes.push(['Squad', SQUAD_LABELS[target.squad_id]??target.squad_id, SQUAD_LABELS[draft.squad]??draft.squad])
    if (draft.status !== userStatus(target)) changes.push(['Status', STATUS_LABEL[userStatus(target)], STATUS_LABEL[draft.status]])

    changes.forEach(([field,from,to])=>{
      _AUDIT.push({ ts:new Date().toISOString(), who, target:target.name, field, from, to })
    })

    // Build new dashboards
    const newDashes: UserDashboard[] = draft.dashboards.map(did=>
      ud(userId, did, did===draft.defaultDash)
    )
    // Compute new permissions
    const newPerms = userId==='u_admin' ? ['*'] : derivePermissions(draft.role, draft.optIns)

    // Mutate MOCK_USERS in place so the session module stays consistent
    const mu = MOCK_USERS.find(u=>u.user_id===userId)!
    mu.role_context = draft.role
    mu.squad_id = draft.squad
    mu.modules_enabled = draft.modules
    mu.permissions = newPerms
    mu.assigned_dashboards = newDashes
    ;(mu as UserWithStatus).status = draft.status

    // If editing the currently-active user, refresh the session
    if (userId === activeUser.user_id) {
      setActiveUser(userId) // triggers context re-read from MOCK_USERS
    }

    setUsers(prev=>prev.map(u=>u.user_id===userId?{
      ...u, role_context:draft.role, squad_id:draft.squad,
      modules_enabled:draft.modules, permissions:newPerms,
      assigned_dashboards:newDashes, status:draft.status,
    }:u))

    void saveProfileReportsAccess(
      userId,
      roleSupportsReportsAccess(draft.role) ? draft.reportsAccess : false,
    )

    setEditingUser(null)
    showToast(`${target.name} atualizado com sucesso`)
  }

  const counts = {
    active:  users.filter(u=>userStatus(u)==='active').length,
    inactive:users.filter(u=>userStatus(u)==='inactive').length,
    blocked: users.filter(u=>userStatus(u)==='blocked').length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(['all','active','inactive','blocked'] as const).map(f=>{
            const label = f==='all'?`Todos (${users.length})`:f==='active'?`Ativos (${counts.active})`:f==='inactive'?`Inativos (${counts.inactive})`:`Suspensos (${counts.blocked})`
            return (
              <button key={f} onClick={()=>setFilter(f)} style={{
                padding:'5px 12px', borderRadius:6, fontSize:12,
                fontWeight:filter===f?600:400,
                background:filter===f?T.accentDim:'transparent',
                color:filter===f?T.accent:T.text2,
                border:`1px solid ${filter===f?T.accentBorder:T.border}`,
              }}>{label}</button>
            )
          })}
        </div>
        {canManage && (
          <button onClick={onInvite} style={{
            padding:'7px 16px', borderRadius:8, fontSize:13, fontWeight:600,
            background:T.accent, color:'#fff', border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
            Convidar membro
          </button>
        )}
      </div>

      <div style={{ background:T.bgSurface, borderRadius:12, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {['Membro','Função','Squad','Status','Módulos','Ações'].map(col=>(
                <th key={col} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:T.text3, letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((u,i)=>{
              const st = userStatus(u)
              const isLast = i===visible.length-1
              const owner = isTenantOwner(u)
              const isAdmin = u.user_id==='u_admin' || owner
              const isConfirming = confirmId===u.user_id
              return (
                <tr key={u.user_id}
                  style={{ borderBottom:isLast?'none':`1px solid ${T.border}`, opacity:st==='inactive'?0.55:1, transition:'background 0.1s' }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLTableRowElement).style.background=`${T.text3}08`}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}>
                  <td style={{ padding:'12px 16px' }}>
                    <div className="flex items-center gap-3">
                      <Av user={u} size={32}/>
                      <div>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize:13, fontWeight:600, color:T.text1 }}>{u.name}</span>
                          {owner && (
                            <span title="Admin Master do tenant — não pode ser removido/rebaixado"
                              style={{ fontSize:10, fontWeight:700, color:T.accent, background:T.accentDim, border:`1px solid ${T.accentBorder}`, borderRadius:5, padding:'1px 6px', whiteSpace:'nowrap' }}>
                              Admin Master · Owner
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:11, color:T.text3 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:ROLE_COLORS[u.role_context], background:`${ROLE_COLORS[u.role_context]}18`, border:`1px solid ${ROLE_COLORS[u.role_context]}33`, borderRadius:5, padding:'2px 8px' }}>
                      {ROLE_LABELS[u.role_context]}
                    </span>
                    <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>Tier {ROLE_TIER[u.role_context]}</div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:12, color:T.text2 }}>{SQUAD_LABELS[u.squad_id]??u.squad_id}</span>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ width:7, height:7, borderRadius:'50%', background:STATUS_COLOR[st], flexShrink:0, boxShadow:st==='active'?`0 0 6px ${T.success}80`:'none' }}/>
                      <span style={{ fontSize:12, color:STATUS_COLOR[st], fontWeight:500 }}>{STATUS_LABEL[st]}</span>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <div className="flex flex-wrap gap-1" style={{ maxWidth:200 }}>
                      {u.modules_enabled.slice(0,4).map(m=>(
                        <span key={m} style={{ fontSize:10, color:T.text3, background:`${T.text3}12`, border:`1px solid ${T.border}`, borderRadius:4, padding:'1px 6px' }}>{m}</span>
                      ))}
                      {u.modules_enabled.length>4&&<span style={{ fontSize:10, color:T.text3 }}>+{u.modules_enabled.length-4}</span>}
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize:11, color:T.warn }}>Confirmar?</span>
                        <button onClick={()=>applyAction(u.user_id, confirmAction!)} style={{ fontSize:11, padding:'3px 8px', borderRadius:5, background:confirmAction==='block'?T.warnDim:T.critDim, color:confirmAction==='block'?T.warn:T.crit, border:`1px solid ${confirmAction==='block'?T.warn:T.crit}44`, cursor:'pointer' }}>Sim</button>
                        <button onClick={()=>{setConfirmId(null);setConfirmAction(null)}} style={{ fontSize:11, padding:'3px 8px', borderRadius:5, background:'transparent', color:T.text2, border:`1px solid ${T.border}`, cursor:'pointer' }}>Não</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {canManage && (
                          <ActionBtn label="Editar" color={T.accent} onClick={()=>setEditingUser(u)}/>
                        )}
                        {canManage && (
                          <ActionBtn
                            label={generating===u.user_id ? 'Gerando…' : 'Gerar link'}
                            color={T.neutral}
                            disabled={generating===u.user_id}
                            onClick={()=>{ void generateResetLink(u) }}
                          />
                        )}
                        {!isAdmin && canManage && st==='active' && (
                          <>
                            <ActionBtn label="Suspender" color={T.warn} onClick={()=>{setConfirmId(u.user_id);setConfirmAction('block')}}/>
                            <ActionBtn label="Desativar" color={T.crit} onClick={()=>{setConfirmId(u.user_id);setConfirmAction('deactivate')}}/>
                          </>
                        )}
                        {!isAdmin && canManage && st!=='active' && (
                          <ActionBtn label="Reativar" color={T.success} onClick={()=>reactivate(u.user_id)}/>
                        )}
                        {(!canManage)&&(
                          <span title={owner ? 'Admin Master do tenant — não pode ser removido/rebaixado' : undefined}
                            style={{ fontSize:11, color:T.text3 }}>—</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize:11, color:T.text3, marginTop:12 }}>
        Usuários desativados perdem acesso ao sistema. Suspensos têm acesso temporariamente bloqueado. Nenhuma remoção permanente é realizada.
      </p>

      {resetLink && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}
          onClick={()=>setResetLink(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:520, background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:12, padding:22 }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:T.text1, marginBottom:6 }}>Link de ativação/reset — {resetLink.name}</h3>
            <p style={{ fontSize:12, color:T.warn, marginBottom:12 }}>
              Este link aparece uma única vez, é de uso único e expira em 24 horas. Copie agora.
            </p>
            <div style={{ fontSize:12, color:T.text2, background:T.bgSurface2, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px', wordBreak:'break-all', marginBottom:14 }}>
              {resetLink.url}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setResetLink(null)} style={{ padding:'8px 16px', borderRadius:8, background:'transparent', border:`1px solid ${T.border2}`, color:T.text2, fontSize:13, cursor:'pointer' }}>Fechar</button>
              <button onClick={async()=>{ const ok = await copyToClipboard(resetLink.url); showToast(ok?'Link copiado':'Não foi possível copiar') }}
                style={{ padding:'8px 18px', borderRadius:8, background:T.accent, border:'none', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Copiar link</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && canManage && (
        <EditUserModal
          user={editingUser}
          activeUserName={activeUser.name}
          onClose={()=>setEditingUser(null)}
          onSave={draft=>handleSave(editingUser.user_id, draft)}
          isOwner={isTenantOwner(editingUser)}
        />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:T.bgSurface2, border:`1px solid ${T.success}40`, borderRadius:10, padding:'12px 20px', color:T.success, fontSize:13, fontWeight:500, boxShadow:T.shadowModal, display:'flex', alignItems:'center', gap:8 }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

// ─── Permissions Matrix tab ───────────────────────────────────────────────────

function PermissionsTab({ canManage }: { canManage: boolean }) {
  // Per-role opt-in overrides (session-local, not persisted to individual users)
  const [roleOptIns, setRoleOptIns] = useState<Partial<Record<RoleContext, Capability[]>>>(()=>{
    // Seed from existing user opt-ins per role
    const seed: Partial<Record<RoleContext,Capability[]>> = {}
    MOCK_USERS.forEach(u=>{
      const def = derivePermissions(u.role_context)
      const opts = u.permissions.filter(p=>!def.includes(p)) as Capability[]
      if (opts.length) seed[u.role_context] = [...(seed[u.role_context]??[]), ...opts.filter(o=>!(seed[u.role_context]??[]).includes(o))]
    })
    return seed
  })
  const [toast, setToast] = useState<string|null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(()=>setToast(null), 2500) }

  function toggleRoleOptIn(role: RoleContext, cap: Capability) {
    if (!canManage) return
    const rule = PERMISSION_MATRIX[cap]
    if (!rule.optIn.includes(role)) return // can't toggle default or hidden
    setRoleOptIns(prev=>{
      const cur = prev[role] ?? []
      const next = cur.includes(cap) ? cur.filter(c=>c!==cap) : [...cur, cap]
      // Persist to all users of this role
      MOCK_USERS.filter(u=>u.role_context===role).forEach(u=>{
        u.permissions = derivePermissions(role, next)
      })
      showToast(`${CAP_LABELS[cap] ?? cap} ${next.includes(cap)?'habilitado':'desabilitado'} para ${ROLE_LABELS[role]}`)
      return { ...prev, [role]: next }
    })
  }

  function cellContent(role: RoleContext, cap: Capability) {
    const rule = PERMISSION_MATRIX[cap]
    const isDefault = rule.default.includes(role)
    const isOptIn   = rule.optIn.includes(role)
    const isHidden  = !isDefault && !isOptIn
    const granted   = (roleOptIns[role] ?? []).includes(cap)

    if (isDefault) return <span title="Padrão do papel" style={{ color:T.success, fontSize:15 }}>●</span>
    if (isHidden)  return <span title="Não disponível" style={{ color:T.border, fontSize:14 }}>—</span>
    // opt-in
    return (
      <button onClick={()=>toggleRoleOptIn(role, cap)}
        title={canManage?(granted?'Revogar opt-in para este papel':'Conceder opt-in para este papel'):'Requer users:manage'}
        style={{
          width:22, height:22, borderRadius:'50%', border:`1.5px solid ${granted?T.accent:T.border2}`,
          background:granted?T.accentDim:'transparent', color:granted?T.accent:T.text3,
          fontSize:12, cursor:canManage?'pointer':'default', display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>○</button>
    )
  }

  return (
    <div>
      <p style={{ fontSize:12, color:T.text2, marginBottom:16 }}>
        <strong style={{ color:T.success }}>●</strong> Padrão &nbsp;·&nbsp;
        <strong style={{ color:T.accent }}>○</strong> Opt-in{canManage?' (clique para habilitar/desabilitar por papel)':''} &nbsp;·&nbsp;
        <strong style={{ color:T.text3 }}>—</strong> Não disponível
        {canManage && <span style={{ marginLeft:12, fontSize:11, color:T.text3 }}>Alterações refletem imediatamente nas permissões efetivas.</span>}
      </p>
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', width:'100%', minWidth:900 }}>
          <thead>
            <tr>
              <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:T.text3, letterSpacing:'0.06em', textTransform:'uppercase', minWidth:180, position:'sticky', left:0, background:T.bgSurface, borderRight:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}` }}>Permissão</th>
              {ROLES_ORDER.map(role=>(
                <th key={role} style={{ padding:'10px 10px', textAlign:'center', fontSize:10, fontWeight:700, color:ROLE_COLORS[role], letterSpacing:'0.04em', whiteSpace:'nowrap', minWidth:76, borderBottom:`1px solid ${T.border}` }}>
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAP_GROUPS.map(group=>(
              <React.Fragment key={group.label}>
                <tr>
                  <td colSpan={ROLES_ORDER.length+1} style={{ padding:'10px 16px 6px', fontSize:10, fontWeight:700, color:T.text3, textTransform:'uppercase', letterSpacing:'0.08em', background:`${T.text3}08`, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}` }}>
                    {group.label}
                  </td>
                </tr>
                {group.caps.map((cap,ri)=>(
                  <tr key={cap} style={{ background:ri%2===0?'transparent':`${T.text3}05` }}>
                    <td style={{ padding:'9px 16px', fontSize:12, color:T.text1, fontWeight:500, position:'sticky', left:0, background:ri%2===0?T.bgSurface:`${T.bgSurface}EE`, borderRight:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}88` }}>
                      {CAP_LABELS[cap] ?? cap}
                    </td>
                    {ROLES_ORDER.map(role=>(
                      <td key={role} style={{ padding:'9px 10px', textAlign:'center', borderBottom:`1px solid ${T.border}88` }}>
                        {cellContent(role, cap)}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:T.bgSurface2, border:`1px solid ${T.accent}40`, borderRadius:10, padding:'12px 20px', color:T.accent, fontSize:13, fontWeight:500, boxShadow:T.shadowModal, display:'flex', alignItems:'center', gap:8 }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

// ─── Dashboards tab ───────────────────────────────────────────────────────────

function DashboardsTab({ canManage }: { canManage: boolean }) {
  const { setActiveUser } = useSession()
  const [users, setUsers] = useState<MockUser[]>(()=>[...MOCK_USERS])
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editDashes, setEditDashes] = useState<DashboardType[]>([])
  const [editDefault, setEditDefault] = useState<DashboardType|null>(null)
  const [toast, setToast] = useState<string|null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(()=>setToast(null), 2500) }

  function startEdit(u: MockUser) {
    setEditingId(u.user_id)
    setEditDashes(u.assigned_dashboards.map(d=>d.dashboard_id as DashboardType))
    setEditDefault((u.assigned_dashboards.find(d=>d.is_default)?.dashboard_id??null) as DashboardType|null)
  }

  function toggleDash(d: DashboardType) {
    let next = editDashes.includes(d) ? editDashes.filter(x=>x!==d) : [...editDashes, d]
    let def = editDefault
    if (!next.includes(def!)) def = next[0]??null
    setEditDashes(next); setEditDefault(def)
  }

  function saveDashEdit(userId: string) {
    const newDashes = editDashes.map(did=>ud(userId, did, did===editDefault))
    // Mutate MOCK_USERS
    const mu = MOCK_USERS.find(u=>u.user_id===userId)!
    mu.assigned_dashboards = newDashes
    setUsers(prev=>prev.map(u=>u.user_id===userId?{...u,assigned_dashboards:newDashes}:u))
    setEditingId(null)
    setActiveUser(userId) // refresh context if editing active user
    showToast('Dashboards atualizados')
  }

  return (
    <div>
      <p style={{ fontSize:12, color:T.text2, marginBottom:16 }}>
        Dashboards atribuídos a cada membro. O dashboard padrão é aberto ao entrar no sistema.
        {canManage && ' Clique em "Editar" para alterar as atribuições.'}
      </p>
      <div style={{ background:T.bgSurface, borderRadius:12, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {['Membro','Função','Dashboard padrão','Dashboards secundários', canManage?'Ações':''].filter(Boolean).map(col=>(
                <th key={col} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:T.text3, letterSpacing:'0.06em', textTransform:'uppercase' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u,i)=>{
              const defaultDash = u.assigned_dashboards.find(d=>d.is_default)
              const secondary   = u.assigned_dashboards.filter(d=>!d.is_default)
              const isLast = i===users.length-1
              const isEditing = editingId===u.user_id
              return (
                <React.Fragment key={u.user_id}>
                  <tr style={{ borderBottom:isLast&&!isEditing?'none':`1px solid ${T.border}` }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLTableRowElement).style.background=`${T.text3}08`}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}>
                    <td style={{ padding:'12px 16px' }}>
                      <div className="flex items-center gap-3">
                        <Av user={u} size={28}/>
                        <span style={{ fontSize:13, fontWeight:500, color:T.text1 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:ROLE_COLORS[u.role_context] }}>{ROLE_LABELS[u.role_context]}</span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      {defaultDash ? (
                        <div>
                          <span style={{ fontSize:12, fontWeight:600, color:T.accent, background:T.accentDim, border:`1px solid ${T.accentBorder}`, borderRadius:5, padding:'2px 8px' }}>
                            {DASHBOARD_CATALOG[defaultDash.dashboard_id as DashboardType]?.label ?? defaultDash.dashboard_id}
                          </span>
                        </div>
                      ):<span style={{ fontSize:12, color:T.text3 }}>—</span>}
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      {secondary.length>0?(
                        <div className="flex flex-wrap gap-1.5">
                          {secondary.map(d=>(
                            <span key={d.dashboard_id} style={{ fontSize:11, color:T.text2, background:`${T.text3}12`, border:`1px solid ${T.border}`, borderRadius:5, padding:'2px 8px' }}>
                              {DASHBOARD_CATALOG[d.dashboard_id as DashboardType]?.label??d.dashboard_id}
                            </span>
                          ))}
                        </div>
                      ):<span style={{ fontSize:12, color:T.text3 }}>—</span>}
                    </td>
                    {canManage && (
                      <td style={{ padding:'12px 16px' }}>
                        <ActionBtn label={isEditing?'Cancelar':'Editar'} color={isEditing?T.text2:T.accent} onClick={()=>isEditing?setEditingId(null):startEdit(u)}/>
                      </td>
                    )}
                  </tr>
                  {isEditing && (
                    <tr style={{ borderBottom:isLast?'none':`1px solid ${T.border}`, background:`${T.accent}06` }}>
                      <td colSpan={5} style={{ padding:'16px 20px' }}>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                          {(Object.values(DASHBOARD_CATALOG)).map(d=>{
                            const isAssigned = editDashes.includes(d.dashboard_id)
                            const isDefault  = editDefault===d.dashboard_id
                            return (
                              <div key={d.dashboard_id} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, background:isAssigned?T.accentDim:T.bgSurface2, border:`1px solid ${isAssigned?T.accentBorder:T.border}`, cursor:'pointer' }}
                                onClick={()=>toggleDash(d.dashboard_id)}>
                                <input type="checkbox" checked={isAssigned} readOnly style={{ accentColor:T.accent, width:13, height:13 }}/>
                                <span style={{ fontSize:12, color:isAssigned?T.text1:T.text2 }}>{d.label}</span>
                                {isAssigned && (
                                  <button onClick={e=>{e.stopPropagation();setEditDefault(d.dashboard_id)}}
                                    style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:isDefault?T.accent:'transparent', color:isDefault?'#fff':T.text3, border:`1px solid ${isDefault?T.accent:T.border}`, cursor:'pointer' }}>
                                    {isDefault?'★ padrão':'padrão?'}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <button onClick={()=>saveDashEdit(u.user_id)} style={{ padding:'6px 18px', borderRadius:8, background:T.accent, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer' }}>Salvar</button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:T.bgSurface2, border:`1px solid ${T.accent}40`, borderRadius:10, padding:'12px 20px', color:T.accent, fontSize:13, fontWeight:500, boxShadow:T.shadowModal, display:'flex', alignItems:'center', gap:8 }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip() {
  const total    = MOCK_USERS.length
  const active   = MOCK_USERS.filter(u=>!(u as UserWithStatus).status||(u as UserWithStatus).status==='active').length
  const inactive = MOCK_USERS.filter(u=>(u as UserWithStatus).status==='inactive').length
  const blocked  = MOCK_USERS.filter(u=>(u as UserWithStatus).status==='blocked').length
  const cards = [
    { label:'Total de membros', value:total,    color:T.accent  },
    { label:'Ativos',           value:active,   color:T.success },
    { label:'Inativos',         value:inactive, color:T.neutral },
    { label:'Suspensos',        value:blocked,  color:T.warn    },
  ]
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {cards.map(c=>(
        <div key={c.label} style={{ padding:'14px 18px', borderRadius:10, background:T.bgSurface, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:28, fontWeight:800, color:c.color, lineHeight:1 }}>{c.value}</div>
          <div style={{ fontSize:11, color:T.text2, marginTop:4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Permission denied state ──────────────────────────────────────────────────

function PermissionDenied() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, gap:16 }}>
      <div style={{ fontSize:48 }}>🔒</div>
      <div style={{ fontSize:18, fontWeight:700, color:T.text1 }}>Acesso restrito</div>
      <div style={{ fontSize:14, color:T.text2, textAlign:'center', maxWidth:360 }}>
        A gestão de membros e permissões requer a capacidade <strong style={{ color:T.accent }}>users:manage</strong> (Admin Master).
      </div>
    </div>
  )
}

// ─── Invites tab ──────────────────────────────────────────────────────────────

function expiryLabel(isoDate: string): { text: string; color: string } {
  const diff = new Date(isoDate).getTime() - Date.now()
  const days = Math.floor(diff / 86400000)
  if (days < 0) return { text: 'Expirado', color: T.crit }
  if (days === 0) return { text: 'Expira hoje', color: T.crit }
  if (days <= 2) return { text: `Expira em ${days}d`, color: T.warn }
  return { text: `Expira em ${days}d`, color: T.text3 }
}

const INVITE_STATUS_META: Record<InviteStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pendente',  color: T.warn,    bg: T.warnDim },
  expired:  { label: 'Expirado',  color: T.crit,    bg: T.critDim },
  accepted: { label: 'Aceito',    color: T.success,  bg: `${T.success}14` },
}

function InvitesTab({ onInvite, canManage, tenantId, inviterName }: {
  onInvite: () => void; canManage: boolean; tenantId: string; inviterName: string
}) {
  const [filter, setFilter] = useState<'pending' | 'expired' | 'all'>('pending')
  const [toast, setToast] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }
  function refresh() { setTick(t => t + 1) }
  void tick

  const all = getInvitesForTenant(tenantId)
  const visible = filter === 'all' ? all : all.filter(i => i.status === filter)

  const counts = {
    pending:  all.filter(i => i.status === 'pending').length,
    expired:  all.filter(i => i.status === 'expired').length,
    accepted: all.filter(i => i.status === 'accepted').length,
  }

  function handleResend(inv: Invite) {
    resendInvite(inv.id, inviterName)
    refresh()
    showToast(`Convite reenviado para ${inv.email} — expira em 7 dias.`)
  }

  function handleCancel(inv: Invite) {
    cancelInvite(inv.id, inviterName)
    refresh()
    showToast(`Convite de ${inv.name} cancelado.`)
  }

  function handleCopyLink(inv: Invite) {
    const fakeLink = `https://app.altech.io/convite/${inv.link_token}`
    navigator.clipboard.writeText(fakeLink).catch(() => {})
    showToast(`Link copiado: …/convite/${inv.link_token}`)
  }

  return (
    <div>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:10, padding:'11px 18px', color:T.text1, fontSize:13, boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(['pending','expired','all'] as const).map(f => {
            const label = f === 'pending' ? `Pendentes (${counts.pending})` : f === 'expired' ? `Expirados (${counts.expired})` : `Todos (${all.length})`
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight: filter===f ? 600 : 400,
                background: filter===f ? T.accentDim : 'transparent',
                color: filter===f ? T.accent : T.text2,
                border:`1px solid ${filter===f ? T.accentBorder : T.border}`,
              }}>{label}</button>
            )
          })}
        </div>
        {canManage && (
          <button onClick={onInvite} style={{
            padding:'7px 16px', borderRadius:8, fontSize:13, fontWeight:600,
            background:T.accent, color:'#fff', border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
            Convidar membro
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background:T.bgSurface, borderRadius:12, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {['Convidado','Função','Squad','Convidado por','Expira em','Status','Ações'].map(col => (
                <th key={col} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:T.text3, letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding:'32px 16px', textAlign:'center', color:T.text3, fontSize:13 }}>
                  Nenhum convite {filter === 'pending' ? 'pendente' : filter === 'expired' ? 'expirado' : ''} encontrado.
                </td>
              </tr>
            )}
            {visible.map((inv, i) => {
              const isLast = i === visible.length - 1
              const expiry = expiryLabel(inv.expires_at)
              const stMeta = INVITE_STATUS_META[inv.status]
              const isPending = inv.status === 'pending'
              const isExpired = inv.status === 'expired'
              const initials = inv.name.split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase()
              const hue = inv.email.charCodeAt(0) % 360
              return (
                <tr key={inv.id}
                  style={{ borderBottom:isLast?'none':`1px solid ${T.border}`, transition:'background 0.1s' }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLTableRowElement).style.background=`${T.text3}08`}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background='transparent'}}>

                  {/* Convidado */}
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:`hsl(${hue},55%,28%)`, border:`1px solid hsl(${hue},55%,38%)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:`hsl(${hue},80%,80%)`, flexShrink:0 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:T.text1 }}>{inv.name}</div>
                        <div style={{ fontSize:11, color:T.text3 }}>{inv.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Função */}
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:ROLE_COLORS[inv.role_context], background:`${ROLE_COLORS[inv.role_context]}18`, border:`1px solid ${ROLE_COLORS[inv.role_context]}33`, borderRadius:5, padding:'2px 8px' }}>
                      {ROLE_LABELS[inv.role_context]}
                    </span>
                  </td>

                  {/* Squad */}
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:12, color:T.text2 }}>{SQUAD_LABELS[inv.squad] ?? inv.squad}</span>
                  </td>

                  {/* Convidado por */}
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:12, color:T.text2 }}>{inv.invited_by}</span>
                  </td>

                  {/* Expira em */}
                  <td style={{ padding:'12px 16px' }}>
                    {inv.status === 'accepted' ? (
                      <span style={{ fontSize:12, color:T.text3 }}>—</span>
                    ) : (
                      <span style={{ fontSize:12, fontWeight:500, color:expiry.color }}>{expiry.text}</span>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:stMeta.color, background:stMeta.bg, border:`1px solid ${stMeta.color}33`, borderRadius:5, padding:'2px 8px' }}>
                      {stMeta.label}
                    </span>
                  </td>

                  {/* Ações */}
                  <td style={{ padding:'12px 16px' }}>
                    {!canManage ? (
                      <span style={{ fontSize:11, color:T.text3 }}>—</span>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {(isPending || isExpired) && (
                          <ActionBtn label="Reenviar" color={T.accent} onClick={() => handleResend(inv)}/>
                        )}
                        {isPending && (
                          <ActionBtn label="Copiar link" color={T.neutral} onClick={() => handleCopyLink(inv)}/>
                        )}
                        {isPending && (
                          <ActionBtn label="Cancelar" color={T.crit} onClick={() => handleCancel(inv)}/>
                        )}
                        {inv.status === 'accepted' && (
                          <span style={{ fontSize:11, color:T.text3 }}>—</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize:11, color:T.text3, marginTop:12 }}>
        Convites pendentes expiram em 7 dias. Apenas convites do tenant atual são exibidos.
      </p>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function TeamPage({ onInvite, initialTab }: { onInvite?: () => void; initialTab?: Tab }) {
  const { activeUser } = useSession()
  const canManage = can(activeUser.permissions, 'users:manage')
  const [tab, setTab] = useState<Tab>(initialTab ?? 'membros')
  const pendingCount = countPendingInvites(activeUser.tenant_id)

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  const tabContent = (manage: boolean) => (
    <div style={{ paddingTop:20 }}>
      {tab==='membros'    && <MembersTab onInvite={onInvite??(() =>{})} canManage={manage}/>}
      {tab==='convites'   && <InvitesTab onInvite={onInvite??(() =>{})} canManage={manage} tenantId={activeUser.tenant_id} inviterName={activeUser.name}/>}
      {tab==='permissoes' && (manage ? <PermissionsTab canManage={manage}/> : <PermissionDenied/>)}
      {tab==='dashboards' && (manage ? <DashboardsTab canManage={manage}/> : <PermissionDenied/>)}
    </div>
  )

  return (
    <div style={{ padding:'28px 32px', maxWidth:1280, margin:'0 auto' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:T.text1, margin:0, lineHeight:1.2 }}>Time &amp; Permissões</h1>
          <p style={{ fontSize:13, color:T.text2, margin:'6px 0 0' }}>
            Gerencie membros, papéis e permissões do tenant <strong style={{ color:T.text1 }}>Altech Agency</strong>.
          </p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
          <div style={{ padding:'8px 14px', borderRadius:10, background:T.bgSurface2, border:`1px solid ${T.border}`, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
            <span style={{ fontSize:10, color:T.text3, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Tenant</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.text1 }}>{MOCK_TENANT.name}</span>
            <span style={{ fontSize:10, color:T.text3 }}>{MOCK_TENANT.tenant_id}</span>
          </div>
          {!canManage && (
            <span style={{ fontSize:11, color:T.warn, background:T.warnDim, border:`1px solid ${T.warn}40`, borderRadius:6, padding:'3px 10px' }}>
              🔒 Somente leitura (sem users:manage)
            </span>
          )}
        </div>
      </div>

      <KpiStrip />

      <div style={{ background:T.bgSurface, borderRadius:14, border:`1px solid ${T.border}`, padding:'0 24px 24px' }}>
        <div style={{ padding:'16px 0 0' }}>
          <TabBar active={tab} onChange={setTab} pendingCount={pendingCount}/>
        </div>
        {tabContent(canManage)}
      </div>
    </div>
  )
}
