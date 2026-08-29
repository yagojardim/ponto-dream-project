import { useState, useEffect, useCallback } from 'react'
import { T } from '../components/ds/tokens'
import { useSession } from '../data/SessionContext'
import { can } from '../data/permissions'
import { WorkItemDetail } from '../components/WorkItemDetail'
import {
  resolveProfileIdByName, listSquads, getApproverSquads, setApproverSquads,
  listPendingForApprover, approveEntries, rejectEntries,
  type TimesheetEntry, type TimesheetStatus, type SquadOption,
} from '../data/db/timesheets'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function exportCSV(rows: TimesheetEntry[], filename: string) {
  const headers = ['Colaborador','Data','Projeto','Demanda','Horas','Descrição','Status','Squad']
  const lines = [
    headers,
    ...rows.map(e => [
      e.user_name, e.date, e.project_name,
      `${e.item_key ?? ''} ${e.item_title ?? ''}`.trim(),
      String(e.hours), e.description ?? '', e.status, e.squad_name ?? '',
    ]),
  ].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const STATUS_META: Record<TimesheetStatus, { label: string; bg: string; txt: string; dot: string }> = {
  draft:     { label: 'Salvo',     bg: `${T.border}22`,  txt: T.text3,   dot: T.border2 },
  submitted: { label: 'Enviado',   bg: `${T.warn}18`,    txt: T.warn,    dot: T.warn    },
  approved:  { label: 'Aprovado',  bg: `${T.success}18`, txt: T.success, dot: T.success },
  rejected:  { label: 'Rejeitado', bg: `${T.crit}18`,    txt: T.crit,    dot: T.crit    },
}

function StatusBadge({ status }: { status: TimesheetStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 99, background: m.bg, fontSize: 11, color: m.txt, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

// ─── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ count, onConfirm, onCancel }: { count: number; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(9,9,11,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, width: 420, padding: 24, boxShadow: T.shadowModal }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text1, marginBottom: 6 }}>Rejeitar lançamento{count > 1 ? 's' : ''}</div>
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 16 }}>
          {count > 1 ? `${count} lançamentos serão rejeitados.` : 'Informe o motivo da rejeição.'}
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Descreva o motivo…"
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text1, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 8, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text2, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}
            style={{ padding: '8px 16px', borderRadius: 8, background: reason.trim() ? T.crit : T.border2, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: reason.trim() ? 'pointer' : 'not-allowed' }}>
            Rejeitar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Squad Setup ──────────────────────────────────────────────────────────────
