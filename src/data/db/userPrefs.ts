/* eslint-disable @typescript-eslint/no-explicit-any */
// Preferências de UI por usuário, persistidas no banco (tabela public.user_prefs).
// Nunca usar localStorage: as escolhas seguem o usuário em qualquer navegador.
import { supabase } from '../../integrations/supabase/client'
import { DEFAULT_TENANT_ID } from './timeline'
import { getActiveTenantId } from '@/data/session'
import { safeCall } from '../../utils/logger'

export { DEFAULT_TENANT_ID }

function tbl(name: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(name)
}

async function getUserPref__raw<T>(userId: string, key: string): Promise<T | null> {
  const { data, error } = await tbl('user_prefs')
    .select('value')
    .eq('tenant_id', getActiveTenantId())
    .eq('user_id', userId)
    .eq('pref_key', key)
    .maybeSingle()
  if (error) throw new Error(`[user_prefs] ${error.message}`)
  return (data?.value ?? null) as T | null
}

export function getUserPref<T>(userId: string, key: string): Promise<T | null> {
  return safeCall('userPrefs.get', () => getUserPref__raw<T>(userId, key), null, { userId, key })
}

async function saveUserPref__raw(userId: string, key: string, value: unknown): Promise<boolean> {
  const { error } = await tbl('user_prefs').upsert({
    tenant_id: getActiveTenantId(),
    user_id: userId,
    pref_key: key,
    value,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,user_id,pref_key' })
  if (error) throw new Error(`[user_prefs] ${error.message}`)
  return true
}

export function saveUserPref(userId: string, key: string, value: unknown): Promise<boolean> {
  return safeCall('userPrefs.save', () => saveUserPref__raw(userId, key, value), false, { userId, key })
}
