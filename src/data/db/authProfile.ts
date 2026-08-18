/* eslint-disable @typescript-eslint/no-explicit-any */
// Ponte auth ↔ profiles: resolve o usuário ativo real a partir da sessão do Supabase Auth.
// Tudo escopado por tenant_id do próprio profile — nunca cross-tenant.
import { supabase } from '../../integrations/supabase/client'
import { safeCall, logger } from '../../utils/logger'
import { derivePermissions } from '../permissions'
import type { MockUser, RoleContext, UserDashboard, DashboardType } from '../session'
import { homeRolesFromMetadata } from './invite'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

const ROLE_ALIASES: Record<string, RoleContext> = {
  admin: 'Admin', admin_master: 'Admin', administrador: 'Admin',
  pmo: 'PMO',
  project_manager: 'ProjectManager', projectmanager: 'ProjectManager', pm: 'ProjectManager',
  product_manager: 'ProductManager', productmanager: 'ProductManager',
  product_owner: 'ProductOwner', productowner: 'ProductOwner', po: 'ProductOwner',
  scrum_master: 'ScrumMaster', scrummaster: 'ScrumMaster', sm: 'ScrumMaster',
  tech_lead: 'TechLead', techlead: 'TechLead', tl: 'TechLead',
  dev: 'Dev', developer: 'Dev',
  ux: 'UX', 'ux/ui': 'UX', design: 'UX',
  qa: 'QA', quality: 'QA',
}

function normalizeRole(raw: string | null | undefined): RoleContext {
  if (!raw) return 'Dev'
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return ROLE_ALIASES[key] ?? ROLE_ALIASES[key.replace(/_/g, '')] ?? 'Dev'
}

const ROLE_DASHBOARD: Record<RoleContext, DashboardType> = {
  Admin: 'admin', PMO: 'pmo', ProjectManager: 'project-manager',
  ProductManager: 'product-manager', ProductOwner: 'product-owner',
  ScrumMaster: 'scrum-master', TechLead: 'tech-lead', Dev: 'dev',
  UX: 'ux', QA: 'qa',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

function dash(userId: string, tenantId: string, id: DashboardType, isDefault: boolean): UserDashboard {
  const now = new Date().toISOString()
  return {
    id: `${userId}_${id}`, tenant_id: tenantId, user_id: userId, dashboard_id: id,
    is_default: isDefault, status: 'active',
    created_at: now, created_by: 'system', updated_at: now, updated_by: 'system',
  }
}

/** Todos os papéis do profile (principal primeiro, depois secundários). */
async function resolveRoles(
  profileId: string, tenantId: string, fallback: string | null, metadata?: unknown,
): Promise<RoleContext[]> {
  const primary = fallback ? normalizeRole(fallback) : null
  const found: RoleContext[] = [...homeRolesFromMetadata(metadata)]
  try {
    const { data: urs } = await tbl('user_roles')
      .select('role_id').eq('profile_id', profileId).eq('tenant_id', tenantId)
    const roleIds = (urs ?? []).map((r: any) => r.role_id).filter(Boolean)
    if (roleIds.length) {
      const { data: roles } = await tbl('roles').select('id, key, label').in('id', roleIds)
      for (const r of roles ?? []) {
        const rc = normalizeRole(r.key ?? r.label)
        if (rc && !found.includes(rc)) found.push(rc)
      }
    }
  } catch (err) {
    logger.error('authProfile.resolveRoles', err, { profileId })
  }
  const ordered = primary
    ? [primary, ...found.filter(r => r !== primary)]
    : (found.length ? found : [normalizeRole(fallback)])
  return ordered
}

/** Carrega o profile ligado à sessão do Supabase Auth e monta o usuário ativo. */
export function loadProfileByAuthUserId(authUserId: string, email: string): Promise<MockUser | null> {
  return safeCall<MockUser | null>('authProfile.load', async () => {
    let row: any = null
    const byAuth = await tbl('profiles')
      .select('id, tenant_id, name, email, status, primary_role, tenant_owner, can_create_projects, password_must_change, metadata')
      .eq('auth_user_id', authUserId).limit(1)
    row = (byAuth.data ?? [])[0] ?? null

    // Fallback por e-mail (profiles ainda não vinculados) — vincula na primeira entrada.
    if (!row && email) {
      const byEmail = await tbl('profiles')
        .select('id, tenant_id, name, email, status, primary_role, tenant_owner, can_create_projects, password_must_change, metadata')
        .ilike('email', email).limit(1)
      row = (byEmail.data ?? [])[0] ?? null
      if (row) {
        try { await tbl('profiles').update({ auth_user_id: authUserId }).eq('id', row.id) } catch { /* noop */ }
      }
    }

    if (!row) return null

    const roles = await resolveRoles(row.id, row.tenant_id, row.primary_role, row.metadata)
    const roleContext: RoleContext = roles[0] ?? 'Dev'
    const isAdmin = roleContext === 'Admin'
    const isOwner = !!row.tenant_owner
    const defaultDash = ROLE_DASHBOARD[roleContext]

    return {
      user_id: row.id,
      tenant_id: row.tenant_id,
      name: row.name ?? row.email,
      email: (row.email ?? '').toLowerCase(),
      avatar_initials: initials(row.name ?? row.email ?? ''),
      avatar_color: '#7d92ff',
      role_context: roleContext,
      project_id: '*',
      squad_id: '*',
      modules_enabled: ['board', 'reports', 'portfolio', 'roadmap', 'config', 'team', 'modules'],
      permissions: isAdmin
        ? ['*']
        : (() => {
            const perms = derivePermissions(roleContext)
            if (row.can_create_projects && !perms.includes('project:create')) perms.push('project:create')
            return perms
          })(),
      assigned_dashboards: [dash(row.id, row.tenant_id, defaultDash, true)],
      password_must_change: !!row.password_must_change,
      tenant_owner: isOwner,
      available_roles: roles,
    }
  }, null)
}

/** audit_logs para eventos de login. Nunca inclui senha. */
export async function writeLoginAudit(
  action: 'login_success' | 'login_failed' | 'logout',
  opts: { tenantId?: string | null; profileId?: string | null; email: string; reason?: string },
): Promise<void> {
  try {
    await tbl('audit_logs').insert({
      tenant_id: opts.tenantId ?? null,
      entity_type: 'auth',
      entity_id: opts.profileId ?? null,
      action,
      actor_name: opts.email,
      before: null,
      after: { email: opts.email, reason: opts.reason ?? null },
    })
  } catch (err) {
    logger.error('authProfile.writeLoginAudit', err, { action })
  }
}

/** Marca acesso do profile (first_access_at na primeira vez, last_access_at sempre). */
export async function touchAccess(profileId: string, tenantId: string, firstAccessAt: string | null): Promise<void> {
  try {
    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { last_access_at: now }
    if (!firstAccessAt) patch.first_access_at = now
    await tbl('profiles').update(patch).eq('id', profileId).eq('tenant_id', tenantId)
  } catch (err) {
    logger.error('authProfile.touchAccess', err, { profileId })
  }
}
