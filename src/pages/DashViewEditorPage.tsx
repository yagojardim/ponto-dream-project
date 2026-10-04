import { useEffect, useMemo, useState } from 'react'
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { T } from '@/components/ds/tokens'
import { LoadingState } from '@/components/ds/DashboardKit'
import { useSession } from '@/data/SessionContext'
import {
  fetchDashLayout, saveDashLayout, fetchDashDetail, getPortalScope, DASH_WIDGET_CATALOG,
  type DashLayoutItem, type ScopeProject,
} from '@/data/db/clientPortal'
import { applyScope, renderDashWidget } from '@/pages/ClientPortalPage'

function noop() { /* editor: widgets renderizados somente leitura, sem efeito real */ }

const GridLayoutWithWidth = WidthProvider(GridLayout)
const COLS = 12
const ROW_HEIGHT = 80
const DEFAULT_W = 6
const DEFAULT_H = 3

interface Props {
  projectId: string
  onBack: () => void
}

function defaultLayout(): DashLayoutItem[] {
  let x = 0, y = 0
  return DASH_WIDGET_CATALOG.map(w => {
    const item: DashLayoutItem = { i: w.id, x, y, w: DEFAULT_W, h: DEFAULT_H }
    x += DEFAULT_W
    if (x >= COLS) { x = 0; y += DEFAULT_H }
    return item
  })
}

export default function DashViewEditorPage({ projectId, onBack }: Props) {
  const { activeUser } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [layout, setLayout] = useState<DashLayoutItem[]>([])
  const [isCustom, setIsCustom] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [previewProject, setPreviewProject] = useState<ScopeProject | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [saved, detail, scope] = await Promise.all([
          fetchDashLayout(projectId), fetchDashDetail(projectId), getPortalScope([projectId]),
        ])
        if (!alive) return
        setProjectName(detail?.projectName ?? 'Projeto')
        // Mesmo escopo client-safe que o ClientPortalPage usa de verdade — a
        // prévia do editor fica idêntica ao que o cliente realmente vê.
        applyScope(scope)
        setPreviewProject(scope.projects.find(p => p.id === projectId) ?? null)
        if (saved && saved.length > 0) { setLayout(saved); setIsCustom(true) }
        else { setLayout(defaultLayout()); setIsCustom(false) }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [projectId])

  const enabledIds = useMemo(() => new Set(layout.map(l => l.i)), [layout])

  function toggleWidget(id: string) {
    setIsCustom(true)
    setLayout(prev => {
      if (prev.some(l => l.i === id)) return prev.filter(l => l.i !== id)
      const maxY = prev.reduce((m, l) => Math.max(m, l.y + l.h), 0)
      return [...prev, { i: id, x: 0, y: maxY, w: DEFAULT_W, h: DEFAULT_H }]
    })
  }

  function handleLayoutChange(next: Layout[]) {
    setLayout(next.map((n): DashLayoutItem => ({ i: n.i, x: n.x, y: n.y, w: n.w, h: n.h })))
  }

  async function handleSave() {
    setSaving(true); setError('')
    const ok = await saveDashLayout(projectId, layout, activeUser.name)
    setSaving(false)
    if (ok) onBack()
    else setError('Não foi possível salvar o layout. Tente novamente.')
  }

  async function handleRestoreDefault() {
    setSaving(true); setError('')
    const ok = await saveDashLayout(projectId, null, activeUser.name)
    setSaving(false)
    if (ok) onBack()
    else setError('Não foi possível restaurar o padrão. Tente novamente.')
  }

  return (
    <div style={{ padding: 24, background: T.bgPage, minHeight: '100%' }}>
      <div onClick={onBack} style={{ fontSize: 12.5, color: T.accent, cursor: 'pointer', marginBottom: 14, display: 'inline-block' }}>
        ← Voltar para o dash
      </div>

      <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text1 }}>Editar dash — {projectName}</h1>
      <p style={{ margin: '6px 0 20px', fontSize: 13, color: T.text2, maxWidth: 640 }}>
        Escolha quais cards o cliente vê neste dash e arraste para organizar. A prévia abaixo já é a visão
        real — mesmos dados que o cliente vê no portal dele, só que somente leitura aqui.
      </p>

      {loading ? <LoadingState rows={4} /> : (
        <>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18,
            padding: 14, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
          }}>
            {DASH_WIDGET_CATALOG.map(w => {
              const on = enabledIds.has(w.id)
              return (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(w.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, padding: '6px 12px',
                    borderRadius: 20, cursor: 'pointer',
                    background: on ? T.accentDim : T.bgSurface2,
                    border: `1px solid ${on ? T.accentBorder : T.border2}`,
                    color: on ? T.accent : T.text2,
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${on ? T.accent : T.border2}`,
                    background: on ? T.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff',
                  }}>{on && '✓'}</span>
                  {w.title}
                </button>
              )
            })}
          </div>

          <div style={{
            background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: 12, minHeight: 200,
          }}>
            {layout.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: T.text3 }}>
                Nenhum card selecionado — o cliente veria uma tela vazia. Marque ao menos um card acima.
              </div>
            ) : (
              <GridLayoutWithWidth
                className="layout"
                layout={layout}
                cols={COLS}
                rowHeight={ROW_HEIGHT}
                margin={[10, 10]}
                onLayoutChange={handleLayoutChange}
                draggableCancel=".no-drag"
              >
                {layout.map(item => {
                  const def = DASH_WIDGET_CATALOG.find(w => w.id === item.i)
                  return (
                    <div key={item.i} style={{
                      background: T.bgSurface2, border: `1px solid ${T.border2}`, borderRadius: 9,
                      display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        borderBottom: `1px solid ${T.border}`, cursor: 'move', flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text1, flex: 1 }}>{def?.title ?? item.i}</span>
                        <button
                          className="no-drag"
                          onClick={() => toggleWidget(item.i)}
                          style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                          title="Remover deste dash"
                        >✕</button>
                      </div>
                      <div style={{ flex: 1, overflow: 'auto', pointerEvents: 'none' }}>
                        {previewProject
                          ? renderDashWidget(item.i, previewProject, new Set([projectId]), noop, noop)
                          : (
                            <div style={{ padding: 16, textAlign: 'center', color: T.text3, fontSize: 11 }}>
                              Sem dado ainda para este projeto.
                            </div>
                          )}
                      </div>
                    </div>
                  )
                })}
              </GridLayoutWithWidth>
            )}
          </div>

          {error && <div style={{ marginTop: 12, fontSize: 12, color: T.crit }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            {isCustom && (
              <button onClick={() => void handleRestoreDefault()} disabled={saving} style={{
                background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2,
                borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: saving ? 'default' : 'pointer', marginRight: 'auto',
              }}>Restaurar padrão</button>
            )}
            <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || layout.length === 0}
              style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving || layout.length === 0 ? 0.6 : 1 }}
            >
              {saving ? 'Salvando…' : 'Salvar layout'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
