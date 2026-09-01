import { useEffect, useMemo, useRef, useState } from 'react'
import { T as DS } from './ds/tokens'

export interface DailyMember { id: string; initials: string; name: string; color: string | null }
export interface DailyColumn { id: string; label: string; dot: string }
export interface DailyIssue {
  id?: string
  key: string
  title: string
  colId?: string
  assigneeId: string | null
  points?: number
  type?: string
}

interface DailyModalProps {
  open: boolean
  projectName: string
  sprintName: string
  columns: DailyColumn[]
  issues: DailyIssue[]
  members: DailyMember[]
  /** Persists the move (moveWorkItemToColumn). Throws on failure. */
  onMove: (issue: DailyIssue, colId: string) => Promise<void>
  /** Called when the meeting ends — parent should reload the board. */
  onClose: () => void
}

const S = {
  surface: DS.bgSurface,
  surface2: DS.bgSurface2,
  border: DS.border,
  border2: DS.border2,
  t1: DS.text1,
  t2: DS.text2,
  t3: DS.text3,
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function DailyModal({
  open, projectName, sprintName, columns, issues, members, onMove, onClose,
}: DailyModalProps) {
  // local (optimistic) card placement — persisted moves are done via onMove
  const [localCols, setLocalCols] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // round state
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<string[]>([])
  const [filterId, setFilterId] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [limitMin, setLimitMin] = useState('')
  const [summary, setSummary] = useState<{ spoke: number; total: number } | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      startedRef.current = false
      setLocalCols({}); setCurrentId(null); setDoneIds([]); setFilterId(null)
      setSeconds(0); setTotalSeconds(0); setSummary(null)
      return
    }
    if (!startedRef.current) {
      startedRef.current = true
      const first = members[0]?.id ?? null
      setCurrentId(first)
      setFilterId(first)
    }
  }, [open, members])

  useEffect(() => {
    if (!open || summary) return
    const t = setInterval(() => {
      setSeconds(s => s + 1)
      setTotalSeconds(s => s + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [open, summary])

  const limit = parseInt(limitMin, 10)
  const overLimit = Number.isFinite(limit) && limit > 0 && seconds > limit * 60

  const shown = useMemo(() => {
    const list = filterId ? issues.filter(i => i.assigneeId === filterId) : issues
    return list.map(i => ({ ...i, colId: localCols[i.key] ?? i.colId }))
  }, [issues, filterId, localCols])

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  if (!open) return null

  function selectMember(id: string | null) {
    setCurrentId(id)
    setFilterId(id)
    setSeconds(0)
  }

  function nextMember() {
    if (!currentId) { selectMember(members[0]?.id ?? null); return }
    const done = doneIds.includes(currentId) ? doneIds : [...doneIds, currentId]
    setDoneIds(done)
    const next = members.find(m => !done.includes(m.id) && m.id !== currentId)
    selectMember(next?.id ?? null)
  }

  async function drop(colId: string) {
    const key = dragging
    setDragging(null); setDragOver(null)
    if (!key) return
    const issue = shown.find(i => i.key === key) ?? issues.find(i => i.key === key)
    if (!issue || issue.colId === colId) return
    const prev = issue.colId
    setLocalCols(c => ({ ...c, [key]: colId }))
    try {
      await onMove(issue, colId)
    } catch (err) {
      setLocalCols(c => ({ ...c, [key]: prev ?? '' }))
      setToast(`Não foi possível mover ${key}: ${err instanceof Error ? err.message : 'erro'}`)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const spoke = doneIds.length

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: DS.bgPage }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ background: S.surface, borderBottom: `1px solid ${S.border}` }}>
        <span className="text-[14px] font-semibold" style={{ color: S.t1 }}>Daily</span>
        <span className="text-[12px]" style={{ color: S.t3 }}>{projectName}{sprintName ? ` · ${sprintName}` : ''}</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] flex items-center gap-1.5" style={{ color: S.t3 }}>
            Limite por dev (min)
            <input value={limitMin} onChange={e => setLimitMin(e.target.value.replace(/\D/g, ''))}
              className="w-12 h-7 px-2 rounded-lg text-[11px] outline-none text-center"
              style={{ background: S.surface2, border: `1px solid ${S.border}`, color: S.t1 }} />
          </label>
          <span className="h-7 px-3 rounded-lg text-[13px] font-mono font-semibold flex items-center"
            style={{
              background: overLimit ? DS.critDim : S.surface2,
              border: `1px solid ${overLimit ? DS.crit : S.border}`,
              color: overLimit ? DS.crit : S.t1,
            }}>
            {fmt(seconds)}
          </span>
          <button data-tour="daily-next" onClick={nextMember}
            className="h-7 px-3 rounded-lg text-[11px] font-medium"
            style={{ background: DS.accentDim, border: `1px solid ${DS.accent}60`, color: DS.accent }}>
            Próximo ✓
          </button>
          <button data-tour="daily-end" onClick={() => setSummary({ spoke, total: totalSeconds })}
            className="h-7 px-3 rounded-lg text-[11px] font-medium"
            style={{ background: DS.critDim, border: `1px solid ${DS.crit}60`, color: DS.crit }}>
            Encerrar reunião
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Members panel */}
        <aside data-tour="daily-members" className="w-60 flex-shrink-0 flex flex-col overflow-y-auto"
          style={{ background: S.surface, borderRight: `1px solid ${S.border}` }}>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: S.t3 }}>
            Time ({spoke}/{members.length})
          </div>
          <button onClick={() => { setFilterId(null) }}
            className="mx-2 mb-1 h-8 px-3 rounded-lg text-[12px] text-left"
            style={{
              background: filterId === null ? S.surface2 : 'transparent',
              border: `1px solid ${filterId === null ? S.border2 : 'transparent'}`,
              color: S.t2,
            }}>
            Todos
          </button>
          {members.map(m => {
            const isDone = doneIds.includes(m.id)
            const isCurrent = currentId === m.id
            return (
              <button key={m.id} onClick={() => selectMember(m.id)}
                className="mx-2 mb-1 h-10 px-2 rounded-lg flex items-center gap-2 text-left transition-all"
                style={{
                  background: isCurrent ? DS.accentDim : filterId === m.id ? S.surface2 : 'transparent',
                  border: `1px solid ${isCurrent ? `${DS.accent}60` : 'transparent'}`,
                  opacity: isDone && !isCurrent ? 0.45 : 1,
                }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: m.color ?? DS.text3 }}>{m.initials}</span>
                <span className="text-[12px] truncate" style={{ color: isCurrent ? DS.accent : S.t1 }}>{m.name}</span>
                {isDone && <span className="ml-auto text-[12px]" style={{ color: DS.success }}>✓</span>}
                {isCurrent && !isDone && <span className="ml-auto text-[10px]" style={{ color: DS.accent }}>▶</span>}
              </button>
            )
          })}
        </aside>

        {/* Board replica */}
        <div data-tour="daily-board" className="flex-1 min-h-0 overflow-auto p-4">
          <div className="flex gap-3 items-start">
            {columns.map(col => {
              const colIssues = shown.filter(i => i.colId === col.id)
              return (
                <div key={col.id}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                  onDragLeave={() => setDragOver(prev => prev === col.id ? null : prev)}
                  onDrop={e => { e.preventDefault(); void drop(col.id) }}
                  className="w-64 flex-shrink-0 rounded-xl p-2"
                  style={{
                    background: dragOver === col.id ? `${DS.accent}12` : S.surface,
                    border: `1px solid ${dragOver === col.id ? DS.accent : S.border}`,
                    minHeight: 140,
                  }}>
                  <div className="flex items-center gap-2 px-1 pb-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                    <span className="text-[11px] font-semibold" style={{ color: S.t1 }}>{col.label}</span>
                    <span className="ml-auto text-[10px]" style={{ color: S.t3 }}>{colIssues.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {colIssues.map(i => {
                      const m = i.assigneeId ? memberById.get(i.assigneeId) : undefined
                      return (
                        <div key={i.key} draggable
                          onDragStart={() => setDragging(i.key)}
                          onDragEnd={() => { setDragging(null); setDragOver(null) }}
                          style={{
                            background: S.surface2,
                            border: `1px solid ${S.border}`,
                            borderRadius: 10,
                            padding: '9px 11px',
                            cursor: 'grab',
                            opacity: dragging === i.key ? 0.4 : 1,
                          }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-mono" style={{ color: S.t3 }}>{i.key}</span>
                            {typeof i.points === 'number' && i.points > 0 && (
                              <span className="ml-auto text-[10px] font-semibold" style={{ color: S.t3 }}>{i.points}pt</span>
                            )}
                          </div>
                          <p className="text-[12px] font-medium leading-snug" style={{ color: S.t1 }}>{i.title}</p>
                          {m && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                style={{ background: m.color ?? DS.text3 }}>{m.initials}</span>
                              <span className="text-[10px]" style={{ color: S.t3 }}>{m.name}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {colIssues.length === 0 && (
                      <div className="text-[11px] px-1 py-3 text-center" style={{ color: S.t3 }}>Sem demandas</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: DS.critDim, border: `1px solid ${DS.crit}60`, color: DS.crit }}>
          {toast}
        </div>
      )}

      {summary && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(8,10,14,0.72)' }}>
          <div className="w-80 rounded-2xl p-5" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <h3 className="text-[14px] font-semibold mb-3" style={{ color: S.t1 }}>Daily encerrada</h3>
            <p className="text-[12px] mb-1" style={{ color: S.t2 }}>
              {summary.spoke} de {members.length} membros falaram
            </p>
            <p className="text-[12px] mb-4" style={{ color: S.t2 }}>Tempo total: {fmt(summary.total)}</p>
            <button onClick={onClose}
              className="w-full h-9 rounded-lg text-[12px] font-medium text-white"
              style={{ background: DS.accent }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
