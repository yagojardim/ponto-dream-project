import { useState, useEffect, useMemo, createContext, useContext, type ReactNode, type ReactElement } from 'react'
import { useSession } from '../data/SessionContext'
import { INSPECTION_MODE_ENABLED } from '../lib/auth'
import { fetchTenantStorage, usagePct, bytesToHuman, type TenantStorage } from '@/data/db/storage'
import { DEFAULT_TENANT_ID } from '@/data/db/timeline'
import { UsageBar } from '@/pages/StoragePage'
import { T } from '../components/ds/tokens'
import { useClientPortal } from '../data/clientPortalStore'
import {
  KpiCard, RagCard, ProgressCard, WorkQueue, SprintDonutCard,
  WorkItemDetailDrawer, FilterBar, ProjectMultiSelect,
  SCard, ProgressBar, StatusBadge, ConditionalTag, Av,
  AuditFeed, ActivityTimeline, EmptyState, LoadingState,
  MiniBarChart, MiniSparkline,
  type WorkItem, type FilterState, type RagStatus, type AuditEntry,
} from '../components/ds/DashboardKit'
import {
  MOCK_TENANT, MOCK_USERS,
  DASHBOARD_CATALOG, roleChoiceLabel,
  type MockUser, type UserScope, type DashboardType,
} from '../data/session'
// MOCK_TENANT used in ProductOwnerPanel for client feed scoping
import {
  useLiveDashboard, liveItems, liveCurrentSprintName, liveAggregates, liveProjects,
  getBlockedItems, getSprintItems, getReadyItems,
  getTestingItems, getBacklogWithAlerts,
} from '../data/db/homeLive'

import {
  getAllForPo, getUnreadForPo, markReadByPo, markAllReadByPo,
  addPoReply, getSignalsForTenant, getUnreadCountForTenant, type ClientSignal,
} from '../data/clientSignals'
import {
  dismissHomeCard, pinHomeCard, getVisibleHomeCards, getGridCards,
  pinGridCard, dismissGridCard,
  dismissNativeCard, restoreNativeCard, getDismissedNative, useDashboardAssignments,
  type AssignmentTarget, type HomeCardSlot,
} from '../data/dashboardAssignments'
import { listSquads, type SquadOption } from '../data/db/timesheets'
import { safeCall } from '../utils/logger'
import { fetchAdminKpis, computeDeliveryMetrics, type AdminKpis } from '../data/db/dashboards'
import {
  REPORT_REGISTRY, REPORT_CARDS_LIST, ReportChartModal, useChartModal,
  ReportsDataProvider, ReportKpiPreview, ReportMiniViz, navigateToReport,
  BurndownChart, useReportsData,
  type ReportEntry,
} from '../data/reportRegistry'
import { getBoardsForScope } from '../data/boards'
import { fetchAssignedProjects } from '../data/db/projects'
import { useReportsGovernance, isCardReleased } from '../data/db/reportsGovernance'
import { can } from '../data/permissions'
import { countActiveModules, listModules, type ModuleView } from '../data/db/modules'
import { getMembers, setMemberStatus, type MemberRow, type MemberStatus } from '@/data/db/members'
import { fetchRecentAdminActivity, relativeTime, type AdminActivityRow } from '@/data/db/adminActivity'
import { countPendingInvites, nearestExpiry } from '../data/invites'

// ─── Shared hook: drawer + nav + filter state ─────────────────────────────────
function useDrawer() {
  const [drawerItem, setDrawerItem] = useState<WorkItem | null>(null)
  return { drawerItem, openDrawer: setDrawerItem, closeDrawer: () => setDrawerItem(null) }
}

function useFilters(): [FilterState, (f: FilterState) => void] {
  return useState<FilterState>({ project_id: '', squad_id: '', sprint: '' })
}

function applyFilters(items: WorkItem[], f: FilterState): WorkItem[] {
  return items.filter(w =>
    (!f.project_id || w.project_id === f.project_id) &&
    (!f.squad_id   || w.squad_id   === f.squad_id) &&
    (!f.sprint     || w.sprint     === f.sprint)
  )
}

// ─── Project filter scope (RBAC) ─────────────────────────────────────────────
interface ProjOption { id: string; name: string; color?: string }

interface HomeFilterValue {
  /** Projects the signed-in profile is allowed to see (RBAC). */
  allowed: ProjOption[]
  sel: Set<string>
  setSel: (s: Set<string>) => void
}

const HomeFilterCtx = createContext<HomeFilterValue>({ allowed: [], sel: new Set(), setSel: () => {} })

/** Mirror of the allowed ids so non-hook helpers (byProjects) stay in sync. */
let ALLOWED_IDS: Set<string> | null = null
let ALLOWED_LIST: ProjOption[] = []
/** True quando o perfil tem visão de gestão (todos os projetos do tenant). */
let ALLOWED_TENANT_WIDE = false
/** Escopo efetivo enviado aos agregados (undefined só para gestão sem recorte). */
let SCOPE_IDS: string[] | undefined = undefined

function ProjFilterRow({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const { allowed } = useContext(HomeFilterCtx)
  const partial = allowed.length > 0 && selected.size > 0 && selected.size < allowed.length
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
      {partial && (
        <span style={{
          fontSize: 10, fontWeight: 600, color: T.accent, background: `${T.accent}14`,
          border: `1px solid ${T.accent}33`, borderRadius: 4, padding: '2px 7px',
        }}>
          Filtrado: {selected.size} de {allowed.length} projetos
        </span>
      )}
      <ProjectMultiSelect projects={allowed} selected={selected} onChange={onChange} />
    </div>
  )
}

/** Project options come from the database, restricted to the profile's scope. */
const PROJECTS = () => ALLOWED_LIST
const ALL_PROJ_IDS = () => new Set(ALLOWED_LIST.map(p => p.id))

function sessionScope(user: MockUser): UserScope | null {
  const assigned = Array.isArray(user.assigned_dashboards)
    ? user.assigned_dashboards.filter(d => d.status === 'active')
    : []
  const defaultDashboard = assigned.find(d => d.is_default) ?? assigned[0]
  if (!defaultDashboard) return null

  return {
    user_id: user.user_id,
    tenant_id: user.tenant_id,
    role_context: user.role_context,
    projects_allowed: user.project_id === '*' ? ALLOWED_LIST.map(p => p.id) : [user.project_id],
    workspaces_allowed: [`ws_${user.tenant_id}`],
    squads_allowed: user.squad_id === '*' ? [] : [user.squad_id],
    modules_allowed: Array.isArray(user.modules_enabled) ? user.modules_enabled : [],
    features_allowed: (user.modules_enabled ?? []).map(m => `feat_${m}`),
    repositories_allowed: [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    assigned_dashboards: assigned,
    default_dashboard: defaultDashboard,
  }
}

/** Every panel shares the same selection, so one filter drives all cards. */
function useProjSel(): [Set<string>, (s: Set<string>) => void] {
  const { sel, setSel } = useContext(HomeFilterCtx)
  return [sel, setSel]
}

function byProjects<T extends { project_id?: string }>(items: T[], sel: Set<string>): T[] {
  const scope = ALLOWED_IDS
  // Perfil não-gestão sem projeto atribuído ⇒ nunca mostra dados do tenant.
  if (!scope && !ALLOWED_TENANT_WIDE) return []
  // Sem restrição de escopo e sem recorte ativo ⇒ nada a filtrar.
  const all = !scope || sel.size === 0 || sel.size >= scope.size
  if (all && !scope) return items
  const active = all ? scope! : sel
  return items.filter(w => active.has(w.project_id ?? ''))
}



/** Squads reais do tenant, hidratados pelo HomeFilterProvider. */
let SQUAD_LIST: SquadOption[] = []
const SQUADS = () => SQUAD_LIST
/** Sprint filter options come from the sprints in scope. */
const SPRINTS = () => {
  const names = new Set<string>()
  liveItems().forEach(w => { if (w.sprint) names.add(w.sprint) })
  return [...names]
}


// ─── Panel grid wrapper ───────────────────────────────────────────────────────
function Grid({ cols = '1fr 1fr', gap = 12, children }: { cols?: string; gap?: number; children: ReactNode }) {
  return <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: cols, gap, alignItems: 'stretch' }}>{children}</div>
}
function ColSpan({ children }: { children: ReactNode }) {
  return <div style={{ gridColumn: '1 / -1' }}>{children}</div>
}

// ─── Unified mural types & primitives ────────────────────────────────────────
interface MuralNativeCard {
  id: string
  value: string
  label: string
  sub?: string
  disclaimer?: string
  miniViz?: ReactNode
  color?: string
  alert?: boolean
  onClick?: () => void
  help?: string
  helpTitle?: string
}

function NativeMuralTile({ card, onDismiss }: { card: MuralNativeCard; onDismiss: (id: string) => void }) {
  const [xHov, setXHov] = useState(false)
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <button
        title="Remover da Home"
        onClick={e => { e.stopPropagation(); onDismiss(card.id) }}
        onMouseEnter={() => setXHov(true)}
        onMouseLeave={() => setXHov(false)}
        style={{
          position: 'absolute', top: 6, right: 6, zIndex: 2,
          width: 20, height: 20, borderRadius: 4, border: 'none',
          background: xHov ? `${T.crit}22` : `${T.text3}18`,
          color: xHov ? T.crit : T.text3,
          cursor: 'pointer', fontSize: 13, lineHeight: '20px', textAlign: 'center',
          transition: 'all 0.12s',
        }}
      >×</button>
      <KpiCard
        value={card.value}
        label={card.label}
        sub={card.sub}
        disclaimer={card.disclaimer}
        miniViz={card.miniViz}
        color={card.color}
        alert={card.alert}
        onClick={card.onClick}
        help={card.help}
        helpTitle={card.helpTitle}
      />
    </div>
  )
}

// ─── Admin cards (dados reais do tenant) ─────────────────────────────────────
const AVATAR_COLORS = ['#35c9ae', '#f5a524', '#a78bfa', '#60a5fa', '#EF4444', '#22d3ee', '#f472b6']

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
function colorOf(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
const STATUS_COLOR: Record<string, string> = { active: T.success, blocked: T.crit, inactive: T.neutral }
const STATUS_LABEL: Record<string, string> = { active: 'Ativo', blocked: 'Bloqueado', inactive: 'Inativo' }

function AdminUsersCard({ onNav, onInvite, actorName }: {
  onNav: (v: string, targetId?: string) => void
  onInvite?: () => void
  actorName?: string
}) {
  const [rows, setRows] = useState<MemberRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getMembers().then(list => {
      if (!alive) return
      setRows(list)
      setFailed(list.length === 0)
    })
    return () => { alive = false }
  }, [])

  async function change(m: MemberRow, next: MemberStatus) {
    setBusy(m.id)
    const ok = await setMemberStatus(m.id, next, actorName)
    if (ok) setRows(prev => (prev ?? []).map(r => r.id === m.id ? { ...r, status: next } : r))
    setBusy(null)
  }

  const activeUsers = rows?.filter(u => u.status === 'active') ?? []
  const displayedUsers = activeUsers.slice(0, 5)

  return (
    <SCard title="Gestão de Usuários" action={
      <button onClick={() => onNav('team')} style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Ver time →</button>
    }>
      {rows === null
        ? <LoadingState />
        : activeUsers.length === 0
          ? <EmptyState message={failed ? 'Não foi possível carregar os usuários.' : 'Nenhum usuário ativo no tenant.'} />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 6 }}>
              {displayedUsers.map(u => {
                const c = STATUS_COLOR[u.status] ?? T.neutral
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Av initials={initialsOf(u.name || u.email)} color={colorOf(u.id)} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || u.email}</div>
                      <div style={{ fontSize: 10, color: T.text3 }}>{u.primary_role ?? '—'}</div>
                    </div>
                    <span style={{ fontSize: 10, color: c, background: `${c}18`, border: `1px solid ${c}33`, borderRadius: 4, padding: '2px 7px' }}>
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                    {u.status === 'blocked'
                      ? <button disabled={busy === u.id} onClick={() => void change(u, 'active')} style={{ fontSize: 10, color: T.success, background: `${T.success}14`, border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Desbloquear</button>
                      : u.status === 'active'
                        ? <button disabled={busy === u.id} onClick={() => void change(u, 'blocked')} style={{ fontSize: 10, color: T.warn, background: `${T.warn}14`, border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Bloquear</button>
                        : <button disabled={busy === u.id} onClick={() => void change(u, 'active')} style={{ fontSize: 10, color: T.accent, background: `${T.accent}14`, border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Reativar</button>
                    }
                  </div>
                )
              })}
            </div>
          )}
      <button onClick={() => onInvite ? onInvite() : onNav('config')} style={{ marginTop: 12, width: '100%', fontSize: 11, color: T.accent, background: `${T.accent}12`, border: `1px solid ${T.accent}33`, borderRadius: 6, padding: '6px', cursor: 'pointer' }}>
        + Convidar usuário
      </button>
    </SCard>
  )
}

