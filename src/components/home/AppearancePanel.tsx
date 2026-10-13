// Painel "Aparência" do Início (mockup aprovado "Aparência do Início"):
// prévia ao vivo, 7 paletas, intensidade (40–130%), itens em azul seguem a paleta
// e, para o Admin Master, "Só para mim" ou "Toda a empresa".
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { T } from '@/components/ds/tokens'
import {
  PALETTES, INTENSITY_MIN, INTENSITY_MAX, DEFAULT_APPEARANCE,
  appearanceVars, paletteOf, worstContrast,
  type Appearance, type PaletteId,
} from '@/data/appearance'

export type AppearanceScope = 'me' | 'all'

export interface AppearancePanelProps {
  /** Aparência em vigor (ponto de partida do rascunho). */
  current: Appearance
  canChooseScope: boolean
  /** Escopo inicial: "Toda a empresa" quando a empresa já travou a paleta. */
  initialScope: AppearanceScope
  theme: 'dark' | 'light'
  /** Rascunho para a prévia ao vivo na tela (null = voltar ao que está salvo). */
  onPreview: (draft: Appearance | null) => void
  onApply: (draft: Appearance, scope: AppearanceScope) => Promise<void>
  onClose: () => void
}

const PANEL_CSS = `
@keyframes apIn { from { transform: translateX(104%) } to { transform: none } }
@keyframes apFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes apRise { from { opacity: 0; transform: translateY(14px) scale(.95) } to { opacity: 1; transform: none } }
.ap-sheet { animation: apIn .45s cubic-bezier(.32,.72,0,1) both }
.ap-scrim { animation: apFade .3s ease both }
.ap-sw { animation: apRise .5s cubic-bezier(.34,1.56,.64,1) both; transition: transform .3s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease }
.ap-sw:hover { transform: translateY(-3px) }
.ap-sw:active { transform: scale(.965) }
.ap-press:active { transform: scale(.96) }
.ap-range { -webkit-appearance: none; appearance: none; width: 100%; height: 28px; background: transparent; cursor: pointer }
.ap-range::-webkit-slider-runnable-track { height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--ap-draft-acc) var(--p), rgba(255,255,255,.14) var(--p)) }
.ap-range::-moz-range-track { height: 8px; border-radius: 4px; background: rgba(255,255,255,.14) }
.ap-range::-moz-range-progress { height: 8px; border-radius: 4px; background: var(--ap-draft-acc) }
.ap-range::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 7px; background: #fff; margin-top: -8px; box-shadow: 0 4px 12px rgba(0,0,0,.5) }
.ap-range::-moz-range-thumb { width: 24px; height: 24px; border: 0; border-radius: 7px; background: #fff }
.ap-sheet button:focus-visible, .ap-sheet input:focus-visible { outline: 2px solid #6AA8FF; outline-offset: 2px }
@media (prefers-reduced-motion: reduce) {
  .ap-sheet, .ap-scrim, .ap-sw { animation: none !important; transition: none !important }
}`

const GLASS = { background: 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)', borderRadius: 8 } as const
const LABEL = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, fontWeight: 600, color: '#a3aac0', margin: '0 0 9px' } as const

