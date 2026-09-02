/* eslint-disable @typescript-eslint/no-explicit-any */
// Members data access layer — lê os profiles do tenant, incluindo os campos de
// Admin Master (dono do tenant). Admin Master ≠ SUPER_ADMIN da Altech.
import { supabase } from '../../integrations/supabase/client'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'
import { safeCall, logger } from '../../utils/logger'
import { writeAudit as writeMilestone } from './audit'

export { DEFAULT_TENANT_ID }

export interface MemberRow {
  id: string
  name: string
  email: string
  status: string
  tenant_owner: boolean
  primary_role: string | null
  first_access_at: string | null
  last_access_at: string | null
}

export function getMembers(): Promise<MemberRow[]> {
  return safeCall<MemberRow[]>('members.getMembers', async () => {
    const { data, error } = await (supabase as unknown as { from: (t: string) => any })
      .from('profiles')
      .select('id, name, email, status, tenant_owner, primary_role, first_access_at, last_access_at')
      .eq('tenant_id', getActiveTenantId())
      .is('archived_at', null)
    if (error) throw error
    return (data ?? []).map((r: any): MemberRow => ({
      id: r.id,
      name: r.name ?? '',
      email: r.email ?? '',
      status: r.status ?? 'active',
      tenant_owner: !!r.tenant_owner,
      primary_role: r.primary_role ?? null,
      first_access_at: r.first_access_at ?? null,
      last_access_at: r.last_access_at ?? null,
    }))
  }, [])
}

/** E-mails (minúsculos) dos donos do tenant — usado para proteger o Admin Master na UI. */
export function getTenantOwnerEmails(): Promise<Set<string>> {
  return safeCall<Set<string>>('members.getTenantOwnerEmails', async () => {
    const members = await getMembers()
    return new Set(members.filter(m => m.tenant_owner).map(m => m.email.toLowerCase()))
  }, new Set<string>())
}

export type MemberStatus = 'active' | 'blocked' | 'inactive'

/** Atualiza profiles.status e registra o evento em audit_logs (tenant-scoped). */
export async function setMemberStatus(
  id: string, status: MemberStatus, actorName?: string,
): Promise<boolean> {
  return safeCall<boolean>('members.setMemberStatus', async () => {
    const t = (n: string) => (supabase as unknown as { from: (x: string) => any }).from(n)
    const { data: before } = await t('profiles')
      .select('status').eq('id', id).eq('tenant_id', getActiveTenantId()).maybeSingle()
    const { error } = await t('profiles')
      .update({ status })
      .eq('id', id).eq('tenant_id', getActiveTenantId())
    if (error) throw error
    try {
      await t('audit_logs').insert({
        tenant_id: getActiveTenantId(),
        entity_type: 'profile',
        entity_id: id,
        action: status === 'blocked' ? 'profile.blocked'
          : status === 'active' ? 'profile.unblocked' : 'profile.deactivated',
        actor_name: actorName ?? null,
        before: before ? { status: before.status } : null,
        after: { status },
      })
    } catch (err) {
      logger.error('members.setMemberStatus.audit', err, { id, status })
    }
    const milestone = status === 'blocked' ? 'user.suspended'
      : status === 'inactive' ? 'user.deactivated' : 'user.reactivated'
    const { data: who } = await t('profiles')
      .select('name, email').eq('id', id).eq('tenant_id', getActiveTenantId()).maybeSingle()
    await writeMilestone(milestone, id, {
      name: (who?.name ?? who?.email ?? null) as string | null,
      status,
    }, { actorName: actorName ?? null })
    return true
  }, false)
}
