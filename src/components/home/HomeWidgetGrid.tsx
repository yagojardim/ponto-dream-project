/**
 * Altech — Interactive Home panel.
 * Draggable / resizable widget grid built on react-grid-layout, merging the
 * native Início cards with the Reports registry cards. Layout + instances are
 * persisted per user in localStorage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function storageKey(userId: string, role: string) { return `altech.home.layout.${userId}.${role}` }

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `w_${Math.random().toString(36).slice(2)}`
}

function heightFor(widgetId: string): number {
  return getWidget(widgetId)?.kind === 'kpi' ? KPI_HEIGHT : CARD_HEIGHT
}

/** Tamanho mínimo apresentável, vindo do catálogo. */
function minSizeFor(widgetId: string): { minW: number; minH: number } {
  const def = getWidget(widgetId)
  return { minW: def?.minW ?? 3, minH: def?.minH ?? 2 }
}

/**
 * Reproduz a disposição original de cada painel: os KPIs de topo numa linha
 * (cards estreitos lado a lado) e, abaixo, os cards de corpo com a largura que
 * tinham no painel (ColSpan → 12 colunas, meia largura → 6).
 */
function buildDefault(role: string): StoredState {
  const ids = defaultWidgetIds(role).filter(id => getWidget(id))
  const kpiIds = ids.filter(id => getWidget(id)?.kind === 'kpi')
  const kpiW = kpiIds.length > 0 ? Math.max(2, Math.floor(12 / kpiIds.length)) : 3

  const instances: WidgetInstance[] = ids.map(widgetId => ({
    i: newId(),
    widgetId,
    format: (getWidget(widgetId)?.defaultW ?? 6) >= 12 ? 'horizontal' : 'vertical',
  }))

  let y = 0
  let x = 0
  const layout: Layout[] = instances.map(inst => {
    const def = getWidget(inst.widgetId)
    const isKpi = def?.kind === 'kpi'
    const h = heightFor(inst.widgetId)
    const w = isKpi ? kpiW : Math.min(12, def?.defaultW ?? 6)
    // A primeira linha é exclusiva dos KPIs; os cards de corpo começam abaixo.
    if (!isKpi && x > 0 && kpiIds.length > 0 && y === 0) { x = 0; y = KPI_HEIGHT }
    if (x + w > 12) { x = 0; y += h }
    const item: Layout = { i: inst.i, x, y, w, h, ...minSizeFor(inst.widgetId) }
    x += w
    if (x >= 12) { x = 0; y += h }
    return item
  })
  return { instances, layout }
}


