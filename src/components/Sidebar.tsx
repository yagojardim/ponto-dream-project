import React from 'react'
import { useState, useRef, useEffect } from 'react'
import { Avatar } from './ds/Avatar'
import { Tooltip } from './ds/Tooltip'
import { T } from './ds/tokens'
import { useSession } from '../data/SessionContext'
import { useVisibleBoards } from '@/data/db/boards'
import { INSPECTION_MODE_ENABLED } from '../lib/auth'
import { can, type Capability, PERMISSION_MATRIX } from '../data/permissions'
import { MOCK_USERS, type RoleContext } from '../data/session'
import { useProfileReportsAccess, canAccessReports } from '../data/db/reportsGovernance'
import { fetchDashboardAggregates } from '../data/db/dashboards'
import { logger } from '../utils/logger'
import {
  DashboardIcon as AltechDashboard, ProjectsIcon as AltechProjects, DiscoveryIcon as AltechDiscovery,
  BacklogIcon as AltechBacklog, RoadmapIcon as AltechRoadmap, ReportsAltIcon as AltechReports,
  AdminIcon as AltechAdmin, EpicIcon as AltechEpic,
} from './ds/AltechIcons'

// Sidebar renders icons at 14px; the Altech library is drawn on a 24x24 grid.
const NAV_ICON_SIZE = 14
const DashboardIcon  = () => <AltechDashboard size={NAV_ICON_SIZE} />
const ProjectsIcon   = () => <AltechProjects size={NAV_ICON_SIZE} />
const DiscoveryIcon  = () => <AltechDiscovery size={NAV_ICON_SIZE} />
const BacklogIcon    = () => <AltechBacklog size={NAV_ICON_SIZE} />
const RoadmapIcon    = () => <AltechRoadmap size={NAV_ICON_SIZE} />
const ReportsAltIcon = () => <AltechReports size={NAV_ICON_SIZE} />
const AdminIcon      = () => <AltechAdmin size={NAV_ICON_SIZE} />
const EpicIcon       = () => <AltechEpic size={NAV_ICON_SIZE} />

interface SidebarProps {
  collapsed: boolean
  onToggle:  () => void
  activeNav: string
  onNav:     (id: string, targetId?: string) => void
}

