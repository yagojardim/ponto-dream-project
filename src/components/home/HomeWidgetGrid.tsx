/**
 * Altech — Interactive Home panel.
 * Draggable / resizable widget grid built on react-grid-layout, merging the
 * native Início cards with the Reports registry cards. Layout + instances are
 * persisted per user in localStorage.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { T } from '@/components/ds/tokens'
import { WorkItemDetailDrawer, type WorkItem } from '@/components/ds/DashboardKit'
import { HOME_WIDGETS, getWidget, defaultWidgetIds, type WidgetCtx } from '@/data/homeWidgets'
import { AddWidgetModal, type WidgetFormat } from '@/components/home/AddWidgetModal'

const ResponsiveGridLayout = WidthProvider(Responsive)

const ROW_HEIGHT = 88
const KPI_HEIGHT = 2
const CARD_HEIGHT = 3

export interface WidgetInstance {
  i: string
  widgetId: string
  format: WidgetFormat
  /** Título customizado pelo usuário (cai no título do catálogo quando ausente). */
  title?: string
}

interface StoredState {
  instances: WidgetInstance[]
  layout: Layout[]
}

interface Props {
  userId: string
  userName: string
  role: string
  onNav: (view: string, targetId?: string) => void
}

function storageKey(userId: string) { return `altech.home.layout.${userId}` }

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `w_${Math.random().toString(36).slice(2)}`
}

function heightFor(widgetId: string): number {
  return widgetId.startsWith('native.kpi-') ? KPI_HEIGHT : CARD_HEIGHT
}

function buildDefault(role: string): StoredState {
  const ids = defaultWidgetIds(role).filter(id => getWidget(id))
  const instances: WidgetInstance[] = ids.map(widgetId => ({
    i: newId(),
    widgetId,
    format: widgetId.startsWith('native.kpi-') ? 'vertical' : 'horizontal',
  }))
  let y = 0
  let x = 0
  const layout: Layout[] = instances.map(inst => {
    const h = heightFor(inst.widgetId)
    const w = inst.format === 'horizontal' ? 12 : 6
    if (x + w > 12) { x = 0; y += h }
    const item: Layout = { i: inst.i, x, y, w, h, minW: 3, minH: 1 }
    x += w
    if (x >= 12) { x = 0; y += h }
    return item
  })
  return { instances, layout }
}

function loadStored(userId: string): StoredState | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredState
    if (!Array.isArray(parsed.instances) || !Array.isArray(parsed.layout)) return null
    return {
      instances: parsed.instances.filter(inst => !!getWidget(inst.widgetId)),
      layout: parsed.layout,
    }
  } catch {
    return null
  }
}

