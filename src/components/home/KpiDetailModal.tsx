// Modal de detalhe de um KPI da Início, reutilizável por todos os perfis.
// Framework declarativo: cada perfil monta um KpiDetailConfig (abas por card)
// e o modal cuida de layout, abas, seletor multi-projeto, tabela com item
// clicável (→ abre no board), gráfico (ReactNode), sugestões e scroll.
import { useMemo, useState, type ReactNode } from 'react'
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

export function KpiDetailModal({ config, projects, onOpenItem, onClose }: KpiDetailModalProps) {
  const [tab, setTab] = useState(config?.initialTab ?? 0)
  const [sel, setSel] = useState<Set<string>>(new Set())
  // Reinicia a aba quando o config muda (novo card clicado).
  const activeId = config?.tabs[Math.min(tab, (config?.tabs.length ?? 1) - 1)]?.id
  const t = useMemo(
    () => config?.tabs.find(x => x.id === activeId) ?? config?.tabs[0],
    [config, activeId],
  )
  if (!config || !t) return null

  const filterRows = (rows: KpiDetailRow[]) =>
    sel.size === 0 ? rows : rows.filter(r => !r.project || sel.has(r.project.id))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1300, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1301, width: 'min(880px, 95vw)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: T.text1 }}>
            {config.title}
            {config.subtitle && <span style={{ fontSize: 12, color: T.text3, fontWeight: 400, marginLeft: 8 }}>{config.subtitle}</span>}
          </span>
          <span style={{ flex: 1 }} />
          <ProjectMultiSelect projects={projects} selected={sel} onChange={setSel} />
          <button onClick={onClose} aria-label="Fechar" style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.text2, fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 14px 0', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', flexShrink: 0 }}>
          {config.tabs.map((x, i) => {
            const on = x.id === t.id
            return (
              <button key={x.id} onClick={() => setTab(i)} style={{
                fontSize: 12.5, fontWeight: 500, color: on ? T.text1 : T.text2,
                background: 'transparent', border: 'none', borderBottom: `2px solid ${on ? T.accent : 'transparent'}`,
                padding: '8px 12px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {x.label}{x.count != null && <span style={{ fontSize: 10.5, color: on ? T.accent : T.text3, marginLeft: 5 }}>{x.count}</span>}
              </button>
            )
          })}
        </div>

        {/* Corpo rolável */}
        <div style={{ padding: '18px 20px 20px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          <div style={{ fontSize: 11.5, color: T.text3, margin: '0 0 12px' }}>
            Escopo: <b style={{ color: T.text2, fontWeight: 500 }}>{sel.size === 0 ? 'todos os projetos' : [...sel].map(id => projects.find(p => p.id === id)?.name ?? id).join(', ')}</b> · selecione 1 ou mais projetos para comparar
          </div>

          {t.intro && <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.55, margin: '0 0 14px', maxWidth: '76ch' }}>{t.intro}</div>}

          {t.metrics && t.metrics.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '0 0 16px' }}>
              {t.metrics.map((m, i) => (
                <div key={i} style={{ background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', minWidth: 120 }}>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: m.c ?? T.text1 }}>{m.v}</div>
                  <div style={{ fontSize: 10.5, color: T.text3, marginTop: 2 }}>{m.k}</div>
                </div>
              ))}
            </div>
          )}

          {t.chart && (
            <div style={{ background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', margin: '0 0 16px' }}>
              {t.chartTitle && <div style={{ fontSize: 11, color: T.text2, marginBottom: 4 }}>{t.chartTitle}</div>}
              {t.chart}
            </div>
          )}

          {t.table && <DetailTable table={t.table} filterRows={filterRows} onOpenItem={item => { onClose(); onOpenItem(item) }} />}

          {t.live}

          {t.note && (
            <div style={{
              display: 'flex', gap: 9, alignItems: 'flex-start', margin: '14px 0 0', fontSize: 12.5, lineHeight: 1.5,
              background: t.note.insight ? `${T.purple}14` : `${T.accent}14`,
              border: `1px solid ${t.note.insight ? `${T.purple}44` : `${T.accent}44`}`,
              borderRadius: 10, padding: '11px 13px', color: T.text1,
            }}>
              <span style={{ fontSize: 14 }}>{t.note.insight ? '📈' : '💡'}</span>
              <span>{t.note.text}</span>
            </div>
          )}
        </div>

        {/* Rodapé */}
        {config.footerAction && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '13px 20px', borderTop: `1px solid ${T.border}`, background: T.bgSurface2, flexShrink: 0 }}>
            <button onClick={() => { onClose(); config.footerAction?.onClick() }} style={{
              fontSize: 12.5, fontWeight: 500, color: T.accent, background: `${T.accent}1A`,
              border: `1px solid ${T.accent}4D`, borderRadius: 8, padding: '7px 13px', cursor: 'pointer',
            }}>{config.footerAction.label}</button>
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
                      onMouseEnter={clickable ? e => { (e.currentTarget as HTMLTableRowElement).style.background = T.bgSurface2 } : undefined}
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
