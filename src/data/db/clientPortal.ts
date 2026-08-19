/* eslint-disable @typescript-eslint/no-explicit-any */
// Client Portal data access layer — real client_portal_users / client_signals /
// client_approvals / shared_project_items from the connected Supabase project.
// Every read is scoped by tenant_id (+ project_id); every write records audit_logs.
// The portal tables are not part of the generated Database types yet, so table
// access goes through a small untyped shim while the rows stay strongly typed here.
import { supabase } from '../../integrations/supabase/client'
import { DEFAULT_TENANT_ID } from './timeline'
import { sortSprintsByStartDate } from './sprints'
import { safeCall, logger } from '../../utils/logger'

export { DEFAULT_TENANT_ID }

type PortalTable =
  | 'client_portal_users'
  | 'client_signals'
  | 'client_approvals'
  | 'shared_project_items'
  | 'project_client_responsibles'
  | 'project_members'
  | 'profiles'

function tbl(name: PortalTable): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

// ─── Row types ────────────────────────────────────────────────────────────────
export type PortalRole = 'viewer' | 'portal-admin'
export type SignalType = 'comment' | 'approval'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'

export interface ClientPortalUserRow {
  id: string
  tenant_id: string
  project_id: string
  name: string
  email: string
  portal_role: PortalRole
  can_approve: boolean
  can_preview: boolean
  can_comment: boolean
  password_must_change: boolean
  status: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ClientSignalRow {
  id: string
  tenant_id: string
  project_id: string
  type: SignalType
  item_id: string | null
  item_title: string | null
  author: string | null
  responsible_po: string | null
  body: string | null
  po_reply: string | null
  read_by_po: boolean
  reply_read_by_client: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ClientApprovalRow {
  id: string
  tenant_id: string
  project_id: string
  work_item_id: string
  client_user_id: string | null
  status: ApprovalStatus
  decided_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface SharedProjectItemRow {
  id: string
  tenant_id: string
  project_id: string
  shared_entity_type: string
  shared_entity_id: string
  visibility: 'internal' | 'client' | 'public'
}

// ─── Client-safe portal scope ────────────────────────────────────────────────
export interface PortalProject {
  id: string
  name: string
  status: string
  period_start: string | null
  period_end: string | null
}
/** Client-safe delivery: no assignee, no estimates, no internal description. */
export interface PortalDelivery {
  id: string
  title: string
  status: 'done' | 'review' | 'progress'
  due_date: string | null
  completed_at: string | null
}
export interface PortalSprint {
  id: string
  name: string
  state: string
  start_date: string | null
  end_date: string | null
}
export interface PortalRoadmapItem {
  id: string
  name: string
  quarter: string | null
  color: string | null
  total: number
  done: number
}
export interface ClientPortalScope {
  project: PortalProject | null
  sprints: PortalSprint[]
  deliveries: PortalDelivery[]
  roadmap: PortalRoadmapItem[]
}

const DONE_STATUSES = ['done', 'closed', 'released', 'concluido', 'concluído']
const REVIEW_STATUSES = ['review', 'in_review', 'validation', 'qa', 'testing']

function clientStatus(status: string | null): PortalDelivery['status'] {
  const s = (status ?? '').toLowerCase()
  if (DONE_STATUSES.some(d => s.includes(d))) return 'done'
  if (REVIEW_STATUSES.some(d => s.includes(d))) return 'review'
  return 'progress'
}

function tenantError(table: string, message: string): Error {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return new Error(
      `A tabela "${table}" não existe no Supabase conectado. Rode supabase/sql/client_portal.sql antes de usar o Portal do Cliente.`,
    )
  }
  return new Error(message)
}

/** Projects of the tenant (used to resolve project names ↔ ids). */
async function listPortalProjects__raw(): Promise<PortalProject[]> {
  const { data, error } = await supabase.from('projects')
    .select('id, name, status, period_start, period_end')
    .eq('tenant_id', DEFAULT_TENANT_ID).is('archived_at', null).order('name')
  if (error) throw tenantError('projects', error.message)
  return (data ?? []) as PortalProject[]
}

/**
 * Client-safe scope of a project: sprints, shareable deliveries and roadmap.
 * Only items explicitly shared (shared_project_items) or with client visibility
 * are returned — raw internal work items, PRs and infra never leave the tenant.
 */
async function getClientPortal__raw(projectId: string): Promise<ClientPortalScope> {
  const tid = DEFAULT_TENANT_ID
  const [projectRes, sprintsRes, sharedRes, epicsRes, itemsRes] = await Promise.all([
    supabase.from('projects').select('id, name, status, period_start, period_end')
      .eq('tenant_id', tid).eq('id', projectId).maybeSingle(),
    supabase.from('sprints').select('id, name, state, start_date, end_date')
      .eq('tenant_id', tid).eq('project_id', projectId).is('archived_at', null)
      .order('start_date', { ascending: true, nullsFirst: false }),
    tbl('shared_project_items').select('id, shared_entity_type, shared_entity_id, visibility')
      .eq('tenant_id', tid).eq('project_id', projectId).is('archived_at', null),
    supabase.from('epics').select('id, name, quarter, color')
      .eq('tenant_id', tid).eq('project_id', projectId).is('archived_at', null).order('key'),
    supabase.from('work_items')
      .select('id, title, status, due_date, completed_at, visibility, epic_id')
      .eq('tenant_id', tid).eq('project_id', projectId).is('archived_at', null),
  ])

  if (projectRes.error) throw tenantError('projects', projectRes.error.message)
  if (sprintsRes.error) throw tenantError('sprints', sprintsRes.error.message)
  if (sharedRes.error) throw tenantError('shared_project_items', sharedRes.error.message)
  if (epicsRes.error) throw tenantError('epics', epicsRes.error.message)
  if (itemsRes.error) throw tenantError('work_items', itemsRes.error.message)

  const shared = (sharedRes.data ?? []) as SharedProjectItemRow[]
  const sharedItemIds = new Set(
    shared.filter(s => s.shared_entity_type === 'work_item' && s.visibility !== 'internal')
      .map(s => s.shared_entity_id),
  )
  const items = (itemsRes.data ?? []) as {
    id: string; title: string; status: string | null; due_date: string | null
    completed_at: string | null; visibility: string | null; epic_id: string | null
  }[]

  const clientVisible = items.filter(
    i => sharedItemIds.has(i.id) || (i.visibility ?? '').toLowerCase() === 'client',
  )

  const roadmap: PortalRoadmapItem[] = (epicsRes.data ?? []).map(e => {
    const epicItems = items.filter(i => i.epic_id === e.id)
    return {
      id: e.id, name: e.name, quarter: e.quarter, color: e.color,
      total: epicItems.length,
      done: epicItems.filter(i => clientStatus(i.status) === 'done').length,
    }
  })

  return {
    project: (projectRes.data ?? null) as PortalProject | null,
    sprints: ((sprintsRes.data ?? []) as PortalSprint[]).slice().sort(sortSprintsByStartDate),
    deliveries: clientVisible.map(i => ({
      id: i.id,
      title: i.title,
      status: clientStatus(i.status),
      due_date: i.due_date,
      completed_at: i.completed_at,
    })),
    roadmap,
  }
}

// ─── Audit ────────────────────────────────────────────────────────────────────
type AuditPayload = Record<string, string | number | boolean | null>

async function writeAudit(
  entityType: string, entityId: string, action: string,
  actorName: string, before: AuditPayload | null, after: AuditPayload | null,
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_name: actorName,
      before,
      after,
    })
  } catch (err) {
    logger.error('clientPortal.writeAudit', err, { entityType, action })
  }
}

