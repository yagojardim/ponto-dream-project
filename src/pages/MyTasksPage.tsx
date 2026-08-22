import { useCallback, useEffect, useState } from 'react'
import { T } from '../components/ds/tokens'
import {
  StatusBadge,
  ConditionalTag,
  type WorkItem,
  type WorkStatus,
} from '../components/ds/DashboardKit'
import { WorkItemDetail } from '../components/WorkItemDetail'
import { listMyQueue, type QueueItem } from '../data/db/myQueue'
import { getActiveUser } from '../data/session'

// ─── DB → UI mapping ─────────────────────────────────────────────────────────
const DB_STATUS_TO_UI: Record<string, WorkStatus> = {
  backlog: 'backlog', todo: 'todo', in_progress: 'in-progress', 'in-progress': 'in-progress',
  in_review: 'in-review', 'in-review': 'in-review', blocked: 'blocked', done: 'done', ready: 'ready',
}
const DB_PRIORITY_TO_UI: Record<string, WorkItem['priority']> = {
  critical: 'critical', critica: 'critical', 'crítica': 'critical',
  high: 'high', alta: 'high', medium: 'medium', media: 'medium', 'média': 'medium',
  low: 'low', baixa: 'low',
}
const DB_TYPE_TO_UI: Record<string, WorkItem['type']> = {
  story: 'story', task: 'task', bug: 'bug', epic: 'epic', subtask: 'subtask', feature: 'story',
}

