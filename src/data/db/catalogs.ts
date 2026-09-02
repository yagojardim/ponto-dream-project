// Tenant-scoped creatable catalogs: bug environments and labels.
import { supabase } from '../../integrations/supabase/client'
import { getActiveTenantId } from '@/data/session'
import { logger } from '../../utils/logger'

export interface CatalogOption { id: string; name: string }

function norm(name: string) {
  return name.trim()
}

/** Bug environments defined by the tenant. */
export async function listBugEnvironments(): Promise<CatalogOption[]> {
  const { data, error } = await supabase
    .from('tenant_bug_environments')
    .select('id, name')
    .eq('tenant_id', getActiveTenantId())
    .order('name', { ascending: true })
  if (error) {
    logger.error('listBugEnvironments', error)
    return []
  }
  return data ?? []
}

/** Creates a bug environment, deduplicating case-insensitively. */
export async function createBugEnvironment(name: string): Promise<CatalogOption | null> {
  const value = norm(name)
  if (!value) return null

  const existing = await listBugEnvironments()
  const dup = existing.find(o => o.name.toLowerCase() === value.toLowerCase())
  if (dup) return dup

  const { data, error } = await supabase
    .from('tenant_bug_environments')
    .insert({ tenant_id: getActiveTenantId(), name: value })
    .select('id, name')
    .single()
  if (error) {
    logger.error('createBugEnvironment', error)
    return null
  }
  return data
}

/** Labels available in the tenant. */
export async function listTenantLabels(): Promise<CatalogOption[]> {
  const { data, error } = await supabase
    .from('labels')
    .select('id, name')
    .eq('tenant_id', getActiveTenantId())
    .order('name', { ascending: true })
  if (error) {
    logger.error('listTenantLabels', error)
    return []
  }
  return data ?? []
}

/** Creates a tenant label, deduplicating case-insensitively. */
export async function createTenantLabel(name: string): Promise<CatalogOption | null> {
  const value = norm(name)
  if (!value) return null

  const existing = await listTenantLabels()
  const dup = existing.find(o => o.name.toLowerCase() === value.toLowerCase())
  if (dup) return dup

  const { data, error } = await supabase
    .from('labels')
    .insert({ tenant_id: getActiveTenantId(), name: value })
    .select('id, name')
    .single()
  if (error) {
    logger.error('createTenantLabel', error)
    return null
  }
  return data
}
