/* eslint-disable @typescript-eslint/no-explicit-any */
// Hours / Timesheet data access layer — real timesheets / timesheet_approvals /
// approver_squads rows from the connected Supabase project.
// Every read is scoped by tenant_id; every write records an audit_logs entry.
// The hours tables are not part of the generated Database types yet, so table
// access goes through a small untyped shim while rows stay strongly typed here.
import { supabase } from '../../integrations/supabase/client'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'
import { safeCall, logger } from '../../utils/logger'

export { DEFAULT_TENANT_ID }

type HoursTable = 'timesheets' | 'timesheet_approvals' | 'approver_squads'

function tbl(name: HoursTable): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

function anyTbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

function tenantError(table: string, message: string): Error {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return new Error(`A tabela "${table}" não existe no Supabase conectado. Rode supabase/sql/timesheets.sql antes de usar o módulo de Horas.`)
  }
  return new Error(message)
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface TimesheetRow {
  id: string
  tenant_id: string
  user_id: string
  project_id: string
  work_item_id: string | null
  date: string
  hours: number
  description: string | null
  status: TimesheetStatus
  month: string | null
  approver_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

/** A timesheet row enriched with the labels the screens render. */
export interface TimesheetEntry extends TimesheetRow {
  user_name: string
  user_initials: string
  project_name: string
  item_key: string | null
  item_title: string | null
  squad_id: string | null
  squad_name: string | null
  reject_reason: string | null
  approver_name: string | null
}

export interface DemandOption {
  work_item_id: string
  key: string
  title: string
  project_id: string
  project_name: string
  epic_name: string | null
  feature_name: string | null
  label: string
}

export interface ApproverOption {
  id: string
  name: string
  initials: string
}

export interface SquadOption {
  id: string
  name: string
}

// ─── Audit ────────────────────────────────────────────────────────────────────
type AuditPayload = Record<string, string | number | boolean | null>

async function writeAudit(
  entityType: string, entityId: string, action: string,
  actorName: string, before: AuditPayload | null, after: AuditPayload | null,
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      tenant_id: getActiveTenantId(),
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_name: actorName,
      before,
      after,
    })
  } catch (err) {
    logger.error('timesheets.writeAudit', err, { entityType, action })
  }
}

// ─── Shared lookups ───────────────────────────────────────────────────────────
interface ProfileLite { id: string; name: string; avatar_initials: string | null }

async function loadProfiles(): Promise<Map<string, ProfileLite>> {
  const { data, error } = await supabase.from('profiles')
    .select('id, name, avatar_initials').eq('tenant_id', getActiveTenantId())
  if (error) throw tenantError('profiles', error.message)
  return new Map((data ?? []).map(p => [p.id, p as ProfileLite]))
}

async function loadProjects(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('projects')
    .select('id, name').eq('tenant_id', getActiveTenantId())
  if (error) throw tenantError('projects', error.message)
  return new Map((data ?? []).map(p => [p.id, p.name]))
}

async function loadWorkItems(ids: string[]): Promise<Map<string, { key: string; title: string }>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('work_items')
    .select('id, key, title').eq('tenant_id', getActiveTenantId()).in('id', ids)
  if (error) throw tenantError('work_items', error.message)
  return new Map((data ?? []).map(w => [w.id, { key: w.key, title: w.title }]))
}

/** squad_id per profile (first squad membership wins). */
async function loadSquadByProfile(): Promise<{
  byProfile: Map<string, string>
  squads: Map<string, string>
}> {
  const [members, squads] = await Promise.all([
    supabase.from('squad_members').select('profile_id, squad_id').eq('tenant_id', getActiveTenantId()),
    supabase.from('squads').select('id, name').eq('tenant_id', getActiveTenantId()).is('archived_at', null),
  ])
  if (members.error) throw tenantError('squad_members', members.error.message)
  if (squads.error) throw tenantError('squads', squads.error.message)
  const byProfile = new Map<string, string>()
  for (const m of members.data ?? []) {
    if (!byProfile.has(m.profile_id)) byProfile.set(m.profile_id, m.squad_id)
  }
  return { byProfile, squads: new Map((squads.data ?? []).map(s => [s.id, s.name])) }
}

