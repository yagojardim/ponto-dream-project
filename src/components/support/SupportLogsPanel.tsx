import { useCallback, useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import {
  fetchRecentLogs, fetchLogsByCorrelation,
  type SupportLogRow, type SupportLogLevel,
} from '@/data/db/supportLogs'

const DEFAULT_LIMIT = 50

const LEVEL_STYLE: Record<SupportLogLevel, { color: string; dim: string; label: string }> = {
  error: { color: T.crit, dim: T.critDim, label: 'Erro' },
  warn: { color: T.warn, dim: T.warnDim, label: 'Alerta' },
  info: { color: T.accent, dim: T.accentDim, label: 'Info' },
  debug: { color: T.neutral, dim: T.neutralDim, label: 'Debug' },
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
}

function LevelBadge({ level }: { level: SupportLogLevel }) {
  const s = LEVEL_STYLE[level] ?? LEVEL_STYLE.info
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: s.dim, color: s.color, border: `1px solid ${s.color}44` }}
    >
      {s.label}
    </span>
  )
}

function LogItem({ row }: { row: SupportLogRow }) {
  const [open, setOpen] = useState(false)
  const hasContext = row.context && Object.keys(row.context).length > 0
  return (
    <li className="rounded-xl p-3 flex flex-col gap-2" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <LevelBadge level={row.level} />
        {row.area && (
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: T.bgSurface2, color: T.text2 }}>
            {row.area}
          </span>
        )}
        <span className="text-[11px] ml-auto" style={{ color: T.text3 }}>{fmtWhen(row.created_at)}</span>
      </div>
      <p className="m-0 text-[13px]" style={{ color: T.text1, lineHeight: 1.5, wordBreak: 'break-word' }}>{row.message}</p>
      <div className="flex items-center gap-3 flex-wrap">
        {row.correlation_id && (
          <span className="text-[11px]" style={{ color: T.text3 }}>
            código:{' '}
            <code style={{ userSelect: 'all', color: T.text2, fontFamily: 'monospace' }}>{row.correlation_id}</code>
          </span>
        )}
        {hasContext && (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-[11px] underline"
            style={{ color: T.accent }}
          >
            {open ? 'ocultar contexto' : 'ver contexto'}
          </button>
        )}
      </div>
      {open && hasContext && (
        <pre
          className="m-0 text-[11px] overflow-x-auto rounded-lg p-2"
          style={{ background: T.bgPage, color: T.text2, border: `1px solid ${T.border}`, maxHeight: 240 }}
        >
          {JSON.stringify(row.context, null, 2)}
        </pre>
      )}
    </li>
  )
}

/**
 * Painel de Suporte / Diagnóstico (admin do tenant): lista os últimos eventos
 * de support_logs e permite buscar por código de correlação (correlation_id).
 * A leitura é escopada por RLS ao próprio tenant e a admins.
 */
export default function SupportLogsPanel() {
  const [rows, setRows] = useState<SupportLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const loadRecent = useCallback(async () => {
    setLoading(true)
    setSearching(false)
    const data = await fetchRecentLogs(DEFAULT_LIMIT)
    setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => { void loadRecent() }, [loadRecent])

  async function runSearch() {
    const id = query.trim()
    if (!id) { void loadRecent(); return }
    setLoading(true)
    setSearching(true)
    const data = await fetchLogsByCorrelation(id)
    setRows(data)
    setLoading(false)
  }

  return (
    <article className="flex flex-col" style={{ gap: 20 }}>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[11px] uppercase tracking-wider" style={{ color: T.text3 }}>
          Ajuda &amp; Suporte › Diagnóstico
        </p>
        <h1 className="m-0 font-bold" style={{ color: T.text1, fontSize: 28, letterSpacing: '-0.02em' }}>
          Diagnóstico
        </h1>
        <p className="m-0 text-[14px]" style={{ color: T.text2, lineHeight: 1.7 }}>
          Últimos eventos registrados neste workspace. Ao receber um chamado, busque pelo{' '}
          <strong style={{ color: T.text1 }}>código do erro</strong> informado pelo usuário para ver o que aconteceu.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void runSearch() }}
          placeholder="Buscar por código de correlação…"
          className="flex-1 min-w-0 h-9 px-3 rounded-lg text-[13px] outline-none"
          style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border}` }}
        />
        <button
          onClick={() => void runSearch()}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold flex-shrink-0"
          style={{ background: T.accent, color: '#fff' }}
        >
          Buscar
        </button>
        <button
          onClick={() => { setQuery(''); void loadRecent() }}
          className="h-9 px-4 rounded-lg text-[13px] font-medium flex-shrink-0"
          style={{ background: T.bgSurface2, color: T.text2, border: `1px solid ${T.border}` }}
        >
          {searching ? 'Ver recentes' : 'Atualizar'}
        </button>
      </div>

      {loading ? (
        <p className="m-0 text-[13px]" style={{ color: T.text3 }}>Carregando eventos…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
          <p className="m-0 text-[13px]" style={{ color: T.text2 }}>
            {searching
              ? 'Nenhum evento encontrado para este código.'
              : 'Nenhum evento registrado ainda. Erros do produto aparecem aqui com um código de correlação.'}
          </p>
        </div>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {rows.map(r => <LogItem key={r.id} row={r} />)}
        </ul>
      )}
    </article>
  )
}