// ─── Signals ──────────────────────────────────────────────────────────────────
async function listClientSignals__raw(projectId?: string): Promise<ClientSignalRow[]> {
  let q = tbl('client_signals').select('*')
    .eq('tenant_id', DEFAULT_TENANT_ID).is('archived_at', null)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q.order('created_at', { ascending: true })
  if (error) throw tenantError('client_signals', error.message)
  return (data ?? []) as ClientSignalRow[]
}

async function listClientSignalsForPo__raw(poId: string): Promise<ClientSignalRow[]> {
  const { data, error } = await tbl('client_signals').select('*')
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('responsible_po', poId)
    .is('archived_at', null).order('created_at', { ascending: false })
  if (error) throw tenantError('client_signals', error.message)
  return (data ?? []) as ClientSignalRow[]
}

export interface AddCommentInput {
  projectId: string
  body: string
  author: string
  itemId?: string | null
  itemTitle?: string | null
  responsiblePo?: string | null
  /** management-originated messages are pre-read by the PO */
  source?: 'client' | 'management'
  /** profile ids mentioned via @ in the body */
  mentions?: string[]
}

async function addClientComment__raw(input: AddCommentInput): Promise<ClientSignalRow> {
  const isMgmt = input.source === 'management'
  const { data, error } = await tbl('client_signals').insert({
    tenant_id: DEFAULT_TENANT_ID,
    project_id: input.projectId,
    type: 'comment',
    item_id: input.itemId ?? null,
    item_title: input.itemTitle ?? null,
    author: input.author,
    responsible_po: input.responsiblePo ?? null,
    body: input.body,
    read_by_po: isMgmt,
    reply_read_by_client: !isMgmt,
    metadata: {
      source: input.source ?? 'client',
      mentions: [...new Set((input.mentions ?? []).filter(Boolean))],
    },
  }).select('*').single()
  if (error) throw tenantError('client_signals', error.message)
  const row = data as ClientSignalRow
  await writeAudit('client_signal', row.id, isMgmt ? 'portal.message_sent' : 'portal.comment_created',
    input.author, null, { project_id: input.projectId, body: input.body })
  return row
}

