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
  const [selectedId, setSelectedId] = useState('')
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
        if (open.length > 0) {
          setSelectedId(open[0].id)
          setClientName(open[0].client_name ?? '')
        }
      } catch {
        if (alive) setError('Não foi possível carregar os projetos.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  function selectProject(id: string) {
    setSelectedId(id)
    const proj = eligible.find(p => p.id === id)
    setClientName(proj?.client_name ?? '')
  }

  async function handleContinue() {
    const proj = eligible.find(p => p.id === selectedId)
    if (!proj) return
    setSubmitting(true); setError('')
    try {
      const trimmed = clientName.trim()
      if (trimmed !== (proj.client_name ?? '')) {
        await updateProject(proj, { clientName: trimmed || null }, activeUser.name)
      }
      onNav('client-access', proj.id)
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
        Primeiro você escolhe qual projeto o cliente vai ver. No fim, o 1º acesso é cadastrado pela
        mesma jornada padrão de criação de acesso do cliente — processo idêntico em todo o produto.
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
          <Field label="Projeto a compartilhar">
            <select style={inputStyle} value={selectedId} onChange={e => selectProject(e.target.value)}>
              {eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
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

          <div style={{
            display: 'flex', gap: 10, padding: '11px 14px', borderRadius: 10,
            background: T.accentDim, border: `1px solid ${T.accentBorder}`, fontSize: 12, color: T.text2, marginBottom: 16,
          }}>
            <span>➡️</span>
            <div>Ao continuar, você vai para a jornada de criação de acesso do cliente com este projeto já selecionado, para cadastrar o 1º usuário. O dash sobe ativo assim que esse primeiro acesso é concluído.</div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={() => void handleContinue()}
              disabled={submitting || !selectedId}
              style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}
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
