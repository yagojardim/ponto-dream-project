import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { GuidedTour } from './onboarding/GuidedTour'
import { useProjectTourState, startTour } from '../hooks/useProjectTour'
import { useOnboarding } from '../hooks/useOnboarding'
import { useSession } from '@/data/SessionContext'
import { hasTour, tourStepsFor, tourIdFor } from '@/data/tourSteps'


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
  const { tourActive, activeSteps, stopProjectTour } = useProjectTourState()
  const { loaded, guideDisabled, markProjectTourDone, markTourDone, isTourDone } = useOnboarding()
  const { activeUser } = useSession()
  const autoStartedRef = useRef<string | null>(null)

  // Auto-start tour on first visit to a view
  useEffect(() => {
    if (!loaded || guideDisabled || tourActive) return
    const role = activeUser?.role_context ?? null
    const id = tourIdFor(currentView, role)
    // Avoid re-triggering for the same id in this render cycle
    if (autoStartedRef.current === id) return
    if (hasTour(currentView, role) && !isTourDone(id)) {
      autoStartedRef.current = id
      const steps = tourStepsFor(currentView, role)
      startTour(steps)
    } else {
      autoStartedRef.current = null
    }
  }, [loaded, guideDisabled, tourActive, currentView, activeUser?.role_context, isTourDone])

  function endTour() {
    const role = activeUser?.role_context ?? null
    const id = tourIdFor(currentView, role)
    stopProjectTour()
    markProjectTourDone()
    markTourDone(id)
    autoStartedRef.current = null
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
        />
        <main className="flex-1 min-w-0 overflow-x-hidden" style={{ overflowY: 'auto' }}>
          {children}
        </main>

        {tourActive && activeSteps.length > 0 && (
          <GuidedTour
            steps={activeSteps}
            onNav={v => handleNav(v)}
            onFinish={endTour}
            onSkip={endTour}
          />
        )}

      </div>
    </div>
  )
}
