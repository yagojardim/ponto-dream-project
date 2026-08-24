import { useMemo, useState } from 'react'
import { T } from './ds/tokens'
import { DB_STATUS_CFG } from '../data/db/timeline'
import { closeRelease, type ReleaseItemRow, type ReleaseRow } from '../data/db/releases'
import { getActiveUser } from '../data/session'

function statusCfg(s: string) { return DB_STATUS_CFG[s] ?? { label: s, color: T.text3 } }

type Dest = 'shipped' | 'deferred' | 'backlog'

interface Props {
  release: ReleaseRow
  items: ReleaseItemRow[]
  releases?: ReleaseRow[]
  onClose: () => void
  onClosed: () => void
}

export function CloseReleaseModal({ release, items, releases = [], onClose, onClosed }: Props) {
  const linked = useMemo(() => items.filter(i => i.release_id === release.id), [items, release.id])

  const candidates = useMemo(() => releases
    .filter(r => r.project_id === release.project_id && r.state !== 'released' && r.id !== release.id)
    .sort((a, b) => (a.release_date ?? '9999').localeCompare(b.release_date ?? '9999')),
  [releases, release.project_id, release.id])

  const [dest, setDest] = useState<Record<string, Dest>>(
    () => Object.fromEntries(linked.map(i => [i.id, i.status === 'done' ? 'shipped' : 'backlog'])) as Record<string, Dest>,
  )
  const [nextReleaseId, setNextReleaseId] = useState<string>(candidates[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idsFor = (d: Dest) => linked.filter(i => (dest[i.id] ?? 'backlog') === d).map(i => i.id)
  const shippedItemIds = idsFor('shipped')
  const deferredItemIds = candidates.length > 0 ? idsFor('deferred') : []
  const returnedItemIds = idsFor('backlog')

  const options: { v: Dest; label: string; color: string }[] = [
    { v: 'shipped', label: 'Entregue', color: T.success },
    ...(candidates.length > 0 ? [{ v: 'deferred' as Dest, label: '→ Próxima release', color: T.accent }] : []),
    { v: 'backlog', label: '↩ Backlog', color: T.warn },
  ]

  async function confirm() {
    setSaving(true); setError(null)
    try {
      await closeRelease({
        release, shippedItemIds, deferredItemIds, returnedItemIds,
        nextReleaseId: deferredItemIds.length > 0 ? (nextReleaseId || null) : null,
        note, actorName: getActiveUser()?.name ?? 'Sistema',
      })
      onClosed()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 700, maxHeight: 'calc(100vh - 48px)',
        display: 'flex', flexDirection: 'column',
        background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>Fechar release</div>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
            {release.version} · {release.name}
          </div>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            fontSize: 12, color: T.text2, background: T.bgSurface2,
            border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px',
          }}>
            Após a subida para PROD, marque o que ficou entregue e o que precisou voltar para ajuste.
          </div>

          <section>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 8 }}>
              Itens da release ({linked.length})
            </div>
            {linked.length === 0 && (
              <div style={{ fontSize: 12, color: T.text3 }}>Nenhum item vinculado a esta release.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {linked.map(i => {
                const sc = statusCfg(i.status)
                const cur = dest[i.id] ?? 'backlog'
                return (
                  <div key={i.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                    background: T.bgSurface2, border: `1px solid ${T.border}`, borderRadius: 8, flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: T.text3, width: 62 }}>{i.key}</span>
                    <span style={{ fontSize: 13, color: T.text1, flex: 1, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
                    <span style={{ fontSize: 11, color: sc.color, background: `${sc.color}18`, borderRadius: 20, padding: '2px 8px' }}>{sc.label}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {options.map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setDest(p => ({ ...p, [i.id]: opt.v }))}
                          style={{
                            fontSize: 11, padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${cur === opt.v ? opt.color : T.border}`,
                            background: cur === opt.v ? `${opt.color}18` : 'transparent',
                            color: cur === opt.v ? opt.color : T.text3,
                          }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {deferredItemIds.length > 0 && (
            <section>
              <label style={{ fontSize: 12, color: T.text2, display: 'block', marginBottom: 6 }}>Mover para:</label>
              <select
                value={nextReleaseId}
                onChange={e => setNextReleaseId(e.target.value)}
                style={{
                  width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '8px 12px', color: T.text1, fontSize: 13, outline: 'none',
                }}
              >
                {candidates.map(r => (
                  <option key={r.id} value={r.id}>{r.version} · {r.name}</option>
                ))}
              </select>
            </section>
          )}

          <section>
            <label style={{ fontSize: 12, color: T.text2, display: 'block', marginBottom: 6 }}>Observação</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="O que motivou o fechamento / os retornos?"
              style={{
                width: '100%', background: T.bgSurface2, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: '8px 12px', color: T.text1, fontSize: 13,
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </section>

          {error && <div style={{ fontSize: 12, color: T.crit }}>{error}</div>}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '14px 20px', borderTop: `1px solid ${T.border}`,
        }}>
          <span style={{ fontSize: 12, color: T.text3 }}>
            {shippedItemIds.length} entregues · {deferredItemIds.length} próxima release · {returnedItemIds.length} backlog
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose} disabled={saving}
              style={{
                fontSize: 12, color: T.text2, background: 'transparent',
                border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
              }}
            >Cancelar</button>
            <button
              onClick={() => void confirm()} disabled={saving}
              style={{
                fontSize: 12, fontWeight: 600, color: T.text1, background: T.accentDim,
                border: `1px solid ${T.accent}`, borderRadius: 8, padding: '7px 16px',
                cursor: saving ? 'progress' : 'pointer',
              }}
            >{saving ? 'Fechando…' : 'Fechar release'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
