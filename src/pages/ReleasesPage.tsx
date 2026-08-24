import { useCallback, useEffect, useMemo, useState } from 'react'
import { T } from '../components/ds/tokens'
import { NewReleaseModal } from '../components/NewReleaseModal'
import { listReleases, type ReleasesData, type ReleaseRow } from '../data/db/releases'
import { DB_STATUS_CFG } from '../data/db/timeline'
import { WorkItemDetail } from '../components/WorkItemDetail'
import { CloseReleaseModal } from '../components/CloseReleaseModal'

interface ReleaseOutcome { outcome: 'success' | 'partial'; shipped: number; returned: number; deferred: number }
function releaseOutcome(metadata: unknown): ReleaseOutcome | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  if (m.outcome !== 'success' && m.outcome !== 'partial') return null
  return {
    outcome: m.outcome,
    shipped: Number(m.shipped_count ?? 0),
    returned: Number(m.returned_count ?? 0),
    deferred: Number(m.deferred_count ?? 0),
  }
}
function returnedFrom(metadata: unknown): { version: string; note: string | null } | null {
  if (!metadata || typeof metadata !== 'object') return null
  const r = (metadata as Record<string, unknown>).returned_from_release
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  if (typeof o.version !== 'string') return null
  return { version: o.version, note: typeof o.note === 'string' ? o.note : null }
}

function stateColor(state: string) {
  if (state === 'released') return T.success
  if (state === 'in_progress' || state === 'in-progress') return T.accent
  return T.text3
}
function stateBg(state: string) {
  if (state === 'released') return T.successDim
  if (state === 'in_progress' || state === 'in-progress') return T.accentDim
  return T.neutralDim
}
function stateLabel(state: string) {
  if (state === 'released') return 'Lançada'
  if (state === 'in_progress' || state === 'in-progress') return 'Em andamento'
  return 'Planejada'
}
function isInProgress(state: string) { return state === 'in_progress' || state === 'in-progress' }

function fmtDate(iso: string | null): string {
  if (!iso) return 'Sem data'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  return Math.ceil((target.getTime() - Date.now()) / 86400000)
}
function statusCfg(s: string) { return DB_STATUS_CFG[s] ?? { label: s, color: T.text3 } }

function StateBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: 32, textAlign: 'center', fontSize: 13, color: T.text3,
    }}>{children}</div>
  )
}

