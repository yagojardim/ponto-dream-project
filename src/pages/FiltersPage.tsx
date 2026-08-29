import { useState } from 'react'
import { T } from '../components/ds/tokens'
import {
  ISSUES, EPICS, SPRINTS, STATUS_CFG, PRIORITY_CFG, TYPE_ICON, AV_COLOR,
  type Issue, type IssueStatus, type Priority, type IssueType,
} from '../data/issues'

type FieldKey = 'type' | 'status' | 'priority' | 'assignee' | 'sprint' | 'epic' | 'labels' | 'points' | 'dueDate'
type OperatorKey = 'is' | 'isNot' | 'contains' | 'isEmpty' | 'isNotEmpty' | 'isOneOf' | 'gt' | 'lt'

interface Condition {
  id: number
  not: boolean
  field: FieldKey
  operator: OperatorKey
  value: string
}

const FIELD_LABELS: Record<FieldKey, string> = {
  type: 'Tipo', status: 'Status', priority: 'Prioridade', assignee: 'Responsável',
  sprint: 'Sprint', epic: 'Épico', labels: 'Labels', points: 'Story Points', dueDate: 'Due Date',
}

const ENUM_FIELDS: FieldKey[] = ['type', 'status', 'priority', 'assignee', 'sprint', 'epic']
const NUMBER_FIELDS: FieldKey[] = ['points']

function getOperators(field: FieldKey): { key: OperatorKey; label: string }[] {
  if (NUMBER_FIELDS.includes(field)) return [
    { key: 'is', label: 'é' }, { key: 'gt', label: '>' }, { key: 'lt', label: '<' },
    { key: 'isEmpty', label: 'está vazio' }, { key: 'isNotEmpty', label: 'não está vazio' },
  ]
  if (ENUM_FIELDS.includes(field)) return [
    { key: 'is', label: 'é' }, { key: 'isNot', label: 'não é' },
    { key: 'isOneOf', label: 'é um de' }, { key: 'isEmpty', label: 'está vazio' },
    { key: 'isNotEmpty', label: 'não está vazio' },
  ]
  return [
    { key: 'contains', label: 'contém' }, { key: 'is', label: 'é' },
    { key: 'isNot', label: 'não é' }, { key: 'isEmpty', label: 'está vazio' },
    { key: 'isNotEmpty', label: 'não está vazio' },
  ]
}

function getEnumOptions(field: FieldKey): { value: string; label: string }[] {
  if (field === 'type') return (['story','bug','subtask','epic','feature'] as IssueType[]).map(t => ({ value: t, label: TYPE_ICON[t].icon + ' ' + t }))
  if (field === 'status') return (['backlog','todo','in-progress','in-review','done'] as IssueStatus[]).map(s => ({ value: s, label: STATUS_CFG[s].label }))
  if (field === 'priority') return (['critical','high','medium','low'] as Priority[]).map(p => ({ value: p, label: PRIORITY_CFG[p].label }))
  if (field === 'assignee') return ['AL','NM','JN','CS','RM','LF'].map(a => ({ value: a, label: a }))
  if (field === 'sprint') return SPRINTS.map(s => ({ value: s.id, label: s.name }))
  if (field === 'epic') return EPICS.map(e => ({ value: e.id, label: e.label }))
  return []
}

function issueValue(issue: Issue, field: FieldKey): string {
  if (field === 'type') return issue.type
  if (field === 'status') return issue.status
  if (field === 'priority') return issue.priority
  if (field === 'assignee') return issue.assignee
  if (field === 'sprint') return issue.sprint ?? ''
  if (field === 'epic') return issue.epic ?? ''
  if (field === 'labels') return issue.labels.join(',')
  if (field === 'points') return String(issue.points)
  if (field === 'dueDate') return issue.dueDate
  return ''
}

function evalCondition(issue: Issue, cond: Condition): boolean {
  const val = issueValue(issue, cond.field)
  let result = false
  switch (cond.operator) {
    case 'is': result = val.toLowerCase() === cond.value.toLowerCase(); break
    case 'isNot': result = val.toLowerCase() !== cond.value.toLowerCase(); break
    case 'contains': result = val.toLowerCase().includes(cond.value.toLowerCase()); break
    case 'isEmpty': result = !val || val === ''; break
    case 'isNotEmpty': result = !!val && val !== ''; break
    case 'isOneOf': result = cond.value.split(',').some(v => v.trim().toLowerCase() === val.toLowerCase()); break
    case 'gt': result = parseFloat(val) > parseFloat(cond.value); break
    case 'lt': result = parseFloat(val) < parseFloat(cond.value); break
  }
  return cond.not ? !result : result
}