function toWorkItem(q: QueueItem): WorkItem {
  const status = q.blocked ? 'blocked' : (DB_STATUS_TO_UI[q.status] ?? 'backlog')
  return {
    id: q.id,
    key: q.key,
    title: q.title,
    type: DB_TYPE_TO_UI[q.type] ?? 'task',
    status,
    priority: DB_PRIORITY_TO_UI[q.priority] ?? 'medium',
    sprint: q.sprintName ?? undefined,
    project_id: q.projectId,
    squad_id: '',
    points: q.storyPoints ?? undefined,
    due_date: q.dueDateIso ?? undefined,
    tags: q.epicName ? [q.epicName] : undefined,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const PRIORITY_COLOR: Record<string, string> = {
  critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#5C5C7A',
}
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo',
}
const TYPE_ICON: Record<string, string> = {
  story: '📘', task: '✅', bug: '🐛', epic: '⚡', subtask: '↳',
}

type GroupBy = 'status' | 'priority' | 'sprint' | 'project'
type SortBy  = 'priority' | 'due_date' | 'created' | 'status'

const STATUS_ORDER: Record<string, number> = {
  blocked: 0, 'in-progress': 1, 'in-review': 2, testing: 3, todo: 4, backlog: 5, done: 6, cancelled: 7,
}

function sortItems(items: WorkItem[], by: SortBy): WorkItem[] {
  return [...items].sort((a, b) => {
    switch (by) {
      case 'priority': return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
      case 'status':   return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      case 'due_date': return (a.due_date ?? 'z').localeCompare(b.due_date ?? 'z')
      case 'created':  return 0
    }
  })
}

function groupItems(items: WorkItem[], by: GroupBy, projectNames?: Map<string, string>): { label: string; color: string; items: WorkItem[] }[] {
  const map = new Map<string, WorkItem[]>()
  for (const item of items) {
    let key: string
    switch (by) {
      case 'status':   key = item.status; break
      case 'priority': key = item.priority; break
      case 'sprint':   key = item.sprint ?? 'Sem sprint'; break
      case 'project':  key = item.project_id; break
    }
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }

  return [...map.entries()].map(([key, items]) => {
    let label: string = key
    let color: string = T.text3
    switch (by) {
      case 'status':
        label = ({ blocked: 'Bloqueado', 'in-progress': 'Em Dev', 'in-review': 'Em Revisão',
                   testing: 'Em Teste', todo: 'A Fazer', backlog: 'Backlog', done: 'Concluído',
                   cancelled: 'Cancelado', ready: 'Ready' } as Record<string,string>)[key] ?? key
        color = ({ blocked: T.crit, 'in-progress': T.accent, 'in-review': T.indigo,
                   testing: T.warn, done: T.success, ready: T.success } as Record<string,string>)[key] ?? T.text3
        break
      case 'priority':
        label = PRIORITY_LABEL[key] ?? key
        color = PRIORITY_COLOR[key] ?? T.text3
        break
      case 'sprint':
        label = key
        color = key.includes('14') ? T.accent : T.text3
        break
      case 'project':
        label = projectNames?.get(key) ?? key
        color = T.accent
        break
    }
    return { label, color, items }
  })
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ItemRow({ item, onOpen }: { item: WorkItem; onOpen: (i: WorkItem) => void }) {
  const [hov, setHov] = useState(false)
  const isBlocked = item.status === 'blocked'
  const isDone    = item.status === 'done' || item.status === 'cancelled'

  return (
    <div
      onClick={() => onOpen(item)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px', cursor: 'pointer', borderRadius: 8,
        background: hov ? `${T.text3}0C` : 'transparent',
        opacity: isDone ? 0.5 : 1,
        transition: 'background 0.1s',
      }}
    >
      {/* Priority dot */}
      <span
        title={PRIORITY_LABEL[item.priority]}
        style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: PRIORITY_COLOR[item.priority] ?? T.text3,
          boxShadow: item.priority === 'critical' ? `0 0 5px ${T.crit}80` : 'none',
        }}
      />

      {/* Type icon */}
      <span style={{ fontSize: 12, flexShrink: 0, width: 16, textAlign: 'center' }}>
        {TYPE_ICON[item.type] ?? '·'}
      </span>

      {/* Key */}
      <span style={{
        fontSize: 10, fontFamily: 'monospace', color: T.text3,
        width: 60, flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        {item.key}
      </span>

      {/* Title */}
      <span style={{
        flex: 1, fontSize: 13, color: isDone ? T.text3 : T.text1,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        textDecoration: isDone ? 'line-through' : 'none',
      }}>
        {item.title}
      </span>

      {/* Tags */}
      {hov && item.tags && item.tags.slice(0, 2).map(t => (
        <span key={t} style={{
          fontSize: 10, color: T.text3, background: `${T.text3}12`,
          border: `1px solid ${T.border}`, borderRadius: 4, padding: '1px 6px', flexShrink: 0,
        }}>{t}</span>
      ))}

      {/* Blocked badge */}
      {isBlocked && (
        <ConditionalTag label={`${item.days_blocked ?? 1}d bloqueado`} severity="crit" />
      )}

      {/* Sprint */}
      {item.sprint && (
        <span style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>{item.sprint}</span>
      )}

      {/* Points */}
      {item.points != null && (
        <span style={{
          fontSize: 10, color: T.text3, background: `${T.text3}10`,
          border: `1px solid ${T.border}`, borderRadius: 4, padding: '1px 6px', flexShrink: 0,
        }}>{item.points}pt</span>
      )}

      {/* Status */}
      <StatusBadge status={item.status} />
    </div>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({
  label, color, items, onOpen,
}: {
  label: string; color: string; items: WorkItem[]
  onOpen: (i: WorkItem) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Group header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 14px', borderRadius: 8, background: 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}0A` }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          style={{ color: T.text3, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s', flexShrink: 0 }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text1 }}>{label}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color, background: `${color}18`,
          border: `1px solid ${color}33`, borderRadius: 99, padding: '1px 7px',
        }}>{items.length}</span>
      </button>

      {/* Rows */}
      {!collapsed && (
        <div style={{
          borderLeft: `2px solid ${color}40`,
          marginLeft: 18, paddingLeft: 4,
        }}>
          {items.map(item => (
            <ItemRow key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyQueue() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 32px', gap: 12,
    }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ color: T.text3 }}>
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4"/>
        <path d="M17 24l5 5 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p style={{ fontSize: 14, fontWeight: 600, color: T.text2, margin: 0 }}>Fila limpa</p>
      <p style={{ fontSize: 12, color: T.text3, margin: 0, textAlign: 'center' }}>
        Nenhuma issue atribuída a você no momento.
      </p>
    </div>
  )
}