export interface AddApprovalInput {
  projectId: string
  workItemId?: string | null
  itemTitle: string
  author: string
  clientUserId?: string | null
  responsiblePo?: string | null
}

/** Records a formal approval (client_approvals) plus its signal (type=approval). */
async function addClientApproval__raw(input: AddApprovalInput): Promise<ClientSignalRow> {
  if (input.workItemId) {
    const { data: appr, error: apprErr } = await tbl('client_approvals').insert({
      tenant_id: DEFAULT_TENANT_ID,
      project_id: input.projectId,
      work_item_id: input.workItemId,
      client_user_id: input.clientUserId ?? null,
      status: 'approved',
      decided_at: new Date().toISOString(),
      metadata: { item_title: input.itemTitle, author: input.author },
    }).select('id').single()
    if (apprErr) throw tenantError('client_approvals', apprErr.message)
    await writeAudit('client_approval', (appr as { id: string }).id, 'portal.approved',
      input.author, null, { project_id: input.projectId, work_item_id: input.workItemId })
  }

  const { data, error } = await tbl('client_signals').insert({
    tenant_id: DEFAULT_TENANT_ID,
    project_id: input.projectId,
    type: 'approval',
    item_id: input.workItemId ?? null,
    item_title: input.itemTitle,
    author: input.author,
    responsible_po: input.responsiblePo ?? null,
    read_by_po: false,
    reply_read_by_client: true,
    metadata: { source: 'client' },
  }).select('*').single()
  if (error) throw tenantError('client_signals', error.message)
  return data as ClientSignalRow
}

/** Public reply from management — marks the signal read and notifies the client. */
async function addPoReply__raw(signalId: string, reply: string, poName: string): Promise<void> {
  const { data, error } = await tbl('client_signals')
    .update({
      po_reply: reply,
      read_by_po: true,
      reply_read_by_client: false,
      metadata: { po_reply_by: poName },
    })
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('id', signalId)
    .select('id, project_id').single()
  if (error) throw tenantError('client_signals', error.message)
  const row = data as { id: string; project_id: string }
  await writeAudit('client_signal', row.id, 'portal.po_replied', poName, null,
    { project_id: row.project_id, reply })
}

async function markSignalReadByPo__raw(signalId: string): Promise<void> {
  await tbl('client_signals').update({ read_by_po: true })
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('id', signalId)
}

