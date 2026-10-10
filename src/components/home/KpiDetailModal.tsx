// Modal de detalhe de um KPI da Início, reutilizável por todos os perfis.
// Framework declarativo: cada perfil monta um KpiDetailConfig (abas por card)
// e o modal cuida de layout, abas, seletor multi-projeto, tabela com item
// clicável (→ abre no board), gráfico (ReactNode), sugestões e scroll.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { T } from '@/components/ds/tokens'
import { ProjectMultiSelect, type ProjectOption, type WorkItem } from '@/components/ds/DashboardKit'

export interface KpiDetailColumn {
  key: string
  header: string
  /** 'pill' colore por status; 'project' mostra a tag do projeto; 'mono'/'muted' estilizam. */
  kind?: 'pill' | 'project' | 'mono' | 'muted'
}
export interface KpiDetailRow {
  cells: Record<string, string>
  /** Projeto ao qual a linha pertence (para o filtro multi-projeto e a tag). */
  project?: ProjectOption
  /** Item real do board: quando presente, a linha vira clicável e abre o item. */
  item?: WorkItem
}
export interface KpiDetailTable {
  columns: KpiDetailColumn[]
  rows: KpiDetailRow[]
  title?: string
  emptyText?: string
}
export interface KpiDetailMetric { v: string; k: string; c?: string }
export interface KpiDetailTab {
  id: string
  label: string
  count?: string | number
  intro?: string
  metrics?: KpiDetailMetric[]
  chart?: ReactNode
  chartTitle?: string
  table?: KpiDetailTable
  /** Conteúdo assíncrono (carrega do banco de dentro do modal). Renderizado após métricas/gráfico. */
  live?: ReactNode
  /** Sugestão (💡) ou insight (📈), sempre em tom não-impositivo. */
  note?: { text: string; insight?: boolean }
  /** Ação de rodapé desta aba (sobrepõe a do config): mantém o destino que o card original tinha. */
  footerAction?: { label: string; onClick: () => void }
}
export interface KpiDetailConfig {
  title: string
  subtitle?: string
  tabs: KpiDetailTab[]
  initialTab?: number
  /** Link de ação no rodapé, quando o card original levava a alguma tela. */
  footerAction?: { label: string; onClick: () => void }
}

export interface KpiDetailModalProps {
  config: KpiDetailConfig | null
  projects: ProjectOption[]
  onOpenItem: (item: WorkItem) => void
  onClose: () => void
}

/** Cor do pill a partir do texto do status (mesma convenção do mockup aprovado). */
function statusColors(txt: string): { bg: string; fg: string } {
  const s = txt.toLowerCase()
  if (/(inativ|arquivad)/.test(s)) return { bg: T.bgSurface2, fg: T.text2 }
  if (/(cr[ií]tic|aberto|atrasad|reprovad|bloquead|vencid|voltou)/.test(s)) return { bg: `${T.crit}26`, fg: T.crit }
  if (/(risco|aten|pendente|valida|amarel|devolv|tombando|acumul|sem )/.test(s)) return { bg: `${T.warn}26`, fg: T.warn }
  if (/(teste|corre|em curso|design|andamento|revis|em dev)/.test(s)) return { bg: `${T.accent}26`, fg: T.accent }
  if (/(conclu|aprovad|pronto|resolvid|no prazo|em dia|entregue|saud|finaliz|ativo|feito)/.test(s)) return { bg: `${T.success}26`, fg: T.success }
  return { bg: T.bgSurface2, fg: T.text2 }
}

function Pill({ text }: { text: string }) {
  const c = statusColors(text)
  return <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap', background: c.bg, color: c.fg }}>{text}</span>
}

function ProjTag({ p }: { p?: ProjectOption }) {
  if (!p) return <span style={{ color: T.text3 }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.text2 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color ?? T.text3, flexShrink: 0 }} />{p.name}
    </span>
  )
}

