import { T } from './tokens'

type Presence = 'online' | 'busy' | 'away' | 'none'
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

interface AvatarProps {
  name: string
  src?: string
  size?: AvatarSize
  presence?: Presence
  color?: string
  initials?: string
}

const sizes: Record<AvatarSize, { px: number; text: string; dot: number; dotOffset: number }> = {
  xs: { px: 20, text: '9px',  dot: 6,  dotOffset: -1 },
  sm: { px: 24, text: '10px', dot: 7,  dotOffset: -1 },
  md: { px: 32, text: '12px', dot: 9,  dotOffset: 0  },
  lg: { px: 40, text: '13px', dot: 11, dotOffset: 1  },
}

const presenceColor: Record<Presence, string> = {
  online: T.success,
  busy:   T.warn,
  away:   T.text3,
  none:   'transparent',
}

const palette = [
  '#5a7ef5', '#7c3aed', '#db2777', '#059669',
  '#d97706', '#0891b2', '#65a30d', '#9333ea',
  '#e11d48', '#0284c7',
]

function initials(name: string) {
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function hashColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

export function Avatar({ name, src, size = 'md', presence = 'none', color }: AvatarProps) {
  const s = sizes[size]
  const bg = color ?? hashColor(name)
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: s.px, height: s.px }}>
      {src ? (
        <img
          src={src} alt={name}
          className="rounded-full object-cover w-full h-full"
        />
      ) : (
        <span
          className="rounded-full flex items-center justify-center font-semibold text-white select-none w-full h-full"
          style={{ background: bg, fontSize: s.text }}
        >
          {initials(name)}
        </span>
      )}
      {presence !== 'none' && (
        <span
          className="absolute rounded-full"
          style={{
            width: s.dot, height: s.dot,
            background: presenceColor[presence],
            border: `2px solid ${T.bgSurface}`,
            bottom: s.dotOffset, right: s.dotOffset,
          }}
        />
      )}
    </span>
  )
}

interface AvatarGroupProps {
  names: string[]
  extra?: number
  size?: AvatarSize
}

export function AvatarGroup({ names, extra = 0, size = 'md' }: AvatarGroupProps) {
  const s = sizes[size]
  return (
    <div className="flex items-center">
      {names.map((n, i) => (
        <span
          key={n}
          style={{ marginLeft: i > 0 ? -Math.round(s.px * 0.35) : 0, zIndex: names.length - i, position: 'relative' }}
        >
          <span
            className="block rounded-full"
            style={{ outline: `2px solid ${T.bgSurface}` }}
          >
            <Avatar name={n} size={size} />
          </span>
        </span>
      ))}
      {extra > 0 && (
        <span
          className="rounded-full flex items-center justify-center font-semibold"
          style={{
            width: s.px, height: s.px,
            fontSize: s.text,
            marginLeft: -Math.round(s.px * 0.35),
            background: T.bgSurface2,
            border: `1px solid ${T.border}`,
            color: T.text2,
            outline: `2px solid ${T.bgSurface}`,
            position: 'relative',
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