const ACTIVE_MODULE_STATUS = new Set<string>(['operational', 'implemented', 'contracted', 'deploying', 'preview'])

function AdminModulesCard({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const [mods, setMods] = useState<ModuleView[] | null>(null)
  useEffect(() => {
    let alive = true
    void listModules().then(list => { if (alive) setMods(list) })
    return () => { alive = false }
  }, [])

  return (
    <SCard title="Módulos">
      {mods === null
        ? <LoadingState />
        : mods.length === 0
          ? <EmptyState message="Nenhum módulo disponível." />
          : mods.map(m => {
            const active = ACTIVE_MODULE_STATUS.has(m.status)
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 99, background: active ? T.success : T.border, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: active ? T.text1 : T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                </div>
                {active
                  ? <span style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>Ativo</span>
                  : <button onClick={() => onNav('modules')} style={{ fontSize: 10, color: T.indigo, background: `${T.indigo}14`, border: `1px solid ${T.indigo}33`, borderRadius: 4, padding: '1px 7px', cursor: 'pointer', flexShrink: 0 }}>
                      {m.status === 'pending' ? 'Pendente' : 'Solicitar'}
                    </button>
                }
              </div>
            )
          })}
    </SCard>
  )
}

function AdminAuditCard() {
  const [rows, setRows] = useState<AdminActivityRow[] | null>(null)
  useEffect(() => {
    let alive = true
    void fetchRecentAdminActivity(8).then(list => { if (alive) setRows(list) })
    return () => { alive = false }
  }, [])

  const entries: AuditEntry[] = (rows ?? []).map(r => ({
    action: r.action,
    user: r.entityType,
    by: r.actorName ?? 'sistema',
    when: relativeTime(r.createdAt),
  }))

  return (
    <SCard title="Auditoria — Atividade Administrativa Recente">
      {rows === null ? <LoadingState /> : <AuditFeed entries={entries} />}
    </SCard>
  )
}

// ─── 1. ADMIN MASTER ─────────────────────────────────────────────────────────

