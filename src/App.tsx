import { useState } from "react"
import { Shell, type View } from "./components/Shell"
import { SessionProvider, useSession } from "./data/SessionContext"
import FoundationsPage from "./pages/FoundationsPage"
import DashboardPage from "./pages/DashboardPage"
import ProjectPage from "./pages/ProjectPage"
import IssueDetailPage from "./pages/IssueDetailPage"
import { WorkItemDetail } from "./components/WorkItemDetail"
import ClientPortalPage from "./pages/ClientPortalPage"
import TaskDrawerPage from "./pages/TaskDrawerPage"
import ProjectsListPage from "./pages/ProjectsListPage"
import GanttPage from "./pages/GanttPage"
import CalendarPage from "./pages/CalendarPage"
import ListPage from "./pages/ListPage"
import TimelinePage from "./pages/TimelinePage"
import EpicsPage from "./pages/EpicsPage"
import ReleasesPage from "./pages/ReleasesPage"
import FiltersPage from "./pages/FiltersPage"
import IssueNavigatorPage from "./pages/IssueNavigatorPage"
import ReportsPage from "./pages/ReportsPage"
import { useProfileReportsAccess, canAccessReports } from "./data/db/reportsGovernance"
import AutomationsPage from "./pages/AutomationsPage"
import ConfigPage from "./pages/ConfigPage"
import { CreateIssueModal } from "./components/CreateIssueModal"
import { CatalogProvider } from "./data/CatalogContext"
import LoginPage from "./pages/LoginPage"
import SignupPage from "./pages/SignupPage"
import { SignupOnboarding } from "./components/SignupOnboarding"
import { TourOfferModal } from "./components/TourOfferModal"
import { SIGNUP_ONBOARDING_KEY } from "./data/db/signup"
import { startTour } from "./hooks/useProjectTour"
import { useOnboarding } from "./hooks/useOnboarding"
import { tourStepsFor } from "./data/tourSteps"
import ClientAccessPage from "./pages/ClientAccessPage"
import ClientLoginPage from "./pages/ClientLoginPage"
import { clearPortalSession } from "./lib/portalSession"
import DashboardHomePage from "./pages/DashboardHomePage"
import TeamPage from "./pages/TeamPage"
import MyTasksPage from "./pages/MyTasksPage"
import RoleDashboard from "./pages/RoleDashboard"
import ClientMessagesPage from "./pages/ClientMessagesPage"
import TimesheetPage from "./pages/TimesheetPage"
import HoursApprovalPage from "./pages/HoursApprovalPage"
import BoardsListPage from "./pages/BoardsListPage"
import ModulesPortfolioPage from "./pages/ModulesPortfolioPage"
import TenantSettingsPage from "./pages/TenantSettingsPage"
import { MOCK_USERS } from "./data/session"
import InviteMemberModal from "./components/InviteMemberModal"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { AdminMasterOverlay } from "./components/AdminMasterOverlay"
import CreatePasswordPage from "./pages/CreatePasswordPage"
import ActivatePage from "./pages/ActivatePage"
import ResetPasswordPage from "./pages/ResetPasswordPage"
import ProfilePage from "./pages/ProfilePage"
import PreferencesPage from "./pages/PreferencesPage"
import StoragePage from "./pages/StoragePage"
import FeedbackPage from "./pages/FeedbackPage"
import OAuthGoogleReturn from "./pages/OAuthGoogleReturn"
import { initAppPrefs } from "./lib/appPrefs"
import { RESET_PATH } from "./lib/passwordReset"
import { GOOGLE_RETURN_PATH } from "./lib/googleCalendar"
import { fetchBoardData, createWorkItem } from "./data/db/board"
import { listProjects, projectUsesFeatures } from "./data/db/projects"
import { T } from "./components/ds/tokens"

