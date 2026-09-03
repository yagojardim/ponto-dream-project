import React, { useState, useRef, useEffect, type CSSProperties } from 'react'
import { takeReportNav } from '@/lib/reportNav'
import { T } from '../components/ds/tokens'
import { can } from '../data/permissions'
import { getActiveUser, MOCK_TENANT, DEFAULT_DASHBOARD_BY_ROLE, type MockUser } from '../data/session'
import {
  ASSIGNMENT_TARGETS, getAssignment, getAllAssignments,
  upsertAssignment, removeAssignment, useDashboardAssignments,
  hydrateAssignments,
  type AssignmentTarget,
} from '../data/dashboardAssignments'
import * as assignmentsApi from '../data/db/dashboardAssignments'
import { fetchTenantPersonas } from '../data/db/tenantPersonas'
import { Avatar } from '../components/ds/Avatar'
import {
  REPORT_REGISTRY, REPORT_CARDS_LIST,
  ReportsDataProvider, useReportsData,
} from '../data/reportRegistry'
import { listDashboardProjects, type DashboardProjectOption } from '../data/db/dashboards'
import { fetchAssignedProjects } from '../data/db/projects'
import {
  useReportsGovernance, saveReportsGovernance, isCardReleased, isTenantOwner,
} from '../data/db/reportsGovernance'


// ── helpers ──────────────────────────────────────────────────────────────────
const px = (n: number) => `${n}px`

// Card list sourced from the registry (single source of truth)
type ReportCardDef = { id: string; title: string; subtitle: string; span2: boolean }
const REPORT_CARDS: ReportCardDef[] = REPORT_CARDS_LIST


// ── Local toast ───────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }
  return { msg, toast }
}

// ── Assign popover ────────────────────────────────────────────────────────────
interface AssignPopoverProps {
  card: ReportCardDef
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onSaved: (count: number) => void
}

