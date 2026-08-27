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

const TABS: { id: FeedbackTab; label: string; icon: string; subtitle: string }[] = [
  { id: 'ajuda', label: 'Central de Ajuda', icon: '📘', subtitle: 'Guias passo a passo de cada tela da plataforma.' },
  { id: 'feedback', label: 'Enviar feedback', icon: '💬', subtitle: 'Conte o que está funcionando bem e o que pode melhorar.' },
  { id: 'suporte', label: 'Reportar problema / suporte', icon: '🛟', subtitle: 'Descreva um problema ou envie uma sugestão para o time.' },
]

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function GuideText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <p className="m-0 text-[14px]" style={{ color: T.text2, lineHeight: 1.7 }}>
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

function blocksOf(view: string): OnboardingGuideBlock[] {
  const tip = ONBOARDING_TIPS[view]
  if (!tip) return []
  return tip.guide?.length ? tip.guide : tip.steps.map(s => ({ text: s }))
}

function ArticleHeader({ section, title, subtitle, children }: {
  section: string; title: string; subtitle: string; children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[11px] uppercase tracking-wider" style={{ color: T.text3 }}>
        Ajuda &amp; Suporte › {section}
      </p>
      <h1 className="m-0 font-bold" style={{ color: T.text1, fontSize: 28, letterSpacing: '-0.02em' }}>{title}</h1>
      <p className="m-0 text-[14px]" style={{ color: T.text2, lineHeight: 1.7 }}>{subtitle}</p>
      {children}
    </div>
  )
}

