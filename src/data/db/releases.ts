// Releases data access layer — real releases and linked work items from Supabase.
import { supabase } from '../../integrations/supabase/client'
import type { Database } from '../../integrations/supabase/types'
import { DEFAULT_TENANT_ID } from './timeline'
import { updateWorkItemField } from './workItem'
import * as notifications from './notifications'
import { logger } from '../../utils/logger'

export { DEFAULT_TENANT_ID }

type Tables = Database['public']['Tables']

export type ReleaseRow = Pick<
  Tables['releases']['Row'],
  'id' | 'project_id' | 'version' | 'name' | 'release_date' | 'state' | 'notes' | 'metadata'
>
export type ReleaseItemRow = Pick<
  Tables['work_items']['Row'],
  'id' | 'key' | 'title' | 'type' | 'status' | 'project_id' | 'release_id' | 'assignee_id' | 'metadata'
>
export type ReleaseProfileRow = Pick<Tables['profiles']['Row'], 'id' | 'name' | 'avatar_initials'>
export type ReleaseProjectRow = Pick<Tables['projects']['Row'], 'id' | 'key' | 'name'>

export interface ReleasesData {
  releases: ReleaseRow[]
  items: ReleaseItemRow[]
  profiles: ReleaseProfileRow[]
  projects: ReleaseProjectRow[]
}

function missingTableMessage(table: string, message: string): string {
  if (/does not exist|schema cache|Could not find the table/i.test(message)) {
    return `A tabela "${table}" não existe no Supabase conectado. Rode a migration do schema canônico antes de usar a tela de Releases.`
  }
  return message
}

export async function listReleases(): Promise<ReleasesData> {
  const tid = DEFAULT_TENANT_ID

  const [releases, items, profiles, projects] = await Promise.all([
    supabase.from('releases')
      .select('id, project_id, version, name, release_date, state, notes, metadata')
      .eq('tenant_id', tid).is('archived_at', null).order('release_date', { ascending: true }),
    supabase.from('work_items')
      .select('id, key, title, type, status, project_id, release_id, assignee_id, metadata')
      .eq('tenant_id', tid).is('archived_at', null).order('key'),
    supabase.from('profiles').select('id, name, avatar_initials').eq('tenant_id', tid).is('archived_at', null),
    supabase.from('projects').select('id, key, name').eq('tenant_id', tid).is('archived_at', null).order('name'),
  ])

  const failed = [
    ['releases', releases.error], ['work_items', items.error],
    ['profiles', profiles.error], ['projects', projects.error],
  ].find(([, err]) => err) as [string, { message: string }] | undefined
  if (failed) throw new Error(missingTableMessage(failed[0], failed[1].message))

  return {
    releases: releases.data ?? [],
    items: items.data ?? [],
    profiles: profiles.data ?? [],
    projects: projects.data ?? [],
  }
}

type AuditValue = string | number | boolean | null
type AuditPayload = Record<string, AuditValue>

async function writeAudit(
  entityId: string,
  action: string,
  actorName: string,
  before: AuditPayload | null,
  after: AuditPayload | null,
): Promise<void> {
  await supabase.from('audit_logs').insert({
    tenant_id: DEFAULT_TENANT_ID,
    entity_type: 'release',
    entity_id: entityId,
    action,
    actor_name: actorName,
    before,
    after,
  })
}

export interface CreateReleaseInput {
  projectId: string
  version: string
  name: string
  releaseDate?: string | null
  state?: string
  notes?: string | null
  itemIds?: string[]
  actorName?: string
}

/** Creates a release and links the selected work items to it. */
export async function createRelease(input: CreateReleaseInput): Promise<ReleaseRow> {
  const { data, error } = await supabase.from('releases').insert({
    tenant_id: DEFAULT_TENANT_ID,
    project_id: input.projectId,
    version: input.version,
    name: input.name,
    release_date: input.releaseDate || null,
    state: input.state ?? 'planned',
    notes: input.notes ?? null,
  }).select('id, project_id, version, name, release_date, state, notes, metadata').single()

  if (error || !data) throw new Error(missingTableMessage('releases', error?.message ?? 'Falha ao criar a release.'))

  if (input.itemIds && input.itemIds.length > 0) {
    await linkItemsToRelease(data.id, input.itemIds, input.actorName)
  }

  await writeAudit(data.id, 'release.created', input.actorName ?? 'Sistema', null, {
    version: data.version, name: data.name, state: data.state, items: input.itemIds?.length ?? 0,
  })

  return data
}

export interface UpdateReleaseInput {
  version?: string
  name?: string
  releaseDate?: string | null
  state?: string
  notes?: string | null
}

