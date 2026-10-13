// Aparência do Início: catálogo de paletas (mockup aprovado "Aparência do Início"),
// regra de quem vê e o que vale, e as variáveis CSS aplicadas só na tela de Início.
// Puro (sem banco): a leitura/gravação fica em src/data/db/appearance.ts.

export type PaletteId = 'azul-noite' | 'rosa' | 'verde-claro' | 'verde-escuro' | 'marrom' | 'cinza' | 'liso'

type Rgba = [number, number, number, number]

export interface Palette {
  id: PaletteId
  name: string
  mood: string
  /** Luz do topo (direita) e da base (esquerda), com a opacidade a 100% de intensidade. */
  g1: Rgba
  g2: Rgba
  /** Cor de destaque quando "itens em azul seguem a paleta" está ligado. */
  accent: string
  /** Cor do texto de destaque (links, selo) sobre o fundo escuro. */
  accentText: string
}

export const PALETTES: Palette[] = [
  { id: 'azul-noite', name: 'Azul noite', mood: 'Padrão', g1: [59, 130, 246, 0.27], g2: [99, 102, 241, 0.18], accent: '#3B82F6', accentText: '#5b93f0' },
  { id: 'rosa', name: 'Rosa', mood: 'Criativa', g1: [236, 72, 153, 0.26], g2: [168, 85, 247, 0.16], accent: '#DB2777', accentText: '#f472b6' },
  { id: 'verde-claro', name: 'Verde claro', mood: 'Fresca', g1: [74, 222, 128, 0.20], g2: [45, 212, 191, 0.13], accent: '#159947', accentText: '#4ade80' },
  { id: 'verde-escuro', name: 'Verde escuro', mood: 'Floresta', g1: [22, 163, 74, 0.26], g2: [15, 118, 110, 0.18], accent: '#15803D', accentText: '#4ade80' },
  { id: 'marrom', name: 'Marrom', mood: 'Terra', g1: [217, 140, 74, 0.24], g2: [146, 84, 46, 0.20], accent: '#B45309', accentText: '#e0a066' },
  { id: 'cinza', name: 'Cinza', mood: 'Neutra', g1: [148, 163, 184, 0.17], g2: [100, 116, 139, 0.16], accent: '#64748B', accentText: '#aab6c8' },
  { id: 'liso', name: 'Liso', mood: 'Sem degradê', g1: [0, 0, 0, 0], g2: [0, 0, 0, 0], accent: '#3B82F6', accentText: '#5b93f0' },
]

export const INTENSITY_MIN = 40
export const INTENSITY_MAX = 130

export interface Appearance {
  preset: PaletteId
  intensity: number
  accentFollows: boolean
}

export const DEFAULT_APPEARANCE: Appearance = { preset: 'azul-noite', intensity: 100, accentFollows: true }

/** Escolha da empresa: 'users-own' libera o botão para todos; 'company' trava a paleta para todos. */
export type CompanyMode = 'users-own' | 'company'
export interface CompanyAppearance extends Partial<Appearance> {
  mode: CompanyMode
}

export function paletteOf(id: string | undefined): Palette {
  return PALETTES.find(p => p.id === id) ?? PALETTES[0]
}

/** Normaliza o que vier do banco (campo livre em metadata). */
export function normalizeAppearance(raw: unknown): Appearance | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const preset = PALETTES.some(p => p.id === r.preset) ? (r.preset as PaletteId) : null
  if (!preset) return null
  const n = Number(r.intensity)
  const intensity = Number.isFinite(n) ? Math.min(INTENSITY_MAX, Math.max(INTENSITY_MIN, Math.round(n))) : 100
  return { preset, intensity, accentFollows: r.accentFollows !== false }
}

export function normalizeCompany(raw: unknown): CompanyAppearance | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.mode === 'users-own') return { mode: 'users-own' }
  if (r.mode === 'company') {
    const ap = normalizeAppearance(r)
    return ap ? { mode: 'company', ...ap } : null
  }
  return null
}

export interface AppearanceAccess {
  /** Pode abrir o painel Aparência. */
  canUse: boolean
  /** Pode escolher "Só para mim" ou "Toda a empresa". */
  canChooseScope: boolean
  /** A paleta foi definida pela empresa (os outros não podem alterar). */
  lockedByCompany: boolean
}