function AllDoneEmpty({ count, onShow }: { count: number; onShow: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 32px', gap: 12,
    }}>
      <span style={{ fontSize: 36 }}>🎉</span>
      <p style={{ fontSize: 14, fontWeight: 600, color: T.text2, margin: 0 }}>
        Tudo concluído por aqui
      </p>
      <p style={{ fontSize: 12, color: T.text3, margin: 0, textAlign: 'center' }}>
        Você tem {count} issue{count === 1 ? '' : 's'} concluída{count === 1 ? '' : 's'}.
      </p>
      <button
        onClick={onShow}
        style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: T.success + '18', color: T.success,
          border: `1px solid ${T.success}44`, cursor: 'pointer',
        }}
      >
        Mostrar concluídas
      </button>
    </div>
  )
}

// ─── Stat strip ──────────────────────────────────────────────────────────────

function StatStrip({ items }: { items: WorkItem[] }) {
  const blocked    = items.filter(i => i.status === 'blocked').length
  const inProgress = items.filter(i => i.status === 'in-progress').length
  const inReview   = items.filter(i => i.status === 'in-review').length
  const done       = items.filter(i => i.status === 'done').length
  const critHigh   = items.filter(i => i.priority === 'critical' || i.priority === 'high').length

  const stats = [
    { label: 'Total',        value: items.length,  color: T.text1   },
    { label: 'Em Dev',       value: inProgress,    color: T.accent  },
    { label: 'Em Revisão',   value: inReview,      color: T.indigo  },
    { label: 'Bloqueados',   value: blocked,       color: T.crit,   alert: blocked > 0 },
    { label: 'P. Alta/Crit', value: critHigh,      color: T.warn,   alert: critHigh > 0 },
    { label: 'Concluídos',   value: done,          color: T.success },
  ]

  return (
    <div className="grid grid-cols-6 gap-3 mb-6">
      {stats.map(s => (
        <div
          key={s.label}
          style={{
            padding: '12px 16px', borderRadius: 10,
            background: T.bgSurface, border: `1px solid ${s.alert ? s.color + '44' : T.border}`,
            boxShadow: s.alert ? `0 0 8px ${s.color}20` : 'none',
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: 10, color: T.text2, marginTop: 3 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({
  groupBy, onGroupBy, sortBy, onSortBy, hideCompleted, onHideCompleted, query, onQuery,
}: {
  groupBy: GroupBy; onGroupBy: (g: GroupBy) => void
  sortBy: SortBy;   onSortBy:  (s: SortBy) => void
  hideCompleted: boolean; onHideCompleted: (v: boolean) => void
  query: string; onQuery: (q: string) => void
}) {
  const btnStyle = (active: boolean, color: string = T.accent) => ({
    padding: '5px 11px', borderRadius: 6, fontSize: 12,
    fontWeight: active ? 600 : 400,
    background: active ? `${color}18` : 'transparent',
    color: active ? color : T.text2,
    border: `1px solid ${active ? color + '44' : T.border}`,
    cursor: 'pointer', transition: 'all 0.12s',
  })

  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      {/* Search */}
      <div
        className="flex items-center gap-2 h-8 px-3 rounded-lg"
        style={{ background: T.bgSurface2, border: `1px solid ${T.border}`, minWidth: 200 }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ color: T.text3, flexShrink: 0 }}>
          <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M9 9L7.5 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <input
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Filtrar issues..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: T.text1 }}
        />
        {query && (
          <button onClick={() => onQuery('')} style={{ fontSize: 14, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Group by */}
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 11, color: T.text3, marginRight: 2 }}>Agrupar:</span>
        {(['status', 'priority', 'sprint', 'project'] as GroupBy[]).map(g => (
          <button key={g} onClick={() => onGroupBy(g)} style={btnStyle(groupBy === g)}>
            {{ status: 'Status', priority: 'Prioridade', sprint: 'Sprint', project: 'Projeto' }[g]}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 11, color: T.text3, marginRight: 2 }}>Ordenar:</span>
        {(['priority', 'status', 'due_date'] as SortBy[]).map(s => (
          <button key={s} onClick={() => onSortBy(s)} style={btnStyle(sortBy === s, T.indigo as string)}>
            {({ priority: 'Prioridade', status: 'Status', due_date: 'Prazo' } as Record<string,string>)[s]}
          </button>
        ))}
      </div>

      {/* Hide done toggle */}
      <button
        onClick={() => onHideCompleted(!hideCompleted)}
        style={btnStyle(hideCompleted, T.neutral as string)}
      >
        {hideCompleted ? '↓ Mostrar concluídas' : '↑ Ocultar concluídas'}
      </button>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MyTasksPage({ onNav }: { onNav?: (view: string, targetId?: string) => void }) {
  void onNav
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null)
  const [groupBy, setGroupBy]     = useState<GroupBy>('status')
  const [sortBy, setSortBy]       = useState<SortBy>('priority')
  const [hideCompleted, setHide]  = useState(true)
  const [query, setQuery]         = useState('')

  const user = getActiveUser()

  const [queue, setQueue]     = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setQueue((await listMyQueue(user.name)).items) }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setLoading(false) }
  }, [user.name])

  useEffect(() => { void load() }, [load])

  const projectNames = new Map(queue.map(q => [q.projectId, q.projectName]))
  const items = queue.map(toWorkItem)

  let filtered = hideCompleted
    ? items.filter(i => i.status !== 'done' && i.status !== 'cancelled')
    : items

  if (query.trim()) {
    const q = query.trim().toLowerCase()
    filtered = filtered.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.key.toLowerCase().includes(q) ||
      (i.tags ?? []).some(t => t.toLowerCase().includes(q))
    )
  }

  const sorted = sortItems(filtered, sortBy)
  const groups = groupItems(sorted, groupBy, projectNames)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {drawerItemId && (
        <WorkItemDetail
          itemId={drawerItemId}
          mode="drawer"
          onUpdate={() => { /* the panel persists on its own */ }}
          onClose={() => { setDrawerItemId(null); void load() }}
        />
      )}


      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: user.avatar_color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff',
            }}>
              {user.avatar_initials}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text1 }}>
                Minha Fila
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: T.text2 }}>
                {user.name} · {user.role_context}
              </p>
            </div>
          </div>
        </div>

        {/* Quick link to board */}
        <button
          onClick={() => onNav?.('project')}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: T.bgSurface, border: `1px solid ${T.border}`,
            color: T.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.accent; (e.currentTarget as HTMLButtonElement).style.color = T.accent }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.color = T.text2 }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="1" y="1" width="3" height="11" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="5" y="1" width="3" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="9" y="1" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          Ver board
        </button>
      </div>

      {/* Stat strip */}
      <StatStrip items={items} />

      {/* Toolbar */}
      <Toolbar
        groupBy={groupBy} onGroupBy={setGroupBy}
        sortBy={sortBy}   onSortBy={setSortBy}
        hideCompleted={hideCompleted} onHideCompleted={setHide}
        query={query} onQuery={setQuery}
      />

      {/* Content */}
      <div style={{
        background: T.bgSurface, borderRadius: 12,
        border: `1px solid ${T.border}`, overflow: 'hidden', padding: '8px 0',
      }}>
        {loading ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', fontSize: 13, color: T.text3 }}>Carregando sua fila…</div>
        ) : error ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', fontSize: 13, color: T.crit }}>Erro ao carregar: {error}</div>
        ) : filtered.length === 0 ? (
          <EmptyQueue />
        ) : (
          groups.map(g => (
            <GroupSection
              key={g.label}
              label={g.label}
              color={g.color}
              items={g.items}
              onOpen={item => setDrawerItemId(item.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
