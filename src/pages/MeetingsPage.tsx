import { useEffect, useMemo, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { useSession } from '@/data/SessionContext'
import { copyToClipboard } from '@/utils/copyToClipboard'
import {
  fetchMeetings, fetchMeeting, fetchProjectOptions, createMeeting, isMeetingModuleEnabled, summarizeMeeting,
  type MeetingListItem, type MeetingRow, timport { useEffect, useMemo, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { useSession } from '@/data/SessionContext'
import { copyToClipboard } from '@/utils/copyToClipboard'
import {
  fetchMeetings, fetchMeeting, fetchProjectOptions, createMeeting, isMeetingModuleEnabled, summarizeMeeting,
  type MeetingListItem, type MeetingRow, type MeetingProjectOption, type MeetingStatus, type MeetingSummary,
} from '@/data/db/meetings'

interface Props { onNav?: (view: string, targetId?: string) => void }

// Resumo automático por IA (Edge Function meeting-summarize + Claude).
// Fica DESLIGADO até contratar a conta Anthropic e setar o secret ANTHROPIC_API_KEY.
// Para ligar: troque para true (nenhuma outra mudança necessária).
const AI_SUMMARY_ENABLED = false

const STATUS_META: Record<MeetingStatus, { label: string; color: string }> = {
  processing: { label: 'Processando', color: T.warn },
  ready:      { label: 'Pronta',      color: T.success },
  failed:     { label: 'Falhou',      color: T.crit },
}

const cardStyle: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
}

function StatusPill({ status }: { status: MeetingStatus }) {
  const s = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.color, background: `${s.color}18`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />
      {s.label}
    </span>
  )
}

export default function MeetingsPage({ onNav: _onNav }: Props) {
  const { activeUser, isTenantOwner } = useSession()
  const isAdmin = isTenantOwner || activeUser.role_context === 'Admin'

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [rows, setRows]       = useState<MeetingListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [toast, setToast]     = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Gate: módulo liberado para o tenant?
  useEffect(() => {
    let alive = true
    void isMeetingModuleEnabled().then(v => { if (alive) setEnabled(v) })
    return () => { alive = false }
  }, [])

  // Lista de reuniões
  useEffect(() => {
    if (enabled !== true) return
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const list = await fetchMeetings({ ownerId: activeUser.user_id, isAdmin })
        if (alive) setRows(list)
      } catch {
        if (alive) setError('Não foi possível carregar as reuniões.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [enabled, activeUser.user_id, isAdmin, reloadKey])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  if (enabled === null) {
    return <div style={{ padding: 28, color: T.text3 }}>Carregando…</div>
  }
  if (enabled === false) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ ...cardStyle, padding: 28, maxWidth: 520 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text1 }}>Meeting Intelligence</h1>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: T.text2 }}>
            Este módulo premium ainda não está liberado para o seu workspace. Solicite a
            ativação em <b>Módulos</b> para começar a transcrever e resumir reuniões.
          </p>
        </div>
      </div>
    )
  }

  if (selectedId) {
    return <MeetingDetail id={selectedId} onBack={() => setSelectedId(null)} onToast={setToast} toast={toast} />
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: T.text1 }}>Reuniões</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: T.text2 }}>
            {isAdmin ? 'Todas as reuniões do workspace.' : 'Suas reuniões e as compartilhadas com você.'}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            height: 38, padding: '0 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          Colar transcrição
        </button>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 160px 130px 26px', gap: 16, padding: '12px 20px',
          borderBottom: `1px solid ${T.border}`, fontSize: 11, textTransform: 'uppercase',
          letterSpacing: '.06em', color: T.text3,
        }}>
          <div>Reunião</div><div>Projeto</div><div>Status</div><div />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.text3 }}>Carregando reuniões…</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.crit }}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.text3 }}>
            Nenhuma reunião ainda. Use <b>Colar transcrição</b> para criar a primeira.
          </div>
        ) : rows.map(m => (
          <div
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 160px 130px 26px', gap: 16, alignItems: 'center',
              padding: '14px 20px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
              <div style={{ fontSize: 12, color: T.text3 }}>{formatDate(m.createdAt)}</div>
            </div>
            <div style={{ fontSize: 13, color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.projectName ?? '—'}</div>
            <div><StatusPill status={m.status} /></div>
            <div style={{ color: T.text3 }}>›</div>
          </div>
        ))}
      </div>

      {createOpen && (
        <CreateMeetingModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => { setCreateOpen(false); setReloadKey(k => k + 1); setToast('Reunião criada.'); setSelectedId(id) }}
        />
      )}

      {toast && <Toast text={toast} />}
    </div>
  )
}

