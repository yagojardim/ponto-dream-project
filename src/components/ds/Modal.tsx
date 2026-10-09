import { useEffect, type ReactNode } from 'react'
import { T } from './tokens'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  size?: ModalSize
  children: ReactNode
  footer?: ReactNode
  closeOnBackdrop?: boolean
}

const widths: Record<ModalSize, number> = { sm: 440, md: 560, lg: 760, xl: 960 }

export function Modal({
  open, onClose, title, subtitle, size = 'md',
  children, footer, closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ background: 'var(--bg-overlay, rgba(8,10,14,0.72))', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && closeOnBackdrop) onClose() }}
    >
      <div
        className="flex flex-col w-full fade-rise"
        style={{
          maxWidth: widths[size],
          maxHeight: 'calc(100vh - 48px)',
          background: T.bgSurface,
          border: `1px solid ${T.border}`,
          borderRadius: '14px',
          boxShadow: T.shadowModal,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div
            className="flex items-start justify-between gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderBottom: `1px solid ${T.border}` }}
          >
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-[15px] font-semibold leading-tight" style={{ color: T.text1 }}>{title}</h2>
              )}
              {subtitle && (
                <p className="text-xs mt-0.5" style={{ color: T.text3 }}>{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
              style={{ color: T.text3, background: T.bgSurface2 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text1 }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text3 }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0"
            style={{ borderTop: `1px solid ${T.border}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
