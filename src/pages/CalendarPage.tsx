import { SprintCeremoniesModal } from '@/components/SprintCeremoniesModal'
import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import { T } from '@/components/ds/tokens'
import { listDeadlines, type DeadlineItem } from '@/data/db/calendar'
import { type CalendarEvent } from '@/data/calendarEvents'
import {
  listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  generateSprintCeremonies,
  type CeremonySlot,
  EVENT_TYPES, EVENT_TYPE_LABEL, EVENT_TYPE_COLOR, EVENT_TYPE_ICON,
  upsertExternalEvents, setExternalId, GOOGLE_PROVIDER,
  DEFAULT_TENANT_ID, type CalendarEventType, type DbCalendarEvent, type CalendarEventInput,
} from '@/data/db/calendarEvents'
import {
  getGoogleStatus, connectGoogle, disconnectGoogle, fetchGoogleEvents, pushEventToGoogle,
  type GoogleStatus,
} from '@/lib/googleCalendar'
import { listSprints, normalizeState } from '@/data/db/sprints'
import { useSession } from '@/data/SessionContext'
import { can } from '@/data/permissions'
import { MOCK_USERS, MOCK_TENANT } from '@/data/session'

/** Maps a persisted calendar_events row into the shape the calendar views render. */
function toViewEvent(e: DbCalendarEvent): CalendarEvent {
  return {
    id: e.id,
    tenant_id: e.tenantId,
    title: e.title,
    start: e.startIso,
    end: e.endIso,
    allDay: e.allDay,
    guests: e.guests,
    meetLink: e.meetLink,
    location: e.location,
    description: e.description,
    color: e.color,
    workItemId: e.workItemKey,
    reminder: e.reminder,
    source: e.externalProvider === GOOGLE_PROVIDER ? 'google' : 'altech',
    externalId: e.externalId ?? undefined,
    created_by: '',
    eventType: e.eventType,
  }
}

