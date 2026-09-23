/* eslint-disable @typescript-eslint/no-explicit-any */
// Meeting Intelligence — contratação de horas avulsas (Fase 2, casca).
// Registra a intenção de compra (status 'pending'); a cobrança real (Pix/cartão)
// é plugada quando BILLING_ENABLED ligar + provedor de pagamento integrado.
// RLS-off + tenant-cliente.
import { supabase } from '@/integrations/supabase/client'
import { safeCall } from '@/utils/logger'
import { getActiveTenantId } from '@/data/session'
import { MEETING_PRICING, type PaymentMethod } from '@/config/meetingFlags'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export interface HourPurchase {
  id: string
  minutes: number
  amountCents: number
  method: PaymentMethod
  status: 'pending' | 'paid' | 'failed' | 'canceled'
  createdAt: string
}

/** Preço (em centavos) de uma quantidade de horas, pela régua atual. */
export function priceCentsForHours(hours: number): number {
  return Math.round(hours * MEETING_PRICING.hourlyRateBRL * 100)
}

/** Registra a contratação (pendente). Retorna o id ou null. */
export async function purchaseHours(input: {
  hours: number; method: PaymentMethod; buyerId: string
}): Promise<string | null> {
  return safeCall('meetingBilling.purchaseHours', async () => {
    const minutes = Math.max(1, Math.round(input.hours * 60))
    const { data, error } = await tbl('meeting_hour_purchases').insert({
      tenant_id: getActiveTenantId(),
      minutes,
      amount_cents: priceCentsForHours(input.hours),
      method: input.method,
      status: 'pending',
      purchased_by: input.buyerId,
    }).select('id').single()
    if (error) throw error
    return (data?.id as string) ?? null
  }, null)
}

export async function listPurchases(): Promise<HourPurchase[]> {
  return safeCall('meetingBilling.listPurchases', async () => {
    const { data, error } = await tbl('meeting_hour_purchases')
      .select('id, minutes, amount_cents, method, status, created_at')
      .eq('tenant_id', getActiveTenantId())
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as any[]).map((r): HourPurchase => ({
      id: r.id,
      minutes: r.minutes,
      amountCents: r.amount_cents,
      method: r.method,
      status: r.status,
      createdAt: r.created_at,
    }))
  }, [])
}