function AdminPanel({ onNav, onInvite }: { onNav: (v: string, targetId?: string) => void; onInvite?: () => void }) {
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const { activeUser } = useSession()
  const [kpis, setKpis] = useState<AdminKpis | null>(null)
  const selKey = [...selProj].sort().join(',')
  useEffect(() => {
    let alive = true
    const ids = selKey ? selKey.split(',') : SCOPE_IDS
    void safeCall('admin-kpis', () => fetchAdminKpis(ids), null as AdminKpis | null)
      .then(k => { if (alive && k) setKpis(k) })
    return () => { alive = false }
  }, [selKey])

  const inviteSub = kpis == null
    ? '—'
    : kpis.invites.pending === 0
      ? 'nenhum pendente'
      : kpis.invites.nextExpiryDays == null
        ? `${kpis.invites.pending} pendente${kpis.invites.pending !== 1 ? 's' : ''}`
        : kpis.invites.nextExpiryDays <= 0 ? 'expira hoje' : `expira em ${kpis.invites.nextExpiryDays}d`




  // Counts come straight from the tenant's tables; proportions render as donuts,
  // pure counts render as a single-value bar — never a fabricated trend.
  const ratioViz = (part: number, total: number, color: string): ReactNode =>
    <ReportMiniViz viz={{ kind: 'donut', values: [], ratio: total > 0 ? (part / total) * 100 : 0, color }} />

  const nativeCards: MuralNativeCard[] = [
    { id: 'admin:projects', value: kpis ? String(kpis.projects.total) : '—', label: 'Projetos',
      sub: kpis ? `${kpis.projects.active} ativo${kpis.projects.active !== 1 ? 's' : ''}` : 'carregando…',
      disclaimer: 'projetos do tenant (não arquivados)',
      miniViz: kpis ? ratioViz(kpis.projects.active, kpis.projects.total, T.accent) : undefined,
      onClick: () => onNav('projects-list') },
    { id: 'admin:boards', value: kpis ? String(kpis.boards.total) : '—', label: 'Boards',
      sub: kpis ? `${kpis.boards.active} ativo${kpis.boards.active !== 1 ? 's' : ''}` : 'carregando…',
      disclaimer: 'boards de Kanban do tenant',
      miniViz: kpis ? ratioViz(kpis.boards.active, kpis.boards.total, T.indigo) : undefined,
      onClick: () => onNav('boards-list') },
    { id: 'admin:modules', value: kpis ? String(kpis.modules.active) : '—', label: 'Módulos ativos',
      sub: kpis ? `de ${kpis.modules.total}` : 'carregando…',
      disclaimer: 'módulos habilitados para este tenant',
      miniViz: kpis ? ratioViz(kpis.modules.active, kpis.modules.total, T.purple) : undefined,
      onClick: () => onNav('modules') },
    { id: 'admin:users', value: kpis ? String(kpis.users.total) : '—', label: 'Usuários',
      sub: kpis ? `${kpis.users.active} ativo${kpis.users.active !== 1 ? 's' : ''}${kpis.users.blocked ? ` · ${kpis.users.blocked} bloqueado(s)` : ''}` : 'carregando…',
      disclaimer: 'perfis registrados no tenant',
      miniViz: kpis ? ratioViz(kpis.users.active, kpis.users.total, T.success) : undefined,
      onClick: () => onNav('team:membros') },
    { id: 'admin:invites', value: kpis ? String(kpis.invites.pending) : '—', label: 'Convites',
      sub: inviteSub, disclaimer: 'convites pendentes de aceitação',
      color: kpis && kpis.invites.pending > 0 ? T.warn : undefined,
      alert: !!kpis && kpis.invites.pending > 0,
      onClick: () => onNav('team:convites') },
  ]


  return (
    <>
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="admin" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="2fr 1fr">
        <AdminUsersCard onNav={onNav} onInvite={onInvite} actorName={activeUser?.name} />

        <AdminModulesCard onNav={onNav} />

        <ColSpan>
          <AdminAuditCard />
        </ColSpan>

        <CompositionGrid dashId="admin" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── 2. PMO ───────────────────────────────────────────────────────────────────
function PmoPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const { drawerItem, openDrawer: openPmoDrawer, closeDrawer } = useDrawer()
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const blocked = applyFilters(byProjects(getBlockedItems(), selProj), filters)
  const { openChart, chartModal } = useChartModal()

  const agg  = liveAggregates()
  const rags = (agg?.rag ?? []).filter(r => selProj.size === 0 || selProj.has(r.id))
  const c    = agg?.counts

  const nativeCards: MuralNativeCard[] = [
    { id: 'pmo:projects', value: String(c?.activeProjects ?? 0), label: 'Projetos Ativos', sub: `${rags.filter(r => r.rag === 'healthy').length} no prazo`, disclaimer: 'projetos ativos no tenant', onClick: () => onNav('projects-list') },
    { id: 'pmo:risk', value: String(c?.atRisk ?? 0), label: 'Em Risco / Atrasados', sub: `${rags.filter(r => r.rag === 'blocked').length} crítico(s)`, disclaimer: 'projetos com RAG amarelo ou vermelho', color: T.warn, alert: (c?.atRisk ?? 0) > 0, onClick: () => onNav('reports') },
    { id: 'pmo:predictability', value: `${agg?.predictability ?? 0}%`, label: 'Previsibilidade', help: 'Percentual do planejado que foi efetivamente entregue.', sub: 'meta: 80%', disclaimer: '% do planejado efetivamente entregue', onClick: () => openChart('velocity') },
    { id: 'pmo:delivery', value: `${agg?.consolidatedPct ?? 0}%`, label: 'Planejado × Concluído', sub: `${agg?.done ?? 0}/${agg?.planned ?? 0} itens`, disclaimer: 'itens concluídos sobre o total planejado', onClick: () => openChart('criados') },
  ]


  return (
    <>
      {chartModal}
      {drawerItem && <WorkItemDetailDrawer item={drawerItem} onClose={closeDrawer} onNav={onNav} />}
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="pmo" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="1fr 1fr">
        <SCard title="Saúde por Projeto (RAG)" help="Semáforo de saúde: 🟢 saudável · 🟡 em risco · 🔴 bloqueado.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rags.length === 0 && <EmptyState message="Nenhum projeto no escopo selecionado." />}
            {rags.map(r => (
              <RagCard key={r.id} name={r.name} squad={r.squad} rag={r.rag} pct={r.pct} daysLabel={r.daysLabel} reason={r.reason} onClick={() => onNav('project', r.id)} />
            ))}
          </div>
        </SCard>


        <WorkQueue title="Bloqueadores Críticos" items={blocked} onOpen={openPmoDrawer}
          showDaysBlocked onViewAll={() => onNav('list')}
          emptyMsg="Nenhum bloqueador ativo. Boa sinal! 🟢" />

        <ColSpan>
          <ProgressCard pct={agg?.consolidatedPct ?? 0} label="Ritmo de Entrega — Portfólio"
            velocity={`Velocity média: ${agg?.velocityAvg ?? 0}pt/sprint`} onClick={() => onNav('reports')} />
        </ColSpan>


        <ColSpan>
          <ClientFeedCard tenantId={MOCK_TENANT.tenant_id} />
        </ColSpan>
        <CompositionGrid dashId="pmo" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── 3. PROJECT MANAGER ───────────────────────────────────────────────────────
function ProjectManagerPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const { drawerItem, openDrawer, closeDrawer } = useDrawer()
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const sprint14 = applyFilters(byProjects(getSprintItems(liveCurrentSprintName() ?? undefined), selProj), filters)
  const blocked  = applyFilters(byProjects(getBlockedItems(), selProj), filters)
  const { openChart, chartModal } = useChartModal()

  const agg         = liveAggregates()
  const sprintName  = liveCurrentSprintName()
  const pmDone      = sprint14.filter(w => w.status === 'done').length
  const pmTotal     = sprint14.length || 1
  const pmProgress  = Math.round((pmDone / pmTotal) * 100)
  const pmPtTotal   = sprint14.reduce((s, w) => s + (w.points ?? 0), 0) || 1
  const pmPtDone    = sprint14.filter(w => w.status === 'done').reduce((s, w) => s + (w.points ?? 0), 0)

  const scopeRag    = (agg?.rag ?? []).filter(r => selProj.size === 0 || selProj.has(r.id))
  const mainRag     = scopeRag[0]
  const sprintSum   = (agg?.currentSprints ?? []).find(s => selProj.size === 0 || selProj.has(s.projectId))
  const daysLeft    = mainRag?.daysLabel ?? '—'

  const team = (agg?.workload ?? []).slice(0, 6).map(w => ({
    name: w.name, i: w.initials, c: w.color, ativas: w.active, cap: 5,
  }))

  const nativeCards: MuralNativeCard[] = [
    { id: 'pm:progress', value: `${pmProgress}%`, label: 'Progresso do Projeto', help: 'Velocity = pontos concluídos por sprint. Burndown = pontos restantes ao longo da sprint.', sub: `${pmDone}/${pmTotal} itens concluídos`, disclaimer: '% de tarefas concluídas na sprint ativa', miniViz: <BurndownChart variant="thumbnail" sprintTotal={pmPtTotal} sprintRemaining={pmPtTotal - pmPtDone} />, onClick: () => onNav('project') },
    { id: 'pm:deadline', value: daysLeft, label: 'Prazo Restante', sub: mainRag?.periodEnd ? `Entrega: ${mainRag.periodEnd}` : 'sem data definida', disclaimer: 'dias até a data de entrega planejada', onClick: () => onNav('gantt') },
    { id: 'pm:blocked', value: String(blocked.length), label: 'Bloqueios Ativos', sub: 'ver lista', disclaimer: 'demandas atualmente bloqueadas', color: T.crit, alert: blocked.length > 0, onClick: () => onNav('list') },
    { id: 'pm:scope', value: `${agg?.predictability ?? 0}%`, label: 'Previsibilidade', help: 'Percentual do planejado que foi efetivamente entregue.', sub: 'planejado × entregue', disclaimer: 'entrega efetiva vs. compromisso', color: T.warn, alert: (agg?.predictability ?? 100) < 80, onClick: () => openChart('criados') },
  ]


  return (
    <>
      {chartModal}
      {drawerItem && <WorkItemDetailDrawer item={drawerItem} onClose={closeDrawer} onNav={onNav} />}
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="project-manager" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="1fr 1fr">
        {mainRag
          ? <RagCard name={mainRag.name} squad={`${mainRag.squad}${sprintName ? ` · ${sprintName}` : ''}`} rag={mainRag.rag}
              pct={mainRag.pct} daysLabel={mainRag.daysLabel} reason={mainRag.reason} onClick={() => onNav('project', mainRag.id)} />
          : <EmptyState message="Nenhum projeto no escopo selecionado." />}

        <ProgressCard pct={agg?.consolidatedPct ?? 0} label="Planejado × Concluído"
          velocity={`${agg?.donePoints ?? 0}pt concluídos de ${agg?.plannedPoints ?? 0}pt`} onClick={() => openChart('criados')} />

        <SprintDonutCard sprintName={sprintSum?.name ?? sprintName ?? 'Sprint atual'}
          done={sprintSum?.done ?? pmDone} total={sprintSum?.total ?? sprint14.length}
          items={sprint14} onOpen={openDrawer} onViewSprint={() => onNav('project')} />


        <WorkQueue title="Bloqueadores & Riscos" items={blocked} onOpen={openDrawer}
          showDaysBlocked onViewAll={() => onNav('list')}
          emptyMsg="Nenhum bloqueador ativo." />

        <ColSpan>
          <SCard title="Carga do Time">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {team.map(m => (
                <div key={m.name} style={{ background: T.bgPage, borderRadius: 7, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Av initials={m.i} color={m.c} size={22} />
                    <span style={{ fontSize: 11, color: T.text1 }}>{m.name}</span>
                  </div>
                  <ProgressBar pct={(m.ativas / m.cap) * 100} color={m.ativas > m.cap ? T.crit : T.accent} />
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>{m.ativas}/{m.cap} issues</div>
                  {m.ativas > m.cap && <ConditionalTag label="Sobrecarga" severity="crit" />}
                </div>
              ))}
            </div>
          </SCard>
        </ColSpan>

        <ColSpan>
          <ClientFeedCard tenantId={MOCK_TENANT.tenant_id} />
        </ColSpan>
        <CompositionGrid dashId="project-manager" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── 4. PRODUCT MANAGER ──────────────────────────────────────────────────────
function ProductManagerPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()

  const funnel = [
    { stage: 'Visitantes',   value: 12400, pct: 100 },
    { stage: 'Cadastros',    value: 3100,  pct: 25  },
    { stage: 'Ativação',     value: 1860,  pct: 60  },
    { stage: 'Engajamento',  value: 930,   pct: 50  },
    { stage: 'Retenção D30', value: 560,   pct: 60  },
  ]
  const features = [
    { name: 'Board Kanban',   adocao: 84 },
    { name: 'Relatórios',     adocao: 52 },
    { name: 'Portal Cliente', adocao: 31 },
    { name: 'Automações',     adocao: 12 },
  ]
  const roadmap = [
    { epic: 'Portal do Cliente v2', quarter: 'Q3 2025', status: 'Em andamento', valor: 'Reduz suporte 40%' },
    { epic: 'Analytics Avançado',   quarter: 'Q3 2025', status: 'Planejado',    valor: 'Upsell + retenção' },
    { epic: 'Automações',           quarter: 'Q4 2025', status: 'Planejado',    valor: 'Eficiência do time' },
  ]

  const nativeCards: MuralNativeCard[] = [
    { id: 'pdm:mau', value: '930', label: 'MAU', sub: '+8% vs mês ant.', disclaimer: 'usuários únicos ativos nos últimos 30 dias', color: T.success, miniViz: <MiniSparkline data={[{label:'Jan',value:720},{value:750},{value:800},{value:860},{value:900},{label:'Jun',value:930}]} color="#34d399" />, onClick: () => onNav('reports') },
    { id: 'pdm:stickiness', value: '7.5%', label: 'Stickiness', sub: 'DAU/MAU — meta 10-20%', disclaimer: 'frequência de uso: ativos diários ÷ mensais', color: T.warn, miniViz: <MiniSparkline data={[{label:'Jan',value:6.1},{value:6.4},{value:6.8},{value:7.0},{value:7.2},{label:'Jun',value:7.5}]} color="#f5a524" />, onClick: () => onNav('reports') },
    { id: 'pdm:churn', value: '3.2%', label: 'Churn Rate', sub: 'meta: <2%', disclaimer: 'taxa de abandono por tenant — sem impacto billing', color: T.crit, alert: true, miniViz: <MiniSparkline data={[{label:'Jan',value:2.8},{value:2.9},{value:3.0},{value:3.1},{value:3.2},{label:'Jun',value:3.2}]} color="#ef4444" />, onClick: () => onNav('reports') },
    { id: 'pdm:adoption', value: '52%', label: 'Adoção de Features', sub: 'base elegível', disclaimer: '% médio de adoção sobre base elegível por feature', miniViz: <MiniBarChart data={[{label:'Jan',value:38},{label:'Feb',value:42},{label:'Mar',value:46},{label:'Abr',value:49},{label:'Mai',value:51},{label:'Jun',value:52,current:true}]} />, onClick: () => onNav('reports') },
  ]

  return (
    <>
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="product-manager" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="1fr 1fr">
        <SCard title="Funil de Conversão / Ativação">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {funnel.map((f, i) => (
              <div key={f.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: T.text2 }}>{f.stage}</span>
                  <span style={{ fontSize: 11, color: T.text1 }}>{f.value.toLocaleString('pt-BR')}</span>
                </div>
                <ProgressBar pct={i === 0 ? 100 : (f.value / funnel[0].value) * 100} color={T.accent} />
              </div>
            ))}
          </div>
        </SCard>

        <SCard title="Adoção de Features (base elegível)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {features.map(f => (
              <div key={f.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: T.text1 }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: f.adocao >= 60 ? T.success : f.adocao >= 30 ? T.warn : T.crit }}>{f.adocao}%</span>
                </div>
                <ProgressBar pct={f.adocao} color={f.adocao >= 60 ? T.success : f.adocao >= 30 ? T.accent : T.crit} />
              </div>
            ))}
          </div>
        </SCard>

        <ColSpan>
          <SCard title="Roadmap Estratégico">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {roadmap.map(r => (
                <div key={r.epic} style={{ background: T.bgPage, borderRadius: 8, padding: '12px 14px', cursor: 'pointer' }} onClick={() => onNav('epics')}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>{r.epic}</div>
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>{r.quarter}</div>
                  <div style={{ marginTop: 8 }}>
                    <ConditionalTag label={r.status} severity={r.status === 'Em andamento' ? 'info' : 'neutral'} />
                  </div>
                  <div style={{ fontSize: 10, color: T.success, marginTop: 8 }}>↑ {r.valor}</div>
                </div>
              ))}
            </div>
          </SCard>
        </ColSpan>
        <CompositionGrid dashId="product-manager" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── Client Feed Card (PO and all management roles) ──────────────────────────
function ClientFeedCard({ poId, tenantId }: { poId?: string; tenantId: string }) {
  useClientPortal()
  const { activeUser } = useSession()
  if (!can(activeUser.permissions, 'access:client-messages')) return null
  const [tick,       setTick]       = useState(0)
  const [openReply,  setOpenReply]  = useState<string | null>(null)
  const [replyText,  setReplyText]  = useState('')
  const [toast,      setToast]      = useState<string | null>(null)

  void tick

  const signals = poId ? getAllForPo(poId, tenantId) : getSignalsForTenant(tenantId)
  // Home cards only surface pending client messages (read_by_po = false).
  const unread  = (poId ? getUnreadForPo(poId, tenantId) : signals.filter(s => !s.read_by_po))
    .filter(s => s.source !== 'management')
  const canReply = true  // any authorized manager can reply

  function handleMarkAllRead() {
    if (poId) markAllReadByPo(poId, tenantId)
    else signals.forEach(s => markReadByPo(s.id))
    setTick(t => t + 1)
  }

  function handleRowClick(s: ClientSignal) {
    setTick(t => t + 1)
    if (openReply === s.id) {
      setOpenReply(null)
      setReplyText('')
    } else {
      setOpenReply(s.id)
      setReplyText('')
    }
  }

  function handleSend(s: ClientSignal) {
    if (!replyText.trim()) return
    addPoReply(s.id, replyText.trim(), activeUser.name)
    setTick(t => t + 1)
    setOpenReply(null)
    setReplyText('')
    setToast('Resposta enviada')
    setTimeout(() => setToast(null), 2500)
  }

  const TYPE_ICON: Record<ClientSignal['type'], string> = { comment: '💬', approval: '✓' }
  const TYPE_COLOR: Record<ClientSignal['type'], string> = { comment: T.accent, approval: T.success }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:T.success, color:'#fff', fontSize:12, fontWeight:600,
          padding:'8px 18px', borderRadius:8, boxShadow:T.shadowModal, zIndex:9999,
        }}>
          {toast}
        </div>
      )}
      <SCard
        title="Mensagens do Cliente"
        action={unread.length > 0 ? (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99, background:T.crit, color:'#fff' }}>
              {unread.length} novo{unread.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={handleMarkAllRead}
              style={{ fontSize:10, color:T.text3, cursor:'pointer', background:'none', border:'none', padding:0 }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color=T.accent}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color=T.text3}}
            >
              Lidas
            </button>
          </div>
        ) : undefined}
      >
        {unread.length === 0 ? (
          <p style={{ fontSize:12, color:T.text3, textAlign:'center', padding:'12px 0' }}>Nenhuma mensagem do cliente pendente.</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {unread.slice(0, 5).map(s => (
              <div key={s.id}>
                {/* Signal row */}
                <div
                  onClick={() => handleRowClick(s)}
                  style={{
                    display:'flex', alignItems:'flex-start', gap:8,
                    padding:'8px 10px',
                    borderRadius: openReply === s.id ? '8px 8px 0 0' : 8,
                    cursor:'pointer',
                    background: !s.read_by_po ? `${T.accent}08` : T.bgPage,
                    borderTop:`1px solid ${!s.read_by_po ? T.accent + '30' : T.border}`,
                    borderRight:`1px solid ${!s.read_by_po ? T.accent + '30' : T.border}`,
                    borderBottom: openReply === s.id ? 'none' : `1px solid ${!s.read_by_po ? T.accent + '30' : T.border}`,
                    borderLeft:`3px solid ${TYPE_COLOR[s.type]}`,
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background=T.bgSurface2}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background=!s.read_by_po?`${T.accent}08`:T.bgPage}}
                >
                  <span style={{ fontSize:13, flexShrink:0, marginTop:1 }}>{TYPE_ICON[s.type]}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:T.text1 }}>{s.author}</span>
                      <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:99, color:TYPE_COLOR[s.type], background:`${TYPE_COLOR[s.type]}18` }}>
                        {s.type === 'comment' ? 'comentário' : 'aprovação'}
                      </span>
                      {!s.read_by_po && <span style={{ width:6, height:6, borderRadius:'50%', background:T.crit, flexShrink:0 }} />}
                    </div>
                    {s.body && (
                      <p style={{ fontSize:11, color:T.text2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:260 }}>
                        {s.body}
                      </p>
                    )}
                    {s.po_reply && (
                      <p style={{ fontSize:10, color:T.success, marginTop:3, fontStyle:'italic' }}>
                        ↳ Você: {s.po_reply}
                      </p>
                    )}
                    <p style={{ fontSize:9, color:T.text3, marginTop:2 }}>
                      {s.item_title} · {s.project}
                    </p>
                  </div>
                  <span style={{ fontSize:9, color:T.text3, flexShrink:0, marginTop:2 }}>
                    {new Date(s.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                  </span>
                </div>

                {/* Inline reply panel */}
                {openReply === s.id && (
                  <div style={{
                    padding:'10px 10px 10px',
                    borderTop:`1px solid ${T.border}`,
                    borderRight:`1px solid ${T.border}`,
                    borderBottom:`1px solid ${T.border}`,
                    borderLeft:`3px solid ${TYPE_COLOR[s.type]}`,
                    borderRadius:'0 0 8px 8px',
                    background: T.bgSurface2,
                  }}
                    onClick={e => e.stopPropagation()}
                  >
                    <>
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Escreva sua resposta ao cliente..."
                        rows={2}
                        style={{
                          width:'100%', resize:'none', fontSize:11, color:T.text1,
                          background:T.bgPage, border:`1px solid ${T.border}`,
                          borderRadius:6, padding:'6px 8px', outline:'none',
                          fontFamily:'inherit', boxSizing:'border-box',
                        }}
                        onFocus={e=>{e.currentTarget.style.borderColor=T.accent}}
                        onBlur={e=>{e.currentTarget.style.borderColor=T.border}}
                      />
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6, marginTop:6 }}>
                        <span style={{ fontSize:9, color:T.text3 }}>
                          Resposta visível ao cliente · por {activeUser.name}
                        </span>
                        <div style={{ display:'flex', gap:6 }}>
                          <button
                            onClick={() => { setOpenReply(null); setReplyText('') }}
                            style={{ fontSize:11, color:T.text3, background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSend(s)}
                            disabled={!replyText.trim()}
                            style={{
                              fontSize:11, fontWeight:600, color:'#fff',
                              background: replyText.trim() ? T.accent : `${T.accent}60`,
                              border:'none', borderRadius:5, padding:'4px 12px',
                              cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                              transition:'background 0.15s',
                            }}
                          >
                            Enviar
                          </button>
                        </div>
                      </div>
                    </>
                  </div>
                )}
              </div>
            ))}
            {signals.length > 5 && (
              <p style={{ fontSize:10, color:T.text3, textAlign:'center', paddingTop:4 }}>
                + {signals.length - 5} mais mensagem{signals.length - 5 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </SCard>
    </>
  )
}

// ─── 5. PRODUCT OWNER ────────────────────────────────────────────────────────
function ProductOwnerPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const { drawerItem, openDrawer, closeDrawer } = useDrawer()
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const alertItems = applyFilters(byProjects(getBacklogWithAlerts(), selProj), filters)
  const readyItems = applyFilters(byProjects(getReadyItems(), selProj), filters)
  const { openChart, chartModal } = useChartModal()

  const selKey = [...selProj].sort().join(',')
  const [poMetrics, setPoMetrics] = useState<PoCardMetrics | null>(null)
  useEffect(() => {
    let alive = true
    fetchPoCardMetrics(selKey ? selKey.split(',') : [])
      .then(m => { if (alive) setPoMetrics(m) })
      .catch(err => { logger.error('po.metrics', err); if (alive) setPoMetrics(null) })
    return () => { alive = false }
  }, [selKey])

  // Compute KPI values from real mock data (respecting selProj filter)
  const sprint14Items   = byProjects(getSprintItems(liveCurrentSprintName() ?? undefined), selProj)
  const totalSprintPts  = sprint14Items.reduce((s, w) => s + (w.points ?? 0), 0) || 38
  const readyPts        = readyItems.reduce((s, w) => s + (w.points ?? 0), 0)
  const coverageReady   = totalSprintPts > 0 ? Math.round((readyPts / totalSprintPts) * 100) : 0
  const backlogAll      = getBacklogWithAlerts()
  const healthyItems    = backlogAll.filter(w => !w.tags?.some(t => t.startsWith('Sem '))).length
  const backlogHealth   = backlogAll.length > 0 ? Math.round((healthyItems / backlogAll.length) * 100) : 100

  const workload = liveAggregates()?.workload ?? []
  const team = workload.map(w => ({
    name: w.name,
    initials: w.initials,
    color: w.color,
    active: w.active,
  }))

  function workloadSeverity(active: number): { label: string; severity: 'neutral' | 'warn' | 'crit' } {
    if (active === 0) return { label: 'sem demanda', severity: 'neutral' }
    if (active <= 4) return { label: 'saudável', severity: 'neutral' }
    if (active === 5) return { label: 'atenção', severity: 'warn' }
    return { label: 'sobrecarga', severity: 'crit' }
  }
  const nativeCards: MuralNativeCard[] = [
    { id: 'po:ready', value: `${coverageReady}%`, label: 'Cobertura Ready', sub: 'pts prontos ÷ velocity', disclaimer: 'pontos prontos ÷ velocidade média da sprint', miniViz: <MiniBarChart data={[{label:'S10',value:55},{label:'S11',value:62},{label:'S12',value:70},{label:'S13',value:coverageReady,current:true}]} />, onClick: () => onNav('list') },
    { id: 'po:backlog', value: `${backlogHealth}%`, label: 'Saúde do Backlog', sub: 'itens saudáveis ÷ avaliáveis', disclaimer: 'itens saudáveis ÷ total de itens avaliáveis', color: backlogHealth < 60 ? T.warn : T.success, alert: backlogHealth < 60, miniViz: <MiniSparkline data={[{label:'S10',value:80},{value:77},{value:75},{label:'S13',value:backlogHealth}]} color={backlogHealth < 60 ? '#ef4444' : '#34d399'} />, onClick: () => onNav('list') },
    { id: 'po:progress', value: `${funcProgress || 68}%`, label: 'Progresso Funcional', sub: `${doneSprint}/${sprint14Items.length || 1} aceitos`, disclaimer: 'considera critério de aceite, não só status Done', miniViz: <BurndownChart variant="thumbnail" sprintTotal={totalSprintPts} sprintRemaining={totalSprintPts - poPtDone} />, onClick: () => onNav('project') },
    { id: 'po:msgs', value: unreadCount > 0 ? String(unreadCount) : '0', label: 'Msgs do Cliente', sub: unreadCount > 0 ? 'não lidas — ação necessária' : 'sem pendências', disclaimer: 'mensagens de clientes recebidas não lidas', color: unreadCount > 0 ? T.accent : T.text3, alert: unreadCount > 0, miniViz: <MiniSparkline data={[{label:'D-5',value:2},{value:1},{value:3},{value:2},{value:1},{label:'Hoje',value:unreadCount}]} color={unreadCount > 0 ? '#3b82f6' : '#6b7280'} />, onClick: () => onNav('client-messages') },
  ]

  return (
    <>
      {chartModal}
      {drawerItem && <WorkItemDetailDrawer item={drawerItem} onClose={closeDrawer} onNav={onNav} />}
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="product-owner" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="1fr 1fr">
        <WorkQueue title="Backlog com Alertas" items={alertItems} onOpen={openDrawer}
          onViewAll={() => onNav('navigator')}
          emptyMsg="Backlog saudável — nenhum alerta crítico." />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <WorkQueue title="Ready para Próxima Sprint" items={readyItems} onOpen={openDrawer}
            onViewAll={() => onNav('list')} maxItems={3}
            emptyMsg="Nenhum item ready. Refine o backlog." />

          <ClientFeedCard poId="u_po" tenantId={MOCK_TENANT.tenant_id} />

          <SCard title="Time Atuando no Projeto">
            {team.length === 0 ? (
              <EmptyState message="Nenhuma demanda atribuída ainda." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {team.map(m => {
                  const tag = workloadSeverity(m.active)
                  return (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Av initials={m.initials} color={m.color} size={22} />
                      <span style={{ flex: 1, fontSize: 12, color: T.text1 }}>{m.name}</span>
                      <span style={{ fontSize: 10, color: T.text3 }}>{m.active}</span>
                      <ConditionalTag label={tag.label} severity={tag.severity} />
                    </div>
                  )
                })}
              </div>
            )}
          </SCard>
        </div>
        <CompositionGrid dashId="product-owner" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── 6. SCRUM MASTER ─────────────────────────────────────────────────────────
function ScrumMasterPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const { drawerItem, openDrawer, closeDrawer } = useDrawer()
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const blocked = applyFilters(byProjects(getBlockedItems(), selProj), filters)
  const sprint14 = applyFilters(byProjects(getSprintItems(liveCurrentSprintName() ?? undefined), selProj), filters)
  const parados = sprint14.filter(w => w.status === 'blocked' || (w.days_blocked ?? 0) >= 2)

  const aging = [
    { col: 'Em Dev',     avg: 2.1 },
    { col: 'Em Revisão', avg: 4.3 },
    { col: 'Em Teste',   avg: 3.8 },
  ]
  const cerimonias = [
    { name: 'Daily Standup',    data: 'Hoje 09h',    status: 'pendente' },
    { name: 'Sprint Review',    data: 'Sex 16h',     status: 'pendente' },
    { name: 'Retrospectiva',    data: 'Amanhã 14h',  status: 'pendente' },
    { name: 'Sprint Planning',  data: '28 jul 10h',  status: 'planejado' },
  ]

  const sprintHealth  = sprint14.length > 0 ? Math.round(((sprint14.length - parados.length) / sprint14.length) * 100) : 0
  const smPtTotal     = sprint14.reduce((s, w) => s + (w.points ?? 0), 0) || 38
  const smPtDone      = sprint14.filter(w => w.status === 'done').reduce((s, w) => s + (w.points ?? 0), 0)

  const nativeCards: MuralNativeCard[] = [
    { id: 'sm:health', value: `${sprintHealth || 62}%`, label: 'Saúde da Sprint', help: 'Velocity = pontos concluídos por sprint. Burndown = pontos restantes ao longo da sprint.', sub: `${parados.length} parados`, disclaimer: '% de conclusão em relação à meta da sprint', color: T.warn, alert: true, miniViz: <BurndownChart variant="thumbnail" sprintTotal={smPtTotal} sprintRemaining={smPtTotal - smPtDone} />, onClick: () => onNav('project') },
    { id: 'sm:blocked', value: String(blocked.length), label: 'Impedimentos', sub: 'ativos', disclaimer: 'impedimentos formais sem resolução registrada', color: T.crit, alert: true, miniViz: <MiniSparkline data={[{label:'S8',value:3},{value:5},{value:4},{value:6},{value:3},{label:'S13',value:blocked.length}]} color="#ef4444" />, onClick: () => onNav('list') },
    { id: 'sm:goal', value: '⚠', label: 'Sprint Goal', help: 'Objetivo único que norteia a prioridade da sprint.', sub: '2 itens críticos parados', disclaimer: 'itens que ameaçam atingir o objetivo da sprint', color: T.warn, miniViz: <MiniBarChart data={[{label:'S10',value:3},{label:'S11',value:2},{label:'S12',value:1},{label:'S13',value:2,current:true}]} showAvg={false} />, onClick: () => onNav('project') },
    { id: 'sm:wip', value: '6', label: 'WIP Atual', help: 'Demandas em andamento ao mesmo tempo. Acima do limite acordado indica gargalo.', sub: 'limite: 5 — excedido', disclaimer: 'itens em andamento vs. limite acordado pelo time', color: T.crit, alert: true, miniViz: <MiniSparkline data={[{label:'S10',value:4},{value:5},{value:6},{label:'S13',value:6}]} color="#ef4444" />, onClick: () => onNav('project') },
  ]

  return (
    <>
      {drawerItem && <WorkItemDetailDrawer item={drawerItem} onClose={closeDrawer} onNav={onNav} />}
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="scrum-master" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="1fr 1fr">
        <WorkQueue title="Impedimentos por Responsável" items={blocked} onOpen={openDrawer}
          showDaysBlocked onViewAll={() => onNav('list')}
          emptyMsg="Nenhum impedimento ativo. 🟢" />

        <SCard title="Itens Parados + Aging WIP" help="Há quantos dias cada demanda está parada na coluna atual.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {parados.length === 0
              ? <EmptyState message="Nenhum item parado." />
              : parados.map(p => (
                  <div key={p.id} onClick={() => openDrawer(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgPage, borderRadius: 6, padding: '7px 10px', cursor: 'pointer' }}>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.text3, width: 52 }}>{p.key}</span>
                    <span style={{ flex: 1, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.title}</span>
                    {p.days_blocked && <ConditionalTag label={`${p.days_blocked}d`} severity={p.days_blocked >= 3 ? 'crit' : 'warn'} />}
                    <StatusBadge status={p.status} />
                  </div>
                ))
            }
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text2, marginBottom: 8 }}>Aging médio por coluna</div>
            {aging.map(a => (
              <div key={a.col} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T.text2, width: 80, flexShrink: 0 }}>{a.col}</span>
                <div style={{ flex: 1 }}><ProgressBar pct={(a.avg / 7) * 100} color={a.avg > 3 ? T.crit : T.warn} /></div>
                <span style={{ fontSize: 10, color: T.text3, width: 30, flexShrink: 0 }}>{a.avg}d</span>
              </div>
            ))}
          </div>
        </SCard>

        <ColSpan>
          <SCard title="Cerimônias & Ações de Facilitação">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {cerimonias.map(c => (
                <div key={c.name} style={{ background: T.bgPage, borderRadius: 8, padding: '12px 14px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text1 }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>{c.data}</div>
                  <div style={{ marginTop: 8 }}>
                    <ConditionalTag label={c.status === 'pendente' ? 'Pendente' : 'Planejado'} severity={c.status === 'pendente' ? 'info' : 'neutral'} />
                  </div>
                </div>
              ))}
            </div>
          </SCard>
        </ColSpan>

        <ColSpan>
          <ClientFeedCard tenantId={MOCK_TENANT.tenant_id} />
        </ColSpan>
        <CompositionGrid dashId="scrum-master" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── 7. TECH LEAD ─────────────────────────────────────────────────────────────
function TechLeadPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const { drawerItem, openDrawer, closeDrawer } = useDrawer()
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const inReview = applyFilters(
    byProjects(liveItems().filter(w => w.status === 'in-review' || w.type === 'bug'), selProj),
    filters
  )

  const nf = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const deliveryRows = liveAggregates()?.deliveryRows ?? []
  const scopedRows = selProj.size > 0 ? deliveryRows.filter(r => selProj.has(r.projectId)) : deliveryRows
  const dm = computeDeliveryMetrics(scopedRows)
  const entrega = [
    {
      name: 'Lead Time médio',
      value: dm.leadTimeDias != null ? `${nf(dm.leadTimeDias)} dias` : '—',
      sub: dm.leadTimeDias != null ? 'Do início da demanda até a conclusão — quanto menor, melhor.' : 'sem dados suficientes ainda',
      alert: dm.leadTimeDias != null && dm.leadTimeDias > 14,
    },
    {
      name: 'Vazão',
      value: dm.vazaoSemana != null ? `${nf(dm.vazaoSemana)}/semana` : '—',
      sub: dm.vazaoSemana != null ? 'Demandas concluídas por semana — quanto maior, melhor.' : 'sem dados suficientes ainda',
      alert: dm.vazaoSemana != null && dm.vazaoSemana < 1,
    },
    {
      name: 'Cycle Time médio',
      value: dm.cycleTimeDias != null ? `${nf(dm.cycleTimeDias)} dias` : '—',
      sub: dm.cycleTimeDias != null ? 'Tempo em execução ativa (Em andamento → Concluído).' : 'sem dados suficientes ainda',
      alert: dm.cycleTimeDias != null && dm.cycleTimeDias > 7,
    },
    {
      name: '% de Retrabalho (Bugs)',
      value: dm.taxaBugsPct != null ? `${nf(dm.taxaBugsPct)}%` : '—',
      sub: dm.taxaBugsPct != null ? 'Proporção de demandas que são correção — quanto menor, melhor.' : 'sem dados suficientes ainda',
      alert: dm.taxaBugsPct != null && dm.taxaBugsPct > 20,
    },
  ]

  const divida = [
    { area: 'Cobertura de testes',  pct: 74, meta: 80 },
    { area: 'TODOs no código',      pct: 18, meta: 5  },
    { area: 'Deps desatualizadas',  pct: 35, meta: 10 },
  ]

  const { openChart: openTLChart, chartModal: tlChartModal } = useChartModal()
  const critBugs = liveItems().filter(w => w.type === 'bug' && (w.priority === 'critical' || w.priority === 'high')).length

  const nativeCards: MuralNativeCard[] = [
    { id: 'tl:health', value: '74%', label: 'Saúde Técnica', sub: 'cobertura de testes', disclaimer: 'score composto de cobertura, débito e estabilidade', color: T.warn, miniViz: <MiniBarChart data={[{label:'S8',value:70},{label:'S9',value:72},{label:'S10',value:69},{label:'S11',value:73},{label:'S12',value:71},{label:'S13',value:74,current:true}]} />, onClick: () => openTLChart('health') },
    { id: 'tl:bugs', value: String(critBugs), label: 'Bugs Críticos', sub: 'em prod', disclaimer: 'bugs P0/P1 bloqueando entrega ou em produção', color: T.crit, alert: true, miniViz: <MiniSparkline data={[{label:'S8',value:8},{value:6},{value:7},{value:5},{value:4},{label:'S13',value:critBugs}]} color="#ef4444" />, onClick: () => openTLChart('bugs') },
    { id: 'tl:deploys', value: '4', label: 'Deploys/semana', sub: '+2 vs semana ant.', disclaimer: 'frequência de deploy — métrica DORA', color: T.success, miniViz: <MiniBarChart data={[{label:'S-5',value:3},{label:'S-4',value:4},{label:'S-3',value:3},{label:'S-2',value:5},{label:'S-1',value:4},{label:'Atual',value:4,current:true}]} />, onClick: () => onNav('reports') },
    { id: 'tl:errors', value: '0.8%', label: 'Error Rate', sub: 'meta: <0.5%', disclaimer: 'taxa de erro em produção nas últimas 24h', color: T.warn, alert: true, miniViz: <MiniSparkline data={[{label:'D-5',value:0.4},{value:0.5},{value:0.6},{value:0.7},{value:0.8},{label:'Hoje',value:0.8}]} color="#f5a524" />, onClick: () => onNav('reports') },
  ]

  return (
    <>
      {tlChartModal}
      {drawerItem && <WorkItemDetailDrawer item={drawerItem} onClose={closeDrawer} onNav={onNav} />}
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="tech-lead" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="1fr 1fr">
        <WorkQueue title="Gargalos de PRs / Issues em Revisão" items={inReview} onOpen={openDrawer}
          onViewAll={() => onNav('list')} emptyMsg="Nenhum gargalo no momento." />

        <SCard
          title="Métricas de Entrega"
          helpTitle="Métricas de Entrega"
          help="Indicadores calculados a partir das próprias demandas do projeto (lead time, vazão, cycle time e retrabalho). Não dependem de integração com CI/deploy."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {entrega.map(d => (
              <div key={d.name} style={{ background: T.bgPage, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: d.value === '—' ? T.text3 : d.alert ? T.warn : T.success }}>{d.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text2, marginTop: 3 }}>{d.name}</div>
                <div style={{ fontSize: 10, color: T.text3, marginTop: 4, lineHeight: 1.4 }}>{d.sub}</div>
              </div>
            ))}
          </div>
        </SCard>


        <ColSpan>
          <SCard title="Dívida Técnica / Saúde do Código">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              {divida.map(d => (
                <div key={d.area}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: T.text2 }}>{d.area}</span>
                    <span style={{ fontSize: 10, color: d.pct > d.meta ? T.crit : T.success }}>{d.pct}% (meta {d.meta}%)</span>
                  </div>
                  <ProgressBar pct={d.pct} color={d.pct > d.meta ? T.crit : T.success} />
                </div>
              ))}
            </div>
          </SCard>
        </ColSpan>

        <ColSpan>
          <ClientFeedCard tenantId={MOCK_TENANT.tenant_id} />
        </ColSpan>
        <CompositionGrid dashId="tech-lead" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── 8. DEV ───────────────────────────────────────────────────────────────────
function DevPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const { drawerItem, openDrawer, closeDrawer } = useDrawer()
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const { activeUser } = useSession()
  const mine = (w: WorkItem) => w.assignee?.name === activeUser.name

  const myItems = applyFilters(
    byProjects(liveItems().filter(mine), selProj),
    filters
  ).sort((a, b) => {
    const order: Record<string, number> = { blocked: 0, 'in-review': 1, 'in-progress': 2, testing: 3, todo: 4, backlog: 5 }
    return (order[a.status] ?? 9) - (order[b.status] ?? 9)
  })
  const blocked = applyFilters(byProjects(getBlockedItems(), selProj), filters).filter(mine)

  const recent = [
    { label: 'Merge PR #280 (fix: ordenação)', date: 'há 4h',   color: T.success },
    { label: 'ALT-143 movida para Bloqueado',  date: 'há 1h',   color: T.crit },
    { label: 'Comentário em ALT-141',          date: 'há 2h',   color: T.accent },
  ]

  const nativeCards: MuralNativeCard[] = [
    { id: 'dev:items', value: String(myItems.length), label: 'Meus Itens Ativos', sub: '1 bloqueado', disclaimer: 'tarefas atribuídas a mim nesta sprint', miniViz: <MiniBarChart data={[{label:'S10',value:12},{label:'S11',value:14},{label:'S12',value:11},{label:'S13',value:myItems.length,current:true}]} showAvg={false} />, onClick: () => onNav('list') },
    { id: 'dev:late', value: '1', label: 'Atrasados', sub: 'BUG-38 vence hoje', disclaimer: 'itens com prazo hoje ou já vencido', color: T.crit, alert: true, miniViz: <MiniSparkline data={[{label:'S10',value:0},{value:1},{value:2},{value:1},{value:1},{label:'S13',value:1}]} color="#ef4444" />, onClick: () => onNav('list') },
    { id: 'dev:blocked', value: String(blocked.length), label: 'Meus Bloqueados', sub: '', disclaimer: 'minhas tarefas aguardando desbloqueio externo', color: T.warn, alert: true, miniViz: <MiniSparkline data={[{label:'S10',value:1},{value:0},{value:2},{label:'S13',value:blocked.length}]} color="#f5a524" />, onClick: () => onNav('list') },
    { id: 'dev:prs', value: '2', label: 'PRs Abertos', sub: '1 precisa de ação', disclaimer: 'pull requests abertos nos quais estou envolvido', color: T.accent, miniViz: <MiniBarChart data={[{label:'S-4',value:1},{label:'S-3',value:3},{label:'S-2',value:2},{label:'Atual',value:2,current:true}]} showAvg={false} />, onClick: () => onNav('project') },
  ]

  const bottomCardBody = { justifyContent: 'center' as const, overflowY: 'auto' as const, minHeight: 180 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {drawerItem && <WorkItemDetailDrawer item={drawerItem} onClose={closeDrawer} onNav={onNav} />}
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="dev" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />

      <SprintDonutCard sprintName="Minha Fila Ativa — Sprint 14" done={8} total={16} items={myItems} onOpen={openDrawer} onViewSprint={() => onNav('project')} />

      <Grid cols="1fr 1fr" gap={16}>
        <WorkQueue title="Meus Bloqueados" items={blocked} onOpen={openDrawer} showDaysBlocked
          emptyMsg="Nenhum item bloqueado." style={{ display: 'flex', flexDirection: 'column' }} bodyStyle={bottomCardBody} />

        <SCard title="Atividade Recente" style={{ display: 'flex', flexDirection: 'column' }} bodyStyle={bottomCardBody}>
          <ActivityTimeline events={recent} />
        </SCard>
      </Grid>

      <ClientFeedCard tenantId={MOCK_TENANT.tenant_id} />
      <CompositionGrid dashId="dev" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
    </div>
  )
}

