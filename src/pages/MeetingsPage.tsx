import { useEffect, useMemo, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { useSession } from '@/data/SessionContext'
import { copyToClipboard } from '@/utils/copyToClipboard'
import { MEETING_FLAGS } from '@/config/meetingFlags'
import {
  cardStyle, pageStyle, StatusPill, SOURCE_LABEL, formatDate, formatMinutes, Toast, Avatar,
} from '@/components/meetings/meetingUi'
import {
  SourceIcon, IcPaste, IcSearch, IcChevronRight, IcStar, IcCopy, IcShare, IcTrash, IcHelp, Icon,
} from '@/components/meetings/icons'
import { MeetingHelpScreen } from '@/components/meetings/MeetingHelpScreen'
import { MeetingNotesTab } from '@/components/meetings/MeetingNotesTab'
import { ShareMeetingModal } from '@/components/meetings/ShareMeetingModal'
import { QuotaMeter } from '@/components/meetings/QuotaMeter'
import { RequestHoursModal } from '@/components/meetings/RequestHoursModal'
import { MeetingAdminPanel } from '@/components/meetings/MeetingAdminPanel'
import { NewMeetingScreen } from '@/components/meetings/NewMeetingScreen'
import { RecordScreen } from '@/components/meetings/RecordScreen'
import { MeetingChatTab } from '@/components/meetings/MeetingChatTab'
import { AudioPlayer } from '@/components/meetings/AudioPlayer'
import {
  fetchMeetings, fetchMeeting, fetchProjectOptions, createMeeting, isMeetingModuleEnabled,
  summarizeMeeting, archiveMeeting,
  type MeetingListItem, type MeetingRow, type MeetingProjectOption, type MeetingSummary,
} from '@/data/db/meetings'
import { meetingIdsSharedWith, sharesByMeeting, listShares, type MeetingShareTarget } from '@/data/db/meetingShares'
import { getMyQuota, type MeetingQuota } from '@/data/db/meetingQuotas'
import { getMembers } from '@/data/db/members'

interface Props { onNav?: (view: string, targetId?: string) => void }

// Resumo por IA (Fatia 1B). Ligado por MEETING_FLAGS.AI_SUMMARY_ENABLED + secret ANTHROPIC_API_KEY.
const AI_SUMMARY_ENABLED = MEETING_FLAGS.AI_SUMMARY_ENABLED

const LIST_COLS = '1fr 140px 120px 140px 26px'
type FilterKey = 'todas' | 'processando' | 'prontas'

export default function MeetingsPage({ onNav: _onNav }: Props) {
  const { activeUser, isTenantOwner } = useSession()
  const isAdmin = isTenantOwner || activeUser.role_context === 'Admin'

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [rows, setRows]       = useState<MeetingListItem[]>([])
  const [sharesMap, setSharesMap] = useState<Map<string, MeetingShareTarget[]>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState<'closed' | 'new' | 'record' | 'help'>('closed')
  const [toast, setToast]     = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter]   = useState<FilterKey>('todas')
  const [q, setQ]             = useState('')
  const [adminView, setAdminView] = useState(false)
  const [myQuota, setMyQuota] = useState<MeetingQuota | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)

  useEffect(() => {
    let alive = true
    void isMeetingModuleEnabled().then(v => { if (alive) setEnabled(v) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (enabled !== true) return
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const sharedIds = (!isAdmin && MEETING_FLAGS.SHARING_ENABLED)
          ? [...await meetingIdsSharedWith(activeUser.user_id)]
          : []
        const [list, shares] = await Promise.all([
          fetchMeetings({ ownerId: activeUser.user_id, isAdmin, sharedIds }),
          MEETING_FLAGS.SHARING_ENABLED ? sharesByMeeting() : Promise.resolve(new Map<string, MeetingShareTarget[]>()),
        ])
        if (alive) { setRows(list); setSharesMap(shares) }
        if (MEETING_FLAGS.HOURS_QUOTA_ENABLED && !isAdmin) {
          const qta = await getMyQuota(activeUser.user_id)
          if (alive) setMyQuota(qta)
        }
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

  const counts = useMemo(() => ({
    todas:       rows.length,
    processando: rows.filter(r => r.status === 'processing').length,
    prontas:     rows.filter(r => r.status === 'ready').length,
  }), [rows])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows
      .filter(r => filter === 'todas'
        || (filter === 'processando' && r.status === 'processing')
        || (filter === 'prontas' && r.status === 'ready'))
      .filter(r => !term || r.title.toLowerCase().includes(term) || (r.projectName ?? '').toLowerCase().includes(term))
  }, [rows, filter, q])

  if (enabled === null) {
    return <div style={{ padding: '28px 32px', color: T.text3 }}>Carregando…</div>
  }
  if (enabled === false) {
    return (
      <div style={pageStyle}>
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

  if (composing === 'new') {
    return (
      <NewMeetingScreen
        onCancel={() => setComposing('closed')}
        onCreated={(id) => { setComposing('closed'); setReloadKey(k => k + 1); setToast('Reunião criada.'); setSelectedId(id) }}
        onStartRecording={() => setComposing('record')}
        onToast={setToast}
      />
    )
  }
  if (composing === 'record') {
    return <RecordScreen title="" onCancel={() => setComposing('closed')} onToast={setToast} />
  }
  if (composing === 'help') {
    return <MeetingHelpScreen isAdmin={isAdmin} onBack={() => setComposing('closed')} />
  }

  if (selectedId) {
    return (
      <MeetingDetail
        id={selectedId}
        currentUser={{ id: activeUser.user_id, name: activeUser.name, isAdmin }}
        onBack={() => setSelectedId(null)}
        onChanged={() => setReloadKey(k => k + 1)}
        onToast={setToast}
        toast={toast}
      />
    )
  }

  const showAdmin = MEETING_FLAGS.HOURS_QUOTA_ENABLED && isAdmin && adminView

  return (
    <div style={pageStyle}>
      {MEETING_FLAGS.HOURS_QUOTA_ENABLED && isAdmin && (
        <div style={{ display: 'inline-flex', background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3, gap: 2, marginBottom: 18 }}>
          {([['Minhas reuniões', false], ['Gestão do módulo', true]] as [string, boolean][]).map(([lbl, v]) => (
            <button key={lbl} onClick={() => setAdminView(v)} style={{ height: 34, padding: '0 16px', border: 0, background: adminView === v ? T.accentDim : 'transparent', color: adminView === v ? T.accent : T.text2, fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', boxShadow: adminView === v ? `inset 0 0 0 1px ${T.accentBorder}` : 'none' }}>{lbl}</button>
          ))}
        </div>
      )}

      {showAdmin ? (
        <MeetingAdminPanel currentUser={{ id: activeUser.user_id, name: activeUser.name, isAdmin }} onToast={setToast} />
      ) : (
        <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: T.text1 }}>Reuniões</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.6, color: T.text2 }}>
            {isAdmin ? 'Todas as reuniões do workspace.' : 'Suas reuniões e as compartilhadas com você.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setComposing('help')} title="Ajuda do Meeting Intelligence" style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${T.border}`, background: T.bgSurface2, color: T.text1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcHelp size={17} /></button>
          {MEETING_FLAGS.HOURS_QUOTA_ENABLED && !isAdmin && myQuota && (
            <div style={{ width: 260, maxWidth: '100%' }}>
              <QuotaMeter quota={myQuota} onRequest={() => setRequestOpen(true)} />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['todas', 'processando', 'prontas'] as FilterKey[]).map(f => {
          const active = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              height: 32, padding: '0 14px', display: 'inline-flex', alignItems: 'center', borderRadius: 8,
              fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              border: `1px solid ${active ? T.accentBorder : 'transparent'}`,
              background: active ? T.accentDim : 'transparent',
              color: active ? T.accent : T.text2, fontWeight: active ? 600 : 400,
            }}>
              {f[0].toUpperCase() + f.slice(1)}
              <span style={{ marginLeft: 6, color: active ? T.text2 : T.text3 }}>{counts[f]}</span>
            </button>
          )
        })}
        <div style={{ marginLeft: 'auto', flex: 1, minWidth: 160, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px', background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <span style={{ color: T.text3, display: 'inline-flex' }}><IcSearch /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar reuniões…"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', height: 30, padding: 0, fontSize: 13, color: T.text1, fontFamily: 'inherit' }} />
        </div>
        <button onClick={() => setComposing('new')} style={{
          height: 32, padding: '0 16px', borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: T.accent, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}><IcPaste />{(MEETING_FLAGS.RECORDING_ENABLED || MEETING_FLAGS.TRANSCRIPTION_ENABLED) ? 'Nova reunião' : 'Colar transcrição'}</button>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: LIST_COLS, gap: 16, padding: '12px 20px', borderBottom: `1px solid ${T.border}`, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: T.text3 }}>
          <div>Reunião</div><div>Projeto</div><div>Data</div><div>Status</div><div />
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.text3 }}>Carregando reuniões…</div>
        ) : error ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.crit }}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: T.text3 }}>
            Nenhuma reunião ainda. Use <b>Colar transcrição</b> para criar a primeira.
          </div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: T.text3 }}>Nenhuma reunião encontrada.</div>
        ) : shown.map((m, i) => {
          const sharedToMe = !isAdmin && m.ownerId !== activeUser.user_id
          const sharedWith = sharesMap.get(m.id) ?? []
          return (
            <div key={m.id} onClick={() => setSelectedId(m.id)} style={{
              display: 'grid', gridTemplateColumns: LIST_COLS, gap: 16, alignItems: 'center',
              padding: '14px 20px', cursor: 'pointer',
              borderBottom: i === shown.length - 1 ? 'none' : `1px solid ${T.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: T.bgSurface2, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.status === 'ready' ? T.accent : T.text2 }}>
                  <SourceIcon source={m.source} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: T.text3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{SOURCE_LABEL[m.source]}</span>
                    {sharedToMe && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.accent }}><IcShare size={11} />Compartilhada comigo</span>
                    )}
                    {!sharedToMe && sharedWith.length > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={sharedWith.map(s => s.name).join(', ')}>
                        {sharedWith.slice(0, 3).map(s => <Avatar key={s.profileId} name={s.name} seed={s.profileId} size={17} />)}
                        {sharedWith.length > 3 && <span style={{ marginLeft: 2, color: T.text3 }}>+{sharedWith.length - 3}</span>}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.projectName ?? '—'}</div>
              <div style={{ fontSize: 13, color: T.text2, whiteSpace: 'nowrap' }}>{formatDate(m.meetingDate ?? m.createdAt)}</div>
              <div><StatusPill status={m.status} /></div>
              <div style={{ color: T.text3, display: 'flex', justifyContent: 'flex-end' }}><IcChevronRight /></div>
            </div>
          )
        })}
      </div>

      <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text3, marginTop: 14 }}>
        <span style={{ color: T.warn, display: 'inline-flex' }}><IcStar /></span>
        Módulo premium — ativo para este workspace.
      </p>
        </>
      )}

      {requestOpen && (
        <RequestHoursModal
          requester={{ id: activeUser.user_id, name: activeUser.name, role: activeUser.role_context }}
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => setReloadKey(k => k + 1)}
          onToast={setToast}
        />
      )}

      {toast && <Toast text={toast} />}
    </div>
  )
}

// ─── Detalhe ────────────────────────────────────────────────────────────────
type DetailTab = 'resumo' | 'notas' | 'transcricao' | 'chat'

function MeetingDetail({ id, currentUser, onBack, onChanged, onToast, toast }: {
  id: string
  currentUser: { id: string; name: string; isAdmin: boolean }
  onBack: () => void
  onChanged: () => void
  onToast: (t: string) => void
  toast: string | null
}) {
  const [meeting, setMeeting] = useState<MeetingRow | null>(null)
  const [ownerName, setOwnerName] = useState<string>('—')
  const [shares, setShares]   = useState<MeetingShareTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<DetailTab>('resumo')
  const [generating, setGenerating] = useState(false)
  const [shareOpen, setShareOpen]   = useState(false)
  const [reloadKey, setReloadKey]   = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const m = await fetchMeeting(id)
        if (!alive) return
        if (!m) { setError('Reunião não encontrada.'); return }
        setMeeting(m)
        const tasks: Promise<void>[] = [
          getMembers().then(list => { if (alive) setOwnerName(list.find(x => x.id === m.owner_id)?.name ?? '—') }),
        ]
        if (MEETING_FLAGS.SHARING_ENABLED) tasks.push(listShares(id).then(s => { if (alive) setShares(s) }))
        await Promise.all(tasks)
      } catch {
        if (alive) setError('Não foi possível carregar a reunião.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, reloadKey])

  const canManage = currentUser.isAdmin || meeting?.owner_id === currentUser.id
  const sharedToMe = !!meeting && !canManage

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

  async function archive() {
    const ok = await archiveMeeting(id)
    if (ok) { onToast('Reunião arquivada.'); onChanged(); onBack() }
    else onToast('Não foi possível arquivar.')
  }

  const tabBtn = (key: DetailTab): React.CSSProperties => ({
    padding: '10px 14px', fontSize: 13.5, cursor: 'pointer', background: 'none',
    border: 'none', borderBottom: `2px solid ${tab === key ? T.accent : 'transparent'}`,
    color: tab === key ? T.accent : T.text2, fontWeight: tab === key ? 600 : 400, fontFamily: 'inherit',
  })

  return (
    <div style={pageStyle}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.text2, cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 14, fontFamily: 'inherit' }}>‹ Reuniões</button>

      {loading ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: 'center', color: T.text3 }}>Carregando…</div>
      ) : error || !meeting ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: 'center', color: T.crit }}>{error ?? 'Reunião não encontrada.'}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: T.text1 }}>{meeting.title}</h1>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, fontSize: 13, color: T.text2, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SourceIcon source={meeting.source} size={15} />{SOURCE_LABEL[meeting.source]}</span>
                <span>{formatDate(meeting.meeting_date ?? meeting.created_at)}</span>
                {meeting.duration_min != null && <span>{formatMinutes(meeting.duration_min)}</span>}
                <StatusPill status={meeting.status} />
              </div>

              {MEETING_FLAGS.SHARING_ENABLED && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px 0 4px', borderRadius: 999, background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text2, fontSize: 11.5 }}>
                    <Avatar name={ownerName} seed={meeting.owner_id} size={18} />{ownerName} <span style={{ color: T.text3 }}>· dono</span>
                  </span>
                  {shares.map(s => (
                    <span key={s.profileId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px 0 4px', borderRadius: 999, background: T.bgSurface2, border: `1px solid ${T.border}`, color: T.text2, fontSize: 11.5 }}>
                      <Avatar name={s.name} seed={s.profileId} size={18} />{s.name}
                    </span>
                  ))}
                  {canManage ? (
                    <button onClick={() => setShareOpen(true)} style={{ height: 24, padding: '0 10px', borderRadius: 999, border: `1px solid ${T.accentBorder}`, background: 'transparent', color: T.accent, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><IcShare size={12} />Compartilhar</button>
                  ) : sharedToMe && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 999, background: T.accentDim, border: `1px solid ${T.accentBorder}`, color: T.accent, fontSize: 11.5 }}><IcShare size={12} />Compartilhada por {ownerName} · você não consome cota</span>
                  )}
                </div>
              )}
            </div>
            {canManage && (
              <button onClick={archive} title="Arquivar — sai da lista, fica 30 dias no repositório" style={{ height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text2, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}><IcTrash />Arquivar</button>
            )}
          </div>

          {MEETING_FLAGS.RECORDING_ENABLED && meeting.audio_url && (
            <div style={{ marginTop: 20 }}><AudioPlayer audioUrl={meeting.audio_url} canDownload={canManage} /></div>
          )}

          <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.border}`, margin: '22px 0' }}>
            <button style={tabBtn('resumo')} onClick={() => setTab('resumo')}>Resumo</button>
            {MEETING_FLAGS.NOTES_ENABLED && <button style={tabBtn('notas')} onClick={() => setTab('notas')}>Notas</button>}
            <button style={tabBtn('transcricao')} onClick={() => setTab('transcricao')}>Transcrição</button>
            {MEETING_FLAGS.CHAT_RAG_ENABLED && <button style={tabBtn('chat')} onClick={() => setTab('chat')}>Chat</button>}
          </div>

          {tab === 'resumo' && (
            meeting.summary
              ? <SummarySections summary={meeting.summary} onToast={onToast} />
              : (
                <div style={{ ...cardStyle, padding: '44px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 11, background: T.indigoDim, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.purple }}><Icon size={20} filled><path d="m12 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></Icon></span>
                  {AI_SUMMARY_ENABLED ? (
                    <>
                      <p style={{ margin: 0, color: T.text2, fontSize: 14, lineHeight: 1.6, maxWidth: 420 }}>
                        {generating ? 'Gerando o resumo com o Meeting Intelligence… isso leva alguns segundos.' : 'Ainda não há resumo para esta reunião.'}
                      </p>
                      <button onClick={generate} disabled={generating} style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1, fontFamily: 'inherit' }}>{generating ? 'Gerando…' : 'Gerar resumo com IA'}</button>
                    </>
                  ) : (
                    <p style={{ margin: 0, color: T.text2, fontSize: 14, lineHeight: 1.6, maxWidth: 440 }}>
                      O <b style={{ color: T.text1 }}>resumo automático</b> (objetivo, decisões e próximos passos) chega em breve.
                      Por enquanto, use a aba <b style={{ color: T.text1 }}>Transcrição</b>.
                    </p>
                  )}
                </div>
              )
          )}

          {tab === 'notas' && MEETING_FLAGS.NOTES_ENABLED && (
            <MeetingNotesTab meetingId={id} currentUserId={currentUser.id} isAdmin={currentUser.isAdmin} onToast={onToast} />
          )}

          {tab === 'transcricao' && (
            <div style={{ ...cardStyle, padding: '8px 22px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 0 10px', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12.5, color: T.text3 }}>Transcrição completa · {SOURCE_LABEL[meeting.source]}</span>
                <button onClick={copyTranscript} style={{ height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.bgSurface2, color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}><IcCopy />Copiar</button>
              </div>
              <div style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.7, color: T.text2, whiteSpace: 'pre-wrap' }}>{meeting.transcript || 'Sem transcrição.'}</div>
            </div>
          )}

          {tab === 'chat' && MEETING_FLAGS.CHAT_RAG_ENABLED && (
            <MeetingChatTab meetingId={id} />
          )}
        </>
      )}

      {shareOpen && meeting && (
        <ShareMeetingModal
          meetingId={id}
          meetingTitle={meeting.title}
          ownerId={meeting.owner_id}
          currentUser={{ id: currentUser.id, name: currentUser.name }}
          onClose={() => setShareOpen(false)}
          onChanged={() => { setReloadKey(k => k + 1); onChanged() }}
          onToast={onToast}
        />
      )}

      {toast && <Toast text={toast} />}
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
  const label: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: T.text3, marginBottom: 7 }
  const line: React.CSSProperties = { fontSize: 14, lineHeight: 1.55, color: T.text1 }
  const bullets = (arr?: string[]) => (arr && arr.length)
    ? <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>{arr.map((x, i) => <li key={i} style={line}>{x}</li>)}</ul>
    : <div style={{ fontSize: 13, color: T.text3 }}>—</div>
  const sec = (t: string, node: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><div style={label}>{t}</div>{node}</div>
  )
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${T.border}`, color: T.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }
  const td: React.CSSProperties = { padding: '9px 10px', borderBottom: `1px solid ${T.border}`, color: T.text1, verticalAlign: 'top', fontSize: 13.5 }

  async function copyAta() {
    const ok = await copyToClipboard(ataText(summary))
    onToast(ok ? 'Ata copiada.' : 'Não foi possível copiar.')
  }

  const procRow = (name: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{name}</span><span style={{ color: T.success }}>{value}</span></div>
  )

  return (
    <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ ...cardStyle, flex: '1 1 440px', minWidth: 0, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 600, color: T.text1 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: T.indigoDim, border: `1px solid ${T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.purple, flexShrink: 0 }}><Icon size={14} filled><path d="m12 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></Icon></span>
            Resumo da reunião
          </div>
          <button onClick={copyAta} style={{ height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.bgSurface2, color: T.text1, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}><IcCopy />Copiar ata</button>
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
                  <tr key={i}><td style={td}>{a.text}</td><td style={{ ...td, color: T.text2, whiteSpace: 'nowrap' }}>{a.assignee || '—'}</td><td style={{ ...td, color: T.text2, whiteSpace: 'nowrap' }}>{a.due || '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )
          : <div style={{ fontSize: 13, color: T.text3 }}>—</div>)}
      </div>

      <div style={{ flex: '1 1 240px', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ ...cardStyle, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text1, marginBottom: 12 }}>Processamento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: T.text2 }}>
            {procRow('Transcrição', 'Concluída')}
            {procRow('Resumo', 'Concluído')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.text3 }}>
            <span style={{ color: T.purple, display: 'inline-flex' }}><Icon size={13} filled><path d="m12 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></Icon></span>
            Gerado pelo Meeting Intelligence — revise o conteúdo.
          </div>
        </div>
      </div>
    </div>
  )
}