/** Latest decision reason per timesheet. */
async function loadDecisions(timesheetIds: string[]): Promise<Map<string, { decision: string; reason: string | null }>> {
  if (timesheetIds.length === 0) return new Map()
  const { data, error } = await tbl('timesheet_approvals')
    .select('timesheet_id, decision, reason, created_at')
    .eq('tenant_id', getActiveTenantId()).in('timesheet_id', timesheetIds)
    .order('created_at', { ascending: true })
  if (error) throw tenantError('timesheet_approvals', error.message)
  const out = new Map<string, { decision: string; reason: string | null }>()
  for (const r of (data ?? []) as any[]) out.set(r.timesheet_id, { decision: r.decision, reason: r.reason })
  return out
}

async function enrich(rows: TimesheetRow[]): Promise<TimesheetEntry[]> {
  const [profiles, projects, items, squadInfo, decisions] = await Promise.all([
    loadProfiles(),
    loadProjects(),
    loadWorkItems(rows.map(r => r.work_item_id).filter((x): x is string => !!x)),
    loadSquadByProfile(),
    loadDecisions(rows.map(r => r.id)),
  ])
  return rows.map(r => {
    const prof = profiles.get(r.user_id)
    const item = r.work_item_id ? items.get(r.work_item_id) ?? null : null
    const squadId = squadInfo.byProfile.get(r.user_id) ?? null
    const dec = decisions.get(r.id)
    return {
      ...r,
      hours: Number(r.hours),
      user_name: prof?.name ?? '—',
      user_initials: prof?.avatar_initials ?? (prof?.name ?? '—').slice(0, 2).toUpperCase(),
      project_name: projects.get(r.project_id) ?? '—',
      item_key: item?.key ?? null,
      item_title: item?.title ?? null,
      squad_id: squadId,
      squad_name: squadId ? squadInfo.squads.get(squadId) ?? null : null,
      reject_reason: dec && dec.decision === 'rejected' ? dec.reason : null,
      approver_name: r.approver_id ? profiles.get(r.approver_id)?.name ?? null : null,
    }
  })
}

/** Resolves the profile of the active session user by name (auth comes later). */
async function resolveProfileIdByName__raw(name: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles')
    .select('id').eq('tenant_id', getActiveTenantId()).eq('name', name).limit(1)
  if (error) throw tenantError('profiles', error.message)
  return data?.[0]?.id ?? null
}

// ─── TimesheetPage: demand search ─────────────────────────────────────────────
async function searchDemands__raw(query: string, limit = 12): Promise<DemandOption[]> {
  const [items, projects, epics, features] = await Promise.all([
    supabase.from('work_items')
      .select('id, key, title, project_id, epic_id, feature_id')
      .eq('tenant_id', getActiveTenantId()).is('archived_at', null)
      .order('updated_at', { ascending: false }).limit(400),
    supabase.from('projects').select('id, name').eq('tenant_id', getActiveTenantId()),
    supabase.from('epics').select('id, name').eq('tenant_id', getActiveTenantId()),
    supabase.from('features').select('id, name').eq('tenant_id', getActiveTenantId()),
  ])
  if (items.error) throw tenantError('work_items', items.error.message)
  if (projects.error) throw tenantError('projects', projects.error.message)

  const projectName = new Map((projects.data ?? []).map(p => [p.id, p.name]))
  const epicName = new Map((epics.data ?? []).map(e => [e.id, e.name]))
  const featureName = new Map((features.data ?? []).map(f => [f.id, f.name]))

  const q = query.trim().toLowerCase()
  const mapped: DemandOption[] = (items.data ?? []).map(w => ({
    work_item_id: w.id,
    key: w.key,
    title: w.title,
    project_id: w.project_id,
    project_name: projectName.get(w.project_id) ?? '—',
    epic_name: w.epic_id ? epicName.get(w.epic_id) ?? null : null,
    feature_name: w.feature_id ? featureName.get(w.feature_id) ?? null : null,
    label: `${w.key} · ${w.title}`,
  }))

  const filtered = q
    ? mapped.filter(m => `${m.key} ${m.title} ${m.project_name} ${m.epic_name ?? ''} ${m.feature_name ?? ''}`
        .toLowerCase().includes(q))
    : mapped
  return filtered.slice(0, limit)
}