/** Estilos do template premium: animações com mola, resposta ao toque e "reduzir movimento". */
const PREMIUM_CSS = `
@keyframes kpdFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes kpdIn { from { opacity: 0; transform: translate(-50%, -47%) scale(.96) } to { opacity: 1; transform: translate(-50%, -50%) scale(1) } }
@keyframes kpdSwap { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes kpdTile { from { opacity: 0; transform: translateY(12px) scale(.96) } to { opacity: 1; transform: none } }
.kpd-scrim { animation: kpdFade .3s ease both }
.kpd-sheet { animation: kpdIn .45s cubic-bezier(.32,.72,0,1) both }
.kpd-swap { animation: kpdSwap .38s cubic-bezier(.32,.72,0,1) both }
.kpd-tile { animation: kpdTile .5s cubic-bezier(.34,1.45,.64,1) both }
.kpd-press:active { transform: scale(.96) }
.kpd-row:hover { background: rgba(255,255,255,.05) }
@media (prefers-reduced-motion: reduce) {
  .kpd-scrim, .kpd-sheet, .kpd-swap, .kpd-tile { animation: none !important }
  .kpd-ind { transition: none !important }
}`

const GLASS_CARD = { background: 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)', borderRadius: 12 } as const

export function KpiDetailModal({ config, projects, onOpenItem, onClose }: KpiDetailModalProps) {
  const [tab, setTab] = useState(config?.initialTab ?? 0)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [ind, setInd] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null)
  // Reinicia a aba quando o config muda (novo card clicado).
  const activeId = config?.tabs[Math.min(tab, (config?.tabs.length ?? 1) - 1)]?.id
  const t = useMemo(
    () => config?.tabs.find(x => x.id === activeId) ?? config?.tabs[0],
    [config, activeId],
  )
  const activeIndex = config ? Math.max(0, config.tabs.findIndex(x => x.id === t?.id)) : 0

  // Indicador deslizante da aba ativa.
  // Mede de novo após a animação de entrada e ao redimensionar, para o indicador nunca ficar fora de lugar.
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[activeIndex]
      if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth })
    }
    measure()
    const raf = requestAnimationFrame(measure)
    const late = window.setTimeout(measure, 480)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(late)
      window.removeEventListener('resize', measure)
    }
  }, [activeIndex, config])

  // Esc fecha o modal.
  useEffect(() => {
    if (!config) return undefined
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [config, onClose])

  if (!config || !t) return null
  const footer = t.footerAction ?? config.footerAction

  const filterRows = (rows: KpiDetailRow[]) =>
    sel.size === 0 ? rows : rows.filter(r => !r.project || sel.has(r.project.id))

  // Arrastar o topo para baixo fecha (acompanha o ponteiro 1:1; fecha por distância ou arremesso).
  const onHeaderDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, v: 0 }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ponteiro sintético */ }
    if (sheetRef.current) sheetRef.current.style.animation = 'none'
  }
  const onHeaderMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || !sheetRef.current) return
    const now = performance.now()
    const dy = Math.max(0, e.clientY - d.y)
    d.v = (dy - d.dy) / Math.max(1, now - d.t)
    d.dy = dy
    d.t = now
    sheetRef.current.style.transform = `translate(-50%, calc(-50% + ${dy}px)) scale(${1 - Math.min(0.04, dy / 2500)})`
  }
  const onHeaderUp = () => {
    const d = drag.current
    drag.current = null
    if (!d || !sheetRef.current) return
    if (d.dy > 120 || d.v > 0.6) onClose()
    else sheetRef.current.style.transform = 'translate(-50%, -50%)'
  }

  return (
    <>
      <style>{PREMIUM_CSS}</style>
      <div className="kpd-scrim" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(4,5,8,.55)', zIndex: 1300, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
      <div ref={sheetRef} className="kpd-sheet" role="dialog" aria-modal="true" aria-label={config.title} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1301, width: 'min(900px, 95vw)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(30,33,45,.9), rgba(14,16,22,.96))',
        backdropFilter: 'blur(34px) saturate(1.8)', WebkitBackdropFilter: 'blur(34px) saturate(1.8)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1), 0 40px 90px rgba(0,0,0,.6)',
      }}>
        {/* Brilho de fundo na identidade do Início (azul e índigo) */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(520px 260px at 100% 0, rgba(59,130,246,.22), transparent 70%), radial-gradient(420px 240px at 0 100%, rgba(99,102,241,.14), transparent 70%)',
        }} />

        {/* Cabeçalho (arraste para baixo para fechar) */}
        <div onPointerDown={onHeaderDown} onPointerMove={onHeaderMove} onPointerUp={onHeaderUp} onPointerCancel={onHeaderUp}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px 14px', flexShrink: 0, cursor: 'grab', touchAction: 'pan-y', userSelect: 'none' }}>
          <span aria-hidden style={{
            width: 44, height: 44, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff',
            background: `linear-gradient(145deg, ${T.accent}, ${T.indigo})`,
            boxShadow: `0 10px 24px -8px ${T.accent}, inset 0 0 0 1px rgba(255,255,255,.25)`,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.025em', color: T.text1 }}>{config.title}</div>
            {config.subtitle && <div style={{ fontSize: 13, color: T.text2, marginTop: 3 }}>{config.subtitle}</div>}
          </div>
          <span style={{ flex: 1 }} />
          <ProjectMultiSelect projects={projects} selected={sel} onChange={setSel} />
          <button className="kpd-press" onClick={onClose} aria-label="Fechar" style={{
            width: 32, height: 32, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.1)', color: '#d4d8e6', fontSize: 15,
            cursor: 'pointer', lineHeight: 1, transition: 'background .15s, transform .12s',
          }}>✕</button>
        </div>

        {/* Abas: controle segmentado com indicador que desliza */}
        <div role="tablist" style={{ position: 'relative', display: 'flex', gap: 2, margin: '0 24px', padding: 3, borderRadius: 8, background: 'rgba(255,255,255,.07)', flexShrink: 0, overflowX: 'auto' }}>
          <span aria-hidden className="kpd-ind" style={{
            position: 'absolute', top: 3, bottom: 3, left: 0, width: ind.width, transform: `translateX(${ind.left}px)`,
            borderRadius: 6, background: 'rgba(255,255,255,.17)', boxShadow: '0 2px 8px rgba(0,0,0,.35)',
            transition: 'transform .4s cubic-bezier(.34,1.45,.64,1), width .4s cubic-bezier(.34,1.45,.64,1)',
          }} />
          {config.tabs.map((x, i) => {
            const on = x.id === t.id
            return (
              <button key={x.id} ref={el => { tabRefs.current[i] = el }} role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
                onClick={() => setTab(i)}
                onKeyDown={e => {
                  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                  if (!d) return
                  e.preventDefault()
                  const n = (i + d + config.tabs.length) % config.tabs.length
                  setTab(n)
                  tabRefs.current[n]?.focus()
                }}
                style={{
                  position: 'relative', zIndex: 1, flex: '1 1 auto', display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600, color: on ? '#fff' : '#aab1c6', background: 'transparent', border: 'none', borderRadius: 6,
                  padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .2s',
                }}>
                {x.label}
                {x.count != null && <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,.14)', borderRadius: 5, padding: '1px 6px' }}>{x.count}</span>}
              </button>
            )
          })}
        </div>

        {/* Corpo rolável */}
        <div key={t.id} className="kpd-swap" style={{ position: 'relative', padding: '16px 24px 20px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: T.text3, margin: '0 0 12px' }}>
            Escopo: <b style={{ color: T.text2, fontWeight: 500 }}>{sel.size === 0 ? 'todos os projetos' : [...sel].map(id => projects.find(p => p.id === id)?.name ?? id).join(', ')}</b> · selecione 1 ou mais projetos no filtro acima
          </div>

          {t.intro && <div style={{ fontSize: 13.5, color: '#b4bacd', lineHeight: 1.5, margin: '0 0 14px', maxWidth: '76ch' }}>{t.intro}</div>}

          {t.metrics && t.metrics.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '0 0 16px' }}>
              {t.metrics.map((m, i) => (
                <div key={i} className="kpd-tile" style={{ ...GLASS_CARD, padding: '13px 15px', animationDelay: `${i * 55 + 80}ms` }}>
                  <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.1, color: m.c ?? T.text1 }}>{m.v}</div>
                  <div style={{ fontSize: 11.5, color: T.text3, marginTop: 3 }}>{m.k}</div>
                </div>
              ))}
            </div>
          )}

          {t.chart && (
            <div style={{ ...GLASS_CARD, padding: '14px 16px', margin: '0 0 16px' }}>
              {t.chartTitle && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text1, marginBottom: 8 }}>{t.chartTitle}</div>}
              {t.chart}
            </div>
          )}

          {t.table && (
            <div style={{ ...GLASS_CARD, padding: '8px 8px 4px', margin: '0 0 4px' }}>
              <DetailTable table={t.table} filterRows={filterRows} onOpenItem={item => { onClose(); onOpenItem(item) }} />
            </div>
          )}

          {t.live}

          {t.note && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'flex-start', margin: '14px 0 0', fontSize: 13, lineHeight: 1.5,
              background: t.note.insight ? 'rgba(52,199,123,.09)' : 'rgba(59,130,246,.1)',
              boxShadow: `inset 0 0 0 1px ${t.note.insight ? 'rgba(52,199,123,.25)' : 'rgba(59,130,246,.28)'}`,
              borderRadius: 12, padding: '12px 14px', color: t.note.insight ? '#cdeedb' : '#c9d6f5',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                {t.note.insight
                  ? <path d="M3 17l6-6 4 4 8-8M15 7h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  : <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
              <span>{t.note.text}</span>
            </div>
          )}
        </div>

        {/* Rodapé */}
        {footer && (
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', padding: '14px 24px 18px', background: 'linear-gradient(180deg, transparent, rgba(10,11,16,.6) 40%)', flexShrink: 0 }}>
            <button className="kpd-press" onClick={() => { onClose(); footer.onClick() }} style={{
              fontSize: 12, fontWeight: 600, color: '#fff', background: T.accent, border: 'none', borderRadius: 7,
              padding: '8px 15px', cursor: 'pointer', transition: 'transform .12s',
            }}>{footer.label}</button>
          </div>
        )}
      </div>
    </>
  )
}