export function HomeWidgetGrid({ userId, userName, role, onNav }: Props) {
  const [state, setState] = useState<StoredState>(() => loadStored(userId) ?? buildDefault(role))
  const [addOpen, setAddOpen] = useState(false)
  const [drawerItem, setDrawerItem] = useState<WorkItem | null>(null)
  // Modo edição: mudanças ficam só em estado; Salvar persiste, Cancelar volta ao snapshot.
  const [editing, setEditing] = useState(false)
  const [snapshot, setSnapshot] = useState<StoredState | null>(null)

  // Re-hydrate when the user (or role, on first access) changes.
  useEffect(() => {
    setState(loadStored(userId) ?? buildDefault(role))
    setEditing(false)
    setSnapshot(null)
  }, [userId, role])

  const startEditing = () => {
    setSnapshot(state)
    setEditing(true)
  }

  const saveEditing = () => {
    try { localStorage.setItem(storageKey(userId), JSON.stringify(state)) } catch { /* noop */ }
    setEditing(false)
    setSnapshot(null)
  }

  const cancelEditing = () => {
    if (snapshot) setState(snapshot)
    setEditing(false)
    setSnapshot(null)
  }

  const renameWidget = (i: string, title: string) => {
    const trimmed = title.trim()
    setState(prev => ({
      ...prev,
      instances: prev.instances.map(inst => {
        if (inst.i !== i) return inst
        // Vazio → remove o customizado e volta ao título do catálogo.
        const next = { ...inst }
        if (trimmed) next.title = trimmed
        else delete next.title
        return next
      }),
    }))
  }

  const persist = useCallback((next: StoredState) => {
    setState(next)
    try { localStorage.setItem(storageKey(userId), JSON.stringify(next)) } catch { /* storage indisponível */ }
  }, [userId])

  const ctx: WidgetCtx = useMemo(() => ({
    onNav,
    onOpenItem: setDrawerItem,
    userName,
  }), [onNav, userName])

  const handleLayoutChange = useCallback((layout: Layout[]) => {
    setState(prev => {
      const next = { instances: prev.instances, layout }
      // Em modo edição, a persistência acontece só no Salvar.
      if (!editing) {
        try { localStorage.setItem(storageKey(userId), JSON.stringify(next)) } catch { /* noop */ }
      }
      return next
    })
  }, [userId, editing])

  const addWidget = (widgetId: string, format: WidgetFormat) => {
    const inst: WidgetInstance = { i: newId(), widgetId, format }
    const maxY = state.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
    const item: Layout = {
      i: inst.i, x: 0, y: maxY, w: format === 'horizontal' ? 12 : 6,
      h: heightFor(widgetId), minW: 3, minH: 1,
    }
    persist({ instances: [...state.instances, inst], layout: [...state.layout, item] })
  }

  const removeWidget = (i: string) => {
    persist({
      instances: state.instances.filter(inst => inst.i !== i),
      layout: state.layout.filter(l => l.i !== i),
    })
  }

  const restoreDefault = () => {
    try { localStorage.removeItem(storageKey(userId)) } catch { /* noop */ }
    setState(buildDefault(role))
  }

  const layouts: Layouts = { lg: state.layout, md: state.layout, sm: state.layout, xs: state.layout }

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .altech-home-grid .react-grid-placeholder { background: ${T.accentDim}; border: 1px dashed ${T.accentBorder}; border-radius: 12px; opacity: 1; }
        .altech-home-grid .react-grid-item > .react-resizable-handle::after { border-color: ${T.text3}; }
      `}</style>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            fontSize: 12, fontWeight: 600, color: T.accent, background: T.accentDim,
            border: `1px solid ${T.accentBorder}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
          }}
        >+ Adicionar card</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={restoreDefault}
          style={{ fontSize: 11, color: T.text3, background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
        >Restaurar padrão</button>
      </div>

      {state.instances.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '60px 20px', border: `1px dashed ${T.border}`, borderRadius: 12, background: T.bgSurface,
        }}>
          <div style={{ fontSize: 30, opacity: 0.6 }}>▦</div>
          <div style={{ fontSize: 13, color: T.text2 }}>Seu painel está vazio.</div>
          <div style={{ fontSize: 12, color: T.text3 }}>Adicione cards do Início ou de Relatórios para montar sua visão.</div>
          <button
            onClick={() => setAddOpen(true)}
            style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#fff', background: T.accent, border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}
          >+ Adicionar card</button>
        </div>
      ) : (
        <ResponsiveGridLayout
          className="altech-home-grid"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 2 }}
          rowHeight={ROW_HEIGHT}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          isDraggable
          isResizable
          resizeHandles={['s', 'e', 'se', 'w', 'n']}
          draggableCancel=".no-drag"
          compactType="vertical"
          onLayoutChange={handleLayoutChange}
        >
          {state.instances.map(inst => {
            const def = getWidget(inst.widgetId)
            if (!def) return <div key={inst.i} />
            return (
              <div key={inst.i} style={{
                background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderBottom: `1px solid ${T.border}`, cursor: 'move', flexShrink: 0,
                }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {def.title}
                  </span>
                  <RemoveButton onClick={() => removeWidget(inst.i)} />
                </div>
                <div className="no-drag" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 12 }}>
                  {def.render(ctx)}
                </div>
              </div>
            )
          })}
        </ResponsiveGridLayout>
      )}

      {addOpen && <AddWidgetModal onClose={() => setAddOpen(false)} onAdd={addWidget} />}
      {drawerItem && (
        <WorkItemDetailDrawer item={drawerItem} onClose={() => setDrawerItem(null)} onNav={onNav} />
      )}
    </div>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      className="no-drag"
      title="Remover card"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', background: hover ? `${T.danger}18` : 'transparent',
        color: hover ? T.danger : T.text3, cursor: 'pointer', flexShrink: 0,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 4h11M6.5 4V2.8h3V4M4 4l.7 9.2h6.6L12 4M6.6 6.6v4.2M9.4 6.6v4.2"
          stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
