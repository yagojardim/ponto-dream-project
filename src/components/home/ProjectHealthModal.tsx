// Modal de Saúde do Projeto — abre ao clicar num projeto do card RAG (Início).
// Multi-projeto: chips internas permitem transitar entre os projetos do escopo
// sem fechar. Todos os números derivam de dados reais (RagProject + SprintSummary);
// score e eixos são composição transparente desses sinais (No Invention).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { T } from '@/components/ds/tokens'
import { ragConfig, type RagStatus } from '@/components/ds/DashboardKit'
import { setListPrefilter } from '@/data/listPrefilter'
import type { RagProject, SprintSummary } from '@/data/db/dashboards'

interface HealthAxis { name: string; value: number; color: string }
interface HealthTip { icon: string; title: string; desc: string }
interface Health { score: number; axes: HealthAxis[]; tips: HealthTip[]; verdict: string }

function axisColor(v: number): string {
  return v >= 70 ? T.success : v >= 45 ? T.warn : T.crit
}

// Prazo → 0-100 a partir da margem de dias (periodEnd/daysLeft do RagProject).
function prazoScore(p: RagProject): number {
  if (!p.periodEnd) return 70
  const d = p.daysLeft
  if (d < 0) return 15
  if (d <= 3) return 40
  if (d <= 7) return 60
  if (d <= 14) return 80
  return 95
}

function buildTips(p: RagProject): HealthTip[] {
  const open = Math.max(0, p.total - p.done)
  const tips: HealthTip[] = []
  if (p.blockedCount > 0) {
    tips.push({
      icon: '⛔', title: `${p.blockedCount} item(ns) bloqueado(s)`,
      desc: p.reason
        ? `Fluxo represado — ${p.reason}. Caminho possível: destravar o item libera o restante.`
        : 'Fluxo represado — destravar o item libera o restante da fila.',
    })
  }
  if (p.periodEnd && p.daysLeft < 0) {
    tips.push({
      icon: '📅', title: 'Prazo estourado',
      desc: `Período encerrado há ${Math.abs(p.daysLeft)}d com ${open} item(ns) em aberto. Vale replanejar o prazo ou renegociar o escopo.`,
    })
  } else if (p.periodEnd && p.daysLeft <= 14 && p.pct < 70) {
    tips.push({
      icon: '⏱️', title: 'Ritmo abaixo do necessário',
      desc: `${p.pct}% concluído a ${p.daysLeft}d do fim. Caminho possível: repriorizar o essencial e proteger o objetivo do período.`,
    })
  }
  if (p.rag === 'healthy') {
    tips.push({ icon: '✅', title: 'Ritmo saudável', desc: `${p.done} de ${p.total} itens concluídos; siga no ritmo para fechar o período.` })
    if (open > 0) tips.push({ icon: '📌', title: 'Feche o ciclo', desc: `${open} item(ns) em aberto — mantenha o foco na reta final.` })
  } else {
    tips.push({ icon: '🚩', title: 'Acompanhar de perto', desc: 'Revisite este projeto na daily — a janela para corrigir o curso é curta.' })
  }
  return tips
}

/** Deriva score (0-100), eixos e dicas a partir dos sinais reais do projeto. */
export function projectHealth(p: RagProject): Health {
  const progresso = Math.max(0, Math.min(100, p.pct))
  const prazo = prazoScore(p)
  const bloqueios = p.blockedCount === 0 ? 100 : Math.max(10, 100 - p.blockedCount * 30)
  const axes: HealthAxis[] = [
    { name: 'Progresso', value: progresso, color: axisColor(progresso) },
    { name: 'Prazo', value: prazo, color: axisColor(prazo) },
    { name: 'Bloqueios', value: bloqueios, color: axisColor(bloqueios) },
  ]
  const score = Math.round(progresso * 0.4 + prazo * 0.35 + bloqueios * 0.25)
  const verdict = p.rag === 'blocked' ? 'ação imediata' : p.rag === 'risk' ? 'precisa de atenção' : 'no caminho'
  return { score, axes, tips: buildTips(p), verdict }
}

