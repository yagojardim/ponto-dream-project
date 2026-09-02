// Calendar events data access layer — real `calendar_events` rows from Supabase.
// Tenant-safe: every read/write is scoped by tenant_id. Reads degrade to empty via safeCall.
import { supabase } from '@/integrations/supabase/client'
import type { Database, Json } from '@/integrations/supabase/types'
import { DEFAULT_TENANT_ID } from '@/data/db/timeline'
import { getActiveTenantId } from '@/data/session'
import { safeCall, logger } from '@/utils/logger'

export { DEFAULT_TENANT_ID }

type Tables = Database['public']['Tables']
type Row = Tables['calendar_events']['Row']

export type CalendarEventType = 'daily' | 'planning' | 'pre_review' | 'review' | 'retrospective' | 'other'

export const EVENT_TYPES: CalendarEventType[] = ['daily', 'planning', 'pre_review', 'review', 'retrospective', 'other']

export const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  daily: 'Daily',
  planning: 'Planning',
  pre_review: 'Pré-review',
  review: 'Review',
  retrospective: 'Retrospectiva',
  other: 'Evento',
}

export const EVENT_TYPE_COLOR: Record<CalendarEventType, string> = {
  daily: '#10B981',
  planning: '#F59E0B',
  pre_review: '#A78BFA',
  review: '#3B82F6',
  retrospective: '#EC4899',
  other: '#6366F1',
}

export const EVENT_TYPE_ICON: Record<CalendarEventType, string> = {
  daily: '🔁',
  planning: '🗺️',
  pre_review: '🔍',
  review: '🎬',
  retrospective: '💬',
  other: '📌',
}

export function normalizeEventType(value: string | null | undefined): CalendarEventType {
  return (EVENT_TYPES as string[]).includes(value ?? '') ? (value as CalendarEventType) : 'other'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeCreatedBy(value: string | null | undefined): string | null {
  if (!value) return null
  return UUID_RE.test(value) ? value : null
}


export interface EventGuest { name: string; email: string }

export interface DbCalendarEvent {
  id: string
  tenantId: string
  title: string
  startIso: string
  endIso: string
  allDay: boolean
  eventType: CalendarEventType
  guests: EventGuest[]
  location?: string
  description?: string
  color: string
  meetLink?: string
  workItemKey?: string
  reminder?: number
  projectId: string | null
  sprintId: string | null
  externalProvider: string | null
  externalId: string | null
}

export interface CalendarEventInput {
  title: string
  startIso: string
  endIso: string
  allDay?: boolean
  eventType?: CalendarEventType
  guests?: EventGuest[]
  location?: string
  description?: string
  color?: string
  meetLink?: string
  workItemKey?: string
  reminder?: number
  projectId?: string | null
  sprintId?: string | null
  createdBy?: string | null
  externalProvider?: string | null
  externalId?: string | null
}


interface EventMeta {
  color?: string
  meetLink?: string
  workItemKey?: string
  reminder?: number
}

function readMeta(value: Json | null): EventMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const rec = value as Record<string, Json | undefined>
  const meta: EventMeta = {}
  if (typeof rec.color === 'string') meta.color = rec.color
  if (typeof rec.meetLink === 'string') meta.meetLink = rec.meetLink
  if (typeof rec.workItemKey === 'string') meta.workItemKey = rec.workItemKey
  if (typeof rec.reminder === 'number') meta.reminder = rec.reminder
  return meta
}

function readGuests(value: Json | null): EventGuest[] {
  if (!Array.isArray(value)) return []
  const out: EventGuest[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const rec = entry as Record<string, Json | undefined>
    const name = typeof rec.name === 'string' ? rec.name : ''
    const email = typeof rec.email === 'string' ? rec.email : ''
    if (name || email) out.push({ name: name || email, email })
  }
  return out
}

function mapRow(row: Row): DbCalendarEvent {
  const type = normalizeEventType(row.event_type)
  const meta = readMeta(row.metadata)
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    startIso: row.starts_at,
    endIso: row.ends_at ?? row.starts_at,
    allDay: row.all_day,
    eventType: type,
    guests: readGuests(row.attendees),
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    color: meta.color ?? EVENT_TYPE_COLOR[type],
    meetLink: meta.meetLink,
    workItemKey: meta.workItemKey,
    reminder: meta.reminder,
    projectId: row.project_id,
    sprintId: row.sprint_id,
    externalProvider: row.external_provider,
    externalId: row.external_id,
  }
}