// ─── TimesheetPage: entries ───────────────────────────────────────────────────
async function listMyEntries__raw(profileId: string, month?: string): Promise<TimesheetEntry[]> {
  let q = tbl('timesheets').select('*')
    .eq('tenant_id', getActiveTenantId()).eq('user_id', profileId).is('archived_at', null)
  if (month && month !== 'all') q = q.eq('month', month)
  const { data, error } = await q.order('date', { ascending: false })
  if (error) throw tenantError('timesheets', error.message)
  return enrich((data ?? []) as TimesheetRow[])
}

export interface CreateEntryInput {
  profileId: string
  projectId: string
  workItemId: string | null
  date: string
  hours: number
  description?: string
  actorName: string
}

async function createEntry__raw(input: CreateEntryInput): Promise<TimesheetRow | null> {
  const { data, error } = await tbl('timesheets').insert({
    tenant_id: getActiveTenantId(),
    user_id: input.profileId,
    project_id: input.projectId,
    work_item_id: input.workItemId,
    date: input.date,
    hours: input.hours,
    description: input.description ?? null,
    status: 'draft',
    month: input.date.slice(0, 7),
    metadata: {},
  }).select('*').single()
  if (error) throw tenantError('timesheets', error.message)
  const row = data as TimesheetRow
  await writeAudit('timesheet', row.id, 'hours.created', input.actorName, null,
    { project_id: row.project_id, work_item_id: row.work_item_id, date: row.date, hours: Number(row.hours) })
  return row
}

export interface UpdateEntryInput {
  date?: string
  hours?: number
  description?: string | null
  projectId?: string
  workItemId?: string | null
}

/** Editable only while the entry has not been approved. */
async function updateEntry__raw(id: string, patch: UpdateEntryInput, actorName: string): Promise<boolean> {
  const { data: current, error: readErr } = await tbl('timesheets')
    .select('*').eq('tenant_id', getActiveTenantId()).eq('id', id).single()
  if (readErr) throw tenantError('timesheets', readErr.message)
  const before = current as TimesheetRow
  if (before.status === 'approved') return false

  const payload: Record<string, unknown> = {}
  if (patch.date !== undefined) { payload.date = patch.date; payload.month = patch.date.slice(0, 7) }
  if (patch.hours !== undefined) payload.hours = patch.hours
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.projectId !== undefined) payload.project_id = patch.projectId
  if (patch.workItemId !== undefined) payload.work_item_id = patch.workItemId

  const { error } = await tbl('timesheets').update(payload)
    .eq('tenant_id', getActiveTenantId()).eq('id', id)
  if (error) throw tenantError('timesheets', error.message)
  await writeAudit('timesheet', id, 'hours.updated', actorName,
    { date: before.date, hours: Number(before.hours), description: before.description ?? null },
    { date: (payload.date as string) ?? before.date, hours: (payload.hours as number) ?? Number(before.hours) })
  return true
}

/** Deletable only while the entry has not been approved. */
async function deleteEntry__raw(id: string, actorName: string): Promise<boolean> {
  const { data: current, error: readErr } = await tbl('timesheets')
    .select('*').eq('tenant_id', getActiveTenantId()).eq('id', id).single()
  if (readErr) throw tenantError('timesheets', readErr.message)
  const before = current as TimesheetRow
  if (before.status === 'approved') return false

  const { error } = await tbl('timesheets').delete()
    .eq('tenant_id', getActiveTenantId()).eq('id', id)
  if (error) throw tenantError('timesheets', error.message)
  await writeAudit('timesheet', id, 'hours.deleted', actorName,
    { date: before.date, hours: Number(before.hours), project_id: before.project_id }, null)
  return true
}

/** Moves draft/rejected entries to `submitted` and assigns the chosen approver. */
async function submitForApproval__raw(
  ids: string[], approverId: string, actorName: string,
): Promise<number> {
  if (ids.length === 0) return 0
  const { data, error } = await tbl('timesheets')
    .update({ status: 'submitted', approver_id: approverId })
    .eq('tenant_id', getActiveTenantId()).in('id', ids).in('status', ['draft', 'rejected'])
    .select('id')
  if (error) throw tenantError('timesheets', error.message)
  const updated = (data ?? []) as { id: string }[]
  for (const r of updated) {
    await writeAudit('timesheet', r.id, 'hours.submitted', actorName,
      { status: 'draft' }, { status: 'submitted', approver_id: approverId })
  }
  return updated.length
}

