// Parser do link colado pelo usuário → rótulo amigável da tela.
import { VIEW_LABELS } from '@/App'

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

let cache: Record<string, string> | null = null
function keyMap(): Record<string, string> {
  if (cache) return cache
  const map: Record<string, string> = {}
  for (const [view, label] of Object.entries(VIEW_LABELS)) {
    map[normalize(view)] = view
    map[normalize(label)] = view
  }
  cache = map
  return map
}

export function screenLabelFromUrl(url: string): { label: string; view: string | null } {
  const raw = (url ?? '').trim()
  if (!raw) return { label: '', view: null }

  // remove query/hash e pega o último segmento não vazio do caminho
  let path = raw.split('#')[0].split('?')[0]
  path = path.replace(/^[a-z]+:\/\/[^/]+/i, '')
  const segments = path.split('/').filter(Boolean)
  const segment = segments[segments.length - 1] ?? ''
  if (!segment) return { label: raw, view: null }

  const key = normalize(segment)
  const view = keyMap()[key] ?? null
  if (view) return { label: VIEW_LABELS[view as keyof typeof VIEW_LABELS], view }

  const pretty = segment.replace(/[-_]+/g, ' ')
  return { label: pretty.charAt(0).toUpperCase() + pretty.slice(1), view: null }
}
