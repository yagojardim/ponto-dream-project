import { useState, useEffect, useCallback, useMemo } from 'react'
import { Avatar } from './ds/Avatar'
import { T } from './ds/tokens'
import { MOCK_USERS } from '../data/session'
import { useSession } from '../data/SessionContext'
import { INSPECTION_MODE_ENABLED } from '../lib/auth'
import * as notificationsApi from '../data/db/notifications'
import type { NotificationRow } from '../data/db/notifications'
import { searchGlobal, type SearchResult } from '../data/db/globalSearch'


type View =
  | 'boards-list' | 'modules' | 'timesheet' | 'hours-approval' | 'client-messages' | 'tenant-settings'
  | 'home' | 'foundations' | 'dashboard' | 'project' | 'issue' | 'client' | 'task-drawer' | 'projects-list' | 'gantt' | 'calendar' | 'list' | 'timeline' | 'epics' | 'releases' | 'filters' | 'navigator' | 'reports' | 'automations' | 'config' | 'team' | 'my-tasks' | 'login' | 'role-dashboard' | 'client-access' | 'client-login'
  | 'profile' | 'preferences' | 'storage' | 'feedback'

interface HeaderProps {
  onCreateIssue?: () => void
  currentView:    View
  onViewChange:   (v: string, targetId?: string) => void
  onOpenClientMessages?: (projectId: string) => void
  onOpenHelp?: () => void
}

const viewLabels: Partial<Record<View, string>> = {
  'home':          'Início',
  'foundations':   'Design System',
  'projects-list': 'Projetos & Tarefas',
  'gantt':         'Gráfico Gantt',
  'calendar':      'Calendário',
  'dashboard':     'Dashboard',
  'project':       'Kanban Board',
  'list':          'Lista de Demandas',
  'timeline':      'Timeline / Roadmap',
  'epics':         'Épicos',
  'releases':      'Releases',
  'filters':       'Filtros & Busca',
  'navigator':     'Navegador de Demandas',
  'reports':       'Relatórios & Insights',
  'automations':   'Automações',
  'config':        'Configurações',
  'team':          'Time & Permissões',
  'my-tasks':      'Minha Fila',
  'login':          'Login — Gestão',
  'role-dashboard': 'Dashboard por Papel',
  'client-access':  'Criar Acesso de Cliente',
  'client-login':   'Login — Portal do Cliente',
  'client':        'Portal do Cliente',
  'task-drawer':   'Detalhe da Tarefa',
  'issue':         'Detalhe da Demanda',
}

const ROLE_CONTEXT_LABEL: Record<string, string> = {
  Admin: 'Admin Master', PMO: 'PMO', ProjectManager: 'Project Manager',
  ProductManager: 'Product Manager', ProductOwner: 'Product Owner',
  ScrumMaster: 'Scrum Master', TechLead: 'Tech Lead',
  Dev: 'Dev', UX: 'UX / UI', QA: 'QA',
}

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

function today() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface NotifItem {
  id: string
  icon: string
  text: string
  time: string
  read: boolean
  notifId?: string
  entityType?: string | null
  entityId?: string | null
}

const STATIC_NOTIFICATIONS: NotifItem[] = [
  { id: 'n1', icon: '🔴', text: 'PM-142 bloqueado — aguardando você', time: '2h',  read: false },
  { id: 'n2', icon: '⚡', text: 'Sprint 14 termina em 3 dias',         time: '1d',  read: false },
]

const NOTIF_ICON: Record<string, string> = { comment: '💬', approval: '✅', info: '🔔' }

function rowToNotif(r: NotificationRow): NotifItem {
  return {
    id: r.id,
    icon: NOTIF_ICON[r.type] ?? '🔔',
    text: r.title,
    time: new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    read: r.read,
    notifId: r.id,
    entityType: r.entity_type,
    entityId: r.entity_id,
  }
}

