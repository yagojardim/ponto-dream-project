import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { T } from './tokens'

export interface HelpHintProps {
  /** Texto explicativo exibido no popover. */
  text: string
  /** Título opcional acima do texto. */
  title?: string
  /** aria-label do botão (default: "Ajuda"). */
  label?: string
}

/**
 * Botão circular "?" com popover theme-aware.
 * Abre no hover, no clique e no foco por teclado; fecha ao sair, clicar fora ou Esc.
 */
export function HelpHint({ text, title, label }: HelpHintProps) {
  const [hover, setHover]   = useState(false)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  const open = hover || pinned

  // Popover em position:fixed + portal: escapa de qualquer container com
  // overflow hidden/auto (barra de filtros do board, drawers, modais).
  useEffect(() => {
    if (!open) { setCoords(null); return }
    function place() {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      const width = 260
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
      setCoords({ top: r.bottom + 6, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!pinned) return
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setPinned(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPinned(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  return (
    <span
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={label ?? 'Ajuda'}
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); setPinned(p => !p) }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={{
          width: 16, height: 16, borderRadius: 99, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: open ? `${T.accent}18` : 'transparent',
          border: `1px solid ${open ? T.accent : T.text3}`,
          color: open ? T.accent : T.text3,
          fontSize: 10, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
          padding: 0, transition: 'all .12s', fontFamily: 'inherit',
        }}
      >?</button>

      {open && coords && createPortal(
        <span
          role="tooltip"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: 'fixed', top: coords.top, left: coords.left, zIndex: 4000,
            width: 'max-content', maxWidth: 260,
            background: T.bgSurface2, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: '8px 10px',
            boxShadow: T.shadow2, textAlign: 'left', whiteSpace: 'normal',
          }}
        >
          {title && (
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.text1, marginBottom: 3 }}>
              {title}
            </span>
          )}
          <span style={{ display: 'block', fontSize: 11, lineHeight: 1.5, color: T.text2, fontWeight: 400 }}>
            {text}
          </span>
        </span>,
        document.body,
      )}
    </span>
  )
}

export default HelpHint
