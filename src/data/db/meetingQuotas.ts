/* eslint-disable @typescript-eslint/no-explicit-any */
// Meeting Intelligence — cota de horas por usuário + pool do workspace (Fase 2, casca).
// `used_minutes` só é preenchido pelo motor de transcrição (quando ligado); até lá
// fica 0 e a UI de cota permanece oculta por HOURS_QUOTA_ENABLED. RLS-off + tenant-cliente.
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'
import { getMembers } from '@/data/db/members'
import { quotaMinutesForRole } from '@/config/meetingFlags'
import { emitNotification } from '@/data/db/meetingNotifications'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export interface MeetingQuota {
  profileId: string
  name: string
  role: string | null
  quotaMinutes: number
  usedMinutes: number
  meetings: number
}

export interface MeetingPool {
  contractedMinutes: number
  extraMinutes: number
  usedMinutes: number
  renovaAt: string | null
}

/** Cota do próprio usuário (null se ainda não tem o módulo liberado por cota). */
export async function getMyQuota(profileId: string): Promise<MeetingQuota | null> {
  return safeCall('meetingQuotas.getMyQuota', async () => {
    const { data, error } = await tbl('meeting_quotas')
      .select('profile_id, role_context, quota_minutes, used_minutes')
      .eq('tenant_id', getActiveTenantId())
      .eq('profile_id', profileId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const member = (await getMembers()).find(m => m.id === profileId)
    return {
      profileId: data.profile_id,
      name: member?.name ?? '—',
      role: data.role_context ?? member?.primary_role ?? null,
      quotaMinutes: data.quota_minutes ?? 0,
      usedMinutes: data.used_minutes ?? 0,
      meetings: 0,
    }
  }, null)
}

/** Todas as cotas do tenant (para a tabela da Gestão do módulo). */
export async function listTenantQuotas(): Promise<MeetingQuota[]> {
  return safeCall('meetingQuotas.listTenantQuotas', async () => {
    const { data, error } = await tbl('meeting_quotas')
      .select('profile_id, role_context, quota_minutes, used_minutes')
      .eq('tenant_id', getActiveTenantId())
    if (error) throw error
    const members = new Map((await getMembers()).map(m => [m.id, m]))
    return ((data ?? []) as any[]).map((r): MeetingQuota => {
      const m = members.get(r.profile_id)
      return {
        profileId: r.profile_id,
        name: m?.name ?? '—',
        role: r.role_context ?? m?.primary_role ?? null,
        quotaMinutes: r.quota_minutes ?? 0,
        usedMinutes: r.used_minutes ?? 0,
        meetings: 0,
      }
    })
  }, [])
}

/** Ajusta a cota (em minutos) de um usuário — admin, na tabela de cotas. */
export async function adjustQuota(profileId: string, quotaMinutes: number): Promise<boolean> {
  return safeCall('meetingQuotas.adjustQuota', async () => {
    const { error } = await tbl('meeting_quotas')
      .update({ quota_minutes: Math.max(0, Math.round(quotaMinutes)), updated_at: new Date().toISOString() })
      .eq('tenant_id', getActiveTenantId())
      .eq('profile_id', profileId)
    if (error) throw error
    return true
  }, false)
}

/**
 * Libera o módulo para usuários existentes (cria a linha de cota com a cota padrão
 * do cargo) e os notifica. `profiles` = [{id, role}].
 */
export async function grantModuleAccess(profiles: { id: string; role: string | null }[]): Promise<number> {
  return safeCall('meetingQuotas.grantModuleAccess', async () => {
    if (profiles.length === 0) return 0
    const rows = profiles.map(p => ({
      tenant_id: getActiveTenantId(),
      profile_id: p.id,
      role_context: p.role,
      quota_minutes: quotaMinutesForRole(p.role),
      used_minutes: 0,
    }))
    const { error } = await tbl('meeting_quotas').upsert(rows, { onConflict: 'tenant_id,profile_id' })
    if (error) throw error
    for (const p of profiles) {
      await emitNotification({
        recipientId: p.id,
        kind: 'module',
        body: `Seu acesso ao Meeting Intelligence foi liberado — cota de ${quotaMinutesForRole(p.role)} min/mês.`,
      })
    }
    return profiles.length
  }, 0)
}

/** Pool de horas do workspace (KPIs da Gestão). Agrega consumo das cotas. */
export async function getPool(): Promise<MeetingPool> {
  return safeCall('meetingQuotas.getPool', async () => {
    const [{ data: pool }, quotas] = await Promise.all([
      tbl('tenant_meeting_pool')
        .select('contracted_minutes, extra_minutes, renova_at')
        .eq('tenant_id', getActiveTenantId())
        .maybeSingle(),
      listTenantQuotas(),
    ])
    const usedMinutes = quotas.reduce((a, q) => a + q.usedMinutes, 0)
    return {
      contractedMinutes: pool?.contracted_minutes ?? 0,
      extraMinutes: pool?.extra_minutes ?? 0,
      usedMinutes,
      renovaAt: pool?.renova_at ?? null,
    }
  }, { contractedMinutes: 0, extraMinutes: 0, usedMinutes: 0, renovaAt: null })
}