function HelpArticle({ view, onNav }: { view: string; onNav?: (v: string) => void }) {
  const tip = ONBOARDING_TIPS[view]
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  if (!tip) return null
  const blocks = blocksOf(view)
  const intro = (tip.guide?.length ? tip.guide[0].text : tip.steps.join(' ')).replace(/\*\*/g, '')
  const label = viewLabel(view, tip.title)

  return (
    <article className="flex flex-col" style={{ gap: 40 }}>
      <ArticleHeader section={`Central de Ajuda › ${label}`} title={label} subtitle={intro}>
        {view === 'home' && (
          <button
            onClick={() => { onNav?.('projects-list'); startProjectTour() }}
            className="self-start mt-2 h-9 px-4 rounded-lg text-[13px] font-semibold"
            style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}
          >▶ Iniciar tour: criar um projeto</button>
        )}
      </ArticleHeader>

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

function HelpOverview({ groups, onPick }: {
  groups: { section: string; items: { view: string; label: string }[] }[]
  onPick: (v: string) => void
}) {
  return (
    <article className="flex flex-col" style={{ gap: 40 }}>
      <ArticleHeader
        section="Central de Ajuda"
        title="Central de Ajuda"
        subtitle="Escolha uma tela na navegação ao lado para ver o guia completo, com passos e capturas de tela."
      />
      <div className="flex flex-col" style={{ gap: 28 }}>
        {groups.map(g => (
          <section key={g.section} className="flex flex-col gap-3">
            <h3 className="m-0 font-semibold" style={{ color: T.text1, fontSize: 18 }}>{g.section}</h3>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {g.items.map(it => (
                <button
                  key={it.view}
                  onClick={() => onPick(it.view)}
                  className="text-left px-3 py-2.5 rounded-xl text-[13px]"
                  style={{ background: T.bgSurface, color: T.text2, border: `1px solid ${T.border}` }}
                >{it.label}</button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}

export default function FeedbackPage({ onNav }: { onNav?: (view: string) => void }) {
  const { activeUser } = useSession()
  const [tab, setTab] = useState<FeedbackTab>('feedback')
  const [helpView, setHelpView] = useState<string | null>(null)
  const [helpExpanded, setHelpExpanded] = useState(true)
  const [query, setQuery] = useState('')

  const [screenUrl, setScreenUrl] = useState('')
  const [screen, setScreen] = useState<{ label: string; view: string | null } | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [supportType, setSupportType] = useState<Exclude<FeedbackType, 'feedback'>>('problema')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  const headings = helpView
    ? blocksOf(helpView).map((b, i) => ({ id: `${slugify(blockHeading(b))}-${i}`, label: blockHeading(b) }))
    : []

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

  function selectTab(id: FeedbackTab) {
    if (id === 'ajuda') {
      setTab('ajuda')
      setHelpView(null)
      setHelpExpanded(true)
    } else {
      setTab(id)
    }
    setError(null)
  }

  const meta = TABS.find(t => t.id === tab)!

  function navItem(id: FeedbackTab) {
    const t = TABS.find(x => x.id === id)!
    const on = tab === id && !(id === 'ajuda' && helpView)
    const parentOn = tab === id
    return (
      <button
        key={id}
        onClick={() => {
          if (id === 'ajuda' && tab === 'ajuda') {
            setHelpExpanded(prev => !prev)
            setHelpView(null)
          } else {
            selectTab(id)
          }
        }}
        aria-pressed={parentOn}
        className="text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2"
        style={{
          background: on ? T.accentDim : parentOn ? T.bgSurface : 'transparent',
          color: parentOn ? T.accent : T.text2,
          borderLeft: `2px solid ${on ? T.accent : 'transparent'}`,
        }}
      >
        <span aria-hidden style={{ fontSize: 13 }}>{t.icon}</span>
        <span className="truncate">{t.label}</span>
      </button>
    )
  }

  const formCard = (
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
  )

  return (
    <div className="flex w-full items-start gap-8 px-6 py-8">
      {/* Coluna esquerda — navegação única */}
      <aside className="hidden md:flex flex-col gap-3 flex-shrink-0 sticky top-6" style={{ width: 250, maxHeight: 'calc(100vh - 48px)' }}>
        <p className="m-0 px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>
          Ajuda &amp; Suporte
        </p>
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1">
          {navItem('ajuda')}
          {tab === 'ajuda' && helpExpanded && (
            <div className="flex flex-col gap-2 pl-3 pb-2">
              <button
                onClick={() => { setHelpExpanded(false); setHelpView(null) }}
                className="text-left px-2 h-8 rounded-lg text-[12px] font-medium transition-colors"
                style={{ background: 'transparent', color: T.text2 }}
                onMouseEnter={e => { e.currentTarget.style.color = T.text1 }}
                onMouseLeave={e => { e.currentTarget.style.color = T.text2 }}
              >
                ‹ Voltar ao menu
              </button>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar na ajuda…"
                className="w-full h-8 px-2.5 rounded-lg text-[12px] outline-none"
                style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border}` }}
              />
              {groups.length === 0 && (
                <p className="m-0 text-[12px]" style={{ color: T.text3 }}>Nenhuma tela encontrada.</p>
              )}
              {groups.map(g => (
                <div key={g.section} className="flex flex-col gap-0.5">
                  <p className="m-0 mb-0.5 px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>{g.section}</p>
                  {g.items.map(it => {
                    const on = helpView === it.view
                    return (
                      <button
                        key={it.view}
                        onClick={() => setHelpView(it.view)}
                        className="text-left px-2.5 py-1 rounded-md text-[12px] transition-colors"
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
            </div>
          )}
          {navItem('feedback')}
          {navItem('suporte')}
        </nav>
      </aside>

      {/* Coluna central — artigo */}
      <main className="flex-1 min-w-0 flex flex-col gap-6 mx-auto" style={{ maxWidth: 820 }}>
        {/* Navegação mobile */}
        <div className="md:hidden flex flex-col gap-2">
          <select
            value={tab === 'ajuda' && helpView ? `help:${helpView}` : tab}
            onChange={e => {
              const v = e.target.value
              if (v.startsWith('help:')) { selectTab('ajuda'); setHelpView(v.slice(5)) }
              else { selectTab(v as FeedbackTab) }
            }}
            className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
            style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border}` }}
          >
            <option value="ajuda">Central de Ajuda</option>
            {allItems.map(it => <option key={it.view} value={`help:${it.view}`}>{`   ${it.label}`}</option>)}
            <option value="feedback">Enviar feedback</option>
            <option value="suporte">Reportar problema / suporte</option>
          </select>
        </div>

        {tab === 'ajuda' ? (
          helpView
            ? <HelpArticle view={helpView} onNav={onNav} />
            : <HelpOverview groups={groups} onPick={setHelpView} />
        ) : (
          <article className="flex flex-col" style={{ gap: 24 }}>
            <ArticleHeader section={meta.label} title={meta.label} subtitle={meta.subtitle} />
            {tab === 'suporte' && (
              <div className="rounded-xl px-4 py-3" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
                <p className="m-0 text-[13px]" style={{ color: T.text2, lineHeight: 1.7 }}>
                  Antes de abrir um chamado, veja a{' '}
                  <button
                    onClick={() => { selectTab('ajuda'); setHelpView(null) }}
                    className="underline"
                    style={{ color: T.accent }}
                  >Central de Ajuda</button>
                  {' '}— a resposta pode já estar lá. Use o suporte por último.
                </p>
              </div>
            )}
            {formCard}
          </article>
        )}
      </main>

      {/* Coluna direita — índice */}
      {tab === 'ajuda' && helpView && headings.length > 0 && (
        <aside className="hidden xl:flex flex-col gap-2 flex-shrink-0 sticky top-6" style={{ width: 210, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.text3 }}>Nesta página</p>
          {headings.map(h => (
            <a key={h.id} href={`#${h.id}`} className="text-[12px]" style={{ color: T.text2, textDecoration: 'none', lineHeight: 1.5 }}>{h.label}</a>
          ))}
        </aside>
      )}
    </div>
  )
}
