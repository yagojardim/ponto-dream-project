import { useState } from 'react'
import { T } from './ds/tokens'
import type { BoardFilter, FilterCondition } from '@/data/db/filterTranslator'

type FieldKey = 'type' | 'status' | 'priority' | 'assignee_id' | 'sprint_id' | 'epic_id'
type OperatorKey = 'eq' | 'neq' | 'in'

const FIELD_LABELS: Record<FieldKey, string> = {
  type: 'Tipo',
  status: 'Status',
  priority: 'Prioridade',
  assignee_id: 'Responsável',
  sprint_id: 'Sprint',
  epic_id: 'Épico',
}

const OPERATOR_LABELS: Record<OperatorKey, string> = {
  eq: 'é',
  neq: 'não é',
  in: 'é um de',
}

const FIELD_OPTIONS: Record<FieldKey, { value: string; label: string }[]> = {
  type: [
    { value: 'story', label: '📘 Story' },
    { value: 'bug', label: '⬟ Bug' },
    { value: 'task', label: '☑ Task' },
    { value: 'subtask', label: '◻ Subtask' },
    { value: 'epic', label: '⚡ Epic' },
    { value: 'feature', label: '▣ Feature' },
  ],
  status: [
    { value: 'backlog', label: 'Backlog' },
    { value: 'todo', label: 'A Fazer' },
    { value: 'in-progress', label: 'Em Andamento' },
    { value: 'in-review', label: 'Em Revisão' },
    { value: 'done', label: 'Concluído' },
  ],
  priority: [
    { value: 'critical', label: 'Crítica' },
    { value: 'high', label: 'Alta' },
    { value: 'medium', label: 'Média' },
    { value: 'low', label: 'Baixa' },
  ],
  assignee_id: [],
  sprint_id: [],
  epic_id: [],
}

interface InternalCondition {
  id: number
  field: FieldKey
  operator: OperatorKey
  value: string
}

let _nextId = 1000

function conditionsFromFilter(filter?: BoardFilter | null): InternalCondition[] {
  if (!filter?.conditions?.length) return []
  return filter.conditions.map(c => ({
    id: _nextId++,
    field: (c.field || 'status') as FieldKey,
    operator: (c.operator || 'eq') as OperatorKey,
    value: Array.isArray(c.value) ? c.value.join(',') : (c.value || ''),
  }))
}

function conditionsToFilter(conditions: InternalCondition[], logic: 'AND' | 'OR'): BoardFilter {
  if (conditions.length === 0) return { conditions: [], logic: 'AND' }
  return {
    logic,
    conditions: conditions.map(c => ({
      field: c.field,
      operator: c.operator,
      value: c.operator === 'in' ? c.value.split(',').map(v => v.trim()).filter(Boolean) : c.value,
    })),
  }
}

interface FilterBuilderProps {
  value?: BoardFilter | null
  onChange: (filter: BoardFilter) => void
  compact?: boolean
}

export function FilterBuilder({ value, onChange, compact = false }: FilterBuilderProps) {
  const [conditions, setConditions] = useState<InternalCondition[]>(() => conditionsFromFilter(value))
  const [logic, setLogic] = useState<'AND' | 'OR'>(value?.logic ?? 'AND')

  function emit(next: InternalCondition[], nextLogic?: 'AND' | 'OR') {
    const l = nextLogic ?? logic
    setConditions(next)
    if (nextLogic !== undefined) setLogic(l)
    onChange(conditionsToFilter(next, l))
  }

  function addCondition() {
    const next = [...conditions, { id: _nextId++, field: 'status' as FieldKey, operator: 'eq' as OperatorKey, value: '' }]
    emit(next)
  }

  function removeCondition(id: number) {
    emit(conditions.filter(c => c.id !== id))
  }

  function updateCondition(id: number, patch: Partial<InternalCondition>) {
    emit(conditions.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function changeLogic(l: 'AND' | 'OR') {
    emit(conditions, l)
  }

  const sel: React.CSSProperties = {
    fontSize: 12, color: T.text2, background: T.bgSurface2,
    border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 6px', outline: 'none',
  }
  const inp: React.CSSProperties = {
    fontSize: 12, color: T.text2, background: T.bgSurface2,
    border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 8px', outline: 'none', width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
      {/* Logic toggle */}
      {conditions.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: T.text3 }}>Lógica:</span>
          <div style={{
            display: 'flex', gap: 0, background: T.bgSurface2,
            border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden', width: 'fit-content',
          }}>
            {(['AND', 'OR'] as const).map(l => (
              <button key={l} onClick={() => changeLogic(l)} style={{
                padding: '3px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: logic === l ? T.accentDim : 'transparent',
                color: logic === l ? T.accent : T.text3,
                border: 'none',
              }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      {conditions.map(cond => {
        const opts = FIELD_OPTIONS[cond.field] ?? []
        const hasOpts = opts.length > 0
        return (
          <div key={cond.id} style={{
            background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: compact ? 8 : 10,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={cond.field}
                onChange={e => updateCondition(cond.id, { field: e.target.value as FieldKey, value: '' })}
                style={{ ...sel, flex: 1 }}
              >
                {(Object.keys(FIELD_LABELS) as FieldKey[]).map(f => (
                  <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                ))}
              </select>
              <select
                value={cond.operator}
                onChange={e => updateCondition(cond.id, { operator: e.target.value as OperatorKey })}
                style={sel}
              >
                {(Object.keys(OPERATOR_LABELS) as OperatorKey[]).map(o => (
                  <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>
                ))}
              </select>
              <button
                onClick={() => removeCondition(cond.id)}
                style={{
                  background: 'transparent', border: 'none', color: T.text3,
                  cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0,
                }}
                aria-label="Remover condição"
              >×</button>
            </div>
            {hasOpts ? (
              <select
                value={cond.value}
                onChange={e => updateCondition(cond.id, { value: e.target.value })}
                style={sel}
              >
                <option value="">— selecione —</option>
                {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                value={cond.value}
                onChange={e => updateCondition(cond.id, { value: e.target.value })}
                placeholder="valor…"
                style={inp}
              />
            )}
          </div>
        )
      })}

      <button
        onClick={addCondition}
        style={{
          fontSize: 12, color: T.accent, background: T.accentDim,
          border: `1px solid ${T.accent}40`, borderRadius: 8, padding: '6px 12px',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        + Adicionar condição
      </button>

      {conditions.length === 0 && (
        <span style={{ fontSize: 11, color: T.text3 }}>Nenhuma condição — o board mostrará todos os itens do projeto.</span>
      )}
    </div>
  )
}
