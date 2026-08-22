import { useState } from 'react'
import { T } from '@/components/ds/tokens'
import { useSession } from '@/data/SessionContext'
import { createFeedback, type FeedbackType } from '@/data/db/feedback'
import { screenLabelFromUrl } from '@/lib/screenLabel'

const RATINGS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Muito ruim' },
  { value: 2, emoji: '😐', label: 'Ruim' },
  { value: 3, emoji: '🙂', label: 'Ok' },
  { value: 4, emoji: '😃', label: 'Bom' },
  { value: 5, emoji: '🤩', label: 'Excelente' },
]

export default function FeedbackPage({ onNav }: { onNav?: (view: string) => void }) {
  const { activeUser } = useSession()
  const [tab, setTab] = useState<'feedback' | 'suporte'>('feedback')

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
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="m-0 text-[20px] font-semibold" style={{ color: T.text1 }}>Feedback &amp; Suporte</h1>
        <p className="mt-1 mb-0 text-[12px]" style={{ color: T.text2 }}>
          Conte o que está funcionando bem e o que precisa melhorar. Apenas texto — não anexe arquivos.
        </p>
      </header>

      {/* Abas */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: T.bgSurface2, border: `1px solid ${T.border}` }}>
        {([['feedback', 'Enviar feedback'], ['suporte', 'Reportar problema / suporte']] as const).map(([id, label]) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => { setTab(id); setError(null) }}
              className="h-8 px-3 rounded-lg text-[12px] font-medium transition-colors"
              style={{
                background: active ? T.accentDim : 'transparent',
                color: active ? T.accent : T.text2,
                border: `1px solid ${active ? T.accentBorder : 'transparent'}`,
              }}
              aria-pressed={active}
            >
              {label}
            </button>
          )
        })}
      </div>

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
    </div>
  )
}
