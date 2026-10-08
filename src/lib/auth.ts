// Supabase Auth — camada fina de autenticação real (email/senha).
// Sem signup público: usuários entram só por convite/seed.
// NUNCA logar senha nem token.
import { supabase } from '../integrations/supabase/client'
import { logger } from '../utils/logger'
import { clearRememberMe } from './authStorage'


// Inspection Mode: seletor de personas SEM login (usa a chave anônima do Supabase).
// Só existe em DESENVOLVIMENTO (npm run dev / preview do editor): em build de produção
// fica DESLIGADO, porque o banco passa a bloquear acesso anônimo (RLS). Para forçar em
// qualquer build: VITE_INSPECTION_MODE=true|false.
const INSPECTION_FLAG = String(import.meta.env.VITE_INSPECTION_MODE ?? '').trim().toLowerCase()
export const INSPECTION_MODE_ENABLED = INSPECTION_FLAG
  ? INSPECTION_FLAG !== 'false'
  : import.meta.env.DEV === true

export interface AuthUser {
  id: string
  email: string
}

export interface SignInResult {
  ok: boolean
  user?: AuthUser
  error?: string
}

function toAuthUser(u: { id: string; email?: string | null } | null | undefined): AuthUser | null {
  if (!u) return null
  return { id: u.id, email: (u.email ?? '').toLowerCase() }
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {
      logger.warn('auth.signIn', error.message, { email: email.trim().toLowerCase() })
      return { ok: false, error: error.message }
    }
    const user = toAuthUser(data.user)
    if (!user) return { ok: false, error: 'Sessão não retornada.' }
    clearManualLogout()
    return { ok: true, user }
  } catch (err) {
    logger.error('auth.signIn', err)
    return { ok: false, error: 'Não foi possível autenticar agora.' }
  }
}

const MANUAL_LOGOUT_KEY = 'altech_manual_logout'

/** Marcador de logout manual — bloqueia o fallback Inspection após "Sair". */
export function markManualLogout(): void {
  try { sessionStorage.setItem(MANUAL_LOGOUT_KEY, '1') } catch { /* storage indisponível */ }
}

export function clearManualLogout(): void {
  try { sessionStorage.removeItem(MANUAL_LOGOUT_KEY) } catch { /* storage indisponível */ }
}

export function hasManualLogout(): boolean {
  try { return sessionStorage.getItem(MANUAL_LOGOUT_KEY) === '1' } catch { return false }
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut()
  } catch (err) {
    logger.error('auth.signOut', err)
  } finally {
    markManualLogout()
    clearRememberMe()
    try {
      // limpa caches de sessão/profile em memória e tokens locais do supabase
      const purge = (s: Storage) => Object.keys(s)
        .filter(k => k.startsWith('sb-') && k.includes('auth-token'))
        .forEach(k => s.removeItem(k))
      purge(localStorage)
      purge(sessionStorage)
    } catch { /* storage indisponível */ }

  }
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return toAuthUser(data.session?.user ?? null)
  } catch (err) {
    logger.error('auth.getSession', err)
    return null
  }
}

/** Assina mudanças de sessão. Retorna função de unsubscribe. */
export function onAuthStateChange(cb: (user: AuthUser | null) => void): () => void {
  try {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      cb(toAuthUser(session?.user ?? null))
    })
    return () => data.subscription.unsubscribe()
  } catch (err) {
    logger.error('auth.onAuthStateChange', err)
    return () => {}
  }
}