/** Maps the composer output back into the data-layer input. */
function toEventInput(ev: Omit<CalendarEvent, 'id'>): CalendarEventInput {
  return {
    title: ev.title,
    startIso: ev.start,
    endIso: ev.end,
    allDay: ev.allDay,
    eventType: ev.eventType ?? 'other',
    guests: ev.guests,
    location: ev.location,
    description: ev.description,
    color: ev.color,
    meetLink: ev.meetLink,
    workItemKey: ev.workItemId,
    reminder: ev.reminder,
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const DOW_PT    = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const GRID_START = 8   // 08:00
const GRID_HOURS = 13  // 08:00 – 20:00
const HOUR_H     = 56  // px per hour

const EVENT_COLORS = [
  { label: 'Azul',    hex: '#3B82F6' },
  { label: 'Verde',   hex: '#10B981' },
  { label: 'Roxo',    hex: '#A78BFA' },
  { label: 'Índigo',  hex: '#6366F1' },
  { label: 'Laranja', hex: '#F59E0B' },
  { label: 'Vermelho',hex: '#EF4444' },
  { label: 'Rosa',    hex: '#EC4899' },
  { label: 'Teal',    hex: '#14B8A6' },
]

// ─── Date helpers ──────────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function startOfWeek(d: Date): Date {
  const s = new Date(d); s.setHours(0,0,0,0); s.setDate(d.getDate() - d.getDay()); return s
}
function getWeekDays(anchor: Date): Date[] {
  const s = startOfWeek(anchor)
  return Array.from({length:7}, (_, i) => { const d = new Date(s); d.setDate(s.getDate()+i); return d })
}
function buildMonthGrid(year: number, month: number): (Date|null)[][] {
  const first = new Date(year, month, 1).getDay()
  const days  = new Date(year, month+1, 0).getDate()
  const cells: (Date|null)[] = []
  for (let i=0; i<first; i++) cells.push(null)
  for (let d=1; d<=days; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: (Date|null)[][] = []
  for (let i=0; i<cells.length; i+=7) rows.push(cells.slice(i,i+7))
  return rows
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function parseDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`)
}
function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter(e => {
    const s = new Date(e.start), en = new Date(e.end)
    if (e.allDay) return sameDay(s, day) || (s <= day && en >= day)
    return sameDay(s, day)
  })
}
function eventTopPx(ev: CalendarEvent): number {
  const d = new Date(ev.start)
  return Math.max(0, (d.getHours() + d.getMinutes()/60 - GRID_START) * HOUR_H)
}
function eventHeightPx(ev: CalendarEvent): number {
  const s = new Date(ev.start), en = new Date(ev.end)
  const h = (en.getTime() - s.getTime()) / 3600000
  return Math.max(h * HOUR_H, 24)
}

// ─── Local toast ──────────────────────────────────────────────────────────────
function useLocalToast() {
  const [msg, setMsg] = useState<string|null>(null)
  function toast(m: string) { setMsg(m); setTimeout(() => setMsg(null), 3000) }
  return { msg, toast }
}

// ─── Event color chip ─────────────────────────────────────────────────────────
function EventChip({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  const isGoogle = ev.source === 'google'
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick() }}
      title={ev.title}
      style={{
        background: `${ev.color}22`, borderLeft: `3px solid ${ev.color}`,
        borderRadius: 4, padding: '2px 6px', fontSize: 10, color: T.text1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        marginBottom: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        borderTop: isGoogle ? `1px dashed ${ev.color}66` : 'none',
      }}
    >
      {isGoogle && <span style={{ fontSize: 8, color: ev.color, fontWeight: 700, flexShrink: 0 }}>G</span>}
      {ev.eventType && ev.eventType !== 'other' && <span style={{ fontSize: 9, flexShrink: 0 }}>{EVENT_TYPE_ICON[ev.eventType]}</span>}
      {ev.meetLink && <span style={{ fontSize: 9, flexShrink: 0 }}>📹</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
    </div>
  )
}

// ─── Issue due-date chip (read-only) ─────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#5C5C7A',
}
function IssueDueChip({ issue }: { issue: DeadlineItem }) {
  const dotColor = PRIORITY_DOT[issue.priority] ?? T.text3
  const isOverdue = new Date(issue.dueDateIso) < new Date() && issue.status !== 'done'
  return (
    <div style={{
      background: isOverdue ? `${dotColor}18` : `${T.text3}10`,
      borderLeft: `2px solid ${isOverdue ? dotColor : T.text3}`,
      borderRadius: 3, padding: '1px 5px', fontSize: 9,
      color: isOverdue ? dotColor : T.text2,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2,
      display: 'flex', alignItems: 'center', gap: 3,
    }} title={`Prazo: ${issue.key} – ${issue.title}${isOverdue ? ' (atrasado)' : ''}`}>
      <span style={{ fontSize: 8 }}>⏰</span>
      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{issue.key}</span>
      {issue.blocked && <span style={{ color: '#EF4444', fontSize: 8 }}>🔴</span>}
    </div>
  )
}

/** Real work item deadlines loaded from Supabase (module scope so nested views can read them). */
let DEADLINES: DeadlineItem[] = []

/** Work items due on a given calendar day */
function issuesDueOnDay(day: Date): DeadlineItem[] {
  return DEADLINES.filter(i => sameDay(new Date(`${i.dueDateIso}T00:00:00`), day))
}

// ─── Week event block ─────────────────────────────────────────────────────────
function WeekEventBlock({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  const top    = eventTopPx(ev)
  const height = eventHeightPx(ev)
  const isGoogle = ev.source === 'google'
  const start = new Date(ev.start)
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        position: 'absolute', left: 3, right: 3,
        top, height: Math.min(height, GRID_HOURS * HOUR_H - top),
        background: `${ev.color}28`, borderLeft: `3px solid ${ev.color}`,
        borderRadius: 5, padding: '3px 6px', cursor: 'pointer', zIndex: 2,
        overflow: 'hidden',
        borderTop: isGoogle ? `1px dashed ${ev.color}88` : 'none',
      }}
      title={ev.title}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: ev.color, lineHeight: 1.3, display: 'flex', gap: 4 }}>
        {isGoogle && <span style={{ fontSize: 8 }}>G</span>}
        {ev.eventType && ev.eventType !== 'other' && <span>{EVENT_TYPE_ICON[ev.eventType]}</span>}
        {ev.meetLink && <span>📹</span>}
        {fmtTime(start)}
      </div>
      {height > 36 && (
        <div style={{ fontSize: 10, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.title}
        </div>
      )}
    </div>
  )
}

// ─── Event detail popover ─────────────────────────────────────────────────────
function EventDetailCard({
  ev, onClose, onEdit, onDelete,
}: { ev: CalendarEvent; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const start = new Date(ev.start), end = new Date(ev.end)
  const isGoogle = ev.source === 'google'
  const [copied, setCopied] = useState(false)

  function copyLink() {
    if (ev.meetLink) {
      navigator.clipboard?.writeText(`https://${ev.meetLink}`).catch(() => {})
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bgSurface, border: `1px solid ${T.border}`,
        borderRadius: 14, boxShadow: T.shadowModal, width: 380, padding: '20px 24px',
        position: 'relative',
      }}>
        {/* Color bar + close */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ev.color, borderRadius: '14px 14px 0 0' }} />
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 6,
          background: `${T.text3}14`, border: 'none', color: T.text2, cursor: 'pointer', fontSize: 16, lineHeight: 1,
        }}>×</button>

        <div style={{ marginTop: 8 }}>
          {isGoogle && (
            <div style={{
              fontSize: 10, color: T.warn, background: T.warnDim, border: `1px solid ${T.warn}44`,
              borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginBottom: 8,
            }}>Google Calendar</div>
          )}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text1, margin: '0 0 8px' }}>{ev.title}</h2>

          <div style={{ fontSize: 12, color: T.text2, marginBottom: 6 }}>
            {ev.allDay
              ? `📅 ${fmtDate(start)} (dia inteiro)`
              : `📅 ${fmtDate(start)} · ${fmtTime(start)} – ${fmtTime(end)}`}
          </div>

          {ev.location && (
            <div style={{ fontSize: 12, color: T.text2, marginBottom: 6 }}>📍 {ev.location}</div>
          )}

          {ev.meetLink && (
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, fontSize: 11, color: T.accent,
                background: T.accentDim, border: `1px solid ${T.accentBorder}`,
                borderRadius: 6, padding: '5px 10px', fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                📹 {ev.meetLink}
              </div>
              <button onClick={copyLink} style={{
                fontSize: 11, color: copied ? T.success : T.text2,
                background: `${T.text3}12`, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: '5px 10px', cursor: 'pointer', flexShrink: 0,
              }}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          )}

          {ev.guests.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Convidados</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ev.guests.map(g => (
                  <span key={g.email} style={{
                    fontSize: 11, color: T.text1, background: `${T.text3}12`,
                    border: `1px solid ${T.border}`, borderRadius: 4, padding: '2px 8px',
                  }}>{g.name}</span>
                ))}
              </div>
            </div>
          )}

          {ev.description && (
            <p style={{ fontSize: 12, color: T.text2, margin: '0 0 8px', lineHeight: 1.5 }}>{ev.description}</p>
          )}

          {ev.workItemId && (
            <div style={{ fontSize: 11, color: T.accent, marginBottom: 8 }}>🔗 {ev.workItemId}</div>
          )}

          {ev.reminder && (
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 8 }}>🔔 {ev.reminder} min antes</div>
          )}

          {isGoogle && (
            <div style={{ fontSize: 10, color: T.text3, marginBottom: 8, fontStyle: 'italic' }}>
              Evento importado via Google Calendar (demonstrativo).
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
          {!isGoogle && (
            <button onClick={onEdit} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}`, cursor: 'pointer',
            }}>Editar</button>
          )}
          <button onClick={onDelete} style={{
            flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 600,
            background: T.critDim, color: T.crit, border: `1px solid ${T.crit}44`, cursor: 'pointer',
          }}>Remover</button>
        </div>
      </div>
    </div>
  )
}

// ─── Event composer modal ─────────────────────────────────────────────────────
interface ComposerProps {
  initial: {
    date: string; startTime: string; endTime: string
    editEvent?: CalendarEvent
  }
  onSave:   (ev: Omit<CalendarEvent,'id'>) => void
  onClose:  () => void
}

function EventComposer({ initial, onSave, onClose }: ComposerProps) {
  const editing = initial.editEvent
  const [title,    setTitle]    = useState(editing?.title ?? '')
  const [date,     setDate]     = useState(fmtDate(new Date(editing?.start ?? initial.date)))
  const [startT,   setStartT]   = useState(editing ? fmtTime(new Date(editing.start)) : initial.startTime)
  const [endT,     setEndT]     = useState(editing ? fmtTime(new Date(editing.end))   : initial.endTime)
  const [allDay,   setAllDay]   = useState(editing?.allDay ?? false)
  const [color,    setColor]    = useState(editing?.color ?? '#3B82F6')
  const [evType,   setEvType]   = useState<CalendarEventType>(editing?.eventType ?? 'other')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [desc,     setDesc]     = useState(editing?.description ?? '')
  const [workItem, setWorkItem] = useState(editing?.workItemId ?? '')
  const [reminder, setReminder] = useState<number|undefined>(editing?.reminder ?? 10)
  const [meetLink, setMeetLink] = useState(editing?.meetLink ?? '')
  const [guestQ,   setGuestQ]   = useState('')
  const [guests,   setGuests]   = useState<{name:string;email:string}[]>(editing?.guests ?? [])
  const [expanded, setExpanded] = useState(!!editing)
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  const guestSuggestions = guestQ.length > 0
    ? MOCK_USERS.filter(u =>
        (u.name.toLowerCase().includes(guestQ.toLowerCase()) ||
         u.email.toLowerCase().includes(guestQ.toLowerCase())) &&
        !guests.find(g => g.email === u.email)
      ).slice(0, 5)
    : []

  function addGuest(u: typeof MOCK_USERS[0]) {
    setGuests(gs => [...gs, { name: u.name, email: u.email }]); setGuestQ('')
  }
  function removeGuest(email: string) { setGuests(gs => gs.filter(g => g.email !== email)) }
  function clearMeet() { setMeetLink('') }

  function handleSave() {
    if (!title.trim()) return
    const start = allDay ? `${date}T00:00:00.000Z` : parseDateTime(date, startT).toISOString()
    const end   = allDay ? `${date}T23:59:00.000Z` : parseDateTime(date, endT).toISOString()
    onSave({
      tenant_id: MOCK_TENANT.tenant_id,
      title: title.trim(), start, end, allDay, guests,
      meetLink: meetLink || undefined,
      location: location || undefined,
      description: desc || undefined,
      color, workItemId: workItem || undefined, eventType: evType,
      reminder: reminder ?? undefined,
      source: 'altech', created_by: 'u_po',
    })
  }

  const inpS: CSSProperties = {
    width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`,
    borderRadius: 7, padding: '8px 10px', fontSize: 12, color: T.text1,
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bgSurface, border: `1px solid ${T.border}`,
        borderRadius: 16, boxShadow: T.shadowModal, width: 480,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text1 }}>
            {editing ? 'Editar evento' : 'Novo evento'}
          </span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, background: `${T.text3}14`, border: 'none', color: T.text2, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Title */}
          <input
            ref={titleRef}
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título do evento *"
            style={{ ...inpS, fontSize: 15, fontWeight: 600, padding: '10px 12px' }}
          />

          {/* Event type */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Tipo do evento</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EVENT_TYPES.map(t => (
                <button key={t} onClick={() => { setEvType(t); setColor(EVENT_TYPE_COLOR[t]) }} style={{
                  fontSize: 11, borderRadius: 99, padding: '4px 10px', cursor: 'pointer',
                  background: evType === t ? `${EVENT_TYPE_COLOR[t]}22` : 'transparent',
                  color: evType === t ? EVENT_TYPE_COLOR[t] : T.text2,
                  border: `1px solid ${evType === t ? EVENT_TYPE_COLOR[t] : T.border}`,
                  fontWeight: evType === t ? 700 : 400,
                }}>{EVENT_TYPE_ICON[t]} {EVENT_TYPE_LABEL[t]}</button>
              ))}
            </div>
          </div>

          {/* All-day toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div
              onClick={() => setAllDay(a => !a)}
              style={{
                width: 36, height: 20, borderRadius: 10, background: allDay ? T.accent : T.border,
                position: 'relative', flexShrink: 0, transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: allDay ? 18 : 2, width: 16, height: 16,
                borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontSize: 12, color: T.text2 }}>Dia inteiro</span>
          </label>

          {/* Date + time */}
          {allDay ? (
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inpS} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
              <input type="date"  value={date}   onChange={e => setDate(e.target.value)}   style={inpS} />
              <input type="time"  value={startT} onChange={e => setStartT(e.target.value)} style={{ ...inpS, width: 'auto' }} />
              <input type="time"  value={endT}   onChange={e => setEndT(e.target.value)}   style={{ ...inpS, width: 'auto' }} />
            </div>
          )}

          {/* Guests */}
          <div>
            <div style={{ position: 'relative' }}>
              <input
                value={guestQ} onChange={e => setGuestQ(e.target.value)}
                placeholder="Convidar pessoas (nome ou e-mail)..."
                style={inpS}
              />
              {guestSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 7,
                  boxShadow: T.shadow2, marginTop: 2,
                }}>
                  {guestSuggestions.map(u => (
                    <button key={u.user_id} onClick={() => addGuest(u)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 12px', background: 'transparent', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}10` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: u.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>{u.avatar_initials}</div>
                      <div>
                        <div style={{ fontSize: 12, color: T.text1 }}>{u.name}</div>
                        <div style={{ fontSize: 10, color: T.text3 }}>{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {guests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {guests.map(g => (
                  <span key={g.email} style={{
                    fontSize: 11, color: T.text1, background: T.accentDim,
                    border: `1px solid ${T.accentBorder}`, borderRadius: 99, padding: '3px 8px',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {g.name}
                    <button onClick={() => removeGuest(g.email)} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Video call */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>📹</span>
            <input
              value={meetLink}
              onChange={e => setMeetLink(e.target.value)}
              placeholder="Link da videochamada (opcional)"
              style={inpS}
            />
            {meetLink && (
              <button onClick={clearMeet} style={{
                background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 15, lineHeight: 1,
              }}>×</button>
            )}
          </div>

          {/* Expanded fields */}
          {!expanded && (
            <button onClick={() => setExpanded(true)} style={{ fontSize: 12, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
              ＋ Mais opções (local, descrição, cor, lembrete…)
            </button>
          )}

          {expanded && (
            <>
              {/* Location */}
              <input value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Local (opcional)" style={inpS} />

              {/* Description */}
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Descrição (opcional)" rows={3}
                style={{ ...inpS, resize: 'vertical', lineHeight: 1.5 }} />

              {/* Color */}
              <div>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Cor / Categoria</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c.hex}
                      title={c.label}
                      onClick={() => setColor(c.hex)}
                      style={{
                        width: 22, height: 22, borderRadius: '50%', background: c.hex,
                        border: color === c.hex ? `3px solid ${T.text1}` : `2px solid transparent`,
                        cursor: 'pointer', flexShrink: 0,
                        boxShadow: color === c.hex ? `0 0 0 2px ${c.hex}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Work item */}
              <input value={workItem} onChange={e => setWorkItem(e.target.value)}
                placeholder="Vincular work item (ex.: ALT-139)" style={inpS} />

              {/* Reminder */}
              <div>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Lembrete</div>
                <select value={reminder ?? ''} onChange={e => setReminder(e.target.value ? Number(e.target.value) : undefined)}
                  style={{ ...inpS }}>
                  <option value="">Sem lembrete</option>
                  <option value="5">5 min antes</option>
                  <option value="10">10 min antes</option>
                  <option value="15">15 min antes</option>
                  <option value="30">30 min antes</option>
                  <option value="60">1 hora antes</option>
                  <option value="1440">1 dia antes</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: 'transparent', color: T.text2, border: `1px solid ${T.border}`, cursor: 'pointer',
          }}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              flex: 2, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: title.trim() ? T.accent : T.border, color: '#fff', border: 'none', cursor: title.trim() ? 'pointer' : 'default',
            }}>
            {editing ? 'Salvar alterações' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Painel de integrações de agenda ─────────────────────────────────────────
interface IntegrationsPanelProps {
  status: GoogleStatus
  busy: boolean
  onClose: () => void
  onConnect: () => void
  onSync: () => void
  onDisconnect: () => void
}

function IntegrationsPanel({ status, busy, onClose, onConnect, onSync, onDisconnect }: IntegrationsPanelProps) {
  const rowBtn: CSSProperties = {
    padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: busy ? 'progress' : 'pointer',
    background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}`, opacity: busy ? 0.6 : 1,
  }
  const soon = (label: string, icon: string) => (
    <div key={label} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgSurface2, opacity: 0.6,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>{label}</div>
        <div style={{ fontSize: 11, color: T.text3 }}>Em construção</div>
      </div>
      <span style={{ fontSize: 11, color: T.text3, border: `1px solid ${T.border}`, borderRadius: 5, padding: '2px 8px' }}>
        Indisponível
      </span>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
         onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bgSurface, border: `1px solid ${T.border}`,
        borderRadius: 16, boxShadow: T.shadowModal, width: 440, padding: '24px 24px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text1, flex: 1 }}>Integrar agenda</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, background: `${T.text3}14`, border: 'none', color: T.text2, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        {/* Google */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          borderRadius: 10, border: `1px solid ${status.connected ? T.success + '44' : T.border}`,
          background: status.connected ? T.successDim : T.bgSurface2,
        }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>Google Agenda</div>
            <div style={{ fontSize: 11, color: status.connected ? T.success : T.text3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {status.connected ? `Conectado${status.email ? ` · ${status.email}` : ''}` : 'Desconectado'}
            </div>
          </div>
          {!status.connected && (
            <button disabled={busy} onClick={onConnect} style={rowBtn}>
              {busy ? 'Conectando…' : 'Conectar'}
            </button>
          )}
        </div>

        {status.connected && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={onSync} style={{ ...rowBtn, flex: 2 }}>
              {busy ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
            <button disabled={busy} onClick={onDisconnect} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12,
              background: 'transparent', color: T.text3, border: `1px solid ${T.border}`,
              cursor: busy ? 'progress' : 'pointer',
            }}>Desconectar</button>
          </div>
        )}

        {status.error && !status.connected && (
          <div style={{ fontSize: 11, color: T.warn, background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 8, padding: '8px 12px' }}>
            {status.error}
          </div>
        )}

        {soon('Microsoft Teams', '🟦')}
        {soon('Outlook', '📨')}

        <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
          Eventos importados do Google aparecem com o selo <strong>G</strong> e são somente leitura aqui.
        </div>
      </div>
    </div>
  )
}

// ─── Day / Agenda view ────────────────────────────────────────────────────────
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)

interface DayViewProps {
  anchor:        Date
  events:        CalendarEvent[]
  today:         Date
  onEventClick:  (ev: CalendarEvent) => void
  onSlotClick:   (day: Date, hour: number) => void
}

function DayView({ anchor, events, today, onEventClick, onSlotClick }: DayViewProps) {
  const isToday   = sameDay(anchor, today)
  const nowRef    = useRef<HTMLDivElement>(null)
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes())

  // Scroll to current hour on mount / when day changes
  useEffect(() => {
    nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [anchor])

  // Update now-indicator every minute
  useEffect(() => {
    const id = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 60_000)
    return () => clearInterval(id)
  }, [])

  // All-day events for this day
  const allDayEvs = events.filter(e => e.allDay && sameDay(new Date(e.start), anchor))

  // Due issues for this day
  const dueIssues = issuesDueOnDay(anchor)

  // Timed events for this day
  const timedEvs = events.filter(e => !e.allDay && sameDay(new Date(e.start), anchor))

  // Events starting in a given hour
  function eventsAtHour(h: number): CalendarEvent[] {
    return timedEvs.filter(e => new Date(e.start).getHours() === h)
  }

  const nowTopPx = (nowMin / 60) * HOUR_H  // within the 24h scroll area

  const TYPE_COLOR: Record<string, string> = {
    story: T.accent, bug: T.crit, task: T.text2, subtask: T.text3, epic: T.warn, feature: T.purple ?? '#A78BFA',
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Day header ── */}
      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${T.border}`, background: T.bgSurface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? T.accent : T.text1 }}>
            {isToday && <span style={{ fontSize: 10, background: T.accent, color: '#fff', borderRadius: 4, padding: '1px 6px', marginRight: 7, fontWeight: 700 }}>HOJE</span>}
            {DOW_PT[anchor.getDay()]}, {anchor.getDate()} de {MONTHS_PT[anchor.getMonth()]} {anchor.getFullYear()}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: T.text2, background: `${T.text3}10`, border: `1px solid ${T.border}`, borderRadius: 4, padding: '2px 8px' }}>
              {timedEvs.length} evento{timedEvs.length !== 1 ? 's' : ''}
            </span>
            {dueIssues.length > 0 && (
              <span style={{ fontSize: 11, color: T.warn, background: T.warnDim, border: `1px solid ${T.warn}44`, borderRadius: 4, padding: '2px 8px' }}>
                ⏰ {dueIssues.length} prazo{dueIssues.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* All-day strip */}
        {(allDayEvs.length > 0 || dueIssues.length > 0) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allDayEvs.map(ev => (
              <div
                key={ev.id}
                onClick={() => onEventClick(ev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: `${ev.color}22`, border: `1px solid ${ev.color}66`,
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: T.text1,
                }}
              >
                {ev.source === 'google' && <span style={{ fontSize: 9, fontWeight: 800, color: ev.color }}>G</span>}
                <span style={{ fontWeight: 600 }}>{ev.title}</span>
                <span style={{ fontSize: 9, color: T.text3 }}>dia inteiro</span>
              </div>
            ))}
            {dueIssues.map(i => {
              const dotC = TYPE_COLOR[i.type] ?? T.text3
              const isOverdue = new Date(i.dueDateIso) < today && i.status !== 'done'
              return (
                <div key={i.key} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: isOverdue ? `${T.crit}12` : T.warnDim,
                  border: `1px solid ${isOverdue ? T.crit : T.warn}44`,
                  borderRadius: 6, padding: '4px 10px', fontSize: 11, color: isOverdue ? T.crit : T.warn,
                }}>
                  <span style={{ fontSize: 9 }}>⏰</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{i.key}</span>
                  <span style={{ color: dotC }}>·</span>
                  <span style={{ color: T.text2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
                  {i.blocked && <span style={{ fontSize: 9, color: T.crit }}>🔴 Bloqueado</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Hour grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {/* Now line */}
        {isToday && (
          <div
            ref={nowRef}
            style={{
              position: 'absolute', left: 0, right: 0,
              top: nowTopPx, zIndex: 10, pointerEvents: 'none',
              display: 'flex', alignItems: 'center',
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.crit, flexShrink: 0, marginLeft: 48 }} />
            <div style={{ flex: 1, height: 2, background: T.crit, opacity: 0.8 }} />
          </div>
        )}

        {ALL_HOURS.map(hour => {
          const hEvs   = eventsAtHour(hour)
          const isEmpty = hEvs.length === 0
          const isNowHour = isToday && new Date().getHours() === hour

          return (
            <div
              key={hour}
              onClick={() => isEmpty && onSlotClick(anchor, hour)}
              style={{
                display: 'flex', minHeight: HOUR_H,
                borderBottom: `1px solid ${T.border}${hour % 2 === 0 ? '' : '55'}`,
                background: isNowHour ? `${T.accent}05` : 'transparent',
                cursor: isEmpty ? 'pointer' : 'default',
              }}
              onMouseEnter={e => { if (isEmpty) (e.currentTarget as HTMLDivElement).style.background = `${T.text3}07` }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isNowHour ? `${T.accent}05` : 'transparent' }}
            >
              {/* Hour label */}
              <div style={{
                width: 56, flexShrink: 0, paddingTop: 6, paddingRight: 10,
                textAlign: 'right', fontSize: 10,
                color: isNowHour ? T.accent : T.text3,
                fontWeight: isNowHour ? 700 : 400,
                userSelect: 'none',
              }}>
                {`${String(hour).padStart(2,'0')}:00`}
              </div>

              {/* Events in this hour */}
              <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {hEvs.map(ev => {
                  const start = new Date(ev.start), end = new Date(ev.end)
                  const isGoogle = ev.source === 'google'
                  const durationH = (end.getTime() - start.getTime()) / 3_600_000
                  return (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        background: `${ev.color}18`,
                        borderLeft: `3px solid ${ev.color}`,
                        borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                        borderTop: isGoogle ? `1px dashed ${ev.color}77` : 'none',
                        minHeight: Math.max(40, durationH * 28),
                      }}
                    >
                      {/* Time col */}
                      <div style={{ fontSize: 11, color: ev.color, fontWeight: 700, flexShrink: 0, lineHeight: 1.4 }}>
                        <div>{fmtTime(start)}</div>
                        <div style={{ fontWeight: 400, color: T.text3 }}>– {fmtTime(end)}</div>
                      </div>
                      {/* Content col */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {isGoogle && <span style={{ fontSize: 9, fontWeight: 800, color: ev.color }}>G</span>}
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.title}
                          </span>
                        </div>
                        {ev.meetLink && (
                          <div style={{ fontSize: 11, color: T.accent, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>📹</span>
                            <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.meetLink}
                            </span>
                          </div>
                        )}
                        {ev.guests.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                            {ev.guests.slice(0, 3).map(g => (
                              <span key={g.email} style={{
                                fontSize: 10, color: T.text2, background: `${T.text3}12`,
                                border: `1px solid ${T.border}`, borderRadius: 3, padding: '1px 6px',
                              }}>{g.name.split(' ')[0]}</span>
                            ))}
                            {ev.guests.length > 3 && <span style={{ fontSize: 10, color: T.text3 }}>+{ev.guests.length - 3}</span>}
                          </div>
                        )}
                        {ev.location && (
                          <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>📍 {ev.location}</div>
                        )}
                      </div>
                      {/* Type tag */}
                      <div style={{
                        fontSize: 9, fontWeight: 700, flexShrink: 0,
                        background: `${ev.color}22`, color: ev.color,
                        border: `1px solid ${ev.color}44`, borderRadius: 4, padding: '1px 5px',
                      }}>
                        {isGoogle ? 'Google' : 'Evento'}
                      </div>
                    </div>
                  )
                })}
                {/* Empty hour hint */}
                {isEmpty && (
                  <div style={{ fontSize: 10, color: `${T.text3}44`, paddingTop: 2, userSelect: 'none' }}>
                    Clique para criar evento
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
type CalView = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const today       = new Date(); today.setHours(0,0,0,0)
  const [anchor, setAnchor] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [view, setView]     = useState<CalView>('week')
  const [tick, setTick]     = useState(0)
  const [composer, setComposer] = useState<{
    date: string; startTime: string; endTime: string; editEvent?: CalendarEvent
  } | null>(null)
  const [detailEv,   setDetailEv]   = useState<CalendarEvent | null>(null)
  const [showGSync,  setShowGSync]  = useState(false)
  const { msg: toastMsg, toast }    = useLocalToast()

  const { activeUser } = useSession()
  const canManageSprint = can(activeUser.permissions, 'sprint:manage')

  // Real events from calendar_events (Google events are imported into the same table)
  const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([])
  const events: CalendarEvent[] = dbEvents

  const reload = useCallback(async () => {
    const rows = await listCalendarEvents(DEFAULT_TENANT_ID)
    setDbEvents(rows.map(toViewEvent))
  }, [])

  useEffect(() => { void reload() }, [reload])

  // ── Integração Google Agenda (App User Connector, por usuário) ──────────────
  const [gStatus, setGStatus] = useState<GoogleStatus>({ connected: false })
  const [gBusy, setGBusy] = useState(false)

  const refreshGoogleStatus = useCallback(async () => {
    setGStatus(await getGoogleStatus())
  }, [])
  useEffect(() => { void refreshGoogleStatus() }, [refreshGoogleStatus])

  const syncGoogle = useCallback(async () => {
    setGBusy(true)
    try {
      const from = new Date(); from.setMonth(from.getMonth() - 1)
      const to = new Date(); to.setMonth(to.getMonth() + 3)
      const remote = await fetchGoogleEvents(from.toISOString(), to.toISOString())
      const res = await upsertExternalEvents(remote, DEFAULT_TENANT_ID)
      if (res.error) { toast(res.error); return }
      await reload()
      toast(`Google Agenda sincronizada · ${res.imported} novo(s), ${res.updated} atualizado(s).`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha ao sincronizar com o Google.')
    } finally {
      setGBusy(false)
    }
  }, [reload, toast])

  async function handleGoogleConnect() {
    setGBusy(true)
    try {
      await connectGoogle()
      await refreshGoogleStatus()
      setGBusy(false)
      await syncGoogle()
    } catch (err) {
      setGBusy(false)
      toast(err instanceof Error ? err.message : 'Não foi possível conectar ao Google Agenda.')
    }
  }

  async function handleGoogleDisconnect() {
    setGBusy(true)
    try {
      await disconnectGoogle()
      await refreshGoogleStatus()
      toast('Google Agenda desconectada.')
      setShowGSync(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível desconectar.')
    } finally {
      setGBusy(false)
    }
  }

  function refresh() { setTick(t => t + 1) }
  void tick
  void refresh

  // Sprints available for the ceremony generator
  const [sprintOpts, setSprintOpts] = useState<{ id: string; name: string; projectId: string; start: string | null; end: string | null }[]>([])
  const [sprintSel, setSprintSel] = useState('')
  const [generating, setGenerating] = useState(false)
  useEffect(() => {
    let alive = true
    listSprints()
      .then(rows => {
        if (!alive) return
        const open = rows.filter(s => normalizeState(s.state) !== 'completed')
        setSprintOpts(open.map(s => ({
          id: s.id, name: s.name, projectId: s.project_id, start: s.start_date, end: s.end_date,
        })))
        setSprintSel(prev => prev || (open[0]?.id ?? ''))
      })
      .catch(() => { if (alive) setSprintOpts([]) })
    return () => { alive = false }
  }, [])

  const [ceremonyDialog, setCeremonyDialog] = useState(false)

  async function handleGenerateCeremonies(slots: CeremonySlot[]) {
    const sprint = sprintOpts.find(s => s.id === sprintSel)
    if (!sprint) { toast('Selecione uma sprint.'); return }
    setGenerating(true)
    const res = await generateSprintCeremonies({
      id: sprint.id, name: sprint.name, projectId: sprint.projectId,
      startDate: sprint.start, endDate: sprint.end,
    }, DEFAULT_TENANT_ID, activeUser.user_id, slots)
    setGenerating(false)
    setCeremonyDialog(false)
    if (res.error) { toast(res.error); return }
    await reload()
    toast(res.created === 0
      ? `Cerimônias já existentes (${res.skipped} mantidas).`
      : `${res.created} cerimônia(s) criada(s)${res.skipped ? ` · ${res.skipped} já existiam` : ''}.`)
  }

  // Real deadlines (work_items.due_date) from Supabase
  const [deadlineError, setDeadlineError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    listDeadlines()
      .then(rows => { if (!alive) return; DEADLINES = rows; setTick(t => t + 1) })
      .catch(err => { if (alive) setDeadlineError(err instanceof Error ? err.message : String(err)) })
    return () => { alive = false }
  }, [])


  function navToday() { setAnchor(new Date(today)); setView('day') }
  function navPrev()  {
    const d = new Date(anchor)
    if (view === 'month') d.setMonth(d.getMonth() - 1, 1)
    else if (view === 'week') d.setDate(d.getDate() - 7)
    else d.setDate(d.getDate() - 1)
    setAnchor(d)
  }
  function navNext()  {
    const d = new Date(anchor)
    if (view === 'month') d.setMonth(d.getMonth() + 1, 1)
    else if (view === 'week') d.setDate(d.getDate() + 7)
    else d.setDate(d.getDate() + 1)
    setAnchor(d)
  }

  function openCreate(date: Date, hour = 9) {
    const d = fmtDate(date)
    const sh = String(hour).padStart(2,'0')
    const eh = String(Math.min(hour+1,23)).padStart(2,'0')
    setComposer({ date: d, startTime: `${sh}:00`, endTime: `${eh}:00` })
  }
  function openEdit(ev: CalendarEvent) {
    setDetailEv(null)
    setComposer({ date: fmtDate(new Date(ev.start)), startTime: fmtTime(new Date(ev.start)), endTime: fmtTime(new Date(ev.end)), editEvent: ev })
  }
  async function handleDelete(ev: CalendarEvent) {
    setDetailEv(null)
    if (ev.source === 'google') { toast('Eventos do Google não são removidos aqui.'); return }
    const ok = await deleteCalendarEvent(ev.id, DEFAULT_TENANT_ID)
    if (!ok) { toast('Falha ao remover o evento.'); return }
    await reload()
    toast('Evento removido.')
  }
  async function handleSave(data: Omit<CalendarEvent,'id'>) {
    const input = toEventInput(data)
    const editing = composer?.editEvent
    setComposer(null)
    const saved = editing
      ? await updateCalendarEvent(editing.id, input, DEFAULT_TENANT_ID)
      : await createCalendarEvent({ ...input, createdBy: activeUser.user_id }, DEFAULT_TENANT_ID)
    if (!saved) { toast('Falha ao salvar o evento.'); return }
    if (gStatus.connected) {
      const externalId = await pushEventToGoogle({
        externalId: editing?.externalId,
        title: input.title,
        startIso: input.startIso,
        endIso: input.endIso,
        allDay: input.allDay ?? false,
        description: input.description,
        location: input.location,
        guests: input.guests,
      })
      if (externalId) await setExternalId(saved.id, externalId, DEFAULT_TENANT_ID)
    }
    await reload()
    toast(editing ? 'Evento atualizado.' : 'Evento criado.')
  }

  // Week view data
  const weekDays = getWeekDays(anchor)

  // Month view data
  const year = anchor.getFullYear(), month = anchor.getMonth()
  const monthRows = buildMonthGrid(year, month)

  // Period label
  const periodLabel = view === 'month'
    ? `${MONTHS_PT[month]} ${year}`
    : view === 'day'
    ? `${DOW_PT[anchor.getDay()]}, ${anchor.getDate()} de ${MONTHS_PT[anchor.getMonth()]} ${anchor.getFullYear()}`
    : (() => {
        const s = weekDays[0], e = weekDays[6]
        if (s.getMonth() === e.getMonth())
          return `${s.getDate()} – ${e.getDate()} de ${MONTHS_PT[s.getMonth()]} ${s.getFullYear()}`
        return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`
      })()

  const isGoogleConnected = gStatus.connected

  const toolBtn: CSSProperties = {
    padding: '5px 11px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
    background: T.bgSurface2, color: T.text2, border: `1px solid ${T.border}`,
  }

  return (
    <div style={{ background: T.bgPage, height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'inherit', overflow: 'hidden' }}>
      {deadlineError && (
        <div style={{ padding: '6px 16px', fontSize: 12, color: T.crit, background: T.critDim, borderBottom: `1px solid ${T.border}` }}>
          Não foi possível carregar os prazos: {deadlineError}
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, background: T.bgSurface, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* + Criar */}
        <button
          data-tour="cal-create"
          onClick={() => openCreate(anchor)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: T.accent, color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          ＋ Criar
        </button>

        {/* View toggle */}
        <div data-tour="cal-views" style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.border}` }}>
          {(['month','week','day'] as CalView[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 14px', fontSize: 12, cursor: 'pointer',
              background: view===v ? T.accentDim : 'transparent',
              color:      view===v ? T.accent    : T.text2,
              border: 'none', fontWeight: view===v ? 700 : 400,
            }}>{v==='month' ? 'Mês' : v==='week' ? 'Semana' : 'Dia'}</button>
          ))}
        </div>

        {/* Hoje */}
        <button onClick={navToday} style={toolBtn}>Hoje</button>

        {/* Gerador de cerimônias (SM/PO) */}
        {canManageSprint && sprintOpts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              data-tour="cal-sprint"
              value={sprintSel}
              onChange={e => setSprintSel(e.target.value)}
              style={{ ...toolBtn, padding: '5px 8px', maxWidth: 180 }}
            >
              {sprintOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              data-tour="cal-ceremonies"
              onClick={() => setCeremonyDialog(true)}
              disabled={generating}
              title="Cria daily, planning, pré-review, review e retrospectivas da sprint"
              style={{
                ...toolBtn,
                background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}`,
                fontWeight: 600, opacity: generating ? 0.6 : 1,
                cursor: generating ? 'progress' : 'pointer',
              }}
            >
              {generating ? 'Gerando…' : 'Gerar cerimônias da sprint'}
            </button>
          </div>
        )}

        {/* Navigation */}
        <button onClick={navPrev} style={{ ...toolBtn, padding: '5px 10px', fontSize: 15 }}>‹</button>
        <span style={{ color: T.text1, fontWeight: 600, fontSize: 14, minWidth: 200, textAlign: 'center' }}>
          {periodLabel}
        </span>
        <button onClick={navNext} style={{ ...toolBtn, padding: '5px 10px', fontSize: 15 }}>›</button>

        {/* Integrações de agenda */}
        <button
          data-tour="cal-integrate"
          onClick={() => setShowGSync(true)}
          style={{
            ...toolBtn, marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 6,
            color:      isGoogleConnected ? T.success : T.text2,
            background: isGoogleConnected ? T.successDim : T.bgSurface2,
            border:     `1px solid ${isGoogleConnected ? T.success + '44' : T.border}`,
          }}
        >
          <span>📅</span>
          {isGoogleConnected ? `Google Agenda · ${gStatus.email ?? 'conectado'}` : 'Integrar agenda'}
        </button>
      </div>

      {/* ── Month view ──────────────────────────────────────────────────────── */}
      {view === 'month' && (
        <div data-tour="cal-grid" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, overflow: 'hidden' }}>
          {/* DOW headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, marginBottom: 1 }}>
            {DOW_PT.map(d => (
              <div key={d} style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 700, color: T.text3 }}>{d}</div>
            ))}
          </div>
          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 'minmax(90px,1fr)', gap: 1, flex: 1 }}>
            {monthRows.flat().map((day, idx) => {
              const isToday  = day ? sameDay(day, today) : false
              const dayEvs   = day ? eventsForDay(events, day) : []
              const dueIssues = day ? issuesDueOnDay(day) : []
              const visible  = dayEvs.slice(0, 3)
              const overflow = dayEvs.length - 3
              return (
                <div
                  key={idx}
                  onClick={() => day && openCreate(day)}
                  style={{
                    background: day ? T.bgSurface : `${T.bgSurface}44`,
                    border:     isToday ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                    borderRadius: 5, padding: '5px 5px 3px',
                    cursor: day ? 'pointer' : 'default', minHeight: 90,
                    boxShadow: isToday ? `0 0 0 1px ${T.accent}20` : 'none',
                  }}
                >
                  {day && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, marginBottom: 3, userSelect: 'none' }}>
                        <span style={isToday ? {
                          background: T.accent, color: '#fff', borderRadius: '50%',
                          width: 20, height: 20, display: 'inline-flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 10,
                        } : { color: T.text2 }}>{day.getDate()}</span>
                      </div>
                      {dueIssues.slice(0,1).map(i => <IssueDueChip key={i.key} issue={i} />)}
                      {visible.map(ev => <EventChip key={ev.id} ev={ev} onClick={() => setDetailEv(ev)} />)}
                      {overflow > 0 && <div style={{ fontSize: 9, color: T.accent, cursor: 'pointer' }}>+{overflow} mais</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Week view ───────────────────────────────────────────────────────── */}
      {view === 'week' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* All-day row */}
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7,1fr)', borderBottom: `1px solid ${T.border}`, background: T.bgSurface, flexShrink: 0 }}>
            <div style={{ padding: '5px 6px', fontSize: 9, color: T.text3, borderRight: `1px solid ${T.border}`, textAlign: 'right', paddingTop: 8 }}>tod</div>
            {weekDays.map((day, di) => {
              const allDayEvs = eventsForDay(events, day).filter(e => e.allDay)
              const duePt = issuesDueOnDay(day)
              return (
                <div key={di} style={{ padding: '3px 3px', borderRight: `1px solid ${T.border}`, minHeight: 28 }}>
                  {duePt.slice(0,1).map(i => <IssueDueChip key={i.key} issue={i} />)}
                  {allDayEvs.map(ev => <EventChip key={ev.id} ev={ev} onClick={() => setDetailEv(ev)} />)}
                </div>
              )
            })}
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7,1fr)', borderBottom: `1px solid ${T.border}`, background: T.bgSurface, flexShrink: 0 }}>
            <div style={{ borderRight: `1px solid ${T.border}` }} />
            {weekDays.map((day, i) => {
              const isT = sameDay(day, today)
              return (
                <div key={i} style={{
                  textAlign: 'center', padding: '8px 0', fontSize: 12, fontWeight: 600,
                  color: isT ? T.accent : T.text2, borderRight: `1px solid ${T.border}`,
                }}>
                  <div style={{ fontSize: 10, color: isT ? T.accent : T.text3, marginBottom: 3 }}>{DOW_PT[day.getDay()]}</div>
                  <div style={isT ? {
                    background: T.accent, color: '#fff', borderRadius: '50%',
                    width: 26, height: 26, display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 13,
                  } : { fontSize: 15, color: T.text1 }}>{day.getDate()}</div>
                </div>
              )
            })}
          </div>

          {/* Hour grid */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {Array.from({ length: GRID_HOURS }, (_, i) => GRID_START + i).map(hour => (
              <div key={hour} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7,1fr)', borderBottom: `1px solid ${T.border}${hour % 2 === 0 ? '' : '44'}` }}>
                {/* Hour label */}
                <div style={{
                  padding: '4px 6px', fontSize: 9, color: T.text3, textAlign: 'right',
                  borderRight: `1px solid ${T.border}`, background: T.bgSurface,
                  height: HOUR_H, boxSizing: 'border-box', flexShrink: 0,
                }}>
                  {hour < 10 ? `0${hour}:00` : `${hour}:00`}
                </div>
                {/* Day cells */}
                {weekDays.map((day, di) => {
                  const isT = sameDay(day, today)
                  const slotEvs = eventsForDay(events, day).filter(ev => {
                    if (ev.allDay) return false
                    const h = new Date(ev.start).getHours()
                    return h === hour
                  })
                  return (
                    <div
                      key={di}
                      onClick={() => openCreate(day, hour)}
                      style={{
                        height: HOUR_H, borderRight: `1px solid ${T.border}`,
                        background: isT ? `${T.accent}06` : 'transparent',
                        position: 'relative', cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = isT ? `${T.accent}12` : `${T.text3}07` }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isT ? `${T.accent}06` : 'transparent' }}
                    >
                      {slotEvs.map(ev => (
                        <WeekEventBlock key={ev.id} ev={ev} onClick={() => setDetailEv(ev)} />
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Day / Agenda view ───────────────────────────────────────────────── */}
      {view === 'day' && <DayView anchor={anchor} events={events} today={today} onEventClick={setDetailEv} onSlotClick={openCreate} />}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {composer && (
        <EventComposer
          initial={composer}
          onSave={handleSave}
          onClose={() => setComposer(null)}
        />
      )}
      {detailEv && (
        <EventDetailCard
          ev={detailEv}
          onClose={() => setDetailEv(null)}
          onEdit={() => openEdit(detailEv)}
          onDelete={() => handleDelete(detailEv)}
        />
      )}
      {showGSync && (
        <IntegrationsPanel
          status={gStatus}
          busy={gBusy}
          onClose={() => setShowGSync(false)}
          onConnect={() => { void handleGoogleConnect() }}
          onSync={() => { void syncGoogle() }}
          onDisconnect={() => { void handleGoogleDisconnect() }}
        />
      )}

      <SprintCeremoniesModal
        open={ceremonyDialog}
        sprintName={sprintOpts.find(s => s.id === sprintSel)?.name ?? 'Sprint'}
        busy={generating}
        onClose={() => setCeremonyDialog(false)}
        onConfirm={slots => { void handleGenerateCeremonies(slots) }}
      />



      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: T.bgSurface, border: `1px solid ${T.accentBorder}`,
          borderRadius: 10, padding: '11px 18px', boxShadow: T.shadow2,
          fontSize: 13, color: T.text1, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: T.success, fontSize: 15 }}>✓</span> {toastMsg}
        </div>
      )}
    </div>
  )
}