const SAVED_FILTERS = [
  { name: 'Bugs críticos', conditions: [{ id: 1, not: false, field: 'type' as FieldKey, operator: 'is' as OperatorKey, value: 'bug' }, { id: 2, not: false, field: 'priority' as FieldKey, operator: 'is' as OperatorKey, value: 'critical' }], logic: 'AND' as const },
  { name: 'Minhas issues abertas', conditions: [{ id: 3, not: false, field: 'assignee' as FieldKey, operator: 'is' as OperatorKey, value: 'AL' }, { id: 4, not: false, field: 'status' as FieldKey, operator: 'isNot' as OperatorKey, value: 'done' }], logic: 'AND' as const },
  { name: 'Backlog do EP-03', conditions: [{ id: 5, not: false, field: 'epic' as FieldKey, operator: 'is' as OperatorKey, value: 'EP-03' }, { id: 6, not: false, field: 'status' as FieldKey, operator: 'is' as OperatorKey, value: 'backlog' }], logic: 'AND' as const },
]

let nextId = 100

export default function FiltersPage() {
  const [conditions, setConditions] = useState<Condition[]>([])
  const [groupLogic, setGroupLogic] = useState<'AND' | 'OR'>('AND')

  function addCondition() {
    setConditions(prev => [...prev, { id: nextId++, not: false, field: 'status', operator: 'is', value: '' }])
  }

  function removeCondition(id: number) {
    setConditions(prev => prev.filter(c => c.id !== id))
  }

  function updateCondition(id: number, patch: Partial<Condition>) {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function loadSaved(idx: number) {
    const f = SAVED_FILTERS[idx]
    setConditions(f.conditions.map(c => ({ ...c })))
    setGroupLogic(f.logic)
  }

  // Filter issues
  const filtered = ISSUES.filter(issue => {
    if (conditions.length === 0) return true
    const results = conditions.map(c => evalCondition(issue, c))
    if (groupLogic === 'AND') return results.every(Boolean)
    return results.some(Boolean)
  })

  const sel = { fontSize: 12, color: T.text2, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 6px', outline: 'none' }
  const inp = { fontSize: 12, color: T.text2, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 8px', outline: 'none', width: '100%' }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left panel */}
      <div data-tour="filters-builder" style={{
        width: 320, flexShrink: 0, background: T.bgSurface, borderRight: `1px solid ${T.border}`,
        padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>Construtor de Filtros</span>

        {/* Group logic toggle */}
        <div>
          <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Lógica do grupo</div>
          <div style={{ display: 'flex', gap: 0, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
            {(['AND', 'OR'] as const).map(l => (
              <button key={l} onClick={() => setGroupLogic(l)} style={{
                padding: '5px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: groupLogic === l ? T.accentDim : 'transparent',
                color: groupLogic === l ? T.accent : T.text3,
                border: 'none',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Conditions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {conditions.map(cond => {
            const ops = getOperators(cond.field)
            const opts = getEnumOptions(cond.field)
            const isEnum = ENUM_FIELDS.includes(cond.field)
            const isNum = NUMBER_FIELDS.includes(cond.field)
            const needsValue = !['isEmpty', 'isNotEmpty'].includes(cond.operator)
            return (
              <div key={cond.id} style={{
                background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* NOT toggle */}
                  <button onClick={() => updateCondition(cond.id, { not: !cond.not })} style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                    background: cond.not ? T.critDim : T.neutralDim,
                    color: cond.not ? T.crit : T.text3,
                    border: `1px solid ${cond.not ? T.crit + '50' : T.border}`,
                  }}>NOT</button>
                  {/* Field */}
                  <select value={cond.field} onChange={e => updateCondition(cond.id, { field: e.target.value as FieldKey, operator: 'is', value: '' })} style={{ ...sel, flex: 1 }}>
                    {(Object.keys(FIELD_LABELS) as FieldKey[]).map(f => (
                      <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                    ))}
                  </select>
                  {/* Remove */}
                  <button onClick={() => removeCondition(cond.id)} style={{
                    background: 'transparent', border: 'none', color: T.text3,
                    cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
                  }}>×</button>
                </div>
                {/* Operator */}
                <select value={cond.operator} onChange={e => updateCondition(cond.id, { operator: e.target.value as OperatorKey })} style={sel}>
                  {ops.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                {/* Value */}
                {needsValue && (
                  isEnum ? (
                    <select value={cond.value} onChange={e => updateCondition(cond.id, { value: e.target.value })} style={sel}>
                      <option value="">— selecione —</option>
                      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={isNum ? 'number' : 'text'}
                      value={cond.value}
                      onChange={e => updateCondition(cond.id, { value: e.target.value })}
                      placeholder={isNum ? '0' : 'valor...'}
                      style={inp}
                    />
                  )
                )}
              </div>
            )
          })}
          <button data-tour="filters-add" onClick={addCondition} style={{
            fontSize: 12, color: T.accent, background: T.accentDim,
            border: `1px solid ${T.accent}40`, borderRadius: 8, padding: '7px 14px',
            cursor: 'pointer', textAlign: 'left',
          }}>+ Adicionar condição</button>
        </div>

        <div style={{ height: 1, background: T.border }} />

        {/* Saved filters */}
        <div data-tour="filters-saved">
          <div style={{ fontSize: 11, color: T.text3, marginBottom: 8, fontWeight: 600 }}>Filtros salvos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SAVED_FILTERS.map((f, i) => (
              <button key={i} onClick={() => loadSaved(i)} style={{
                fontSize: 12, color: T.text2, background: 'transparent',
                border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 12px',
                cursor: 'pointer', textAlign: 'left',
              }}>{f.name}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{
            flex: 1, fontSize: 12, color: T.text1, background: T.accentDim,
            border: `1px solid ${T.accent}40`, borderRadius: 6, padding: '7px', cursor: 'pointer',
          }}>Salvar filtro</button>
          <button onClick={() => { setConditions([]); setGroupLogic('AND') }} style={{
            fontSize: 12, color: T.text3, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline',
          }}>Limpar</button>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>
            {filtered.length} {filtered.length === 1 ? 'issue encontrada' : 'issues encontradas'}
          </span>
          <button style={{
            fontSize: 12, color: T.text2, background: T.neutralDim,
            border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
          }}>Aplicar como visão</button>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, color: T.text3 }}>Nenhuma issue corresponde a este filtro</div>
          </div>
        ) : (
          <div style={{
            background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 36px 1fr 130px 110px 70px',
              padding: '10px 14px',
              background: T.bgSurface2,
              borderBottom: `1px solid ${T.border}`,
            }}>
              {['Chave', 'Tipo', 'Título', 'Status', 'Prioridade', 'Resp.'].map(h => (
                <span key={h} style={{ fontSize: 11, color: T.text3, fontWeight: 600 }}>{h}</span>
              ))}
            </div>
            {/* Rows */}
            {filtered.map((issue, idx) => {
              const ti = TYPE_ICON[issue.type]
              const sc = STATUS_CFG[issue.status]
              const pc = PRIORITY_CFG[issue.priority]
              const av = AV_COLOR[issue.assignee] ?? T.text3
              return (
                <div key={issue.key} style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 36px 1fr 130px 110px 70px',
                  padding: '10px 14px',
                  borderBottom: idx < filtered.length - 1 ? `1px solid ${T.border}` : 'none',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, color: T.text3, fontFamily: 'monospace' }}>{issue.key}</span>
                  <span style={{ fontSize: 14, color: ti.color }}>{ti.icon}</span>
                  <span style={{ fontSize: 13, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{issue.title}</span>
                  <span style={{
                    fontSize: 11, color: sc.color, background: sc.bg,
                    borderRadius: 20, padding: '2px 8px', width: 'fit-content',
                  }}>{sc.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: pc.color, fontSize: 13 }}>{pc.icon}</span>
                    <span style={{ fontSize: 11, color: T.text2 }}>{pc.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: av,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#fff',
                    }}>{issue.assignee}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