/** Profiles that can approve hours: approver_squads members first, then leads. */
async function listApprovers__raw(): Promise<ApproverOption[]> {
  const profiles = await loadProfiles()

  const { data: confRows, error: confErr } = await tbl('approver_squads')
    .select('approver_id').eq('tenant_id', getActiveTenantId()).is('archived_at', null)
  if (confErr) throw tenantError('approver_squads', confErr.message)
  const ids = new Set<string>(((confRows ?? []) as any[]).map(r => r.approver_id))

  if (ids.size === 0) {
    const [userRoles, roles] = await Promise.all([
      anyTbl('user_roles').select('profile_id, role_id').eq('tenant_id', getActiveTenantId()),
      anyTbl('roles').select('id, key, tier'),
    ])
    const approverRoleIds = new Set(
      ((roles.data ?? []) as any[])
        .filter(r => (r.tier ?? 9) <= 3 || /admin|pmo|manager|lead|master/i.test(r.key ?? ''))
        .map(r => r.id),
    )
    for (const ur of (userRoles.data ?? []) as any[]) {
      if (approverRoleIds.has(ur.role_id)) ids.add(ur.profile_id)
    }
  }

  return [...ids]
    .map(id => profiles.get(id))
    .filter((p): p is ProfileLite => !!p)
    .map(p => ({ id: p.id, name: p.name, initials: p.avatar_initials ?? p.name.slice(0, 2).toUpperCase() }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── HoursApprovalPage ────────────────────────────────────────────────────────
async function listSquads__raw(): Promise<SquadOption[]> {
  const { data, error } = await supabase.from('squads')
    .select('id, name').eq('tenant_id', getActiveTenantId()).is('archived_at', null).order('name')
  if (error) throw tenantError('squads', error.message)
  return (data ?? []).map(s => ({ id: s.id, name: s.name }))
}

async function getApproverSquads__raw(approverId: string): Promise<string[]> {
  const { data, error } = await tbl('approver_squads')
    .select('squad_id').eq('tenant_id', getActiveTenantId())
    .eq('approver_id', approverId).is('archived_at', null)
  if (error) throw tenantError('approver_squads', error.message)
  return ((data ?? []) as any[]).map(r => r.squad_id as string)
}

async function setApproverSquads__raw(
  approverId: string, squadIds: string[], actorName: string,
): Promise<string[]> {
  const { error: delErr } = await tbl('approver_squads').delete()
    .eq('tenant_id', getActiveTenantId()).eq('approver_id', approverId)
  if (delErr) throw tenantError('approver_squads', delErr.message)

  if (squadIds.length > 0) {
    const { error } = await tbl('approver_squads').insert(
      squadIds.map(sid => ({ tenant_id: getActiveTenantId(), approver_id: approverId, squad_id: sid })),
    )
    if (error) throw tenantError('approver_squads', error.message)
  }
  await writeAudit('approver_squads', approverId, 'hours.approver_squads_set', actorName,
    null, { squads: squadIds.join(',') })
  return squadIds
}

export interface ApprovalQueue {
  squads: SquadOption[]
  entries: TimesheetEntry[]
}

/**
 * Entries visible to one approver: everything from the squads they approve
 * (approver_squads), plus entries explicitly routed to them.
 */
async function listPendingForApprover__raw(approverId: string): Promise<ApprovalQueue> {
  const squadIds = await getApproverSquads__raw(approverId)
  const allSquads = await listSquads__raw()

  let memberIds: string[] = []
  if (squadIds.length > 0) {
    const { data, error } = await supabase.from('squad_members')
      .select('profile_id').eq('tenant_id', getActiveTenantId()).in('squad_id', squadIds)
    if (error) throw tenantError('squad_members', error.message)
    memberIds = (data ?? []).map(m => m.profile_id)
  }

  const { data, error } = await tbl('timesheets').select('*')
    .eq('tenant_id', getActiveTenantId()).is('archived_at', null)
    .neq('status', 'draft')
    .order('date', { ascending: false })
  if (error) throw tenantError('timesheets', error.message)

  const rows = ((data ?? []) as TimesheetRow[]).filter(
    r => memberIds.includes(r.user_id) || r.approver_id === approverId,
  )
  return {
    squads: allSquads.filter(s => squadIds.includes(s.id)),
    entries: await enrich(rows),
  }
}

/** Approves or rejects one or many entries: decision row + status + audit. */
async function decideEntries__raw(
  ids: string[], decision: 'approved' | 'rejected',
  approverId: string | null, actorName: string, reason?: string,
): Promise<number> {
  if (ids.length === 0) return 0

  const { data, error } = await tbl('timesheets')
    .update({ status: decision, approver_id: approverId })
    .eq('tenant_id', getActiveTenantId()).in('id', ids).eq('status', 'submitted')
    .select('id')
  if (error) throw tenantError('timesheets', error.message)
  const updated = ((data ?? []) as { id: string }[]).map(r => r.id)
  if (updated.length === 0) return 0

  const { error: apprErr } = await tbl('timesheet_approvals').insert(
    updated.map(tid => ({
      tenant_id: getActiveTenantId(),
      timesheet_id: tid,
      approver_id: approverId,
      decision,
      reason: reason ?? null,
    })),
  )
  if (apprErr) throw tenantError('timesheet_approvals', apprErr.message)

  for (const tid of updated) {
    await writeAudit('timesheet', tid, `hours.${decision}`, actorName,
      { status: 'submitted' }, { status: decision, reason: reason ?? null })
  }
  return updated.length
}

// ─── Resilient public API ─────────────────────────────────────────────────────
// Every exported call degrades to a safe value on failure (missing table,
// network error, RLS): the UI renders an empty/error state instead of crashing.

export const resolveProfileIdByName = (name: string): Promise<string | null> =>
  safeCall('timesheets.resolveProfileIdByName', () => resolveProfileIdByName__raw(name), null, { name })

export const searchDemands = (query: string, limit?: number): Promise<DemandOption[]> =>
  safeCall('timesheets.searchDemands', () => searchDemands__raw(query, limit), [], { query })

export const listMyEntries = (profileId: string, month?: string): Promise<TimesheetEntry[]> =>
  safeCall('timesheets.listMyEntries', () => listMyEntries__raw(profileId, month), [], { profileId, month })

export const createEntry = (input: CreateEntryInput): Promise<TimesheetRow | null> =>
  safeCall('timesheets.createEntry', () => createEntry__raw(input), null, { projectId: input.projectId })

export const updateEntry = (id: string, patch: UpdateEntryInput, actorName: string): Promise<boolean> =>
  safeCall('timesheets.updateEntry', () => updateEntry__raw(id, patch, actorName), false, { id })

export const deleteEntry = (id: string, actorName: string): Promise<boolean> =>
  safeCall('timesheets.deleteEntry', () => deleteEntry__raw(id, actorName), false, { id })

export const submitForApproval = (ids: string[], approverId: string, actorName: string): Promise<number> =>
  safeCall('timesheets.submitForApproval', () => submitForApproval__raw(ids, approverId, actorName), 0, { count: ids.length })

export const listApprovers = (): Promise<ApproverOption[]> =>
  safeCall('timesheets.listApprovers', () => listApprovers__raw(), [])

export const listSquads = (): Promise<SquadOption[]> =>
  safeCall('timesheets.listSquads', () => listSquads__raw(), [])

export const getApproverSquads = (approverId: string): Promise<string[]> =>
  safeCall('timesheets.getApproverSquads', () => getApproverSquads__raw(approverId), [], { approverId })

export const setApproverSquads = (approverId: string, squadIds: string[], actorName: string): Promise<string[]> =>
  safeCall('timesheets.setApproverSquads', () => setApproverSquads__raw(approverId, squadIds, actorName), [], { approverId })

export const listPendingForApprover = (approverId: string): Promise<ApprovalQueue> =>
  safeCall('timesheets.listPendingForApprover', () => listPendingForApprover__raw(approverId),
    { squads: [], entries: [] }, { approverId })

export const approveEntries = (ids: string[], approverId: string | null, actorName: string): Promise<number> =>
  safeCall('timesheets.approveEntries', () => decideEntries__raw(ids, 'approved', approverId, actorName), 0, { count: ids.length })

export const rejectEntries = (ids: string[], approverId: string | null, actorName: string, reason: string): Promise<number> =>
  safeCall('timesheets.rejectEntries', () => decideEntries__raw(ids, 'rejected', approverId, actorName, reason), 0, { count: ids.length })
