/**
 * Altech Permission System
 * Single source of truth for role capabilities, tier gates, and permission derivation.
 * Inspection Mode — all data is mocked; no real auth.
 */
import type { RoleContext, DashboardType } from './session'

// ─── Tier map (capacity ceiling, NOT authority over people) ──────────────────
export const ROLE_TIER: Record<RoleContext, number> = {
  Admin:          10,
  PMO:             9,
  ProjectManager:  8,
  ProductManager:  8,
  ProductOwner:    7,
  ScrumMaster:     6,
  TechLead:        5,
  Dev:             4,
  QA:              3,
  UX:              3,
}

// ─── All capability keys ──────────────────────────────────────────────────────
export type Capability =
  // Sensitive
  | 'create:epic'
  | 'create:feature'
  | 'access:dashview'
  | 'approve:hours'
  | 'log:hours'
  // Issue types
  | 'create:story'
  | 'create:task'
  | 'create:bug'
  | 'create:subtask'
  // Backlog & sprint
  | 'backlog:prioritize'
  | 'sprint:manage'
  | 'board:manage'
  | 'accept:functional'
  | 'signoff:qa'
  // Work item editing
  | 'edit:workitem'
  // Org
  | 'project:create'
  | 'users:manage'
  | 'module:request'
  | 'access:client-portal'
  | 'manage:dashboard-cards'

// ─── Matrix: for each capability, which roles have it by default vs opt-in ───
interface CapabilityRule {
  default: RoleContext[]  // ● always on
  optIn:   RoleContext[]  // ○ admin enables at invite time
  hidden:  RoleContext[]  // — never shown / never granted
}

export const PERMISSION_MATRIX: Record<Capability, CapabilityRule> = {
  'create:epic': {
    default: ['Admin','PMO','ProjectManager','ProductManager','ProductOwner'],
    optIn:   ['TechLead','Dev'],
    hidden:  ['ScrumMaster','QA','UX'],
  },
  'create:feature': {
    default: ['Admin','PMO','ProjectManager','ProductManager','ProductOwner'],
    optIn:   ['TechLead','Dev'],
    hidden:  ['ScrumMaster','QA','UX'],
  },
  'access:dashview': {
    default: ['Admin','PMO','ProjectManager','ProductManager','ProductOwner'],
    optIn:   ['TechLead','Dev'],
    hidden:  ['ScrumMaster','QA','UX'],
  },
  'approve:hours': {
    default: ['Admin'],
    optIn:   ['PMO','ProjectManager','ProductManager','ProductOwner','ScrumMaster','TechLead','Dev'],
    hidden:  ['QA','UX'],
  },
  'log:hours': {
    default: ['ProjectManager','ProductOwner','ScrumMaster','TechLead','Dev','QA','UX'],
    optIn:   ['ProductManager'],
    hidden:  ['Admin','PMO'],
  },
  'create:story': {
    default: ['Admin','ProjectManager','ProductManager','ProductOwner','ScrumMaster'],
    optIn:   ['TechLead','Dev'],
    hidden:  ['PMO','QA','UX'],
  },
  'create:task': {
    default: ['Admin','ProjectManager','ProductOwner','ScrumMaster','TechLead','Dev','QA','UX'],
    optIn:   [],
    hidden:  ['PMO','ProductManager'],
  },
  'create:bug': {
    default: ['Admin','ProjectManager','ProductOwner','ScrumMaster','TechLead','Dev','QA','UX'],
    optIn:   [],
    hidden:  ['PMO','ProductManager'],
  },
  'create:subtask': {
    default: ['Admin','ProductOwner','ScrumMaster','TechLead','Dev','QA','UX'],
    optIn:   [],
    hidden:  ['PMO','ProjectManager','ProductManager'],
  },
  'backlog:prioritize': {
    default: ['Admin','ProductOwner'],
    optIn:   ['ProductManager'],
    hidden:  ['PMO','ProjectManager','ScrumMaster','TechLead','Dev','QA','UX'],
  },
  'sprint:manage': {
    default: ['Admin','ProjectManager','ScrumMaster'],
    optIn:   ['ProductOwner'],
    hidden:  ['PMO','ProductManager','TechLead','Dev','QA','UX'],
  },
  'board:manage': {
    default: ['Admin','ProjectManager','ScrumMaster'],
    optIn:   ['TechLead'],
    hidden:  ['PMO','ProductManager','ProductOwner','Dev','QA','UX'],
  },
  'accept:functional': {
    default: ['Admin','ProductOwner'],
    optIn:   ['ProductManager'],
    hidden:  ['PMO','ProjectManager','ScrumMaster','TechLead','Dev','QA','UX'],
  },
  'signoff:qa': {
    default: ['Admin','QA'],
    optIn:   ['TechLead'],
    hidden:  ['PMO','ProjectManager','ProductManager','ProductOwner','ScrumMaster','Dev','UX'],
  },
  'project:create': {
    default: ['Admin','PMO'],
    optIn:   ['ProjectManager','ProductOwner','Dev'],
    hidden:  ['ProductManager','ScrumMaster','TechLead','QA','UX'],
  },

  'users:manage': {
    default: ['Admin'],
    optIn:   [],
    hidden:  ['PMO','ProjectManager','ProductManager','ProductOwner','ScrumMaster','TechLead','Dev','QA','UX'],
  },
  'module:request': {
    default: ['Admin'],
    optIn:   ['PMO'],
    hidden:  ['ProjectManager','ProductManager','ProductOwner','ScrumMaster','TechLead','Dev','QA','UX'],
  },
  'access:client-portal': {
    default: ['Admin','PMO','ProjectManager','ProductManager','ProductOwner'],
    optIn:   ['ScrumMaster','TechLead'],
    hidden:  ['Dev','QA','UX'],
  },
  'manage:dashboard-cards': {
    default: ['Admin','PMO'],
    optIn:   ['ProjectManager'],
    hidden:  ['ProductManager','ProductOwner','ScrumMaster','TechLead','Dev','QA','UX'],
  },
  'edit:workitem': {
    default: ['Admin','PMO','ProjectManager','ProductManager','ProductOwner','ScrumMaster','TechLead','Dev','QA','UX'],
    optIn:   [],
    hidden:  [],
  },
}

