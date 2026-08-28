// Storage observability data layer — read-only aggregates from the
// v_tenant_storage / v_project_storage views plus tenant_settings.
import { supabase } from '@/integrations/supabase/client'
import { safeCall, logger } from '@/utils/logger'
import { writeAudit, writeAuditOnce } from '@/data/db/audit'
import { bytesToHuman } from '@/data/db/attachments'

export { bytesToHuman }

/** Ação técnica (fora da whitelist do card) usada só como marco-zero da cota. */
const QUOTA_BASELINE_ACTION = 'storage.quota_observed'

/**
 * Marco `storage.upgraded`: emitido apenas quando a cota efetiva do tenant
 * realmente cresce em relação à última cota registrada. Na primeira leitura
 * grava só uma linha-base técnica (invisível no card), nunca um marco falso.
 */
async function recordQuotaGrowth(
  tenantId: string, effectiveBytes: number, plan: string | null,
): Promise<void> {
  try {
    if (effectiveBytes <= 0) return
    const { data, error } = await supabase
      .from('audit_logs')
      .select('after')
      .eq('tenant_id', tenantId)
      .eq('entity_id', tenantId)
      .in('action', ['storage.upgraded', QUOTA_BASELINE_ACTION])
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error

    const prevRaw = (data ?? [])[0]?.after
    const prev = prevRaw && typeof prevRaw === 'object' && !Array.isArray(prevRaw)
      ? Number((prevRaw as Record<string, unknown>).effective_bytes ?? 0)
      : null

    if (prev === null) {
      await writeAudit(QUOTA_BASELINE_ACTION, tenantId, {
        name: 'Cota de armazenamento', effective_bytes: effectiveBytes, plan,
      }, { entityType: 'storage' })
      return
    }
    if (effectiveBytes > prev) {
      await writeAudit('storage.upgraded', tenantId, {
        name: 'Armazenamento do tenant',
        effective_bytes: effectiveBytes,
        previous_bytes: prev,
        plan,
      }, { entityType: 'storage' })
    }
  } catch (err) {
    logger.error('storage.recordQuotaGrowth', err, { tenantId })
  }
}


export interface TenantStorage {
  usedBytes: number
  fileCount: number
  quotaBytes: number
  extraBytes: number
  /** Effective quota = quota + extra. */
  effectiveBytes: number
  plan: string
}

export interface ProjectStorageRow {
  projectId: string
  key: string
  name: string
  status: string
  archivedAt: string | null
  createdAt: string
  createdByName: string | null
  usedBytes: number
  fileCount: number
}

export const EMPTY_TENANT_STORAGE: TenantStorage = {
  usedBytes: 0, fileCount: 0, quotaBytes: 0, extraBytes: 0, effectiveBytes: 0, plan: '—',
}

export async function fetchTenantStorage(tenantId: string): Promise<TenantStorage> {
  return safeCall('storage.fetchTenantStorage', async () => {
    const [usageRes, settingsRes] = await Promise.all([
      supabase.from('v_tenant_storage')
        .select('used_bytes, file_count')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase.from('tenant_settings')
        .select('storage_quota_bytes, extra_storage_bytes, storage_plan')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ])

    const usedBytes  = Number(usageRes.data?.used_bytes ?? 0)
    const fileCount  = Number(usageRes.data?.file_count ?? 0)
    const quotaBytes = Number(settingsRes.data?.storage_quota_bytes ?? 0)
    const extraBytes = Number(settingsRes.data?.extra_storage_bytes ?? 0)

    const effective = quotaBytes + extraBytes
    if (effective > 0 && usedBytes >= effective) {
      await writeAuditOnce('storage.full', tenantId, {
        name: 'Armazenamento do tenant', used_bytes: usedBytes, effective_bytes: effective,
      })
    }
    await recordQuotaGrowth(tenantId, effective, settingsRes.data?.storage_plan ?? null)


    return {
      usedBytes,
      fileCount,
      quotaBytes,
      extraBytes,
      effectiveBytes: quotaBytes + extraBytes,
      plan: settingsRes.data?.storage_plan ?? '—',
    }
  }, EMPTY_TENANT_STORAGE)
}

export async function fetchProjectStorageRows(tenantId: string): Promise<ProjectStorageRow[]> {
  return safeCall('storage.fetchProjectStorageRows', async () => {
    const [projRes, usageRes] = await Promise.all([
      supabase.from('projects')
        .select('id, key, name, status, archived_at, created_at, created_by')
        .eq('tenant_id', tenantId),
      supabase.from('v_project_storage')
        .select('project_id, used_bytes, file_count')
        .eq('tenant_id', tenantId),
    ])

    const projects = projRes.data ?? []
    if (projects.length === 0) return []

    const usageByProject = new Map<string, { used: number; files: number }>()
    for (const u of usageRes.data ?? []) {
      if (!u.project_id) continue
      usageByProject.set(u.project_id, {
        used:  Number(u.used_bytes ?? 0),
        files: Number(u.file_count ?? 0),
      })
    }

    const creatorIds = Array.from(new Set(projects.map(p => p.created_by).filter((v): v is string => !!v)))
    const nameById = new Map<string, string>()
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .in('id', creatorIds)
      for (const p of profiles ?? []) nameById.set(p.id, p.name ?? '')
    }

    return projects.map<ProjectStorageRow>(p => {
      const usage = usageByProject.get(p.id)
      return {
        projectId:     p.id,
        key:           p.key,
        name:          p.name,
        status:        p.status,
        archivedAt:    p.archived_at,
        createdAt:     p.created_at,
        createdByName: p.created_by ? (nameById.get(p.created_by) || null) : null,
        usedBytes:     usage?.used ?? 0,
        fileCount:     usage?.files ?? 0,
      }
    }).sort((a, b) => b.usedBytes - a.usedBytes)
  }, [])
}

// ─── Status buckets ───────────────────────────────────────────────────────────
export type StorageBucketId = 'active' | 'done' | 'paused'

export const STORAGE_BUCKET_LABEL: Record<StorageBucketId, string> = {
  active: 'Ativos',
  done:   'Finalizados',
  paused: 'Pausados / Arquivados',
}

const ACTIVE_STATUS = ['active', 'in_progress', 'planned', 'planning']
const DONE_STATUS   = ['completed', 'done']
const PAUSED_STATUS = ['on_hold', 'paused', 'cancelled']

export function bucketOf(row: ProjectStorageRow): StorageBucketId {
  const s = (row.status ?? '').toLowerCase()
  if (row.archivedAt || PAUSED_STATUS.includes(s)) return 'paused'
  if (DONE_STATUS.includes(s)) return 'done'
  if (ACTIVE_STATUS.includes(s)) return 'active'
  return 'active'
}

/** Percentage 0–100 of used vs effective quota (0 when quota unknown). */
export function usagePct(used: number, effective: number): number {
  if (!effective || effective <= 0) return 0
  return Math.min(100, Math.round((used / effective) * 100))
}

// ─── Role allowlist (temporary gate until a module capability exists) ────────
export const STORAGE_ROLES = ['Admin', 'ProjectManager', 'ProductOwner', 'TechLead', 'Dev'] as const

export function canViewStorage(role: string): boolean {
  return (STORAGE_ROLES as readonly string[]).includes(role)
}
