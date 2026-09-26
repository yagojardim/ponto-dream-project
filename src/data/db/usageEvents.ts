// Captura de eventos de uso (telemetria interna por tenant) — Fatia 5c.
// Fire-and-forget: nunca bloqueia a UI e engole erros (safeCall). A chamada só
// deve ocorrer em SESSÃO REAL (status 'authenticated') — nunca em modo inspeção,
// cuja persona é fictícia. O guard fica no chamador (App), que tem o status.
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const usageTbl = () => (supabase as unknown as { from: (t: string) => any }).from('usage_events')

export type UsageEventType = 'screen_view' | 'action'

export interface CaptureEventInput {
  /** id do perfil real do usuário autenticado. */
  userId: string
  eventType: UsageEventType
  /** Área/tela ou ação (ex.: 'board', 'reports', 'client_portal'). */
  featureKey: string
  metadata?: Record<string, unknown>
}

/** Registra um evento de uso do tenant/usuário atual. Fire-and-forget. */
export async function captureEvent(input: CaptureEventInput): Promise<void> {
  if (!input.userId || !input.featureKey) return
  await safeCall('usage.capture', async () => {
    const { error } = await usageTbl().insert({
      tenant_id: getActiveTenantId(),
      user_id: input.userId,
      event_type: input.eventType,
      feature_key: input.featureKey,
      metadata: input.metadata ?? null,
    })
    if (error) throw error
    return null
  }, null)
}