function fmtDay(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function periodLabel(p: RagProject, sprint?: SprintSummary): string {
  if (sprint) return `${sprint.name} · ${fmtDay(sprint.startDate)}–${fmtDay(sprint.endDate)}`
  if (p.periodEnd) return `Período até ${fmtDay(p.periodEnd)}`
  return 'Sem período definido'
}

function statusColor(r: RagStatus): string {
  return r === 'healthy' ? T.success : r === 'risk' ? T.warn : T.crit
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const off = 100 - score
  return (
    <svg viewBox="0 0 36 36" style={{ width: 62, height: 62, flexShrink: 0 }}>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke={T.bgSurface2} strokeWidth="3.4" />
      <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round"
        strokeDasharray={`${score} ${off}`} transform="rotate(-90 18 18)" />
      <text x="18" y="19.5" textAnchor="middle" fill={T.text1} fontSize="9" fontWeight="700">{score}</text>
    </svg>
  )
}

export function ProjectHealthModal({ projects, initialId, sprintByProject, onClose, onNav }: {
  projects: RagProject[]
  initialId: string
  sprintByProject: Map<string, SprintSummary>
  onClose: () => void
  onNav: (view: string, targetId?: string) => void
}) {
  const [activeId, setActiveId] = useState(initialId)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const active = projects.find(p => p.id === activeId) ?? projects[0]
  if (!active) return null
  const { label, color } = ragConfig(active.rag)
  const h = projectHealth(active)
  const sprint = sprintByProject.get(active.id)
  const open = Math.max(0, active.total - active.done)

  const mets: [string, string][] = [
    [`${active.pct}%`, 'concluído'],
    [`${active.done}/${active.total}`, 'itens'],
    [`${active.blockedCount}`, 'bloqueados'],
    [active.daysLabel, 'prazo'],
  ]

  const footBtn = (txt: string, onClick: () => void, primary = false) => (
    <button onClick={onClick} style={{
      fontSize: 12, borderRadius: 7, padding: '7px 14px', cursor: 'pointer',
      border: `1px solid ${primary ? T.accent : T.border2}`,
      background: primary ? T.accent : T.bgSurface2, color: primary ? '#fff' : T.text1,
    }}>{txt}</button>
  )

  return createPortal(
    <div onClick={onClose} className="no-drag"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1300, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1301,
          width: 'min(660px, 95vw)', maxHeight: '88vh', overflowY: 'auto',
          background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 14,
          color: T.text1, fontFamily: 'inherit',
        }}>
        {/* Header + chips de projetos (transita sem fechar) */}
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <b style={{ fontSize: 15 }}>Saúde do Projeto</b>
            <span onClick={onClose} style={{ marginLeft: 'auto', color: T.text3, cursor: 'pointer', fontSize: 16 }}>✕</span>
          </div>
          {projects.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
              {projects.map(p => {
                const on = p.id === active.id
                return (
                  <span key={p.id} onClick={() => setActiveId(p.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer',
                      color: on ? T.text1 : T.text2, background: on ? T.bgSurface2 : 'transparent',
                      border: `1px solid ${on ? T.accent : T.border}`, borderRadius: 999, padding: '3px 10px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(p.rag), flexShrink: 0 }} />
                    {p.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Título do projeto + selo */}
        <div style={{ padding: '15px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: color }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{active.name}</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: T.text3, marginTop: 2 }}>
              {active.key} · {periodLabel(active, sprint)}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color, background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 999, padding: '4px 12px', height: 'fit-content' }}>{label}</span>
        </div>

        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '0 18px 15px' }}>
          <ScoreRing score={h.score} color={color} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Saúde {h.score} · {h.verdict}</div>
            {active.reason && <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{active.reason}</div>}
          </div>
        </div>

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9, padding: '0 18px 14px' }}>
          {mets.map(([v, l]) => (
            <div key={l} style={{ background: T.bgSurface2, borderRadius: 9, padding: '9px 11px' }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{v}</div>
              <div style={{ fontSize: 10.5, color: T.text3, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Eixos */}
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ fontSize: 11, color: T.text3, textTransform: 'uppercase', letterSpacing: '.5px', margin: '6px 0 8px' }}>
            Eixos de saúde <span style={{ textTransform: 'none', letterSpacing: 0 }}>(compõem o score)</span>
          </div>
          {h.axes.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
              <span style={{ width: 92, flexShrink: 0, fontSize: 12, color: T.text2 }}>{a.name}</span>
              <div style={{ flex: 1, height: 8, background: T.bgSurface2, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${a.value}%`, height: '100%', background: a.color }} />
              </div>
              <span style={{ width: 30, textAlign: 'right', fontSize: 11, color: T.text2 }}>{a.value}</span>
            </div>
          ))}
        </div>

        {/* Dicas */}
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ fontSize: 11, color: T.text3, textTransform: 'uppercase', letterSpacing: '.5px', margin: '6px 0 8px' }}>
            {active.rag === 'healthy' ? 'O que manter' : 'O que melhorar'}
          </div>
          {h.tips.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: T.bgSurface2, borderRadius: 8, padding: '9px 12px', marginBottom: 7 }}>
              <span style={{ flexShrink: 0, fontSize: 14, marginTop: 1 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 12.5 }}>{t.title}</div>
                <div style={{ fontSize: 11.5, color: T.text2, marginTop: 2 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', gap: 8, padding: '13px 18px', borderTop: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          {footBtn('Abrir board', () => onNav('project', active.id), true)}
          {footBtn('Ver itens', () => { setListPrefilter({ projectId: active.id }); onNav('list') })}
          {footBtn('Ver sprint / prazo', () => onNav('project', `${active.id}#Sprints`))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
