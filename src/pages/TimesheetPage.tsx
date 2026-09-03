import { useState, useRef, useEffect, useCallback } from 'react'
import { T } from '../components/ds/tokens'
import { useSession } from '../data/SessionContext'
import { can } from '../data/permissions'
import {
  resolveProfileIdByName, searchDemands, listMyEntries, createEntry, updateEntry,
  deleteEntry, submitForApproval, listApprovers,
  type TimesheetEntry, type TimesheetStatus, type DemandOption, type ApproverOption,
} from '../data/db/timesheets'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function monthLabel(ym: string) {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [y, m] = ym.split('-')
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_LABELS: Record<TimesheetStatus, string> = {
  draft:     'Salvo',
  submitted: 'Enviado',
  approved:  'Aprovado',
  rejected:  'Rejeitado',
}

const STATUS_COLORS: Record<TimesheetStatus, { bg: string; txt: string; dot: string }> = {
  draft:     { bg: `${T.border}22`,  txt: T.text3,   dot: T.border2 },
  submitted: { bg: `${T.warn}18`,    txt: T.warn,    dot: T.warn    },
  approved:  { bg: `${T.success}18`, txt: T.success, dot: T.success },
  rejected:  { bg: `${T.crit}18`,    txt: T.crit,    dot: T.crit    },
}

const inputSt: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 7,
  background: T.bgPage, border: `1px solid ${T.border}`,
  color: T.text1, fontSize: 13, outline: 'none',
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TimesheetStatus }) {
  const { bg, txt, dot } = STATUS_COLORS[status] ?? STATUS_COLORS.draft
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 99, background: bg, fontSize: 11, color: txt, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: dot, flexShrink: 0 }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── DemandCombobox — single search field over real work items ────────────────
function DemandCombobox({ value, onChange }: { value: DemandOption | null; onChange: (v: DemandOption) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<DemandOption[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      void searchDemands(query).then(res => {
        if (!alive) return
        setOptions(res)
        setLoading(false)
      })
    }, 180)
    return () => { alive = false; clearTimeout(t) }
  }, [query, open])

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <input
        value={open ? query : (value?.label ?? '')}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        placeholder="Buscar demanda por nome, chave, épico ou feature…"
        style={{ ...inputSt, width: '100%', boxSizing: 'border-box' }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: T.bgSurface, border: `1px solid ${T.border}`,
          borderRadius: 8, marginTop: 2, maxHeight: 260, overflowY: 'auto',
          boxShadow: T.shadowModal,
        }}>
          {loading
            ? <div style={{ padding: '12px 14px', color: T.text3, fontSize: 12 }}>Buscando…</div>
            : options.length === 0
              ? <div style={{ padding: '12px 14px', color: T.text3, fontSize: 12 }}>Nenhuma demanda encontrada.</div>
              : options.map(item => (
                <button key={item.work_item_id}
                  onMouseDown={e => { e.preventDefault(); onChange(item); setOpen(false); setQuery('') }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', padding: '8px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${T.accent}12`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <span style={{ fontSize: 12, color: T.text1, fontWeight: 500 }}>{item.label}</span>
                  <span style={{ fontSize: 10, color: T.text3 }}>
                    {item.project_name}{item.epic_name ? ` · ${item.epic_name}` : ''}{item.feature_name ? ` · ${item.feature_name}` : ''}
                  </span>
                </button>
              ))
          }
        </div>
      )}
    </div>
  )
}

// ─── EditModal ────────────────────────────────────────────────────────────────
interface EditState { entry: TimesheetEntry; date: string; item: DemandOption | null; hours: string; description: string }

function EditModal({ state, onSave, onCancel }: { state: EditState; onSave: (s: EditState) => void; onCancel: () => void }) {
  const [s, setS] = useState(state)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(9,9,11,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, width: 480, padding: 24, boxShadow: T.shadowModal }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text1, marginBottom: 20 }}>Editar lançamento</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Data</div>
              <input type="date" value={s.date} onChange={e => setS(p => ({ ...p, date: e.target.value }))}
                style={{ ...inputSt, width: 140 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Horas</div>
              <input type="number" min="0.5" max="24" step="0.5" value={s.hours} onChange={e => setS(p => ({ ...p, hours: e.target.value }))}
                style={{ ...inputSt, width: 80 }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Demanda</div>
            <DemandCombobox value={s.item} onChange={item => setS(p => ({ ...p, item }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Descrição</div>
            <textarea value={s.description} onChange={e => setS(p => ({ ...p, description: e.target.value }))} rows={3}
              style={{ ...inputSt, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 8, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text2, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(s)} style={{ padding: '8px 16px', borderRadius: 8, background: T.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TimesheetPage() {
  const { activeUser } = useSession()
  const { permissions, name: userName } = activeUser
  const allowed = can(permissions, 'log:hours')

  const [profileId, setProfileId] = useState<string | null>(null)
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [approvers, setApprovers] = useState<ApproverOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formDate, setFormDate] = useState(today())
  const [formItem, setFormItem] = useState<DemandOption | null>(null)
  const [formHours, setFormHours] = useState('1')
  const [formDesc, setFormDesc] = useState('')
  const [formErr, setFormErr] = useState('')
  const [saving, setSaving] = useState(false)

  // Filter state
  const [filterStatus, setFilterStatus] = useState<TimesheetStatus | 'all'>('all')
  const [filterMonth, setFilterMonth] = useState('all')

  // Approval flow
  const [approvalPeriod, setApprovalPeriod] = useState(() => today().slice(0, 7))
  const [approvalApproverId, setApprovalApproverId] = useState('')
  const [approvalStep, setApprovalStep] = useState<'idle' | 'choose' | 'done'>('idle')
  const [approvalMsg, setApprovalMsg] = useState('')

  // Edit
  const [editing, setEditing] = useState<EditState | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async (pid: string) => {
    setLoading(true)
    const rows = await listMyEntries(pid)
    setEntries(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!allowed) { setLoading(false); return }
    let alive = true
    void (async () => {
      setLoading(true)
      const [pid, appr] = await Promise.all([resolveProfileIdByName(userName), listApprovers()])
      if (!alive) return
      setApprovers(appr)
      setProfileId(pid)
      if (!pid) {
        setError(`Não encontramos o perfil "${userName}" no banco. Verifique o cadastro em Pessoas.`)
        setEntries([])
        setLoading(false)
        return
      }
      setError('')
      await load(pid)
    })()
    return () => { alive = false }
  }, [allowed, userName, load])

  if (!allowed) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.text3, fontSize: 14 }}>Sem permissão para lançar horas.</div>
  }

  const months = Array.from(new Set(entries.map(e => e.date.slice(0, 7)))).sort().reverse()

  const filtered = entries.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterMonth !== 'all' && !e.date.startsWith(filterMonth)) return false
    return true
  })

  const sendableInPeriod = entries.filter(e => (e.status === 'draft' || e.status === 'rejected') && e.date.startsWith(approvalPeriod))
  const totalHours = filtered.reduce((s, e) => s + e.hours, 0)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleAddOk() {
    if (!profileId) return
    if (!formItem) { setFormErr('Selecione uma demanda.'); return }
    const h = parseFloat(formHours)
    if (!h || h <= 0) { setFormErr('Informe um número de horas válido.'); return }
    setFormErr(''); setSaving(true)
    const row = await createEntry({
      profileId,
      projectId: formItem.project_id,
      workItemId: formItem.work_item_id,
      date: formDate,
      hours: h,
      description: formDesc,
      actorName: userName,
    })
    setSaving(false)
    if (!row) { setFormErr('Não foi possível salvar o lançamento. Tente novamente.'); return }
    setFormItem(null); setFormHours('1'); setFormDesc(''); setFormDate(today())
    setShowForm(false)
    await load(profileId)
    showToast('Lançamento salvo no histórico.')
  }

  async function handleDelete(e: TimesheetEntry) {
    if (!profileId) return
    const ok = await deleteEntry(e.id, userName)
    await load(profileId)
    showToast(ok ? 'Lançamento excluído.' : 'Lançamento aprovado não pode ser excluído.')
  }

  function handleEditOpen(e: TimesheetEntry) {
    setEditing({
      entry: e,
      date: e.date,
      item: e.work_item_id
        ? { work_item_id: e.work_item_id, key: e.item_key ?? '', title: e.item_title ?? '', project_id: e.project_id, project_name: e.project_name, epic_name: null, feature_name: null, label: `${e.item_key ?? ''} · ${e.item_title ?? ''}` }
        : null,
      hours: String(e.hours),
      description: e.description ?? '',
    })
  }

  async function handleEditSave(s: EditState) {
    if (!profileId) return
    const ok = await updateEntry(s.entry.id, {
      date: s.date,
      hours: parseFloat(s.hours),
      description: s.description,
      projectId: s.item?.project_id,
      workItemId: s.item?.work_item_id ?? null,
    }, userName)
    setEditing(null)
    await load(profileId)
    showToast(ok ? 'Lançamento atualizado.' : 'Lançamento aprovado não pode ser editado.')
  }

  async function sendPeriod(approver: ApproverOption) {
    if (!profileId) return
    const n = await submitForApproval(sendableInPeriod.map(e => e.id), approver.id, userName)
    await load(profileId)
    setApprovalMsg(`${n} lançamento(s) enviado(s) para ${approver.name}.`)
    setApprovalStep('done')
  }

  async function handleSendApproval() {
    if (sendableInPeriod.length === 0) { showToast('Nenhum lançamento salvo neste período.'); return }
    if (approvers.length === 0) { showToast('Nenhum aprovador disponível.'); return }
    if (approvers.length === 1) await sendPeriod(approvers[0])
    else setApprovalStep('choose')
  }

  async function handleFinalizar() {
    const a = approvers.find(x => x.id === approvalApproverId)
    if (!a) return
    await sendPeriod(a)
    setApprovalApproverId('')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto', position: 'relative' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 18px', color: T.text1, fontSize: 13, boxShadow: T.shadowModal }}>
          {toast}
        </div>
      )}

      {editing && <EditModal state={editing} onSave={s => { void handleEditSave(s) }} onCancel={() => setEditing(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text1 }}>Lançar Horas</div>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>Registre as horas trabalhadas por demanda</div>
        </div>
        <button data-tour="ts-new" onClick={() => setShowForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, background: T.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Novo lançamento
        </button>
      </div>

      {error && (
        <div style={{ background: `${T.crit}12`, border: `1px solid ${T.crit}44`, borderRadius: 10, padding: '12px 16px', color: T.crit, fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div data-tour="ts-form" style={{ background: T.bgSurface, border: `1px solid ${T.accent}55`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text1, marginBottom: 14 }}>Novo lançamento</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Data</div>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ ...inputSt, width: 140 }} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Demanda</div>
              <DemandCombobox value={formItem} onChange={setFormItem} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Horas</div>
              <input type="number" min="0.5" max="24" step="0.5" value={formHours} onChange={e => setFormHours(e.target.value)} style={{ ...inputSt, width: 80 }} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Descrição (opcional)</div>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="O que foi feito…" style={{ ...inputSt, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <button data-tour="ts-ok" onClick={() => { void handleAddOk() }} disabled={saving || !profileId}
              style={{ padding: '7px 22px', borderRadius: 8, background: saving || !profileId ? T.border2 : T.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving || !profileId ? 'not-allowed' : 'pointer' }}>
              {saving ? '…' : 'OK'}
            </button>
          </div>
          {formErr && <div style={{ marginTop: 8, fontSize: 11, color: T.crit }}>{formErr}</div>}
        </div>
      )}

      {/* History — single tab with status / month filters */}
      <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <div data-tour="ts-filters" style={{ padding: '12px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'draft', 'submitted', 'approved', 'rejected'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: filterStatus === s ? T.accent : T.bgPage,
              color: filterStatus === s ? '#fff' : T.text2,
              border: `1px solid ${filterStatus === s ? T.accent : T.border}`,
              transition: 'all 0.15s',
            }}>
              {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            style={{ ...inputSt, fontSize: 12, padding: '4px 10px', marginLeft: 'auto' }}>
            <option value="all">Todos os meses</option>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>

        {loading
          ? <div style={{ padding: '40px 20px', textAlign: 'center', color: T.text3, fontSize: 13 }}>Carregando lançamentos…</div>
          : filtered.length === 0
            ? <div style={{ padding: '40px 20px', textAlign: 'center', color: T.text3, fontSize: 13 }}>Nenhum lançamento para os filtros selecionados.</div>
            : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['Data','Demanda','Projeto','Horas','Descrição','Status',''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.text3, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => {
                  const editable = entry.status !== 'approved'
                  return (
                    <tr key={entry.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = `${T.accent}08`)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: T.text2, whiteSpace: 'nowrap' }}>{fmtDate(entry.date)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: T.text1 }}>
                        {entry.item_key && <span style={{ fontFamily: 'monospace', fontSize: 11, color: T.accent, marginRight: 4 }}>{entry.item_key}</span>}
                        {entry.item_title ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: T.text3, whiteSpace: 'nowrap' }}>{entry.project_name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: T.text1, whiteSpace: 'nowrap' }}>{entry.hours}h</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: T.text2, maxWidth: 200 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description || '—'}</span>
                        {entry.reject_reason && <span style={{ display: 'block', fontSize: 10, color: T.crit, marginTop: 2 }}>✕ {entry.reject_reason}</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={entry.status} /></td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {editable && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleEditOpen(entry)} title="Editar" style={{ padding: '4px 8px', borderRadius: 6, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text2, fontSize: 11, cursor: 'pointer' }}>✏</button>
                            <button onClick={() => { void handleDelete(entry) }} title="Excluir" style={{ padding: '4px 8px', borderRadius: 6, background: T.bgPage, border: `1px solid ${T.border}`, color: T.crit, fontSize: 11, cursor: 'pointer' }}>✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: T.bgPage }}>
                  <td colSpan={3} style={{ padding: '9px 14px', fontSize: 11, color: T.text3 }}>{filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: T.text1 }}>{totalHours}h</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          )
        }
      </div>

      {/* Send for approval */}
      <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text1, marginBottom: 12 }}>Enviar lançamentos para aprovação</div>
        {approvalStep === 'done' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: T.success }}>✓ {approvalMsg}</span>
            <button onClick={() => setApprovalStep('idle')} style={{ padding: '5px 12px', borderRadius: 7, background: T.bgPage, border: `1px solid ${T.border}`, color: T.text2, fontSize: 12, cursor: 'pointer' }}>Novo envio</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Período</div>
              <input type="month" value={approvalPeriod} onChange={e => { setApprovalPeriod(e.target.value); setApprovalStep('idle') }} style={{ ...inputSt }} />
            </div>
            <span style={{ fontSize: 11, color: sendableInPeriod.length > 0 ? T.text3 : T.border2, paddingBottom: 9 }}>
              {sendableInPeriod.length > 0 ? `${sendableInPeriod.length} salvo(s) neste período` : 'Nenhum lançamento salvo neste período'}
            </span>
            {approvalStep === 'choose' && (
              <div>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Aprovador</div>
                <select value={approvalApproverId} onChange={e => setApprovalApproverId(e.target.value)} style={{ ...inputSt, minWidth: 180 }}>
                  <option value="">Selecione…</option>
                  {approvers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {approvalStep === 'choose' ? (
              <button onClick={() => { void handleFinalizar() }} disabled={!approvalApproverId} style={{ padding: '7px 18px', borderRadius: 8, background: approvalApproverId ? T.accent : T.border2, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: approvalApproverId ? 'pointer' : 'not-allowed' }}>
                Finalizar
              </button>
            ) : (
              <button data-tour="ts-submit" onClick={() => { void handleSendApproval() }} disabled={sendableInPeriod.length === 0} style={{ padding: '7px 18px', borderRadius: 8, background: sendableInPeriod.length > 0 ? T.accent : T.border2, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sendableInPeriod.length > 0 ? 'pointer' : 'not-allowed' }}>
                Enviar para aprovação →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