// ─── Derive permissions[] string array from role + opt-ins ───────────────────
export function derivePermissions(role: RoleContext, optIns: Capability[] = []): string[] {
  const perms: string[] = []
  for (const [cap, rule] of Object.entries(PERMISSION_MATRIX) as [Capability, CapabilityRule][]) {
    if (rule.default.includes(role)) {
      perms.push(cap)
    } else if (rule.optIn.includes(role) && optIns.includes(cap)) {
      perms.push(cap)
    }
  }
  return perms
}

// ─── Runtime permission check ─────────────────────────────────────────────────
export function can(permissions: string[] | undefined | null, cap: Capability): boolean {
  if (!permissions) return false
  return permissions.includes('*') || permissions.includes(cap)
}

// ─── Visibility rule for a capability (for UI rendering) ─────────────────────
export type CapabilityVisibility = 'on' | 'opt-in' | 'hidden'

export function capabilityVisibility(role: RoleContext, cap: Capability): CapabilityVisibility {
  const rule = PERMISSION_MATRIX[cap]
  if (rule.default.includes(role)) return 'on'
  if (rule.optIn.includes(role))   return 'opt-in'
  return 'hidden'
}

// ─── Dashboards compatible with a role's tier (role's tier + same tier) ──────
const DASHBOARD_TIER: Record<DashboardType, number> = {
  'admin':           10,
  'pmo':              9,
  'project-manager':  8,
  'product-manager':  8,
  'product-owner':    7,
  'scrum-master':     6,
  'tech-lead':        5,
  'dev':              4,
  'qa':               3,
  'ux':               3,
}

// Dashboards a role can be assigned (excludes admin; ≤ own tier)
export function getCompatibleDashboards(role: RoleContext): DashboardType[] {
  const tier = ROLE_TIER[role]
  return (Object.entries(DASHBOARD_TIER) as [DashboardType, number][])
    .filter(([id, t]) => id !== 'admin' && t <= tier)
    .map(([id]) => id)
}

// Default dashboard for a role
export const DEFAULT_DASHBOARD: Record<RoleContext, DashboardType> = {
  Admin:          'admin',
  PMO:            'pmo',
  ProjectManager: 'project-manager',
  ProductManager: 'product-manager',
  ProductOwner:   'product-owner',
  ScrumMaster:    'scrum-master',
  TechLead:       'tech-lead',
  Dev:            'dev',
  QA:             'qa',
  UX:             'ux',
}

// Capabilities shown as opt-in checkboxes in Passo 4
export const STEP4_CAPABILITIES: { cap: Capability; label: string; desc: string }[] = [
  {
    cap:   'create:epic',
    label: 'Criar Épicos e Funcionalidades',
    desc:  'Permite criar épicos e funcionalidades no backlog',
  },
  {
    cap:   'access:dashview',
    label: 'Acesso ao Dashboard Executivo',
    desc:  'Permite visualizar dashboards de alto nível do projeto',
  },
  {
    cap:   'approve:hours',
    label: 'Aprovador de Horas',
    desc:  'Permite aprovar lançamentos de horas da equipe',
  },
  {
    cap:   'access:client-portal',
    label: 'Acesso ao Portal do Cliente',
    desc:  'Permite visualizar e gerir a visão do portal do cliente',
  },
]