export function Header({ currentView, onViewChange, onCreateIssue, onOpenClientMessages, onOpenHelp }: HeaderProps) {
  const [cmdOpen,    setCmdOpen]    = useState(false)
  const [cmdQuery,   setCmdQuery]   = useState('')
  const [cmdResults, setCmdResults] = useState<SearchResult[]>([])
  const [cmdLoading, setCmdLoading] = useState(false)
  const [cmdIndex,   setCmdIndex]   = useState(-1)
  const [notifOpen,  setNotifOpen]  = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [readStatic, setReadStatic] = useState<Set<string>>(new Set())
  const [rows,       setRows]       = useState<NotificationRow[]>([])
  const [profileId,  setProfileId]  = useState<string | null>(null)

  const { activeUser, setActiveUser, signOut, tenantName } = useSession()
  const rc         = activeUser.role_context
  const rcStyle    = ROLE_CONTEXT_COLOR[rc] ?? { color: T.accent, bg: T.accentDim }
  const rcLabel    = ROLE_CONTEXT_LABEL[rc] ?? rc

  const refresh = useCallback(async (pid: string) => {
    setRows(await notificationsApi.list(pid))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const pid = await notificationsApi.resolveProfileId(activeUser.name)
      if (cancelled || !pid) { setProfileId(null); setRows([]); return }
      setProfileId(pid)
      await notificationsApi.mirrorClientSignals(pid)
      const list = await notificationsApi.list(pid)
      if (!cancelled) setRows(list)
    })()
    return () => { cancelled = true }
  }, [activeUser.name])

  // Debounced global search
  useEffect(() => {
    if (!cmdOpen) return
    const term = cmdQuery.trim()
    if (term.length < 2) {
      setCmdResults([])
      setCmdIndex(-1)
      setCmdLoading(false)
      return
    }
    setCmdLoading(true)
    const t = setTimeout(async () => {
      const res = await searchGlobal(term)
      setCmdResults(res)
      setCmdIndex(res.length > 0 ? 0 : -1)
      setCmdLoading(false)
    }, 200)
    return () => { clearTimeout(t) }
  }, [cmdQuery, cmdOpen])

  // Build merged notification list: unread first, then read
  const dbNotifs   = rows.map(rowToNotif)
  const unreadDb   = dbNotifs.filter(n => !n.read)
  const readDb     = dbNotifs.filter(n => n.read)
  const NOTIFICATIONS: NotifItem[] = [
    ...unreadDb,
    ...STATIC_NOTIFICATIONS.filter(n => !readStatic.has(n.id)),
    ...readDb,
    ...STATIC_NOTIFICATIONS.filter(n => readStatic.has(n.id)),
  ]
  const unreadCount = unreadDb.length + STATIC_NOTIFICATIONS.filter(n => !readStatic.has(n.id)).length

  async function handleMarkAllRead() {
    setReadStatic(new Set(STATIC_NOTIFICATIONS.map(n => n.id)))
    if (!profileId) return
    setRows(prev => prev.map(r => ({ ...r, read: true })))
    await notificationsApi.markAllRead(profileId)
    await refresh(profileId)
  }

  async function handleNotifClick(n: NotifItem) {
    if (n.notifId) {
      setRows(prev => prev.map(r => (r.id === n.notifId ? { ...r, read: true } : r)))
      await notificationsApi.markRead(n.notifId)
      if (profileId) await refresh(profileId)
    } else {
      setReadStatic(prev => new Set([...prev, n.id]))
    }
    setNotifOpen(false)
    if (n.entityType === 'client_messages_project' && n.entityId) {
      if (onOpenClientMessages) onOpenClientMessages(n.entityId)
      else onViewChange('client-messages')
      return
    }
    onViewChange('home')
  }


  function handleSwitchUser(userId: string) {
    setActiveUser(userId)
    setSwitchOpen(false)
  }

  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>()
    for (const r of cmdResults) {
      const list = groups.get(r.sub) ?? []
      list.push(r)
      groups.set(r.sub, list)
    }
    return Array.from(groups.entries())
  }, [cmdResults])

  function handleSelectResult(r: SearchResult) {
    onViewChange(r.view, r.targetId)
    setCmdOpen(false)
    setCmdQuery('')
    setCmdResults([])
    setCmdIndex(-1)
  }

  function handleCmdKeyDown(e: React.KeyboardEvent) {
    if (cmdResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCmdIndex(i => (i + 1) % cmdResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCmdIndex(i => (i - 1 + cmdResults.length) % cmdResults.length)
    } else if (e.key === 'Enter' && cmdIndex >= 0) {
      e.preventDefault()
      handleSelectResult(cmdResults[cmdIndex])
    }
  }

  return (
    <>
      {/* Main header bar */}
      <header
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{ height: 48, background: T.bgSurface, borderBottom: `1px solid ${T.border}` }}
      >
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]" style={{ color: T.text3 }}>{tenantName || '—'}</span>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ color: T.text3 }}>
            <path d="M3 2.5L5.5 4.5L3 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="text-[13px] font-semibold" style={{ color: T.text1 }}>
            {viewLabels[currentView]}
          </span>
        </div>

        {/* Center: global search */}
        <button
          onClick={() => setCmdOpen(true)}
          className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] transition-colors"
          style={{ minWidth: 240, background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text3 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border2 }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.5 9.5L8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Busca global...
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: `${T.text3}20`, color: T.text3 }}>⌘K</span>
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-1">

          {/* Create Issue */}
          {onCreateIssue && (
            <button
              onClick={onCreateIssue}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold text-white transition-all mr-2"
              style={{ background: T.accent }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.filter='brightness(1.15)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.filter='none'}}
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              Demanda
            </button>
          )}

          {INSPECTION_MODE_ENABLED ? (
            <>
              {/* Inspection User Switcher */}
              <div className="relative mr-2">
                <button
                  onClick={() => setSwitchOpen(o => !o)}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors"
                  style={{ background: rcStyle.bg, color: rcStyle.color, border: `1px solid ${rcStyle.color}30` }}
                  title="Trocar usuário de inspeção"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M1.5 9c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {rcLabel}
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </button>

                {switchOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 py-1 rounded-xl overflow-hidden fade-rise"
                    style={{ width: 230, background: T.bgSurface, border: `1px solid ${T.border2}`, boxShadow: T.shadowModal }}
                    onMouseLeave={() => setSwitchOpen(false)}
                  >
                    <p className="px-3 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-widest" style={{ color: T.text3 }}>
                      Inspection Mode — trocar usuário
                    </p>
                    {MOCK_USERS.map(u => {
                      const s   = ROLE_CONTEXT_COLOR[u.role_context] ?? { color: T.accent, bg: T.accentDim }
                      const lbl = ROLE_CONTEXT_LABEL[u.role_context] ?? u.role_context
                      const active = u.user_id === activeUser.user_id
                      return (
                        <button
                          key={u.user_id}
                          onClick={() => handleSwitchUser(u.user_id)}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
                          style={{ background: active ? `${s.color}14` : 'transparent' }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                        >
                          <Avatar name={u.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate" style={{ color: active ? s.color : T.text1 }}>{u.name}</p>
                            <p className="text-[10px]" style={{ color: T.text3 }}>{lbl}</p>
                          </div>
                          {active && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                              <path d="M2 5l2.5 2.5L8 2.5" stroke={s.color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      )
                    })}

                    {/* Separator + profile actions */}
                    <div className="mx-3 my-1" style={{ height: 1, background: T.border }} />
                    <div className="px-3 py-1.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <p className="text-[12px] font-semibold truncate" style={{ color: T.text1 }}>{activeUser.name}</p>
                      <p className="text-[10px] truncate" style={{ color: T.text3 }}>{activeUser.email}</p>
                      <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-px rounded-full" style={{ color: rcStyle.color, background: rcStyle.bg }}>
                        {rcLabel}
                      </span>
                    </div>
                    {[
                      { icon: '👤', label: 'Meu perfil' },
                      { icon: '⚙️', label: 'Preferências' },
                      { icon: '🔑', label: 'Segurança' },
                      { icon: '🚪', label: 'Sair' },
                    ].map(item => (
                      <button
                        key={item.label}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors text-left"
                        style={{ color: item.label === 'Sair' ? T.crit : T.text2 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                        onClick={() => {
                          setSwitchOpen(false)
                          if (item.label === 'Sair') void signOut()
                          else if (item.label === 'Meu perfil') onViewChange('profile')
                          else if (item.label === 'Preferências') onViewChange('preferences')
                        }}
                      >
                        <span>{item.icon}</span>{item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-px h-4" style={{ background: T.border }} />
            </>
          ) : (
            <>
              {/* Production: read-only role / user badge */}
              <div className="flex items-center gap-2 mr-2">
                <Avatar name={activeUser.name} size="sm" />
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-[11px] font-semibold" style={{ color: T.text1 }}>{activeUser.name}</span>
                  <span className="text-[9px] font-medium px-1.5 py-px rounded-full" style={{ color: rcStyle.color, background: rcStyle.bg }}>
                    {rcLabel}
                  </span>
                </div>
              </div>

              <div className="w-px h-4" style={{ background: T.border }} />
            </>
          )}

          {/* Date */}
          <span className="hidden sm:block text-[11px] px-2" style={{ color: T.text3 }}>{today()}</span>

          <div className="w-px h-4" style={{ background: T.border }} />

          {/* Help */}
          <button
            onClick={() => onViewChange('feedback')}
            title="Como usar esta tela"
            aria-label="Como usar esta tela"
            className="w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-semibold transition-colors"
            style={{ color: T.text3, background: T.bgSurface2, border: `1px solid ${T.border}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text1 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text3 }}
          >?</button>


          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: notifOpen ? T.text1 : T.text2, background: notifOpen ? T.bgSurface2 : 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
              onMouseLeave={e => { if (!notifOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v3l-1 1.5h11L12.5 9V6A4.5 4.5 0 0 0 8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold text-white px-0.5" style={{ background: T.crit }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 py-1.5 fade-rise"
                style={{ width: 320, background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 12, boxShadow: T.shadowModal, maxHeight: 420, overflowY: 'auto' }}
              >
                <div className="flex items-center justify-between px-3 pb-1.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-semibold" style={{ color: T.text1 }}>Notificações</p>
                    {unreadCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: T.crit, color: '#fff' }}>{unreadCount}</span>
                    )}
                  </div>
                  <button className="text-[10px]" style={{ color: T.accent }} onClick={handleMarkAllRead}>
                    Marcar tudo como lido
                  </button>
                </div>
                {NOTIFICATIONS.length === 0 ? (
                  <p className="text-[12px] text-center py-4" style={{ color: T.text3 }}>Nenhuma notificação.</p>
                ) : (
                  NOTIFICATIONS.map((n) => {
                    const isUnread = !n.read
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
                        style={{ background: isUnread ? `${T.accent}06` : 'transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isUnread ? `${T.accent}06` : 'transparent' }}
                      >
                        <span className="text-sm leading-none mt-0.5 flex-shrink-0">{n.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] leading-snug" style={{ color: T.text1 }}>{n.text}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: T.text3 }}>{n.time}</p>
                        </div>
                        {isUnread && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: T.accent }} />}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Cmd+K palette */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 fade-rise"
          style={{ background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setCmdOpen(false) }}
        >
          <div
            className="rounded-xl shadow-2xl w-[540px] max-w-[90vw] overflow-hidden"
            style={{ background: T.bgSurface, border: `1px solid ${T.border2}`, boxShadow: T.shadowModal }}
          >
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: T.text3 }}>
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
                <path d="M10.5 10.5L9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                autoFocus
                value={cmdQuery}
                onChange={e => { setCmdQuery(e.target.value); setCmdIndex(-1) }}
                onKeyDown={handleCmdKeyDown}
                className="flex-1 text-[13px] outline-none bg-transparent"
                style={{ color: T.text1 }}
                placeholder="Buscar projetos, tarefas, membros..."
              />
              <button
                onClick={() => setCmdOpen(false)}
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ color: T.text3, border: `1px solid ${T.border}` }}
              >
                Esc
              </button>
            </div>
            <div className="p-2 space-y-0.5">
              {cmdLoading && (
                <div className="px-3 py-4 text-center text-[12px]" style={{ color: T.text3 }}>
                  Buscando…
                </div>
              )}
              {!cmdLoading && cmdQuery.trim().length < 2 && (
                <div className="px-3 py-4 text-center text-[12px]" style={{ color: T.text3 }}>
                  Digite pelo menos 2 caracteres para buscar.
                </div>
              )}
              {!cmdLoading && cmdQuery.trim().length >= 2 && cmdResults.length === 0 && (
                <div className="px-3 py-4 text-center text-[12px]" style={{ color: T.text3 }}>
                  Nenhum resultado.
                </div>
              )}
              {!cmdLoading && groupedResults.map(([sub, items]) => (
                <div key={sub}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>
                    {sub}
                  </div>
                  {items.map((r, idx) => {
                    const flatIndex = cmdResults.findIndex(x => x === r)
                    const selected = flatIndex === cmdIndex
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelectResult(r)}
                        className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-[13px] transition-colors"
                        style={{ color: T.text2, background: selected ? T.bgSurface2 : 'transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2; (e.currentTarget as HTMLButtonElement).style.color = T.text1 }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = selected ? T.bgSurface2 : 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = T.text2 }}
                      >
                        <span className="truncate">{r.label}</span>
                        <span className="text-[10px] ml-2 flex-shrink-0" style={{ color: T.text3 }}>{r.kind === 'item' ? r.sub : r.sub}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div
              className="px-4 py-2 flex items-center gap-3 text-[10px]"
              style={{ borderTop: `1px solid ${T.border}`, color: T.text3 }}
            >
              <span><kbd className="font-mono px-1 rounded" style={{ border: `1px solid ${T.border}` }}>↑↓</kbd> navegar</span>
              <span><kbd className="font-mono px-1 rounded" style={{ border: `1px solid ${T.border}` }}>↵</kbd> selecionar</span>
              <span><kbd className="font-mono px-1 rounded" style={{ border: `1px solid ${T.border}` }}>Esc</kbd> fechar</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
