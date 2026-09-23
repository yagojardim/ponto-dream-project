// Meeting Intelligence — tela "Nova reunião" (mockup renderNew).
// Fontes de áudio (Gravar/Zoom/Meet/Teams) ficam ocultas até RECORDING/TRANSCRIPTION
// ligarem; com elas desligadas, a tela é o fluxo de colar transcrição.
import { useEffect, useMemo, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { useSession } from '@/data/SessionContext'
import { pageStyle, cardStyle } from '@/components/meetings/meetingUi'
import { IcMic, IcPaste, IcShield, IcSpark } from '@/components/meetings/icons'
import { MEETING_FLAGS } from '@/config/meetingFlags'
import { fetchProjectOptions, createMeeting, type MeetingProjectOption } from '@/data/db/meetings'

interface Props {
  onCancel: () => void
  onCreated: (id: string) => void
  onStartRecording: () => void
  onToast: (t: string) => void
}

export function NewMeetingScreen({ onCancel, onCreated, onStartRecording, onToast }: Props) {
  const { activeUser } = useSession()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [transcript, setTranscript] = useState('')
  const [projects, setProjects] = useState<MeetingProjectOption[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void fetchProjectOptions().then(list => { if (alive) setProjects(list) })
    return () => { alive = false }
  }, [])

  const words = useMemo(() => transcript.trim() ? transcript.trim().split(/\s+/).length : 0, [transcript])
  const canSave = title.trim().length > 0 && transcript.trim().length > 0 && !saving
  const showSources = MEETING_FLAGS.RECORDING_ENABLED || MEETING_FLAGS.TRANSCRIPTION_ENABLED

  async function save() {
    if (!canSave) return
    setSaving(true); setErr(null)
    const id = await createMeeting({ title, projectId: projectId || null, transcript }, activeUser.user_id)
    setSaving(false)
    if (id) { onToast('Reunião criada.'); onCreated(id) }
    else setErr('Não foi possível criar a reunião. Tente novamente.')
  }

  const field: React.CSSProperties = {
    width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10,
    color: T.text1, fontSize: 13.5, fontFamily: 'inherit', padding: '10px 13px', outline: 'none',
  }
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: T.text1, marginBottom: 7, display: 'block' }

  return (
    <div style={pageStyle}>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 14, fontFamily: 'inherit' }}>‹ Reuniões</button>
      <div style={{ maxWidth: 960 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: T.text1 }}>Nova reunião</h1>
        <p style={{ margin: '6px 0 24px', fontSize: 14, lineHeight: 1.6, color: T.text2 }}>
          Traga uma reunião para o Altech e o Meeting Intelligence gera resumo, decisões e próximos passos.
        </p>

        {showSources && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <button onClick={onStartRecording} style={{ ...cardStyle, borderColor: T.accentBorder, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accentBorder}`, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IcMic size={18} /></span>
              <div><div style={{ fontSize: 14.5, fontWeight: 600, color: T.text1 }}>Gravar agora</div><div style={{ fontSize: 12.5, color: T.text2 }}>Grava na própria aba. Presencial ou call.</div></div>
            </button>
            <div style={{ ...cardStyle, border: `1.5px solid ${T.accentBorder}`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IcPaste size={18} /></span>
              <div><div style={{ fontSize: 14.5, fontWeight: 600, color: T.text1 }}>Colar transcrição</div><div style={{ fontSize: 12.5, color: T.text2 }}>Já tem o texto? Cole abaixo.</div></div>
            </div>
          </div>
        )}

        <div style={{ ...cardStyle, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <label style={label}>Título da reunião</label>
              <input style={field} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Kickoff — Projeto X" />
            </div>
            <div>
              <label style={label}>Projeto (opcional)</label>
              <select style={field} value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Sem projeto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={label}>Transcrição</label>
              <span style={{ fontSize: 11.5, color: T.text3 }}>{words} palavras</span>
            </div>
            <textarea style={{ ...field, minHeight: 220, resize: 'vertical', lineHeight: 1.7 }} value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Cole aqui a transcrição da reunião (Zoom, Meet, Teams…)" />
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text3 }}>
            <IcShield />O conteúdo fica restrito ao seu workspace.
          </span>
          {err && <div style={{ fontSize: 13, color: T.crit }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onCancel} style={{ height: 40, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text1, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={save} disabled={!canSave} style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.55, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IcSpark size={15} />{saving ? 'Salvando…' : 'Criar reunião'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