// ─── Detalhe ────────────────────────────────────────────────────────────────
function MeetingDetail({ id, onBack, onToast, toast }: {
  id: string; onBack: () => void; onToast: (t: string) => void; toast: string | null
}) {
  const [meeting, setMeeting] = useState<MeetingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<'resumo' | 'transcricao'>('resumo')
  const [generating, setGenerating] = useState(false)
  const [reloadKey, setReloadKey]   = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const m = await fetchMeeting(id)
        if (alive) { if (m) setMeeting(m); else setError('Reunião não encontrada.') }
      } catch {
        if (alive) setError('Não foi possível carregar a reunião.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, reloadKey])

  async function generate() {
    setGenerating(true)
    const ok = await summarizeMeeting(id)
    setGenerating(false)
    if (ok) { setReloadKey(k => k + 1); onToast('Resumo gerado.') }
    else onToast('Não foi possível gerar o resumo. Tente novamente.')
  }

  async function copyTranscript() {
    if (!meeting?.transcript) return
    const ok = await copyToClipboard(meeting.transcript)
    onToast(ok ? 'Transcrição copiada.' : 'Não foi possível copiar.')
  }

  const tabBtn = (key: 'resumo' | 'transcricao', label: string): React.CSSProperties => ({
    padding: '10px 14px', fontSize: 13.5, cursor: 'pointer', background: 'none',
    border: 'none', borderBottom: `2px solid ${tab === key ? T.accent : 'transparent'}`,
    color: tab === key ? T.accent : T.text2, fontWeight: tab === key ? 600 : 400, fontFamily: 'inherit',
  })

  return (
    <div style={{ padding: 28 }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 14, fontFamily: 'inherit' }}
      >‹ Reuniões</button>

      {loading ? (
        <div style={{ ...cardStyle, padding: 40, textAlign: 'center', color: T.text3 }}>Carregando…</div>
      ) : error || !meeting ? (
        <div style={{ ...cardStyle, padding: 40, textAlign: 'center', color: T.crit }}>{error ?? 'Reunião não encontrada.'}</div>
      ) : (
        <>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: T.text1 }}>{meeting.title}</h1>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, fontSize: 13, color: T.text2 }}>
            <span>{formatDate(meeting.created_at)}</span>
            <StatusPill status={meeting.status} />
          </div>

          <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.border}`, margin: '20px 0' }}>
            <button style={tabBtn('resumo', 'Resumo')} onClick={() => setTab('resumo')}>Resumo</button>
            <button style={tabBtn('transcricao', 'Transcrição')} onClick={() => setTab('transcricao')}>Transcrição</button>
          </div>

          {tab === 'resumo' ? (
            meeting.summary ? (
              <SummarySections summary={meeting.summary} onToast={onToast} />
            ) : (
              <div style={{ ...cardStyle, padding: 40, textAlign: 'center' }}>
                {AI_SUMMARY_ENABLED ? (
                  <>
                    <p style={{ margin: '0 0 16px', color: T.text3, fontSize: 14, lineHeight: 1.6 }}>
                      {generating
                        ? 'Gerando o resumo com o Meeting Intelligence… isso leva alguns segundos.'
                        : 'Ainda não há resumo para esta reunião.'}
                    </p>
                    <button
                      onClick={generate}
                      disabled={generating}
                      style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1, fontFamily: 'inherit' }}
                    >{generating ? 'Gerando…' : 'Gerar resumo com IA'}</button>
                  </>
                ) : (
                  <p style={{ margin: 0, color: T.text3, fontSize: 14, lineHeight: 1.6 }}>
                    O <b>resumo automático</b> (objetivo, decisões e próximos passos) chega em breve.
                    Por enquanto, use a aba <b>Transcrição</b>.
                  </p>
                )}
              </div>
            )
          ) : (
            <div style={{ ...cardStyle, padding: '8px 22px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12.5, color: T.text3 }}>Transcrição completa</span>
                <button
                  onClick={copyTranscript}
                  style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                >Copiar</button>
              </div>
              <div style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.7, color: T.text2, whiteSpace: 'pre-wrap' }}>
                {meeting.transcript || 'Sem transcrição.'}
              </div>
            </div>
          )}
        </>
      )}

      {toast && <Toast text={toast} />}
    </div>
  )
}

// ─── Modal de criação ─────────────────────────────────────────────────────────
function CreateMeetingModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (id: string) => void
}) {
  const { activeUser } = useSession()
  const [title, setTitle]           = useState('')
  const [projectId, setProjectId]   = useState<string>('')
  const [transcript, setTranscript] = useState('')
  const [projects, setProjects]     = useState<MeetingProjectOption[]>([])
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void fetchProjectOptions().then(list => { if (alive) setProjects(list) })
    return () => { alive = false }
  }, [])

  const canSave = useMemo(() => title.trim().length > 0 && transcript.trim().length > 0 && !saving, [title, transcript, saving])

  async function save() {
    if (!canSave) return
    setSaving(true); setErr(null)
    const id = await createMeeting(
      { title, projectId: projectId || null, transcript },
      activeUser.user_id,
    )
    setSaving(false)
    if (id) onCreated(id)
    else setErr('Não foi possível criar a reunião. Tente novamente.')
  }

  const field: React.CSSProperties = {
    width: '100%', background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8,
    color: T.text1, fontSize: 13.5, fontFamily: 'inherit', padding: '10px 12px', outline: 'none',
  }
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: 620, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: T.text1 }}>Colar transcrição</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={label}>Título</label>
            <input style={field} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Kickoff — Projeto X" />
          </div>
          <div>
            <label style={label}>Projeto (opcional)</label>
            <select style={field} value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Sem projeto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Transcrição</label>
            <textarea
              style={{ ...field, minHeight: 200, resize: 'vertical', lineHeight: 1.6 }}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Cole aqui a transcrição da reunião…"
            />
          </div>
          {err && <div style={{ fontSize: 13, color: T.crit }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 22px', borderTop: `1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button
            onClick={save}
            disabled={!canSave}
            style={{ height: 38, padding: '0 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.55, fontFamily: 'inherit' }}
          >{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Resumo (seções da ata) ─────────────────────────────────────────────────
function ataText(s: MeetingSummary): string {
  const L: string[] = []
  if (s.objetivo) L.push(`OBJETIVO\n${s.objetivo}`)
  if (s.assunto) L.push(`ASSUNTO\n${s.assunto}`)
  if (s.itens_discutidos?.length) L.push('ITENS DISCUTIDOS\n' + s.itens_discutidos.map(x => `- ${x}`).join('\n'))
  if (s.decisoes?.length) L.push('DECISÕES\n' + s.decisoes.map(x => `- ${x}`).join('\n'))
  if (s.pontos_definir?.length) L.push('PONTOS A DEFINIR\n' + s.pontos_definir.map(x => `- ${x}`).join('\n'))
  if (s.proximos_passos?.length) L.push('PRÓXIMOS PASSOS\n' + s.proximos_passos.map(a => `- ${a.text} (Responsável: ${a.assignee || '—'}; Data: ${a.due || '—'})`).join('\n'))
  return L.join('\n\n')
}

function SummarySections({ summary, onToast }: { summary: MeetingSummary; onToast: (t: string) => void }) {
  const label: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: T.text3, marginBottom: 6 }
  const line: React.CSSProperties = { fontSize: 14, lineHeight: 1.55, color: T.text2 }
  const bullets = (arr?: string[]) => (arr && arr.length)
    ? <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>{arr.map((x, i) => <li key={i} style={line}>{x}</li>)}</ul>
    : <div style={{ fontSize: 13, color: T.text3 }}>—</div>
  const sec = (t: string, node: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={label}>{t}</div>{node}</div>
  )
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${T.border}`, color: T.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }
  const td: React.CSSProperties = { padding: '9px 10px', borderBottom: `1px solid ${T.border}`, color: T.text2, verticalAlign: 'top', fontSize: 13.5 }

  async function copyAta() {
    const ok = await copyToClipboard(ataText(summary))
    onToast(ok ? 'Ata copiada.' : 'Não foi possível copiar.')
  }

  return (
    <div style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Resumo da reunião</div>
        <button onClick={copyAta} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Copiar ata</button>
      </div>
      {sec('Objetivo', <div style={line}>{summary.objetivo || '—'}</div>)}
      {sec('Assunto', <div style={line}>{summary.assunto || '—'}</div>)}
      {sec('Itens discutidos', bullets(summary.itens_discutidos))}
      {sec('Decisões', bullets(summary.decisoes))}
      {sec('Pontos a definir', bullets(summary.pontos_definir))}
      {sec('Próximos passos', (summary.proximos_passos && summary.proximos_passos.length)
        ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr><th style={th}>Descrição</th><th style={{ ...th, whiteSpace: 'nowrap' }}>Responsável</th><th style={{ ...th, whiteSpace: 'nowrap' }}>Data</th></tr></thead>
              <tbody>{summary.proximos_passos.map((a, i) => (
                <tr key={i}><td style={td}>{a.text}</td><td style={{ ...td, whiteSpace: 'nowrap' }}>{a.assignee || '—'}</td><td style={{ ...td, whiteSpace: 'nowrap' }}>{a.due || '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )
        : <div style={{ fontSize: 13, color: T.text3 }}>—</div>)}
      <div style={{ fontSize: 12, color: T.text3, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        Gerado pelo Meeting Intelligence — revise o conteúdo.
      </div>
    </div>
  )
}

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ text }: { text: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: '12px 16px', fontSize: 13, color: T.text1, boxShadow: '0 12px 40px rgba(0,0,0,.4)', zIndex: 80,
    }}>{text}</div>
  )
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}
ype MeetingProjectOption, type MeetingStatus, type MeetingSummary,
} from '@/data/db/meetings'

interface Props { onNav?: (view: string, targetId?: string) => void }

const STATUS_META: Record<MeetingStatus, { label: string; color: string }> = {
  processing: { label: 'Processando', color: T.warn },
  ready:      { label: 'Pronta',      color: T.success },
  failed:     { label: 'Falhou',      color: T.crit },
}

const cardStyle: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
}

function StatusPill({ status }: { status: MeetingStatus }) {
  const s = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.color, background: `${s.color}18`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />
      {s.label}
    </span>
  )
}

export default function MeetingsPage({ onNav: _onNav }: Props) {
  const { activeUser, isTenantOwner } = useSession()
  const isAdmin = isTenantOwner || activeUser.role_context === 'Admin'

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [rows, setRows]       = useState<MeetingListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [toast, setToast]     = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Gate: módulo liberado para o tenant?
  useEffect(() => {
    let alive = true
    void isMeetingModuleEnabled().then(v => { if (alive) setEnabled(v) })
    return () => { alive = false }
  }, [])

  // Lista de reuniões
  useEffect(() => {
    if (enabled !== true) return
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const list = await fetchMeetings({ ownerId: activeUser.user_id, isAdmin })
        if (alive) setRows(list)
      } catch {
        if (alive) setError('Não foi possível carregar as reuniões.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [enabled, activeUser.user_id, isAdmin, reloadKey])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  if (enabled === null) {
    return <div style={{ padding: 28, color: T.text3 }}>Carregando…</div>
  }
  if (enabled === false) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ ...cardStyle, padding: 28, maxWidth: 520 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text1 }}>Meeting Intelligence</h1>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: T.text2 }}>
            Este módulo premium ainda não está liberado para o seu workspace. Solicite a
            ativação em <b>Módulos</b> para começar a transcrever e resumir reuniões.
          </p>
        </div>
      </div>
    )
  }

  if (selectedId) {
    return <MeetingDetail id={selectedId} onBack={() => setSelectedId(null)} onToast={setToast} toast={toast} />
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: T.text1 }}>Reuniões</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: T.text2 }}>
            {isAdmin ? 'Todas as reuniões do workspace.' : 'Suas reuniões e as compartilhadas com você.'}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            height: 38, padding: '0 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          Colar transcrição
        </button>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 160px 130px 26px', gap: 16, padding: '12px 20px',
          borderBottom: `1px solid ${T.border}`, fontSize: 11, textTransform: 'uppercase',
          letterSpacing: '.06em', color: T.text3,
        }}>
          <div>Reunião</div><div>Projeto</div><div>Status</div><div />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.text3 }}>Carregando reuniões…</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.crit }}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.text3 }}>
            Nenhuma reunião ainda. Use <b>Colar transcrição</b> para criar a primeira.
          </div>
        ) : rows.map(m => (
          <div
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 160px 130px 26px', gap: 16, alignItems: 'center',
              padding: '14px 20px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
              <div style={{ fontSize: 12, color: T.text3 }}>{formatDate(m.createdAt)}</div>
            </div>
            <div style={{ fontSize: 13, color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.projectName ?? '—'}</div>
            <div><StatusPill status={m.status} /></div>
            <div style={{ color: T.text3 }}>›</div>
          </div>
        ))}
      </div>

      {createOpen && (
        <CreateMeetingModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => { setCreateOpen(false); setReloadKey(k => k + 1); setToast('Reunião criada.'); setSelectedId(id) }}
        />
      )}

      {toast && <Toast text={toast} />}
    </div>
  )
}

// ─── Detalhe ────────────────────────────────────────────────────────────────
function MeetingDetail({ id, onBack, onToast, toast }: {
  id: string; onBack: () => void; onToast: (t: string) => void; toast: string | null
}) {
  const [meeting, setMeeting] = useState<MeetingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<'resumo' | 'transcricao'>('resumo')
  const [generating, setGenerating] = useState(false)
  const [reloadKey, setReloadKey]   = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const m = await fetchMeeting(id)
        if (alive) { if (m) setMeeting(m); else setError('Reunião não encontrada.') }
      } catch {
        if (alive) setError('Não foi possível carregar a reunião.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, reloadKey])

  async function generate() {
    setGenerating(true)
    const ok = await summarizeMeeting(id)
    setGenerating(false)
    if (ok) { setReloadKey(k => k + 1); onToast('Resumo gerado.') }
    else onToast('Não foi possível gerar o resumo. Tente novamente.')
  }

  async function copyTranscript() {
    if (!meeting?.transcript) return
    const ok = await copyToClipboard(meeting.transcript)
    onToast(ok ? 'Transcrição copiada.' : 'Não foi possível copiar.')
  }

  const tabBtn = (key: 'resumo' | 'transcricao', label: string): React.CSSProperties => ({
    padding: '10px 14px', fontSize: 13.5, cursor: 'pointer', background: 'none',
    border: 'none', borderBottom: `2px solid ${tab === key ? T.accent : 'transparent'}`,
    color: tab === key ? T.accent : T.text2, fontWeight: tab === key ? 600 : 400, fontFamily: 'inherit',
  })

  return (
    <div style={{ padding: 28 }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 14, fontFamily: 'inherit' }}
      >‹ Reuniões</button>

      {loading ? (
        <div style={{ ...cardStyle, padding: 40, textAlign: 'center', color: T.text3 }}>Carregando…</div>
      ) : error || !meeting ? (
        <div style={{ ...cardStyle, padding: 40, textAlign: 'center', color: T.crit }}>{error ?? 'Reunião não encontrada.'}</div>
      ) : (
        <>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: T.text1 }}>{meeting.title}</h1>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, fontSize: 13, color: T.text2 }}>
            <span>{formatDate(meeting.created_at)}</span>
            <StatusPill status={meeting.status} />
          </div>

          <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.border}`, margin: '20px 0' }}>
            <button style={tabBtn('resumo', 'Resumo')} onClick={() => setTab('resumo')}>Resumo</button>
            <button style={tabBtn('transcricao', 'Transcrição')} onClick={() => setTab('transcricao')}>Transcrição</button>
          </div>

          {tab === 'resumo' ? (
            meeting.summary ? (
              <SummarySections summary={meeting.summary} onToast={onToast} />
            ) : (
              <div style={{ ...cardStyle, padding: 40, textAlign: 'center' }}>
                <p style={{ margin: '0 0 16px', color: T.text3, fontSize: 14, lineHeight: 1.6 }}>
                  {generating
                    ? 'Gerando o resumo com o Meeting Intelligence… isso leva alguns segundos.'
                    : 'Ainda não há resumo para esta reunião.'}
                </p>
                <button
                  onClick={generate}
                  disabled={generating}
                  style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1, fontFamily: 'inherit' }}
                >{generating ? 'Gerando…' : 'Gerar resumo com IA'}</button>
              </div>
            )
          ) : (
            <div style={{ ...cardStyle, padding: '8px 22px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12.5, color: T.text3 }}>Transcrição completa</span>
                <button
                  onClick={copyTranscript}
                  style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                >Copiar</button>
              </div>
              <div style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.7, color: T.text2, whiteSpace: 'pre-wrap' }}>
                {meeting.transcript || 'Sem transcrição.'}
              </div>
            </div>
          )}
        </>
      )}

      {toast && <Toast text={toast} />}
    </div>
  )
}

