import { useMemo, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { useSession } from '@/data/SessionContext'
import { createFeedback, type FeedbackType } from '@/data/db/feedback'
import { screenLabelFromUrl } from '@/lib/screenLabel'
import { ONBOARDING_TIPS } from '@/data/onboardingContent'
import type { OnboardingGuideBlock } from '@/data/onboardingContent'
import { VIEW_LABELS } from '@/App'
import { startProjectTour } from '@/hooks/useProjectTour'

const RATINGS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Muito ruim' },
  { value: 2, emoji: '😐', label: 'Ruim' },
  { value: 3, emoji: '🙂', label: 'Ok' },
  { value: 4, emoji: '😃', label: 'Bom' },
  { value: 5, emoji: '🤩', label: 'Excelente' },
]

type FeedbackTab = 'feedback' | 'suporte' | 'ajuda'

const TABS: { id: FeedbackTab; label: string }[] = [
  { id: 'feedback', label: 'Enviar feedback' },
  { id: 'suporte', label: 'Reportar problema / suporte' },
  { id: 'ajuda', label: 'Central de Ajuda' },
]

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function GuideText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <p className="m-0 text-[12px]" style={{ color: T.text2 }}>
      {parts.map((p, i) => (i % 2 === 1
        ? <strong key={i} style={{ color: T.text1 }}>{p}</strong>
        : <span key={i}>{p}</span>))}
    </p>
  )
}

const HELP_SECTIONS: { section: string; views: string[] }[] = [
  { section: 'Começar', views: ['home'] },
  { section: 'Meu dia a dia', views: ['my-tasks', 'calendar'] },
  { section: 'Gestão', views: ['projects-list', 'boards-list', 'list', 'gantt', 'timeline', 'dashboard', 'storage'] },
  { section: 'Planejamento', views: ['epics', 'releases', 'filters', 'navigator'] },
  { section: 'Configuração', views: ['config', 'tenant-settings', 'modules', 'automations', 'team', 'client-access', 'client', 'client-messages', 'reports'] },
  { section: 'Conta e acesso', views: ['profile', 'preferences', 'login', 'client-login'] },
]

