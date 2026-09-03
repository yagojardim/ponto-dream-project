/**
 * Altech — "Adicionar card" modal for the interactive Home grid.
 * Cards com thumbnail (mini-visualização) + resumo, agrupados por categoria.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { T } from '@/components/ds/tokens'
import { HOME_WIDGETS, type WidgetDef } from '@/data/homeWidgets'
import { widgetMetaFor, WIDGET_CATEGORY_ORDER, type WidgetViz } from '@/data/widgetMeta'

export type WidgetFormat = 'horizontal' | 'vertical'

interface Props {
  onClose: () => void
  onAdd: (widgetId: string, format: WidgetFormat) => void
}

interface Entry { w: WidgetDef; category: string; summary: string; viz: WidgetViz }

/** Cor principal da thumbnail por tipo de visualização. */
function vizColor(viz: WidgetViz): string {
  if (viz === 'alert' || viz === 'down') return T.crit
  return T.accent
}

/** Mini-visualização (thumbnail) do card por tipo. */
function WidgetThumb({ viz }: { viz: WidgetViz }) {
  const c = vizColor(viz)
  const el = (children: ReactNode) => (
    <svg width="72" height="46" viewBox="0 0 72 46" style={{ display: 'block' }}>{children}</svg>
  )
  switch (viz) {
    case 'number':
      return el(<>
        <text x="7" y="24" fill={c} fontSize="17" fontWeight="700" fontFamily="sans-serif">12k</text>
        <polyline points="7,38 19,34 31,36 43,29 55,31 66,24" fill="none" stroke={c} strokeWidth="2" />
      </>)
    case 'donut':
      return el(<>
        <circle cx="36" cy="23" r="14" fill="none" stroke={T.border2} strokeWidth="6" />
        <circle cx="36" cy="23" r="14" fill="none" stroke={c} strokeWidth="6" strokeDasharray="60 88" strokeLinecap="round" transform="rotate(-90 36 23)" />
      </>)
    case 'down':
      return el(<polyline points="7,13 21,19 35,17 49,28 63,38" fill="none" stroke={c} strokeWidth="2.5" />)
    case 'bars':
      return el(<>{[16, 28, 20, 36, 26].map((h, i) => (
        <rect key={i} x={8 + i * 12} y={41 - h} width="7" height={h} rx="1.5" fill={c} />
      ))}</>)
    case 'rag':
      return el(<>
        <circle cx="20" cy="23" r="7" fill={T.success} />
        <circle cx="37" cy="23" r="7" fill={T.warn} />
        <circle cx="54" cy="23" r="7" fill={T.crit} />
      </>)
    case 'burndown':
      return el(<>
        <polyline points="7,9 64,39" fill="none" stroke={T.border2} strokeWidth="1.4" strokeDasharray="3 3" />
        <polyline points="7,11 21,19 35,21 49,32 63,38" fill="none" stroke={c} strokeWidth="2.5" />
      </>)
    case 'target':
      return el(<>
        <circle cx="36" cy="23" r="15" fill="none" stroke={c} strokeWidth="2" opacity="0.4" />
        <circle cx="36" cy="23" r="9" fill="none" stroke={c} strokeWidth="2" opacity="0.7" />
        <circle cx="36" cy="23" r="4" fill={c} />
      </>)
    case 'progress':
      return el(<>
        <rect x="8" y="13" width="56" height="6" rx="3" fill={T.border2} />
        <rect x="8" y="13" width="40" height="6" rx="3" fill={c} />
        <rect x="8" y="28" width="56" height="6" rx="3" fill={T.border2} />
        <rect x="8" y="28" width="26" height="6" rx="3" fill={T.success} />
      </>)
    case 'lines':
      return el(<>
        <polyline points="7,32 21,26 35,28 49,20 63,16" fill="none" stroke={T.accent} strokeWidth="2" />
        <polyline points="7,38 21,36 35,30 49,28 63,24" fill="none" stroke={T.success} strokeWidth="2" />
      </>)
    case 'alert':
      return el(<>
        <text x="9" y="28" fill={c} fontSize="19" fontWeight="700" fontFamily="sans-serif">3</text>
        <path d="M44 15 l10 18 h-20 z" fill="none" stroke={c} strokeWidth="2" />
        <line x1="54" y1="24" x2="54" y2="29" stroke={c} strokeWidth="2" />
      </>)
    case 'list':
      return el(<>
        <rect x="8" y="11" width="56" height="4" rx="2" fill={c} opacity="0.6" />
        <rect x="8" y="21" width="44" height="4" rx="2" fill={T.border2} />
        <rect x="8" y="31" width="50" height="4" rx="2" fill={T.border2} />
      </>)
    case 'grid':
    default:
      return el(<>
        <rect x="8" y="9" width="24" height="12" rx="2" fill={c} opacity="0.5" />
        <rect x="40" y="9" width="24" height="12" rx="2" fill={c} opacity="0.3" />
        <rect x="8" y="25" width="24" height="12" rx="2" fill={c} opacity="0.3" />
        <rect x="40" y="25" width="24" height="12" rx="2" fill={c} opacity="0.5" />
      </>)
  }
}