function SquadSetup({ squads, current, saving, onSave }: {
  squads: SquadOption[]; current: string[]; saving: boolean; onSave: (squads: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(current)

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, boxShadow: T.shadowModal }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text1, marginBottom: 6 }}>Squads que você aprova</div>
      <div style={{ fontSize: 12, color: T.text3, marginBottom: 20 }}>Selecione os squads cujos lançamentos aparecem para você revisar.</div>
      {squads.length === 0 && (
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 20 }}>Nenhum squad cadastrado no tenant.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {squads.map(s => {
          const on = selected.includes(s.id)
          return (
            <button key={s.id} onClick={() => toggle(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 9, cursor: 'pointer',
              background: on ? `${T.accent}10` : T.bgPage,
              borderTop:    `1px solid ${on ? T.accent : T.border}`,
              borderRight:  `1px solid ${on ? T.accent : T.border}`,
              borderBottom: `1px solid ${on ? T.accent : T.border}`,
              borderLeft:   `3px solid ${on ? T.accent : 'transparent'}`,
              transition: 'all 0.15s',
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: on ? T.accent : T.border2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {on && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>{s.name}</span>
            </button>
          )
        })}
      </div>
      <button onClick={() => onSave(selected)}
        disabled={selected.length === 0 || saving}
        style={{ width: '100%', padding: '10px', borderRadius: 9, background: selected.length > 0 && !saving ? T.accent : T.border2, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: selected.length > 0 && !saving ? 'pointer' : 'not-allowed' }}>
        {saving ? 'Salvando…' : 'Confirmar'}
      </button>
    </div>
  )
}

const inputSt: React.CSSProperties = { padding: '6px 10px', borderRadius: 7, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text1, fontSize: 12, outline: 'none' }

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HoursApprovalPage() {
  const { activeUser } = useSession()
  const { permissions, name: userName } = activeUser
  const allowed = can(permissions, 'approve:hours')

  const [profileId, setProfileId] = useState<string | null>(null)
  const [squads, setSquads] = useState<SquadOption[]>([])
  const [mySquads, setMySquads] = useState<string[]>([])
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSquads, setSavingSquads] = useState(false)
  const [error, setError] = useState('')
  const [editingSquads, setEditingSquads] = useState(false)

  const [filterStatus, setFilterStatus] = useState<TimesheetStatus | 'all'>('submitted')
  const [filterSquad, setFilterSquad] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejectTarget, setRejectTarget] = useState<'single' | 'batch' | 'lane' | null>(null)
  const [rejectId, setRejectId] = useState('')
  const [laneRejectIds, setLaneRejectIds] = useState<string[]>([])

  const [toast, setToast] = useState('')
  const [detailItemId, setDetailItemId] = useState<string | null>(null)

  const loadQueue = useCallback(async (pid: string) => {
    setLoading(true)
    const queue = await listPendingForApprover(pid)
    setEntries(queue.entries)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!allowed) { setLoading(false); return }
    let alive = true
    void (async () => {
      setLoading(true)
      const [pid, allSquads] = await Promise.all([resolveProfileIdByName(userName), listSquads()])
      if (!alive) return
      setSquads(allSquads)
      setProfileId(pid)
      if (!pid) {
        setError(`Não encontramos o perfil "${userName}" no banco. Verifique o cadastro em Pessoas.`)
        setLoading(false)
        return
      }
      setError('')
      const mine = await getApproverSquads(pid)
      if (!alive) return
      setMySquads(mine)
      if (mine.length === 0) { setLoading(false); return }
      await loadQueue(pid)
    })()
    return () => { alive = false }
  }, [allowed, userName, loadQueue])

  if (!allowed) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.text3, fontSize: 14 }}>Sem permissão para aprovar horas.</div>
  }

  async function handleSaveSquads(next: string[]) {
    if (!profileId) return
    setSavingSquads(true)
    await setApproverSquads(profileId, next, userName)
    setMySquads(next)
    setSavingSquads(false)
    setEditingSquads(false)
    await loadQueue(profileId)
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ background: `${T.crit}12`, border: `1px solid ${T.crit}44`, borderRadius: 10, padding: '14px 18px', color: T.crit, fontSize: 13 }}>{error}</div>
      </div>
    )
  }

  if (loading && entries.length === 0 && mySquads.length === 0 && !editingSquads) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.text3, fontSize: 13 }}>Carregando…</div>
  }

  if (editingSquads || mySquads.length === 0) {
    return (
      <SquadSetup squads={squads} current={mySquads} saving={savingSquads}
        onSave={next => { void handleSaveSquads(next) }} />
    )
  }

  const filtered = entries.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterSquad !== 'all' && e.squad_id !== filterSquad) return false
    return true
  })

  const submittedInView = filtered.filter(e => e.status === 'submitted')
  const allChecked = submittedInView.length > 0 && submittedInView.every(e => selected.has(e.id))

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(submittedInView.map(e => e.id)))
  }

  async function runDecision(ids: string[], decision: 'approved' | 'rejected', reason?: string) {
    if (!profileId) return
    const n = decision === 'approved'
      ? await approveEntries(ids, profileId, userName)
      : await rejectEntries(ids, profileId, userName, reason ?? '')
    setSelected(new Set())
    await loadQueue(profileId)
    showToast(n > 0
      ? `${n} lançamento(s) ${decision === 'approved' ? 'aprovado(s)' : 'rejeitado(s)'}.`
      : 'Nenhum lançamento foi alterado.')
  }

  function handleRejectConfirm(reason: string) {
    const ids = rejectTarget === 'single' ? [rejectId]
      : rejectTarget === 'lane' ? laneRejectIds
      : Array.from(selected)
    setRejectTarget(null); setRejectId(''); setLaneRejectIds([])
    void runDecision(ids, 'rejected', reason)
  }

  // Group by collaborator (swimlanes)
  const byUser = new Map<string, { name: string; initials: string; entries: TimesheetEntry[] }>()
  for (const e of filtered) {
    const k = e.user_id || e.user_name
    let lane = byUser.get(k)
    if (!lane) { lane = { name: e.user_name, initials: e.user_initials, entries: [] }; byUser.set(k, lane) }
    lane.entries.push(e)
  }
  const lanes = Array.from(byUser.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR'))


  return (
    <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto', position: 'relative' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 18px', color: T.text1, fontSize: 13, boxShadow: T.shadowModal }}>
          {toast}
        </div>
      )}
      {rejectTarget && (
        <RejectModal
          count={rejectTarget === 'batch' ? selected.size : rejectTarget === 'lane' ? laneRejectIds.length : 1}
          onConfirm={handleRejectConfirm}
          onCancel={() => { setRejectTarget(null); setRejectId(''); setLaneRejectIds([]) }}
        />

      )}
      {detailItemId && (
        <WorkItemDetail
          itemId={detailItemId}
          mode="drawer"
          onUpdate={() => { /* the panel persists on its own */ }}
          onClose={() => setDetailItemId(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text1 }}>Aprovar Horas</div>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
            Squads: {mySquads.map(s => squads.find(x => x.id === s)?.name ?? s).join(', ')}
            <button onClick={() => setEditingSquads(true)} style={{ marginLeft: 8, fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Editar</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.size > 0 && (
            <>
              <button onClick={() => exportCSV(filtered.filter(e => selected.has(e.id)), 'horas-selecionados.csv')} style={{ padding: '7px 14px', borderRadius: 8, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text2, fontSize: 12, cursor: 'pointer' }}>
                ↓ CSV ({selected.size})
              </button>
              <button onClick={() => setRejectTarget('batch')} style={{ padding: '7px 14px', borderRadius: 8, background: T.bgPage, border: `1px solid ${T.border}`, color: T.crit, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Rejeitar ({selected.size})
              </button>
              <button onClick={() => { void runDecision(Array.from(selected), 'approved') }} style={{ padding: '7px 14px', borderRadius: 8, background: T.success, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Aprovar ({selected.size})
              </button>
            </>
          )}
          <button data-tour="ha-export" onClick={() => exportCSV(filtered, `horas-${filterSquad === 'all' ? 'todos' : filterSquad}.csv`)} style={{ padding: '7px 14px', borderRadius: 8, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text2, fontSize: 12, cursor: 'pointer' }}>
            ↓ Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div data-tour="ha-filters" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all', 'submitted', 'approved', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: filterStatus === s ? T.accent : T.bgPage,
            color: filterStatus === s ? '#fff' : T.text2,
            border: `1px solid ${filterStatus === s ? T.accent : T.border}`,
          }}>
            {s === 'all' ? 'Todos' : STATUS_META[s].label}
          </button>
        ))}
        <select value={filterSquad} onChange={e => setFilterSquad(e.target.value)} style={{ ...inputSt, marginLeft: 'auto' }}>
          <option value="all">Todos os squads</option>
          {mySquads.map(s => <option key={s} value={s}>{squads.find(x => x.id === s)?.name ?? s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '60px 20px', textAlign: 'center', color: T.text3, fontSize: 13 }}>
          Carregando lançamentos…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '60px 20px', textAlign: 'center', color: T.text3, fontSize: 13 }}>
          Nenhum lançamento para os filtros selecionados.
        </div>
      ) : (
        lanes.map(([laneKey, lane]) => {
          const laneEntries = lane.entries
          const laneSubmitted = laneEntries.filter(e => e.status === 'submitted')
          const laneChecked = laneSubmitted.length > 0 && laneSubmitted.every(e => selected.has(e.id))
          const laneHours = laneEntries.reduce((s, e) => s + Number(e.hours || 0), 0)
          function toggleLane() {
            setSelected(prev => {
              const n = new Set(prev)
              if (laneChecked) laneSubmitted.forEach(e => n.delete(e.id))
              else laneSubmitted.forEach(e => n.add(e.id))
              return n
            })
          }
          return (
            <div key={laneKey} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', marginBottom: 4 }}>
                <input type="checkbox" checked={laneChecked} disabled={laneSubmitted.length === 0} onChange={toggleLane} style={{ cursor: laneSubmitted.length ? 'pointer' : 'not-allowed' }} />
                <div style={{ width: 26, height: 26, borderRadius: 99, background: T.accent + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                  {lane.initials}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>{lane.name}</span>
                <span style={{ fontSize: 11, color: T.text3 }}>
                  {laneHours.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h · {laneEntries.length} lançamento{laneEntries.length !== 1 ? 's' : ''}
                </span>
                <div data-tour="ha-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button onClick={() => exportCSV(laneEntries, `horas-${lane.name.replace(/\s+/g, '-').toLowerCase()}.csv`)}
                    style={{ padding: '4px 10px', borderRadius: 6, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text2, fontSize: 11, cursor: 'pointer' }}>↓ CSV</button>
                  {laneSubmitted.length > 0 && (
                    <>
                      <button onClick={() => { void runDecision(laneSubmitted.map(e => e.id), 'approved') }}
                        style={{ padding: '4px 10px', borderRadius: 6, background: `${T.success}18`, border: `1px solid ${T.success}44`, color: T.success, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✓ Aprovar todos</button>
                      <button onClick={() => { setLaneRejectIds(laneSubmitted.map(e => e.id)); setRejectTarget('lane') }}
                        style={{ padding: '4px 10px', borderRadius: 6, background: `${T.crit}12`, border: `1px solid ${T.crit}44`, color: T.crit, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✕ Rejeitar todos</button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      <th style={{ padding: '9px 12px', width: 32 }}>
                        <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                      </th>
                      {['Colaborador','Data','Projeto','Demanda','Horas','Descrição','Status','Ações'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.text3, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {laneEntries.map(entry => {

                      const isChecked = selected.has(entry.id)
                      return (
                        <tr key={entry.id} style={{ borderBottom: `1px solid ${T.border}`, background: isChecked ? `${T.accent}09` : 'transparent', transition: 'background 0.1s' }}
                          onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = `${T.accent}06` }}
                          onMouseLeave={e => { e.currentTarget.style.background = isChecked ? `${T.accent}09` : 'transparent' }}>
                          <td style={{ padding: '10px 12px' }}>
                            {entry.status === 'submitted' && (
                              <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(entry.id)} style={{ cursor: 'pointer' }} />
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 99, background: T.accent + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                                {entry.user_initials}
                              </div>
                              <span style={{ fontSize: 12, color: T.text1, fontWeight: 500 }}>{entry.user_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: T.text2, whiteSpace: 'nowrap' }}>{fmtDate(entry.date)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: T.text3, whiteSpace: 'nowrap' }}>{entry.project_name}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: T.text1 }}>
                            {entry.work_item_id ? (
                              <button onClick={() => setDetailItemId(entry.work_item_id)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: T.accent, background: `${T.accent}12`, borderRadius: 4, padding: '1px 5px', marginRight: 4 }}>{entry.item_key}</span>
                                <span style={{ color: T.text2 }}>{entry.item_title}</span>
                              </button>
                            ) : <span style={{ color: T.text3 }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: T.text1, whiteSpace: 'nowrap' }}>{entry.hours}h</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: T.text2, maxWidth: 180 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description || '—'}</span>
                            {entry.reject_reason && <span style={{ display: 'block', fontSize: 10, color: T.crit, marginTop: 2 }}>✕ {entry.reject_reason}</span>}
                          </td>
                          <td style={{ padding: '10px 12px' }}><StatusBadge status={entry.status} /></td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            {entry.status === 'submitted' && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => { void runDecision([entry.id], 'approved') }} style={{ padding: '4px 10px', borderRadius: 6, background: `${T.success}18`, border: `1px solid ${T.success}44`, color: T.success, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✓</button>
                                <button onClick={() => { setRejectId(entry.id); setRejectTarget('single') }} style={{ padding: '4px 10px', borderRadius: 6, background: `${T.crit}12`, border: `1px solid ${T.crit}44`, color: T.crit, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✕</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