function slugify(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function blockHeading(b: OnboardingGuideBlock): string {
  if (b.heading) return b.heading
  const plain = b.text.replace(/\*\*/g, '')
  const cut = plain.split(/[—:.(]/)[0].trim()
  const words = cut.split(/\s+/).slice(0, 7).join(' ')
  return words.length > 2 ? words : plain.slice(0, 40)
}

function viewLabel(view: string, fallback: string): string {
  return (VIEW_LABELS as Record<string, string>)[view] ?? fallback
}

function HelpArticle({ view, onNav }: { view: string; onNav?: (v: string) => void }) {
  const tip = ONBOARDING_TIPS[view]
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  if (!tip) return null
  const blocks: OnboardingGuideBlock[] = tip.guide?.length
    ? tip.guide
    : tip.steps.map(s => ({ text: s }))
  const intro = tip.guide?.length ? tip.guide[0].text : tip.steps.join(' ')
  const label = viewLabel(view, tip.title)

  return (
    <article className="flex flex-col" style={{ gap: 32 }}>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[11px] uppercase tracking-wider" style={{ color: T.text3 }}>
          Central de Ajuda › {label}
        </p>
        <h1 className="m-0 font-bold" style={{ color: T.text1, fontSize: 28, letterSpacing: '-0.02em' }}>{label}</h1>
        <p className="m-0 text-[14px]" style={{ color: T.text2, lineHeight: 1.7 }}>{intro.replace(/\*\*/g, '')}</p>
        {view === 'home' && (
          <button
            onClick={() => { onNav?.('projects-list'); startProjectTour() }}
            className="self-start mt-2 h-9 px-4 rounded-lg text-[13px] font-semibold"
            style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}
          >▶ Iniciar tour: criar um projeto</button>
        )}
      </div>

      {blocks.length > 1 && (
        <div className="rounded-xl p-4" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
          <p className="m-0 mb-2 text-[12px] font-semibold" style={{ color: T.text1 }}>Neste guia você vai aprender:</p>
          <ul className="m-0 pl-4 flex flex-col gap-1">
            {blocks.map((b, i) => (
              <li key={i} className="text-[13px]" style={{ color: T.text2 }}>
                <a href={`#${slugify(blockHeading(b))}-${i}`} style={{ color: T.accent, textDecoration: 'none' }}>
                  {blockHeading(b)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col" style={{ gap: 40 }}>
        {blocks.map((b, i) => (
          <section key={i} id={`${slugify(blockHeading(b))}-${i}`} className="flex flex-col gap-3" style={{ scrollMarginTop: 96 }}>
            <h3 className="m-0 font-semibold" style={{ color: T.text1, fontSize: 18 }}>{blockHeading(b)}</h3>
            <GuideText text={b.text} />
            {b.image && !broken[b.image] && (
              <img
                src={b.image}
                alt={b.imageAlt ?? b.text}
                loading="lazy"
                style={{
                  maxWidth: '100%',
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  boxShadow: T.shadow1,
                }}
                onError={() => setBroken(prev => ({ ...prev, [b.image as string]: true }))}
              />
            )}
          </section>
        ))}
      </div>
    </article>
  )
}

function HelpCenter({ onNav, onTab }: { onNav?: (view: string) => void; onTab?: (t: 'feedback' | 'suporte') => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('home')

  const groups = useMemo(() => {
    const q = norm(query.trim())
    return HELP_SECTIONS.map(g => ({
      section: g.section,
      items: g.views
        .filter(v => ONBOARDING_TIPS[v])
        .map(v => ({ view: v, label: viewLabel(v, ONBOARDING_TIPS[v].title) }))
        .filter(it => !q || norm(it.label).includes(q) ||
          norm(ONBOARDING_TIPS[it.view].steps.join(' ')).includes(q) ||
          norm((ONBOARDING_TIPS[it.view].guide ?? []).map(b => b.text).join(' ')).includes(q)),
    })).filter(g => g.items.length > 0)
  }, [query])

  const allItems = groups.flatMap(g => g.items)
  const tip = ONBOARDING_TIPS[active]
  const headings = (tip?.guide?.length ? tip.guide : (tip?.steps ?? []).map(s => ({ text: s })))
    .map((b, i) => ({ id: `${slugify(blockHeading(b as OnboardingGuideBlock))}-${i}`, label: blockHeading(b as OnboardingGuideBlock) }))

  return (
    <div className="flex w-full items-start gap-8">
      {/* Navegação esquerda */}
      <aside className="hidden md:flex flex-col gap-4 flex-shrink-0 sticky top-6" style={{ width: 250, maxHeight: 'calc(100vh - 48px)' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar na ajuda…"
          className="w-full h-9 px-3 rounded-lg text-[13px] outline-none flex-shrink-0"
          style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border}` }}
        />
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-1">
          {groups.length === 0 && (
            <p className="m-0 text-[12px]" style={{ color: T.text3 }}>Nenhuma tela encontrada.</p>
          )}
          {groups.map(g => (
            <div key={g.section} className="flex flex-col gap-0.5">
              <p className="m-0 mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>{g.section}</p>
              {g.items.map(it => {
                const on = it.view === active
                return (
                  <button
                    key={it.view}
                    onClick={() => setActive(it.view)}
                    className="text-left px-3 py-1.5 rounded-md text-[13px] transition-colors"
                    style={{
                      background: on ? T.accentDim : 'transparent',
                      color: on ? T.accent : T.text2,
                      borderLeft: `2px solid ${on ? T.accent : 'transparent'}`,
                      fontWeight: on ? 600 : 400,
                    }}
                  >{it.label}</button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="flex-shrink-0 pt-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
          <p className="m-0 text-[11px]" style={{ color: T.text3 }}>Não encontrou o que procurava?</p>
          <div className="flex gap-2">
            <button
              onClick={() => onTab?.('feedback')}
              className="h-8 px-3 rounded-lg text-[12px] font-medium"
              style={{ background: T.bgSurface2, color: T.text2, border: `1px solid ${T.border}` }}
            >Enviar feedback</button>
            <button
              onClick={() => onTab?.('suporte')}
              className="h-8 px-3 rounded-lg text-[12px] font-medium"
              style={{ background: T.bgSurface2, color: T.text2, border: `1px solid ${T.border}` }}
            >Reportar problema</button>
          </div>
        </div>
      </aside>

      {/* Artigo */}
      <main className="flex-1 min-w-0 flex flex-col gap-5" style={{ maxWidth: 820 }}>
        <div className="md:hidden flex flex-col gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar na ajuda…"
            className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
            style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border}` }}
          />
          <select
            value={active}
            onChange={e => setActive(e.target.value)}
            className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
            style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border}` }}
          >
            {allItems.map(it => <option key={it.view} value={it.view}>{it.label}</option>)}
          </select>
        </div>
        <HelpArticle view={active} onNav={onNav} />
      </main>

      {/* Índice direita */}
      <aside className="hidden xl:flex flex-col gap-2 flex-shrink-0 sticky top-6" style={{ width: 210, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
        <p className="m-0 text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>Nesta página</p>
        {headings.map(h => (
          <a key={h.id} href={`#${h.id}`} className="text-[12px]" style={{ color: T.text2, textDecoration: 'none', lineHeight: 1.5 }}>{h.label}</a>
        ))}
      </aside>
    </div>
  )
}

export default function FeedbackPage({ onNav }: { onNav?: (view: string) => void }) {
  const { activeUser } = useSession()
  const [tab, setTab] = useState<FeedbackTab>('feedback')

  const [screenUrl, setScreenUrl] = useState('')
  const [screen, setScreen] = useState<{ label: string; view: string | null } | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [supportType, setSupportType] = useState<Exclude<FeedbackType, 'feedback'>>('problema')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function applyUrl(value: string) {
    setScreenUrl(value)
    const parsed = value.trim() ? screenLabelFromUrl(value) : null
    setScreen(parsed && parsed.label ? parsed : null)
  }

  function clearScreen() {
    setScreenUrl('')
    setScreen(null)
  }

  function resetForm() {
    clearScreen()
    setRating(null)
    setMessage('')
    setSupportType('problema')
  }

  async function submit() {
    setError(null)
    if (!message.trim()) {
      setError(tab === 'feedback' ? 'Escreva um comentário.' : 'Descreva o problema ou a sugestão.')
      return
    }
    if (tab === 'feedback' && !rating) {
      setError('Selecione uma nota de 1 a 5.')
      return
    }
    setBusy(true)
    try {
      const ok = await createFeedback(
        {
          type: tab === 'feedback' ? 'feedback' : supportType,
          rating: tab === 'feedback' ? rating : null,
          message,
          screenUrl: screenUrl.trim() || null,
          screenLabel: screen?.label ?? null,
        },
        { userId: activeUser.user_id, name: activeUser.name },
      )
      if (!ok) throw new Error('Não foi possível registrar seu envio.')
      resetForm()
      setToast('Obrigado pelo seu feedback!')
      setTimeout(() => setToast(null), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full items-start gap-6 px-6 py-8">
      {/* Menu lateral */}
      <nav className="flex flex-col gap-1 flex-shrink-0" style={{ width: 200 }}>
        <p className="m-0 mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>
          Feedback &amp; Suporte
        </p>
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => { setTab(id); setError(null) }}
              aria-pressed={active}
              className="text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
              style={{
                background: active ? T.accentDim : 'transparent',
                color: active ? T.accent : T.text2,
                border: `1px solid ${active ? T.accentBorder : 'transparent'}`,
              }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 max-w-3xl">
      {tab === 'ajuda' ? <HelpCenter onNav={onNav} /> : (
      <>
      <header className="mb-6">
        <h1 className="m-0 text-[20px] font-semibold" style={{ color: T.text1 }}>Feedback &amp; Suporte</h1>
        <p className="mt-1 mb-0 text-[12px]" style={{ color: T.text2 }}>
          Conte o que está funcionando bem e o que precisa melhorar. Apenas texto — não anexe arquivos.
        </p>
      </header>

      <section className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>

        {/* Tela referenciada */}
        <div>
          <label className="block text-[12px] font-medium mb-1.5" style={{ color: T.text1 }}>Tela referenciada</label>
          {screen ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (screen.view && onNav) onNav(screen.view) }}
                className="text-[13px] font-semibold underline"
                style={{ color: T.accent, cursor: screen.view ? 'pointer' : 'default' }}
                title={screenUrl}
              >
                {screen.label.toUpperCase()}
              </button>
              <button
                onClick={clearScreen}
                aria-label="Limpar tela referenciada"
                className="h-5 w-5 rounded-full text-[11px] leading-none"
                style={{ background: T.bgSurface2, color: T.text3, border: `1px solid ${T.border}` }}
              >×</button>
            </div>
          ) : (
            <input
              value={screenUrl}
              onChange={e => setScreenUrl(e.target.value)}
              onBlur={e => applyUrl(e.target.value)}
              onPaste={e => setTimeout(() => applyUrl((e.target as HTMLInputElement).value), 0)}
              placeholder="Cole aqui o link da tela (opcional)"
              className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
              style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border}` }}
            />
          )}
        </div>

        {tab === 'feedback' ? (
          <div>
            <label className="block text-[12px] font-medium mb-2" style={{ color: T.text1 }}>Como foi sua experiência? *</label>
            <div className="flex gap-2">
              {RATINGS.map(r => {
                const active = rating === r.value
                return (
                  <button
                    key={r.value}
                    onClick={() => setRating(r.value)}
                    title={r.label}
                    aria-pressed={active}
                    className="h-12 w-12 rounded-xl text-[22px] transition-transform"
                    style={{
                      background: active ? T.accentDim : T.bgSurface2,
                      border: `1px solid ${active ? T.accentBorder : T.border}`,
                      transform: active ? 'scale(1.06)' : 'none',
                    }}
                  >{r.emoji}</button>
                )
              })}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-[12px] font-medium mb-2" style={{ color: T.text1 }}>Tipo</label>
            <div className="flex gap-2">
              {([['problema', 'Problema'], ['sugestao', 'Sugestão']] as const).map(([id, label]) => {
                const active = supportType === id
                return (
                  <button
                    key={id}
                    onClick={() => setSupportType(id)}
                    aria-pressed={active}
                    className="h-9 px-4 rounded-lg text-[13px] font-medium"
                    style={{
                      background: active ? T.accentDim : T.bgSurface2,
                      color: active ? T.accent : T.text2,
                      border: `1px solid ${active ? T.accentBorder : T.border}`,
                    }}
                  >{label}</button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-[12px] font-medium mb-1.5" style={{ color: T.text1 }}>
            {tab === 'feedback' ? 'Comentário *' : 'Descrição *'}
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            placeholder={tab === 'feedback'
              ? 'O que você achou? O que podemos melhorar?'
              : 'Descreva o que aconteceu, o que você esperava e como reproduzir.'}
            className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
            style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border}` }}
          />
        </div>

        {error && (
          <p className="m-0 text-[12px]" style={{ color: T.crit }}>{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => { void submit() }}
            disabled={busy}
            className="h-9 px-5 rounded-lg text-[13px] font-semibold"
            style={{ background: T.accent, color: '#fff', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
          {toast && <span className="text-[12px]" style={{ color: T.success }}>{toast}</span>}
        </div>
      </section>
      </>
      )}
      <p className="mt-4 mb-0 text-[11px]" style={{ color: T.text3 }}>
        Precisa de ajuda com uma tela? Veja a Central de Ajuda ao lado.
      </p>
      </div>
    </div>

  )
}