async function markProjectReadByPo__raw(projectId: string): Promise<void> {
  await tbl('client_signals').update({ read_by_po: true })
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('project_id', projectId).eq('read_by_po', false)
}

async function markReplyReadByClient__raw(signalId: string): Promise<void> {
  await tbl('client_signals').update({ reply_read_by_client: true })
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('id', signalId)
}

async function markAllRepliesReadByClient__raw(author: string): Promise<void> {
  await tbl('client_signals').update({ reply_read_by_client: true })
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('author', author).eq('reply_read_by_client', false)
}

// ─── Portal users / permissions ───────────────────────────────────────────────
async function listClientPortalUsers__raw(projectId?: string): Promise<ClientPortalUserRow[]> {
  let q = tbl('client_portal_users').select('*')
    .eq('tenant_id', DEFAULT_TENANT_ID).is('archived_at', null)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw tenantError('client_portal_users', error.message)
  return (data ?? []) as ClientPortalUserRow[]
}

export interface CreatePortalUserInput {
  projectIds: string[]
  name: string
  email: string
  portalRole: PortalRole
  canApprove: boolean
  canPreview: boolean
  canComment?: boolean
  tempPassword?: string
  actorName?: string
}

/** Creates one client_portal_users row per shared project. */
async function createClientPortalUsers__raw(
  input: CreatePortalUserInput,
): Promise<ClientPortalUserRow[]> {
  const rows = input.projectIds.map(pid => ({
    tenant_id: DEFAULT_TENANT_ID,
    project_id: pid,
    name: input.name,
    email: input.email,
    portal_role: input.portalRole,
    can_approve: input.canApprove,
    can_preview: input.canPreview,
    can_comment: input.canComment ?? true,
    password_must_change: true,
    status: 'invited',
    metadata: input.tempPassword ? { temp_password_hint: 'sent-by-email' } : {},
  }))
  if (rows.length === 0) return []
  const { data, error } = await tbl('client_portal_users').insert(rows).select('*')
  if (error) throw tenantError('client_portal_users', error.message)
  const created = (data ?? []) as ClientPortalUserRow[]
  for (const u of created) {
    await writeAudit('client_portal_user', u.id, 'portal.access_created',
      input.actorName ?? 'Sistema', null,
      { email: u.email, project_id: u.project_id, portal_role: u.portal_role })
  }
  return created
}

export interface ClientPermissions {
  portalRole: PortalRole
  canApprove: boolean
  canPreview: boolean
  canComment: boolean
}

/** Effective portal permissions for one client email (optionally per project). */
async function getClientPermissions__raw(
  email: string, projectId?: string,
): Promise<ClientPermissions> {
  let q = tbl('client_portal_users').select('*')
    .eq('tenant_id', DEFAULT_TENANT_ID).ilike('email', email)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw tenantError('client_portal_users', error.message)
  const rows = (data ?? []) as ClientPortalUserRow[]
  if (rows.length === 0) {
    return { portalRole: 'viewer', canApprove: false, canPreview: false, canComment: false }
  }
  return {
    portalRole: rows.some(r => r.portal_role === 'portal-admin') ? 'portal-admin' : 'viewer',
    canApprove: rows.some(r => r.can_approve),
    canPreview: rows.some(r => r.can_preview),
    canComment: rows.some(r => r.can_comment),
  }
}

async function setPortalPasswordChanged__raw(userId: string): Promise<void> {
  await tbl('client_portal_users').update({ password_must_change: false, status: 'active' })
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('id', userId)
}


// ─── Resilient public API ─────────────────────────────────────────────────────
// Every exported call degrades to a safe empty value on failure (missing table,
// network error, RLS): the UI renders an empty/error state instead of crashing.

const EMPTY_SCOPE: ClientPortalScope = { project: null, sprints: [], deliveries: [], roadmap: [] }
const NO_PERMISSIONS: ClientPermissions = {
  portalRole: 'viewer', canApprove: false, canPreview: false, canComment: false,
}

export const listPortalProjects = (): Promise<PortalProject[]> =>
  safeCall('clientPortal.listPortalProjects', () => listPortalProjects__raw(), [])