function toMetadata(input: Pick<CalendarEventInput, 'color' | 'meetLink' | 'workItemKey' | 'reminder'>): Json {
  const meta: Record<string, Json> = {}
  if (input.color) meta.color = input.color
  if (input.meetLink) meta.meetLink = input.meetLink
  if (input.workItemKey) meta.workItemKey = input.workItemKey
  if (typeof input.reminder === 'number') meta.reminder = input.reminder
  return meta as Json
}

/** Lists the tenant events, optionally bounded by an ISO range. Degrades to []. */
export async function listCalendarEvents(
  tenantId: string = getActiveTenantId(),
  fromISO?: string,
  toISO?: string,
): Promise<DbCalendarEvent[]> {
  return safeCall('calendarEvents.list', async () => {
    let query = supabase.from('calendar_events').select('*')
      .eq('tenant_id', tenantId)
      .is('archived_at', null)
      .order('starts_at', { ascending: true })
    if (toISO)   query = query.lte('starts_at', toISO)
    if (fromISO) query = query.gte('starts_at', fromISO)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapRow)
  }, [], { tenantId, fromISO, toISO })
}

/** Creates one event. Returns null if the write failed. */
export async function createCalendarEvent(
  input: CalendarEventInput,
  tenantId: string = getActiveTenantId(),
): Promise<DbCalendarEvent | null> {
  return safeCall('calendarEvents.create', async () => {
    const payload: Tables['calendar_events']['Insert'] = {
      tenant_id: tenantId,
      title: input.title,
      starts_at: input.startIso,
      ends_at: input.endIso,
      all_day: input.allDay ?? false,
      event_type: input.eventType ?? 'other',
      attendees: (input.guests ?? []) as unknown as Json,
      description: input.description ?? null,
      location: input.location ?? null,
      project_id: input.projectId ?? null,
      sprint_id: input.sprintId ?? null,
      created_by: normalizeCreatedBy(input.createdBy),
      external_provider: input.externalProvider ?? null,
      external_id: input.externalId ?? null,
      metadata: toMetadata(input),

    }
    const { data, error } = await supabase.from('calendar_events').insert(payload).select('*').single()
    if (error) throw new Error(error.message)
    return mapRow(data)
  }, null, { title: input.title })
}

/** Patches one event (tenant-scoped). Returns the updated row or null on failure. */
export async function updateCalendarEvent(
  id: string,
  patch: Partial<CalendarEventInput>,
  tenantId: string = getActiveTenantId(),
): Promise<DbCalendarEvent | null> {
  return safeCall('calendarEvents.update', async () => {
    const update: Tables['calendar_events']['Update'] = {}
    if (patch.title !== undefined)       update.title = patch.title
    if (patch.startIso !== undefined)    update.starts_at = patch.startIso
    if (patch.endIso !== undefined)      update.ends_at = patch.endIso
    if (patch.allDay !== undefined)      update.all_day = patch.allDay
    if (patch.eventType !== undefined)   update.event_type = patch.eventType
    if (patch.guests !== undefined)      update.attendees = patch.guests as unknown as Json
    if (patch.description !== undefined) update.description = patch.description ?? null
    if (patch.location !== undefined)    update.location = patch.location ?? null
    if (patch.projectId !== undefined)   update.project_id = patch.projectId ?? null
    if (patch.sprintId !== undefined)    update.sprint_id = patch.sprintId ?? null
    if (patch.externalProvider !== undefined) update.external_provider = patch.externalProvider ?? null
    if (patch.externalId !== undefined)  update.external_id = patch.externalId ?? null

    if (patch.color !== undefined || patch.meetLink !== undefined
        || patch.workItemKey !== undefined || patch.reminder !== undefined) {
      update.metadata = toMetadata(patch)
    }

    const { data, error } = await supabase.from('calendar_events').update(update)
      .eq('id', id).eq('tenant_id', tenantId).select('*').single()
    if (error) throw new Error(error.message)
    return mapRow(data)
  }, null, { id })
}

/** Soft delete via archived_at. */
export async function deleteCalendarEvent(
  id: string,
  tenantId: string = getActiveTenantId(),
): Promise<boolean> {
  return safeCall('calendarEvents.delete', async () => {
    const { error } = await supabase.from('calendar_events')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
    return true
  }, false, { id })
}

// ─── Sprint ceremonies generator ───────────────────────────────────────────────

export interface SprintCeremonyInput {
  id: string
  name: string
  projectId: string | null
  startDate: string | null   // 'YYYY-MM-DD'
  endDate: string | null     // 'YYYY-MM-DD'
}

export interface CeremonyResult {
  created: number
  skipped: number
  error?: string
}

