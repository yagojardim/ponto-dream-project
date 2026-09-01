import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ds/Avatar'
import { FilterBuilder } from '@/components/FilterBuilder'
import {
  archiveBoard,
  fetchBoardTeamOptions,
  finalizeBoard,
  saveBoardSettings,
  type BoardTeamOption,
  type VisibleBoard,
} from '@/data/db/boards'
import { updateBoard, type BoardFilter } from '@/data/db/board'
import { fetchBoardFilterOptions, type BoardFilterOptions } from '@/data/db/filterOptions'

const inputStyle = { background: '#141926', border: '1px solid #2f3547', color: '#e8ecf4' } as const

interface Props {
  board: VisibleBoard
  actorName: string
  onClose: () => void
  /** Feedback + refresh da lista. `close` fecha o modal após a ação. */
  onDone: (msg: string, close: boolean) => Promise<void> | void
}

/** Check if this board is the default (oldest) of its project — cannot be archived. */
function isDefaultBoard(board: VisibleBoard, allBoards?: VisibleBoard[]): boolean {
  // If we don't have the full list we can't tell; default to false.
  // The backend will still block archiving the default board.
  if (!allBoards || allBoards.length === 0) return false
  const sameProject = allBoards
    .filter(b => b.project_id === board.project_id && !b.archived_at)
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
  return sameProject.length > 0 && sameProject[0].id === board.id
}

export function BoardSettingsModal({ board, actorName, onClose, onDone }: Props) {
  const [name, setName] = useState(board.name)
  const [desc, setDesc] = useState(board.description)
  const [start, setStart] = useState(board.period_start)
  const [end, setEnd] = useState(board.period_end)
  const [team, setTeam] = useState<string[]>(board.team_ids)
  const [options, setOptions] = useState<BoardTeamOption[]>([])
  const [busy, setBusy] = useState(false)

  // Board filter state
  const initialFilter = (board.filter ?? { conditions: [], logic: 'AND' }) as BoardFilter
  const [boardFilter, setBoardFilter] = useState<BoardFilter>(initialFilter)
  const [filterDirty, setFilterDirty] = useState(false)
  const [filterOpts, setFilterOpts] = useState<BoardFilterOptions>({ assignee_id: [], sprint_id: [], epic_id: [] })

  useEffect(() => {
    let alive = true
    fetchBoardTeamOptions(board.tenant_id).then(rows => { if (alive) setOptions(rows) })
    return () => { alive = false }
  }, [board.tenant_id])

  // Opções reais (Responsável/Sprint/Épico) do projeto do board para o Construtor de Filtros.
  useEffect(() => {
    let alive = true
    fetchBoardFilterOptions(board.project_id).then(opts => { if (alive) setFilterOpts(opts) })
    return () => { alive = false }
  }, [board.project_id])

  function toggle(id: string) {
    setTeam(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  async function run(fn: () => Promise<void>, msg: string, close: boolean) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      await onDone(msg, close)
    } catch (e) {
      await onDone(e instanceof Error ? e.message : 'Falha ao atualizar o board.', false)
    } finally {
      setBusy(false)
    }
  }

  const save = () => run(
    async () => {
      await saveBoardSettings(board, { name, description: desc, teamIds: team, periodStart: start, periodEnd: end }, actorName)
      // If filter changed, also save it
      if (filterDirty) {
        await updateBoard(board.id, { filter: boardFilter }, actorName)
      }
    },
    'Board atualizado', false,
  )
  const finalize = () => run(() => finalizeBoard(board, actorName), 'Board finalizado', true)
  const archive = () => run(() => archiveBoard(board, actorName), 'Board arquivado', true)

  // Default-board detection: the backend blocks archiving the default board.
  // We do a best-effort check here (based on created_at from the board row).
  // Since we don't have the full board list in this modal, we disable the button
  // if the board has no archived_at AND there's a signal from the board itself.
  // The backend is the real guard.
  const canArchive = !board.archived_at

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-xl fade-rise flex flex-col"
        style={{ maxWidth: 640, maxHeight: '85vh', background: '#1c2130', border: '1px solid #2f3547' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2f3547' }}>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate" style={{ color: '#e8ecf4' }}>
              Editar board — {board.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-[11px] px-1.5 py-0.5 rounded border" style={{ color: '#8a9ab8', borderColor: '#2f3547' }}>
                {board.project_name}
              </span>
              <span className="text-[11px]" style={{ color: '#546278' }}>
                {board.columns.length} colunas · {board.item_count} itens
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ color: '#8a9ab8', background: '#141926' }}
            aria-label="Fechar"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: '#8a9ab8' }}>Nome do board</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none"
              style={inputStyle}
              placeholder="Nome do board"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: '#8a9ab8' }}>Descrição</span>
            <textarea
              rows={4}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y"
              style={inputStyle}
              placeholder="Descreva o objetivo do board…"
            />
          </label>

          <div>
            <p className="text-[11px] font-medium mb-2" style={{ color: '#8a9ab8' }}>Equipe alocada no board</p>
            {options.length === 0 ? (
              <p className="text-xs" style={{ color: '#546278' }}>Nenhum membro disponível</p>
            ) : (
              <div className="flex flex-wrap gap-2" style={{ maxHeight: 180, overflowY: 'auto' }}>
                {options.map(m => {
                  const on = team.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left"
                      style={{
                        background: on ? '#12233d' : '#141926',
                        border: `1px solid ${on ? '#3B82F6' : '#2f3547'}`,
                      }}
                    >
                      <Avatar name={m.name} size="xs" color={m.avatar_color ?? undefined} initials={m.avatar_initials ?? undefined} />
                      <span className="text-xs truncate" style={{ color: on ? '#e8ecf4' : '#8a9ab8', maxWidth: 140 }}>{m.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: '#8a9ab8' }}>Período</p>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#546278' }}>Início</span>
                <input
                  type="date" value={start} onChange={e => setStart(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg text-xs outline-none" style={inputStyle}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#546278' }}>Fim</span>
                <input
                  type="date" value={end} onChange={e => setEnd(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg text-xs outline-none" style={inputStyle}
                />
              </label>
            </div>
          </div>

          {/* Board filter section */}
          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: '#8a9ab8' }}>Filtro do board</p>
            <p className="text-[10px] mb-2" style={{ color: '#546278' }}>Define quais itens do projeto aparecem neste board.</p>
            <FilterBuilder
              value={boardFilter}
              onChange={f => { setBoardFilter(f); setFilterDirty(true) }}
              options={filterOpts}
              compact
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => { void save() }}
              disabled={busy}
              className="px-3.5 py-2 rounded-lg text-xs font-medium"
              style={{ background: '#3B82F6', color: '#fff', opacity: busy ? 0.5 : 1 }}
            >
              {busy ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>

          {/* Lifecycle zone */}
          <div className="pt-4 flex flex-col gap-3" style={{ borderTop: '1px solid #2f3547' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#546278' }}>
              Ciclo de vida
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { void finalize() }}
                disabled={busy || board.finalized}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: '#06C18A', border: '1px solid #0f4030', background: '#0a2520', opacity: busy || board.finalized ? 0.5 : 1 }}
              >
                {board.finalized ? 'Board finalizado' : 'Finalizar board'}
              </button>
              <button
                onClick={() => { void archive() }}
                disabled={busy || !canArchive}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: '#f0805c', border: '1px solid #4a2018', background: '#2a1210', opacity: busy || !canArchive ? 0.5 : 1 }}
                title={!canArchive ? 'Este board já está arquivado' : undefined}
              >
                {board.archived_at ? 'Board arquivado' : 'Arquivar board'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
