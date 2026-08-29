import { useEffect, useState } from 'react'
import { T } from './ds/tokens'
import { Modal } from './ds/Modal'
import { FilterBuilder } from './FilterBuilder'
import { createBoard, type BoardFilter } from '@/data/db/board'
import { listProjects, type ProjectRow } from '@/data/db/projects'

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
  const [filter, setFilter] = useState<BoardFilter>({ conditions: [], logic: 'AND' })
  const [projectId, setProjectId] = useState(fixedProjectId ?? '')
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // Reset form
    setName('')
    setBoardType('scrum')
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

  async function handleCreate() {
    if (!name.trim() || !projectId) return
    setBusy(true)
    setError(null)
    try {
      await createBoard(projectId, { name: name.trim(), boardType, filter }, actorName)
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar o board.')
    } finally {
      setBusy(false)
    }
  }

  const valid = name.trim().length > 0 && !!projectId

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

        {/* Board type */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold" style={{ color: T.text3 }}>Base de colunas</label>
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
        </div>

        {/* Filter */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold" style={{ color: T.text3 }}>Filtro do board (opcional)</label>
          <p className="text-[11px]" style={{ color: T.text3 }}>Define quais itens do projeto aparecem neste board.</p>
          <FilterBuilder value={filter} onChange={setFilter} compact />
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