function parseDay(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`)
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function at(day: Date, hour: number, minute: number): string {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

interface PlannedCeremony {
  day: Date
  type: CalendarEventType
  title: string
  startHour: number; startMin: number
  endHour: number;   endMin: number
}

/** Which matching weekdays of the sprint window the ceremony lands on. */
export type CeremonyOccurrence = 'every' | 'first' | 'last'

/** One configurable ceremony slot (a sprint can have two retrospectives, etc.). */
export interface CeremonySlot {
  id: string
  type: CalendarEventType
  /** Label used in the event title, e.g. 'Retrospectiva (manhã)'. */
  label: string
  enabled: boolean
  /** ISO weekdays: 1 = Monday … 5 = Friday. */
  days: number[]
  occurrence: CeremonyOccurrence
  /** 'HH:MM' */
  start: string
  end: string
}

export const WEEKDAY_LABELS: { day: number; label: string }[] = [
  { day: 1, label: 'Seg' },
  { day: 2, label: 'Ter' },
  { day: 3, label: 'Qua' },
  { day: 4, label: 'Qui' },
  { day: 5, label: 'Sex' },
]

/** Cadência padrão do Altech (equivalente ao gerador original). */
export const DEFAULT_CEREMONY_SLOTS: CeremonySlot[] = [
  { id: 'daily',      type: 'daily',         label: 'Daily',                   enabled: true, days: [1, 3, 5], occurrence: 'every', start: '09:00', end: '09:15' },
  { id: 'planning',   type: 'planning',      label: 'Planning',                enabled: true, days: [1],       occurrence: 'first', start: '10:00', end: '12:00' },
  { id: 'pre_review', type: 'pre_review',    label: 'Pré-review',              enabled: true, days: [4],       occurrence: 'last',  start: '15:00', end: '16:00' },
  { id: 'review',     type: 'review',        label: 'Review',                  enabled: true, days: [5],       occurrence: 'last',  start: '09:00', end: '10:00' },
  { id: 'retro_am',   type: 'retrospective', label: 'Retrospectiva (manhã)',   enabled: true, days: [5],       occurrence: 'last',  start: '10:30', end: '11:30' },
  { id: 'retro_pm',   type: 'retrospective', label: 'Retrospectiva (tarde)',   enabled: true, days: [5],       occurrence: 'last',  start: '14:00', end: '15:00' },
]

export function cloneDefaultCeremonySlots(): CeremonySlot[] {
  return DEFAULT_CEREMONY_SLOTS.map(s => ({ ...s, days: [...s.days] }))
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const hour = Number(m[1]); const minute = Number(m[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

/** Pure planner: derives the ceremony agenda of a sprint from its date range. */
export function planSprintCeremonies(
  sprint: SprintCeremonyInput,
  slots: CeremonySlot[] = DEFAULT_CEREMONY_SLOTS,
): PlannedCeremony[] {
  if (!sprint.startDate || !sprint.endDate) return []
  const start = parseDay(sprint.startDate)
  const end = parseDay(sprint.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []

  const days: Date[] = []
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d))

  const out: PlannedCeremony[] = []

  for (const slot of slots) {
    if (!slot.enabled || slot.days.length === 0) continue
    const from = parseTime(slot.start)
    const to = parseTime(slot.end)
    if (!from || !to) continue

    const matching = days.filter(d => slot.days.includes(d.getDay()))
    if (matching.length === 0) continue
    const picked =
      slot.occurrence === 'every' ? matching
      : slot.occurrence === 'first' ? [matching[0]]
      : [matching[matching.length - 1]]

    for (const day of picked) {
      out.push({
        day,
        type: slot.type,
        title: `${slot.label} — ${sprint.name}`,
        startHour: from.hour, startMin: from.minute,
        endHour: to.hour,     endMin: to.minute,
      })
    }
  }
  return out
}

/**
 * Creates the sprint ceremonies in `calendar_events`.
 * Idempotent: skips anything already present for the same sprint_id + event_type + day
 * (a day can legitimately hold two retrospectives, so the start time is part of the key).
 */
export async function generateSprintCeremonies(
  sprint: SprintCeremonyInput,
  tenantId: string = getActiveTenantId(),
  createdBy: string | null = null,
  slots: CeremonySlot[] = DEFAULT_CEREMONY_SLOTS,
): Promise<CeremonyResult> {
  const planned = planSprintCeremonies(sprint, slots)
  if (planned.length === 0) {
    return { created: 0, skipped: 0, error: 'Nenhuma cerimônia a gerar — verifique as datas da sprint e a configuração escolhida.' }
  }

  const existingRes = await safeCall('calendarEvents.ceremonies.existing', async () => {
    const { data, error } = await supabase.from('calendar_events')
      .select('event_type, starts_at')
      .eq('tenant_id', tenantId).eq('sprint_id', sprint.id).is('archived_at', null)
    if (error) throw new Error(error.message)
    return data ?? []
  }, null as { event_type: string; starts_at: string }[] | null, { sprintId: sprint.id })

  if (existingRes === null) {
    return { created: 0, skipped: 0, error: 'Não foi possível verificar as cerimônias existentes.' }
  }

  const seen = new Set(existingRes.map(r => {
    const d = new Date(r.starts_at)
    return `${normalizeEventType(r.event_type)}|${dayKey(d)}|${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }))

  const rows: Tables['calendar_events']['Insert'][] = []
  let skipped = 0
  for (const p of planned) {
    const key = `${p.type}|${dayKey(p.day)}|${String(p.startHour).padStart(2, '0')}:${String(p.startMin).padStart(2, '0')}`
    if (seen.has(key)) { skipped++; continue }
    seen.add(key)
    rows.push({
      tenant_id: tenantId,
      title: p.title,
      starts_at: at(p.day, p.startHour, p.startMin),
      ends_at: at(p.day, p.endHour, p.endMin),
      all_day: false,
      event_type: p.type,
      attendees: [] as unknown as Json,
      project_id: sprint.projectId ?? null,
      sprint_id: sprint.id,
      created_by: normalizeCreatedBy(createdBy),
      metadata: { color: EVENT_TYPE_COLOR[p.type] } as Json,
    })
  }

  if (rows.length === 0) return { created: 0, skipped }

  const ok = await safeCall('calendarEvents.ceremonies.insert', async () => {
    const { error } = await supabase.from('calendar_events').insert(rows)
    if (error) throw new Error(error.message)
    return true
  }, false, { sprintId: sprint.id, count: rows.length })

  if (!ok) {
    logger.warn('calendarEvents.ceremonies', 'insert failed', { sprintId: sprint.id })
    return { created: 0, skipped, error: 'Falha ao gravar as cerimônias.' }
  }
  return { created: rows.length, skipped }
}

