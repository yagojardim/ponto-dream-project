import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { WelcomeModal } from './onboarding/WelcomeModal'
import { OnboardingTip } from './onboarding/OnboardingTip'
import { GuidedTour } from './onboarding/GuidedTour'
import { PROJECT_TOUR_STEPS } from '../data/projectTourSteps'
import { useProjectTourState } from '../hooks/useProjectTour'
import { useOnboarding } from '../hooks/useOnboarding'


export type View =
  | 'home' | 'foundations' | 'dashboard' | 'project' | 'issue' | 'client' | 'task-drawer'
  | 'projects-list' | 'gantt' | 'calendar'
  | 'list' | 'timeline' | 'epics' | 'releases' | 'filters' | 'navigator'
  | 'reports' | 'automations' | 'config' | 'team' | 'my-tasks'
  | 'login' | 'role-dashboard' | 'client-access' | 'client-login' | 'client-messages'
  | 'timesheet' | 'hours-approval' | 'boards-list' | 'modules' | 'tenant-settings'
  | 'profile' | 'preferences' | 'storage' | 'feedback'

interface ShellProps {
  children:     ReactNode
  currentView:  View
  onViewChange: (v: View, targetId?: string) => void
  onCreateIssue?: () => void
  onOpenClientMessages?: (projectId: string) => void
}

const VALID_VIEWS: View[] = [
  'home','dashboard','project','issue','client','task-drawer','projects-list','gantt','calendar',
  'list','timeline','epics','releases','filters','navigator',
  'reports','automations','config','team','my-tasks',
  'login','role-dashboard','client-access','client-login','client-messages',
  'timesheet','hours-approval','boards-list','modules','tenant-settings',
  'profile','preferences','storage','feedback',
]

export function Shell({ children, currentView, onViewChange, onCreateIssue, onOpenClientMessages }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeNav, setActiveNav] = useState<string>(currentView)
  const [helpOpen, setHelpOpen] = useState(false)
  const { tourActive, stopProjectTour } = useProjectTourState()
  const { markProjectTourDone } = useOnboarding()

  function endTour() {
    stopProjectTour()
    markProjectTourDone()
  }

  function handleNav(id: string, targetId?: string) {
    setActiveNav(id)
    if (VALID_VIEWS.includes(id as View)) onViewChange(id as View, targetId)
  }

  return (
    <div className="flex h-screen overflow-hidden dark-shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} activeNav={activeNav} onNav={handleNav} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          currentView={currentView}
          onViewChange={v => { onViewChange(v as View); setActiveNav(v) }}
          onCreateIssue={onCreateIssue}
          onOpenClientMessages={onOpenClientMessages}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <OnboardingTip view={currentView} forceOpen={helpOpen || undefined} onClose={() => setHelpOpen(false)} />
        <main className="flex-1 min-w-0 overflow-x-hidden" style={{ overflowY: 'auto' }}>
          <WelcomeModal onNav={handleNav} />
          {children}
        </main>

        {tourActive && (
          <GuidedTour
            steps={PROJECT_TOUR_STEPS}
            onNav={v => handleNav(v)}
            onFinish={endTour}
            onSkip={endTour}
          />
        )}

      </div>
    </div>
  )
}