function loadStored(userId: string, role: string): StoredState | null {
  try {
    const raw = localStorage.getItem(storageKey(userId, role))
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
  const [state, setState] = useState<StoredState>(() => loadStored(userId, role) ?? buildDefault(role))
  const [addOpen, setAddOpen] = useState(false)
  const [drawerItem, setDrawerItem] = useState<WorkItem | null>(null)
  // Modo edição: mudanças ficam só em estado; Salvar persiste, Cancelar volta ao snapshot.
  const [editing, setEditing] = useState(false)
  const [snapshot, setSnapshot] = useState<StoredState | null>(null)

  // Re-hidrata só quando o usuário/papel MUDA de fato — nunca na montagem,
  // para não sobrescrever o estado já hidratado no lazy init do useState.
  const hydratedFor = useRef(`${userId}|${role}`)
  useEffect(() => {
    const key = `${userId}|${role}`
    if (hydratedFor.current === key) return
    hydratedFor.current = key
    setState(loadStored(userId, role) ?? buildDefault(role))
    setEditing(false)
    setSnapshot(null)
  }, [userId, role])

  const startEditing = () => {
    setSnapshot(state)
    setEditing(true)
  }

  const saveEditing = () => {
    try { localStorage.setItem(storageKey(userId, role), JSON.stringify(state)) } catch { /* noop */ }
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
    try { localStorage.setItem(storageKey(userId, role), JSON.stringify(next)) } catch { /* storage indisponível */ }
  }, [userId, role])

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
        try { localStorage.setItem(storageKey(userId, role), JSON.stringify(next)) } catch { /* noop */ }
      }
      return next
    })
  }, [userId, role, editing])

  const addWidget = (widgetId: string, format: WidgetFormat) => {
    const inst: WidgetInstance = { i: newId(), widgetId, format }
    const maxY = state.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
    const item: Layout = {
      i: inst.i, x: 0, y: maxY, w: format === 'horizontal' ? 12 : 6,
      h: heightFor(widgetId), ...minSizeFor(widgetId),
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
    try { localStorage.removeItem(storageKey(userId, role)) } catch { /* noop */ }
    setState(buildDefault(role))
  }

  const layouts: Layouts = { lg: state.layout, md: state.layout, sm: state.layout, xs: state.layout }

  return (
    <div className={`altech-home-panel${editing ? ' is-editing' : ''}`} style={{ width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .altech-home-grid .react-grid-placeholder { background: ${T.accentDim}; border: 1px dashed ${T.accentBorder}; border-radius: 12px; opacity: 1; }
        .altech-home-grid .react-grid-item > .react-resizable-handle::after { border-color: ${T.text3}; }
        .altech-home-panel:not(.is-editing) .react-resizable-handle { display: none !important; }
        /* Cadeia de altura: o conteúdo acompanha o tamanho do card. */
        .altech-home-grid .react-grid-item { display: flex; }
        .altech-widget-card { height: 100%; width: 100%; min-height: 0; position: relative; }
        .altech-widget-card > .altech-widget-body { height: 100%; }
        .altech-widget-body-fit { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .altech-widget-body-fit > * { flex: 1 1 auto; min-height: 0; max-width: 100%; }
        .altech-widget-body-fit svg { max-width: 100%; max-height: 100%; height: auto; }
        .altech-widget-body-fit .recharts-responsive-container { flex: 1 1 auto; min-height: 0; }
        /* Gráficos de relatório em modo fill: ocupam toda a altura do card. */
        .altech-widget-body-fit .altech-chart-fill { flex: 1 1 auto; min-height: 0; }
        .altech-widget-body-fit .altech-chart-fill > svg,
        .altech-widget-body-fit .altech-chart-fill > div > svg { height: 100%; width: 100%; flex: 1 1 auto; min-height: 0; }
        .altech-widget-kpi > * { height: 100%; }
        /* Controles de edição: barra flutuante só no hover, sem chrome permanente. */
        .altech-widget-tools { opacity: 0; transition: opacity 0.12s; }
        .altech-widget-card:hover .altech-widget-tools { opacity: 1; }

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
        {editing ? (
          <>
            <button
              onClick={cancelEditing}
              style={{ fontSize: 11, color: T.text2, background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
            >Cancelar</button>
            <button
              onClick={saveEditing}
              style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: T.accent, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer' }}
            >Salvar</button>
          </>
        ) : (
          <>
            <button
              onClick={startEditing}
              style={{ fontSize: 11, color: T.text2, background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
            >✎ Editar painel</button>
            <button
              onClick={restoreDefault}
              style={{ fontSize: 11, color: T.text3, background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
            >Restaurar padrão</button>
          </>
        )}
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
          isDraggable={editing}
          isResizable={editing}
          resizeHandles={['s', 'e', 'se', 'w', 'n']}
          draggableCancel=".no-drag"
          compactType="vertical"
          onLayoutChange={handleLayoutChange}
        >
          {state.instances.map(inst => {
            const def = getWidget(inst.widgetId)
            if (!def) return <div key={inst.i} />
            const fit = def.overflow === 'fit'
            return (
              <div key={inst.i} className="altech-widget-card" style={{
                background: 'transparent', border: 'none', borderRadius: 12,
                display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
              }}>
                <div
                  className={`altech-widget-body${editing ? '' : ' no-drag'}${fit ? ' altech-widget-body-fit' : ''}${def.kind === 'kpi' ? ' altech-widget-kpi' : ''}`}
                  style={{
                    flex: '1 1 auto', minHeight: 0, width: '100%',
                    overflowY: fit ? 'hidden' : 'auto', overflowX: 'hidden',
                    containerType: 'inline-size',
                  }}
                >
                  {def.render(ctx)}
                </div>
                {editing && (
                  <div className="altech-widget-tools no-drag" style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 3,
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: T.bgSurface2, border: `1px solid ${T.border}`,
                    borderRadius: 8, padding: '2px 4px', maxWidth: '85%',
                  }}>
                    <EditableTitle
                      value={inst.title ?? def.title}
                      onConfirm={v => renameWidget(inst.i, v)}
                    />
                    <RemoveButton onClick={() => removeWidget(inst.i)} />
                  </div>
                )}
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

/** Título do card editável inline (apenas em modo edição). Enter/blur confirma, Esc cancela. */
function EditableTitle({ value, onConfirm }: { value: string; onConfirm: (v: string) => void }) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editingTitle) {
    return (
      <input
        autoFocus
        className="no-drag"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { onConfirm(draft); setEditingTitle(false) }
          else if (e.key === 'Escape') { setDraft(value); setEditingTitle(false) }
        }}
        onBlur={() => { onConfirm(draft); setEditingTitle(false) }}
        style={{
          flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: T.text1,
          fontFamily: 'inherit', background: T.bgSurface2, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '2px 6px', outline: 'none',
        }}
      />
    )
  }

  return (
    <button
      className="no-drag"
      title="Renomear card"
      onClick={() => { setDraft(value); setEditingTitle(true) }}
      style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', padding: 0, cursor: 'text', textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ color: T.text3, flexShrink: 0 }}>
        <path d="M11.2 2.4l2.4 2.4L5.8 12.6l-3.2.8.8-3.2 7.8-7.8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
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