export function AppearancePanel({ current, canChooseScope, initialScope, theme, onPreview, onApply, onClose }: AppearancePanelProps) {
  const [draft, setDraft] = useState<Appearance>(current)
  const [scope, setScope] = useState<AppearanceScope>(initialScope)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const swRefs = useRef<(HTMLButtonElement | null)[]>([])
  const drag = useRef<{ x: number; t: number; dx: number; v: number } | null>(null)

  // Prévia ao vivo: a tela acompanha o rascunho enquanto o painel está aberto.
  useEffect(() => { onPreview(draft) }, [draft, onPreview])

  function close() { onPreview(null); onClose() }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { onPreview(null); onClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onPreview, onClose])

  useEffect(() => {
    const i = PALETTES.findIndex(p => p.id === current.preset)
    const t = window.setTimeout(() => swRefs.current[Math.max(0, i)]?.focus({ preventScroll: true }), 420)
    return () => window.clearTimeout(t)
  }, [current.preset])

  const pal = paletteOf(draft.preset)
  const vars = appearanceVars(draft)
  const contrast = worstContrast(draft, theme)
  const contrastOk = contrast >= 4.5
  const pct = ((draft.intensity - INTENSITY_MIN) / (INTENSITY_MAX - INTENSITY_MIN)) * 100

  function pick(id: PaletteId) { setDraft(d => ({ ...d, preset: id })) }

  function onSwKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const d = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (!d) return
    e.preventDefault()
    const i = PALETTES.findIndex(p => p.id === draft.preset)
    const n = (i + d + PALETTES.length) % PALETTES.length
    pick(PALETTES[n].id)
    swRefs.current[n]?.focus()
  }

  async function apply() {
    setSaving(true)
    setError(null)
    try {
      await onApply(draft, canChooseScope ? scope : 'me')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a aparência.')
    } finally {
      setSaving(false)
    }
  }

  // Arrastar o topo para a direita fecha (acompanha o ponteiro; fecha por distância ou arremesso).
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, t: performance.now(), dx: 0, v: 0 }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ponteiro sintético */ }
    if (sheetRef.current) sheetRef.current.style.animation = 'none'
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || !sheetRef.current) return
    const now = performance.now()
    const dx = Math.max(0, e.clientX - d.x)
    d.v = (dx - d.dx) / Math.max(1, now - d.t)
    d.dx = dx
    d.t = now
    sheetRef.current.style.transform = `translateX(${dx}px)`
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d || !sheetRef.current) return
    if (d.dx > 110 || d.v > 0.6) close()
    else sheetRef.current.style.transform = ''
  }

  const scopeText = scope === 'me'
    ? 'Só você vê esta paleta. A funcionalidade fica liberada para os outros usuários escolherem a própria aparência.'
    : 'Todos veem esta paleta. A funcionalidade fica oculta para os outros usuários, que não conseguem alterar.'

  return (
    <>
      <style>{PANEL_CSS}</style>
      <div className="ap-scrim" onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(4,5,8,.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <aside ref={sheetRef} className="ap-sheet" role="dialog" aria-modal="true" aria-label="Aparência do Início"
        style={{
          ...vars, ['--ap-draft-acc' as string]: pal.accent, ['--p' as string]: `${pct}%`,
          position: 'fixed', top: 12, right: 12, bottom: 12, width: 'min(410px, calc(100vw - 24px))', zIndex: 1301,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, color: '#eef0f6',
          background: 'linear-gradient(180deg, rgba(30,33,45,.9), rgba(14,16,22,.96))',
          backdropFilter: 'blur(34px) saturate(1.8)', WebkitBackdropFilter: 'blur(34px) saturate(1.8)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1), 0 40px 90px rgba(0,0,0,.6)',
        }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(420px 260px at 100% 0, var(--ap-g1), transparent 70%), radial-gradient(360px 240px at 0 100%, var(--ap-g2), transparent 70%)' }} />

        {/* Cabeçalho (arraste para a direita para fechar) */}
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '20px 22px 14px', cursor: 'grab', touchAction: 'pan-y', userSelect: 'none', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <span aria-hidden style={{
            width: 46, height: 46, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff',
            background: `linear-gradient(145deg, ${pal.accent}, ${T.indigo})`, boxShadow: `0 10px 24px -8px ${pal.accent}, inset 0 0 0 1px rgba(255,255,255,.25)`,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3c-4.97 0-9 3.58-9 8 0 3.31 2.69 5 5 5h1.2c.9 0 1.3.7 1 1.5-.4 1.1.3 2.5 1.8 2.5 4.42 0 8-3.58 8-9 0-4.42-3.58-8-8-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="8" cy="10" r="1.2" fill="currentColor" /><circle cx="12" cy="7.5" r="1.2" fill="currentColor" /><circle cx="16" cy="10" r="1.2" fill="currentColor" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em' }}>Aparência</div>
            <div style={{ fontSize: 13, color: '#a3aac0', marginTop: 3 }}>Personalize o Início com a sua identidade.</div>
          </div>
          <span style={{ flex: 1 }} />
          <button className="ap-press" onClick={close} aria-label="Fechar" style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.1)', color: '#d4d8e6', cursor: 'pointer', fontSize: 15 }}>✕</button>
        </div>

        <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Prévia ao vivo */}
          <div aria-label="Prévia ao vivo" style={{
            position: 'relative', height: 128, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12), 0 14px 34px -12px rgba(0,0,0,.6)',
            background: 'radial-gradient(260px 150px at 92% 0, var(--ap-g1), transparent 70%), radial-gradient(220px 130px at 8% 100%, var(--ap-g2), transparent 70%), #0b0c11',
          }}>
            <span style={{ position: 'absolute', top: 10, left: 12, fontSize: 11, fontWeight: 600, color: '#dfe3f0', background: 'rgba(255,255,255,.1)', borderRadius: 5, padding: '3px 9px' }}>Prévia ao vivo</span>
            <span style={{ position: 'absolute', right: 14, top: 12, fontSize: 12, fontWeight: 600, color: 'var(--ap-acc-text)' }}>Abrir central →</span>
            <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              {[0, 1].map(i => (
                <div key={i} style={{ flex: 1, height: 54, borderRadius: 6, background: 'rgba(20,22,29,.78)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)', padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <i style={{ display: 'block', height: 6, width: '46%', borderRadius: 99, background: 'rgba(255,255,255,.22)' }} />
                  <i style={{ display: 'block', height: 6, width: '70%', borderRadius: 99, background: 'var(--ap-acc)' }} />
                </div>
              ))}
              <span style={{ background: 'var(--ap-acc)', color: '#fff', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 650 }}>Salvar</span>
            </div>
          </div>

          {/* Paletas */}
          <div>
            <div style={LABEL}><span>Paletas</span><em style={{ fontStyle: 'normal', fontWeight: 500, color: '#e9ecf5' }}>{pal.name}</em></div>
            <div role="radiogroup" aria-label="Paletas" onKeyDown={onSwKey} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {PALETTES.map((p, i) => {
                const on = p.id === draft.preset
                const pv = appearanceVars({ preset: p.id, intensity: 100, accentFollows: true })
                return (
                  <button key={p.id} ref={el => { swRefs.current[i] = el }} className="ap-sw" type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
                    aria-label={`${p.name}, ${p.mood}`} onClick={() => pick(p.id)}
                    style={{
                      animationDelay: `${i * 50 + 120}ms`, position: 'relative', textAlign: 'left', cursor: 'pointer', color: '#eef0f6',
                      background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, padding: 0, overflow: 'hidden',
                      boxShadow: on ? `inset 0 0 0 2px ${p.accent}, 0 0 0 4px ${p.accent}47, 0 16px 34px -14px ${p.accent}` : 'inset 0 0 0 1px rgba(255,255,255,.09)',
                    }}>
                    <div style={{ height: 64, position: 'relative', background: `radial-gradient(150px 80px at 92% 0, ${pv['--ap-g1']}, transparent 72%), radial-gradient(130px 70px at 6% 100%, ${pv['--ap-g2']}, transparent 72%), #0b0c11` }}>
                      {on && (
                        <span aria-hidden style={{ position: 'absolute', top: 9, right: 9, width: 22, height: 22, borderRadius: 6, background: '#fff', color: '#0b0c11', display: 'grid', placeItems: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.4l2.3 2.3L9.5 3.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '9px 12px 11px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <b style={{ fontSize: 13.5, fontWeight: 620 }}>{p.name}</b>
                      <span style={{ fontSize: 11.5, color: '#9aa1b6' }}>{p.mood}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Intensidade */}
          <div style={{ ...GLASS, padding: '16px 16px 14px', flexShrink: 0 }}>
            <div style={LABEL}><span>Intensidade</span><em style={{ fontStyle: 'normal', fontWeight: 500, color: '#e9ecf5' }}>{draft.intensity}%</em></div>
            <input id="ap-intensity" className="ap-range" type="range" min={INTENSITY_MIN} max={INTENSITY_MAX} step={5} value={draft.intensity}
              disabled={draft.preset === 'liso'} aria-label="Intensidade do degradê"
              onChange={e => setDraft(d => ({ ...d, intensity: Number(e.target.value) }))} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#8f96ab', marginTop: 2 }}><span>Suave</span><span>Intenso</span></div>
          </div>

          {/* Itens em azul seguem a paleta (só no Início) */}
          <div style={{ ...GLASS, padding: '14px 16px', flexShrink: 0 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, fontSize: 14, fontWeight: 550, cursor: 'pointer' }}>
              <span>Itens em azul seguem a paleta
                <small style={{ display: 'block', color: '#9aa1b6', fontSize: 12, marginTop: 3, fontWeight: 400, lineHeight: 1.4 }}>Botões, links, selo, barras, gráficos e foco do Início</small>
              </span>
              <input id="ap-accent" type="checkbox" role="switch" checked={draft.accentFollows}
                onChange={e => setDraft(d => ({ ...d, accentFollows: e.target.checked }))}
                style={{ width: 20, height: 20, accentColor: pal.accent, flexShrink: 0, cursor: 'pointer' }} />
            </label>
          </div>

          {/* Vale para (só Admin Master) */}
          {canChooseScope && (
            <div>
              <div style={LABEL}><span>Vale para</span></div>
              <div role="group" aria-label="Vale para" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'rgba(255,255,255,.08)', borderRadius: 8, padding: 3 }}>
                {(['me', 'all'] as AppearanceScope[]).map(v => (
                  <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className="ap-press"
                    style={{
                      fontSize: 13.5, fontWeight: 600, color: scope === v ? '#fff' : '#aab1c6', border: 'none', borderRadius: 6, padding: '9px 6px', cursor: 'pointer',
                      background: scope === v ? 'rgba(255,255,255,.18)' : 'transparent', boxShadow: scope === v ? '0 2px 8px rgba(0,0,0,.35)' : 'none',
                    }}>{v === 'me' ? 'Só para mim' : 'Toda a empresa'}</button>
                ))}
              </div>
              <p style={{ color: '#9aa1b6', fontSize: 12.5, margin: '10px 2px 0', lineHeight: 1.45 }}>{scopeText}</p>
            </div>
          )}

          {/* Contraste */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#aab1c6', lineHeight: 1.4, padding: '10px 12px', borderRadius: 8, flexShrink: 0,
            background: contrastOk ? 'rgba(52,199,123,.1)' : 'rgba(245,165,36,.12)',
            boxShadow: `inset 0 0 0 1px ${contrastOk ? 'rgba(52,199,123,.22)' : 'rgba(245,165,36,.3)'}`,
          }}>
            <span aria-hidden style={{ color: contrastOk ? '#34c77b' : '#f5a524', fontSize: 15 }}>{contrastOk ? '✓' : '!'}</span>
            <span>Contraste do texto sobre o ponto mais claro: <b style={{ color: '#fff' }}>{contrast.toFixed(1).replace('.', ',')}:1</b> {contrastOk ? '(nível AA)' : '(abaixo de 4,5:1: reduza a intensidade)'}</span>
          </div>

          {error && <div role="alert" style={{ fontSize: 12.5, color: '#fca5a5', background: 'rgba(239,68,68,.12)', borderRadius: 8, padding: '10px 12px' }}>{error}</div>}
        </div>

        {/* Rodapé */}
        <div style={{ position: 'relative', display: 'flex', gap: 10, padding: '14px 22px 20px', background: 'linear-gradient(180deg, transparent, rgba(10,11,16,.6) 40%)' }}>
          <button type="button" className="ap-press" onClick={() => setDraft(DEFAULT_APPEARANCE)}
            style={{ fontSize: 12, color: '#a2a8ba', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, padding: '8px 14px', cursor: 'pointer' }}>Restaurar</button>
          <button type="button" className="ap-press" onClick={apply} disabled={saving}
            style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#fff', background: pal.accent, border: 'none', borderRadius: 7, padding: '8px 14px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Aplicando…' : 'Aplicar aparência'}
          </button>
        </div>
      </aside>
    </>
  )
}
