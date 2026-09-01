import { useEffect, useState } from 'react'
import { Modal } from '@/components/ds/Modal'
import { Button } from '@/components/ds/Button'
import { T } from '@/components/ds/tokens'
import {
  cloneDefaultCeremonySlots,
  WEEKDAY_LABELS,
  type CeremonyOccurrence,
  type CeremonySlot,
} from '@/data/db/calendarEvents'

interface SprintCeremoniesModalProps {
  open: boolean
  sprintName: string
  busy?: boolean
  onClose: () => void
  onConfirm: (slots: CeremonySlot[]) => void
}

const OCCURRENCES: { value: CeremonyOccurrence; label: string }[] = [
  { value: 'every', label: 'Todas as ocorrências' },
  { value: 'first', label: 'Primeira ocorrência' },
  { value: 'last',  label: 'Última ocorrência' },
]

const inputStyle: React.CSSProperties = {
  height: 28,
  padding: '0 8px',
  borderRadius: 8,
  background: T.bgSurface2,
  border: `1px solid ${T.border}`,
  color: T.text1,
  fontSize: 12,
}

export function SprintCeremoniesModal({
  open, sprintName, busy = false, onClose, onConfirm,
}: SprintCeremoniesModalProps) {
  const [slots, setSlots] = useState<CeremonySlot[]>(cloneDefaultCeremonySlots)

  useEffect(() => { if (open) setSlots(cloneDefaultCeremonySlots()) }, [open])

  function patch(id: string, next: Partial<CeremonySlot>) {
    setSlots(prev => prev.map(s => (s.id === id ? { ...s, ...next } : s)))
  }

  function toggleDay(slot: CeremonySlot, day: number) {
    const days = slot.days.includes(day)
      ? slot.days.filter(d => d !== day)
      : [...slot.days, day].sort((a, b) => a - b)
    patch(slot.id, { days })
  }

  const anyEnabled = slots.some(s => s.enabled && s.days.length > 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar cerimônias da sprint"
      subtitle={`${sprintName} · escolha as cerimônias, os dias e os horários`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button
            data-tour="sc-generate"
            variant="primary"
            size="sm"
            loading={busy}
            disabled={!anyEnabled}
            onClick={() => onConfirm(slots.filter(s => s.enabled && s.days.length > 0))}
          >
            Gerar cerimônias
          </Button>
        </>
      }
    >
      <div className="px-6 py-4 flex flex-col gap-3">
        {slots.map((slot, i) => (
          <div
            key={slot.id}
            data-tour={i === 0 ? 'sc-slot' : undefined}
            className="rounded-xl p-3 flex flex-col gap-2.5"
            style={{
              border: `1px solid ${T.border}`,
              background: slot.enabled ? T.bgSurface2 : 'transparent',
              opacity: slot.enabled ? 1 : 0.6,
            }}
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={slot.enabled}
                onChange={e => patch(slot.id, { enabled: e.target.checked })}
              />
              <span className="text-[13px] font-semibold" style={{ color: T.text1 }}>{slot.label}</span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                {WEEKDAY_LABELS.map(w => {
                  const on = slot.days.includes(w.day)
                  return (
                    <button
                      key={w.day}
                      type="button"
                      disabled={!slot.enabled}
                      onClick={() => toggleDay(slot, w.day)}
                      className="h-7 px-2.5 text-[11px] font-medium rounded-lg transition-colors"
                      style={{
                        background: on ? T.accentDim : 'transparent',
                        color: on ? T.accent : T.text2,
                        border: `1px solid ${on ? T.accentBorder : T.border}`,
                        cursor: slot.enabled ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {w.label}
                    </button>
                  )
                })}
              </div>

              <select
                value={slot.occurrence}
                disabled={!slot.enabled}
                onChange={e => patch(slot.id, { occurrence: e.target.value as CeremonyOccurrence })}
                style={inputStyle}
              >
                {OCCURRENCES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={slot.start}
                  disabled={!slot.enabled}
                  onChange={e => patch(slot.id, { start: e.target.value })}
                  style={inputStyle}
                />
                <span className="text-[11px]" style={{ color: T.text3 }}>até</span>
                <input
                  type="time"
                  value={slot.end}
                  disabled={!slot.enabled}
                  onChange={e => patch(slot.id, { end: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        ))}
        <p className="text-[11px]" style={{ color: T.text3 }}>
          A geração é idempotente: cerimônias já existentes na mesma data e horário não são duplicadas.
        </p>
      </div>
    </Modal>
  )
}