const ALL_VIEWS: View[] = [
  "home",
  "foundations",
  "projects-list",
  "gantt",
  "calendar",
  "dashboard",
  "project",
  "list",
  "timeline",
  "epics",
  "releases",
  "filters",
  "navigator",
  "reports",
  "automations",
  "config",
  "team",
  "my-tasks",
  "issue",
  "client",
  "task-drawer",
  "login",
  "role-dashboard",
  "client-access",
  "client-login",
  "client-messages",
  "timesheet",
  "hours-approval",
  "boards-list",
  "modules",
  "tenant-settings",
  "profile",
  "preferences",
  "storage",
  "feedback",
]

export const VIEW_LABELS: Record<View, string> = {
  home: "Início",
  foundations: "Design System",
  "projects-list": "Projetos",
  gantt: "Gantt",
  calendar: "Calendário",
  dashboard: "Dashboard",
  project: "Kanban",
  list: "Lista",
  timeline: "Timeline",
  epics: "Épicos",
  releases: "Releases",
  filters: "Filtros",
  navigator: "Navegador de Demandas",
  reports: "Relatórios",
  automations: "Automações",
  config: "Configurações",
  team: "Time & Permissões",
  "my-tasks": "Minha Fila",
  issue: "Detalhe da Demanda",
  client: "Portal Cliente",
  "task-drawer": "Task Drawer",
  login: "Login — Gestão",
  "role-dashboard": "Dashboard por Papel",
  "client-access": "Criar Acesso de Cliente",
  "client-login": "Login — Portal",
  "client-messages": "Mensagens do Cliente",
  timesheet: "Lançar horas",
  "hours-approval": "Aprovar horas",
  "boards-list": "Boards",
  modules: "Módulos",
  "tenant-settings": "Config. do Tenant",
  profile: "Meu perfil",
  preferences: "Preferências",
  storage: "Armazenamento",
  feedback: "Feedback & Suporte",
}

initAppPrefs()

