import { useState, useMemo, useRef } from 'react'
import { T } from '../components/ds/tokens'
import {
  ISSUES, EPICS, SPRINTS, STATUS_CFG, PRIORITY_CFG, TYPE_ICON, AV_COLOR,
  type Issue, type IssueStatus, type Priority,
} from '../data/issues'

type SortField = keyof Issue | ''
type SortDir = 'asc' | 'desc'

type BulkField = 'status' | 'priority' | 'assignee' | 'sprint' | 'epic'

const ALL_COLUMNS = [
  { key: 'key',      label: 'Chave',      width: 80  },
  { key: 'type',     label: 'Tipo',       width: 36  },
  { key: 'title',    label: 'Título',     width: 220 },
  { key: 'status',   label: 'Status',     width: 130 },
  { key: 'priority', label: 'Prioridade', width: 100 },
  { key: 'assignee', label: 'Resp.',      width: 60  },
  { key: 'sprint',   label: 'Sprint',     width: 90  },
  { key: 'points',   label: 'Pts',        width: 50  },
  { key: 'epic',     label: 'Épico',      width: 120 },
  { key: 'dueDate',  label: 'Due',        width: 70  },
] as const

type ColKey = typeof ALL_COLUMNS[number]['key']

function Avatar({ initials, size = 26 }: { initials: string; size?: number }) {
  const bg = AV_COLOR[initials] ?? T.text3
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>{initials}</div>
  )
}

function getBulkOptions(field: BulkField): { value: string; label: string }[] {
  if (field === 'status') return (['backlog','todo','in-progress','in-review','done'] as IssueStatus[]).map(s => ({ value: s, label: STATUS_CFG[s].label }))
  if (field === 'priority') return (['critical','high','medium','low'] as Priority[]).map(p => ({ value: p, label: PRIORITY_CFG[p].label }))
  if (field === 'assignee') return ['AL','NM','JN','CS','RM','LF'].map(a => ({ value: a, label: a }))
  if (field === 'sprint') return SPRINTS.map(s => ({ value: s.id, label: s.name }))
  if (field === 'epic') return EPICS.map(e => ({ value: e.id, label: e.label }))
  return []
}