export const getClientPortal = (projectId: string): Promise<ClientPortalScope> =>
  safeCall('clientPortal.getClientPortal', () => getClientPortal__raw(projectId), EMPTY_SCOPE, { projectId })

export const listClientSignals = (projectId?: string): Promise<ClientSignalRow[]> =>
  safeCall('clientPortal.listClientSignals', () => listClientSignals__raw(projectId), [], { projectId })

export const listClientSignalsForPo = (poId: string): Promise<ClientSignalRow[]> =>
  safeCall('clientPortal.listClientSignalsForPo', () => listClientSignalsForPo__raw(poId), [], { poId })

export const addClientComment = (input: AddCommentInput): Promise<ClientSignalRow | null> =>
  safeCall('clientPortal.addClientComment', () => addClientComment__raw(input), null, { projectId: input.projectId })

export const addClientApproval = (input: AddApprovalInput): Promise<ClientSignalRow | null> =>
  safeCall('clientPortal.addClientApproval', () => addClientApproval__raw(input), null, { projectId: input.projectId })

export const addPoReply = (signalId: string, reply: string, poName: string): Promise<void> =>
  safeCall('clientPortal.addPoReply', () => addPoReply__raw(signalId, reply, poName), undefined, { signalId })

export const markSignalReadByPo = (signalId: string): Promise<void> =>
  safeCall('clientPortal.markSignalReadByPo', () => markSignalReadByPo__raw(signalId), undefined, { signalId })

export const markProjectReadByPo = (projectId: string): Promise<void> =>
  safeCall('clientPortal.markProjectReadByPo', () => markProjectReadByPo__raw(projectId), undefined, { projectId })

export const markReplyReadByClient = (signalId: string): Promise<void> =>
  safeCall('clientPortal.markReplyReadByClient', () => markReplyReadByClient__raw(signalId), undefined, { signalId })

export const markAllRepliesReadByClient = (author: string): Promise<void> =>
  safeCall('clientPortal.markAllRepliesReadByClient', () => markAllRepliesReadByClient__raw(author), undefined)

export const listClientPortalUsers = (projectId?: string): Promise<ClientPortalUserRow[]> =>
  safeCall('clientPortal.listClientPortalUsers', () => listClientPortalUsers__raw(projectId), [], { projectId })

export const createClientPortalUsers = (input: CreatePortalUserInput): Promise<ClientPortalUserRow[]> =>
  safeCall('clientPortal.createClientPortalUsers', () => createClientPortalUsers__raw(input), [], { email: input.email })

export const getClientPermissions = (email: string, projectId?: string): Promise<ClientPermissions> =>
  safeCall('clientPortal.getClientPermissions', () => getClientPermissions__raw(email, projectId), NO_PERMISSIONS)

export const setPortalPasswordChanged = (userId: string): Promise<void> =>
  safeCall('clientPortal.setPortalPasswordChanged', () => setPortalPasswordChanged__raw(userId), undefined, { userId })

// ─── Pré-login do Portal do Cliente (Edge Function, sem sessão) ───────────────
export interface PortalLoginUser {
  id: string
  name: string
  email: string
  tenantId: string
  permission: 'viewer' | 'admin'
  mustChangePassword: boolean
  canApprove: boolean
  canPreview: boolean
  canComment: boolean
  projectIds: string[]
}

export interface PortalLoginResult {
  ok: boolean
  user?: PortalLoginUser
  error?: string
}

/** Valida o acesso do cliente via Edge Function (service_role no servidor). */
export function portalLogin(email: string): Promise<PortalLoginResult> {
  return safeCall<PortalLoginResult>('clientPortal.portalLogin', async () => {
    const { data, error } = await supabase.functions.invoke('client-portal-login', {
      body: { email: (email ?? '').trim().toLowerCase() },
    })
    if (error) {
      logger.error('clientPortal.portalLogin', error)
      return { ok: false, error: 'unavailable' }
    }
    const res = data as PortalLoginResult | null
    if (!res?.ok || !res.user) return { ok: false, error: res?.error ?? 'invalid_credentials' }
    return res
  }, { ok: false, error: 'unavailable' })
}