export default function App() {
  // Rota de retorno do OAuth do conector Google Calendar (abre em popup).
  if (
    typeof window !== "undefined" &&
    window.location.pathname === GOOGLE_RETURN_PATH
  ) {
    return (
      <ErrorBoundary scope="OAuthGoogleReturn">
        <OAuthGoogleReturn />
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary scope="AppShell">
      <SessionProvider>
        <AppInner />
      </SessionProvider>
    </ErrorBoundary>
  )
}

function AppInner() {
  const { setActiveUser, status, enterInspection, mustChangePassword, activeUser } =
    useSession()
  const [view, setView] = useState<View>("home")
  const [showSignup, setShowSignup] = useState(false)
  const [loginEmail, setLoginEmail] = useState("")
  const [onboardingPending, setOnboardingPending] = useState(() => {
    try { return localStorage.getItem(SIGNUP_ONBOARDING_KEY) === "1" } catch { return false }
  })
  const { loaded: onboardingLoaded, welcomeDone, markWelcomeDone, disableGuide } = useOnboarding()
  const clearSignupFlag = () => { try { localStorage.removeItem(SIGNUP_ONBOARDING_KEY) } catch { /* noop */ } }
  const [clientMustChangePwd, setClientMustChangePwd] = useState(false)
  const [activateToken, setActivateToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    if (window.location.pathname !== "/activate") return null
    return new URLSearchParams(window.location.search).get("token")
  })
  const [definePwdFromToken, setDefinePwdFromToken] = useState(false)
  const [resetRoute, setResetRoute] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return (
      window.location.pathname === RESET_PATH ||
      window.location.hash.includes("type=recovery")
    )
  })

  function leaveReset() {
    setResetRoute(false)
    try {
      window.history.replaceState({}, "", "/")
    } catch {
      /* noop */
    }
  }

  function leaveActivate() {
    setActivateToken(null)
    setDefinePwdFromToken(false)
    try {
      window.history.replaceState({}, "", "/")
    } catch {
      /* noop */
    }
  }

  const handleLoginSuccess = (roleStr?: string) => {
    if (roleStr) {
      const roleMap: Record<string, string> = {
        PMO: "u_pmo",
        PM: "u_pm",
        "P.O": "u_po",
        SM: "u_sm",
        TechLead: "u_tl",
        Dev: "u_dev",
        "UX/UI": "u_ux",
        QA: "u_qa",
      }
      const matched = MOCK_USERS.find(
        (u) => u.user_id === (roleMap[roleStr] ?? "u_pm"),
      )
      if (matched) setActiveUser(matched.user_id)
      enterInspection() // atalho Inspection intencional → libera o fallback
    }
    setView("home")
  }

  if (status === "loading") {
    return (
      <div
        className="h-screen w-full flex items-center justify-center"
        style={{ background: "var(--bg-page)" }}
        role="status"
        aria-live="polite"
        aria-label="Carregando Altech Project"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12" aria-hidden="true">
            <div
              className="absolute inset-0 rounded-full opacity-30"
              style={{ border: "2px solid var(--border-default)" }}
            />
            <div
              className="spin absolute inset-0 rounded-full"
              style={{
                border: "2px solid transparent",
                borderTopColor: "var(--primary)",
              }}
            />
            <div
              className="absolute inset-[15px] rounded-sm"
              style={{ background: "var(--primary)" }}
            />
          </div>
          <div className="text-center">
            <p
              className="m-0 text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              ALTECH PROJECT
            </p>
            <p
              className="mt-1 mb-0 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Carregando seu workspace…
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Rota /reset-password — fluxo nativo de recuperação do Supabase.
  if (resetRoute) {
    return (
      <ErrorBoundary scope="ResetPassword">
        <ResetPasswordPage
          onGoToLogin={() => {
            leaveReset()
            setView("login")
          }}
          onDone={() => {
            leaveReset()
            setView("home")
          }}
        />
      </ErrorBoundary>
    )
  }

  // Rota /activate?token=... — link de ativação/reset.
  if (activateToken && !definePwdFromToken) {
    return (
      <ActivatePage
        token={activateToken}
        authenticated={status === "authenticated"}
        onDefinePassword={() => setDefinePwdFromToken(true)}
        onGoToLogin={leaveActivate}
      />
    )
  }

  // Sem sessão real e sem Inspection Mode → login obrigatório (ou auto-cadastro).
  if (status === "anonymous" || view === "login") {
    if (showSignup) {
      return (
        <SignupPage
          onGoToLogin={(em) => { if (em) setLoginEmail(em); setShowSignup(false) }}
        />
      )
    }
    return (
      <LoginPage
        onSuccess={handleLoginSuccess}
        onCreateAccount={() => setShowSignup(true)}
        initialEmail={loginEmail}
      />
    )
  }

  // Gate de troca de senha obrigatória — bloqueia toda a navegação.
  if (
    status === "authenticated" &&
    (mustChangePassword || definePwdFromToken)
  ) {
    return (
      <CreatePasswordPage
        rawToken={activateToken}
        onDone={() => {
          leaveActivate()
          setView("home")
        }}
      />
    )
  }

  if (view === "client-login") {
    return (
      <ClientLoginPage
        onSuccess={(_permission, mustChangePassword) => {
          setClientMustChangePwd(mustChangePassword)
          setView("client")
        }}
        onBack={() => setView("home")}
      />
    )
  }

  if (view === "client-access") {
    return <ClientAccessPage onBack={() => setView("home")} />
  }

  if (view === "foundations") {
    return (
      <div
        className="h-screen overflow-hidden flex flex-col"
        style={{ background: "var(--bg-page)" }}
      >
        <div className="flex-1 overflow-y-auto">
          <FoundationsPage />
        </div>
      </div>
    )
  }

  if (view === "client") {
    return (
      <div
        className="fixed inset-0 flex flex-col"
        style={{ background: "#0e1016" }}
      >
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary scope="ClientPortal">
            <ClientPortalPage
              mustChangePassword={clientMustChangePwd}
              onPasswordChanged={() => setClientMustChangePwd(false)}
              onLogout={() => { clearPortalSession(); setView("client-login") }}
            />
          </ErrorBoundary>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary scope="Shell">
      <CatalogProvider>
        <ErrorBoundary scope="AdminMasterOverlay" fallback={null}>
          <AdminMasterOverlay />
        </ErrorBoundary>
        {onboardingPending && (
          <ErrorBoundary scope="SignupOnboarding" fallback={null}>
            <SignupOnboarding
              onDone={() => setOnboardingPending(false)}
              onGoToTeam={() => { setOnboardingPending(false); setView("team") }}
            />
          </ErrorBoundary>
        )}
        {/* Carrossel de boas-vindas: 1º acesso de QUALQUER usuário (criador ou convidado). */}
        {onboardingLoaded && !welcomeDone && !onboardingPending && (
          <TourOfferModal
            onStart={() => {
              clearSignupFlag()
              markWelcomeDone()
              setView("home")
              startTour(tourStepsFor("home", activeUser?.role_context ?? null))
            }}
            onSkip={() => {
              clearSignupFlag()
              markWelcomeDone()
              disableGuide()   // recusou → desativa TODO o auto-tour
            }}
          />
        )}
        <ShellWithRole view={view} setView={setView} />
      </CatalogProvider>
    </ErrorBoundary>
  )
}

function ShellWithRole({
  view,
  setView,
}: {
  view: View
  setView: (v: View) => void
}) {
  const { activeUser } = useSession()
  const [createOpen, setCreate] = useState(false)
  const [demandToast, setDemandToast] = useState<string | null>(null)
  const [clientMsgProjectId, setClientMsgProjectId] = useState<string | null>(null)
  const [inviteOpen, setInvite] = useState(false)
  const [selectedBoardId, setSelectedBoardId] = useState<string | undefined>()
  const [selectedProjectId, setSelectedProjectId] =
    useState<string | undefined>()
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>()
  // Demanda recém-criada: abre no drawer lateral direito (não em tela cheia).
  const [createdIssueId, setCreatedIssueId] = useState<string | undefined>()
  const [dashboardProjectId, setDashboardProjectId] = useState<string | undefined>()
  const [teamInitialTab, setTeamInitialTab] =
    useState<"membros" | "convites" | "permissoes" | "dashboards">("membros")
  const [feedbackInitialTab, setFeedbackInitialTab] =
    useState<"feedback" | "suporte" | "ajuda">("feedback")

  async function handleGlobalCreateDemand(data: Record<string, unknown>) {
    try {
      // Resolve o projeto: o escolhido no modal, senão o selecionado,
      // senão o primeiro ativo, senão o primeiro.
      let projectId = (typeof data.projectId === 'string' && data.projectId)
        ? data.projectId
        : selectedProjectId
      if (!projectId) {
        const { projects } = await listProjects()
        projectId = (projects.find(p => p.status === "active") ?? projects[0])?.id
      }
      if (!projectId) throw new Error("Nenhum projeto disponível para criar a demanda")

      const boardData = await fetchBoardData(projectId)
      const board = boardData.board
      const columns = boardData.columns ?? []
      if (!board || columns.length === 0) throw new Error("Board indisponível para o projeto")

      // Sem sprint => coluna Backlog; senão primeira coluna
      const hasSprintField = Object.prototype.hasOwnProperty.call(data, "sprintId")
      const sprintId = hasSprintField && typeof data.sprintId === "string" && data.sprintId
        ? data.sprintId
        : null
      const backlogCol = columns.find(c => c.category === "backlog" || c.statuses.includes("backlog"))
      const column = (!sprintId ? backlogCol : undefined) ?? columns[0]

      const epicId = (typeof data.epicId === "string" && data.epicId) ? data.epicId : null
      const featureId = (typeof data.featureId === "string" && data.featureId) ? data.featureId : null

      const demandType = String(data.type ?? "story")
      if (demandType === "story" || demandType === "bug") {
        const { projects: allProjects } = await listProjects()
        const proj = allProjects.find(p => p.id === projectId)
        const usesFeatures = projectUsesFeatures(proj)
        if (usesFeatures && !featureId) throw new Error("Selecione uma Funcionalidade para esta demanda")
        if (!usesFeatures && !epicId) throw new Error("Selecione um Épico para esta demanda")
      }
      const assigneeId = typeof data.assigneeId === "string" && data.assigneeId ? data.assigneeId : null
      const points = parseInt(String(data.points ?? ""), 10)

      const created = await createWorkItem({
        projectId,
        boardId: board.id,
        column,
        sprintId,
        epicId,
        featureId,
        assigneeId,
        title: String(data.summary ?? "").trim() || "Nova demanda",
        type: String(data.type ?? "story"),
        priority: (data.priority as "critical" | "high" | "medium" | "low") ?? "medium",
        storyPoints: Number.isFinite(points) ? points : null,
        description: data.description ? String(data.description) : null,
      }, activeUser.name)

      setDemandToast(`Demanda ${created.key} criada`)
      // Abre a demanda recém-criada no drawer lateral (padrão tradicional).
      setCreatedIssueId(created.id)
    } catch (err) {
      setDemandToast(`Falha ao criar a demanda: ${err instanceof Error ? err.message : "erro desconhecido"}`)
    } finally {
      setCreate(false)
      setTimeout(() => setDemandToast(null), 3500)
    }
  }

  /** Navegação vinda das páginas — aceita um id de alvo opcional. */
  function navTo(v: string, targetId?: string) {
    if (v === "team:convites") {
      setTeamInitialTab("convites")
      setView("team")
      return
    }
    if (v === "team:membros") {
      setTeamInitialTab("membros")
      setView("team")
      return
    }
    if (v === "dashboard") {
      setDashboardProjectId(targetId)
      setView("dashboard")
      return
    }
    if (v === "project" && targetId) {
      setSelectedProjectId(targetId)
      setSelectedBoardId(undefined)
    }
    if (v === "issue" && targetId) {
      setSelectedIssueId(targetId)
    }
    if (v === "feedback") {
      setFeedbackInitialTab(targetId === "ajuda" || targetId === "suporte" ? targetId : "feedback")
    }
    if (ALL_VIEWS.includes(v as View)) setView(v as View)
  }

  return (
    <ErrorBoundary scope="AppShell">
      <>
        {createOpen && (
          <CreateIssueModal
            projectId={selectedProjectId}
            onClose={() => setCreate(false)}
            onCreate={data => { void handleGlobalCreateDemand(data) }}
          />
        )}
        {inviteOpen && <InviteMemberModal onClose={() => setInvite(false)} />}
        {createdIssueId && (
          <WorkItemDetail
            itemId={createdIssueId}
            mode="drawer"
            onUpdate={() => {}}
            onClose={() => setCreatedIssueId(undefined)}
          />
        )}
        {demandToast && (
          <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 80,
            background: T.bgSurface, border: `1px solid ${T.border}`, color: T.text1,
            padding: "10px 16px", borderRadius: 12, boxShadow: T.shadowModal, fontSize: 13 }}>
            {demandToast}
          </div>
        )}
        <Shell
          currentView={view}
          onViewChange={(v, targetId) => {
            if (v === "team") setTeamInitialTab("membros")
            navTo(v, targetId)
          }}
          onCreateIssue={() => setCreate(true)}
          onOpenClientMessages={(pid) => { setClientMsgProjectId(pid); setView("client-messages") }}
        >
          <ErrorBoundary scope={`view:${view}`} key={view}>
            {view === "home" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <DashboardHomePage
                  onNav={navTo}
                  onInvite={() => setInvite(true)}
                />
              </div>
            )}
            {view === "projects-list" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <ProjectsListPage onNav={navTo} />
              </div>
            )}
            {view === "gantt" && (
              <div className="h-full min-w-0 w-full overflow-hidden">
                <GanttPage />
              </div>
            )}
            {view === "calendar" && (
              <div className="h-full min-w-0 w-full overflow-hidden">
                <CalendarPage />
              </div>
            )}
            {view === "list" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <ListPage />
              </div>
            )}
            {view === "timeline" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <TimelinePage />
              </div>
            )}
            {view === "epics" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <EpicsPage />
              </div>
            )}
            {view === "releases" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <ReleasesPage />
              </div>
            )}
            {view === "filters" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <FiltersPage />
              </div>
            )}
            {view === "navigator" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <IssueNavigatorPage />
              </div>
            )}
            {view === "reports" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <ReportsRouteGuard />
              </div>
            )}
            {view === "automations" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <AutomationsPage />
              </div>
            )}
            {view === "config" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <ConfigPage />
              </div>
            )}
            {view === "tenant-settings" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <TenantSettingsPage />
              </div>
            )}
            {view === "team" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <TeamPage
                  onInvite={() => setInvite(true)}
                  initialTab={teamInitialTab}
                />
              </div>
            )}
            {view === "my-tasks" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <MyTasksPage onNav={navTo} />
              </div>
            )}
            {view === "dashboard" && (
              <div
                className="h-full min-w-0 w-full overflow-y-auto dark-shell"
                style={{ background: "var(--bg-page,#0d1321)" }}
              >
                <DashboardPage onNav={navTo} initialProjectId={dashboardProjectId} />
              </div>
            )}
            {view === "project" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <ProjectPage
                  boardId={selectedBoardId}
                  projectId={selectedProjectId}
                  onBackToBoards={
                    selectedBoardId ? () => setView("boards-list") : undefined
                  }
                />
              </div>
            )}
            {view === "issue" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <IssueDetailPage issueId={selectedIssueId} />
              </div>
            )}
            {view === "task-drawer" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <TaskDrawerPage />
              </div>
            )}
            {view === "role-dashboard" && (
              <div className="h-full min-w-0 w-full dark-shell">
                <RoleDashboard onBack={() => setView("home")} />
              </div>
            )}
            {view === "client-messages" && (
              <div className="h-full min-w-0 w-full overflow-hidden dark-shell">
                <ClientMessagesPage initialProjectId={clientMsgProjectId} />
              </div>
            )}
            {view === "timesheet" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <TimesheetPage />
              </div>
            )}
            {view === "hours-approval" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <HoursApprovalPage />
              </div>
            )}
            {view === "boards-list" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <BoardsListPage
                  onSelectBoard={(id) => {
                    setSelectedBoardId(id)
                    setSelectedProjectId(undefined)
                    setView("project")
                  }}
                />
              </div>
            )}
            {view === "profile" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <ProfilePage />
              </div>
            )}
            {view === "preferences" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <PreferencesPage />
              </div>
            )}
            {view === "storage" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <StoragePage onNav={navTo} />
              </div>
            )}
            {view === "feedback" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <FeedbackPage onNav={navTo} initialTab={feedbackInitialTab} />
              </div>
            )}
            {view === "modules" && (
              <div className="h-full min-w-0 w-full overflow-y-auto dark-shell">
                <ModulesPortfolioPage onNav={navTo} />
              </div>
            )}
          </ErrorBoundary>
        </Shell>
      </>
    </ErrorBoundary>
  )
}

// Rota "Relatórios e Insights": apenas Admin Master + papéis liberados por ele.
function ReportsRouteGuard() {
  const { activeUser } = useSession()
  const hasReportsFlag = useProfileReportsAccess(activeUser.user_id)
  if (!canAccessReports(activeUser.permissions, hasReportsFlag)) {

    return (
      <div style={{ padding: 48, color: '#94a3b8', fontSize: 14 }}>
        Você não tem acesso a Relatórios e Insights. Peça liberação ao Admin Master do tenant.
      </div>
    )
  }
  return <ReportsPage />
}