/**
 * Regra aprovada: o painel é do Admin Master. Ao aplicar "Só para mim" ele fica liberado
 * para todos (cada um escolhe a sua). Ao aplicar "Toda a empresa", a paleta vale para todos
 * e o painel some para os outros usuários.
 */
export function accessFor(isAdmin: boolean, company: CompanyAppearance | null): AppearanceAccess {
  const locked = company?.mode === 'company'
  return {
    canUse: isAdmin || company?.mode === 'users-own',
    canChooseScope: isAdmin,
    lockedByCompany: locked && !isAdmin,
  }
}

/** Ordem: empresa travada → escolha da pessoa → padrão (Azul noite). */
export function effectiveAppearance(isAdmin: boolean, personal: Appearance | null, company: CompanyAppearance | null): Appearance {
  if (company?.mode === 'company') return normalizeAppearance(company) ?? DEFAULT_APPEARANCE
  if (personal && (isAdmin || company?.mode === 'users-own')) return personal
  return DEFAULT_APPEARANCE
}

function rgba(c: Rgba, k: number, factor = 1): string {
  const a = Math.min(0.6, c[3] * (k / 100) * factor)
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a.toFixed(3)})`
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** No tema claro a luz fica mais suave (mesma proporção do mockup aprovado: 0,27 → 0,22). */
const LIGHT_FACTOR = 0.8

/** Variáveis CSS do Início para a aparência escolhida (luz nos dois temas + destaque). */
export function appearanceVars(ap: Appearance): Record<string, string> {
  const p = paletteOf(ap.preset)
  const k = ap.intensity
  const g1b: Rgba = [p.g1[0], p.g1[1], p.g1[2], p.g1[3] * 0.6]
  const accent = ap.accentFollows ? p.accent : PALETTES[0].accent
  const accentText = ap.accentFollows ? p.accentText : PALETTES[0].accentText
  const [r, g, b] = hexToRgb(accent)
  return {
    '--ap-g1': rgba(p.g1, k),
    '--ap-g1b': rgba(g1b, k),
    '--ap-g2': rgba(p.g2, k),
    '--ap-g1-light': rgba(p.g1, k, LIGHT_FACTOR),
    '--ap-g1b-light': rgba(g1b, k, LIGHT_FACTOR),
    '--ap-g2-light': rgba(p.g2, k, LIGHT_FACTOR),
    '--ap-acc': accent,
    '--ap-acc-text': accentText,
    '--ap-acc-soft': `rgba(${r}, ${g}, ${b}, 0.16)`,
    '--ap-acc-line': `rgba(${r}, ${g}, ${b}, 0.42)`,
  }
}

/** A cor de destaque muda em relação ao azul padrão? (só então o CSS de troca é ligado) */
export function accentChanges(ap: Appearance): boolean {
  return ap.accentFollows && paletteOf(ap.preset).accent.toLowerCase() !== PALETTES[0].accent.toLowerCase()
}

// ── Contraste (mesma conta do mockup): texto de apoio sobre o ponto mais forte da luz ──
function lum([r, g, b]: number[]): number {
  const a = [r, g, b].map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}
function mix(base: number[], c: Rgba, k: number, factor: number): number[] {
  const a = Math.min(0.6, c[3] * (k / 100) * factor)
  return [0, 1, 2].map(i => base[i] * (1 - a) + c[i] * a)
}
function ratio(bg: number[], fg: number[]): number {
  const l1 = lum(bg), l2 = lum(fg)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** Pior contraste do texto de apoio sobre a luz, para o tema atual. */
export function worstContrast(ap: Appearance, theme: 'dark' | 'light'): number {
  const p = paletteOf(ap.preset)
  const base = theme === 'light' ? [247, 247, 249] : [11, 12, 17]
  const text = theme === 'light' ? [85, 85, 107] : [162, 168, 186]
  const f = theme === 'light' ? LIGHT_FACTOR : 1
  return Math.min(ratio(mix(base, p.g1, ap.intensity, f), text), ratio(mix(base, p.g2, ap.intensity, f), text))
}
