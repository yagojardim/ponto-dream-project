import { useEffect, useRef, useState } from 'react'
import { T } from './ds/tokens'
import { Modal } from './ds/Modal'
import { FilterBuilder } from './FilterBuilder'
import { createBoard, type BoardFilter } from '@/data/db/board'
import type { BoardColumnDef } from '@/data/db/boardColumnDefs'
import { listProjects, type ProjectRow } from '@/data/db/projects'
import { fetchBoardFilterOptions, type BoardFilterOptions } from '@/data/db/filterOptions'

/** Mapeia nomes de colunas (na ordem) para defs com status auto-distribuídos. */
function buildCustomColumns(names: string[]): BoardColumnDef[] {
  const n = names.length
  if (n === 0) return []
  if (n === 1) {
    return [{ name: names[0], category: 'todo', statuses: ['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done'] }]
  }
  if (n === 2) {
    return [
      { name: names[0], category: 'todo', statuses: ['backlog', 'todo', 'in_progress', 'in_review', 'blocked'] },
      { name: names[1], category: 'done', statuses: ['done'] },
    ]
  }
  const middleNames = names.slice(1, -1)
  const active = ['in_progress', 'in_review', 'blocked']
  const middle: BoardColumnDef[] = middleNames.map((nm, i) => ({
    name: nm,
    category: 'in_progress',
    statuses: middleNames.length === 1 ? active : (active[i] ? [active[i]] : []),
  }))
  return [
    { name: names[0], category: 'todo', statuses: ['backlog', 'todo'] },
    ...middle,
    { name: names[n - 1], category: 'done', statuses: ['done'] },
  ]
}

/** Campo de chips: digitar + Enter adiciona; × remove; mantém a ordem. */
function ColumnChipsInput({ values, onChange, placeholder }: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function add(raw: string) {
    const v = raw.trim()
    if (!v) return
    if (values.some(x => x.toLowerCase() === v.toLowerCase())) { setQuery(''); return }
    onChange([...values, v])
    setQuery('')
  }

  return (
    <div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {values.map((s, i) => (
            <span key={`${s}-${i}`} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px]"
              style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
              <span className="opacity-60">{i + 1}.</span>{s}
              <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="leading-none text-[12px]" style={{ color: T.accent }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); add(query) }
          if (e.key === 'Backspace' && !query && values.length > 0) onChange(values.slice(0, -1))
        }}
        onBlur={() => add(query)}
        placeholder={placeholder}
        className="h-9 px-3 text-[13px] rounded-lg border outline-none w-full"
        style={{ background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text1 }}
      />
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  /** If provided, pre-selects this project and hides the selector. */
  fixedProjectId?: string
  actorName?: string
}