// ─── Modal de criação ─────────────────────────────────────────────────────────
function CreateMeetingModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (id: string) => void
}) {
  const { activeUser } = useSession()
  const [title, setTitle]           = useState('')
  const [projectId, setProjectId]   = useState<string>('')
  const [transcript, setTranscript] = useState('')
  const [projects, setProjects]     = useState<MeetingProjectOption[]>([])
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void fetchProjectOptions().then(list => { if (alive) setProjects(list) })
    return () => { alive = false }
  }, [])

  const canSave = useMemo(() => title.trim().length > 0 && transcript.trim().length > 0 && !saving, [title, transcript, saving])

  async function save() {
    if (!canSave) return
    setSaving(true); setErr(null)
    const id = await createMeeting(
      { title, projectId: projectId || null, transcript },
      activeUser.user_id,
    )
    setSaving(false)
    if (id) onCreated(id)
    else setErr('Não foi possível criar a reunião. Tente novamente.')
  }

  const field: React.CSSProperties = {
    width: '100%', background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8,
    color: T.text1, fontSize: 13.5, fontFamily: 'inherit', padding: '10px 12px', outline: 'none',
  }
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: 620, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: T.text1 }}>Colar transcrição</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={label}>Título</label>
            <input style={field} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Kickoff — Projeto X" />
          </div>
          <div>
            <label style={label}>Projeto (opcional)</label>
            <select style={field} value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Sem projeto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Transcrição</label>
            <textarea
              style={{ ...field, minHeight: 200, resize: 'vertical', lineHeight: 1.6 }}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Cole aqui a transcrição da reunião…"
            />
          </div>
          {err && <div style={{ fontSize: 13, color: T.crit }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 22px', borderTop: `1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button
            onClick={save}
            disabled={!canSave}
            style={{ height: 38, padding: '0 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.55, fontFamily: 'inherit' }}
          >{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Resumo (seções da ata) ─────────────────────────────────────────────────
function ataText(s: MeetingSummary): string {
  const L: string[] = []
  if (s.objetivo) L.push(`OBJETIVO\n${s.objetivo}`)
  if (s.assunto) L.push(`ASSUNTO\n${s.assunto}`)
  if (s.itens_discutidos?.length) L.push('ITENS DISCUTIDOS\n' + s.itens_discutidos.map(x => `- ${x}`).join('\n'))
  if (s.decisoes?.length) L.push('DECISÕES\n' + s.decisoes.map(x => `- ${x}`).join('\n'))
  if (s.pontos_definir?.length) L.push('PONTOS A DEFINIR\n' + s.pontos_definir.map(x => `- ${x}`).join('\n'))
  if (s.proximos_passos?.length) L.push('PRÓXIMOS PASSOS\n' + s.proximos_passos.map(a => `- ${a.text} (Responsável: ${a.assignee || '—'}; Data: ${a.due || '—'})`).join('\n'))
  return L.join('\n\n')
}

function SummarySections({ summary, onToast }: { summary: MeetingSummary; onToast: (t: string) => void }) {
  const label: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: T.text3, marginBottom: 6 }
  const line: React.CSSProperties = { fontSize: 14, lineHeight: 1.55, color: T.text2 }
  const bullets = (arr?: string[]) => (arr && arr.length)
    ? <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>{arr.map((x, i) => <li key={i} style={line}>{x}</li>)}</ul>
    : <div style={{ fontSize: 13, color: T.text3 }}>—</div>
  const sec = (t: string, node: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={label}>{t}</div>{node}</div>
  )
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${T.border}`, color: T.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }
  const td: React.CSSProperties = { padding: '9px 10px', borderBottom: `1px solid ${T.border}`, color: T.text2, verticalAlign: 'top', fontSize: 13.5 }

  async function copyAta() {
    const ok = await copyToClipboard(ataText(summary))
    onToast(ok ? 'Ata copiada.' : 'Não foi possível copiar.')
  }

  return (
    <div style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>Resumo da reunião</div>
        <button onClick={copyAta} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Copiar ata</button>
      </div>
      {sec('Objetivo', <div style={line}>{summary.objetivo || '—'}</div>)}
      {sec('Assunto', <div style={line}>{summary.assunto || '—'}</div>)}
      {sec('Itens discutidos', bullets(summary.itens_discutidos))}
      {sec('Decisões', bullets(summary.decisoes))}
      {sec('Pontos a definir', bullets(summary.pontos_definir))}
      {sec('Próximos passos', (summary.proximos_passos && summary.proximos_passos.length)
        ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr><th style={th}>Descrição</th><th style={{ ...th, whiteSpace: 'nowrap' }}>Responsável</th><th style={{ ...th, whiteSpace: 'nowrap' }}>Data</th></tr></thead>
              <tbody>{summary.proximos_passos.map((a, i) => (
                <tr key={i}><td style={td}>{a.text}</td><td style={{ ...td, whiteSpace: 'nowrap' }}>{a.assignee || '—'}</td><td style={{ ...td, whiteSpace: 'nowrap' }}>{a.due || '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )
        : <div style={{ fontSize: 13, color: T.text3 }}>—</div>)}
      <div style={{ fontSize: 12, color: T.text3, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        Gerado pelo Meeting Intelligence — revise o conteúdo.
      </div>
    </div>
  )
}

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ text }: { text: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: '12px 16px', fontSize: 13, color: T.text1, boxShadow: '0 12px 40px rgba(0,0,0,.4)', zIndex: 80,
    }}>{text}</div>
  )
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}
