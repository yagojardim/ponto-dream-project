/* eslint-disable @typescript-eslint/no-explicit-any */
// Camada de dados REAL do fluxo "Convidar Membro".
// Tudo escopado por tenant_id — nunca cross-tenant.
import { supabase } from '../../integrations/supabase/client'
import { safeCall, logger } from '../../utils/logger'
import { writeAudit as writeMilestone } from './audit'
import { DEFAULT_TENANT_ID } from './timeline'
import { DEFAULT_DASHBOARD_BY_ROLE, type DashboardType, type RoleContext } from '../session'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export interface OptionRow { id: string; name: string }
export interface ModuleOption { key: string; name: string }

export interface InviteOptions {
  projects: OptionRow[]
  squads: OptionRow[]
  modules: ModuleOption[]
}

/** Projetos, squads e módulos habilitados do tenant (dados reais). */
export function fetchInviteOptions(): Promise<InviteOptions> {
  return safeCall<InviteOptions>('invite.fetchOptions', async () => {
    const [projRes, squadRes, modRes, tmRes] = await Promise.all([
      tbl('projects').select('id, name').eq('tenant_id', DEFAULT_TENANT_ID)
        .is('archived_at', null).order('name', { ascending: true }),
      tbl('squads').select('id, name').eq('tenant_id', DEFAULT_TENANT_ID)
        .is('archived_at', null).order('name', { ascending: true }),
      tbl('modules').select('id, key, name').is('archived_at', null)
        .order('display_order', { ascending: true }),
      tbl('tenant_modules').select('module_id, status').eq('tenant_id', DEFAULT_TENANT_ID)
        .is('archived_at', null),
    ])

    const ENABLED = new Set(['implemented', 'operational', 'active', 'preview', 'trial'])
    const enabledIds = new Set(
      ((tmRes.data ?? []) as any[])
        .filter(r => ENABLED.has(String(r.status ?? '').toLowerCase()))
        .map(r => r.module_id),
    )
    const allModules = ((modRes.data ?? []) as any[])
    const modules: ModuleOption[] = allModules
      .filter(m => enabledIds.size === 0 || enabledIds.has(m.id))
      .map(m => ({ key: m.key as string, name: (m.name as string) ?? m.key }))

    return {
      projects: ((projRes.data ?? []) as any[]).map(p => ({ id: p.id, name: p.name ?? '—' })),
      squads: ((squadRes.data ?? []) as any[]).map(s => ({ id: s.id, name: s.name ?? '—' })),
      modules,
    }
  }, { projects: [], squads: [], modules: [] })
}

// ─── Identidade: e-mail é único por tenant; nome pode repetir ────────────────
export interface IdentityCheck {
  /** Já existe profile com o mesmo e-mail no tenant → bloqueia. */
  emailTaken: boolean
  /** Homônimo com e-mail diferente → apenas avisa. */
  sameName: { name: string; email: string } | null
}

export function checkMemberIdentity(name: string, email: string): Promise<IdentityCheck> {
  return safeCall<IdentityCheck>('invite.checkIdentity', async () => {
    const mail = email.trim().toLowerCase()
    const nm = name.trim()
    const { data } = await tbl('profiles')
      .select('id, name, email')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .is('archived_at', null)
    const rows = (data ?? []) as any[]
    const emailTaken = rows.some(r => String(r.email ?? '').trim().toLowerCase() === mail)
    const hit = rows.find(r => String(r.name ?? '').trim().toLowerCase() === nm.toLowerCase()
      && String(r.email ?? '').trim().toLowerCase() !== mail)
    return {
      emailTaken,
      sameName: hit ? { name: hit.name ?? nm, email: hit.email ?? '' } : null,
    }
  }, { emailTaken: false, sameName: null })
}


// ─── Papéis ↔ dashboards ─────────────────────────────────────────────────────
export const ROLE_BY_DASHBOARD: Record<string, RoleContext> = Object.entries(DEFAULT_DASHBOARD_BY_ROLE)
  .reduce((acc, [role, dash]) => { acc[dash] = role as RoleContext; return acc }, {} as Record<string, RoleContext>)

const ROLE_KEYS: Record<RoleContext, string> = {
  Admin: 'admin', PMO: 'pmo', ProjectManager: 'project_manager',
  ProductManager: 'product_manager', ProductOwner: 'product_owner',
  ScrumMaster: 'scrum_master', TechLead: 'tech_lead', Dev: 'dev',
  UX: 'ux', QA: 'qa',
}

function normKey(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/[\s/-]+/g, '_')
}

export interface CreateMemberInput {
  name: string
  email: string
  phone?: string
  locale?: string
  avatarColor?: string
  avatarInitials?: string
  role: RoleContext
  /** Papéis de Início (o primeiro é o principal). */
  homeRoles: RoleContext[]
  dashboards: DashboardType[]
  defaultDashboard: DashboardType
  projectIds: string[]
  squadIds: string[]
  modules: string[]
  status: 'active' | 'invited'
  reportsAccess: boolean
  canCreateProjects: boolean
  canHandleClientMessages: boolean
}