export async function updateRelease(
  release: ReleaseRow,
  patch: UpdateReleaseInput,
  actorName = 'Sistema',
): Promise<void> {
  const payload: Tables['releases']['Update'] = {}
  if (patch.version !== undefined) payload.version = patch.version
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.releaseDate !== undefined) payload.release_date = patch.releaseDate || null
  if (patch.state !== undefined) payload.state = patch.state
  if (patch.notes !== undefined) payload.notes = patch.notes
  if (Object.keys(payload).length === 0) return

  const { error } = await supabase.from('releases')
    .update(payload).eq('id', release.id).eq('tenant_id', DEFAULT_TENANT_ID)
  if (error) throw new Error(missingTableMessage('releases', error.message))

  await writeAudit(release.id, 'release.updated', actorName, {
    version: release.version, name: release.name, state: release.state,
    release_date: release.release_date, notes: release.notes,
  }, payload as AuditPayload)
}

/** Sets release_id (the fix version) on the given work items. */
export async function linkItemsToRelease(
  releaseId: string,
  itemIds: string[],
  actorName = 'Sistema',
): Promise<void> {
  if (itemIds.length === 0) return
  const { error } = await supabase.from('work_items')
    .update({ release_id: releaseId }).in('id', itemIds).eq('tenant_id', DEFAULT_TENANT_ID)
  if (error) throw new Error(missingTableMessage('work_items', error.message))
  await writeAudit(releaseId, 'release.items_linked', actorName, null, { items: itemIds.length })
}

/** Removes a work item from a release. */
export async function unlinkItemFromRelease(
  releaseId: string,
  itemId: string,
  actorName = 'Sistema',
): Promise<void> {
  const { error } = await supabase.from('work_items')
    .update({ release_id: null }).eq('id', itemId).eq('tenant_id', DEFAULT_TENANT_ID)
  if (error) throw new Error(missingTableMessage('work_items', error.message))
  await writeAudit(releaseId, 'release.item_unlinked', actorName, { item_id: itemId }, null)
}

// ─── Release closure ─────────────────────────────────────────────────────────
export interface CloseReleaseInput {
  release: ReleaseRow
  /** Items that stay on the release — shipped. */
  shippedItemIds: string[]
  /** Items that go back to the backlog for adjustment. */
  returnedItemIds: string[]
  note?: string
  actorName?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

/**
 * Closes a release: marks it as released, sends the pending items back to the
 * backlog, records the outcome in metadata and notifies the people involved.
 */
export async function closeRelease(input: CloseReleaseInput): Promise<void> {
  const { release } = input
  const actorName = input.actorName ?? 'Sistema'
  const nowIso = new Date().toISOString()
  const shippedCount = input.shippedItemIds.length
  const returnedCount = input.returnedItemIds.length
  const outcome = returnedCount === 0 ? 'success' : 'partial'
  const note = input.note?.trim() ? input.note.trim() : null

  const metadata = {
    ...asRecord(release.metadata),
    outcome,
    released_at: nowIso,
    shipped_count: shippedCount,
    returned_count: returnedCount,
    close_note: note,
  }

  const { error } = await supabase.from('releases').update({
    state: 'released',
    release_date: release.release_date ?? nowIso.slice(0, 10),
    metadata: metadata as Tables['releases']['Update']['metadata'],
  }).eq('id', release.id).eq('tenant_id', DEFAULT_TENANT_ID)
  if (error) throw new Error(missingTableMessage('releases', error.message))

  // Returned items: back to backlog, unlinked, stamped with the release info.
  const returnedItems = returnedCount > 0
    ? (await supabase.from('work_items')
        .select('id, key, status, assignee_id, metadata')
        .in('id', input.returnedItemIds).eq('tenant_id', DEFAULT_TENANT_ID)).data ?? []
    : []

  for (const item of returnedItems) {
    try {
      await updateWorkItemField(item.id, 'status', 'backlog', item.status, { actorName })
      await unlinkItemFromRelease(release.id, item.id, actorName)
      await supabase.from('work_items').update({
        metadata: {
          ...asRecord(item.metadata),
          returned_from_release: { version: release.version, at: nowIso, note },
        } as Tables['work_items']['Update']['metadata'],
      }).eq('id', item.id).eq('tenant_id', DEFAULT_TENANT_ID)
    } catch (err) {
      logger.error('releases.closeRelease.returnItem', err, { itemId: item.id })
    }
  }

  // Notifications — resilient per recipient.
  const notify = async (profileId: string, title: string, body: string | null) => {
    try {
      await notifications.create({
        profileId, type: 'release', title, body,
        entityType: 'release', entityId: release.id,
      })
    } catch (err) {
      logger.error('releases.closeRelease.notify', err, { profileId })
    }
  }

  for (const item of returnedItems) {
    if (!item.assignee_id) continue
    await notify(
      item.assignee_id,
      `Item ${item.key} voltou ao backlog para ajuste (release ${release.version})`,
      note,
    )
  }

  const leads = (await supabase.from('profiles')
    .select('id, primary_role').eq('tenant_id', DEFAULT_TENANT_ID)
    .in('primary_role', ['ProductOwner', 'ScrumMaster'])).data ?? []
  for (const lead of leads) {
    await notify(
      lead.id,
      `Release ${release.version} fechada: ${shippedCount} entregues, ${returnedCount} retornados`,
      note,
    )
  }

  await writeAudit(release.id, 'release.closed', actorName, null, {
    outcome, shipped: shippedCount, returned: returnedCount,
  })
}