// ─── Import de eventos externos (Google Calendar via conector) ────────────────

export interface ExternalEventInput {
  externalId: string
  title: string
  startIso: string
  endIso: string
  allDay: boolean
  description?: string | null
  location?: string | null
  meetLink?: string | null
  guests?: EventGuest[]
}

export const GOOGLE_PROVIDER = 'google'
export const GOOGLE_EVENT_COLOR = '#4285F4'

export interface ExternalImportResult {
  imported: number
  updated: number
  error?: string
}

/**
 * Faz upsert dos eventos do Google em `calendar_events` (tenant-safe),
 * deduplicando por (tenant_id, external_provider, external_id).
 */
export async function upsertExternalEvents(
  events: ExternalEventInput[],
  tenantId: string = getActiveTenantId(),
  provider: string = GOOGLE_PROVIDER,
): Promise<ExternalImportResult> {
  if (events.length === 0) return { imported: 0, updated: 0 }

  const existing = await safeCall('calendarEvents.external.existing', async () => {
    const { data, error } = await supabase.from('calendar_events')
      .select('id, external_id')
      .eq('tenant_id', tenantId)
      .eq('external_provider', provider)
      .is('archived_at', null)
    if (error) throw new Error(error.message)
    return data ?? []
  }, null as { id: string; external_id: string | null }[] | null, { provider })

  if (existing === null) return { imported: 0, updated: 0, error: 'Não foi possível verificar os eventos já importados.' }

  const byExternal = new Map(existing.filter(r => r.external_id).map(r => [r.external_id as string, r.id]))
  let imported = 0
  let updated = 0

  for (const ev of events) {
    const input: CalendarEventInput = {
      title: ev.title,
      startIso: ev.startIso,
      endIso: ev.endIso,
      allDay: ev.allDay,
      eventType: 'other',
      guests: ev.guests ?? [],
      description: ev.description ?? undefined,
      location: ev.location ?? undefined,
      meetLink: ev.meetLink ?? undefined,
      color: GOOGLE_EVENT_COLOR,
      externalProvider: provider,
      externalId: ev.externalId,
    }
    const current = byExternal.get(ev.externalId)
    if (current) {
      const ok = await updateCalendarEvent(current, input, tenantId)
      if (ok) updated++
    } else {
      const ok = await createCalendarEvent(input, tenantId)
      if (ok) imported++
    }
  }

  return { imported, updated }
}

/** Guarda o external_id devolvido pelo Google num evento nativo. */
export async function setExternalId(
  id: string,
  externalId: string,
  tenantId: string = getActiveTenantId(),
  provider: string = GOOGLE_PROVIDER,
): Promise<void> {
  await updateCalendarEvent(id, { externalProvider: provider, externalId }, tenantId)
}