function AssignPopover({ card, anchorRef, onClose, onSaved }: AssignPopoverProps) {
  const tid   = MOCK_TENANT.tenant_id
  const user  = getActiveUser()
  const existing = getAssignment(tid, card.id)

  const EXEC_TARGETS = ASSIGNMENT_TARGETS.filter(t => t.group === 'Executivos')
  const EXEC_IDS = new Set(EXEC_TARGETS.map(t => t.id))

  // Map<target, slot> — executive (shared) dashboards only
  const [selected, setSelected] = useState<Map<AssignmentTarget, 'mural' | 'grid'>>(
    new Map((existing?.targets ?? []).filter(t => EXEC_IDS.has(t)).map(t => [t, existing?.slots?.[t] ?? 'mural']))
  )
  const [query, setQuery] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  // ── Per-user targets ────────────────────────────────────────────────────────
  const [users, setUsers] = useState<MockUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userSel, setUserSel] = useState<Set<string>>(new Set())
  const initialUserSel = useRef<Set<string>>(new Set())

  const dashOf = (u: MockUser) => DEFAULT_DASHBOARD_BY_ROLE[u.role_context]

  useEffect(() => {
    let alive = true
    void (async () => {
      const personas = await fetchTenantPersonas()
      if (!alive) return
      setUsers(personas)
      const checked = new Set<string>()
      await Promise.all(personas.map(async p => {
        const cards = await assignmentsApi.getAssignedCards(p.user_id, dashOf(p))
        if (cards.some(c => c.cardId === card.id)) checked.add(p.user_id)
      }))
      if (!alive) return
      initialUserSel.current = new Set(checked)
      setUserSel(checked)
      setLoadingUsers(false)
    })()
    return () => { alive = false }
  }, [card.id])

  function toggleUser(id: string) {
    setUserSel(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const [pos, setPos] = useState({ top: 0, left: 0 })
  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: Math.max(8, r.left - 280) })
    }
  }, [anchorRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function toggle(id: AssignmentTarget) {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, 'mural')
      return next
    })
  }

  function setSlot(id: AssignmentTarget, slot: 'mural' | 'grid') {
    setSelected(prev => { const next = new Map(prev); next.set(id, slot); return next })
  }

  async function save() {
    // Executive (shared) dashboards — existing tenant-level store
    const targets = [...selected.keys()]
    const slots: Partial<Record<AssignmentTarget, 'mural' | 'grid'>> = {}
    selected.forEach((slot, target) => { slots[target] = slot })
    if (targets.length === 0) {
      removeAssignment(tid, card.id)
    } else {
      upsertAssignment(tid, card.id, card.title, targets, user.user_id, slots)
    }

    // Per-user assignments — dashboard_assignments is already keyed by user_id
    const before = initialUserSel.current
    const ops: Promise<unknown>[] = []
    for (const u of users) {
      const dash = dashOf(u)
      const now  = userSel.has(u.user_id)
      const was  = before.has(u.user_id)
      if (now && !was) {
        ops.push(assignmentsApi.assign({
          profileId: u.user_id, dashboard: dash,
          cardId: card.id, cardTitle: card.title, slot: 'mural',
        }))
      } else if (!now && was) {
        ops.push(assignmentsApi.remove(u.user_id, dash, card.id, 'mural'))
      }
    }
    await Promise.all(ops)
    initialUserSel.current = new Set(userSel)
    // Refresh the local cache if the active user was affected
    if (users.some(u => u.user_id === user.user_id)) void hydrateAssignments(user.name)

    onSaved(targets.length + userSel.size)
    onClose()
  }

  const q = query.trim().toLowerCase()
  const filteredExec  = EXEC_TARGETS.filter(t => t.label.toLowerCase().includes(q))
  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(q))
  const totalSelected = selected.size + userSel.size

  const inpS: CSSProperties = {
    width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`,
    borderRadius: 7, padding: '7px 10px', fontSize: 12, color: T.text1,
    outline: 'none', boxSizing: 'border-box',
  }
  const groupLabelS: CSSProperties = {
    fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase',
    letterSpacing: '0.07em', padding: '6px 14px 3px',
  }

  return (
    <div ref={popoverRef} style={{
      position: 'fixed', zIndex: 1200,
      top: pos.top, left: pos.left,
      width: 320, background: T.bgSurface, border: `1px solid ${T.border}`,
      borderRadius: 12, boxShadow: T.shadowModal, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          Atribuir a
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text1, marginBottom: 8 }}>
          "{card.title}"
        </div>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar dashboard ou pessoa…"
          style={inpS}
        />
      </div>

      {/* List */}
      <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px 0' }}>
        {filteredExec.length > 0 && (
          <div>
            <div style={groupLabelS}>Executivos</div>
            {filteredExec.map(t => {
              const checked = selected.has(t.id)
              const slot    = selected.get(t.id) ?? 'mural'
              return (
                <div key={t.id}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
                    cursor: 'pointer', background: checked ? `${T.accent}10` : 'transparent',
                    transition: 'background 0.1s',
                  }}>
                    <input
                      type="checkbox" checked={checked} onChange={() => toggle(t.id)}
                      style={{ accentColor: T.accent, width: 14, height: 14, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{t.icon}</span>
                    <span style={{ fontSize: 12, color: checked ? T.text1 : T.text2, fontWeight: checked ? 600 : 400, flex: 1 }}>
                      {t.label}
                    </span>
                  </label>
                  {/* Slot selector — only shown when target is checked */}
                  {checked && (
                    <div style={{ display: 'flex', gap: 4, padding: '0 14px 8px 38px' }}>
                      {(['mural', 'grid'] as const).map(s => (
                        <button
                          key={s}
                          onClick={e => { e.stopPropagation(); setSlot(t.id, s) }}
                          style={{
                            fontSize: 10, fontWeight: slot === s ? 700 : 400,
                            padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                            background: slot === s ? T.accent : T.bgSurface2,
                            color:      slot === s ? '#fff'   : T.text3,
                            border: `1px solid ${slot === s ? T.accent : T.border}`,
                            transition: 'all 0.1s',
                          }}
                        >
                          {s === 'mural' ? 'Mural' : 'Grade'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div>
          <div style={groupLabelS}>Por usuário</div>
          {loadingUsers && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: T.text3 }}>Carregando pessoas…</div>
          )}
          {!loadingUsers && filteredUsers.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: T.text3 }}>Nenhuma pessoa encontrada.</div>
          )}
          {filteredUsers.map(u => {
            const checked = userSel.has(u.user_id)
            return (
              <label key={u.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px',
                cursor: 'pointer', background: checked ? `${T.accent}10` : 'transparent',
                transition: 'background 0.1s',
              }}>
                <input
                  type="checkbox" checked={checked} onChange={() => toggleUser(u.user_id)}
                  style={{ accentColor: T.accent, width: 14, height: 14, flexShrink: 0 }}
                />
                <Avatar name={u.name} size="sm" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, color: checked ? T.text1 : T.text2, fontWeight: checked ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 10, color: T.text3 }}>{u.role_context}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{
          flex: 1, padding: '7px', borderRadius: 7, fontSize: 12,
          background: 'transparent', color: T.text2, border: `1px solid ${T.border}`, cursor: 'pointer',
        }}>Cancelar</button>
        <button onClick={() => { void save() }} style={{
          flex: 2, padding: '7px', borderRadius: 7, fontSize: 12, fontWeight: 700,
          background: T.accent, color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          Salvar{totalSelected > 0 ? ` (${totalSelected})` : ''}
        </button>
      </div>
    </div>
  )
}


// ── Assignment badge ──────────────────────────────────────────────────────────
function AssignBadge({ count, onClick }: { count: number; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(e) }}
      style={{
        fontSize: 10, fontWeight: 700,
        background: T.accentDim, color: T.accent,
        border: `1px solid ${T.accentBorder}`, borderRadius: 99,
        padding: '2px 8px', cursor: 'pointer', lineHeight: 1.5, flexShrink: 0,
      }}
    >
      Em {count} dashboard{count !== 1 ? 's' : ''}
    </button>
  )
}

// ── Pin button ────────────────────────────────────────────────────────────────
function PinButton({ onClick, disabled }: { onClick: (e: React.MouseEvent) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={disabled ? undefined : e => { e.stopPropagation(); onClick(e) }}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={disabled ? 'Requer permissão: Gerenciar Cards de Dashboard' : 'Atribuir a dashboards'}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: disabled ? `${T.text3}0A` : hover ? T.accent : T.bgSurface2,
        color:      disabled ? T.text3        : hover ? '#fff'   : T.text2,
        border: `1px solid ${disabled ? T.border : hover ? T.accent : T.border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 12 }}>📌</span> Atribuir
    </button>
  )
}