function DetailTable({ table, filterRows, onOpenItem }: {
  table: KpiDetailTable
  filterRows: (rows: KpiDetailRow[]) => KpiDetailRow[]
  onOpenItem: (item: WorkItem) => void
}) {
  const rows = filterRows(table.rows)
  return (
    <>
      {table.title && <div style={{ fontSize: 11, color: T.text2, margin: '4px 0 6px' }}>{table.title}</div>}
      {rows.length === 0
        ? <div style={{ color: T.text2, padding: '16px 4px', fontSize: 12.5 }}>{table.emptyText ?? 'Sem itens para este projeto.'}</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>{table.columns.map(c => (
                  <th key={c.key} style={{ textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.text3, fontWeight: 600, padding: '2px 10px 8px', borderBottom: `1px solid ${T.border}` }}>{c.header}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => {
                  const clickable = !!r.item
                  return (
                    <tr key={ri}
                      onClick={clickable ? () => onOpenItem(r.item as WorkItem) : undefined}
                      title={clickable ? 'Abrir no board' : undefined}
                      style={{ cursor: clickable ? 'pointer' : 'default' }}
                      onMouseEnter={clickable ? e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,.05)' } : undefined}
                      onMouseLeave={clickable ? e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' } : undefined}>
                      {table.columns.map(c => {
                        const v = r.cells[c.key] ?? ''
                        let content: ReactNode = v
                        let color: string = T.text1
                        if (c.kind === 'project') content = <ProjTag p={r.project} />
                        else if (c.kind === 'pill') content = <Pill text={v} />
                        else if (c.kind === 'mono') { content = <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: clickable ? T.accent : T.text3 }}>{v}</span> }
                        else if (c.kind === 'muted') color = T.text2
                        return <td key={c.key} style={{ padding: 10, borderBottom: `1px solid ${T.border}`, color, verticalAlign: 'middle' }}>{content}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </>
  )
}
