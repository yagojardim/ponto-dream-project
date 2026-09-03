import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  MOCK_USERS, type MockUser,
  ACTIVE_USER_ID,
  setActiveUser as _setActiveUser,
  setActiveTenantId,
  getActiveTenantId,
  MOCK_TENANT,
  hydratePersonas,
  applyRoleChoice, availableRoleChoices,
  type RoleChoice,
} from './session'
import { reloadLiveDashboardForTenant } from './db/homeLive'
import {
  getSession, onAuthStateChange, signOut as authSignOut,
  INSPECTION_MODE_ENABLED, hasManualLogout, clearManualLogout, type AuthUser,
} from '../lib/auth'
import { loadProfileByAuthUserId, touchAccess } from './db/authProfile'
import { fetchTenantPersonas } from './db/tenantPersonas'
import { getTenantName } from './db/tenant'
import { logger, safeCall } from '../utils/logger'

export type SessionStatus = 'loading' | 'authenticated' | 'inspection' | 'anonymous'

const BOOT_READ_TIMEOUT_MS = 2500
const BOOT_WATCHDOG_MS = 1500

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, scope: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${scope} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      value => { window.clearTimeout(timeoutId); resolve(value) },
      error => { window.clearTimeout(timeoutId); reject(error) },
    )
  })
}

interface SessionCtx {
  activeUser:    MockUser
  setActiveUser: (id: string) => void
  status:        SessionStatus
  authUser:      AuthUser | null
  inspectionEnabled: boolean
  /** Nome do workspace/tenant real (tenants.name). */
  tenantName:    string
  signOut:       () => Promise<void>
  enterInspection: () => void
  mustChangePassword: boolean
  clearMustChangePassword: () => void
  /** Papéis que o usuário pode assumir (principal primeiro; Admin Master no fim). */
  availableRoles: RoleChoice[]
  /** Papel ativo escolhido na Home (null = papel principal). */
  roleChoice: RoleChoice
  setRoleChoice: (r: RoleChoice) => void
  /** Dono do tenant — capacidades administrativas sempre disponíveis. */
  isTenantOwner: boolean
}