// ── Liberação do card para o Board de Composição ─────────────────────────────
function ReleaseToggle({ cardId }: { cardId: string }) {
  const gov = useReportsGovernance()
  const released = isCardReleased(gov, cardId)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    const base = gov.releasedCards ?? REPORT_CARDS.map(c => c.id)
    const next = released ? base.filter(id => id !== cardId) : [...new Set([...base, cardId])]
    await saveReportsGovernance({ releasedCards: next })
    setSaving(false)
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); void toggle() }}
      disabled={saving}
      title="Liberar este card para o Board de Composição dos usuários"
      style={{
        fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '3px 9px',
        cursor: saving ? 'wait' : 'pointer', whiteSpace: 'nowrap',
        background: released ? `${T.success}18` : `${T.text3}14`,
        color: released ? T.success : T.text3,
        border: `1px solid ${released ? `${T.success}55` : T.border}`,
      }}
    >
      {released ? '✓ Liberado' : 'Oculto'}
    </button>
  )
}

// ── Report Card wrapper ───────────────────────────────────────────────────────
interface ReportCardProps {
  def:        ReportCardDef
  canManage:  boolean
  tick:       number
  onAssign:   (card: ReportCardDef, anchorEl: HTMLElement) => void
  children:   React.ReactNode
  focused?:   boolean
}