// ─── 9. UX / UI ──────────────────────────────────────────────────────────────
function UxPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const { drawerItem, openDrawer, closeDrawer } = useDrawer()
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const designItems = applyFilters(
    byProjects(liveItems().filter(w => w.squad_id === 'squad_design' || (w.tags ?? []).some(t => ['design', 'handoff', 'frontend'].includes(t))), selProj),
    filters
  )

  const validacoes = [
    { item: 'Board Kanban v2',   feedback: 'Aprovado pelo PO',           status: 'in-review' as const, color: T.success },
    { item: 'Modal de criação',  feedback: 'Dev devolveu — acessibilidade', status: 'blocked'  as const, color: T.crit  },
    { item: 'Filtros avançados', feedback: 'Aguardando usuário teste',   status: 'testing'  as const, color: T.warn   },
  ]
  const dsAlerts = [
    { component: 'Button',  issue: 'Variante ghost ausente no tema escuro' },
    { component: 'Badge',   issue: 'Tamanho inconsistente com Figma' },
  ]

  const nativeCards: MuralNativeCard[] = [
    { id: 'ux:flows', value: '8', label: 'Fluxos em Design', sub: '3 projetos', disclaimer: 'fluxos com trabalho de design em progresso', miniViz: <MiniBarChart data={[{label:'S10',value:5},{label:'S11',value:7},{label:'S12',value:6},{label:'S13',value:8,current:true}]} showAvg={false} />, onClick: () => onNav('list') },
    { id: 'ux:prototypes', value: '3', label: 'Protótipos p/ Val.', sub: 'aguardando PO/usuário', disclaimer: 'protótipos aguardando feedback de usuário ou PO', color: T.accent, miniViz: <MiniSparkline data={[{label:'S10',value:1},{value:2},{value:4},{label:'S13',value:3}]} color="#3b82f6" />, onClick: () => onNav('list') },
    { id: 'ux:pending', value: '4', label: 'Pendências Críticas', sub: '1 acessibilidade', disclaimer: 'fluxos sem spec, protótipo ou validação completa', color: T.crit, alert: true, miniViz: <MiniSparkline data={[{label:'S10',value:6},{value:5},{value:5},{label:'S13',value:4}]} color="#ef4444" />, onClick: () => onNav('list') },
    { id: 'ux:handoff', value: '1', label: 'Handoff Pronto', sub: 'Dashboard por Papel', disclaimer: 'entregas de design prontas para implementação', color: T.success, miniViz: <MiniBarChart data={[{label:'S10',value:0},{label:'S11',value:2},{label:'S12',value:1},{label:'S13',value:1,current:true}]} showAvg={false} />, onClick: () => onNav('list') },
  ]

  return (
    <>
      {drawerItem && <WorkItemDetailDrawer item={drawerItem} onClose={closeDrawer} onNav={onNav} />}
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="ux" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="1fr 1fr">
        <WorkQueue title="Fila de Design Ativa" items={designItems} onOpen={openDrawer}
          onViewAll={() => onNav('list')} emptyMsg="Fila de design vazia." />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SCard title="Design QA / Validação">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {validacoes.map(v => (
                <div key={v.item} style={{ background: T.bgPage, borderRadius: 7, padding: '9px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: T.text1 }}>{v.item}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>{v.feedback}</div>
                </div>
              ))}
            </div>
          </SCard>

          <SCard title="Design System — Inconsistências">
            {dsAlerts.length === 0
              ? <EmptyState message="Design System consistente. ✅" />
              : dsAlerts.map(a => (
                  <div key={a.component} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <ConditionalTag label={a.component} severity="info" />
                    <span style={{ fontSize: 11, color: T.text2 }}>{a.issue}</span>
                  </div>
                ))
            }
          </SCard>
        </div>
        <CompositionGrid dashId="ux" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── 10. QA ──────────────────────────────────────────────────────────────────
function QaPanel({ onNav }: { onNav: (v: string, targetId?: string) => void }) {
  const { drawerItem, openDrawer, closeDrawer } = useDrawer()
  const [filters, setFilters] = useFilters()
  const [selProj, setSelProj] = useProjSel()
  const testing = applyFilters(byProjects(getTestingItems(), selProj), filters)
  const bugs    = applyFilters(byProjects(liveItems().filter(w => w.type === 'bug'), selProj), filters)
  const cobertura = [
    { criterio: 'Critérios de aceite validados', pct: 68 },
    { criterio: 'Casos de teste documentados',   pct: 45 },
    { criterio: 'Regressão coberta',             pct: 82 },
  ]

  const { openChart: openQAChart, chartModal: qaChartModal } = useChartModal()
  const critAndHighBugs = bugs.filter(b => b.priority === 'critical' || b.priority === 'high').length

  const nativeCards: MuralNativeCard[] = [
    { id: 'qa:queue', value: String(testing.length), label: 'Aguardando Teste', sub: 'Ready for QA', disclaimer: 'itens em fila de QA ou em homologação ativa', miniViz: <MiniBarChart data={[{label:'S10',value:8},{label:'S11',value:10},{label:'S12',value:7},{label:'S13',value:testing.length,current:true}]} showAvg={false} />, onClick: () => onNav('list') },
    { id: 'qa:bugs', value: String(critAndHighBugs), label: 'Bugs Críticos', sub: critAndHighBugs > 0 ? 'requer atenção' : 'tudo ok', disclaimer: 'bugs P0/P1 bloqueando entrega da sprint', color: T.crit, alert: critAndHighBugs > 0, miniViz: <MiniSparkline data={[{label:'S8',value:9},{value:7},{value:8},{value:6},{value:5},{label:'S13',value:critAndHighBugs}]} color="#ef4444" />, onClick: () => openQAChart('bugs') },
    { id: 'qa:rejection', value: '28%', label: 'Taxa de Rejeição', sub: 'meta: <15%', disclaimer: '% de itens devolvidos ao Dev pelo QA', color: T.warn, alert: true, miniViz: <MiniSparkline data={[{label:'S8',value:18},{value:20},{value:22},{value:25},{value:26},{label:'S13',value:28}]} color="#f5a524" />, onClick: () => openQAChart('bugs') },
    { id: 'qa:evidence', value: '6', label: 'Evidências Pendentes', sub: 'dev não submeteu', disclaimer: 'bugs sem evidência de reprodução registrada', color: T.warn, miniViz: <MiniBarChart data={[{label:'S10',value:4},{label:'S11',value:7},{label:'S12',value:5},{label:'S13',value:6,current:true}]} showAvg={false} />, onClick: () => onNav('list') },
  ]

  return (
    <>
      {qaChartModal}
      {drawerItem && <WorkItemDetailDrawer item={drawerItem} onClose={closeDrawer} onNav={onNav} />}
      <ProjFilterRow selected={selProj} onChange={setSelProj} />
      <UnifiedMural dashId="qa" tenantId={MOCK_TENANT.tenant_id} nativeCards={nativeCards} onNav={onNav} />

      <div style={{ marginTop: 4 }}>
        <FilterBar filters={filters} onChange={setFilters} projects={PROJECTS()} squads={SQUADS()} sprints={SPRINTS()} />
      </div>

      <Grid cols="1fr 1fr">
        <SCard title="Fila de Execução de Testes">
          {testing.length === 0
            ? <EmptyState message="Nenhum item aguardando teste." action={{ label: 'Ver board', onClick: () => onNav('project') }} />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {testing.map(item => (
                  <div key={item.id} style={{ background: T.bgPage, borderRadius: 7, padding: '9px 12px', cursor: 'pointer' }} onClick={() => openDrawer(item)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.text3, width: 52 }}>{item.key}</span>
                      <span style={{ flex: 1, fontSize: 12, color: T.text1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                      <button onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: T.success, background: `${T.success}14`, border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Aprovar</button>
                      <button onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: T.crit,    background: `${T.crit}14`,    border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Reprovar</button>
                      <button onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: T.text3,   background: `${T.text3}14`,   border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Solicitar evidência</button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </SCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <WorkQueue title="Bugs para Reteste" items={bugs.filter(b => b.status === 'testing')} onOpen={openDrawer}
            onViewAll={() => onNav('list')} emptyMsg="Nenhum bug aguardando reteste." />

          <SCard title="Cobertura / Critérios Validados">
            {cobertura.map(c => (
              <div key={c.criterio} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: T.text2 }}>{c.criterio}</span>
                  <span style={{ fontSize: 10, color: c.pct >= 70 ? T.success : T.warn }}>{c.pct}%</span>
                </div>
                <ProgressBar pct={c.pct} color={c.pct >= 70 ? T.success : T.warn} />
              </div>
            ))}
          </SCard>
        </div>
        <CompositionGrid dashId="qa" tenantId={MOCK_TENANT.tenant_id} selProj={selProj} sprintFilter={filters.sprint} />
      </Grid>
    </>
  )
}

// ─── Panel dispatcher ────────────────────────────────────────────────────────
function DashboardContent({ type, onNav, onInvite }: { type: DashboardType; onNav: (v: string, targetId?: string) => void; onInvite?: () => void }) {
  // Subscribes every panel below to the shared Supabase aggregate store.
  const { data, loading, error, reload } = useLiveDashboard()

  if (error) {
    return (
      <div style={{ padding: 20, borderRadius: 10, background: `${T.crit}14`, border: `1px solid ${T.crit}44`, color: T.crit, fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1 }}>{error}</span>
        <button onClick={reload} style={{ fontSize: 12, color: T.crit, background: 'none', border: `1px solid ${T.crit}55`, borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!data && loading) return <LoadingState rows={5} />

  switch (type) {
    case 'admin':           return <AdminPanel          onNav={onNav} onInvite={onInvite} />
    case 'pmo':             return <PmoPanel            onNav={onNav} />
    case 'project-manager': return <ProjectManagerPanel onNav={onNav} />
    case 'product-manager': return <ProductManagerPanel onNav={onNav} />
    case 'product-owner':   return <ProductOwnerPanel   onNav={onNav} />
    case 'scrum-master':    return <ScrumMasterPanel    onNav={onNav} />
    case 'tech-lead':       return <TechLeadPanel       onNav={onNav} />
    case 'dev':             return <DevPanel            onNav={onNav} />
    case 'ux':              return <UxPanel             onNav={onNav} />
    case 'qa':              return <QaPanel             onNav={onNav} />
  }
}


// ─── Add Card Modal (reports + hidden native cards) ───────────────────────────
function AddCardModal({ availableReports, hiddenNative, onAddReport, onRestoreNative, onClose, mode = 'mural' }: {
  availableReports: ReportEntry[]
  hiddenNative: MuralNativeCard[]
  onAddReport: (cardId: string) => void
  onRestoreNative: (id: string) => void
  onClose: () => void
  mode?: 'mural' | 'grid'
}) {
  const [search, setSearch] = useState('')
  const q = search.toLowerCase()
  const filteredReports = availableReports.filter(r =>
    r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
  )
  const filteredNative = hiddenNative.filter(c => c.label.toLowerCase().includes(q))
  const isEmpty = filteredReports.length === 0 && filteredNative.length === 0
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1300, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1301, width: 'min(720px, 95vw)', maxHeight: '84vh',
        background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 16,
        boxShadow: T.shadowModal, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>
              {mode === 'grid' ? 'Adicionar card ao board' : 'Adicionar card ao mural'}
            </div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
              {mode === 'grid' ? 'Escolha um relatório para o board de composição' : 'Inclua relatórios ou restaure cards removidos'}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, background: `${T.text3}14`, border: 'none', color: T.text2, cursor: 'pointer', fontSize: 18, lineHeight: '30px', textAlign: 'center' }}>×</button>
        </div>
        <div style={{ padding: '10px 20px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgPage, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 12px' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="4" stroke={T.text3} strokeWidth="1.2"/><path d="M9 9l2 2" stroke={T.text3} strokeWidth="1.2" strokeLinecap="round"/></svg>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && onClose()}
              placeholder="Buscar card…"
              style={{ background: 'none', border: 'none', outline: 'none', color: T.text1, fontSize: 13, flex: 1 }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {isEmpty ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: T.text3, fontSize: 13 }}>
              {availableReports.length === 0 && hiddenNative.length === 0
                ? (mode === 'grid' ? 'Todos os relatórios já estão no board.' : 'Todos os cards já estão no mural.')
                : 'Nenhum card encontrado.'}
            </div>
          ) : (
            <>
              {/* Removed native cards */}
              {filteredNative.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Cards removidos
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {filteredNative.map(c => (
                      <button key={c.id} onClick={() => onRestoreNative(c.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12, color: T.text1, background: T.bgPage,
                        border: `1px solid ${T.border}`, borderRadius: 8,
                        padding: '7px 14px', cursor: 'pointer', transition: 'all 0.12s',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.accent; (e.currentTarget as HTMLButtonElement).style.color = T.accent }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.color = T.text1 }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Report cards */}
              {filteredReports.length > 0 && (
                <div>
                  {filteredNative.length > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                      Relatórios & Insights
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {filteredReports.map(r => (
                      <div key={r.id} style={{ background: T.bgPage, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ minHeight: 62, borderBottom: `1px solid ${T.border}`, padding: '10px 12px', background: T.bgSurface }}>
                          <ReportKpiPreview entry={r} compact />
                        </div>
                        <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text1 }}>{r.title}</div>
                          <div style={{ fontSize: 10, color: T.text3, marginTop: 2, marginBottom: 10, lineHeight: 1.4, flex: 1 }}>{r.subtitle}</div>
                          <button onClick={() => onAddReport(r.id)} style={{
                            width: '100%', fontSize: 11, fontWeight: 600, color: '#fff',
                            background: T.accent, border: 'none', borderRadius: 6, padding: '6px 0',
                            cursor: 'pointer', transition: 'opacity 0.15s',
                          }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                          >{mode === 'grid' ? '+ Adicionar ao board' : '+ Adicionar ao mural'}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Report card tile ─────────────────────────────────────────────────────────
function ReportCardTile({ slot, onOpen, onDismiss, onNav }: {
  slot: HomeCardSlot
  onOpen: (cardId: string) => void
  onDismiss: (cardId: string) => void
  onNav?: (view: string, targetId?: string) => void
}) {
  const [hov, setHov] = useState(false)
  const [xHov, setXHov] = useState(false)
  const entry = REPORT_REGISTRY[slot.cardId]
  return (
    <div
      onClick={() => { if (entry) navigateToReport(entry, onNav); else onOpen(slot.cardId) }}
      title={entry ? `Abrir ${entry.title} na tela correspondente` : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        background: hov ? T.bgSurface2 : T.bgSurface,
        borderTop:    `1px solid ${hov ? T.accent : T.border}`,
        borderRight:  `1px solid ${hov ? T.accent : T.border}`,
        borderBottom: `1px solid ${hov ? T.accent : T.border}`,
        borderLeft:   `3px solid ${T.accent}`,
        borderRadius: 10, padding: '14px 16px',
        cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}
    >
      {/* Dismiss X */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(slot.cardId) }}
        title="Remover da Home"
        onMouseEnter={() => setXHov(true)}
        onMouseLeave={() => setXHov(false)}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 1,
          width: 22, height: 22, borderRadius: 5, border: 'none',
          background: xHov ? `${T.crit}22` : `${T.text3}18`,
          color: xHov ? T.crit : T.text3,
          cursor: 'pointer', fontSize: 15, lineHeight: '22px', textAlign: 'center',
          transition: 'all 0.12s',
        }}
      >×</button>

      {/* Title row */}
      <div style={{ paddingRight: 28, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>{entry?.title ?? slot.cardId}</span>
          {slot.isUserPinned && (
            <span style={{ fontSize: 9, color: T.accent, background: T.accentDim, border: `1px solid ${T.accentBorder}`, borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
              📌 Meu
            </span>
          )}
        </div>
        {entry && <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{entry.subtitle}</div>}
      </div>

      {/* Real value + type-coherent thumbnail */}
      {entry && (
        <div style={{ borderRadius: 8, background: T.bgPage, padding: '10px 12px', marginBottom: 10 }}>
          <ReportKpiPreview entry={entry} />
        </div>
      )}

      {/* Open chart modal */}
      <button
        onClick={e => { e.stopPropagation(); onOpen(slot.cardId) }}
        style={{
          alignSelf: 'flex-start', fontSize: 11, color: T.accent, background: T.accentDim,
          border: `1px solid ${T.accentBorder}`, borderRadius: 5,
          padding: '3px 9px', cursor: 'pointer',
        }}
      >Ver gráfico →</button>
    </div>
  )
}

// ─── Composition Grid ────────────────────────────────────────────────────────
// Span2-aware grid of assigned report cards for the secondary dashboard area.
// Self-contained: manages its own add modal, dismiss, and real-data props.

/** Scope chip: reflects the project filter actually applied to the report data. */
function ReportScopeChip() {
  const { data } = useReportsData()
  const scoped = data?.scopeProjectIds ?? null
  let label: string
  if (!scoped || scoped.length === 0) label = 'Sem escopo'
  else if (scoped.length === 1) {
    const opts = [...liveProjects(), ...ALLOWED_LIST] as { id: string; name: string }[]
    label = opts.find(p => p.id === scoped[0])?.name ?? '1 projeto'
  } else label = `${scoped.length} projetos`

  return (
    <div style={{
      display: 'inline-block', marginBottom: 6, fontSize: 10, fontWeight: 600,
      color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accent}33`,
      borderRadius: 4, padding: '2px 7px',
    }}>
      Escopo: {label}
    </div>
  )
}

function CompositionGrid({ dashId, tenantId, selProj, sprintFilter }: {
  dashId: DashboardType
  tenantId: string
  selProj?: Set<string>
  sprintFilter?: string
}) {
  const { activeUser } = useSession()
  const [tick, setTick]          = useState(0)
  const [showAddModal, setShowAdd] = useState(false)
  void tick

  const gov       = useReportsGovernance()
  const slots     = getGridCards(tenantId, dashId as AssignmentTarget, activeUser.user_id)
  const gridIds   = new Set(slots.map(s => s.cardId))
  // Só os cards LIBERADOS na tela de Relatórios e Insights podem ser adicionados.
  const available = REPORT_CARDS_LIST.filter(r => !gridIds.has(r.id) && isCardReleased(gov, r.id))
  const canAdd    = available.length > 0

  if (slots.length === 0 && !canAdd) return null

  // Real sprint data for charts that support extra props
  const sprintName    = sprintFilter || (liveCurrentSprintName() ?? undefined)
  const sprintItems   = byProjects(getSprintItems(sprintName), selProj ?? ALL_PROJ_IDS())
  const sprintPtTotal = sprintItems.reduce((s, w) => s + (w.points ?? 0), 0) || 38
  const sprintPtDone  = sprintItems.filter(w => w.status === 'done').reduce((s, w) => s + (w.points ?? 0), 0)

  function handleDismiss(cardId: string) {
    dismissGridCard(tenantId, dashId as AssignmentTarget, cardId, activeUser.user_id)
    setTick(t => t + 1)
  }
  function handleAdd(cardId: string) {
    const entry = REPORT_REGISTRY[cardId]
    if (!entry) return
    pinGridCard(tenantId, dashId as AssignmentTarget, cardId, entry.title, activeUser.user_id)
    setTick(t => t + 1)
    setShowAdd(false)
  }

  return (
    // gridColumn: '1 / -1' spans full width of the parent 2-col Grid
    <div id={`comp-grid-${dashId}`} style={{ gridColumn: '1 / -1', marginTop: 4 }}>
      {showAddModal && (
        <AddCardModal
          availableReports={available}
          hiddenNative={[]}
          onAddReport={handleAdd}
          onRestoreNative={() => {}}
          onClose={() => setShowAdd(false)}
          mode="grid"
        />
      )}

      {/* Board toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Board de Composição
        </span>
        <button
          id={`comp-grid-add-${dashId}`}
          onClick={() => setShowAdd(true)}
          disabled={!canAdd}
          style={{
            fontSize: 11, color: T.accent, background: T.accentDim,
            border: `1px solid ${T.accentBorder}`, borderRadius: 6,
            padding: '4px 10px', cursor: canAdd ? 'pointer' : 'not-allowed',
            opacity: canAdd ? 1 : 0.4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Adicionar card
        </button>
        {slots.length > 0 && (
          <span style={{ fontSize: 10, color: T.text3 }}>{slots.length} card{slots.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Cards — span2-aware responsive grid */}
      {slots.length > 0 ? (
        <div
          className="responsive-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {slots.map(slot => {
            const entry = REPORT_REGISTRY[slot.cardId]
            if (!entry) return null
            // Inject real data props for charts that support them
            const extraProps: Record<string, unknown> = {}
            if (slot.cardId === 'burndown') {
              extraProps.sprintTotal     = sprintPtTotal
              extraProps.sprintRemaining = sprintPtTotal - sprintPtDone
            }
            const Comp = entry.Component as (p: { variant?: 'thumbnail' | 'full' } & Record<string, unknown>) => ReactElement
            return (
              <div
                key={slot.cardId}
                style={{
                  gridColumn: entry.span2 ? '1 / -1' : 'auto',
                  minWidth: 0,
                }}
              >
                <SCard
                  title={entry.title}
                  action={
                    <button
                      title="Remover do board"
                      onClick={() => handleDismiss(slot.cardId)}
                      style={{ fontSize: 11, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      ✕
                    </button>
                  }
                >
                  <div style={{ paddingTop: 4 }}>
                    <ReportScopeChip />
                    <Comp variant="full" {...extraProps} />
                  </div>
                </SCard>
              </div>
            )
          })}
        </div>
      ) : (
        canAdd && (
          <div style={{
            textAlign: 'center', padding: '20px',
            border: `1px dashed ${T.border}`, borderRadius: 10,
            color: T.text3, fontSize: 12,
          }}>
            Nenhum card no board.{' '}
            <button
              onClick={() => setShowAdd(true)}
              style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              + Adicionar card
            </button>
          </div>
        )
      )}
    </div>
  )
}

// ─── Unified Home Mural ───────────────────────────────────────────────────────
// Merges native KPI cards and assigned report cards into one dismissable grid.
function UnifiedMural({ dashId, tenantId, nativeCards, onNav }: {
  dashId: DashboardType
  tenantId: string
  nativeCards: MuralNativeCard[]
  onNav: (v: string, targetId?: string) => void
}) {
  const { activeUser } = useSession()
  const [tick, setTick]               = useState(0)
  const [openChartId, setOpenChartId] = useState<string | null>(null)
  void tick

  const dismissedNativeIds = getDismissedNative(activeUser.user_id, dashId)
  const visibleNative = nativeCards.filter(c => !dismissedNativeIds.has(c.id))

  const target      = dashId as AssignmentTarget
  const reportSlots = getVisibleHomeCards(tenantId, target, activeUser.user_id)
  const totalCount  = visibleNative.length + reportSlots.length

  function handleDismissNative(id: string) {
    dismissNativeCard(activeUser.user_id, dashId, id); setTick(t => t + 1)
  }
  function handleDismissReport(cardId: string) {
    dismissHomeCard(activeUser.user_id, dashId, cardId); setTick(t => t + 1)
  }

  return (
    <>
      {openChartId && <ReportChartModal reportId={openChartId} onClose={() => setOpenChartId(null)} />}

      {/* Mural toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {totalCount > 0 && (
          <span style={{ fontSize: 10, color: T.text3 }}>{totalCount} card{totalCount !== 1 ? 's' : ''} no mural</span>
        )}
        <button onClick={() => onNav('reports')} style={{
          marginLeft: 'auto', fontSize: 11, color: T.accent,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          Ver todos →
        </button>
      </div>

      {/* Unified grid */}
      {totalCount === 0 ? (
        <div style={{
          textAlign: 'center', padding: '28px 20px',
          border: `1px dashed ${T.border}`, borderRadius: 10, color: T.text3, fontSize: 12,
        }}>
          Mural vazio.{' '}
          <button
            onClick={() => document.getElementById(`comp-grid-${dashId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{ marginLeft: 4, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Ver board →
          </button>
        </div>
      ) : (
        <div className="responsive-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12, alignItems: 'stretch', marginBottom: 20,
        }}>
          {visibleNative.map(card => (
            <NativeMuralTile key={card.id} card={card} onDismiss={handleDismissNative} />
          ))}
          {reportSlots.map(slot => (
            <ReportCardTile key={slot.cardId} slot={slot} onOpen={setOpenChartId} onDismiss={handleDismissReport} onNav={onNav} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Inspection user switcher ─────────────────────────────────────────────────
function InspectionSwitcher({ onUserChange }: { onUserChange: () => void }) {
  const [open, setOpen] = useState(false)
  const { activeUser: active, setActiveUser } = useSession()
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        fontSize: 11, color: T.text3, background: `${T.text3}10`,
        border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 10px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>Inspection Mode:</span>
        <strong style={{ color: T.text2 }}>{active.name}</strong>
        <span style={{ color: T.text3 }}>({active.role_context})</span>
        <span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 500,
          background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8,
          boxShadow: T.shadowModal, minWidth: 270, padding: 6,
        }}>
          <div style={{ fontSize: 10, color: T.text3, padding: '4px 10px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Simular usuário</div>
          {MOCK_USERS.map(u => (
            <button key={u.user_id} onClick={() => { setActiveUser(u.user_id); setOpen(false); onUserChange() }} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: u.user_id === active.user_id ? `${T.accent}14` : 'transparent',
            }}>
              <Av initials={u.avatar_initials} color={u.avatar_color} size={24} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: T.text1 }}>{u.name}</div>
                <div style={{ fontSize: 10, color: T.text3 }}>{u.role_context} · {u.assigned_dashboards.length} dash</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Seletor de papéis (usuários multi-papel) ─────────────────────────────────
function RoleSwitcher({ onRoleChange }: { onRoleChange: () => void }) {
  const { availableRoles, roleChoice, setRoleChoice } = useSession()
  const [open, setOpen] = useState(false)
  if (availableRoles.length < 2) return null

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        fontSize: 11, color: T.text2, background: T.bgSurface,
        border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 10px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: T.text3 }}>Papel:</span>
        <strong style={{ color: T.text1 }}>{roleChoiceLabel(roleChoice)}</strong>
        <span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 500,
          background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8,
          boxShadow: T.shadowModal, minWidth: 210, padding: 6,
        }}>
          <div style={{ fontSize: 10, color: T.text3, padding: '4px 10px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Meus papéis
          </div>
          {availableRoles.map((r, i) => (
            <button
              key={r}
              onClick={() => { setRoleChoice(r); setOpen(false); onRoleChange() }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                width: '100%', padding: '7px 10px', borderRadius: 6, border: 'none',
                cursor: 'pointer', textAlign: 'left',
                background: r === roleChoice ? `${T.accent}14` : 'transparent',
                color: r === roleChoice ? T.accent : T.text1, fontSize: 12,
              }}
            >
              <span>{roleChoiceLabel(r)}</span>
              {i === 0 && <span style={{ fontSize: 9, color: T.text3 }}>principal</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tenant storage card ──────────────────────────────────────────────────────
function TenantStorageCard({ show, onNav }: { show: boolean; onNav: (v: string, targetId?: string) => void }) {
  const [data, setData] = useState<TenantStorage | null>(null)

  useEffect(() => {
    if (!show) return
    let alive = true
    fetchTenantStorage(DEFAULT_TENANT_ID).then(d => { if (alive) setData(d) })
    return () => { alive = false }
  }, [show])

  if (!show || !data) return null
  const pct = usagePct(data.usedBytes, data.effectiveBytes)

  return (
    <button onClick={() => onNav('storage')} style={{
      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: 14, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text3 }}>Armazenamento do Tenant</span>
        <span style={{ fontSize: 12, color: T.text1 }}>
          {bytesToHuman(data.usedBytes)} de {bytesToHuman(data.effectiveBytes)} ({pct}%)
        </span>
      </div>
      <UsageBar pct={pct} height={8} />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
interface Props { onNav?: (view: string, targetId?: string) => void; onInvite?: () => void }

export default function DashboardHomePage(props: Props) {
  return (
    <HomeFilterProvider>
      <DashboardHomeScoped {...props} />
    </HomeFilterProvider>
  )
}

/**
 * Escopo de projetos da Home: lista só os projetos visíveis para o perfil
 * (RBAC via boards/project_members) e propaga a seleção ativa para os
 * agregados de relatório, para que todo card reflita o filtro.
 */
function HomeFilterProvider({ children }: { children: ReactNode }) {
  const { activeUser } = useSession()
  useLiveDashboard()
  const perms = useMemo(
    () => (Array.isArray(activeUser.permissions) ? activeUser.permissions : []),
    [activeUser.permissions],
  )
  const tenantWide = can(perms, 'users:manage') || can(perms, 'board:manage')

  const [allowed, setAllowed] = useState<ProjOption[]>([])
  const [loading, setLoading] = useState(true)

  const tenantId = activeUser.tenant_id
  const profileId = activeUser.user_id
  const permKey = perms.join(',')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchAssignedProjects({ tenantId, profileId, permissions: permKey ? permKey.split(',') : [] })
      .then(rows => { if (alive) setAllowed(rows.map(r => ({ id: r.id, name: r.name }))) })
      .catch(() => { if (alive) setAllowed([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tenantId, profileId, permKey])

  const [squads, setSquads] = useState<SquadOption[]>([])
  useEffect(() => {
    let alive = true
    void safeCall('home.squads', () => listSquads(), [] as SquadOption[])
      .then(rows => { if (alive) setSquads(rows) })
    return () => { alive = false }
  }, [tenantId])
  SQUAD_LIST = squads

  ALLOWED_LIST = allowed
  ALLOWED_IDS = allowed.length > 0 ? new Set(allowed.map(p => p.id)) : null
  ALLOWED_TENANT_WIDE = tenantWide

  const allowedKey = allowed.map(p => p.id).join(',')
  const [sel, setSel] = useState<Set<string>>(new Set())

  // Sem seleção explícita (ou escopo recém-carregado) ⇒ todos os permitidos.
  useEffect(() => {
    const ids = allowedKey ? allowedKey.split(',') : []
    setSel(prev => {
      const kept = [...prev].filter(id => ids.includes(id))
      return kept.length > 0 ? new Set(kept) : new Set(ids)
    })
  }, [allowedKey])

  // Escopo efetivo dos agregados: a seleção ativa; sem seleção ⇒ todos os
  // permitidos. Para não-gestão sem projeto atribuído o escopo é [] (vazio),
  // nunca `undefined`, para não vazar dados de todo o tenant.
  const allowedIds = allowed.map(p => p.id)
  const selIds = [...sel].filter(id => allowedIds.includes(id))
  const scopeIds = selIds.length > 0 ? selIds : allowedIds
  const projectIds = scopeIds.length > 0 ? scopeIds : (tenantWide && loading ? undefined : [])
  SCOPE_IDS = projectIds

  return (
    <HomeFilterCtx.Provider value={{ allowed, sel, setSel }}>
      {/* Single shared fetch of the real report aggregates, scoped by the filter. */}
      <ReportsDataProvider projectIds={projectIds}>
        {children}
      </ReportsDataProvider>
    </HomeFilterCtx.Provider>
  )
}

function DashboardHomeScoped(props: Props) {
  return <DashboardHomeInner {...props} />
}


function DashboardHomeInner({ onNav, onInvite }: Props) {
  const { activeUser: user } = useSession()
  const [scope, setScope]           = useState<UserScope | null>(null)
  const [activeDashId, setActiveDash] = useState<DashboardType | null>(null)
  const [rev, setRev]               = useState(0)

  useDashboardAssignments(user.name)


  useEffect(() => {
    const s = sessionScope(user)
    setScope(s)
    setActiveDash(s?.default_dashboard.dashboard_id as DashboardType ?? null)
  }, [rev, user.user_id, user.role_context])

  const activeDef = activeDashId ? DASHBOARD_CATALOG[activeDashId] : null

  if (!scope || !activeDashId || !activeDef) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <LoadingState rows={4} />
        <span style={{ fontSize: 12, color: T.text3 }}>Carregando dashboard...</span>
      </div>
    )
  }
  const assignedDefs = (scope.assigned_dashboards ?? []).map(d => ({
    dashboard_id: d.dashboard_id,
    label: DASHBOARD_CATALOG[d.dashboard_id as DashboardType]?.label ?? d.dashboard_id,
  }))
  const navigate = (view: string) => onNav?.(view)

  return (
    <div style={{ padding: 24, minHeight: '100%', background: T.bgPage }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: T.accent, background: `${T.accent}18`,
              border: `1px solid ${T.accent}33`, borderRadius: 4, padding: '2px 7px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{MOCK_TENANT.name}</span>
            <span style={{ color: T.border2, fontSize: 14 }}>/</span>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text1 }}>
              {activeDef.label}
            </h1>
          </div>
          {/* Central question */}
          <p style={{ margin: '6px 0 0 0', fontSize: 13, color: T.text2, fontStyle: 'italic', borderLeft: `2px solid ${T.accent}`, paddingLeft: 10 }}>
            {activeDef.question}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <RoleSwitcher onRoleChange={() => { setScope(null); setActiveDash(null); setRev(r => r + 1) }} />
          {INSPECTION_MODE_ENABLED && (
            <InspectionSwitcher onUserChange={() => { setScope(null); setActiveDash(null); setRev(r => r + 1) }} />
          )}
        </div>
      </div>

      {/* ── Scope debug pills ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 20 }}>
        {[`Papel: ${scope.role_context}`, `Usuário: ${user.name}`, `Módulos: ${(scope.modules_allowed ?? []).join(' · ')}`].map(t => (
          <span key={t} style={{ fontSize: 9, color: T.text3, background: `${T.text3}0A`, border: `1px solid ${T.border}`, borderRadius: 4, padding: '1px 7px' }}>{t}</span>
        ))}
      </div>

      {/* ── Tenant storage card (só para o Admin Master / dono do tenant) ───── */}
      <TenantStorageCard show={scope.permissions?.includes('*') ?? false} onNav={navigate} />

      {/* ── Dashboard content (includes unified mural at top of each panel) ── */}
      <DashboardContent type={activeDashId} onNav={navigate} onInvite={onInvite} />
    </div>
  )
}
