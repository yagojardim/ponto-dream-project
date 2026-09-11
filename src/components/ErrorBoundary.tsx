import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '@/utils/logger'

interface Props {
  children: ReactNode
  /** Optional label used in logs (e.g. "AppShell", "ClientPortal"). */
  scope?: string
  fallback?: ReactNode
}
interface State { hasError: boolean; correlationId: string | null }

/**
 * Catches render-time failures so a single broken section never blanks the app.
 * Cada falha gera um correlation_id (registrado em support_logs) mostrado ao
 * usuário para agilizar o suporte.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, correlationId: null }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const correlationId = logger.error(`render:${this.props.scope ?? 'unknown'}`, error, {
      componentStack: info.componentStack?.slice(0, 500),
    })
    this.setState({ correlationId })
  }

  private retry = () => this.setState({ hasError: false, correlationId: null })

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div
        className="h-full w-full flex items-center justify-center p-8"
        style={{ background: 'var(--bg-page, #0d1321)' }}
      >
        <div
          className="max-w-md w-full rounded-xl p-6 text-center"
          style={{
            background: 'var(--bg-surface, #151a28)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,.08))',
          }}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--text-primary, #e6e9f2)' }}>
            Não foi possível carregar esta seção. Tente novamente.
          </p>
          {this.state.correlationId && (
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted, #8a90a6)' }}>
              Código do erro:{' '}
              <code style={{ userSelect: 'all', fontFamily: 'monospace' }}>{this.state.correlationId}</code>
              <br />
              Informe este código ao suporte.
            </p>
          )}
          <button
            onClick={this.retry}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: 'var(--brand-600, #3b6cf5)', color: '#fff' }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
