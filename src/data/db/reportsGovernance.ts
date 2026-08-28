/* eslint-disable @typescript-eslint/no-explicit-any */
// Governança da tela "Relatórios e Insights".
//   • reports_access_roles   → papéis (além do Admin Master) que enxergam a tela
//   • released_report_cards  → cards liberados para o Board de Composição
// Persistido em tenant_settings.metadata (jsonb já existente) — sem migração.
import { useEffect, useState } from 'react'
import { supabase } from '../../integrations/supabase/client'
import { writeAudit as writeMilestone } from '@/data/db/audit'
import { DEFAULT_TENANT_ID } from './timeline'
import { safeCall } from '../../utils/logger'
import type { RoleContext } from '../session'

/** Papéis que o Admin Master pode liberar. */
export const REPORTS_OPTIONAL_ROLES: RoleContext[] = [
  'PMO', 'ProjectManager', 'ProductOwner', 'TechLead',
]

export const REPORTS_ROLE_LABEL: Record<string, string> = {
  PMO: 'PMO',
  ProjectManager: 'Project Manager',
  ProductOwner: 'Product Owner',
  TechLead: 'Tech Lead',
}

export interface ReportsGovernance {
  /** Papéis liberados (subconjunto de REPORTS_OPTIONAL_ROLES). */
  accessRoles: RoleContext[]
  /** Cards liberados para o Board de Composição. `null` ⇒ todos liberados. */
  releasedCards: string[] | null
}

const EMPTY: ReportsGovernance = { accessRoles: [], releasedCards: null }

let cache: ReportsGovernance | null = null
let inflight: Promise<ReportsGovernance> | null = null
const listeners = new Set<(g: ReportsGovernance) => void>()

function emit(g: ReportsGovernance) {
  cache = g
  listeners.forEach(l => l(g))
}

function parse(metadata: any): ReportsGovernance {
  const roles = Array.isArray(metadata?.reports_access_roles)
    ? (metadata.reports_access_roles as string[]).filter(r =>
        (REPORTS_OPTIONAL_ROLES as string[]).includes(r)) as RoleContext[]
    : []
  const cards = Array.isArray(metadata?.released_report_cards)
    ? (metadata.released_report_cards as string[])
    : null
  return { accessRoles: roles, releasedCards: cards }
}

export function fetchReportsGovernance(force = false): Promise<ReportsGovernance> {
  if (!force && cache) return Promise.resolve(cache)
  if (!force && inflight) return inflight
  inflight = safeCall<ReportsGovernance>('reportsGovernance.fetch', async () => {
    const { data, error } = await (supabase as any)
      .from('tenant_settings').select('metadata')
      .eq('tenant_id', DEFAULT_TENANT_ID).maybeSingle()
    if (error) throw error
    return parse(data?.metadata)
  }, EMPTY).then(g => { emit(g); inflight = null; return g })
  return inflight
}

export function saveReportsGovernance(patch: Partial<ReportsGovernance>): Promise<boolean> {
  return safeCall('reportsGovernance.save', async () => {
    const current = cache ?? await fetchReportsGovernance()
    const next: ReportsGovernance = {
      accessRoles: patch.accessRoles ?? current.accessRoles,
      releasedCards: patch.releasedCards !== undefined ? patch.releasedCards : current.releasedCards,
    }
    const { data } = await (supabase as any)
      .from('tenant_settings').select('metadata')
      .eq('tenant_id', DEFAULT_TENANT_ID).maybeSingle()
    const metadata = { ...(data?.metadata ?? {}) } as Record<string, unknown>
    metadata.reports_access_roles = next.accessRoles
    metadata.released_report_cards = next.releasedCards
    const { error } = await (supabase as any)
      .from('tenant_settings')
      .upsert({ tenant_id: DEFAULT_TENANT_ID, metadata }, { onConflict: 'tenant_id' })
    if (error) throw error
    emit(next)
    return true
  }, false)
}

/** Admin Master do tenant (owner) — permissions inclui '*'. */
export function isTenantOwner(permissions: string[] | undefined | null): boolean {
  return !!permissions?.includes('*')
}

// ── Acesso individual (profiles.reports_access) ──────────────────────────────
const accessCache = new Map<string, boolean>()

export function fetchProfileReportsAccess(profileId: string): Promise<boolean> {
  return safeCall<boolean>('reportsGovernance.fetchProfileAccess', async () => {
    const { data, error } = await (supabase as any)
      .from('profiles').select('reports_access')
      .eq('id', profileId).eq('tenant_id', DEFAULT_TENANT_ID).maybeSingle()
    if (error) throw error
    const val = !!data?.reports_access
    accessCache.set(profileId, val)
    return val
  }, accessCache.get(profileId) ?? false)
}

/** Grava profiles.reports_access (usado no cadastro/edição de membro). */
export function saveProfileReportsAccess(profileId: string, value: boolean): Promise<boolean> {
  return safeCall<boolean>('reportsGovernance.saveProfileAccess', async () => {
    const { error } = await (supabase as any)
      .from('profiles').update({ reports_access: value })
      .eq('id', profileId).eq('tenant_id', DEFAULT_TENANT_ID)
    if (error) throw error
    accessCache.set(profileId, value)
    await writeMilestone('user.updated', profileId, { reports_access: value })
    return true
  }, false)
}

/** Grava o flag localizando o profile pelo e-mail (fluxo de convite). */
export function saveProfileReportsAccessByEmail(email: string, value: boolean): Promise<boolean> {
  return safeCall<boolean>('reportsGovernance.saveProfileAccessByEmail', async () => {
    const { error } = await (supabase as any)
      .from('profiles').update({ reports_access: value })
      .eq('tenant_id', DEFAULT_TENANT_ID).ilike('email', email)
    if (error) throw error
    return true
  }, false)
}

/** Hook — flag individual do usuário informado. */
export function useProfileReportsAccess(profileId: string | null | undefined): boolean {
  const [allowed, setAllowed] = useState<boolean>(
    profileId ? accessCache.get(profileId) ?? false : false,
  )
  useEffect(() => {
    if (!profileId) { setAllowed(false); return }
    let alive = true
    void fetchProfileReportsAccess(profileId).then(v => { if (alive) setAllowed(v) })
    return () => { alive = false }
  }, [profileId])
  return allowed
}

/**
 * Acesso à tela "Relatórios e Insights":
 * Admin Master sempre; demais apenas com profiles.reports_access = true.
 */
export function canAccessReports(
  permissions: string[] | undefined | null,
  hasReportsAccess: boolean,
): boolean {
  return isTenantOwner(permissions) || hasReportsAccess
}

/** Papéis para os quais o toggle de acesso faz sentido no cadastro. */
export function roleSupportsReportsAccess(role: string): boolean {
  return (REPORTS_OPTIONAL_ROLES as string[]).includes(role)
}


/** Cards liberados para o Board de Composição. */
export function isCardReleased(gov: ReportsGovernance, cardId: string): boolean {
  return gov.releasedCards === null || gov.releasedCards.includes(cardId)
}

/** Hook reativo — carrega uma vez e re-renderiza a cada save. */
export function useReportsGovernance(): ReportsGovernance {
  const [gov, setGov] = useState<ReportsGovernance>(cache ?? EMPTY)
  useEffect(() => {
    listeners.add(setGov)
    void fetchReportsGovernance().then(setGov)
    return () => { listeners.delete(setGov) }
  }, [])
  return gov
}