/** Cria o profile real e todos os vínculos. Retorna o profiles.id. */
export function createMember(input: CreateMemberInput): Promise<string | null> {
  return safeCall<string | null>('invite.createMember', async () => {
    const homeRoles = [...new Set([input.role, ...input.homeRoles])]

    const { data: created, error } = await tbl('profiles').insert({
      tenant_id: DEFAULT_TENANT_ID,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      locale: input.locale || 'pt-BR',
      avatar_color: input.avatarColor ?? null,
      avatar_initials: input.avatarInitials ?? null,
      primary_role: ROLE_KEYS[input.role],
      status: input.status === 'active' ? 'active' : 'invited',
      reports_access: input.reportsAccess,
      can_create_projects: input.canCreateProjects,
      can_handle_client_messages: input.canHandleClientMessages,

      password_must_change: true,
      metadata: {
        home_roles: homeRoles,
        dashboards: input.dashboards,
        default_dashboard: input.defaultDashboard,
        modules_enabled: input.modules,
      },
    }).select('id').single()
    if (error) throw error

    const profileId = created?.id as string
    if (!profileId) return null

    // Vínculos de projeto
    if (input.projectIds.length) {
      const { error: pmErr } = await tbl('project_members').insert(
        input.projectIds.map(project_id => ({
          tenant_id: DEFAULT_TENANT_ID, project_id, profile_id: profileId, project_role: 'member',
        })),
      )
      if (pmErr) logger.error('invite.projectMembers', pmErr, { profileId })
    }

    // Vínculos de squad
    if (input.squadIds.length) {
      const { error: smErr } = await tbl('squad_members').insert(
        input.squadIds.map(squad_id => ({
          tenant_id: DEFAULT_TENANT_ID, squad_id, profile_id: profileId,
        })),
      )
      if (smErr) logger.error('invite.squadMembers', smErr, { profileId })
    }

    // Papéis (user_roles) — principal + secundários
    try {
      const { data: roleRows } = await tbl('roles').select('id, key, label')
      const byKey = new Map<string, string>()
      for (const r of (roleRows ?? []) as any[]) {
        byKey.set(normKey(r.key), r.id)
        byKey.set(normKey(r.label), r.id)
      }
      const payload = homeRoles
        .map((rc, i) => {
          const roleId = byKey.get(ROLE_KEYS[rc])
          return roleId
            ? { tenant_id: DEFAULT_TENANT_ID, profile_id: profileId, role_id: roleId, is_primary: i === 0 }
            : null
        })
        .filter(Boolean)
      if (payload.length) await tbl('user_roles').insert(payload)
    } catch (err) {
      logger.error('invite.userRoles', err, { profileId })
    }

    // Telas de Início (user_dashboards)
    try {
      const { data: dashRows } = await tbl('dashboards').select('id, key')
      const byDash = new Map<string, string>()
      for (const d of (dashRows ?? []) as any[]) byDash.set(normKey(d.key), d.id)
      const payload = input.dashboards
        .map(d => {
          const id = byDash.get(normKey(d))
          return id
            ? {
                tenant_id: DEFAULT_TENANT_ID, profile_id: profileId, dashboard_id: id,
                is_default: d === input.defaultDashboard, status: 'active',
              }
            : null
        })
        .filter(Boolean)
      if (payload.length) await tbl('user_dashboards').insert(payload)
    } catch (err) {
      logger.error('invite.userDashboards', err, { profileId })
    }

    try {
      await tbl('audit_logs').insert({
        tenant_id: DEFAULT_TENANT_ID,
        entity_type: 'profile',
        entity_id: profileId,
        action: 'profile.invited',
        actor_name: null,
        before: null,
        after: { email: input.email, role: input.role, home_roles: homeRoles },
      })
    } catch (err) {
      logger.error('invite.audit', err, { profileId })
    }

    // Marcos do tenant: criação do usuário e, quando for convite, o envio.
    await writeMilestone('user.created', profileId, {
      name: input.name, email: input.email, role: input.role,
    })
    if (input.status !== 'active') {
      await writeMilestone('invite.sent', profileId, { name: input.name, email: input.email })
    }

    return profileId
  }, null)
}

/** Lê os papéis de Início persistidos em profiles.metadata.home_roles. */
export function homeRolesFromMetadata(metadata: unknown): RoleContext[] {
  const raw = (metadata as any)?.home_roles
  if (!Array.isArray(raw)) return []
  const valid = new Set(Object.keys(ROLE_KEYS))
  return raw.filter((r): r is RoleContext => typeof r === 'string' && valid.has(r))
}
