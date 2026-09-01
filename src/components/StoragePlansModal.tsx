// Storage plans / add-ons catalog. Requests only — no checkout, no quota change.
import { useState } from 'react'
import { Modal } from '@/components/ds/Modal'
import { T } from '@/components/ds/tokens'
import { bytesToHuman } from '@/data/db/storage'
import { findModuleIdByKey, requestActivation } from '@/data/db/modules'

export const STORAGE_MODULE_KEY = 'STORAGE_MANAGER'

export type Billing = 'monthly' | 'yearly'

export interface StoragePack {
  pack: string
  gb: number
  monthly: number
  yearly: number
}

export const STORAGE_PACKS: StoragePack[] = [
  { pack: '+10GB',  gb: 10,  monthly: 9.9,  yearly: 99 },
  { pack: '+25GB',  gb: 25,  monthly: 19.9, yearly: 199 },
  { pack: '+50GB',  gb: 50,  monthly: 39.9, yearly: 399 },
  { pack: '+100GB', gb: 100, monthly: 69.9, yearly: 699 },
]

export const STORAGE_PLANS = [
  { id: 'free', name: 'Free',  gb: 1,  note: 'Incluso em todas as contas' },
  { id: 'paid', name: 'Pago',  gb: 25, note: 'Mais espaço para anexos do time' },
]

/** Roles allowed to submit a request (who contracts). */
export const STORAGE_BUYER_ROLES = ['Admin', 'ProjectManager', 'ProductOwner'] as const

export function canRequestStorage(role: string): boolean {
  return (STORAGE_BUYER_ROLES as readonly string[]).includes(role)
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  open: boolean
  onClose: () => void
  currentPlan: string
  effectiveBytes: number
  canRequest: boolean
  profileId?: string | null
  actorName?: string
  onToast: (msg: string) => void
}

const card: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14,
}

export function StoragePlansModal({
  open, onClose, currentPlan, effectiveBytes, canRequest, profileId, actorName, onToast,
}: Props) {
  const [billing, setBilling] = useState<Billing>('monthly')
  const [busy, setBusy] = useState<string | null>(null)

  async function submit(pack: string) {
    if (!canRequest || busy) return
    setBusy(pack)
    try {
      const moduleId = await findModuleIdByKey(STORAGE_MODULE_KEY)
      if (!moduleId) { onToast('Módulo de armazenamento indisponível'); return }
      const res = await requestActivation(moduleId, {
        business_reason: `Ampliação de armazenamento (${pack})`,
        expected_use: `Pacote ${pack} — cobrança ${billing === 'monthly' ? 'mensal' : 'anual'}`,
        priority: 'medium',
        requested_by: profileId ?? null,
        actor_name: actorName,
        metadata: { pack, billing },
      })
      onToast(res ? 'Solicitação registrada' : 'Não foi possível registrar a solicitação')

    } finally {
      setBusy(null)
    }
  }

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    fontSize: 12, borderRadius: 6, padding: '6px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
    color: T.accent, background: `${T.accent}12`, border: `1px solid ${T.accentBorder}`,
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Planos de armazenamento"
      subtitle="Solicitações são registradas para análise — nenhuma cobrança é feita agora."
      size="lg"
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Current plan */}
        <div data-tour="sp-current" style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: T.text3, fontWeight: 600 }}>Plano atual</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text1, marginTop: 2 }}>{currentPlan}</div>
          </div>
          <div style={{ fontSize: 12, color: T.text2 }}>
            Cota efetiva: <strong style={{ color: T.text1 }}>{bytesToHuman(effectiveBytes)}</strong>
          </div>
        </div>

        {/* Plans */}
        <div data-tour="sp-plans">
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text1, marginBottom: 8 }}>Planos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {STORAGE_PLANS.map(p => (
              <div key={p.id} style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>{p.name}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.text1, marginTop: 4 }}>{p.gb} GB</div>
                <div style={{ fontSize: 11, color: T.text3, margin: '4px 0 10px' }}>{p.note}</div>
                <button
                  disabled={!canRequest || busy !== null}
                  onClick={() => submit(p.name === 'Free' ? 'plan:free' : 'plan:paid')}
                  style={btnStyle(!canRequest || busy !== null)}
                >
                  {canRequest ? 'Solicitar' : 'Solicite ao gestor'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Billing toggle */}
        <div data-tour="sp-billing" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text1, marginRight: 4 }}>Aumente seu armazenamento</span>
          {(['monthly', 'yearly'] as Billing[]).map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{
              fontSize: 11, borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              color: billing === b ? T.accent : T.text2,
              background: billing === b ? T.accentDim : 'transparent',
              border: `1px solid ${billing === b ? T.accentBorder : T.border}`,
            }}>{b === 'monthly' ? 'Mensal' : 'Anual (≈2 meses grátis)'}</button>
          ))}
        </div>

        <div data-tour="sp-packs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {STORAGE_PACKS.map(p => (
            <div key={p.pack} style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text1 }}>{p.pack}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text1, marginTop: 6 }}>
                {brl(billing === 'monthly' ? p.monthly : p.yearly)}
                <span style={{ fontSize: 11, color: T.text3, fontWeight: 500 }}>{billing === 'monthly' ? '/mês' : '/ano'}</span>
              </div>
              <div style={{ fontSize: 11, color: T.text3, margin: '4px 0 10px' }}>
                {billing === 'monthly' ? `ou ${brl(p.yearly)}/ano` : `ou ${brl(p.monthly)}/mês`}
              </div>
              <button
                disabled={!canRequest || busy !== null}
                onClick={() => submit(p.pack)}
                style={btnStyle(!canRequest || busy !== null)}
              >
                {busy === p.pack ? 'Enviando…' : canRequest ? 'Solicitar' : 'Solicite ao gestor'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