function WidgetCard({ entry, active, onSelect }: { entry: Entry; active: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)
  const on = active || hovered
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', minWidth: 0,
        background: active ? `${T.accent}1A` : on ? `${T.accent}0A` : T.bgPage,
        border: `1px solid ${active ? T.accent : on ? T.accent + '66' : T.border}`,
        borderRadius: 12, padding: 10, cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <span style={{ width: 72, height: 46, flexShrink: 0, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <WidgetThumb viz={entry.viz} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.text1, lineHeight: 1.25 }}>{entry.w.title}</span>
        {entry.summary && (
          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: T.text3, lineHeight: 1.4 }}>{entry.summary}</span>
        )}
      </span>
    </button>
  )
}

export function AddWidgetModal({ onClose, onAdd }: Props) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [format, setFormat] = useState<WidgetFormat>('vertical')
  const [activeCat, setActiveCat] = useState<string>('Todos')

  const entries: Entry[] = useMemo(() => {
    const term = q.trim().toLowerCase()
    return HOME_WIDGETS
      .filter(w => !term || w.title.toLowerCase().includes(term))
      .map(w => {
        const m = widgetMetaFor(w.id, w.group, w.kind)
        return { w, category: m.category, summary: m.summary, viz: m.viz }
      })
  }, [q])

  // Categorias presentes, na ordem canônica (extras vão para o fim).
  const categories = useMemo(() => {
    const present = new Set(entries.map(e => e.category))
    const ordered = WIDGET_CATEGORY_ORDER.filter(c => present.has(c))
    const extras = [...present].filter(c => !WIDGET_CATEGORY_ORDER.includes(c)).sort()
    return [...ordered, ...extras]
  }, [entries])

  const visibleCats = activeCat === 'Todos' ? categories : categories.filter(c => c === activeCat)

  const pill = (label: string, on: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '5px 12px', borderRadius: 99,
        color: on ? T.accent : T.text2,
        background: on ? T.accentDim : T.bgPage,
        border: `1px solid ${on ? T.accentBorder : T.border}`,
      }}
    >{label}</button>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1300, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1301, width: 'min(660px, 95vw)', maxHeight: '86vh',
        background: T.bgSurface, border: `1px solid ${T.border2}`,
        borderRadius: 16, boxShadow: T.shadowModal,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>Adicionar card</div>
              <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>Escolha um card e o formato no painel.</div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, background: `${T.text3}14`, border: 'none', color: T.text2, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar card…"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, color: T.text1, background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', outline: 'none', marginTop: 11 }}
          />
          {/* Filtro por categoria */}
          <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            {pill('Todos', activeCat === 'Todos', () => setActiveCat('Todos'))}
            {categories.map(c => pill(c, activeCat === c, () => setActiveCat(c)))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 14px' }}>
          {visibleCats.map(cat => {
            const list = entries.filter(e => e.category === cat)
            if (list.length === 0) return null
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.text3, margin: '10px 4px 8px' }}>{cat}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  {list.map(e => (
                    <WidgetCard key={e.w.id} entry={e} active={selected === e.w.id} onSelect={() => setSelected(e.w.id)} />
                  ))}
                </div>
              </div>
            )
          })}
          {entries.length === 0 && (
            <div style={{ fontSize: 12, color: T.text3, textAlign: 'center', padding: 20 }}>Nenhum card encontrado.</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: T.text3 }}>Formato:</span>
          {(['horizontal', 'vertical'] as WidgetFormat[]).map(f => {
            const active = format === f
            return (
              <button key={f} onClick={() => setFormat(f)} style={{
                fontSize: 11, fontWeight: 600, color: active ? T.accent : T.text2,
                background: active ? T.accentDim : 'transparent',
                border: `1px solid ${active ? T.accentBorder : T.border}`,
                borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
              }}>{f === 'horizontal' ? 'Horizontal (largura total)' : 'Vertical (meia tela)'}</button>
            )
          })}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ fontSize: 12, color: T.text2, background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>Cancelar</button>
          <button
            disabled={!selected}
            onClick={() => { if (selected) { onAdd(selected, format); onClose() } }}
            style={{
              fontSize: 12, fontWeight: 600, color: selected ? '#fff' : T.text3,
              background: selected ? T.accent : T.bgSurface2,
              border: 'none', borderRadius: 6, padding: '6px 16px',
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >Adicionar</button>
        </div>
      </div>
    </>
  )
}