// ─── Responsáveis por mensagens do cliente (por projeto) ─────────────────────
export interface ResponsibleCandidate {
  id: string
  name: string
  email: string
  avatar_initials: string | null
  avatar_color: string | null
  primary_role: string | null
}

async function listProjectResponsibleCandidates__raw(projectId: string): Promise<ResponsibleCandidate[]> {
  const { data: members, error: mErr } = await tbl('project_members')
    .select('profile_id')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .eq('project_id', projectId)
  if (mErr) throw tenantError('project_members', mErr.message)
  const ids = [...new Set((members ?? []).map((m: any) => m.profile_id).filter(Boolean))]
  if (!ids.length) return []

  const { data, error } = await tbl('profiles')
    .select('id, name, email, avatar_initials, avatar_color, primary_role')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .in('id', ids)
    .is('archived_at', null)
    .eq('can_handle_client_messages', true)
    .order('name')
  if (error) throw tenantError('profiles', error.message)

  return (data ?? [])
    .filter((p: any) => {
      const normalized = String(p.primary_role ?? '').toLowerCase().replace(/_/g, '')
      return normalized !== 'admin'
    })
    .map((p: any) => ({
      id: p.id,
      name: p.name ?? p.email ?? '',
      email: p.email ?? '',
      avatar_initials: p.avatar_initials ?? null,
      avatar_color: p.avatar_color ?? null,
      primary_role: p.primary_role ?? null,
    }))
}


export interface MentionProfile { id: string; name: string }

async function listProjectResponsibles__raw(projectId: string): Promise<string[]> {
  const { data, error } = await tbl('project_client_responsibles')
    .select('profile_id')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .eq('project_id', projectId)
  if (error) throw tenantError('project_client_responsibles', error.message)
  return (data ?? []).map((r: any) => r.profile_id).filter(Boolean)
}

/** Projetos em que o profile é responsável pelas mensagens do cliente. */
async function listResponsibleProjectIds__raw(profileId: string): Promise<string[]> {
  const { data, error } = await tbl('project_client_responsibles')
    .select('project_id')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .eq('profile_id', profileId)
  if (error) throw tenantError('project_client_responsibles', error.message)
  return (data ?? []).map((r: any) => r.project_id).filter(Boolean)
}

async function setProjectResponsibles__raw(
  projectId: string, profileIds: string[], actorName?: string,
): Promise<void> {
  const before = await listProjectResponsibles__raw(projectId)
  const next = [...new Set(profileIds.filter(Boolean))]

  const toRemove = before.filter(id => !next.includes(id))
  if (toRemove.length) {
    const { error } = await tbl('project_client_responsibles')
      .delete()
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('project_id', projectId)
      .in('profile_id', toRemove)
    if (error) throw tenantError('project_client_responsibles', error.message)
  }

  const toAdd = next.filter(id => !before.includes(id))
  if (toAdd.length) {
    const { error } = await tbl('project_client_responsibles').insert(
      toAdd.map(profile_id => ({ tenant_id: DEFAULT_TENANT_ID, project_id: projectId, profile_id })),
    )
    if (error) throw tenantError('project_client_responsibles', error.message)
  }

  if (toAdd.length || toRemove.length) {
    await writeAudit(
      'project_client_responsibles', projectId, 'set_responsibles',
      actorName ?? 'Sistema',
      { profile_ids: before.join(',') },
      { profile_ids: next.join(',') },
    )
  }
}

export const listProjectResponsibleCandidates = (projectId: string): Promise<ResponsibleCandidate[]> =>
  safeCall('clientPortal.listProjectResponsibleCandidates', () => listProjectResponsibleCandidates__raw(projectId), [], { projectId })

/** Responsáveis atribuídos ao projeto (para autocomplete de @menção). */
async function listProjectResponsibleProfiles__raw(projectId: string): Promise<MentionProfile[]> {
  const ids = await listProjectResponsibles__raw(projectId)
  if (!ids.length) return []
  const { data, error } = await tbl('profiles')
    .select('id, name, email')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .in('id', ids)
    .is('archived_at', null)
    .order('name')
  if (error) throw tenantError('profiles', error.message)
  return (data ?? []).map((p: any) => ({ id: p.id, name: p.name ?? p.email ?? '' }))
}

