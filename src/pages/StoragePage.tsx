import { useEffect, useMemo, useState } from 'react'
import { T } from '@/components/ds/tokens'
import { HelpHint } from '@/components/ds/HelpHint'
import { useSession } from '@/data/SessionContext'
import { getActiveTenantId } from '@/data/session'
import {
  fetchTenantStorage, fetchProjectStorageRows, bytesToHuman, bucketOf, usagePct,
  STORAGE_BUCKET_LABEL, EMPTY_TENANT_STORAGE, canViewStorage,
  type TenantStorage, type ProjectStorageRow, type StorageBucketId,
} from '@/data/db/storage'
import { ProjectFilesDrawer } from '@/components/ProjectFilesDrawer'
import { StoragePlansModal, canRequestStorage } from '@/components/StoragePlansModal'

interface Props { onNav?: (view: string, targetId?: string) => void }

export function usageColor(pct: number): string {
  if (pct > 90) return T.crit
  if (pct >= 70) return T.warn
  return T.success
}

export function UsageBar({ pct, height = 8, color }: { pct: number; height?: number; color?: string }) {
  const c = color ?? usageColor(pct)
  return (
    <div style={{ width: '100%', height, borderRadius: height, background: `${T.text3}22`, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%`, height: '100%', background: c, borderRadius: height, transition: 'width .3s' }} />
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16,
}

export default function StoragePage({ onNav }: Props) {
  const { activeUser } = useSession()
  const tenantId = getActiveTenantId()

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tenant, setTenant]   = useState<TenantStorage>(EMPTY_TENANT_STORAGE)
  const [rows, setRows]       = useState<ProjectStorageRow[]>([])
  const [bucket, setBucket]   = useState<StorageBucketId>('active')
  const [toast, setToast]     = useState<string | null>(null)
  const [filesFor, setFilesFor] = useState<ProjectStorageRow | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [plansOpen, setPlansOpen] = useState(false)

  const role = activeUser.role_context
  const canView = canViewStorage(role)
  const canRequest = canRequestStorage(role)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const [t, r] = await Promise.all([fetchTenantStorage(tenantId), fetchProjectStorageRows(tenantId)])
        if (!alive) return
        setTenant(t); setRows(r)
      } catch {
        if (alive) setError('Não foi possível carregar o consumo de armazenamento.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [tenantId, activeUser.user_id, reloadKey])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  const groups = useMemo(() => {
    const g: Record<StorageBucketId, ProjectStorageRow[]> = { active: [], done: [], paused: [] }
    for (const r of rows) g[bucketOf(r)].push(r)
    return g
  }, [rows])

  const pct = usagePct(tenant.usedBytes, tenant.effectiveBytes)
  const totalUsed = Math.max(1, rows.reduce((a, r) => a + r.usedBytes, 0))
  const visible = [...groups[bucket]].sort((a, b) => b.usedBytes - a.usedBytes)

  return (
    <div style={{ padding: 24, background: T.bgPage, minHeight: '100%' }}>
      <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text1 }}>Gestão de Armazenamento</h1>
      <p style={{ margin: '6px 0 20px', fontSize: 13, color: T.text2 }}>
        Consumo de anexos por tenant e por projeto (somente leitura).
      </p>

      {loading && <div style={{ ...cardStyle, color: T.text3, fontSize: 13 }}>Carregando consumo…</div>}
      {!loading && error && <div style={{ ...cardStyle, color: T.crit, fontSize: 13 }}>{error}</div>}

      {!loading && !error && (
        <>
          {/* ── Tenant meter ─────────────────────────────────────── */}
          <div data-tour="st-tenant" style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text3, fontWeight: 600 }}>
                  Consumo do tenant
                  <HelpHint text="Espaço de armazenamento contratado para o tenant. Ao atingir o limite, é preciso fazer upgrade do plano." />
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.text1, marginTop: 4 }}>
                  {bytesToHuman(tenant.usedBytes)} <span style={{ fontSize: 13, color: T.text3, fontWeight: 500 }}>de {bytesToHuman(tenant.effectiveBytes)} ({pct}%)</span>
                </div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{tenant.fileCount} arquivo(s)</div>
              </div>
              <div data-tour="st-plan" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: T.text2, background: `${T.accent}14`, border: `1px solid ${T.accent}33`, borderRadius: 6, padding: '4px 10px' }}>
                  Plano: <strong style={{ color: T.text1 }}>{tenant.plan}</strong>
                </span>
                {canView && <button data-tour="st-upgrade" onClick={() => setPlansOpen(true)} style={{
                  fontSize: 12, color: T.accent, background: `${T.accent}12`, border: `1px solid ${T.accent}33`,
                  borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
                }}>Fazer upgrade</button>}
              </div>
            </div>
            <UsageBar pct={pct} height={12} />
          </div>

          {/* ── Status cards ─────────────────────────────────────── */}
          <div data-tour="st-buckets" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
            {(Object.keys(STORAGE_BUCKET_LABEL) as StorageBucketId[]).map(id => {
              const list = groups[id]
              const used = list.reduce((a, r) => a + r.usedBytes, 0)
              const share = Math.round((used / totalUsed) * 100)
              const selected = bucket === id
              return (
                <button key={id} onClick={() => setBucket(id)} style={{
                  ...cardStyle, textAlign: 'left', cursor: 'pointer',
                  borderColor: selected ? T.accentBorder : T.border,
                  background: selected ? T.accentDim : T.bgSurface,
                }}>
                  <div style={{ fontSize: 12, color: T.text3, fontWeight: 600 }}>{STORAGE_BUCKET_LABEL[id]}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.text1, marginTop: 6 }}>{list.length}</div>
                  <div style={{ fontSize: 12, color: T.text2, marginBottom: 8 }}>projeto(s) · {bytesToHuman(used)}</div>
                  <UsageBar pct={share} height={6} color={T.accent} />
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 5 }}>{share}% do consumo total</div>
                </button>
              )
            })}
          </div>

          {/* ── Table ────────────────────────────────────────────── */}
          <div data-tour="st-table" style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 600, color: T.text1 }}>
              {STORAGE_BUCKET_LABEL[bucket]} · {visible.length} projeto(s)
            </div>
            {visible.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12, color: T.text3 }}>Nenhum projeto neste status.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: T.text3, textAlign: 'left' }}>
                    {['ID', 'Criado em', 'Criado por', 'Consumo', 'Fatia', ''].map(h => (
                      <th key={h} style={{ padding: '8px 16px', fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => {
                    const share = Math.round((r.usedBytes / totalUsed) * 100)
                    return (
                      <tr key={r.projectId} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: '10px 16px', color: T.text1 }}>
                          <strong>{r.key}</strong> <span style={{ color: T.text3 }}>{r.name}</span>
                        </td>
                        <td style={{ padding: '10px 16px', color: T.text2 }}>{new Date(r.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '10px 16px', color: T.text2 }}>{r.createdByName ?? '—'}</td>
                        <td style={{ padding: '10px 16px', color: T.text1 }}>{bytesToHuman(r.usedBytes)} <span style={{ color: T.text3 }}>({r.fileCount})</span></td>
                        <td style={{ padding: '10px 16px', minWidth: 120 }}><UsageBar pct={share} height={6} color={T.accent} /></td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setFilesFor(r)} style={{
                              fontSize: 11, color: T.accent, background: `${T.accent}12`, border: `1px solid ${T.accentBorder}`,
                              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                            }}>Arquivos</button>
                            <button onClick={() => onNav?.('project', r.projectId)} style={{
                              fontSize: 11, color: T.accent, background: 'none', border: `1px solid ${T.accentBorder}`,
                              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                            }}>Abrir</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <StoragePlansModal
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        currentPlan={tenant.plan}
        effectiveBytes={tenant.effectiveBytes}
        canRequest={canRequest}
        profileId={activeUser.user_id}
        actorName={activeUser.name}
        onToast={setToast}
      />

      {filesFor && (
        <ProjectFilesDrawer
          open
          onClose={() => setFilesFor(null)}
          tenantId={tenantId}
          projectId={filesFor.projectId}
          projectKey={filesFor.key}
          projectName={filesFor.name}
          onToast={setToast}
          onChanged={() => setReloadKey(k => k + 1)}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: T.bgSurface2,
          border: `1px solid ${T.border2}`, color: T.text1, borderRadius: 8,
          padding: '10px 16px', fontSize: 12, zIndex: 900,
        }}>{toast}</div>
      )}
    </div>
  )
}
