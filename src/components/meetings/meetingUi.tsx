// Meeting Intelligence — estilos e componentes de UI compartilhados entre as telas.
import type { CSSProperties } from 'react'
import { T } from '@/components/ds/tokens'
import { IcSpark, IcCheck } from '@/components/meetings/icons'
import type { MeetingStatus, MeetingSource } from '@/data/db/meetings'

export const cardStyle: CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14,
}
export const pageStyle: CSSProperties = {
  padding: '28px 32px', background: T.bgPage, minHeight: '100%',
}

export const SOURCE_LABEL: Record<MeetingSource, string> = {
  upload: 'Transcrição colada',
  zoom:   'Zoom',
  meet:   'Google Meet',
  teams:  'Microsoft Teams',
  record: 'Gravado no navegador',
}

const STATUS_META: Record<MeetingStatus, { label: string; color: string; bg: string; kind: 'dot' | 'spark' }> = {
  ready:      { label: 'Pronta',      color: T.success, bg: T.successDim, kind: 'dot' },
  processing: { label: 'Processando', color: T.purple,  bg: T.purpleDim,  kind: 'spark' },
  failed:     { label: 'Falhou',      color: T.crit,    bg: T.critDim,    kind: 'dot' },
}

export function StatusPill({ status }: { status: MeetingStatus }) {
  const s = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg,
    }}>
      {s.kind === 'spark'
        ? <span style={{ color: s.color, display: 'inline-flex' }}><IcSpark size={11} /></span>
        : <span style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />}
      {s.label}
    </span>
  )
}

/** Data curta pt-BR a partir de um ISO. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}

/** Minutos → "1h30", "3h", "30min". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`
  if (h > 0) return `${h}h`
  return `${m}min`
}

/** Reais a partir de centavos. */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const AVATAR_GRADS = [
  'linear-gradient(135deg,#3B82F6,#6366F1)',
  'linear-gradient(135deg,#6366F1,#A78BFA)',
  'linear-gradient(135deg,#A78BFA,#EC4899)',
  'linear-gradient(135deg,#10B981,#3B82F6)',
]

export function initials(name: string): string {
  const parts = (name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Gradiente estável derivado do id/nome. */
export function gradFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_GRADS[h % AVATAR_GRADS.length]
}

export function Avatar({ name, seed, size = 26 }: { name: string; seed: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, background: gradFor(seed), flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: Math.round(size * 0.42), fontWeight: 700, letterSpacing: '-.02em',
    }}>{initials(name)}</span>
  )
}

export const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: T.bgOverlay, display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50,
}
export const modalStyle: CSSProperties = {
  ...cardStyle, border: `1px solid ${T.border2}`, boxShadow: T.shadowModal,
  width: 600, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto',
}

export function Toast({ text }: { text: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: T.bgSurface, border: `1px solid ${T.border2}`, borderRadius: 10,
      padding: '12px 16px', fontSize: 13, color: T.text1, boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      zIndex: 80, display: 'flex', alignItems: 'center', gap: 9,
    }}>
      <span style={{ color: T.success, display: 'inline-flex' }}><IcCheck size={15} /></span>
      {text}
    </div>
  )
}
