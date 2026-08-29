import { useEffect, useState } from 'react'
import { T } from '../components/ds/tokens'
import { useSession } from '../data/SessionContext'
import { can } from '../data/permissions'
import {
  getTenantSettings, updateTenantSettings, getTenantIdentity,
  checkSlug, changeSlug,
  type TenantSettings, type TenantIdentity, type SlugCheck,
} from '../data/db/tenant'

const CHECK_LABEL: Record<SlugCheck, { label: string; color: string }> = {
  available:   { label: 'Disponível',                 color: T.success },
  unavailable: { label: 'Já em uso',                  color: T.crit },
  reserved:    { label: 'Palavra reservada',          color: T.warn },
  invalid:     { label: 'Formato inválido',           color: T.crit },
}

const TIMEZONES = ['America/Sao_Paulo', 'America/Manaus', 'America/Bahia', 'UTC', 'Europe/Lisbon']
const LOCALES   = ['pt-BR', 'en-US', 'es-ES']

const inputStyle: React.CSSProperties = {
  background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8,
  color: T.text1, padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%',
}
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: T.text3, marginBottom: 6, display: 'block' }

export default function TenantSettingsPage() {
  const { activeUser } = useSession()
  const allowed = can(activeUser.permissions as never, 'users:manage') || activeUser.permissions.includes('*')

  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [identity, setIdentity] = useState<TenantIdentity | null>(null)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState<string | null>(null)

  const [slugDraft, setSlugDraft]   = useState('')
  const [slugCheck, setSlugCheck]   = useState<SlugCheck | null>(null)
  const [checking, setChecking]     = useState(false)
  const [changingSlug, setChanging] = useState(false)

  useEffect(() => {
    if (!allowed) { setLoading(false); return }
    let alive = true
    ;(async () => {
      setLoading(true)
      const [s, i] = await Promise.all([getTenantSettings(), getTenantIdentity()])
      if (!alive) return
      setSettings(s)
      setIdentity(i)
      if (!i) setError('Não foi possível carregar os dados do tenant.')
      setLoading(false)
    })()
    return () => { alive = false }
  }, [allowed])

  // validação de slug em tempo real (debounce)
  useEffect(() => {
    const value = slugDraft.trim()
    if (!value) { setSlugCheck(null); return }
    setChecking(true)
    const id = setTimeout(async () => {
      const result = await checkSlug(value, activeUser.name)
      setSlugCheck(result)
      setChecking(false)
    }, 450)
    return () => { clearTimeout(id); setChecking(false) }
  }, [slugDraft, activeUser.name])

  function fire(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400) }

  function patch(p: Partial<TenantSettings>) {
    setSettings(prev => (prev ? { ...prev, ...p } : prev))
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    const ok = await updateTenantSettings({
      display_name:  settings.display_name,
      timezone:      settings.timezone,
      locale:        settings.locale,
      logo_url:      settings.logo_url,
      primary_color: settings.primary_color,
    }, activeUser.name)
    setSaving(false)
    fire(ok ? 'Configurações salvas.' : 'Não foi possível salvar.')
  }

  async function applySlug() {
    if (slugCheck !== 'available') return
    setChanging(true)
    const res = await changeSlug(slugDraft.trim(), activeUser.name)
    setChanging(false)
    if (res.ok) {
      setIdentity(prev => (prev ? { ...prev, slug: slugDraft.trim().toLowerCase(), slug_status: 'active' } : prev))
      setSlugDraft('')
      setSlugCheck(null)
      fire('Slug atualizado.')
    } else {
      fire('Não foi possível trocar o slug.')
    }
  }

  if (!allowed) {
    return (
      <div style={{ padding: 32, color: T.text3, fontSize: 14 }}>
        Você não tem permissão para acessar as Configurações do Tenant.
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: 32, color: T.text3, fontSize: 14 }}>Carregando configurações…</div>
  }

  return (
    <div style={{ padding: 28, maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text1, margin: 0 }}>Configurações do Tenant</h1>
        <p style={{ fontSize: 13, color: T.text3, marginTop: 4 }}>
          Identidade visual, localização e endereço público da sua organização.
        </p>
      </div>

      {error && (
        <div style={{
          background: T.bgSurface, border: `1px solid ${T.crit}`, borderRadius: 10,
          padding: '10px 14px', color: T.crit, fontSize: 13, marginBottom: 20,
        }}>{error}</div>
      )}

      {/* ── Identidade / slug ── */}
      <section data-tour="tenant-slug" style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, marginBottom: 14 }}>Endereço público</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <span style={labelStyle}>Slug atual</span>
            <div style={{ ...inputStyle, color: T.text2, background: T.bgSurface, opacity: 0.85 }}>
              {identity?.slug ?? '— não definido —'}
            </div>
          </div>
          <div>
            <span style={labelStyle}>Status do tenant</span>
            <div style={{ ...inputStyle, color: T.text2, background: T.bgSurface, opacity: 0.85 }}>
              {identity?.status ?? '—'}
              {identity?.type ? ` · ${identity.type.toUpperCase()}` : ''}
            </div>
          </div>
        </div>

        {identity?.document_last4 && (
          <div style={{ fontSize: 12, color: T.text3, marginBottom: 16 }}>
            Documento cadastrado: •••• {identity.document_last4} · verificação: {identity.document_verification_status ?? 'unverified'}
          </div>
        )}

        <span style={labelStyle}>Trocar slug</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={slugDraft}
            onChange={e => setSlugDraft(e.target.value)}
            placeholder="minha-empresa"
            style={{ ...inputStyle, maxWidth: 320 }}
          />
          <span style={{ fontSize: 12, color: checking ? T.text3 : (slugCheck ? CHECK_LABEL[slugCheck].color : T.text3) }}>
            {checking ? 'Verificando…' : slugCheck ? CHECK_LABEL[slugCheck].label : 'Mínimo 3 caracteres (a–z, 0–9, hífen)'}
          </span>
          <button
            onClick={applySlug}
            disabled={slugCheck !== 'available' || changingSlug}
            style={{
              marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: `1px solid ${T.border}`, cursor: slugCheck === 'available' ? 'pointer' : 'not-allowed',
              background: slugCheck === 'available' ? T.accent : T.bgSurface2,
              color: slugCheck === 'available' ? '#0b0e14' : T.text3,
            }}
          >
            {changingSlug ? 'Trocando…' : 'Trocar slug'}
          </button>
        </div>
      </section>

      {/* ── Branding / localização ── */}
      <section data-tour="tenant-identity" style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, marginBottom: 14 }}>Identidade e localização</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <span style={labelStyle}>Nome de exibição</span>
            <input value={settings?.display_name ?? ''} onChange={e => patch({ display_name: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}>URL do logo</span>
            <input value={settings?.logo_url ?? ''} onChange={e => patch({ logo_url: e.target.value })} placeholder="https://…" style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}>Cor primária</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={settings?.primary_color || '#7d92ff'}
                onChange={e => patch({ primary_color: e.target.value })}
                style={{ width: 40, height: 34, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: 2 }}
              />
              <input value={settings?.primary_color ?? ''} onChange={e => patch({ primary_color: e.target.value })} placeholder="#7d92ff" style={inputStyle} />
            </div>
          </div>
          <div>
            <span style={labelStyle}>Fuso horário</span>
            <select value={settings?.timezone ?? 'America/Sao_Paulo'} onChange={e => patch({ timezone: e.target.value })} style={inputStyle}>
              {TIMEZONES.map(tz => <option key={tz} value={tz} style={{ background: T.bgSurface2 }}>{tz}</option>)}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Idioma</span>
            <select value={settings?.locale ?? 'pt-BR'} onChange={e => patch({ locale: e.target.value })} style={inputStyle}>
              {LOCALES.map(l => <option key={l} value={l} style={{ background: T.bgSurface2 }}>{l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer', background: T.accent, color: '#0b0e14',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </section>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: T.bgSurface2,
          border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px',
          color: T.text1, fontSize: 13, boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
        }}>{toast}</div>
      )}
    </div>
  )
}
