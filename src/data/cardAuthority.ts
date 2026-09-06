// Autoridade dos cards da Início — modelo híbrido: a VISIBILIDADE segue os layouts
// por posição (homeWidgets), mas AÇÕES que gravam no banco são gateadas por papel,
// mesmo que o card esteja visível. Usa apenas campos reais da MockUser (sem inventar
// capabilities novas no PERMISSION_MATRIX).
import type { MockUser } from '@/data/session'

function isOwnerOrAdmin(u?: MockUser | null): boolean {
  if (!u) return false
  return !!u.tenant_owner || (u.permissions?.includes('*') ?? false) || u.role_context === 'Admin'
}

/** Quem pode suspender / inativar / reativar membros do tenant. */
export function canManageUsers(u?: MockUser | null): boolean {
  return isOwnerOrAdmin(u)
}

/** Quem pode aprovar / reprovar / pedir evidência na fila de testes. */
export function canApproveTests(u?: MockUser | null): boolean {
  return isOwnerOrAdmin(u) || u?.role_context === 'QA'
}
