/* eslint-disable @typescript-eslint/no-explicit-any */
// Dashboard card assignments data access layer — persists which report cards a
// user pinned to which dashboard (Home mural / composition grid, Reports
// "Atribuir"). Tenant scoped, degrades to empty via safeCall, writes audit_logs.
import { supabase } from '../../integrations/supabase/client'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'
import { safeCall, logger } from '../../utils/logger'

export { DEFAULT_TENANT_ID }

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export type CardSlot = 'mural' | 'grid'

export interface AssignmentRow {
  id: string
  tenant_id: string
  user_id: string
  dashboard_key: string
  card_id: string
  card_title: string
  position: number
}

export interface AssignedCard {
  id: string
  dashboard: string
  slot: CardSlot
  cardId: string
  cardTitle: string
  position: number
}

/** `pmo` → mural, `pmo#grid` → composition grid. */
export function encodeKey(dashboard: string, slot: CardSlot): string {
  return slot === 'grid' ? `${dashboard}#grid` : dashboard
}
export function decodeKey(key: string): { dashboard: string; slot: CardSlot } {
  const [dashboard, suffix] = key.split('#')
  return { dashboard, slot: suffix === 'grid' ? 'grid' : 'mural' }
}

function daError(message: string): Error {
  return new Error(`[dashboard_assignments] ${message}`)
}

async function writeAudit(
  entityId: string, action: string, after: Record<string, unknown> | null,
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      tenant_id: getActiveTenantId(),
      entity_type: 'dashboard_assignment',
      entity_id: entityId,
      action,
      before: null,
      after: after as any,
    })
  } catch (err) {
    logger.error('dashboardAssignments.writeAudit', err, { entityId, action })
  }
}

function toCard(row: AssignmentRow): AssignedCard {
  const { dashboard, slot } = decodeKey(row.dashboard_key)
  return {
    id: row.id, dashboard, slot,
    cardId: row.card_id, cardTitle: row.card_title, position: row.position,
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────
async function getAssignedCards__raw(profileId: string, dashboard?: string): Promise<AssignedCard[]> {
  let q = tbl('dashboard_assignments').select('*')
    .eq('tenant_id', getActiveTenantId()).eq('user_id', profileId)
    .is('archived_at', null)
    .order('position', { ascending: true })
  if (dashboard) q = q.in('dashboard_key', [dashboard, `${dashboard}#grid`])
  const { data, error } = await q
  if (error) throw daError(error.message)
  return ((data ?? []) as AssignmentRow[]).map(toCard)
}

export function getAssignedCards(profileId: string, dashboard?: string): Promise<AssignedCard[]> {
  return safeCall('dashboardAssignments.getAssignedCards',
    () => getAssignedCards__raw(profileId, dashboard), [], { profileId, dashboard })
}

// ─── Writes ───────────────────────────────────────────────────────────────────
async function assign__raw(input: {
  profileId: string
  dashboard: string
  cardId: string
  cardTitle: string
  slot?: CardSlot
  position?: number
}): Promise<boolean> {
  const dashboard_key = encodeKey(input.dashboard, input.slot ?? 'mural')
  const { error } = await tbl('dashboard_assignments').upsert({
    tenant_id: getActiveTenantId(),
    user_id: input.profileId,
    dashboard_key,
    card_id: input.cardId,
    card_title: input.cardTitle,
    position: input.position ?? 0,
    archived_at: null,
  }, { onConflict: 'tenant_id,user_id,dashboard_key,card_id' })
  if (error) throw daError(error.message)
  await writeAudit(input.cardId, 'dashboard_assignment.assign', { dashboard_key, card_id: input.cardId })
  return true
}

export function assign(input: Parameters<typeof assign__raw>[0]): Promise<boolean> {
  return safeCall('dashboardAssignments.assign', () => assign__raw(input), false, { cardId: input.cardId })
}

async function remove__raw(
  profileId: string, dashboard: string, cardId: string, slot: CardSlot = 'mural',
): Promise<boolean> {
  const dashboard_key = encodeKey(dashboard, slot)
  const { error } = await tbl('dashboard_assignments').delete()
    .eq('tenant_id', getActiveTenantId()).eq('user_id', profileId)
    .eq('dashboard_key', dashboard_key).eq('card_id', cardId)
  if (error) throw daError(error.message)
  await writeAudit(cardId, 'dashboard_assignment.remove', { dashboard_key, card_id: cardId })
  return true
}

export function remove(
  profileId: string, dashboard: string, cardId: string, slot: CardSlot = 'mural',
): Promise<boolean> {
  return safeCall('dashboardAssignments.remove',
    () => remove__raw(profileId, dashboard, cardId, slot), false, { cardId, dashboard })
}

async function reorder__raw(
  profileId: string, dashboard: string, cardIds: string[], slot: CardSlot = 'mural',
): Promise<boolean> {
  const dashboard_key = encodeKey(dashboard, slot)
  for (let i = 0; i < cardIds.length; i++) {
    const { error } = await tbl('dashboard_assignments').update({ position: i })
      .eq('tenant_id', getActiveTenantId()).eq('user_id', profileId)
      .eq('dashboard_key', dashboard_key).eq('card_id', cardIds[i])
    if (error) throw daError(error.message)
  }
  await writeAudit(dashboard_key, 'dashboard_assignment.reorder', { order: cardIds })
  return true
}

export function reorder(
  profileId: string, dashboard: string, cardIds: string[], slot: CardSlot = 'mural',
): Promise<boolean> {
  return safeCall('dashboardAssignments.reorder',
    () => reorder__raw(profileId, dashboard, cardIds, slot), false, { dashboard })
}