// ─── Nav definition ───────────────────────────────────────────────────────────
interface NavItem {
  id:    string
  label: string
  icon:  () => React.ReactElement
  badge?: string
  cap?:  Capability  // if set, shown only when user has this capability
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const ALL_GROUPS: NavGroup[] = [
  {
    label: 'Comece aqui',
    items: [
      { id: 'home', label: 'Início', icon: HomeIcon },
    ],
  },
  {
    label: 'Meu dia a dia',
    items: [
      { id: 'my-tasks', label: 'Minha Fila', icon: MyTasksIcon },
      { id: 'calendar', label: 'Calendário', icon: CalendarIcon },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { id: 'projects-list', label: 'Projetos & Tarefas', icon: ProjectsIcon },
      { id: 'boards-list',   label: 'Boards',             icon: BoardIcon   },
      { id: 'list',          label: 'Lista',              icon: BacklogIcon    },
      { id: 'gantt',         label: 'Gráfico Gantt',      icon: GanttIcon   },
      { id: 'timeline',      label: 'Timeline',           icon: RoadmapIcon},
      { id: 'dashboard', label: 'Dashboard Executivo', icon: DashboardIcon, cap: 'access:dashview' },
      { id: 'storage',       label: 'Armazenamento',      icon: AdminIcon   },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { id: 'epics',     label: 'Épicos',         icon: EpicIcon, cap: 'create:epic'    },
      { id: 'releases',  label: 'Releases',        icon: ReleaseIcon                       },
      { id: 'filters',   label: 'Filtros & Busca', icon: DiscoveryIcon, cap: 'access:discovery' },
      { id: 'navigator', label: 'Issue Navigator', icon: DiscoveryIcon, cap: 'access:discovery' },
    ],
  },

  {
    label: 'Configuração',
    items: [
      { id: 'config',        label: 'Configurações',        icon: AdminIcon, cap: 'users:manage' },
      { id: 'tenant-settings', label: 'Config. do Tenant',  icon: AdminIcon, cap: 'users:manage' },
      { id: 'modules',       label: 'Módulos',              icon: ModulesIcon, cap: 'module:request' },
      { id: 'automations',   label: 'Automações',           icon: AutomIcon,  cap: 'users:manage' },
      { id: 'client-access',    label: 'Criar acesso cliente',    icon: AccessIcon, cap: 'access:client-portal' },
      { id: 'client',           label: 'Portal do Cliente',       icon: ClientIcon, cap: 'access:client-portal' },
      { id: 'client-messages',  label: 'Mensagens do Cliente',    icon: ChatIcon, cap: 'access:client-messages' },
    ],
  },
  {
    label: 'Mais',
    items: [
      { id: 'team',         label: 'Time & Permissões', icon: AdminIcon,    cap: 'users:manage' },
      { id: 'reports',      label: 'Relatórios',        icon: ReportsAltIcon                     },
      { id: 'login',        label: 'Login Gestão',      icon: LoginIcon,   cap: 'users:manage' },
      { id: 'client-login', label: 'Login Portal',      icon: PortalIcon,  cap: 'users:manage' },
    ],
  },
]

// ─── Role → nav item ids map ──────────────────────────────────────────────────
const ROLE_NAV_MAP: Record<RoleContext, string[]> = {
  Admin:          ['home','my-tasks','calendar','projects-list','boards-list','storage','list','gantt','timeline','dashboard','epics','releases','filters','navigator','reports','config','modules','automations','client-access','client','client-messages','team','login','client-login'],
  PMO:            ['home','calendar','projects-list','boards-list','gantt','timeline','dashboard','epics','releases','filters','navigator','reports','client'],
  ProjectManager: ['home','my-tasks','calendar','projects-list','boards-list','storage','list','gantt','timeline','dashboard','epics','releases','filters','navigator','reports','modules','client'],
  ProductManager: ['home','calendar','projects-list','boards-list','dashboard','epics','releases','reports','filters','navigator'],
  ProductOwner:   ['home','my-tasks','calendar','projects-list','boards-list','storage','list','gantt','timeline','dashboard','epics','releases','filters','navigator','reports','client','client-access'],
  ScrumMaster:    ['home','my-tasks','calendar','projects-list','boards-list','list','gantt','timeline','filters','navigator','reports'],
  TechLead:       ['home','my-tasks','calendar','projects-list','boards-list','storage','list','gantt','timeline','filters','navigator','reports'],
  Dev:            ['home','my-tasks','calendar','boards-list','list'],
  UX:             ['home','my-tasks','calendar','projects-list','boards-list','list'],
  QA:             ['home','my-tasks','calendar','projects-list','boards-list','list'],
}


function ClockIcon()    { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function MyTasksIcon()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M2 7h10M2 10.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="11" cy="10.5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M10 10.5l.75.75L12 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg> }

/** Itens administrativos sempre visíveis para o dono do tenant (Admin Master). */
const TENANT_OWNER_NAV = new Set([
  'config', 'tenant-settings', 'modules', 'automations',
  'team', 'login', 'client-login', 'client-access', 'client', 'dashboard',
])

function getGroups(role: RoleContext, permissions: string[], isTenantOwner = false): NavGroup[] {
  const allowed = new Set(ROLE_NAV_MAP[role] ?? [])
  return ALL_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(item => {
        // (a) explicitly in this role's nav map
        if (allowed.has(item.id)) return true
        // (a2) dono do tenant sempre enxerga os menus administrativos
        if (isTenantOwner && TENANT_OWNER_NAV.has(item.id)) return true
        // (b) capability opt-in: user has the cap AND it's an opt-in for this role
        if (item.cap && can(permissions, item.cap)) {
          return PERMISSION_MATRIX[item.cap]?.optIn.includes(role) ?? false
        }
        return false
      }),
    }))
    .filter(g => g.items.length > 0)
}

// ─── Project sub-list data & state ───────────────────────────────────────────
const MAX_VISIBLE = 5

interface ProjectEntry {
  id:     string
  name:   string
  color:  string
  pct:    number
  status: 'on-track' | 'at-risk' | 'blocked'
}

