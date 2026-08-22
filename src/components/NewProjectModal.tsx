import React, { useState } from 'react'
import { T } from './ds/tokens'
import { HelpHint } from './ds/HelpHint'

export interface NewProjectInput {
  name: string
  key: string
  description: string
  clientName: string | null
  boardType: 'scrum' | 'kanban'
  leadId: string | null
  usesFeatures: boolean
  periodStart: string | null
  periodEnd: string | null
}


interface Props {
  onClose: () => void
  onSuccess: (projectKey: string, projectName: string) => void
  /** Real persistence hook — when given, "Criar" inserts the project in the database. */
  onCreate?: (input: NewProjectInput) => Promise<void>
  /** Real leads loaded from the database. */
  leads?: { id: string; name: string; initials: string }[]
  /** Keys already used in the database (duplicate guard). */
  existingKeys?: string[]
  /** Nome do tenant atual — exibido como rótulo read-only. */
  tenantName?: string
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const dialog: React.CSSProperties = {
  width: 520,
  maxWidth: '95vw',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: T.bgSurface,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  boxShadow: T.shadowModal,
  display: 'flex',
  flexDirection: 'column',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: T.bgSurface2,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '8px 12px',
  color: T.text1,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: T.text2,
  marginBottom: 6,
  display: 'block',
}

export function NewProjectModal({ onClose, onSuccess, onCreate, leads, existingKeys, tenantName }: Props) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [key, setKey] = useState('')
  const [keyManual, setKeyManual] = useState(false)
  const [type, setType] = useState<'scrum' | 'kanban'>('scrum')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [lead, setLead] = useState<string>(leads?.[0]?.id ?? '')
  const [desc, setDesc] = useState('')
  const [usesFeatures, setUsesFeatures] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)


  const takenKeys = (existingKeys ?? []).map(k => k.toUpperCase())
  const isDuplicate = key.length > 0 && takenKeys.includes(key.toUpperCase())
  const canCreate = name.trim().length > 0 && key.length > 0 && !isDuplicate && !saving

  function handleNameChange(val: string) {
    setName(val)
    if (!keyManual) {
      const generated = val
        .split(/\s+/)
        .map(w => w[0] || '')
        .join('')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 6)
      setKey(generated)
    }
  }

  function handleKeyChange(val: string) {
    const filtered = val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
    setKey(filtered)
    setKeyManual(true)
  }

  async function handleCreate() {
    if (!canCreate) return
    setError(null)
    if (!onCreate) { setSuccess(true); return }
    setSaving(true)
    try {
      await onCreate({
        name: name.trim(),
        key,
        description: desc.trim(),
        clientName: client.trim() || null,
        boardType: type,
        leadId: lead || null,
        usesFeatures,
        periodStart: startDate || null,
        periodEnd: endDate || null,
      })
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o projeto.')
    } finally {
      setSaving(false)
    }
  }


  function handleReset() {
    setName('')
    setClient('')
    setKey('')
    setKeyManual(false)
    setType('scrum')
    setStartDate('')
    setEndDate('')
    setLead(leads?.[0]?.id ?? '')
    setDesc('')
    setUsesFeatures(false)
    setSuccess(false)
    setError(null)
  }


  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.text1 }}>Novo Projeto</span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6, border: 'none', background: 'transparent',
              color: T.text3, cursor: 'pointer', fontSize: 18, lineHeight: 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >×</button>
        </div>

        {success ? (
          /* ── Success state ── */
          <div style={{
            padding: '48px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            textAlign: 'center',
          }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill={T.successDim} />
              <path d="M20 33l9 9 15-17" stroke={T.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: T.text1, marginBottom: 8 }}>
                Projeto criado com sucesso!
              </p>
              <p style={{ fontSize: 14, color: T.accent, fontWeight: 600 }}>{name}</p>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                onClick={() => onSuccess(key, name)}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: T.accent,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >Abrir projeto →</button>
              <button
                onClick={handleReset}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: `1px solid ${T.border2}`,
                  background: 'transparent',
                  color: T.text2,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >Criar outro</button>
            </div>
          </div>
        ) : (
          <>
            {/* Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              {/* Tenant (read-only) */}
              <div>
                <label style={labelStyle}>Workspace</label>
                <div style={{ ...inputStyle, color: T.text2, background: T.bgSurface, cursor: 'default' }}>
                  {tenantName || 'Tenant atual'}
                </div>
              </div>

              {/* Name */}
              <div>
                <label style={labelStyle}>Nome do projeto <span style={{ color: T.crit }}>*</span> <HelpHint text="Nome completo do projeto, como ele aparece nas listas e no topo do board." /></label>
                <input
                  type="text"
                  placeholder="Ex: Website Relaunch"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Client */}
              <div>
                <label style={labelStyle}>Cliente <HelpHint text="Empresa ou cliente atendido por este projeto. Permite separar os projetos por cliente dentro da mesma organização (tenant)." /></label>
                <input
                  type="text"
                  placeholder="Ex: Cobasi"
                  value={client}
                  onChange={e => setClient(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Key */}
              <div>
                <label style={labelStyle}>Chave <span style={{ color: T.crit }}>*</span> <HelpHint title="Chave do projeto" text="Código curto (3-6 letras, maiúsculas) usado como prefixo das demandas — ex.: a chave WEB gera WEB-101, WEB-102. Serve para identificar e separar as demandas de cada projeto. Deve ser única no tenant e evite mudar depois." /></label>
                <input
                  type="text"
                  value={key}
                  onChange={e => handleKeyChange(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: isDuplicate ? T.crit : T.border,
                  }}
                />
                {isDuplicate && (
                  <p style={{ fontSize: 11, color: T.crit, marginTop: 4 }}>
                    Esta chave já está em uso.
                  </p>
                )}
                {!isDuplicate && key.length > 0 && (
                  <p style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>
                    Prefixo das issues: {key}-1, {key}-2…
                  </p>
                )}
              </div>

              {/* Type */}
              <div>
                <label style={labelStyle}>Tipo <HelpHint text="Scrum = trabalho organizado em sprints (ciclos). Kanban = fluxo contínuo sem sprints. Define as colunas padrão do board." /></label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['scrum', 'kanban'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: `1px solid ${type === t ? T.accentBorder : T.border}`,
                        background: type === t ? T.accentDim : T.bgSurface2,
                        color: type === t ? T.accent : T.text2,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        transition: 'all 0.15s',
                      }}
                    >
                      {t === 'scrum' ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
                          <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="5" width="4" height="14" rx="1.5" fill="currentColor" opacity="0.5" />
                          <rect x="10" y="5" width="4" height="10" rx="1.5" fill="currentColor" opacity="0.7" />
                          <rect x="17" y="5" width="4" height="7" rx="1.5" fill="currentColor" />
                        </svg>
                      )}
                      {t === 'scrum' ? 'Scrum' : 'Kanban'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Period */}
              <div>
                <label style={labelStyle}>Período <HelpHint text="Datas previstas de início e fim do projeto. Opcionais." /></label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, color: T.text3 }}>Data de início</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, color: T.text3 }}>Data de fim</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>
              </div>

              {/* Work structure / Features toggle */}
              <div>
                <label style={labelStyle}>Estrutura de trabalho <HelpHint title="Usar Funcionalidades" text="Ative para incluir um nível de 'Funcionalidade' entre o Épico e a História (Épico → Funcionalidade → História → Subtarefa). Desligado, a hierarquia é Épico → História → Subtarefa. Pode ser mudado depois nas configurações do projeto." /></label>
                <button type="button" onClick={() => setUsesFeatures(v => !v)}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'12px 14px', borderRadius:10, border:`1px solid ${usesFeatures?T.accentBorder:T.border}`, background:usesFeatures?T.accentDim:T.bgSurface2, color:usesFeatures?T.accent:T.text2, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                  <span>Usar Funcionalidades {usesFeatures ? '(ativado)' : '(desativado)'}</span>
                  <span style={{ width:36, height:20, borderRadius:999, background:usesFeatures?T.accent:T.border, position:'relative', transition:'all .15s' }}>
                    <span style={{ position:'absolute', top:2, left:usesFeatures?18:2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'all .15s' }} />
                  </span>
                </button>
              </div>

              {/* Lead */}

              <div>
                <label style={labelStyle}>Responsável <HelpHint text="Lead do projeto — responsável principal. É adicionado automaticamente como membro do projeto." /></label>
                <select
                  value={lead}
                  onChange={e => setLead(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {(leads ?? []).length === 0 && <option value="">Sem responsável</option>}
                  {(leads ?? []).map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.initials})</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Descrição <HelpHint text="Objetivo/resumo do projeto. Opcional." /></label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Descreva o objetivo do projeto..."
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 12, color: T.crit }}>{error}</p>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              padding: '16px 24px',
              borderTop: `1px solid ${T.border}`,
              flexShrink: 0,
            }}>
              <button
                onClick={onClose}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: `1px solid ${T.border2}`,
                  background: 'transparent',
                  color: T.text2,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >Cancelar</button>
              <button
                onClick={handleCreate}
                disabled={!canCreate}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: T.accent,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: canCreate ? 'pointer' : 'not-allowed',
                  opacity: canCreate ? 1 : 0.4,
                  transition: 'opacity 0.15s',
                }}
              >{saving ? 'Criando…' : 'Criar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
