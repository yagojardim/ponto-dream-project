/**
 * Altech — "Adicionar card" modal for the interactive Home grid.
 * Same overlay/visual pattern as CompleteSprintModal (no shadcn).
 */
import { useMemo, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { HOME_WIDGETS, type WidgetDef, type WidgetGroup } from '@/data/homeWidgets'

export type WidgetFormat = 'horizontal' | 'vertical'

interface Props {
  onClose: () => void
  onAdd: (widgetId: string, format: WidgetFormat) => void
}

const GROUPS: WidgetGroup[] = ['Início', 'Relatórios']

export function AddWidgetModal({ onClose, onAdd }: Props) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [format, setFormat] = useState<WidgetFormat>('vertical')

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return HOME_WIDGETS.filter(w => !term || w.title.toLowerCase().includes(term))
  }, [q])

  const byGroup = (g: WidgetGroup): WidgetDef[] => filtered.filter(w => w.group === g)

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1300, backdropFilter: 'blur(2px)' }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1301, width: 'min(620px, 95vw)', maxHeight: '85vh',
        background: T.bgSurface, border: `1px solid ${T.border2}`,
        borderRadius: 16, boxShadow: T.shadowModal,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>Adicionar card</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>
              Escolha um card do Início ou de Relatórios e o formato no painel.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 7, background: `${T.text3}14`, border: 'none', color: T.text2, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ padding: '12px 20px 0' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar card…"
            style={{
              width: '100%', fontSize: 12, color: T.text1, background: T.bgSurface2,
              border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', outline: 'none',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {GROUPS.map(g => {
            const list = byGroup(g)
            if (list.length === 0) return null
            return (
              <div key={g} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.text3, marginBottom: 8 }}>{g}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.map(w => {
                    const active = selected === w.id
                    return (
                      <button
                        key={w.id}
                        onClick={() => setSelected(w.id)}
                        style={{
                          textAlign: 'left', fontSize: 12, color: active ? T.text1 : T.text2,
                          background: active ? T.accentDim : 'transparent',
                          border: `1px solid ${active ? T.accentBorder : T.border}`,
                          borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                        }}
                      >{w.title}</button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, color: T.text3, textAlign: 'center', padding: 20 }}>Nenhum card encontrado.</div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: T.text3 }}>Formato:</span>
          {(['horizontal', 'vertical'] as WidgetFormat[]).map(f => {
            const active = format === f
            return (
              <button
                key={f}
                onClick={() => setFormat(f)}
                style={{
                  fontSize: 11, fontWeight: 600,
                  color: active ? T.accent : T.text2,
                  background: active ? T.accentDim : 'transparent',
                  border: `1px solid ${active ? T.accentBorder : T.border}`,
                  borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                }}
              >{f === 'horizontal' ? 'Horizontal (largura total)' : 'Vertical (meia tela)'}</button>
            )
          })}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ fontSize: 12, color: T.text2, background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
          >Cancelar</button>
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
