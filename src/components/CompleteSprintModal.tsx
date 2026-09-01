import React, { useState } from 'react'
import { T } from './ds/tokens'

export interface RemainingItem { id: string; key: string; title: string }
export interface SprintDecision { workItemId: string; destination: 'next-sprint' | 'backlog' }

interface CompleteSprintProps {
  sprint: { id: string; name: string; goal?: string }
  stats: { done: number; total: number; remaining: number }
  remainingItems?: RemainingItem[]
  nextSprintName?: string
  onClose: () => void
  onConfirm: (decisions: SprintDecision[], comment: string, reason: string) => void

}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const dialog: React.CSSProperties = {
  width: 480,
  maxWidth: '95vw',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: T.bgSurface,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  boxShadow: T.shadowModal,
  display: 'flex',
  flexDirection: 'column',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: T.bgSurface2,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '8px 12px',
  color: T.text1,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'vertical',
  fontFamily: 'inherit',
}

export function CompleteSprintModal({ sprint, stats, remainingItems = [], nextSprintName, onClose, onConfirm }: CompleteSprintProps) {
  const hasNext = Boolean(nextSprintName)
  const [decisions, setDecisions] = useState<Record<string, 'next-sprint' | 'backlog'>>(() =>
    Object.fromEntries(remainingItems.map(i => [i.id, hasNext ? 'next-sprint' : 'backlog'])),
  )
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const commentMissing = comment.trim().length === 0

  const velocity = stats.done * 3

  function setAll(dest: 'next-sprint' | 'backlog') {
    setDecisions(Object.fromEntries(remainingItems.map(i => [i.id, dest])))
  }

  function handleConfirm() {
    if (commentMissing) { setTouched(true); return }
    onConfirm(
      remainingItems.map(i => ({
        workItemId: i.id,
        destination: decisions[i.id] ?? (hasNext ? 'next-sprint' : 'backlog'),
      })),
      comment.trim(),
      reason.trim(),
    )
  }


  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text1 }}>Concluir Sprint</span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6, border: 'none', background: 'transparent',
              color: T.text3, cursor: 'pointer', fontSize: 18, lineHeight: 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bgSurface2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
          {/* Sprint name + goal */}
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: T.accent, marginBottom: 4 }}>
              {sprint.name}
            </p>
            {sprint.goal && (
              <p style={{ fontSize: 13, fontStyle: 'italic', color: T.text2 }}>
                "{sprint.goal}"
              </p>
            )}
          </div>

          {/* Stats */}
          <div data-tour="cs-summary" style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Concluídas', value: stats.done, color: T.success, bg: T.successDim },
              { label: 'Restantes', value: stats.remaining, color: T.warn, bg: T.warnDim },
              { label: 'Total', value: stats.total, color: T.text2, bg: T.bgSurface2 },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  borderRadius: 10,
                  background: stat.bg,
                  border: `1px solid ${T.border}`,
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: 24, fontWeight: 700, color: stat.color, lineHeight: 1 }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Per-item destination */}
          {remainingItems.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
                  Destino de cada demanda restante ({remainingItems.length})
                </p>
                <div data-tour="cs-bulk" style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setAll('next-sprint')}
                    disabled={!hasNext}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 11,
                      border: `1px solid ${T.border2}`, background: 'transparent',
                      color: hasNext ? T.text2 : T.text3, cursor: hasNext ? 'pointer' : 'not-allowed',
                    }}
                  >Todas → próxima sprint</button>
                  <button
                    onClick={() => setAll('backlog')}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 11,
                      border: `1px solid ${T.border2}`, background: 'transparent',
                      color: T.text2, cursor: 'pointer',
                    }}
                  >Todas → backlog</button>
                </div>
              </div>

              <div data-tour="cs-items" style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                maxHeight: 260, overflowY: 'auto',
              }}>
                {remainingItems.map(item => {
                  const dest = decisions[item.id] ?? (hasNext ? 'next-sprint' : 'backlog')
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: T.bgSurface2, border: `1px solid ${T.border}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, color: T.text3, fontWeight: 600 }}>{item.key}</p>
                        <p style={{
                          fontSize: 13, color: T.text1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{item.title}</p>
                      </div>
                      <div style={{ display: 'flex', flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border2}` }}>
                        {([
                          { key: 'next-sprint' as const, label: `→ ${nextSprintName ?? 'Próxima sprint'}`, disabled: !hasNext },
                          { key: 'backlog' as const, label: 'Backlog', disabled: false },
                        ]).map(opt => {
                          const active = dest === opt.key
                          return (
                            <button
                              key={opt.key}
                              disabled={opt.disabled}
                              onClick={() => setDecisions(prev => ({ ...prev, [item.id]: opt.key }))}
                              style={{
                                padding: '6px 10px', fontSize: 11, fontWeight: 600, border: 'none',
                                background: active ? T.accentDim : 'transparent',
                                color: opt.disabled ? T.text3 : active ? T.accent : T.text2,
                                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                                maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >{opt.label}</button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              {!hasNext && (
                <p style={{ fontSize: 11, color: T.text3, marginTop: 8 }}>
                  Não há próxima sprint planejada — as demandas restantes voltam para o backlog.
                </p>
              )}
            </div>
          )}

          {/* Comment (required) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }}>
              Comentário de conclusão <span style={{ color: T.warn }}>*</span>
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={e => setComment(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Resumo do sprint, aprendizados..."
              style={{
                ...inputStyle,
                border: `1px solid ${touched && commentMissing ? T.warn : T.border}`,
              }}
            />
            {touched && commentMissing && (
              <p style={{ fontSize: 11, color: T.warn, marginTop: 6 }}>
                Descreva o encerramento / motivo do transbordo
              </p>
            )}
          </div>

          {/* Overflow reason (optional) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }}>
              Motivo do transbordo (opcional)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Por que as demandas não foram concluídas?"
              style={inputStyle}
            />
          </div>


          {/* Velocity */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 14px',
            borderRadius: 8,
            background: T.successDim,
            border: `1px solid rgba(53,201,174,0.2)`,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2l1.7 3.5L14 6.3l-3 2.9.7 4.1L8 11.3l-3.7 2 .7-4.1-3-2.9 4.3-.8L8 2z" fill={T.success} />
            </svg>
            <span style={{ fontSize: 13, color: T.success, fontWeight: 600 }}>
              Velocity desta sprint: {velocity} pts
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          padding: '16px 24px',
          borderTop: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: `1px solid ${T.border2}`,
              background: 'transparent',
              color: T.text2,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >Cancelar</button>
          <button
            data-tour="cs-confirm"
            onClick={handleConfirm}
            disabled={commentMissing}
            title={commentMissing ? 'Descreva o encerramento / motivo do transbordo' : undefined}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: 'none',
              background: commentMissing ? T.bgSurface2 : T.warn,
              color: commentMissing ? T.text3 : '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: commentMissing ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!commentMissing) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none' }}
          >Concluir Sprint</button>

        </div>
      </div>
    </div>
  )
}
