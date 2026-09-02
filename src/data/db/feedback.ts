/* eslint-disable @typescript-eslint/no-explicit-any */
// Feedback & Suporte — texto puro, amarrado ao tenant/usuário.
import { supabase } from '../../integrations/supabase/client'
import { getActiveTenantId } from '@/data/session'
import { safeCall } from '../../utils/logger'

export type FeedbackType = 'feedback' | 'problema' | 'sugestao'

export interface FeedbackInput {
  type: FeedbackType
  rating?: number | null
  message: string
  screenUrl?: string | null
  screenLabel?: string | null
}

export interface FeedbackRow {
  id: string
  tenant_id: string
  profile_id: string | null
  author_name: string | null
  type: string
  rating: number | null
  message: string
  screen_url: string | null
  screen_label: string | null
  status: string
  created_at: string
}

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

async function createFeedback__raw(
  input: FeedbackInput,
  author: { userId: string; name: string },
): Promise<boolean> {
  const message = input.message.trim()
  if (!message) throw new Error('[feedback] mensagem obrigatória')
  const { error } = await tbl('feedback').insert({
    tenant_id: getActiveTenantId(),
    profile_id: author.userId || null,
    author_name: author.name || null,
    type: input.type,
    rating: input.rating ?? null,
    message,
    screen_url: input.screenUrl ?? null,
    screen_label: input.screenLabel ?? null,
  })
  if (error) throw new Error(`[feedback] ${error.message}`)
  return true
}

export function createFeedback(
  input: FeedbackInput,
  author: { userId: string; name: string },
): Promise<boolean> {
  return safeCall('feedback.create', () => createFeedback__raw(input, author), false, {
    type: input.type,
  })
}

async function listFeedback__raw(): Promise<FeedbackRow[]> {
  const { data, error } = await tbl('feedback')
    .select('id, tenant_id, profile_id, author_name, type, rating, message, screen_url, screen_label, status, created_at')
    .eq('tenant_id', getActiveTenantId())
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[feedback] ${error.message}`)
  return (data ?? []) as FeedbackRow[]
}

export function listFeedback(): Promise<FeedbackRow[]> {
  return safeCall('feedback.list', listFeedback__raw, [])
}
