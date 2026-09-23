// Meeting Intelligence — ícones SVG reutilizáveis (mesmo traçado do mockup aprovado).
import type { ReactNode } from 'react'
import type { MeetingSource } from '@/data/db/meetings'

export function Icon({ children, size = 18, sw = 1.8, filled = false }: {
  children: ReactNode; size?: number; sw?: number; filled?: boolean
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}
    >{children}</svg>
  )
}

export function SourceIcon({ source, size = 17 }: { source: MeetingSource; size?: number }) {
  if (source === 'record') {
    return <Icon size={size}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4" /><path d="M8 21h8" /></Icon>
  }
  if (source === 'zoom' || source === 'meet' || source === 'teams') {
    return <Icon size={size}><path d="m16 8 5-3v14l-5-3" /><rect x="2" y="6" width="14" height="12" rx="2" /></Icon>
  }
  return <Icon size={size}><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Icon>
}

export const IcSpark = ({ size = 14 }: { size?: number }) => (
  <Icon size={size} filled><path d="m12 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></Icon>
)
export const IcStar = ({ size = 13 }: { size?: number }) => (
  <Icon size={size} filled><path d="m12 2 2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></Icon>
)
export const IcCopy = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Icon>
)
export const IcSearch = ({ size = 15 }: { size?: number }) => (
  <Icon size={size} sw={2}><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></Icon>
)
export const IcPaste = ({ size = 15 }: { size?: number }) => (
  <Icon size={size}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></Icon>
)
export const IcChevronRight = ({ size = 16 }: { size?: number }) => (
  <Icon size={size} sw={2}><path d="m9 18 6-6-6-6" /></Icon>
)
export const IcShare = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></Icon>
)
export const IcUsers = ({ size = 15 }: { size?: number }) => (
  <Icon size={size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /></Icon>
)
export const IcTrash = ({ size = 15 }: { size?: number }) => (
  <Icon size={size}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></Icon>
)
export const IcPlus = ({ size = 14 }: { size?: number }) => (
  <Icon size={size} sw={2.2}><path d="M12 5v14M5 12h14" /></Icon>
)
export const IcCheck = ({ size = 14 }: { size?: number }) => (
  <Icon size={size} sw={2.2}><path d="m5 12 5 5L20 7" /></Icon>
)
export const IcDownload = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Icon>
)
export const IcEdit = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Icon>
)
export const IcRefresh = ({ size = 16 }: { size?: number }) => (
  <Icon size={size}><path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3" /></Icon>
)
export const IcBell = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></Icon>
)
export const IcClock = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
)
export const IcGear = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8M4.6 9a1.6 1.6 0 0 0-.3-1.8M15 4.6a1.6 1.6 0 0 0 1.8.3M9 19.4a1.6 1.6 0 0 0-1.8-.3" /></Icon>
)
export const IcMic = ({ size = 15 }: { size?: number }) => (
  <Icon size={size}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4" /><path d="M8 21h8" /></Icon>
)
export const IcShield = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>
)
export const IcHelp = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></Icon>
)
export const IcClose = ({ size = 18 }: { size?: number }) => (
  <Icon size={size} sw={2}><path d="M18 6 6 18M6 6l12 12" /></Icon>
)
export const IcPlay = ({ size = 15 }: { size?: number }) => (
  <Icon size={size} filled><path d="M8 5v14l11-7z" /></Icon>
)
export const IcPause = ({ size = 15 }: { size?: number }) => (
  <Icon size={size} filled><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></Icon>
)
