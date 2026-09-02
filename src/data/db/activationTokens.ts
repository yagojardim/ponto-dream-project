/* eslint-disable @typescript-eslint/no-explicit-any */
// Tokens de ativação / reset de senha.
// Somente o HASH (SHA-256) é persistido — o token bruto existe apenas em memória
// e é devolvido uma única vez para montar o link. NUNCA logar o token.
import { supabase } from '../../integrations/supabase/client'
import { safeCall, logger } from '../../utils/logger'
import { writeAudit as writeMilestone } from './audit'
import { getActiveTenantId } from '@/data/session'

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

export type TokenPurpose = 'first_access' | 'password_reset'
export type TokenState = 'valid' | 'expired' | 'used' | 'invalid'

export interface TokenRow {
  id: string
  tenant_id: string
  profile_id: string
  purpose: TokenPurpose
  expires_at: string
  used_at: string | null
}

export interface ValidationResult {
  state: TokenState
  token?: TokenRow
}

/** Token bruto aleatório, URL-safe (32 bytes → hex). */
function randomToken(): string {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

async function audit(action: string, profileId: string, after: Record<string, unknown>): Promise<void> {
  try {
    await tbl('audit_logs').insert({
      tenant_id: getActiveTenantId(),
      entity_type: 'activation_token',
      entity_id: profileId,
      action,
      before: null,
      after,
    })
  } catch (err) {
    logger.error('activationTokens.audit', err, { action })
  }
}

/** Emite um token e devolve o valor BRUTO (uma única vez). null em falha. */
export function issueToken(
  profileId: string,
  purpose: TokenPurpose,
  ttlHours = 24,
): Promise<string | null> {
  return safeCall<string | null>('activationTokens.issueToken', async () => {
    const raw = randomToken()
    const token_hash = await sha256Hex(raw)
    const expires_at = new Date(Date.now() + ttlHours * 3600_000).toISOString()

    const { error } = await tbl('activation_tokens').insert({
      tenant_id: getActiveTenantId(),
      profile_id: profileId,
      purpose,
      token_hash,
      expires_at,
    })
    if (error) throw error

    await audit('activation_token_issued', profileId, { purpose, expires_at })
    return raw
  }, null)
}

/** Estado de um token bruto — validado por Edge Function (pré-login). Nunca loga o token. */
export function validateToken(rawToken: string): Promise<ValidationResult> {
  return safeCall<ValidationResult>('activationTokens.validateToken', async () => {
    const trimmed = (rawToken ?? '').trim()
    if (!trimmed) return { state: 'invalid' as TokenState }

    const { data, error } = await supabase.functions.invoke('validate-activation', {
      body: { token: trimmed },
    })
    if (error) throw error

    const state = (data as { state?: TokenState } | null)?.state
    if (state === 'valid' || state === 'expired' || state === 'used') return { state }
    return { state: 'invalid' as TokenState }
  }, { state: 'invalid' })
}

/** Consome (uso único, idempotente) o token. */
export function consumeToken(rawToken: string): Promise<boolean> {
  return safeCall<boolean>('activationTokens.consumeToken', async () => {
    const token_hash = await sha256Hex((rawToken ?? '').trim())
    const { data, error } = await tbl('activation_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', token_hash)
      .is('used_at', null)
      .select('id, profile_id, purpose')
    if (error) throw error
    const row = (data ?? [])[0]
    if (row) {
      await audit('activation_token_consumed', row.profile_id, { consumed: true })
      if (row.purpose === 'first_access') {
        await writeMilestone('invite.accepted', row.profile_id, { profile_id: row.profile_id })
      }
    }
    return !!row
  }, false)
}

/** Marca o profile como "precisa trocar a senha". */
export function setPasswordMustChange(profileId: string, value: boolean): Promise<boolean> {
  return safeCall<boolean>('activationTokens.setPasswordMustChange', async () => {
    const { error } = await tbl('profiles')
      .update({ password_must_change: value })
      .eq('id', profileId)
      .eq('tenant_id', getActiveTenantId())
    if (error) throw error
    return true
  }, false)
}

/** Conclui a troca de senha no profile (flag + first_access_at). */
export function markPasswordChanged(profileId: string): Promise<boolean> {
  return safeCall<boolean>('activationTokens.markPasswordChanged', async () => {
    const patch: Record<string, unknown> = { password_must_change: false }
    const { data: cur } = await tbl('profiles')
      .select('first_access_at').eq('id', profileId).eq('tenant_id', getActiveTenantId()).limit(1)
    if (!(cur ?? [])[0]?.first_access_at) patch.first_access_at = new Date().toISOString()
    const { error } = await tbl('profiles')
      .update(patch)
      .eq('id', profileId)
      .eq('tenant_id', getActiveTenantId())
    if (error) throw error
    await audit('password_changed', profileId, { via: 'create_password_page' })
    return true
  }, false)
}

/** Auditoria do pedido de reset feito pelo admin. */
export function auditPasswordResetRequested(profileId: string, ttlHours: number): Promise<void> {
  return audit('password_reset_requested', profileId, { ttl_hours: ttlHours })
}

/** Monta o link completo de ativação. */
export function activationLink(rawToken: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/activate?token=${encodeURIComponent(rawToken)}`
}