export const listProjectResponsibleProfiles = (projectId: string): Promise<MentionProfile[]> =>
  safeCall('clientPortal.listProjectResponsibleProfiles', () => listProjectResponsibleProfiles__raw(projectId), [], { projectId })

export const listProjectResponsibles = (projectId: string): Promise<string[]> =>
  safeCall('clientPortal.listProjectResponsibles', () => listProjectResponsibles__raw(projectId), [], { projectId })

export const listResponsibleProjectIds = (profileId: string): Promise<string[]> =>
  safeCall('clientPortal.listResponsibleProjectIds', () => listResponsibleProjectIds__raw(profileId), [], { profileId })

export const setProjectResponsibles = (projectId: string, profileIds: string[], actorName?: string): Promise<void> =>
  safeCall('clientPortal.setProjectResponsibles', () => setProjectResponsibles__raw(projectId, profileIds, actorName), undefined, { projectId })

// ─── Wave 2a — Fórum de Mensagens do Cliente (client_signals reais) ──────────
export interface ProjectSignalSummary {
  projectId:  string
  name:       string
  clientName: string | null
  unread:     number
  lastAt:     string
  lastBody:   string
  lastAuthor: string
  lastSource: 'client' | 'management'
}

/** Projects for which the active user is a client-messages responsible.
 *  For supervisors, returns every project that has a responsible assigned or a
 *  client portal user. Empty channels (no signals yet) are returned with
 *  unread:0 and a placeholder last message so the channel is selectable.
 */
async function listResponsibleProjects__raw(
  profileId: string, isSupervisor: boolean,
): Promise<ProjectSignalSummary[]> {
  const tid = DEFAULT_TENANT_ID
  let projectIds: string[] = []

  if (isSupervisor) {
    const [respRes, portalRes] = await Promise.all([
      tbl('project_client_responsibles').select('project_id').eq('tenant_id', tid),
      tbl('client_portal_users').select('project_id').eq('tenant_id', tid).is('archived_at', null),
    ])
    if (respRes.error) throw tenantError('project_client_responsibles', respRes.error.message)
    if (portalRes.error) throw tenantError('client_portal_users', portalRes.error.message)
    const ids = new Set([
      ...((respRes.data ?? []).map((r: any) => r.project_id)),
      ...((portalRes.data ?? []).map((r: any) => r.project_id)),
    ])
    projectIds = [...ids].filter(Boolean)
  } else {
    const { data, error } = await tbl('project_client_responsibles')
      .select('project_id')
      .eq('tenant_id', tid)
      .eq('profile_id', profileId)
    if (error) throw tenantError('project_client_responsibles', error.message)
    projectIds = (data ?? []).map((r: any) => r.project_id).filter(Boolean)
  }

  if (projectIds.length === 0) return []

  const { data, error } = await supabase.from('projects')
    .select('id, name, client_name')
    .eq('tenant_id', tid)
    .in('id', projectIds)
    .is('archived_at', null)
    .order('name')
  if (error) throw tenantError('projects', error.message)

  const emptyDate = new Date(0).toISOString()
  return (data ?? []).map((p: any) => ({
    projectId:  p.id,
    name:       p.name ?? 'Projeto',
    clientName: p.client_name ?? null,
    unread:     0,
    lastAt:     emptyDate,
    lastBody:   'Sem mensagens ainda',
    lastAuthor: '—',
    lastSource: 'client' as const,
  }))
}

export const listResponsibleProjects = (
  profileId: string, isSupervisor: boolean,
): Promise<ProjectSignalSummary[]> =>
  safeCall('clientPortal.listResponsibleProjects', () => listResponsibleProjects__raw(profileId, isSupervisor), [], { profileId, isSupervisor })

function signalSource(row: ClientSignalRow): 'client' | 'management' {
  const m = (row.metadata ?? {}) as Record<string, unknown>
  return m.source === 'management' ? 'management' : 'client'
}