export default function ReleasesPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ReleaseRow | null>(null)
  const [data, setData] = useState<ReleasesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [closingRelease, setClosingRelease] = useState<ReleaseRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await listReleases()) }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const releases = data?.releases ?? []
  const items = data?.items ?? []
  const projects = data?.projects ?? []
  const profileById = new Map((data?.profiles ?? []).map(p => [p.id, p]))
  const projectById = new Map(projects.map(p => [p.id, p]))

  const groups = useMemo(() => {
    const map = new Map<string, ReleaseRow[]>()
    for (const r of releases) {
      const list = map.get(r.project_id) ?? []
      list.push(r)
      map.set(r.project_id, list)
    }
    const entries: { projectId: string; name: string; releases: ReleaseRow[] }[] = []
    for (const [projectId, list] of map) {
      const project = projectById.get(projectId)
      entries.push({ projectId, name: project?.name ?? 'Sem projeto', releases: list })
    }
    entries.sort((a, b) => {
      if (a.name === 'Sem projeto') return 1
      if (b.name === 'Sem projeto') return -1
      return a.name.localeCompare(b.name)
    })
    return entries
  }, [releases, projectById])

  const [sectionsExpanded, setSectionsExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(g => [g.projectId, true]))
  )

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      {modalOpen && (
        <NewReleaseModal
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSaved={() => { void load() }}
          projects={projects}
          items={items}
          release={editing}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: T.text1 }}>Releases</span>
          <span style={{
            fontSize: 13, color: T.text3, background: T.neutralDim,
            borderRadius: 20, padding: '2px 10px',
          }}>{releases.length} releases</span>
        </div>
        <button style={{
          fontSize: 13, color: T.text1, background: T.accentDim,
          border: `1px solid ${T.accentBorder ?? T.accent}`, borderRadius: 8,
          padding: '8px 18px', cursor: 'pointer', fontWeight: 600,
        }} onClick={() => { setEditing(null); setModalOpen(true) }}>+ Nova release</button>
      </div>

      {loading && <StateBox>Carregando releases…</StateBox>}
      {!loading && error && <StateBox><span style={{ color: T.crit }}>Erro ao carregar releases: {error}</span></StateBox>}
      {!loading && !error && releases.length === 0 && <StateBox>Nenhuma release cadastrada ainda.</StateBox>}

      {/* Release list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!loading && !error && groups.map(group => {
          const n = group.releases.length
          const sectionExpanded = sectionsExpanded[group.projectId] ?? true
          return (
            <div key={group.projectId} style={{ marginBottom: 8 }}>
              <button
                onClick={() => setSectionsExpanded(p => ({ ...p, [group.projectId]: !p[group.projectId] }))}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                  marginBottom: 14,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>
                  {sectionExpanded ? '▼' : '▶'} {group.name}
                </span>
                <span style={{
                  fontSize: 13, color: T.text3, background: T.neutralDim,
                  borderRadius: 20, padding: '2px 10px',
                }}>{n} release{n > 1 ? 's' : ''}</span>
              </button>

              {sectionExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                  {group.releases.map(release => {
                    const releaseIssues = items.filter(i => i.release_id === release.id)
                    const outcome = releaseOutcome(release.metadata)
                    const done = outcome ? outcome.shipped : releaseIssues.filter(i => i.status === 'done').length
                    const total = outcome
                      ? outcome.shipped + outcome.returned + outcome.deferred
                      : releaseIssues.length
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0
                    const color = stateColor(release.state)
                    const isReleased = release.state === 'released'
                    const isExpanded = expanded[release.id]
                    const days = isInProgress(release.state) ? daysUntil(release.release_date) : null
                    const returnedIssues = items.filter(i => returnedFrom(i.metadata)?.version === release.version)

                    return (
                      <div key={release.id} style={{
                        background: T.bgSurface, border: `1px solid ${T.border}`,
                        borderRadius: 12, padding: '20px 24px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                        opacity: isReleased ? 0.85 : 1,
                      }}>
                        {/* Top row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 700, color, background: stateBg(release.state),
                            borderRadius: 8, padding: '3px 12px', fontFamily: 'monospace',
                            border: `1px solid ${color}40`, letterSpacing: 0.5,
                          }}>
                            {isReleased && '✓ '}{release.version}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: isReleased ? T.text2 : T.text1 }}>
                            {release.name}
                          </span>
                          <span style={{ fontSize: 12, color: T.text3 }}>{fmtDate(release.release_date)}</span>
                          {outcome ? (
                            <span style={{
                              fontSize: 11,
                              color: outcome.outcome === 'success' ? T.success : T.warn,
                              background: outcome.outcome === 'success' ? T.successDim : T.warnDim,
                              borderRadius: 20, padding: '2px 10px',
                              border: `1px solid ${(outcome.outcome === 'success' ? T.success : T.warn)}30`,
                            }}>
                              {outcome.outcome === 'success'
                                ? 'Lançada ✓'
                                : `Lançada · parcial — ${outcome.shipped} entregues · ${outcome.returned} retornados`}
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 11, color, background: stateBg(release.state),
                              borderRadius: 20, padding: '2px 10px', border: `1px solid ${color}30`,
                            }}>{stateLabel(release.state)}</span>
                          )}
                          {days !== null && (
                            <span style={{
                              fontSize: 11, color: days <= 7 ? T.crit : T.warn,
                              background: days <= 7 ? T.critDim : T.warnDim,
                              borderRadius: 20, padding: '2px 10px',
                              border: `1px solid ${(days <= 7 ? T.crit : T.warn)}30`,
                            }}>
                              Release em {days > 0 ? `${days} dias` : 'hoje'}
                            </span>
                          )}
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {total > 0 && (
                              <span style={{ fontSize: 12, color: T.text3 }}>{done}/{total} issues</span>
                            )}
                            <button
                              onClick={() => { setEditing(release); setModalOpen(true) }}
                              style={{
                                fontSize: 11, color: T.text2, background: 'transparent',
                                border: `1px solid ${T.border}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                              }}
                            >Editar</button>
                            {!isReleased && (
                              <button
                                onClick={() => setClosingRelease(release)}
                                style={{
                                  fontSize: 11, color: T.success, background: T.successDim,
                                  border: `1px solid ${T.success}40`, borderRadius: 6,
                                  padding: '3px 10px', cursor: 'pointer', fontWeight: 600,
                                }}
                              >Fechar release</button>
                            )}
                          </div>
                        </div>

                        {/* Notes */}
                        {release.notes && (
                          <p style={{ fontSize: 12, color: T.text3, fontStyle: 'italic', margin: '0 0 14px', lineHeight: 1.5 }}>
                            {release.notes}
                          </p>
                        )}

                        {/* Progress bar */}
                        {total > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: T.text3 }}>Progresso</span>
                              <span style={{ fontSize: 11, color: T.text2, fontWeight: 600 }}>{pct}%</span>
                            </div>
                            <div style={{ height: 6, background: T.border2, borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${pct}%`,
                                background: isReleased ? T.success : T.accent,
                                borderRadius: 4, transition: 'width 0.4s',
                              }} />
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                              {(['done', 'in_progress', 'in_review', 'todo', 'backlog'] as const).map(s => {
                                const cnt = releaseIssues.filter(i => i.status === s).length
                                if (cnt === 0) return null
                                const cfg = statusCfg(s)
                                return (
                                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color }} />
                                    <span style={{ fontSize: 11, color: T.text3 }}>{cfg.label}: {cnt}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Expand */}
                        {(total > 0 || returnedIssues.length > 0) && (
                          <button
                            onClick={() => setExpanded(p => ({ ...p, [release.id]: !p[release.id] }))}
                            style={{
                              fontSize: 12, color, background: stateBg(release.state),
                              border: `1px solid ${color}40`, borderRadius: 6, padding: '5px 14px',
                              cursor: 'pointer', fontWeight: 600,
                            }}
                          >
                            {isExpanded ? '▲ Ocultar issues' : `▼ Ver issues (${total + returnedIssues.length})`}
                          </button>
                        )}

                        {/* Expanded issue list */}
                        {isExpanded && (
                          <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                            {releaseIssues.length > 0 && (
                              <div style={{ fontSize: 11, fontWeight: 600, color: T.text2, marginBottom: 6 }}>
                                Entregues ({releaseIssues.length})
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {releaseIssues.map(issue => {
                                const sc = statusCfg(issue.status)
                                const assignee = issue.assignee_id ? profileById.get(issue.assignee_id) : undefined
                                return (
                                  <div
                                    key={issue.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setDetailId(issue.id)}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailId(issue.id) } }}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      padding: '7px 10px', background: T.bgSurface2,
                                      borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer',
                                    }}
                                  >
                                    <span style={{ fontSize: 11, color: T.text3, fontFamily: 'monospace', width: 62, flexShrink: 0 }}>
                                      {issue.key}
                                    </span>
                                    <span style={{
                                      fontSize: 13, color: T.text1, flex: 1, overflow: 'hidden',
                                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{issue.title}</span>
                                    <span style={{
                                      fontSize: 11, color: sc.color, background: `${sc.color}18`,
                                      borderRadius: 20, padding: '2px 8px', flexShrink: 0,
                                    }}>{sc.label}</span>
                                    <span style={{ fontSize: 11, color: T.text3, flexShrink: 0 }}>
                                      {assignee?.avatar_initials ?? assignee?.name ?? '—'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>

                            {returnedIssues.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 600, color: T.warn, margin: '14px 0 6px' }}>
                                  Retornados para ajuste ({returnedIssues.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {returnedIssues.map(issue => {
                                    const info = returnedFrom(issue.metadata)
                                    const sc = statusCfg(issue.status)
                                    return (
                                      <div
                                        key={issue.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setDetailId(issue.id)}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailId(issue.id) } }}
                                        style={{
                                          padding: '7px 10px', background: T.bgSurface2, borderRadius: 8,
                                          border: `1px solid ${T.warn}30`, cursor: 'pointer',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                          <span style={{ fontSize: 11, color: T.text3, fontFamily: 'monospace', width: 62, flexShrink: 0 }}>
                                            {issue.key}
                                          </span>
                                          <span style={{
                                            fontSize: 13, color: T.text1, flex: 1, overflow: 'hidden',
                                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                          }}>{issue.title}</span>
                                          <span style={{
                                            fontSize: 11, color: sc.color, background: `${sc.color}18`,
                                            borderRadius: 20, padding: '2px 8px', flexShrink: 0,
                                          }}>{sc.label}</span>
                                        </div>
                                        {info?.note && (
                                          <p style={{ fontSize: 11, color: T.text3, margin: '5px 0 0 72px', fontStyle: 'italic' }}>
                                            {info.note}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* CTA */}
      {!loading && !error && (
        <div style={{ marginTop: 24 }}>
          <button style={{
            width: '100%', padding: '14px', textAlign: 'center',
            fontSize: 13, color: T.text3,
            background: 'transparent', border: `1px dashed ${T.border2}`,
            borderRadius: 12, cursor: 'pointer',
          }} onClick={() => { setEditing(null); setModalOpen(true) }}>+ Criar release</button>
        </div>
      )}

      {closingRelease && (
        <CloseReleaseModal
          release={closingRelease}
          items={items}
          releases={releases}
          onClose={() => setClosingRelease(null)}
          onClosed={() => { void load() }}
        />
      )}

      {detailId && (
        <WorkItemDetail
          itemId={detailId}
          mode="drawer"
          onUpdate={() => { /* the panel persists on its own */ }}
          onClose={() => { setDetailId(null); void load() }}
        />
      )}
    </div>
  )
}
