import { useState } from 'react'
import { T } from '@/components/ds/tokens'
import {
  getTheme, setTheme, getLang, setLang,
  LANGUAGES, type ThemeMode, type LangCode,
} from '@/lib/appPrefs'

export default function PreferencesPage() {
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme())
  const [lang, setLangState] = useState<LangCode>(() => getLang())
  const [saved, setSaved] = useState<string | null>(null)

  function pickTheme(mode: ThemeMode) {
    setThemeState(mode)
    setTheme(mode)
    setSaved('Tema salvo.')
  }

  function pickLang(code: LangCode) {
    setLangState(code)
    setLang(code)
    setSaved('Idioma salvo.')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="m-0 text-[20px] font-semibold" style={{ color: T.text1 }}>Preferências</h1>
        <p className="mt-1 mb-0 text-[12px]" style={{ color: T.text2 }}>
          Ajustes salvos apenas neste navegador.
        </p>
      </header>

      <section data-tour="pr-theme" className="rounded-2xl p-6" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
        <h2 className="m-0 text-[14px] font-semibold" style={{ color: T.text1 }}>Tema</h2>
        <p className="mt-1 mb-4 text-[12px]" style={{ color: T.text2 }}>
          O Altech Project é otimizado para o tema escuro.
        </p>
        <div className="flex gap-2">
          {(['dark', 'light'] as ThemeMode[]).map(mode => {
            const active = theme === mode
            return (
              <button
                key={mode}
                onClick={() => pickTheme(mode)}
                className="h-9 px-4 rounded-lg text-[13px] font-medium transition-colors"
                style={{
                  background: active ? T.accentDim : T.bgSurface2,
                  color: active ? T.accent : T.text2,
                  border: `1px solid ${active ? T.accentBorder : T.border}`,
                }}
                aria-pressed={active}
              >
                {mode === 'dark' ? 'Escuro' : 'Claro'}
              </button>
            )
          })}
        </div>
      </section>

      <section data-tour="pr-language" className="mt-4 rounded-2xl p-6" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
        <h2 className="m-0 text-[14px] font-semibold" style={{ color: T.text1 }}>Idioma</h2>
        <p className="mt-1 mb-4 text-[12px]" style={{ color: T.text2 }}>
          Idioma da interface. Outros idiomas estão em construção.
        </p>
        <select
          value={lang}
          onChange={e => pickLang(e.target.value as LangCode)}
          className="h-9 px-3 rounded-lg text-[13px]"
          style={{ background: T.bgSurface2, color: T.text1, border: `1px solid ${T.border2}` }}
          aria-label="Idioma da interface"
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code} disabled={l.disabled}>{l.label}</option>
          ))}
        </select>
      </section>

      {saved && (
        <p className="mt-3 mb-0 text-[12px]" style={{ color: T.success }} role="status">{saved}</p>
      )}
    </div>
  )
}
