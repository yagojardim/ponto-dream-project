/**
 * Sessão do Portal do Cliente (pré-login via Edge Function).
 * Guarda apenas a identidade retornada pelo `client-portal-login` — nunca senha.
 */
export interface PortalSession {
  id: string
  name: string
  email: string
  tenantId: string
}

const KEY = 'altech.portal.session'

export function savePortalSession(s: PortalSession): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage indisponível */ }
}

export function readPortalSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PortalSession
    return parsed && typeof parsed.email === 'string' ? parsed : null
  } catch { return null }
}

export function clearPortalSession(): void {
  try { localStorage.removeItem(KEY) } catch { /* storage indisponível */ }
}
