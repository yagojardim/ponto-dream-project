// Assistente de gestão — regras/heurísticas determinísticas (explicáveis, sem ML).
// Recebe os agregados reais (ReportsData) e devolve APENAS os cenários cuja
// condição é verdadeira nos dados, ranqueados por severidade. Segue o princípio
// da Constitution: o dashboard OBSERVA + SUGERE, nunca decide/executa — cada
// insight só descreve o "porquê" e navega (o clique é do usuário).
import type { ReportsData } from '@/data/db/reports'
import { liveProjects } from '@/data/db/homeLive'

/** Severidade visual do insight: 🔴 crit · 🟡 warn · 🔵 info. */
export type InsightSeverity = 'crit' | 'warn' | 'info'

/** Intenção de navegação passiva — o clique só leva o usuário ao board/lista. */
export interface InsightNav {
  view: string
  targetId?: string
  status?: string
  itemType?: string
}

export interface AssistantInsight {
  id: string
  severity: InsightSeverity
  /** Título curto do ponto de atenção. */
  title: string
  /** Explicação consultiva do "porquê" (linguagem de gestão, não de ação). */
  detail: string
  /** Para onde o clique navega (opcional). */
  nav?: InsightNav
}

export interface AssistantReport {
  /** Demandas efetivamente analisadas (amostra de itens concluídos medidos). */
  analyzed: number
  /** Total de verificações executadas (cenários avaliados). */
  totalChecks: number
  /** Insights acionados, do mais severo para o menos severo. */
  insights: AssistantInsight[]
  /** Verificações que passaram (totalChecks − insights acionados). */
  passed: number
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const SEVERITY_RANK: Record<InsightSeverity, number> = { crit: 0, warn: 1, info: 2 }

/** Número total de cenários avaliados (mantém o rodapé "N verificações passaram"). */
export const TOTAL_SCENARIOS = 12

/**
 * Avalia os 12 cenários sobre os dados reais e devolve só os acionados.
 * Cada cenário é uma condição booleana determinística — nada é inventado.
 */
export function buildAssistantInsights(data: ReportsData): AssistantReport {
  const m = data.management
  const sp = data.sprintProgress
  const insights: AssistantInsight[] = []

  const projectName = (id: string): string =>
    liveProjects().find(p => p.id === id)?.name ?? 'Projeto'

  // 1 — Espera domina o Lead: gargalo é fila/priorização, não capacidade.
  if (m.sampleSize > 0 && m.waitPct > 60) {
    insights.push({
      id: 'wait-dominates', severity: 'warn',
      title: 'A fila consome a maior parte do tempo',
      detail: `Atenção: ${m.waitPct}% do lead time é espera em fila (${fmt(m.waitAvg)}d de ${fmt(m.leadAvg)}d). O gargalo é priorização, não capacidade.`,
      nav: { view: 'list' },
    })
  }

  // 2 — Cycle ≈ 0: itens pulam "Em andamento" (higiene do board).
  if (m.sampleSize > 0 && m.leadAvg > 1 && m.cycleAvg <= 0.5) {
    insights.push({
      id: 'cycle-zero', severity: 'info',
      title: 'Itens pulam "Em andamento"',
      detail: `Vale olhar: o cycle time está perto de zero enquanto o lead é de ${fmt(m.leadAvg)}d — sinal de que itens são concluídos sem passar por "Em andamento". Questão de higiene do board.`,
      nav: { view: 'boards-list' },
    })
  }

  // 3 — Lead sobe em 3 períodos consecutivos: tendência de piora.
  if (m.trend.length >= 3 && m.trend.every(v => v > 0) && m.trend[0] < m.trend[1] && m.trend[1] < m.trend[2]) {
    insights.push({
      id: 'lead-rising', severity: 'warn',
      title: 'Lead time em tendência de piora',
      detail: `Atenção: o lead subiu nos últimos períodos (${m.trend.map(fmt).join('d → ')}d). Vale entender o que mudou no fluxo.`,
      nav: { view: 'reports' },
    })
  }

  // 4 — P85 muito acima da média: baixa previsibilidade.
  if (m.sampleSize >= 5 && m.p85 > m.leadAvg * 1.8 && m.leadAvg > 0) {
    insights.push({
      id: 'low-predictability', severity: 'warn',
      title: 'Baixa previsibilidade de entrega',
      detail: `Vale olhar: 85% das entregas levam até ${fmt(m.p85)}d, bem acima da média de ${fmt(m.leadAvg)}d. Fatiar histórias grandes tende a estreitar essa cauda.`,
      nav: { view: 'list' },
    })
  }

  // 5 — Item mais de 2× o Lead médio parado: risco de envelhecer.
  if (m.leadAvg > 0 && m.agingMax > m.leadAvg * 2) {
    insights.push({
      id: 'aging-item', severity: 'warn',
      title: 'Demanda envelhecendo no mesmo status',
      detail: `Atenção: há item parado há ${m.agingMax}d — mais de 2× o lead médio (${fmt(m.leadAvg)}d). Risco de envelhecer e travar o fluxo.`,
      nav: { view: 'list', status: 'in_progress' },
    })
  }

  // 6 — WIP alto vs. vazão baixa: excesso de paralelo (Lei de Little).
  if (m.throughputPerWeek > 0 && m.wipNow > m.throughputPerWeek * 2) {
    insights.push({
      id: 'wip-overload', severity: 'info',
      title: 'Muito trabalho em paralelo',
      detail: `Vale olhar: são ${m.wipNow} itens em andamento para uma vazão de ${fmt(m.throughputPerWeek)}/semana. Pela Lei de Little, mais WIP tende a aumentar o lead time.`,
      nav: { view: 'boards-list' },
    })
  }

  // 7 — Acúmulo em "Em revisão"/teste: gargalo de PR/revisão.
  if (m.reviewWip >= 3 && m.wipNow > 0 && m.reviewWip >= m.wipNow * 0.4) {
    insights.push({
      id: 'review-bottleneck', severity: 'warn',
      title: 'Gargalo em revisão',
      detail: `Atenção: ${m.reviewWip} itens parados em revisão/teste. Possível fila de PR aguardando revisor.`,
      nav: { view: 'boards-list' },
    })
  }

  // 8 — Lead de bugs maior que o de histórias: retrabalho/qualidade.
  if (m.byType.bug > 0 && m.byType.story > 0 && m.byType.bug > m.byType.story * 1.3) {
    insights.push({
      id: 'bug-lead', severity: 'warn',
      title: 'Bugs demoram mais que histórias',
      detail: `Vale olhar: o lead de bugs (${fmt(m.byType.bug)}d) supera o de histórias (${fmt(m.byType.story)}d) — sinal de retrabalho ou dívida de qualidade.`,
      nav: { view: 'list', itemType: 'bug' },
    })
  }

  // 9 — Um projeto puxa a média (outlier): olhar isolado.
  if (m.byProject.length >= 2) {
    const sorted = [...m.byProject].sort((a, b) => b.lead - a.lead)
    const top = sorted[0]
    const others = sorted.slice(1)
    const otherAvg = others.reduce((a, p) => a + p.lead, 0) / others.length
    if (otherAvg > 0 && top.lead > otherAvg * 1.8 && top.count > 0) {
      insights.push({
        id: 'project-outlier', severity: 'info',
        title: 'Um projeto distorce a média',
        detail: `Vale olhar: ${projectName(top.projectId)} tem lead de ${fmt(top.lead)}d, contra ${fmt(Math.round(otherAvg * 10) / 10)}d dos demais. A média geral esconde esse caso — olhe isolado.`,
        nav: { view: 'project', targetId: top.projectId },
      })
    }
  }

  // 10 — Itens voltando de status: rework.
  if (m.reworkCount > 0) {
    insights.push({
      id: 'rework', severity: 'warn',
      title: 'Retrabalho detectado',
      detail: `Atenção: ${m.reworkCount} demanda(s) voltaram para um status anterior no board — rework que infla o lead time.`,
      nav: { view: 'list' },
    })
  }

  // 11 — Lead alto só em Alta/Crítica: fila não respeita prioridade.
  if (m.byPriority.highCrit > 0 && m.byPriority.normal > 0 && m.byPriority.highCrit > m.byPriority.normal * 1.3) {
    insights.push({
      id: 'priority-inversion', severity: 'warn',
      title: 'Prioridade não acelera a entrega',
      detail: `Atenção: itens de alta/crítica levam ${fmt(m.byPriority.highCrit)}d, contra ${fmt(m.byPriority.normal)}d dos demais. A fila não está respeitando a prioridade.`,
      nav: { view: 'list' },
    })
  }

  // 12 — Fim de sprint próximo com WIP alto: risco de carry-over.
  const endingSprint = sp.sprints.find(s => s.daysLeft <= 2 && s.daysLeft >= 0 && s.remaining > 0)
  if (endingSprint && m.wipNow >= 3) {
    insights.push({
      id: 'carryover-risk', severity: 'crit',
      title: 'Risco de carry-over na sprint',
      detail: `Atenção: ${endingSprint.sprintName} termina em ${endingSprint.daysLeft}d com ${fmt(endingSprint.remaining)} pts em aberto e ${m.wipNow} itens em andamento. Alto risco de arrastar para a próxima sprint.`,
      nav: { view: 'project', targetId: endingSprint.projectId },
    })
  }

  insights.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return {
    analyzed: m.sampleSize,
    totalChecks: TOTAL_SCENARIOS,
    insights,
    passed: Math.max(0, TOTAL_SCENARIOS - insights.length),
  }
}