const SessionContext = createContext<SessionCtx>(null!)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>(ACTIVE_USER_ID)
  // Inspection é um modo de desenvolvimento intencional e já possui uma
  // persona local válida. Renderizá-lo imediatamente evita que falhas ou
  // throttling nas leituras iniciais deixem o app preso no canvas escuro.
  // Em produção (Inspection desligado) o gate autenticado continua igual.
  const [status, setStatus] = useState<SessionStatus>(() =>
    INSPECTION_MODE_ENABLED && !hasManualLogout() ? 'inspection' : 'loading',
  )
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [dbUser, setDbUser] = useState<MockUser | null>(null)
  const [mustChangePassword, setMustChange] = useState(false)
  const [, setPersonasVersion] = useState(0)
  const [tenantName, setTenantName] = useState('')
  const [activeTenant, setActiveTenant] = useState<string>(getActiveTenantId())
  const [personaOverride, setPersonaOverride] = useState<string | null>(null)
  const [roleOverride, setRoleOverride] = useState<RoleChoice | null>(null)

  /** Atualiza o tenant ativo (módulo + estado) para re-hidratar dados no tenant certo. */
  function applyTenant(tenantId: string) {
    if (!tenantId) return
    setActiveTenantId(tenantId)  // fonte única no cliente (leituras/escritas)
    setActiveTenant(tenantId)    // re-dispara os fetches escopados por tenant
  }

  // Nome do workspace, personas de Inspection e agregados do dashboard SEMPRE
  // seguem o tenant ativo. Re-executa quando o tenant muda (login, troca de persona),
  // evitando vazar dados do tenant padrão (#1) para o tenant real.
  useEffect(() => {
    let alive = true
    reloadLiveDashboardForTenant()
    void getTenantName().then(name => { if (alive) setTenantName(name ?? '') })
    void fetchTenantPersonas().then(list => {
      if (!alive || !list.length) return
      hydratePersonas(list)
      setUserId(prev => (list.some(u => u.user_id === prev) ? prev : list[0].user_id))
      _setActiveUser(list.some(u => u.user_id === ACTIVE_USER_ID) ? ACTIVE_USER_ID : list[0].user_id)
      setPersonasVersion(v => v + 1)
    })
    return () => { alive = false }
  }, [activeTenant])

  /** Inspection só vale quando NÃO houve logout manual nesta aba. */
  function fallbackStatus(): Exclude<SessionStatus, 'loading'> {
    return INSPECTION_MODE_ENABLED && !hasManualLogout() ? 'inspection' : 'anonymous'
  }


  function setActiveUser(id: string) {
    _setActiveUser(id)   // keep module var in sync (for non-hook callers)
    setUserId(id)        // trigger React re-render
    setPersonaOverride(id) // Inspection: persona escolhida vence o profile autenticado
    setRoleOverride(null)  // nova persona volta ao papel principal
    const persona = MOCK_USERS.find(u => u.user_id === id)
    if (persona) applyTenant(persona.tenant_id) // tenant acompanha a persona (Inspection)
  }

  useEffect(() => {
    let alive = true
    let bootSettled = false
    const watchdogId = window.setTimeout(() => {
      if (!alive || bootSettled) return
      bootSettled = true
      logger.warn('SessionContext.boot', 'Watchdog acionado; liberando o boot pelo fallback', {
        timeoutMs: BOOT_WATCHDOG_MS,
      })
      setStatus(fallbackStatus())
    }, BOOT_WATCHDOG_MS)

    function settleStatus(nextStatus: Exclude<SessionStatus, 'loading'>) {
      if (!alive) return
      bootSettled = true
      window.clearTimeout(watchdogId)
      setStatus(nextStatus)
    }

    async function hydrateProfile(u: AuthUser) {
      const profile = await safeCall(
        'SessionContext.loadProfileByAuthUserId',
        () => withTimeout(
          loadProfileByAuthUserId(u.id, u.email),
          BOOT_READ_TIMEOUT_MS,
          'loadProfileByAuthUserId',
        ),
        null,
      )
      if (!alive || !profile) return

      setDbUser(profile)
      setActiveTenantId(profile.tenant_id)  // fonte única no cliente (módulo)
      setActiveTenant(profile.tenant_id)    // re-dispara os fetches escopados por tenant
      setMustChange(!!profile.password_must_change)
      void safeCall(
        'SessionContext.touchAccess',
        () => touchAccess(profile.user_id, profile.tenant_id, null),
        undefined,
      )
    }

    function resolve(u: AuthUser | null) {
      if (!alive) return
      setAuthUser(u)

      if (u) {
        // Session readiness depends only on Supabase Auth. Profile and feature
        // data hydrate after rendering and can never hold the app in loading.
        settleStatus('authenticated')
        void hydrateProfile(u)
        return
      }

      setDbUser(null)
      setMustChange(false)
      // Fallback de desenvolvimento: Inspection Mode atrás da flag,
      // bloqueado quando o usuário clicou em "Sair".
      settleStatus(fallbackStatus())
    }

    withTimeout(getSession(), BOOT_READ_TIMEOUT_MS, 'getSession').then(u => {
      // An auth event or the watchdog may have settled boot while this read
      // was in flight. Never let a stale initial response overwrite it.
      if (!bootSettled) resolve(u)
    }).catch(err => {
      logger.error('SessionContext.getSession', err)
      if (!bootSettled) settleStatus(fallbackStatus())
    })
    const unsub = onAuthStateChange(resolve)

    // Timers são estrangulados em abas em segundo plano: se o boot não tiver
    // sido liberado quando a aba voltar a ficar visível, liberamos na hora
    // (evita a tela escura "presa" no estado de carregamento).
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || bootSettled) return
      settleStatus(fallbackStatus())
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      window.clearTimeout(watchdogId)
      document.removeEventListener('visibilitychange', onVisible)
      unsub()
    }
  }, [])

  async function signOut() {
    await authSignOut()
    setDbUser(null)
    setAuthUser(null)
    setMustChange(false)
    setUserId(ACTIVE_USER_ID)
    setPersonaOverride(null)
    setRoleOverride(null)
    applyTenant(MOCK_TENANT.tenant_id)   // volta ao tenant padrão ao sair
    setStatus('anonymous')
  }

  /** Atalho Inspection intencional (dev): libera o fallback novamente. */
  function enterInspection() {
    if (!INSPECTION_MODE_ENABLED) return
    clearManualLogout()
    setStatus('inspection')
  }


  const mockUser = MOCK_USERS.find(u => u.user_id === userId) ?? MOCK_USERS[0]
  const overrideUser = personaOverride
    ? MOCK_USERS.find(u => u.user_id === personaOverride) ?? null
    : null
  const baseUser = overrideUser ?? dbUser ?? mockUser
  const availableRoles = availableRoleChoices(baseUser)
  const roleChoice: RoleChoice =
    roleOverride && availableRoles.includes(roleOverride) ? roleOverride : baseUser.role_context
  const activeUser = applyRoleChoice(baseUser, roleChoice)
  const isTenantOwner = !!baseUser.tenant_owner

  return (
    <SessionContext.Provider value={{
      activeUser, setActiveUser, status, authUser,
      inspectionEnabled: INSPECTION_MODE_ENABLED, tenantName, signOut, enterInspection,
      mustChangePassword, clearMustChangePassword: () => setMustChange(false),
      availableRoles, roleChoice, setRoleChoice: setRoleOverride, isTenantOwner,
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionCtx {
  return useContext(SessionContext)
}