async function listProjectsWithClientSignals__raw(): Promise<ProjectSignalSummary[]> {
  const { data, error } = await tbl('client_signals')
    .select('id, project_id, type, author, body, item_title, read_by_po, metadata, created_at')
    .eq('tenant_id', DEFAULT_TENANT_ID).is('archived_at', null)
    .order('created_at', { ascending: true })
  if (error) throw tenantError('client_signals', error.message)
  const rows = (data ?? []) as ClientSignalRow[]
  if (rows.length === 0) return []

  const ids = [...new Set(rows.map(r => r.project_id).filter(Boolean))]
  const { data: projects } = await supabase.from('projects')
    .select('id, name, client_name')
    .eq('tenant_id', DEFAULT_TENANT_ID).in('id', ids)
  const byId = new Map((projects ?? []).map((p: any) => [p.id, p]))

  const map = new Map<string, ProjectSignalSummary>()
  for (const r of rows) {
    const src = signalSource(r)
    const proj = byId.get(r.project_id) as any
    const prev = map.get(r.project_id)
    const body = r.type === 'approval'
      ? `✓ ${r.item_title ?? 'Aprovação registrada'}`
      : (r.body ?? '')
    map.set(r.project_id, {
      projectId:  r.project_id,
      name:       proj?.name ?? 'Projeto',
      clientName: proj?.client_name ?? null,
      unread:     (prev?.unread ?? 0) + (src === 'client' && !r.read_by_po ? 1 : 0),
      lastAt:     r.created_at,
      lastBody:   body,
      lastAuthor: r.author ?? '—',
      lastSource: src,
    })
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
}

export interface ClientChatMessage {
  id:        string
  side:      'client' | 'management'
  author:    string
  body:      string
  createdAt: string
  type:      SignalType
  itemTitle: string | null
  mentions:  string[]
}

function signalMentions(row: ClientSignalRow): string[] {
  const m = (row.metadata ?? {}) as Record<string, unknown>
  return Array.isArray(m.mentions) ? (m.mentions as unknown[]).map(String) : []
}

async function listProjectChat__raw(projectId: string): Promise<ClientChatMessage[]> {
  const rows = await listClientSignals__raw(projectId)
  return rows.map(r => ({
    id:        r.id,
    side:      signalSource(r),
    author:    r.author ?? '—',
    body:      r.type === 'approval'
      ? `Aprovação registrada: "${r.item_title ?? ''}"`
      : (r.body ?? ''),
    createdAt: r.created_at,
    type:      r.type,
    itemTitle: r.item_title,
    mentions:  signalMentions(r),
  }))
}

export interface AddClientMessageInput {
  projectId: string
  body:      string
  author:    string
  source:    'client' | 'management'
  mentions?: string[]
}

async function markProjectSignalsReadByPo__raw(projectId: string): Promise<void> {
  const { error } = await tbl('client_signals').update({ read_by_po: true })
    .eq('tenant_id', DEFAULT_TENANT_ID).eq('project_id', projectId)
    .eq('read_by_po', false).eq('metadata->>source', 'client')
  if (error) throw tenantError('client_signals', error.message)
}

export const listProjectsWithClientSignals = (): Promise<ProjectSignalSummary[]> =>
  safeCall('clientPortal.listProjectsWithClientSignals', () => listProjectsWithClientSignals__raw(), [])

export const listProjectChat = (projectId: string): Promise<ClientChatMessage[]> =>
  safeCall('clientPortal.listProjectChat', () => listProjectChat__raw(projectId), [], { projectId })

export const addClientMessage = (input: AddClientMessageInput): Promise<ClientSignalRow | null> =>
  safeCall('clientPortal.addClientMessage', () => addClientComment__raw({
    projectId: input.projectId, body: input.body, author: input.author,
    source: input.source, mentions: input.mentions,
  }), null, { projectId: input.projectId })

export const markProjectSignalsReadByPo = (projectId: string): Promise<void> =>
  safeCall('clientPortal.markProjectSignalsReadByPo', () => markProjectSignalsReadByPo__raw(projectId), undefined, { projectId })
