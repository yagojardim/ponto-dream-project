import { useState } from 'react'
import { T } from '../components/ds/tokens'
import { useVisibleBoards, type VisibleBoard, type VisibleBoardStatus } from '@/data/db/boards'
import { BoardSettingsModal } from '@/components/BoardSettingsModal'
import { useSession } from '@/data/SessionContext'

type BoardDef = VisibleBoard
type BoardStatus = VisibleBoardStatus

interface Props {
  onSelectBoard: (boardId: string) => void
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 7)  return `há ${d} dias`
  if (d < 30) return `há ${Math.floor(d / 7)} semana${Math.floor(d / 7) > 1 ? 's' : ''}`
  return `há ${Math.floor(d / 30)} mês`
}

function ProjectDot({ projectId }: { projectId: string }) {
  const colors: Record<string, string> = { proj_001: '#3b82f6', proj_002: '#10b981', proj_003: '#f59e0b' }
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: colors[projectId] ?? T.border2, flexShrink: 0, marginTop: 1 }} />
}

function BoardCard({ board, onOpen, onSettings }: { board: BoardDef; onOpen: () => void; onSettings: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [menu, setMenu] = useState(false)
  const isArchived = board.status === 'archived'

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `${T.accent}0A` : T.bgSurface,
        border: `1px solid ${hovered ? T.accent + '55' : T.border}`,
        borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'all 0.15s', opacity: isArchived ? 0.72 : 1,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
        background: isArchived ? T.bgPage : `${T.accent}18`,
        border: `1px solid ${isArchived ? T.border : T.accent + '33'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="1" y="1" width="4" height="16" rx="1.5" fill={isArchived ? T.border2 : T.accent} opacity={isArchived ? 0.5 : 0.8} />
          <rect x="7" y="1" width="4" height="11" rx="1.5" fill={isArchived ? T.border2 : T.accent} opacity={isArchived ? 0.4 : 0.6} />
          <rect x="13" y="1" width="4" height="14" rx="1.5" fill={isArchived ? T.border2 : T.accent} opacity={isArchived ? 0.3 : 0.4} />
        </svg>
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.name}</span>
          {isArchived && (
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: T.text3, background: T.bgPage, border: `1px solid ${T.border}`, borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {board.finalized && !board.archived_at ? 'Finalizado' : 'Arquivado'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ProjectDot projectId={board.project_id} />
          <span style={{ fontSize: 11, color: T.text3 }}>{board.project_name}</span>
          <span style={{ fontSize: 10, color: T.border2 }}>·</span>
          <span style={{ fontSize: 11, color: T.text3 }}>{board.columns.length} colunas</span>
          <span style={{ fontSize: 10, color: T.border2 }}>·</span>
          <span style={{ fontSize: 11, color: T.text3 }}>{board.item_count} itens</span>
        </div>
      </div>

      {/* Columns preview */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
        {board.columns.slice(0, 5).map((col, i) => (
          <div key={i} style={{
            height: 28, width: 5, borderRadius: 3,
            background: isArchived ? T.border : `${T.accent}${Math.round(40 + (board.columns.length > 1 ? i / (board.columns.length - 1) : 0) * 80).toString(16).padStart(2, '0')}`,
            transition: 'background 0.15s',
          }} />
        ))}
        {board.columns.length > 5 && <span style={{ fontSize: 10, color: T.text3, marginLeft: 2 }}>+{board.columns.length - 5}</span>}
      </div>

      {/* Updated */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 60 }}>
        <span style={{ fontSize: 11, color: T.text3 }}>{fmtRelative(board.updated_at)}</span>
      </div>

      {/* Menu de gestão */}
      <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button
          aria-label="Gerenciar board"
          onClick={() => setMenu(v => !v)}
          style={{
            width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
            background: menu ? T.bgPage : 'transparent', border: `1px solid ${menu ? T.border : 'transparent'}`,
            color: T.text3, fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >⋯</button>
        {menu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenu(false)} />
            <div style={{
              position: 'absolute', top: 30, right: 0, zIndex: 41, minWidth: 190,
              background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <button
                onClick={() => { setMenu(false); onSettings() }}
                style={{
                  width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6,
                  background: 'transparent', border: 'none', color: T.text2, fontSize: 12, cursor: 'pointer',
                }}
              >Configurações do board</button>
            </div>
          </>
        )}
      </div>

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
        <path d="M5 3l4 4-4 4" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function BoardsListPage({ onSelectBoard }: Props) {
  const { boards, loading, reload } = useVisibleBoards()
  const { activeUser } = useSession()
  const [settingsBoard, setSettingsBoard] = useState<BoardDef | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BoardStatus | 'all'>('all')

  const totalActive = boards.filter(b => b.status === 'active').length

  const filtered = boards.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!b.name.toLowerCase().includes(q) && !b.project_name.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Group by project
  const byProject: Record<string, { name: string; boards: BoardDef[] }> = {}
  for (const b of filtered) {
    if (!byProject[b.project_id]) byProject[b.project_id] = { name: b.project_name, boards: [] }
    byProject[b.project_id].boards.push(b)
  }

  const inputSt: React.CSSProperties = {
    padding: '7px 11px', borderRadius: 7, background: T.bgPage,
    border: `1px solid ${T.border}`, color: T.text1, fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text1 }}>Boards</div>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>
            {boards.length} board{boards.length !== 1 ? 's' : ''} no escopo
            <span style={{ marginLeft: 8, color: T.success, fontWeight: 600 }}>● {totalActive} ativo{totalActive !== 1 ? 's' : ''}</span>
            {boards.length - totalActive > 0 && <span style={{ marginLeft: 8, color: T.text3 }}>· {boards.length - totalActive} arquivado{boards.length - totalActive !== 1 ? 's' : ''}</span>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="6" cy="6" r="4.5" stroke={T.text3} strokeWidth="1.3" />
            <path d="M9.5 9.5l2.5 2.5" stroke={T.text3} strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar board ou projeto…"
            style={{ ...inputSt, width: '100%', boxSizing: 'border-box', paddingLeft: 30 }} />
        </div>
        {(['all', 'active', 'archived'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: statusFilter === s ? T.accent : T.bgPage,
            color: statusFilter === s ? '#fff' : T.text2,
            border: `1px solid ${statusFilter === s ? T.accent : T.border}`,
            transition: 'all 0.15s',
          }}>
            {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Arquivados'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '60px 20px', textAlign: 'center', fontSize: 13, color: T.text3 }}>
          Carregando boards…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '60px 20px', textAlign: 'center' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ marginBottom: 12 }}>
            <rect x="4" y="4" width="9" height="28" rx="3" fill={T.border2} opacity="0.6" />
            <rect x="16" y="4" width="9" height="20" rx="3" fill={T.border2} opacity="0.4" />
            <rect x="23" y="14" width="9" height="18" rx="3" fill={T.danger} opacity="0.3" />
          </svg>
          <div style={{ fontSize: 14, color: T.text2, fontWeight: 600 }}>Nenhum board encontrado</div>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 4 }}>Ajuste os filtros ou tente outra busca.</div>
        </div>
      ) : (
        Object.entries(byProject).map(([projId, { name, boards: pBoards }]) => (
          <div key={projId} style={{ marginBottom: 24 }}>
            {/* Project header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 2 }}>
              <ProjectDot projectId={projId} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{name}</span>
              <span style={{ fontSize: 11, color: T.text3 }}>— {pBoards.length} board{pBoards.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pBoards.map(b => (
                <BoardCard key={b.id} board={b} onOpen={() => onSelectBoard(b.id)} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
