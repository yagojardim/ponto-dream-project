/** Tiny logging helper so data-layer failures are traceable but never fatal. */
import { supabase } from '@/integrations/supabase/client'

type Ctx = Record<string, unknown> | undefined
type RemoteLevel = 'debug' | 'info' | 'warn' | 'error'

function fmt(scope: string, ctx: Ctx): string {
  if (!ctx) return `[${scope}]`
  try { return `[${scope}] ${JSON.stringify(ctx)}` } catch { return `[${scope}]` }
}

/** Gera um código curto de correlação (mostrado ao usuário / usado no chamado). */
export function newCorrelationId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* ignore */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ─── Envio remoto (support_logs via Edge Function log-event) ─────────────────
// Nunca lança; deduplica eventos repetidos e limita a taxa para não "spammar"
// o cliente (a story pede throttle/dedupe de erros repetidos).
const DEDUPE_WINDOW_MS = 15_000
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const recentSignatures = new Map<string, number>()
let rateStamps: number[] = []

function allowRemote(signature: string): boolean {
  const now = Date.now()
  const last = recentSignatures.get(signature)
  if (last && now - last < DEDUPE_WINDOW_MS) return false
  rateStamps = rateStamps.filter((t) => now - t < RATE_WINDOW_MS)
  if (rateStamps.length >= RATE_MAX) return false
  recentSignatures.set(signature, now)
  rateStamps.push(now)
  // Evita crescimento indefinido do mapa de dedupe.
  if (recentSignatures.size > 200) {
    for (const [k, t] of recentSignatures) {
      if (now - t >= DEDUPE_WINDOW_MS) recentSignatures.delete(k)
    }
  }
  return true
}

/**
 * Posta um evento em support_logs (fire-and-forget). Só envia se houver sessão
 * autenticada (a function exige JWT) — em modo anônimo/inspection não faz nada.
 */
function postRemote(level: RemoteLevel, area: string, message: string, context: Ctx, correlationId: string): void {
  if (!allowRemote(`${level}|${area}|${message}`)) return
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      await supabase.functions.invoke('log-event', {
        body: { level, area, message, context: context ?? {}, correlation_id: correlationId },
      })
    } catch { /* logging remoto nunca pode quebrar o app */ }
  })()
}

export const logger = {
  /** Loga um erro no console e, se autenticado, em support_logs. Retorna o correlation_id. */
  error(scope: string, err: unknown, ctx?: Ctx): string {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(fmt(scope, ctx), msg, err)
    const correlationId = newCorrelationId()
    postRemote('error', scope, msg, ctx, correlationId)
    return correlationId
  },
  warn(scope: string, msg: string, ctx?: Ctx) {
    // Warnings ficam apenas no console (evita log em massa no cliente).
    console.warn(fmt(scope, ctx), msg)
  },
  /** Evento explícito de produto (info/debug/warn/error) enviado a support_logs. */
  event(level: RemoteLevel, area: string, message: string, ctx?: Ctx): string {
    const correlationId = newCorrelationId()
    postRemote(level, area, message, ctx, correlationId)
    return correlationId
  },
}

/**
 * Runs an async data call and degrades to `fallback` on any failure.
 * Guarantees the caller never has to handle a rejected promise.
 */
export async function safeCall<T>(scope: string, fn: () => Promise<T>, fallback: T, ctx?: Ctx): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    logger.error(scope, err, ctx)
    return fallback
  }
}
