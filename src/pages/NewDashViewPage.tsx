import { useEffect, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { LoadingState, EmptyState } from '@/components/ds/DashboardKit'
import { listProjects, updateProject, type ProjectRow } from '@/data/db/projects'
import { fetchDashViewOverview } from '@/data/db/clientPortal'
import { useSession } from '@/data/SessionContext'

interface Props {
  onBack: () => void
  onNav: (view: string, targetId?: string) => void
}

const cardStyle: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
}

const inputStyle: React.CSSProperties = {
  background: T.bgPage, border: `1px solid ${T.border2}`, borderRadius: 7,
  padding: '9px 11px', fontSize: 13, color: T.text1, outline: 'none', width: '100%',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.text3, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  )
}

export default function NewDashViewPage({ onBack, onNav }: Props) {
  const { activeUser } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eligible, setEligible] = useState<ProjectRow[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [clientName, setClientName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError('')
      try {
        const [{ projects }, overview] = await Promise.all([listProjects(), fetchDashViewOverview()])
        if (!alive) return
        const already = new Set(overview.dashes.map(d => d.projectId))
        const open = projects.filter(p => !already.has(p.id) && p.status !== 'archived')
        setEligible(open)
      } catch {
        if (alive) setError('Não foi possível carregar os projetos.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  function toggleProject(id: string) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      // Com 1 projeto selecionado, sugere o cliente responsável já cadastrado nele.
      if (next.length === 1) {
        const proj = eligible.find(p => p.id === next[0])
        setClientName(proj?.client_name ?? '')
      } else {
        setClientName('')
      }
      return next
    })
  }

  async function handleContinue() {
    const selected = eligible.filter(p => selectedIds.includes(p.id))
    if (selected.length === 0) return
    setSubmitting(true); setError('')
    try {
      const trimmed = clientName.trim()
      if (trimmed) {
        await Promise.all(
          selected
            .filter(p => (p.client_name ?? '') !== trimmed)
            .map(p => updateProject(p, { clientName: trimmed }, activeUser.name)),
        )
      }
      onNav('client-access', selectedIds.join(','))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao preparar o dash.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 24, background: T.bgPage, minHeight: '100%' }}>
      <div onClick={onBack} style={{ fontSize: 12.5, color: T.accent, cursor: 'pointer', marginBottom: 14, display: 'inline-block' }}>
        ← Voltar para a gestão
      </div>

      <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text1 }}>Novo Dash View</h1>
      <p style={{ margin: '6px 0 20px', fontSize: 13, color: T.text2, maxWidth: 620 }}>
        Escolha o(s) projeto(s) que o cliente vai ver. No próximo passo você cadastra o 1º usuário.
      </p>

      {loading && <LoadingState rows={3} />}

      {!loading && eligible.length === 0 && !error && (
        <div style={cardStyle}>
          <div style={{ padding: '8px 0' }}>
            <EmptyState
              message="Todos os projetos ativos do tenant já têm um dash compartilhado."
              action={{ label: 'Ver dashes existentes', onClick: onBack }}
            />
          </div>
        </div>
      )}

      {!loading && eligible.length > 0 && (
        <div style={{ ...cardStyle, padding: 22, maxWidth: 560 }}>
          <Field label="Projeto(s) a compartilhar">
            <div style={{ marginBottom: 12 }}>
              <span style={{ background: T.accentDim, border: `1px solid ${T.accentBorder}`, color: T.accent, borderRadius: 20, padding: '3px 12px', fontSize: 12 }}>
                {selectedIds.length} projeto(s) selecionado(s)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {eligible.map(p => {
                const selected = selectedIds.includes(p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleProject(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      background: selected ? T.accentDim : T.bgSurface2,
                      border: `1px solid ${selected ? T.accentBorder : T.border}`,
                      borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected ? T.accent : T.border2}`,
                      background: selected ? T.accent : 'transparent', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff',
                    }}>
                      {selected && '✓'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text1 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>
                        {p.client_name ? `Cliente atual: ${p.client_name}` : 'Sem cliente definido'} · {p.status}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Field>

          <Field label="Cliente responsável">
            <input
              style={inputStyle}
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Nome do cliente"
            />
          </Field>

          {error && <div style={{ fontSize: 12, color: T.crit, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={() => void handleContinue()}
              disabled={submitting || selectedIds.length === 0}
              style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: submitting ? 'default' : 'pointer', opacity: submitting || selectedIds.length === 0 ? 0.6 : 1 }}
            >
              {submitting ? 'Preparando…' : 'Criar dash e cadastrar 1º acesso →'}
            </button>
          </div>
        </div>
      )}

      {!loading && error && eligible.length === 0 && (
        <div style={{ ...cardStyle, padding: 16, color: T.crit, fontSize: 13 }}>{error}</div>
      )}
    </div>
  )
}