export default function IssueNavigatorPage() {
  const [issues, setIssues] = useState<Issue[]>(() => [...ISSUES])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: '', dir: 'asc' })
  const [quickFilter, setQuickFilter] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkField, setBulkField] = useState<BulkField>('status')
  const [bulkValue, setBulkValue] = useState('')
  const [colConfig, setColConfig] = useState<Record<ColKey, boolean>>(
    () => Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColKey, boolean>
  )
  const [colPopover, setColPopover] = useState(false)
  const colRef = useRef<HTMLDivElement>(null)

  const visibleCols = ALL_COLUMNS.filter(c => colConfig[c.key])

  const filtered = useMemo(() => {
    let list = [...issues]
    if (quickFilter.trim()) {
      const q = quickFilter.toLowerCase()
      list = list.filter(i =>
        i.key.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.assignee.toLowerCase().includes(q) ||
        i.labels.some(l => l.toLowerCase().includes(q))
      )
    }
    if (sort.field) {
      list.sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sort.field] ?? '')
        const bv = String((b as unknown as Record<string, unknown>)[sort.field] ?? '')
        const cmp = av.localeCompare(bv, undefined, { numeric: true })
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [issues, quickFilter, sort])

  function toggleSort(field: SortField) {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'asc' })
  }

  function toggleRow(key: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(key) ? s.delete(key) : s.add(key)
      return s
    })
  }

  function toggleAll() {
    const allKeys = filtered.map(i => i.key)
    if (allKeys.every(k => selected.has(k))) {
      setSelected(prev => { const s = new Set(prev); allKeys.forEach(k => s.delete(k)); return s })
    } else {
      setSelected(prev => { const s = new Set(prev); allKeys.forEach(k => s.add(k)); return s })
    }
  }

  const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.key))
  const partialSelected = !allSelected && filtered.some(i => selected.has(i.key))

  function applyBulk() {
    if (!bulkValue) return
    setIssues(prev => prev.map(i =>
      selected.has(i.key) ? { ...i, [bulkField]: bulkValue } : i
    ))
    setBulkOpen(false)
    setBulkValue('')
  }

  const selCount = selected.size
  const bulkOptions = getBulkOptions(bulkField)

  const sortIcon = (field: SortField) => {
    if (sort.field !== field) return <span style={{ color: T.text3, fontSize: 10 }}>⇅</span>
    return <span style={{ color: T.accent, fontSize: 10 }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bgPage }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px',
        background: T.bgSurface, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text1, marginRight: 4 }}>Issue Navigator</span>
        <span style={{
          fontSize: 12, color: T.text3, background: T.neutralDim,
          borderRadius: 20, padding: '2px 10px',
        }}>{filtered.length}</span>

        {/* Quick filter */}
        <input
          data-tour="nav-quickfilter"
          value={quickFilter}
          onChange={e => setQuickFilter(e.target.value)}
          placeholder="Filtro rápido..."
          style={{
            fontSize: 13, color: T.text2, background: T.bgSurface2,
            border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 12px',
            outline: 'none', width: 200, marginLeft: 8,
          }}
        />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Column config */}
          <div ref={colRef} style={{ position: 'relative' }}>
            <button data-tour="nav-columns" onClick={() => setColPopover(p => !p)} style={{
              fontSize: 12, color: T.text2, background: T.bgSurface2,
              border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            }}>⚙ Colunas</button>
            {colPopover && (
              <div style={{
                position: 'absolute', right: 0, top: 38, zIndex: 200,
                background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 10,
                padding: 14, boxShadow: T.shadowModal, minWidth: 180,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <span style={{ fontSize: 11, color: T.text3, fontWeight: 600, marginBottom: 2 }}>Colunas visíveis</span>
                {ALL_COLUMNS.map(c => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!colConfig[c.key]}
                      onChange={e => setColConfig(prev => ({ ...prev, [c.key]: e.target.checked }))}
                      style={{ accentColor: T.accent }}
                    />
                    <span style={{ fontSize: 12, color: T.text2 }}>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          <button style={{
            fontSize: 12, color: T.text2, background: T.bgSurface2,
            border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
          }}>Exportar</button>

          {/* Bulk Change */}
          <button
            data-tour="nav-bulk"
            onClick={() => selCount > 0 && setBulkOpen(true)}
            disabled={selCount === 0}
            style={{
              fontSize: 12, fontWeight: 700,
              color: selCount > 0 ? T.text1 : T.text3,
              background: selCount > 0 ? T.accentDim : T.neutralDim,
              border: `1px solid ${selCount > 0 ? T.accent + '60' : T.border}`,
              borderRadius: 8, padding: '6px 16px', cursor: selCount > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >Bulk Change{selCount > 0 ? ` (${selCount})` : ''}</button>
        </div>
      </div>

      {/* Table wrapper */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 700 }}>
          <colgroup>
            <col style={{ width: 36 }} />
            {visibleCols.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          {/* Header */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: T.bgSurface2, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = partialSelected }}
                  onChange={toggleAll}
                  style={{ accentColor: T.accent, cursor: 'pointer', width: 14, height: 14 }}
                />
              </th>
              {visibleCols.map(c => (
                <th key={c.key}
                  onClick={() => toggleSort(c.key as SortField)}
                  style={{
                    padding: '10px 10px', textAlign: 'left', fontSize: 11,
                    color: T.text3, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}>
                  {c.label} {sortIcon(c.key as SortField)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((issue, idx) => {
              const isSelected = selected.has(issue.key)
              const ti = TYPE_ICON[issue.type]
              const sc = STATUS_CFG[issue.status]
              const pc = PRIORITY_CFG[issue.priority]
              const epic = EPICS.find(e => e.id === issue.epic)
              const sprint = SPRINTS.find(s => s.id === issue.sprint)

              function cell(col: ColKey) {
                switch (col) {
                  case 'key': return (
                    <span style={{ fontSize: 11, color: T.text3, fontFamily: 'monospace' }}>{issue.key}</span>
                  )
                  case 'type': return (
                    <span style={{ fontSize: 15, color: ti.color }}>{ti.icon}</span>
                  )
                  case 'title': return (
                    <span style={{ fontSize: 13, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {issue.title}
                    </span>
                  )
                  case 'status': return (
                    <span style={{
                      fontSize: 11, color: sc.color, background: sc.bg,
                      borderRadius: 20, padding: '2px 8px',
                    }}>{sc.label}</span>
                  )
                  case 'priority': return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: pc.color, fontSize: 13 }}>{pc.icon}</span>
                      <span style={{ fontSize: 11, color: T.text2 }}>{pc.label}</span>
                    </div>
                  )
                  case 'assignee': return <Avatar initials={issue.assignee} size={24} />
                  case 'sprint': return (
                    <span style={{ fontSize: 11, color: T.text3 }}>{sprint?.name ?? '—'}</span>
                  )
                  case 'points': return (
                    <span style={{
                      fontSize: 11, color: T.text2, background: T.neutralDim,
                      borderRadius: 6, padding: '2px 7px', fontWeight: 700,
                    }}>{issue.points}</span>
                  )
                  case 'epic': return epic ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: epic.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epic.label}</span>
                    </div>
                  ) : <span style={{ color: T.text3, fontSize: 11 }}>—</span>
                  case 'dueDate': return (
                    <span style={{ fontSize: 11, color: T.text3 }}>{issue.dueDate}</span>
                  )
                  default: return null
                }
              }

              return (
                <tr
                  key={issue.key}
                  onClick={() => toggleRow(issue.key)}
                  style={{
                    background: isSelected ? `rgba(125,146,255,0.07)` : idx % 2 === 0 ? T.bgSurface : T.bgPage,
                    borderBottom: `1px solid ${T.border}`,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  <td style={{ padding: '9px 14px', textAlign: 'center' }}
                    onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(issue.key)}
                      style={{ accentColor: T.accent, cursor: 'pointer', width: 14, height: 14 }}
                    />
                  </td>
                  {visibleCols.map(c => (
                    <td key={c.key} style={{ padding: '9px 10px', verticalAlign: 'middle', overflow: 'hidden' }}>
                      {cell(c.key)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', background: T.bgSurface, borderTop: `1px solid ${T.border}`,
        fontSize: 12, color: T.text3, flexShrink: 0,
      }}>
        <span>Mostrando 1–{filtered.length} de {filtered.length}</span>
        {selCount > 0 && (
          <span style={{ color: T.accent }}>{selCount} {selCount === 1 ? 'issue selecionada' : 'issues selecionadas'}</span>
        )}
      </div>

      {/* Bulk Change Modal */}
      {bulkOpen && (
        <div
          onClick={() => setBulkOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.bgSurface, border: `1px solid ${T.border2}`,
              borderRadius: 14, padding: 32, width: 420,
              boxShadow: T.shadowModal,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text1, marginBottom: 4 }}>
              Alterar {selCount} {selCount === 1 ? 'issue' : 'issues'}
            </div>
            <div style={{ fontSize: 12, color: T.text3, marginBottom: 24 }}>
              Você está alterando {selCount} {selCount === 1 ? 'issue' : 'issues'}
            </div>

            {/* Field selector */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Campo</div>
              <select
                value={bulkField}
                onChange={e => { setBulkField(e.target.value as BulkField); setBulkValue('') }}
                style={{
                  width: '100%', fontSize: 13, color: T.text2, background: T.bgSurface2,
                  border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', outline: 'none',
                }}
              >
                {(['status','priority','assignee','sprint','epic'] as BulkField[]).map(f => (
                  <option key={f} value={f}>
                    {f === 'status' ? 'Status' : f === 'priority' ? 'Prioridade' : f === 'assignee' ? 'Responsável' : f === 'sprint' ? 'Sprint' : 'Épico'}
                  </option>
                ))}
              </select>
            </div>

            {/* Value selector */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Novo valor</div>
              <select
                value={bulkValue}
                onChange={e => setBulkValue(e.target.value)}
                style={{
                  width: '100%', fontSize: 13, color: T.text2, background: T.bgSurface2,
                  border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', outline: 'none',
                }}
              >
                <option value="">— selecione —</option>
                {bulkOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBulkOpen(false)}
                style={{
                  fontSize: 13, color: T.text2, background: T.bgSurface2,
                  border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
                }}
              >Cancelar</button>
              <button
                onClick={applyBulk}
                disabled={!bulkValue}
                style={{
                  fontSize: 13, fontWeight: 700, color: T.text1,
                  background: bulkValue ? T.accentDim : T.neutralDim,
                  border: `1px solid ${bulkValue ? T.accent + '60' : T.border}`,
                  borderRadius: 8, padding: '8px 20px',
                  cursor: bulkValue ? 'pointer' : 'not-allowed',
                }}
              >Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
