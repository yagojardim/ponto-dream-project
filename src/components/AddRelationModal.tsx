import { useState, useEffect } from 'react'
import { T } from './ds/tokens'
import { HelpHint } from './ds/HelpHint'
import { listLinkableItems } from '@/data/db/workItem'

interface LinkableIssue { key: string; title: string }

const REL_TYPES = [
  'bloqueia',
  'é bloqueada por',
  'duplica',
  'é duplicada por',
  'relacionada a',
  'é pai de',
  'é filho de',
]

interface Props {
  currentIssueKey: string
  /** Projeto do item atual — usado para buscar as demandas reais disponíveis. */
  projectId?: string | null
  /** Id do item atual, para não listá-lo como opção. */
  excludeId?: string | null
  onClose: () => void
  onAdd: (relation: { type: string; targetKey: string }) => void
}

export function AddRelationModal({ currentIssueKey, projectId, excludeId, onClose, onAdd }: Props) {
  const [relType, setRelType] = useState('bloqueia')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const [issues, setIssues] = useState<LinkableIssue[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectId) { setIssues([]); return }
    let alive = true
    setLoading(true)
    listLinkableItems(projectId, excludeId ?? undefined)
      .then(rows => { if (alive) setIssues(rows.map(r => ({ key: r.key, title: r.title }))) })
      .catch(() => { if (alive) setIssues([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [projectId, excludeId])

  const filtered = issues.filter(
    i =>
      i.key !== currentIssueKey &&
      (i.key.toLowerCase().includes(query.toLowerCase()) ||
        i.title.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 50)

  function handleSelect(key: string) {
    setSelected(key)
    setQuery('')
    setShowList(false)
  }

  function handleAdd() {
    if (!selected) return
    onAdd({ type: relType, targetKey: selected })
    onClose()
  }

  const selectedIssue = issues.find(i => i.key === selected)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: 460,
          background: T.bgSurface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 28,
          boxShadow: T.shadowModal,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: T.text1 }}>
            Adicionar Relação
            <HelpHint title="Relação entre demandas" text="Cria um vínculo entre esta demanda e outra: bloqueia, é bloqueada por, relaciona-se ou duplica. Aparece nas 'Relações' do item, nas setas da Timeline e nos painéis de Bloqueadores (PMO/Scrum Master)." />
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, fontSize: 18, color: T.text3, background: 'transparent', border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Tipo de relação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.text3 }}>Tipo de relação</label>
            <select
              value={relType}
              onChange={e => setRelType(e.target.value)}
              style={{
                height: 36, padding: '0 12px', fontSize: 13, borderRadius: 8,
                background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text1,
                outline: 'none', colorScheme: 'dark', fontFamily: 'inherit',
              }}
            >
              {REL_TYPES.map(r => (
                <option key={r} value={r} style={{ background: T.bgSurface2 }}>{r}</option>
              ))}
            </select>
          </div>

          {/* Issue search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.text3 }}>Demanda</label>

            {selected ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentBorder}`,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                  padding: '2px 6px', borderRadius: 4, background: T.accent, color: '#fff',
                }}>{selected}</span>
                <span style={{ flex: 1, fontSize: 12, color: T.text1 }}>{selectedIssue?.title}</span>
                <button
                  onClick={() => setSelected(null)}
                  style={{ fontSize: 14, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                >×</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  value={query}
                  onChange={e => { setQuery(e.target.value); setShowList(true) }}
                  onFocus={() => setShowList(true)}
                  placeholder={loading ? 'Carregando demandas…' : 'Buscar demanda (ex: WEB-118)'}
                  style={{
                    width: '100%', height: 36, padding: '0 12px', fontSize: 13, borderRadius: 8,
                    background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text1,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocusCapture={e => { e.currentTarget.style.borderColor = T.accent }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = T.border
                    setTimeout(() => setShowList(false), 150)
                  }}
                />
                {showList && filtered.length === 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 10,
                    boxShadow: T.shadowModal, zIndex: 10, padding: '10px 12px',
                    fontSize: 12, color: T.text3,
                  }}>
                    {loading ? 'Carregando demandas…' : query ? 'Nenhuma demanda encontrada.' : 'Nenhuma outra demanda neste projeto.'}
                  </div>
                )}
                {showList && filtered.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 10,
                    boxShadow: T.shadowModal, zIndex: 10, overflow: 'hidden',
                  }}>
                    {filtered.map(issue => (
                      <button
                        key={issue.key}
                        onMouseDown={() => handleSelect(issue.key)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: 'transparent', border: 'none',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                      >
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                          padding: '2px 6px', borderRadius: 4, background: T.accentDim,
                          color: T.accent, flexShrink: 0,
                        }}>{issue.key}</span>
                        <span style={{ fontSize: 12, color: T.text1 }}>{issue.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview */}
          {selected && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              borderRadius: 10, background: T.bgSurface2, border: `1px solid ${T.border}`,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                padding: '2px 6px', borderRadius: 4, background: T.accentDim, color: T.accent,
              }}>{currentIssueKey}</span>
              <span style={{ fontSize: 11, color: T.text3, fontStyle: 'italic' }}>{relType}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                padding: '2px 6px', borderRadius: 4, background: T.accentDim, color: T.accent,
              }}>{selected}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              height: 32, padding: '0 16px', fontSize: 13, fontWeight: 500,
              borderRadius: 8, background: 'transparent', border: 'none', color: T.text2, cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >Cancelar</button>
          <button
            onClick={handleAdd}
            disabled={!selected}
            style={{
              height: 32, padding: '0 16px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, background: selected ? T.accent : T.bgSurface2,
              border: 'none', color: selected ? '#fff' : T.text3,
              cursor: selected ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (selected) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.15)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none' }}
          >Adicionar</button>
        </div>
      </div>
    </div>
  )
}