// Module-level pin state — persists across re-renders
let _pinnedIds = new Set<string>()

// Module-level disclosure state — persists for session (default: closed)
let _projectsOpen = false

const STATUS_DOT: Record<ProjectEntry['status'], string> = {
  'on-track': T.success,
  'at-risk':  T.warn,
  'blocked':  T.crit,
}

function PinIcon({ filled }: { filled: boolean }) {
  return filled
    ? (
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ color: T.accent }}>
        <path d="M5 .5L6.5 4H10L7 6.2 8.1 9.5 5 7.5l-3.1 2 1.1-3.3L0 4h3.5L5 .5Z" fill="currentColor" />
      </svg>
    ) : (
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        <path d="M5 .5L6.5 4H10L7 6.2 8.1 9.5 5 7.5l-3.1 2 1.1-3.3L0 4h3.5L5 .5Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    )
}

function ProjectSubList({ onNav }: { onNav: (view: string, targetId?: string) => void }) {
  const [pinned, setPinned] = useState<Set<string>>(new Set(_pinnedIds))
  const [query, setQuery]   = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [failed, setFailed]     = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const agg = await fetchDashboardAggregates()
        if (!alive) return
        const ragById = new Map(agg.rag.map(r => [r.id, r]))
        setProjects(agg.projects.map(p => {
          const r = ragById.get(p.id)
          const status: ProjectEntry['status'] =
            r?.rag === 'blocked' ? 'blocked' : r?.rag === 'risk' ? 'at-risk' : 'on-track'
          return { id: p.id, name: p.name, color: p.color, pct: r?.pct ?? 0, status }
        }))
      } catch (err) {
        logger.error('Sidebar.ProjectSubList', err)
        if (alive) setFailed(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const showSearch = projects.length > MAX_VISIBLE

  // Sort: pinned first, then alphabetically
  const sorted = [...projects].sort((a, b) => {
    const aP = pinned.has(a.id), bP = pinned.has(b.id)
    if (aP && !bP) return -1
    if (!aP && bP) return  1
    return a.name.localeCompare(b.name)
  })

  const q = query.trim().toLowerCase()
  const filtered = q ? sorted.filter(p => p.name.toLowerCase().includes(q)) : sorted
  const visible  = filtered.slice(0, MAX_VISIBLE)

  function togglePin(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setPinned(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      _pinnedIds = next
      return next
    })
  }

  return (
    <div className="ml-7 mt-0.5 pl-2" style={{ borderLeft: `1px solid ${T.border}` }}>

      {/* Quick search — only when > MAX_VISIBLE projects */}
      {showSearch && (
        <div className="px-1 mb-1">
          <div
            className="flex items-center gap-1.5 h-6 px-2 rounded-md"
            style={{ background: `${T.text3}0E`, border: `1px solid ${T.border}` }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: T.text3, flexShrink: 0 }}>
              <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.1" />
              <path d="M7.5 7.5L6 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filtrar projeto..."
              className="flex-1 bg-transparent outline-none text-[11px] font-[inherit]"
              style={{ color: T.text1, caretColor: T.accent }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-[12px] leading-none transition-colors"
                style={{ color: T.text3 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text1 }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text3 }}
              >×</button>
            )}
          </div>
        </div>
      )}

      {/* Project rows — max-height safety net prevents sidebar overflow */}
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {loading ? (
          <p className="px-2 py-1.5 text-[11px]" style={{ color: T.text3 }}>Carregando projetos…</p>
        ) : failed ? (
          <p className="px-2 py-1.5 text-[11px]" style={{ color: T.text3 }}>Não foi possível carregar os projetos.</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-1.5 text-[11px]" style={{ color: T.text3 }}>
            {q ? 'Nenhum projeto encontrado.' : 'Sem projetos no escopo.'}
          </p>
        ) : (
          visible.map(p => {
            const isPinned  = pinned.has(p.id)
            const isHovered = hovered === p.id
            return (
              <div
                key={p.id}
                className="relative"
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <button
                  onClick={() => onNav('dashboard', p.id)}
                  className="w-full flex items-center gap-2 h-7 px-2 rounded-lg text-[12px] transition-colors"
                  style={{
                    color:      T.text2,
                    background: isHovered ? `${T.text3}14` : 'transparent',
                    paddingRight: isHovered ? 28 : undefined,
                  }}
                >
                  {/* Status dot */}
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: STATUS_DOT[p.status] }}
                  />
                  <span className="flex-1 text-left truncate">{p.name}</span>
                  {/* Pinned star — shown when pinned and not hovering */}
                  {isPinned && !isHovered && (
                    <span className="flex-shrink-0 opacity-70">
                      <PinIcon filled />
                    </span>
                  )}
                  {/* Progress % */}
                  {!isHovered && (
                    <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: T.text3 }}>
                      {p.pct}%
                    </span>
                  )}
                </button>

                {/* Pin toggle button — revealed on hover */}
                {isHovered && (
                  <button
                    onClick={e => togglePin(p.id, e)}
                    title={isPinned ? 'Desafixar do sidebar' : 'Fixar no sidebar'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded transition-all"
                    style={{
                      color:      isPinned ? T.accent : T.text3,
                      background: `${T.text3}18`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = isPinned ? T.warn : T.accent }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isPinned ? T.accent : T.text3 }}
                  >
                    <PinIcon filled={isPinned} />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* "Ver todos" footer */}
      <button
        onClick={() => onNav('projects-list')}
        className="w-full flex items-center gap-1.5 h-6 px-2 mt-0.5 rounded-md text-[11px] transition-colors"
        style={{ color: T.text3 }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = T.accent
          ;(e.currentTarget as HTMLButtonElement).style.background = `${T.accent}10`
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = T.text3
          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 5h6M6.5 3l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Ver todos os projetos ({projects.length})
      </button>
    </div>
  )
}

// ─── Pill nav button ───────────────────────────────────────────────────────────
function NavBtn({ item, active, onClick, collapsed, disabled = false, disabledLabel }: {
  item: NavItem; active: boolean; onClick: () => void; collapsed: boolean
  disabled?: boolean; disabledLabel?: string
}) {
  const btn = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`flex items-center gap-2 h-8 rounded-lg text-[13px] transition-all duration-150 flex-shrink-0 ${collapsed ? 'w-8 justify-center px-0' : 'w-full px-2.5'}`}
      style={{
        background: active && !disabled ? `${T.accent}22` : 'transparent',
        color: disabled ? T.text3 : active ? T.accent : T.text2,
        fontWeight: active && !disabled ? 600 : 400,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={e => { if (!active && !disabled) (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}14` }}
      onMouseLeave={e => { if (!active && !disabled) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {/* Active pill indicator on the icon side */}
      <span
        className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md transition-all"
        style={{ background: active && !disabled ? `${T.accent}28` : 'transparent' }}
      >
        <item.icon />
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.badge && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${T.accent}20`, color: T.accent }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
      {collapsed && item.badge && (
        <span
          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
          style={{ background: T.accent, position: 'absolute' }}
        >
          {item.badge}
        </span>
      )}
    </button>
  )

  if (disabled && disabledLabel) {
    return (
      <Tooltip label={disabledLabel} side="right">
        <span className="relative block w-full">{btn}</span>
      </Tooltip>
    )
  }
  if (collapsed) {
    return (
      <Tooltip label={item.label} side="right">
        <span className="relative block">{btn}</span>
      </Tooltip>
    )
  }
  return btn
}

// ─── Nav button with disclosure chevron (split-click) ────────────────────────
function NavBtnWithDisclosure({
  item, active, open, onNavigate, onToggle,
}: {
  item: NavItem; active: boolean; open: boolean
  onNavigate: () => void; onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const bg = active ? `${T.accent}22` : hovered ? `${T.text3}14` : 'transparent'
  return (
    <div
      className="flex items-center h-8 rounded-lg overflow-hidden transition-all duration-150 flex-shrink-0"
      style={{ background: bg }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Navigate zone: icon + label */}
      <button
        onClick={onNavigate}
        className="flex items-center gap-2 flex-1 h-full pl-2.5 pr-1 min-w-0"
        style={{ color: active ? T.accent : T.text2, fontWeight: active ? 600 : 400, fontSize: 13 }}
      >
        <span
          className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md transition-all"
          style={{ background: active ? `${T.accent}28` : 'transparent' }}
        >
          <item.icon />
        </span>
        <span className="flex-1 text-left truncate">{item.label}</span>
      </button>
      {/* Chevron: disclosure only, no navigation */}
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Recolher lista de projetos' : 'Expandir lista de projetos'}
        className="flex items-center justify-center w-7 h-full flex-shrink-0 rounded-r-lg transition-colors"
        style={{ color: open ? T.accent : T.text3 }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text1; (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}22` }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = open ? T.accent : T.text3; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.18s ease' }}
        >
          <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

// ─── Workspace (tenant real, único) ───────────────────────────────────────────
function WorkspaceSelector({ collapsed }: { collapsed: boolean }) {
  const { tenantName } = useSession()
  const name = tenantName || '—'
  const initial = (tenantName.trim()[0] ?? '?').toUpperCase()

  return (
    <div
      className={`flex items-center gap-2 rounded-xl ${collapsed ? 'w-10 h-10 justify-center' : 'w-full px-3 py-2.5'}`}
      title={name}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
        style={{ background: T.accent }}
      >
        {initial}
      </span>
      {!collapsed && (
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: T.text1 }}>{name}</p>
          <p className="text-[10px]" style={{ color: T.text3 }}>Workspace</p>
        </div>
      )}
    </div>
  )
}

// ─── User block ───────────────────────────────────────────────────────────────
const ROLE_CONTEXT_COLOR: Record<string, { color: string; bg: string }> = {
  Admin:          { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  PMO:            { color: '#7d92ff', bg: 'rgba(125,146,255,0.15)' },
  ProjectManager: { color: T.accent,  bg: T.accentDim },
  ProductManager: { color: '#35c9ae', bg: 'rgba(53,201,174,0.15)' },
  ProductOwner:   { color: T.success, bg: T.successDim },
  ScrumMaster:    { color: '#e6b23c', bg: 'rgba(230,178,60,0.15)' },
  TechLead:       { color: '#f0805c', bg: 'rgba(240,128,92,0.15)' },
  Dev:            { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  UX:             { color: '#f472b6', bg: 'rgba(244,114,182,0.15)' },
  QA:             { color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
}

const ROLE_CONTEXT_LABEL: Record<string, string> = {
  Admin: 'Admin Master', PMO: 'PMO', ProjectManager: 'Project Manager',
  ProductManager: 'Product Manager', ProductOwner: 'Product Owner',
  ScrumMaster: 'Scrum Master', TechLead: 'Tech Lead',
  Dev: 'Dev', UX: 'UX / UI', QA: 'QA',
}

function UserBlock({ collapsed, onNav }: { collapsed: boolean; onNav: (id: string, targetId?: string) => void }) {
  const { activeUser, setActiveUser, signOut } = useSession()
  const name    = activeUser.name
  const email   = activeUser.email
  const rc      = activeUser.role_context
  const rs      = ROLE_CONTEXT_COLOR[rc] ?? { color: T.accent, bg: T.accentDim }
  const rcLabel = ROLE_CONTEXT_LABEL[rc] ?? rc

  const [menuOpen,   setMenuOpen]   = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setSwitchOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const btn = (
    <button
      onClick={() => { setMenuOpen(o => !o); setSwitchOpen(false) }}
      className={`flex items-center gap-2.5 rounded-xl transition-colors ${collapsed ? 'w-10 h-10 justify-center' : 'w-full px-3 py-2.5'}`}
      style={{ background: menuOpen ? `${T.text3}14` : 'transparent' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}14` }}
      onMouseLeave={e => { if (!menuOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      <Avatar name={name} size="sm" presence="online" />
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-medium truncate leading-tight" style={{ color: T.text1 }}>{name}</p>
              <span className="text-[9px] font-bold px-1.5 py-px rounded-full flex-shrink-0" style={{ color: rs.color, background: rs.bg }}>
                {rcLabel}
              </span>
            </div>
            <p className="text-[10px] truncate mt-0.5" style={{ color: T.text3 }}>{email}</p>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: T.text3, flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M2.5 5L6 8.5L9.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </>
      )}
    </button>
  )

  const menuDropdown = menuOpen && !collapsed && (
    <div
      className="absolute left-0 right-0 fade-rise"
      style={{
        bottom: '100%', marginBottom: 4,
        background: T.bgSurface, border: `1px solid ${T.border2}`,
        borderRadius: 12, boxShadow: T.shadowModal, overflow: 'hidden', zIndex: 200,
      }}
    >
      {/* User info header */}
      <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}>
        <p className="text-[13px] font-semibold truncate" style={{ color: T.text1 }}>{name}</p>
        <p className="text-[11px] truncate mt-0.5" style={{ color: T.text3 }}>{email}</p>
        <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-px rounded-full" style={{ color: rs.color, background: rs.bg }}>{rcLabel}</span>
      </div>

      {/* Menu items */}
      {[
        { icon: '👤', label: 'Meu perfil',    action: () => { setMenuOpen(false); onNav('profile') } },
        { icon: '⚙️', label: 'Preferências',  action: () => { setMenuOpen(false); onNav('preferences') } },
        { icon: '💬', label: 'Feedback & Suporte', action: () => { setMenuOpen(false); onNav('feedback') } },
      ].map(item => (
        <button key={item.label} onClick={item.action}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors"
          style={{ color: T.text2 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <span>{item.icon}</span>{item.label}
        </button>
      ))}

      {/* User switcher (inspection only) */}
      {INSPECTION_MODE_ENABLED && (
        <>
          <button
            onClick={() => setSwitchOpen(o => !o)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors"
            style={{ color: T.text2, borderTop: `1px solid ${T.border}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <span>🔄</span>
            <span className="flex-1">Trocar usuário (inspeção)</span>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ transform: switchOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: T.text3 }}>
              <path d="M1.5 3.5L4.5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>

          {switchOpen && (
            <div style={{ maxHeight: 220, overflowY: 'auto', borderTop: `1px solid ${T.border}` }}>
              <p className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest" style={{ color: T.text3 }}>Inspection Mode</p>
              {MOCK_USERS.map(u => {
                const s = ROLE_CONTEXT_COLOR[u.role_context] ?? { color: T.accent, bg: T.accentDim }
                const lbl = ROLE_CONTEXT_LABEL[u.role_context] ?? u.role_context
                const isActive = u.user_id === activeUser.user_id
                return (
                  <button
                    key={u.user_id}
                    onClick={() => { setActiveUser(u.user_id); setMenuOpen(false); setSwitchOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
                    style={{ background: isActive ? `${s.color}14` : 'transparent' }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <Avatar name={u.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: isActive ? s.color : T.text1 }}>{u.name}</p>
                      <p className="text-[10px]" style={{ color: T.text3 }}>{lbl}</p>
                    </div>
                    {isActive && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                        <path d="M2 5l2.5 2.5L8 2.5" stroke={s.color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Sign out */}
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        <button
          onClick={() => { setMenuOpen(false); void signOut() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors"
          style={{ color: T.crit }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <span>🚪</span>Sair
        </button>
      </div>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      {menuDropdown}
      {collapsed
        ? <Tooltip label={`${name} — ${rcLabel}`} side="right">{btn}</Tooltip>
        : btn
      }
    </div>
  )
}

function ApproveHoursIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 4.5v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4.5 9.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg> }

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export function Sidebar({ collapsed, onToggle, activeNav, onNav }: SidebarProps) {
  const [projectsOpen, setProjectsOpen] = useState(_projectsOpen)

  function toggleProjects() {
    const next = !projectsOpen
    _projectsOpen = next
    setProjectsOpen(next)
  }

  const { activeUser, isTenantOwner } = useSession()
  const permissions    = activeUser.permissions
  const hasReportsFlag = useProfileReportsAccess(activeUser.user_id)
  const reportsAllowed = canAccessReports(permissions, hasReportsFlag)

  // Boards visíveis (RBAC + tenant). Em erro de leitura degrada para lista vazia.
  const { boards: visibleBoards, loading: boardsLoading } = useVisibleBoards()
  const boardsDisabled = !boardsLoading && visibleBoards.length === 0
  const NO_BOARDS_LABEL = 'Você não tem acesso a nenhum board'

  const groups         = getGroups(activeUser.role_context, permissions, isTenantOwner)
    .map(g => ({ ...g, items: g.items.filter(i => (i.id !== 'reports' || reportsAllowed) && !(i.id === 'boards-list' && boardsDisabled)) }))
    .filter(g => g.items.length > 0)
  const canLogHours      = can(permissions, 'log:hours')
  const canApproveHours  = can(permissions, 'approve:hours')


  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? 56 : 240,
    background: T.bgSurface,
    borderRight: `1px solid ${T.border}`,
    transition: 'width 0.2s ease',
  }

  return (
    <aside className="flex flex-col flex-shrink-0 overflow-hidden" style={sidebarStyle}>

      {/* Workspace selector */}
      <div className="px-1.5 pt-2 pb-1 flex-shrink-0">
        <WorkspaceSelector collapsed={collapsed} />
      </div>

      {/* Collapse toggle + search */}
      {!collapsed && (
        <div className="px-2 pb-2 flex items-center gap-1 flex-shrink-0">
          <button
            className="flex items-center gap-2 flex-1 h-7 px-2.5 rounded-lg border text-[12px] transition-colors"
            style={{ border: `1px solid ${T.border}`, background: `${T.text3}10`, color: T.text3 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border }}
          >
            <SearchIcon />
            Buscar...
            <span className="ml-auto text-[9px] px-1.5 rounded font-mono" style={{ background: `${T.text3}20`, color: T.text3 }}>⌘K</span>
          </button>
          <button
            onClick={onToggle}
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
            style={{ color: T.text3 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}14`; (e.currentTarget as HTMLButtonElement).style.color = T.text1 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = T.text3 }}
            title="Colapsar sidebar"
          >
            <CollapseIcon />
          </button>
        </div>
      )}

      {/* Collapsed: expand button */}
      {collapsed && (
        <div className="px-1.5 pb-2 flex justify-center flex-shrink-0">
          <Tooltip label="Expandir sidebar" side="right">
            <button
              onClick={onToggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: T.text3 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}14` }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <ExpandIcon />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto pb-2 ${collapsed ? 'px-1.5 space-y-1' : 'px-2 space-y-4'}`}>
        {collapsed ? (
          // Collapsed: flat list of all visible items
          groups.flatMap(g => g.items)
            .filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx)
            .map(item => (
              <NavBtn
                key={item.id}
                item={item}
                active={activeNav === item.id}
                onClick={() => onNav(item.id)}
                collapsed
                disabled={item.id === 'boards-list' && boardsDisabled}
                disabledLabel={item.id === 'boards-list' ? NO_BOARDS_LABEL : undefined}
              />
            ))
        ) : (
          // Expanded: grouped
          groups.map(group => (
            <div key={group.label}>
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.text3 }}>
                {group.label}
              </p>
              {group.items.map(item => (
                <React.Fragment key={`${item.id}-${item.label}`}>
                  {item.id === 'dashboard' ? (
                    <NavBtnWithDisclosure
                      item={item}
                      active={activeNav === item.id}
                      open={projectsOpen}
                      onNavigate={() => onNav(item.id)}
                      onToggle={toggleProjects}
                    />
                  ) : (
                    <NavBtn
                      item={item}
                      active={activeNav === item.id}
                      collapsed={false}
                      onClick={() => onNav(item.id)}
                      disabled={item.id === 'boards-list' && boardsDisabled}
                      disabledLabel={item.id === 'boards-list' ? NO_BOARDS_LABEL : undefined}
                    />
                  )}
                  {/* Animated disclosure panel — only after the dashboard item */}
                  {item.id === 'dashboard' && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: projectsOpen ? '1fr' : '0fr',
                        transition: 'grid-template-rows 0.22s ease',
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <ProjectSubList onNav={onNav} />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          ))
        )}
      </nav>

      {/* Lançar horas / Aprovar horas */}
      {(canLogHours || canApproveHours) && (
        <div className="flex-shrink-0 px-2 py-1.5" style={{ borderTop: `1px solid ${T.border}` }}>
          {canLogHours && (collapsed ? (
            <Tooltip label="Lançar horas" side="right">
              <button
                onClick={() => onNav('timesheet')}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: activeNav === 'timesheet' ? T.accent : T.text2, background: activeNav === 'timesheet' ? `${T.accent}14` : 'transparent' }}
                onMouseEnter={e => { if (activeNav !== 'timesheet') (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}14` }}
                onMouseLeave={e => { if (activeNav !== 'timesheet') (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <ClockIcon />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={() => onNav('timesheet')}
              className="flex items-center gap-2 w-full h-8 px-2.5 rounded-lg text-[13px] transition-colors"
              style={{ color: activeNav === 'timesheet' ? T.accent : T.text2, background: activeNav === 'timesheet' ? `${T.accent}14` : 'transparent' }}
              onMouseEnter={e => { if (activeNav !== 'timesheet') (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}14` }}
              onMouseLeave={e => { if (activeNav !== 'timesheet') (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-md"><ClockIcon /></span>
              <span>Lançar horas</span>
            </button>
          ))}
          {canApproveHours && (collapsed ? (
            <Tooltip label="Aprovar horas" side="right">
              <button
                onClick={() => onNav('hours-approval')}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors mt-0.5"
                style={{ color: activeNav === 'hours-approval' ? T.accent : T.text2, background: activeNav === 'hours-approval' ? `${T.accent}14` : 'transparent' }}
                onMouseEnter={e => { if (activeNav !== 'hours-approval') (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}14` }}
                onMouseLeave={e => { if (activeNav !== 'hours-approval') (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <ApproveHoursIcon />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={() => onNav('hours-approval')}
              className="flex items-center gap-2 w-full h-8 px-2.5 rounded-lg text-[13px] transition-colors mt-0.5"
              style={{ color: activeNav === 'hours-approval' ? T.accent : T.text2, background: activeNav === 'hours-approval' ? `${T.accent}14` : 'transparent' }}
              onMouseEnter={e => { if (activeNav !== 'hours-approval') (e.currentTarget as HTMLButtonElement).style.background = `${T.text3}14` }}
              onMouseLeave={e => { if (activeNav !== 'hours-approval') (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-md"><ApproveHoursIcon /></span>
              <span>Aprovar horas</span>
            </button>
          ))}
        </div>
      )}

      {/* User block (pinned bottom) */}
      <div className="flex-shrink-0 px-1.5 py-2" style={{ borderTop: `1px solid ${T.border}` }}>
        <UserBlock collapsed={collapsed} onNav={onNav} />
      </div>
    </aside>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function HomeIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 6.5L7 2L12.5 6.5V12.5H9V9H5V12.5H1.5V6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg> }

function CalendarIcon(){ return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 2v2M9 2v2M2 6h10M5 9h1M7 9h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function GanttIcon()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="4" width="5" height="2" rx="1" fill="currentColor" opacity=".7"/><rect x="5" y="7" width="7" height="2" rx="1" fill="currentColor" opacity=".7"/><rect x="3" y="10" width="4" height="2" rx="1" fill="currentColor" opacity=".7"/></svg> }
function BoardIcon()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="6" y="3" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="10" y="3" width="2" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/></svg> }
function ClientIcon()  { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function SearchIcon()  { return <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8.5 8.5L7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function ReleaseIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function AccessIcon()  { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 7a2 2 0 1 0-4 0 2 2 0 0 0 4 0z" stroke="currentColor" strokeWidth="1.2"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function LoginIcon()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8 2H11C11.6 2 12 2.4 12 3V11C12 11.6 11.6 12 11 12H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 4.5L8 7L5 9.5M8 7H2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function PortalIcon()  { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/><path d="M5 7h4M7 5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function ChatIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg> }
function AutomIcon()      { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5l-5 7h5l-1 4 5-7H6l1-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg> }
function ModulesIcon()    { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="1.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7.5" y="1.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1.5" y="7.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7.5" y="7.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg> }
function CollapseIcon(){ return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 2.5L5 6.5L8.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function ExpandIcon()  { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4.5 2.5L8 6.5L4.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> }
