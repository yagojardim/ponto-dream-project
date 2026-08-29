// ─── Módulos Portfolio Page ───────────────────────────────────────────────────
// Reads the real `modules` catalog + `tenant_modules` state from Supabase.
// "Solicitar ativação" records a module_activation_request (status pending) —
// it NEVER activates a module. No billing / checkout anywhere.
import { useCallback, useEffect, useState } from 'react'
import { T } from '../components/ds/tokens'
import { HelpHint } from '../components/ds/HelpHint'
import { useSession } from '../data/SessionContext'
import { can } from '../data/permissions'
import { CATEGORY_LABELS, STATUS_META, type ModuleCategory, type ModuleStatus } from '../data/modules'
import {
  listModules, requestActivation,
  type ModuleView, type RequestPriority, type ContractStatus, type TechnicalHealth,
} from '../data/db/modules'
import {
  startTrial, reconcileExpiries, listTrials, daysRemaining,
  type ModuleTrialRow,
} from '../data/db/moduleTrials'

// ─── Design tokens (dark premium per spec) ────────────────────────────────────
const D = {
  card:    T.bgSurface,
  border:  T.border,
  green:   '#10B981',
  amber:   '#F59E0B',
  red:     '#EF4444',
  blue:    '#3B82F6',
  indigo:  '#6366F1',
  violet:  '#8B5CF6',
  text1:   T.text1,
  text2:   T.text2,
  text3:   T.text3,
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  const m = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: m.bg, fontSize: 11, color: m.color, fontWeight: 700,
      border: `1px solid ${m.color}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  )
}


// ─── Commercial status badge (contract_status) ────────────────────────────────
const CONTRACT_META: Record<ContractStatus, { label: string; color: string }> = {
  included:           { label: 'Incluído',            color: '#10B981' },
  trial_available:    { label: 'Teste disponível',    color: '#3B82F6' },
  trialing:           { label: 'Em teste',            color: '#8B5CF6' },
  trial_expired:      { label: 'Trial expirado',      color: '#F59E0B' },
  pending_activation: { label: 'Ativação pendente',   color: '#F59E0B' },
  active:             { label: 'Contratado',          color: '#10B981' },
  past_due:           { label: 'Pagamento pendente',  color: '#F59E0B' },
  suspended:          { label: 'Suspenso',            color: '#EF4444' },
  not_contracted:     { label: 'Não contratado',      color: '#8A8A9E' },
  planned:            { label: 'Planejado',           color: '#8A8A9E' },
}

const HEALTH_META: Record<TechnicalHealth, { label: string; color: string }> = {
  operational: { label: 'Operacional',  color: '#10B981' },
  degraded:    { label: 'Degradado',    color: '#F59E0B' },
  maintenance: { label: 'Manutenção',   color: '#3B82F6' },
  unavailable: { label: 'Indisponível', color: '#EF4444' },
}

function Pill({ label, color, outline }: { label: string; color: string; outline?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: outline ? 'transparent' : `${color}18`,
      fontSize: 11, color, fontWeight: 700,
      border: `1px solid ${color}44`, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color, flexShrink: 0 }} />
      {label}
    </span>
  )
}

function ContractBadge({ status }: { status: ContractStatus }) {
  const m = CONTRACT_META[status]
  return <Pill label={m.label} color={m.color} />
}

function HealthBadge({ health }: { health: TechnicalHealth }) {
  const m = HEALTH_META[health]
  return <Pill label={m.label} color={m.color} outline />
}

// ─── Coming-soon footer ribbon (uniform, reused) ─────────────────────────────
function ComingSoonRibbon() {
  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 16px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'center',
        color: D.amber,
        background: `${D.amber}12`,
        border: `1px solid ${D.amber}44`,
        opacity: 0.6,
        cursor: 'not-allowed',
      }}
    >
      Em breve
    </div>
  )
}


// ─── TypeTag ──────────────────────────────────────────────────────────────────
function TypeTag({ mod }: { mod: ModuleView }) {
  const tag = (color: string, label: string) => (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 4, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
  )
  if (mod.is_preview) return tag(D.violet, 'Preview')
  if (mod.is_future)  return tag(D.amber, 'Em breve')
  if (mod.is_premium) return tag(D.blue, 'Premium')
  return null
}

// ─── CTA style per status ─────────────────────────────────────────────────────
function ctaStyle(status: ModuleStatus): { style: 'primary' | 'secondary' | 'ghost' | 'danger' | 'disabled'; color: string } {
  switch (status) {
    case 'operational':    return { style: 'primary',   color: D.green  }
    case 'implemented':    return { style: 'primary',   color: D.blue   }
    case 'contracted':
    case 'deploying':      return { style: 'secondary', color: D.indigo }
    case 'pending':        return { style: 'disabled',  color: D.amber  }
    case 'not-contracted': return { style: 'secondary', color: D.amber  }
    case 'preview':        return { style: 'primary',   color: D.violet }
    case 'planned':        return { style: 'ghost',     color: D.text2  }
    case 'coming-soon':    return { style: 'ghost',     color: D.amber  }
    case 'suspended':      return { style: 'danger',    color: D.red    }
    default:               return { style: 'disabled',  color: D.text3  }
  }
}

// ─── Activation Request Modal ─────────────────────────────────────────────────
interface ActivationModalProps {
  mod:       ModuleView
  userId:    string
  userName:  string
  onDone:    () => void
  onCancel:  () => void
}

function ModuleActivationRequestModal({ mod, userId, userName, onDone, onCancel }: ActivationModalProps) {
  const [reason, setReason]         = useState('')
  const [usage, setUsage]           = useState('')
  const [priority, setPriority]     = useState<RequestPriority>('medium')
  const [obs, setObs]               = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr]               = useState('')

  const valid = reason.trim().length > 10 && usage.trim().length > 5

  async function handleSubmit() {
    if (!valid) { setErr('Preencha o motivo (mín. 10 caracteres) e o uso esperado.'); return }
    setSubmitting(true)
    setErr('')
    const row = await requestActivation(mod.id, {
      business_reason: reason.trim(),
      expected_use:    usage.trim(),
      priority,
      notes:           obs.trim() || undefined,
      requested_by:    userId || null,
      actor_name:      userName,
    })
    setSubmitting(false)
    if (!row) { setErr('Não foi possível registrar a solicitação. Tente novamente.'); return }
    onDone()
  }

  const inputSt: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px',
    borderRadius: 8, background: T.bgPage, border: `1px solid ${D.border}`,
    color: D.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(9,9,11,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, width: 520, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: T.shadowModal }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: D.text1 }}>Solicitar ativação</div>
            <div style={{ fontSize: 12, color: D.text3, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{mod.icon}</span><span>{mod.name}</span>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.text3, fontSize: 18 }}>✕</button>
        </div>

        <div style={{ padding: '8px 12px', borderRadius: 8, background: `${D.amber}12`, border: `1px solid ${D.amber}33`, marginBottom: 18 }}>
          <span style={{ fontSize: 11, color: D.amber }}>
            ⓘ A solicitação é registrada para análise da equipe Altech. Nenhuma ativação ou cobrança ocorre automaticamente.
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: D.text3, display: 'block', marginBottom: 5 }}>Motivo da solicitação <span style={{ color: D.red }}>*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Descreva por que o time precisa deste módulo…"
              style={{ ...inputSt, resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: D.text3, display: 'block', marginBottom: 5 }}>Uso esperado <span style={{ color: D.red }}>*</span></label>
            <textarea value={usage} onChange={e => setUsage(e.target.value)} rows={2}
              placeholder="Quem usaria? Com que frequência? Para qual processo?"
              style={{ ...inputSt, resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: D.text3, display: 'block', marginBottom: 5 }}>Prioridade</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['low', 'medium', 'high', 'critical'] as RequestPriority[]).map(p => {
                const pColor = p === 'critical' ? D.red : p === 'high' ? D.amber : p === 'medium' ? D.blue : D.text3
                return (
                  <button key={p} onClick={() => setPriority(p)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: priority === p ? `${pColor}20` : 'transparent',
                    border: `1px solid ${priority === p ? pColor : D.border}`,
                    color: priority === p ? pColor : D.text3,
                    transition: 'all 0.15s',
                  }}>
                    {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : p === 'high' ? 'Alta' : 'Crítica'}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: D.text3, display: 'block', marginBottom: 5 }}>Observações (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Informações adicionais para a equipe Altech…"
              style={{ ...inputSt, resize: 'vertical' }} />
          </div>

          {err && <div style={{ fontSize: 11, color: D.red }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <button onClick={onCancel} style={{ padding: '9px 18px', borderRadius: 9, background: 'transparent', border: `1px solid ${D.border}`, color: D.text2, fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!valid || submitting} style={{
            padding: '9px 20px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700,
            cursor: valid && !submitting ? 'pointer' : 'not-allowed',
            background: valid && !submitting ? D.amber : `${D.amber}40`,
            color: valid && !submitting ? '#fff' : `${D.amber}80`,
            transition: 'all 0.15s',
          }}>
            {submitting ? 'Enviando…' : 'Enviar solicitação'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function ModuleDetailModal({ mod, onClose }: { mod: ModuleView; onClose: () => void }) {
  const meta = STATUS_META[mod.status]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(9,9,11,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, width: 500, maxHeight: '85vh', overflow: 'auto', padding: 28, boxShadow: T.shadowModal }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 32 }}>{mod.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: D.text1 }}>{mod.name}</div>
              <div style={{ fontSize: 11, color: D.text3, marginTop: 2 }}>{CATEGORY_LABELS[mod.category]}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.text3, fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: D.text2, marginBottom: 16, lineHeight: 1.6 }}>{mod.description}</div>
        {mod.features.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: D.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Funcionalidades</div>
            {mod.features.map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: meta.color, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 12, color: D.text2 }}>{f}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: `${meta.color}10`, border: `1px solid ${meta.color}30` }}>
          <ModuleStatusBadge status={mod.status} />
          {mod.notes && <span style={{ fontSize: 11, color: D.text3 }}>{mod.notes}</span>}
          {mod.status === 'suspended' && (
            <span style={{ fontSize: 11, color: D.red }}>
              {mod.suspended_reason ?? 'Contacte o suporte para mais informações.'}
            </span>
          )}
          {mod.status === 'pending' && mod.requested_at && (
            <span style={{ fontSize: 11, color: D.text3 }}>
              Solicitado em {new Date(mod.requested_at).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Module Card ──────────────────────────────────────────────────────────────
interface CardProps {
  mod:        ModuleView
  canRequest: boolean
  trial:      ModuleTrialRow | null
  busy:       boolean
  onAction:   (mod: ModuleView) => void
  onTrial:    (mod: ModuleView) => void
}

type CardAction = 'trial' | 'open' | 'details' | 'reason' | 'none'

/**
 * Modules that are always rendered as active/operational, bypassing the
 * tenant-state commercial status (e.g. Client Portal, Storage Manager).
 */
const ALWAYS_ACTIVE_KEYS = new Set(['CLIENT_PORTAL', 'STORAGE_MANAGER'])

function normalizeActiveModule(mod: ModuleView): ModuleView {
  if (!ALWAYS_ACTIVE_KEYS.has(mod.key)) return mod
  return {
    ...mod,
    status: 'operational',
    contract_status: 'included',
    technical_health: 'operational',
    cta: {
      label: mod.key === 'STORAGE_MANAGER' ? 'Gerenciar / Contratar pacotes' : 'Abrir módulo',
      action: 'open',
    },
  }
}

/**
 * CTA por estado COMERCIAL. "Contratar" fica escondido nesta fase — contratação
 * é responsabilidade do Altech Control.
 */
function planFor(mod: ModuleView, trial: ModuleTrialRow | null): { label: string; action: CardAction } {
  if (mod.is_future) {
    return { label: 'Em breve', action: 'none' }
  }
  if (mod.key === 'STORAGE_MANAGER') {
    return { label: 'Gerenciar / Contratar pacotes', action: 'open' }
  }
  switch (mod.contract_status) {
    case 'included':
    case 'active':           return { label: 'Abrir módulo', action: 'open' }
    case 'trialing':         return { label: trial ? 'Abrir módulo' : 'Ver detalhes', action: trial ? 'open' : 'details' }
    case 'trial_expired':    return { label: 'Ver detalhes', action: 'details' }
    case 'pending_activation': return { label: 'Solicitado — Pendente', action: 'none' }
    case 'planned':          return { label: 'Conhecer recurso', action: 'details' }
    case 'suspended':        return { label: 'Ver motivo', action: 'reason' }
    case 'past_due':         return { label: 'Ver detalhes', action: 'details' }
    case 'not_contracted':
    case 'trial_available':
    default:                 return { label: 'Testar grátis', action: 'trial' }
  }
}

function ModulePortfolioCard({ mod: rawMod, canRequest, trial, busy, onAction, onTrial }: CardProps) {
  const mod = normalizeActiveModule(rawMod)
  const [hovered, setHovered] = useState(false)
  const status = mod.status
  const plan = planFor(mod, trial)
  const label = busy ? 'Ativando…' : plan.label
  const action = plan.action
  const isComingSoon = mod.is_future
  const { style, color } = plan.action === 'trial'
    ? { style: 'primary' as const, color: D.blue }
    : ctaStyle(status)
  const isDisabled = busy || style === 'disabled' || isComingSoon || (!canRequest && action === 'trial')

  const btnSt: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
      cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
      opacity: isDisabled ? 0.5 : 1,
    }
    if (isDisabled) return { ...base, background: `${color}18`, border: `1px solid ${color}22`, color }
    switch (style) {
      case 'primary':   return { ...base, background: color, border: 'none', color: '#fff' }
      case 'secondary': return { ...base, background: `${color}18`, border: `1px solid ${color}44`, color }
      case 'ghost':     return { ...base, background: 'transparent', border: `1px solid ${D.border}`, color: D.text2 }
      case 'danger':    return { ...base, background: `${D.red}14`, border: `1px solid ${D.red}44`, color: D.red }
      default:          return { ...base, background: `${color}18`, border: `1px solid ${color}22`, color }
    }
  })()

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#1e1e2a' : D.card,
        border: `1px solid ${hovered ? '#363650' : D.border}`,
        borderRadius: 12, padding: '20px 22px',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
      }}
    >
      {(status === 'operational' || status === 'implemented') && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${D.green}00, ${D.green}, ${D.green}00)` }} />
      )}
      {status === 'preview' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${D.violet}00, ${D.violet}, ${D.violet}00)` }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: D.border, border: '1px solid #303040',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>
          {mod.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: D.text1 }}>{mod.name}</span>
            <TypeTag mod={mod} />
          </div>
          <div style={{ fontSize: 11, color: D.text3 }}>{mod.tagline}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
          {!isComingSoon && <ContractBadge status={mod.contract_status} />}
          <HealthBadge health={mod.technical_health} />
        </div>
      </div>

      {!isComingSoon && mod.contract_status === 'trialing' && trial && (
        <div style={{
          marginBottom: 12, padding: '7px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          color: daysRemaining(trial) <= 3 ? D.amber : D.violet,
          background: `${daysRemaining(trial) <= 3 ? D.amber : D.violet}14`,
          border: `1px solid ${daysRemaining(trial) <= 3 ? D.amber : D.violet}44`,
        }}>
          Em teste — {daysRemaining(trial)} dia{daysRemaining(trial) !== 1 ? 's' : ''} restante{daysRemaining(trial) !== 1 ? 's' : ''}
        </div>
      )}

      {!isComingSoon && (mod.contract_status === 'trial_available' || mod.contract_status === 'not_contracted') && (
        <div style={{ marginBottom: 12, fontSize: 11, color: D.text3 }}>
          Teste grátis disponível por {mod.trial_duration_days} dias
        </div>
      )}

      {!isComingSoon && mod.contract_status === 'trial_expired' && (
        <div style={{ marginBottom: 12, fontSize: 11, color: D.amber }}>
          Trial expirado
        </div>
      )}

      <p style={{ fontSize: 12, color: D.text2, lineHeight: 1.6, margin: '0 0 14px' }}>
        {mod.description.length > 140 ? mod.description.slice(0, 140) + '…' : mod.description}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18, flex: 1 }}>
        {mod.features.slice(0, 4).map(f => (
          <div key={f} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 11, color: STATUS_META[status].color, marginTop: 1, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 11, color: D.text3, lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
        {mod.features.length > 4 && (
          <span style={{ fontSize: 11, color: D.text3, opacity: 0.6, paddingLeft: 18 }}>+{mod.features.length - 4} funcionalidades</span>
        )}
      </div>

      {isComingSoon ? (
        <ComingSoonRibbon />
      ) : (
        <>
          {!isDisabled ? (
            <button onClick={() => (action === 'trial' ? onTrial(mod) : onAction(mod))} style={btnSt}>{label}</button>
          ) : (
            <div style={btnSt}>{label}</div>
          )}

          {!canRequest && action === 'trial' && (
            <div style={{ fontSize: 10, color: D.text3, marginTop: 8, textAlign: 'center' }}>
              Sem permissão para iniciar teste
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
interface Props {
  onNav?: (v: string, targetId?: string) => void
}

type ModalState =
  | { type: 'none' }
  | { type: 'activate'; mod: ModuleView }
  | { type: 'detail';   mod: ModuleView }

const CATEGORY_ORDER: ModuleCategory[] = ['intelligence', 'integration', 'external', 'community', 'governance', 'security']

export default function ModulesPortfolioPage({ onNav }: Props) {
  const { activeUser } = useSession()
  const { permissions, user_id: userId, name: userName } = activeUser

  const canView    = can(permissions, 'module:request') || can(permissions, 'users:manage')
  const canRequest = can(permissions, 'module:request')

  const [mods, setMods]       = useState<ModuleView[]>([])
  const [trials, setTrials]   = useState<Record<string, ModuleTrialRow>>({})
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(false)

  const [modal, setModal]         = useState<ModalState>({ type: 'none' })
  const [filterCat, setFilterCat] = useState<ModuleCategory | 'all'>('all')
  const [toastMsg, setToastMsg]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    await reconcileExpiries()
    const [rows, trialRows] = await Promise.all([listModules(), listTrials()])
    const map: Record<string, ModuleTrialRow> = {}
    for (const t of trialRows) {
      if (t.status === 'active' || t.status === 'expiring') map[t.module_id] = t
    }
    setMods(rows)
    setTrials(map)
    setLoadErr(rows.length === 0)
    setLoading(false)
  }, [])

  useEffect(() => { if (canView) void load() }, [canView, load])

  function showToast(msg: string) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000) }

  if (!canView) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <div style={{ fontSize: 14, color: D.text2, fontWeight: 600 }}>Acesso restrito</div>
        <div style={{ fontSize: 12, color: D.text3 }}>Permissão necessária: configuração de módulos</div>
      </div>
    )
  }

  async function handleTrial(mod: ModuleView) {
    if (!canRequest) return
    setBusyId(mod.id)
    const trial = await startTrial(mod.id, { id: userId || null, name: userName })
    setBusyId(null)
    if (!trial) { showToast('Não foi possível iniciar o teste. Tente novamente.'); return }
    await load()
    showToast(`Teste de "${mod.name}" iniciado — ${mod.trial_duration_days} dias.`)
  }

  function handleAction(mod: ModuleView) {
    switch (mod.cta.action) {
      case 'open':
        if (mod.key === 'CLIENT_PORTAL') { onNav?.('client'); return }
        if (mod.key === 'STORAGE_MANAGER') { onNav?.('storage'); return }
        onNav?.('config'); return
      case 'preview':
        setModal({ type: 'detail', mod }); return
      case 'request':
        if (canRequest) setModal({ type: 'activate', mod })
        return
      case 'details':
      case 'reason':
        setModal({ type: 'detail', mod }); return
      default: return
    }
  }

  const activeCount     = mods.filter(m => ['operational', 'implemented', 'preview'].includes(m.status)).length
  const contractedCount = mods.filter(m => ['operational', 'implemented', 'contracted', 'deploying', 'preview'].includes(m.status)).length
  const displayedCats   = filterCat === 'all' ? CATEGORY_ORDER : [filterCat]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, background: T.bgSurface, border: `1px solid ${D.border}`, borderRadius: 10, padding: '11px 18px', color: D.text1, fontSize: 13, boxShadow: T.shadowModal }}>
          {toastMsg}
        </div>
      )}

      {modal.type === 'activate' && (
        <ModuleActivationRequestModal
          mod={modal.mod}
          userId={userId}
          userName={userName}
          onDone={() => {
            const name = modal.mod.name
            setModal({ type: 'none' })
            void load()
            showToast(`Solicitação de "${name}" registrada. Status: Solicitado.`)
          }}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'detail' && (
        <ModuleDetailModal mod={modal.mod} onClose={() => setModal({ type: 'none' })} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 700, color: D.text1 }}>
            Módulos da Plataforma
            <HelpHint title="Comercial × Técnico" text="O status comercial (contratado, em teste/trial) é separado do estado técnico (operacional, em manutenção). Um não implica o outro." />
          </div>
          <div style={{ fontSize: 12, color: D.text3, marginTop: 4, display: 'flex', gap: 16 }}>
            <span><span style={{ color: D.green, fontWeight: 700 }}>●</span> {activeCount} ativo{activeCount !== 1 ? 's' : ''}</span>
            <span>{contractedCount} contratado{contractedCount !== 1 ? 's' : ''}</span>
            <span>{mods.length} no catálogo</span>
          </div>
        </div>
        <div style={{ padding: '5px 12px', borderRadius: 8, background: `${D.amber}12`, border: `1px solid ${D.amber}30`, fontSize: 11, color: D.amber }}>
          ⓘ Ativação sob análise — sem cobrança automática
        </div>
      </div>

      {/* KPI strip */}
      <div data-tour="modules-counters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Implementados', value: mods.filter(m => m.status === 'implemented' || m.status === 'operational').length, color: D.blue },
          { label: 'Em preview',    value: mods.filter(m => m.status === 'preview').length,        color: D.violet },
          { label: 'Solicitados',   value: mods.filter(m => m.status === 'pending').length,        color: D.amber },
          { label: 'Disponíveis',   value: mods.filter(m => m.status === 'not-contracted').length, color: D.text3 },
        ].map(k => (
          <div key={k.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</span>
            <span style={{ fontSize: 11, color: D.text3, lineHeight: 1.3 }}>{k.label}</span>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
        {(['all', ...CATEGORY_ORDER] as const).map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{
            padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: filterCat === cat ? T.accent : 'transparent',
            color: filterCat === cat ? '#fff' : D.text2,
            border: `1px solid ${filterCat === cat ? T.accent : D.border}`,
            transition: 'all 0.15s',
          }}>
            {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* States */}
      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: D.text3 }}>
          Carregando módulos…
        </div>
      )}

      {!loading && loadErr && (
        <div style={{ padding: '32px 24px', textAlign: 'center', background: D.card, border: `1px solid ${D.red}33`, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: D.text1, fontWeight: 600, marginBottom: 6 }}>Não foi possível carregar o catálogo de módulos.</div>
          <div style={{ fontSize: 12, color: D.text3, marginBottom: 14 }}>Verifique a conexão e tente novamente.</div>
          <button onClick={() => void load()} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: `1px solid ${D.border}`, color: D.text2, fontSize: 12, cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Grid by category */}
      {!loading && !loadErr && displayedCats.map((cat, catIdx) => {
        const catMods = mods.filter(m => m.category === cat)
        if (catMods.length === 0) return null
        return (
          <div key={cat} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: D.border }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: D.text3, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                {CATEGORY_LABELS[cat]}
              </span>
              <div style={{ flex: 1, height: 1, background: D.border }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {catMods.map((mod, modIdx) => (
                <div key={mod.id} data-tour={catIdx === 0 && modIdx === 0 ? 'modules-card' : undefined}>
                <ModulePortfolioCard
                  key={mod.id}
                  mod={mod}
                  canRequest={canRequest}
                  trial={trials[mod.id] ?? null}
                  busy={busyId === mod.id}
                  onAction={handleAction}
                  onTrial={handleTrial}
                />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {!loading && !loadErr && mods.length === 0 && (
        <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: D.text3 }}>
          Nenhum módulo disponível no catálogo.
        </div>
      )}
    </div>
  )
}