export function NewBoardModal({ open, onClose, onCreated, fixedProjectId, actorName = 'Sistema' }: Props) {
  const [name, setName] = useState('')
  const [boardType, setBoardType] = useState<'scrum' | 'kanban'>('scrum')
  const [colMode, setColMode] = useState<'template' | 'custom'>('template')
  const [customCols, setCustomCols] = useState<string[]>([])
  const [filter, setFilter] = useState<BoardFilter>({ conditions: [], logic: 'AND' })
  const [projectId, setProjectId] = useState(fixedProjectId ?? '')
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [filterOptions, setFilterOptions] = useState<BoardFilterOptions>({ assignee_id: [], sprint_id: [], epic_id: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // Reset form
    setName('')
    setBoardType('scrum')
    setColMode('template')
    setCustomCols([])
    setFilter({ conditions: [], logic: 'AND' })
    setError(null)
    if (fixedProjectId) {
      setProjectId(fixedProjectId)
    } else {
      setProjectId('')
      listProjects().then(data => {
        setProjects(data.projects)
        if (data.projects.length === 1) setProjectId(data.projects[0].id)
      }).catch(() => {})
    }
  }, [open, fixedProjectId])

  // Carrega Responsável/Sprint/Épico do projeto escolhido para o Construtor de Filtros.
  useEffect(() => {
    if (!open || !projectId) { setFilterOptions({ assignee_id: [], sprint_id: [], epic_id: [] }); return }
    let alive = true
    fetchBoardFilterOptions(projectId).then(opts => { if (alive) setFilterOptions(opts) })
    return () => { alive = false }
  }, [open, projectId])

  async function handleCreate() {
    if (!name.trim() || !projectId) return
    if (colMode === 'custom' && customCols.length === 0) {
      setError('Informe ao menos uma coluna.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createBoard(projectId, {
        name: name.trim(),
        boardType,
        filter,
        ...(colMode === 'custom' ? { columns: buildCustomColumns(customCols) } : {}),
      }, actorName)
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar o board.')
    } finally {
      setBusy(false)
    }
  }

  const valid = name.trim().length > 0 && !!projectId && (colMode === 'template' || customCols.length > 0)

  const inputSt: React.CSSProperties = {
    background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text1,
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo board"
      subtitle="Crie um board com escopo de filtro para o projeto"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-xs font-semibold"
            style={{ background: T.bgSurface2, color: T.text2, border: `1px solid ${T.border}` }}
          >
            Cancelar
          </button>
          <button
            disabled={!valid || busy}
            onClick={handleCreate}
            className="h-9 px-4 rounded-lg text-xs font-semibold text-white"
            style={{ background: T.accent, opacity: valid && !busy ? 1 : 0.5, cursor: valid && !busy ? 'pointer' : 'not-allowed' }}
          >
            {busy ? 'Criando…' : 'Criar board'}
          </button>
        </>
      }
    >
      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Project selector (only when multiple projects) */}
        {!fixedProjectId && projects.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: T.text3 }}>Projeto</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="h-9 px-3 text-[13px] rounded-lg border outline-none"
              style={inputSt}
            >
              <option value="">— Selecione o projeto —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold" style={{ color: T.text3 }}>Nome do board</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex.: Sprint Bugs, Kanban Design…"
            className="h-9 px-3 text-[13px] rounded-lg border outline-none"
            style={inputSt}
          />
        </div>

        {/* Board columns */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold" style={{ color: T.text3 }}>Base de colunas</label>

          {/* Mode toggle */}
          <div className="inline-flex gap-1 p-1 rounded-lg self-start" style={{ background: T.bgSurface2, border: `1px solid ${T.border}` }}>
            {([['template', 'Template pronto'], ['custom', 'Personalizado']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setColMode(m)}
                className="px-3 h-7 rounded-md text-[12px] font-medium"
                style={{
                  background: colMode === m ? `${T.accent}22` : 'transparent',
                  color: colMode === m ? T.accent : T.text3,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {colMode === 'template' ? (
            <div className="flex gap-2">
              {(['scrum', 'kanban'] as const).map(bt => (
                <button
                  key={bt}
                  onClick={() => setBoardType(bt)}
                  className="px-4 h-9 rounded-lg text-[13px] font-medium"
                  style={{
                    background: boardType === bt ? `${T.accent}22` : T.bgSurface2,
                    color: boardType === bt ? T.accent : T.text2,
                    border: `1px solid ${boardType === bt ? T.accent : T.border}`,
                    cursor: 'pointer',
                  }}
                >
                  {bt === 'scrum' ? 'Scrum (5 colunas)' : 'Kanban (3 colunas)'}
                </button>
              ))}
            </div>
          ) : (
            <>
              <ColumnChipsInput
                values={customCols}
                onChange={setCustomCols}
                placeholder="Digite uma coluna e Enter…"
              />
              <p className="text-[11px]" style={{ color: T.text3 }}>
                Os status são distribuídos automaticamente pela ordem das colunas. Depois você pode renomear, reordenar e remapear em Configurações › Workflow.
              </p>
            </>
          )}
        </div>


        {/* Filter */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold" style={{ color: T.text3 }}>Filtro do board (opcional)</label>
          <p className="text-[11px]" style={{ color: T.text3 }}>Define quais itens do projeto aparecem neste board.</p>
          <FilterBuilder value={filter} onChange={setFilter} options={filterOptions} compact />
        </div>

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: T.critDim, color: T.crit, border: `1px solid ${T.crit}40` }}>
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
