// Shared filter translator — converts board.filter conditions into Supabase
// query modifiers. Reuses the same synonym maps the List page uses so that
// UI-facing filter values match every DB variant (pt-BR, snake_case, etc.).

/** UI filter value → every value the database may actually store for it. */
export const STATUS_MATCHES: Record<string, string[]> = {
  backlog: ['backlog'],
  todo: ['todo', 'to_do', 'a_fazer'],
  'in-progress': ['in_progress', 'in-progress', 'doing', 'em_andamento'],
  'in-review': ['in_review', 'in-review', 'review', 'em_revisao'],
  blocked: ['blocked', 'bloqueado'],
  done: ['done', 'concluido', 'concluído'],
}

export const PRIORITY_MATCHES: Record<string, string[]> = {
  critical: ['critical', 'critica', 'crítica'],
  high: ['high', 'alta'],
  medium: ['medium', 'media', 'média'],
  low: ['low', 'baixa'],
}

export const TYPE_MATCHES: Record<string, string[]> = {
  story: ['story', 'user_story', 'historia', 'história'],
  bug: ['bug', 'erro', 'defeito'],
  task: ['task', 'tarefa'],
  subtask: ['subtask', 'sub_task', 'subtarefa'],
  epic: ['epic', 'epico', 'épico'],
  feature: ['feature', 'funcionalidade'],
}

/** Maps a field name to its synonym lookup table (when applicable). */
const FIELD_SYNONYMS: Record<string, Record<string, string[]>> = {
  status: STATUS_MATCHES,
  priority: PRIORITY_MATCHES,
  type: TYPE_MATCHES,
}

/** A single filter condition as stored in board.filter. */
export interface FilterCondition {
  field: string
  operator: string // 'eq' | 'in' | 'neq' | 'ilike'
  value: string | string[]
}

/** The shape of board.filter persisted as JSONB. */
export interface BoardFilter {
  conditions?: FilterCondition[]
  logic?: 'AND' | 'OR'
}

/** Expand a UI value to all DB synonyms for the given field. */
function expandValues(field: string, values: string[]): string[] {
  const synonyms = FIELD_SYNONYMS[field]
  if (!synonyms) return values
  const expanded = new Set<string>()
  for (const v of values) {
    const matches = synonyms[v]
    if (matches) {
      for (const m of matches) expanded.add(m)
    } else {
      expanded.add(v)
    }
  }
  return [...expanded]
}

/**
 * Applies filter conditions to a Supabase query builder.
 * Returns the (possibly modified) query.
 *
 * For AND logic each condition is chained sequentially.
 * For OR logic the conditions are combined into a single `.or()` clause.
 */
export function applyBoardFilter<Q extends {
  eq: (col: string, val: string) => Q
  neq: (col: string, val: string) => Q
  in: (col: string, vals: string[]) => Q
  ilike: (col: string, pattern: string) => Q
  or: (filters: string) => Q
}>(query: Q, filter: BoardFilter | null | undefined): Q {
  if (!filter || !filter.conditions || filter.conditions.length === 0) return query

  const conditions = filter.conditions
  const logic = filter.logic ?? 'AND'

  if (logic === 'AND') {
    let q = query
    for (const cond of conditions) {
      q = applyCondition(q, cond)
    }
    return q
  }

  // OR: build a PostgREST .or() string
  const parts: string[] = []
  for (const cond of conditions) {
    const part = conditionToOrString(cond)
    if (part) parts.push(part)
  }
  if (parts.length === 0) return query
  return query.or(parts.join(','))
}

function applyCondition<Q extends {
  eq: (col: string, val: string) => Q
  neq: (col: string, val: string) => Q
  in: (col: string, vals: string[]) => Q
  ilike: (col: string, pattern: string) => Q
}>(query: Q, cond: FilterCondition): Q {
  const vals = Array.isArray(cond.value) ? cond.value : [cond.value]
  const expanded = expandValues(cond.field, vals)

  switch (cond.operator) {
    case 'eq':
      if (expanded.length === 1) return query.eq(cond.field, expanded[0])
      return query.in(cond.field, expanded)
    case 'in':
      return query.in(cond.field, expanded)
    case 'neq':
      // neq only makes sense for single value
      return query.neq(cond.field, expanded[0])
    case 'ilike':
      return query.ilike(cond.field, `%${vals[0]}%`)
    default:
      // Unknown operator — treat as eq
      if (expanded.length === 1) return query.eq(cond.field, expanded[0])
      return query.in(cond.field, expanded)
  }
}

/** Converts a single condition to a PostgREST or-filter fragment. */
function conditionToOrString(cond: FilterCondition): string | null {
  const vals = Array.isArray(cond.value) ? cond.value : [cond.value]
  const expanded = expandValues(cond.field, vals)
  if (expanded.length === 0) return null

  switch (cond.operator) {
    case 'eq':
      if (expanded.length === 1) return `${cond.field}.eq.${expanded[0]}`
      return `${cond.field}.in.(${expanded.join(',')})`
    case 'in':
      return `${cond.field}.in.(${expanded.join(',')})`
    case 'neq':
      return `${cond.field}.neq.${expanded[0]}`
    case 'ilike':
      return `${cond.field}.ilike.%25${vals[0]}%25`
    default:
      if (expanded.length === 1) return `${cond.field}.eq.${expanded[0]}`
      return `${cond.field}.in.(${expanded.join(',')})`
  }
}