function ReportCard({ def, canManage, tick, onAssign, children, focused = false }: ReportCardProps) {
  const [hovered, setHovered] = useState(false)
  const pinBtnRef = useRef<HTMLButtonElement>(null)
  const tid = MOCK_TENANT.tenant_id

  void tick  // triggers re-render on store change
  const assignment = getAssignment(tid, def.id)
  const count = assignment?.targets.length ?? 0

  function handleAssign() {
    if (pinBtnRef.current) onAssign(def, pinBtnRef.current)
  }

  return (
    <div
      id={`report-card-${def.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: def.span2 ? 'span 2' : 'span 1',
        background: T.bgSurface,
        border: `1px solid ${focused ? T.accent : hovered ? T.border2 : T.border}`,
        boxShadow: focused ? `0 0 0 3px ${T.accent}33` : undefined,
        borderRadius: px(12),
        padding: px(20),
        display: 'flex',
        flexDirection: 'column',
        gap: px(12),
        position: 'relative',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Card header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.text1, fontWeight: 600, fontSize: px(14) }}>{def.title}</div>
          <div style={{ color: T.text3, fontSize: px(12), marginTop: px(2) }}>{def.subtitle}</div>
        </div>

        {/* Assignment controls — always visible; disabled when no permission */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {canManage && <ReleaseToggle cardId={def.id} />}
          {count > 0 && canManage && (
            <AssignBadge count={count} onClick={handleAssign} />
          )}
          {/* Invisible anchor for popover positioning */}
          <button ref={pinBtnRef} style={{ display: 'none' }} />
          <PinButton
            disabled={!canManage}
            onClick={handleAssign}
          />
        </div>
      </div>

      {children}
    </div>
  )
}

// ── Batch matrix modal ────────────────────────────────────────────────────────
function BatchMatrixModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const tid  = MOCK_TENANT.tenant_id
  const user = getActiveUser()

  // Build initial state from store
  const [matrix, setMatrix] = useState<Record<string, Set<AssignmentTarget>>>(() => {
    const m: Record<string, Set<AssignmentTarget>> = {}
    for (const c of REPORT_CARDS) {
      const a = getAssignment(tid, c.id)
      m[c.id] = new Set(a?.targets ?? [])
    }
    return m
  })
  const [query, setQuery] = useState('')

  const filteredTargets = ASSIGNMENT_TARGETS.filter(t =>
    t.label.toLowerCase().includes(query.toLowerCase())
  )

  function toggleCell(cardId: string, target: AssignmentTarget) {
    setMatrix(prev => {
      const next = { ...prev }
      const set  = new Set(next[cardId])
      if (set.has(target)) set.delete(target); else set.add(target)
      next[cardId] = set
      return next
    })
  }

  function saveAll() {
    for (const card of REPORT_CARDS) {
      const targets = [...matrix[card.id]]
      if (targets.length === 0) {
        removeAssignment(tid, card.id)
      } else {
        upsertAssignment(tid, card.id, card.title, targets, user.user_id)
      }
    }
    onSaved()
    onClose()
  }

  const colW = 88
  const rowH = 40
  const labelW = 200

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bgSurface, border: `1px solid ${T.border}`,
        borderRadius: 16, boxShadow: T.shadowModal,
        width: Math.min(labelW + filteredTargets.length * colW + 48, window.innerWidth - 32),
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px 12px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>Gerenciar atribuições</div>
              <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
                Marque as células para atribuir cards a dashboards de destino.
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 7, background: `${T.text3}14`,
              border: 'none', color: T.text2, cursor: 'pointer', fontSize: 18, lineHeight: 1,
            }}>×</button>
          </div>
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Filtrar dashboards…"
            style={{
              width: 240, background: T.bgSurface2, border: `1px solid ${T.border}`,
              borderRadius: 7, padding: '6px 10px', fontSize: 12, color: T.text1, outline: 'none',
            }}
          />
        </div>

        {/* Matrix */}
        <div data-tour="ra-matrix" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: labelW + filteredTargets.length * colW }}>
            {/* Column headers */}
            <thead>
              <tr>
                <th style={{ width: labelW, minWidth: labelW, padding: '8px 16px', textAlign: 'left', fontSize: 11, color: T.text3, fontWeight: 700, background: T.bgSurface, borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
                  Card
                </th>
                {filteredTargets.map(t => (
                  <th key={t.id} style={{
                    width: colW, minWidth: colW, padding: '6px 4px',
                    textAlign: 'center', fontSize: 10, color: T.text2, fontWeight: 600,
                    background: T.bgSurface, borderBottom: `1px solid ${T.border}`,
                    position: 'sticky', top: 0, zIndex: 2,
                  }}>
                    <div style={{ fontSize: 14, marginBottom: 2 }}>{t.icon}</div>
                    <div style={{ lineHeight: 1.2, maxWidth: colW - 8, margin: '0 auto' }}>{t.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REPORT_CARDS.map((card, ri) => (
                <tr key={card.id} style={{ background: ri % 2 === 0 ? 'transparent' : `${T.text3}05` }}>
                  <td style={{
                    padding: '8px 16px', fontSize: 12, color: T.text1, fontWeight: 500,
                    borderBottom: `1px solid ${T.border}`, height: rowH,
                    position: 'sticky', left: 0, background: ri % 2 === 0 ? T.bgSurface : T.bgSurface2,
                    zIndex: 1,
                  }}>
                    {card.title}
                  </td>
                  {filteredTargets.map(t => {
                    const checked = matrix[card.id].has(t.id)
                    return (
                      <td key={t.id} style={{
                        textAlign: 'center', borderBottom: `1px solid ${T.border}`,
                        padding: 0, height: rowH,
                        background: checked ? `${T.accent}15` : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                        onClick={() => toggleCell(card.id, t.id)}
                      >
                        {checked
                          ? <span style={{ fontSize: 16, color: T.accent }}>✓</span>
                          : <span style={{ fontSize: 14, color: `${T.text3}44` }}>—</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13,
            background: 'transparent', color: T.text2, border: `1px solid ${T.border}`, cursor: 'pointer',
          }}>Cancelar</button>
          <button data-tour="ra-save" onClick={saveAll} style={{
            padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: T.accent, color: '#fff', border: 'none', cursor: 'pointer',
          }}>Salvar todas as atribuições</button>
        </div>
      </div>
    </div>
  )
}

// Card content rendered via registry (single source of truth)
function CardContent({ id }: { id: string }) {
  const entry = REPORT_REGISTRY[id]
  if (!entry) return null
  const Chart = entry.Component
  return <Chart />
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const activeUser = getActiveUser()
  useDashboardAssignments(activeUser.name)
  const [projects, setProjects] = useState<DashboardProjectOption[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [projError, setProjError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // Escopo = projetos AMARRADOS ao perfil do usuário (mesma fonte do HomeFilterProvider).
    Promise.all([
      listDashboardProjects(),
      fetchAssignedProjects({
        tenantId: MOCK_TENANT.tenant_id,
        profileId: activeUser.user_id,
        permissions: activeUser.permissions,
      }),
    ])
      .then(([list, assigned]) => {
        if (!alive) return
        const allowed = new Set(assigned.map(p => p.id))
        const mine = list.filter(p => allowed.has(p.id))
        setProjects(mine)
        setSelected(new Set(mine.map(p => p.id)))
      })
      .catch((e: Error) => { if (alive) setProjError(e.message) })
    return () => { alive = false }
  }, [activeUser.user_id, activeUser.permissions.join(',')])

  // Nunca escopo global: sempre limita aos projetos do perfil.
  const projectIds = [...selected]


  return (
    <ReportsDataProvider projectIds={projectIds}>
      <ReportsPageInner projError={projError} />
    </ReportsDataProvider>
  )
}

function ReportsPageInner({ projError }: { projError: string | null }) {
  const user      = getActiveUser()
  const canManage = can(user.permissions, 'manage:dashboard-cards') || isTenantOwner(user.permissions)

  const [batchOpen,  setBatchOpen] = useState(false)
  const [popCard,    setPopCard]   = useState<ReportCardDef | null>(null)
  const popAnchorRef = useRef<HTMLElement | null>(null)

  // tick forces re-render of all cards after an assignment is saved
  const [tick, setTick] = useState(0)
  // A report/KPI card elsewhere in the app can deep-link into a specific report.
  const [focusId, setFocusId] = useState<string | null>(null)
  useEffect(() => {
    const intent = takeReportNav('reports')
    if (!intent?.reportId) return
    setFocusId(intent.reportId)
    const el = document.getElementById(`report-card-${intent.reportId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setFocusId(null), 2600)
    return () => clearTimeout(t)
  }, [])
  const { msg: toastMsg, toast } = useToast()
  const { data, loading, error, reload } = useReportsData()

  function openAssign(card: ReportCardDef, anchorEl: HTMLElement) {
    popAnchorRef.current = anchorEl
    setPopCard(card)
  }

  function handlePopoverSaved(count: number) {
    setTick(t => t + 1)
    if (count === 0) toast('Atribuição removida.')
    else toast(`Card atribuído a ${count} dashboard${count !== 1 ? 's' : ''}.`)
  }

  function handleBatchSaved() {
    setTick(t => t + 1)
    const all = getAllAssignments(MOCK_TENANT.tenant_id)
    const total = all.reduce((s, a) => s + a.targets.length, 0)
    toast(`Atribuições salvas. ${total} vínculo${total !== 1 ? 's' : ''} ativo${total !== 1 ? 's' : ''}.`)
  }



  return (
    <div style={{ background: T.bgPage, minHeight: '100vh', color: T.text1, fontFamily: 'Inter, sans-serif' }}>
      {/* ── Top bar ── */}
      <div style={{ padding: `${px(28)} ${px(32)} ${px(0)}`, borderBottom: `1px solid ${T.border}`, background: T.bgSurface }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: px(16) }}>
          <div>
            <h1 style={{ margin: 0, fontSize: px(22), fontWeight: 700, color: T.text1 }}>Relatórios & Insights</h1>
            <p style={{ margin: `${px(4)} 0 0`, fontSize: px(13), color: T.text3 }}>
              Métricas de desempenho da equipe e saúde do projeto.
            </p>
          </div>
          <button
            data-tour="reports-assign"
            onClick={canManage ? () => setBatchOpen(true) : undefined}
            disabled={!canManage}
            title={!canManage ? 'Requer permissão: Gerenciar Cards de Dashboard' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: `${px(9)} ${px(18)}`, borderRadius: px(8),
              border: `1px solid ${canManage ? T.accentBorder : T.border}`,
              background: canManage ? T.accentDim : `${T.text3}0A`,
              color: canManage ? T.accent : T.text3,
              fontSize: px(13), fontWeight: 600,
              cursor: canManage ? 'pointer' : 'not-allowed',
              opacity: canManage ? 1 : 0.6,
              whiteSpace: 'nowrap',
            }}
          >
            <span>⊞</span> Gerenciar atribuições
          </button>
        </div>

        {loading && !data && (
          <div style={{ fontSize: px(12), color: T.text3, marginBottom: px(16) }}>
            Carregando agregados…
          </div>
        )}

      </div>

      {/* ── Error banner ── */}
      {(error || projError) && (
        <div style={{ margin: `${px(16)} ${px(24)} 0`, padding: `${px(10)} ${px(14)}`, borderRadius: px(8), background: `${T.crit}14`, border: `1px solid ${T.crit}44`, color: T.crit, fontSize: px(12), display: 'flex', alignItems: 'center', gap: px(10) }}>
          <span style={{ flex: 1 }}>{error ?? projError}</span>
          <button onClick={reload} style={{ fontSize: px(11), color: T.crit, background: 'none', border: `1px solid ${T.crit}55`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Report grid ── */}
      <div data-tour="reports-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: px(16), padding: px(24) }}>
        {REPORT_CARDS.map(def => (
          <ReportCard key={def.id} def={def} canManage={canManage} tick={tick} onAssign={openAssign} focused={focusId === def.id}>
            <CardContent id={def.id} />
          </ReportCard>
        ))}
      </div>


      {/* ── Assign popover ── */}
      {popCard && (
        <AssignPopover
          card={popCard}
          anchorRef={popAnchorRef as React.RefObject<HTMLElement>}
          onClose={() => setPopCard(null)}
          onSaved={handlePopoverSaved}
        />
      )}

      {/* ── Batch matrix modal ── */}
      {batchOpen && (
        <BatchMatrixModal
          onClose={() => setBatchOpen(false)}
          onSaved={handleBatchSaved}
        />
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: T.bgSurface, border: `1px solid ${T.accentBorder}`,
          borderRadius: 10, padding: '11px 18px', boxShadow: T.shadow2,
          fontSize: 13, color: T.text1, display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeIn 0.2s ease',
        }}>
          <span style={{ color: T.success, fontSize: 15 }}>✓</span> {toastMsg}
        </div>
      )}
    </div>
  )
}
