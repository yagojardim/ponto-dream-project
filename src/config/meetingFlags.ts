// Meeting Intelligence — feature flags e parâmetros (Fase 2).
//
// A UI inteira do módulo está construída. Cada capacidade "liga" trocando a flag
// para `true` quando o motor externo correspondente for contratado — sem tocar na
// UI nem no banco. Ver docs/meeting-intelligence/FASE-2-SPEC.md.
//
// Notas e Compartilhamento já funcionam de verdade (só dependem do banco), então
// nascem ligados. Todo o resto nasce desligado e oculto na navegação.

export const MEETING_FLAGS = {
  /**
   * Módulo inteiro. `false` = OCULTO para todos (não contratado): some do Sidebar
   * (admin master incluso) e a tela bloqueia, ignorando a ativação por tenant.
   * `true` = passa a respeitar a ativação do módulo por tenant (tenant_modules).
   * Ligar quando o Meeting Intelligence for efetivamente contratado/lançado.
   */
  MODULE_ENABLED: false,
  /** Resumo por IA (Edge Function meeting-summarize + Claude). Liga com o secret ANTHROPIC_API_KEY. */
  AI_SUMMARY_ENABLED: false,
  /** Chat sobre a reunião (RAG). Depende do Claude. */
  CHAT_RAG_ENABLED: false,
  /** Gravação no navegador + player + download de áudio. Depende do motor de gravação. */
  RECORDING_ENABLED: false,
  /** Fontes de áudio (Zoom/Meet/Teams/upload) → transcript. Depende do motor de transcrição. */
  TRANSCRIPTION_ENABLED: false,
  /** Cota/consumo de horas: velocímetro, cota por usuário, solicitar horas, Gestão do módulo. */
  HOURS_QUOTA_ENABLED: false,
  /** Contratar horas avulsas (Pix/cartão). Depende do provedor de pagamento. */
  BILLING_ENABLED: false,
  /** Notas da reunião. Funciona já (só banco). */
  NOTES_ENABLED: true,
  /** Compartilhamento de reunião. Funciona já (só banco). */
  SHARING_ENABLED: true,
} as const

export type MeetingFlag = keyof typeof MEETING_FLAGS

/** Consulta central de flag — ponto único para, no futuro, ler de config remota por tenant. */
export function isMeetingFeatureOn(flag: MeetingFlag): boolean {
  return MEETING_FLAGS[flag]
}

/**
 * Preço da hora avulsa e régua de contratação (parametrizável — default aprovado
 * pelo dono em 2026-09-23: R$ 2,00/h). Ajustar aqui não exige reescrever telas.
 */
export const MEETING_PRICING = {
  /** Preço da hora avulsa contratada pelo admin (R$/h). */
  hourlyRateBRL: 2,
  /** Régua de contratação (horas). */
  rechargeMinHours: 2,
  rechargeMaxHours: 100,
  rechargeStepHours: 1,
  /** Meios de pagamento exibidos. */
  paymentMethods: ['pix', 'card'] as const,
} as const

export type PaymentMethod = (typeof MEETING_PRICING.paymentMethods)[number]

/**
 * Cota padrão por cargo, em MINUTOS/mês (o banco guarda minutos; a UI formata em h).
 * Gestão (PMO, PM, PO, SM) = 3h = 180 min; execução (Tech Lead, Dev, UX, QA) = 1h30 = 90 min.
 * Deriva da régua do mockup (gestão 3h / desenvolvimento 1h30) aplicada aos papéis reais
 * do app (role_context). Admin master não recebe cota (dono do workspace).
 */
export const ROLE_QUOTA_MINUTES: Record<string, number> = {
  PMO: 180,
  ProjectManager: 180,
  ProductManager: 180,
  ProductOwner: 180,
  ScrumMaster: 180,
  TechLead: 90,
  Dev: 90,
  UX: 90,
  QA: 90,
}

/** Cota padrão (minutos/mês) quando o cargo não está mapeado acima. */
export const DEFAULT_QUOTA_MINUTES = 90

/** Retenção de reuniões arquivadas antes da purga automática (dias). */
export const MEETING_ARCHIVE_RETENTION_DAYS = 30

/** Cota do cargo em minutos (fallback para DEFAULT_QUOTA_MINUTES). */
export function quotaMinutesForRole(role: string | null | undefined): number {
  if (!role) return DEFAULT_QUOTA_MINUTES
  return ROLE_QUOTA_MINUTES[role] ?? DEFAULT_QUOTA_MINUTES
}
