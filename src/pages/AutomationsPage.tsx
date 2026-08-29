import React, { useState } from 'react'
import { T } from '../components/ds/tokens'

interface AutoDef {
  id: number
  name: string
  active: boolean
  trigger: string
  action: string
}

const INITIAL_AUTOS: AutoDef[] = [
  { id:0, name:'Demanda movida para Done → Notificar QA',  active:true,  trigger:'Demanda movida de status', action:'Enviar notificação' },
  { id:1, name:'Bug crítico criado → Atribuir a AL',      active:true,  trigger:'Demanda criada',           action:'Atribuir responsável' },
  { id:2, name:'Sprint iniciada → Criar checklist',       active:false, trigger:'Sprint iniciada',        action:'Criar subtarefa' },
  { id:3, name:'Sem atualizações há 3 dias → Alerta',     active:true,  trigger:'Campo alterado',         action:'Enviar notificação' },
  { id:4, name:'Prazo próximo → Notificar responsável',   active:true,  trigger:'Prazo atingido',         action:'Enviar notificação' },
]

const TRIGGER_OPTIONS = [
  'Demanda movida de status',
  'Demanda criada',
  'Sprint iniciada',
  'Sprint finalizada',
  'Campo alterado',
  'Comentário adicionado',
  'Prazo atingido',
]

const ACTION_OPTIONS = [
  'Alterar status',
  'Atribuir responsável',
  'Adicionar label',
  'Criar subtarefa',
  'Enviar notificação',
  'Criar comentário',
  'Chamar webhook',
]

const CONDITION_FIELDS = ['Tipo', 'Prioridade', 'Label', 'Épico', 'Responsável']
const CONDITION_OPS    = ['é', 'não é', 'contém', 'está em']

const WORKFLOW_STATUSES = ['Backlog', 'A Fazer', 'Em andamento', 'Em revisão', 'Concluído']

const LOG_ROWS = [
  { ts:'25 Jul 2026 14:32', trigger:'Demanda movida de status', result:'success', detail:'Notificação enviada para #QA-channel' },
  { ts:'25 Jul 2026 09:11', trigger:'Demanda movida de status', result:'success', detail:'Notificação enviada para #QA-channel' },
  { ts:'24 Jul 2026 17:48', trigger:'Demanda criada',           result:'success', detail:'Responsável AL atribuído à BUG-214' },
  { ts:'24 Jul 2026 11:03', trigger:'Demanda movida de status', result:'partial', detail:'Webhook respondeu 206 — verificar payload' },
  { ts:'23 Jul 2026 16:20', trigger:'Prazo atingido',         result:'success', detail:'Notificação enviada para Rui Melo' },
  { ts:'22 Jul 2026 08:55', trigger:'Demanda movida de status', result:'error',   detail:'Token expirado — autenticação falhou' },
  { ts:'21 Jul 2026 13:44', trigger:'Sprint iniciada',        result:'success', detail:'Checklist criado em 8 issues' },
  { ts:'19 Jul 2026 10:30', trigger:'Campo alterado',         result:'success', detail:'Alerta enviado para Ana Lima' },
]

function resultBadge(r: string) {
  if (r === 'success') return { label:'✅ Sucesso',  bg:T.successDim, color:T.success }
  if (r === 'partial') return { label:'⚠️ Parcial',  bg:T.warnDim,    color:T.warn }
  return                       { label:'❌ Erro',     bg:T.critDim,    color:T.crit }
}

export default function AutomationsPage() {
  const [autos, setAutos] = useState<AutoDef[]>(INITIAL_AUTOS)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(INITIAL_AUTOS[0].name)
  const [triggerType, setTriggerType] = useState(INITIAL_AUTOS[0].trigger)
  const [fromStatus, setFromStatus] = useState('A Fazer')
  const [toStatus, setToStatus] = useState('Concluído')
  const [conditionOn, setConditionOn] = useState(false)
  const [condField, setCondField] = useState('Prioridade')
  const [condOp, setCondOp] = useState('é')
  const [condVal, setCondVal] = useState('Crítica')
  const [actionType, setActionType] = useState(INITIAL_AUTOS[0].action)
  const [actionVal, setActionVal] = useState('')
  const [saved, setSaved] = useState(false)

  const sel = autos[selectedIdx]

  function selectAuto(idx: number) {
    const a = autos[idx]
    setSelectedIdx(idx)
    setNameVal(a.name)
    setTriggerType(a.trigger)
    setActionType(a.action)
    setConditionOn(false)
    setEditingName(false)
  }

  function toggleActive() {
    setAutos(prev => prev.map((a,i) => i === selectedIdx ? { ...a, active:!a.active } : a))
  }

  function handleSave() {
    setAutos(prev => prev.map((a,i) => i === selectedIdx ? { ...a, name:nameVal, trigger:triggerType, action:actionType } : a))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleDelete() {
    if (autos.length <= 1) return
    const next = autos.filter((_,i) => i !== selectedIdx)
    setAutos(next)
    setSelectedIdx(0)
    selectAuto(0)
  }

  function addNew() {
    const newA: AutoDef = {
      id: Date.now(),
      name: 'Nova automação',
      active: false,
      trigger: 'Demanda criada',
      action: 'Enviar notificação',
    }
    setAutos(prev => [...prev, newA])
    const idx = autos.length
    setTimeout(() => selectAuto(idx), 0)
    setSelectedIdx(autos.length)
    setNameVal(newA.name)
    setTriggerType(newA.trigger)
    setActionType(newA.action)
    setConditionOn(false)
  }

  const selectStyle: React.CSSProperties = {
    background: T.bgSurface2,
    border: `1px solid ${T.border2}`,
    borderRadius: 6,
    color: T.text1,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  }

  const inputStyle: React.CSSProperties = {
    background: T.bgSurface2,
    border: `1px solid ${T.border2}`,
    borderRadius: 6,
    color: T.text1,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  }

  return (
    <div style={{ display:'flex', height:'100%', background:T.bgPage, color:T.text1, fontFamily:'Inter,sans-serif', position:'relative' }}>

      {/* Sidebar */}
      <div data-tour="automations-list" style={{ width:280, minWidth:280, borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', background:T.bgSurface }}>
        <div style={{ padding:'20px 16px 12px', borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:T.text3, marginBottom:12 }}>Automações ativas</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {autos.map((a, i) => {
              const isSelected = i === selectedIdx
              return (
                <button
                  key={a.id}
                  onClick={() => selectAuto(i)}
                  style={{
                    display:'flex', alignItems:'flex-start', gap:10, width:'100%', textAlign:'left',
                    padding:'10px 12px', borderRadius:8, border:'none', cursor:'pointer',
                    background: isSelected ? T.accentDim : 'transparent',
                    outline: isSelected ? `1px solid ${T.accentBorder}` : 'none',
                    transition:'background 0.15s',
                  }}
                >
                  <span style={{
                    width:8, height:8, borderRadius:'50%', flexShrink:0, marginTop:4,
                    background: a.active ? T.success : T.text3,
                    boxShadow: a.active ? `0 0 6px ${T.success}` : 'none',
                  }} />
                  <span style={{ fontSize:13, color: isSelected ? T.accent : T.text2, lineHeight:1.4 }}>{a.name}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ padding:16, marginTop:'auto' }}>
          <button
            data-tour="automations-new"
            onClick={addNew}
            style={{
              width:'100%', padding:'9px 0', borderRadius:8, border:`1px dashed ${T.accentBorder}`,
              background:'transparent', color:T.accent, fontSize:13, fontWeight:500, cursor:'pointer',
            }}
          >
            + Nova automação
          </button>
        </div>
      </div>

      {/* Main panel */}
      <div style={{ flex:1, overflowY:'auto', padding:'28px 32px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28, flexWrap:'wrap' }}>
          {editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter') setEditingName(false) }}
              style={{ ...inputStyle, fontSize:18, fontWeight:600, flex:1, minWidth:200 }}
            />
          ) : (
            <h2
              onClick={() => setEditingName(true)}
              title="Clique para editar"
              style={{ fontSize:18, fontWeight:600, color:T.text1, cursor:'text', flex:1, margin:0,
                borderBottom:`1px dashed ${T.border2}`, paddingBottom:2 }}
            >
              {nameVal}
            </h2>
          )}

          {/* Active toggle */}
          <button
            onClick={toggleActive}
            style={{
              display:'flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:20,
              border:`1px solid ${sel.active ? T.accentBorder : T.border2}`,
              background: sel.active ? T.accentDim : T.bgSurface2,
              color: sel.active ? T.accent : T.text3,
              fontSize:12, fontWeight:600, cursor:'pointer',
            }}
          >
            <span style={{
              width:10, height:10, borderRadius:'50%',
              background: sel.active ? T.accent : T.text3,
            }} />
            {sel.active ? 'Ativa' : 'Inativa'}
          </button>

          <button style={{
            padding:'7px 14px', borderRadius:8, border:`1px solid ${T.border2}`,
            background:'transparent', color:T.text2, fontSize:12, cursor:'pointer',
          }}>
            ▷ Executar agora
          </button>

          <button
            onClick={handleSave}
            style={{
              padding:'7px 18px', borderRadius:8, border:'none',
              background:T.accent, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer',
            }}
          >
            Salvar
          </button>

          <button
            onClick={handleDelete}
            title="Excluir automação"
            style={{
              width:32, height:32, borderRadius:8, border:`1px solid ${T.border2}`,
              background:'transparent', color:T.crit, fontSize:16, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
          >
            🗑
          </button>
        </div>

        {/* Builder flow */}
        <div data-tour="automations-editor" style={{ display:'flex', flexDirection:'column', gap:0, marginBottom:36 }}>

          {/* TRIGGER card */}
          <div style={{
            background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:12,
            borderTop:`3px solid ${T.accent}`, padding:24,
            boxShadow: T.shadow2,
          }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:T.accent, marginBottom:16 }}>
              ⚡ Disparador
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Tipo de disparador</label>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={selectStyle}>
                {TRIGGER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {triggerType === 'Demanda movida de status' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>De status</label>
                  <select value={fromStatus} onChange={e => setFromStatus(e.target.value)} style={selectStyle}>
                    {WORKFLOW_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Para status</label>
                  <select value={toStatus} onChange={e => setToStatus(e.target.value)} style={selectStyle}>
                    {WORKFLOW_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
            {triggerType === 'Campo alterado' && (
              <div>
                <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Campo</label>
                <select style={selectStyle}>
                  <option>Prioridade</option><option>Responsável</option><option>Sprint</option><option>Label</option>
                </select>
              </div>
            )}
          </div>

          {/* Arrow */}
          <div style={{ display:'flex', justifyContent:'center', padding:'8px 0', color:T.text3, fontSize:20 }}>↓</div>

          {/* CONDITION card */}
          <div style={{
            background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:12,
            borderTop:`3px solid ${T.warn}`, padding:24,
            boxShadow: T.shadow2,
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:conditionOn ? 16 : 0 }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:T.warn }}>
                🔍 Condição (opcional)
              </div>
              <button
                onClick={() => setConditionOn(!conditionOn)}
                style={{
                  padding:'4px 12px', borderRadius:20, fontSize:12, cursor:'pointer', border:'none',
                  background: conditionOn ? T.warnDim : T.bgSurface2,
                  color: conditionOn ? T.warn : T.text3,
                }}
              >
                {conditionOn ? 'Remover' : 'Adicionar condição'}
              </button>
            </div>
            {conditionOn && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Campo</label>
                  <select value={condField} onChange={e => setCondField(e.target.value)} style={selectStyle}>
                    {CONDITION_FIELDS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Operador</label>
                  <select value={condOp} onChange={e => setCondOp(e.target.value)} style={selectStyle}>
                    {CONDITION_OPS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Valor</label>
                  <input value={condVal} onChange={e => setCondVal(e.target.value)} style={inputStyle} />
                </div>
              </div>
            )}
            {conditionOn && (
              <button style={{
                padding:'5px 12px', borderRadius:6, border:`1px dashed ${T.border2}`,
                background:'transparent', color:T.text3, fontSize:12, cursor:'pointer',
              }}>
                + Adicionar condição
              </button>
            )}
          </div>

          {/* Arrow */}
          <div style={{ display:'flex', justifyContent:'center', padding:'8px 0', color:T.text3, fontSize:20 }}>↓</div>

          {/* ACTION card */}
          <div style={{
            background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:12,
            borderTop:`3px solid ${T.success}`, padding:24,
            boxShadow: T.shadow2,
          }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:T.success, marginBottom:16 }}>
              ⚡ Ação
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Tipo de ação</label>
              <select value={actionType} onChange={e => setActionType(e.target.value)} style={selectStyle}>
                {ACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {actionType === 'Alterar status' && (
              <div>
                <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Novo status</label>
                <select style={selectStyle}>
                  {WORKFLOW_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
            {actionType === 'Atribuir responsável' && (
              <div>
                <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Responsável</label>
                <select style={selectStyle}>
                  <option>Ana Lima (AL)</option><option>Nuno Matos (NM)</option><option>João Neves (JN)</option>
                  <option>Carla Silva (CS)</option><option>Lucas Ferreira (LF)</option>
                </select>
              </div>
            )}
            {actionType === 'Enviar notificação' && (
              <div>
                <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Mensagem</label>
                <input
                  placeholder="Ex: Demanda {title} foi movida para {status}"
                  value={actionVal}
                  onChange={e => setActionVal(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}
            {actionType === 'Chamar webhook' && (
              <div>
                <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>URL do webhook</label>
                <input placeholder="https://hooks.example.com/..." value={actionVal} onChange={e => setActionVal(e.target.value)} style={inputStyle} />
              </div>
            )}
            {actionType === 'Criar subtarefa' && (
              <div>
                <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Nome da subtarefa</label>
                <input placeholder="Ex: Revisão QA" value={actionVal} onChange={e => setActionVal(e.target.value)} style={inputStyle} />
              </div>
            )}
            {actionType === 'Adicionar label' && (
              <div>
                <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Label</label>
                <select style={selectStyle}>
                  <option>Design</option><option>Eng</option><option>UX</option><option>QA</option>
                </select>
              </div>
            )}
            {actionType === 'Criar comentário' && (
              <div>
                <label style={{ fontSize:12, color:T.text3, marginBottom:6, display:'block' }}>Texto do comentário</label>
                <input placeholder="Ex: Revisão necessária por {assignee}" value={actionVal} onChange={e => setActionVal(e.target.value)} style={inputStyle} />
              </div>
            )}
          </div>
        </div>

        {/* Execution log */}
        <div style={{
          background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:12,
          padding:24, boxShadow:T.shadow2,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
            <span style={{ fontSize:15, fontWeight:600, color:T.text1 }}>Log de execuções</span>
            <span style={{
              background:T.accentDim, color:T.accent, borderRadius:20,
              padding:'2px 8px', fontSize:11, fontWeight:600,
            }}>{LOG_ROWS.length}</span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                {['Data/Hora','Disparador','Resultado','Detalhes'].map(h => (
                  <th key={h} style={{
                    textAlign:'left', padding:'6px 12px', color:T.text3,
                    fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                    borderBottom:`1px solid ${T.border}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LOG_ROWS.map((r, i) => {
                const badge = resultBadge(r.result)
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : T.bgSurface2 }}>
                    <td style={{ padding:'9px 12px', color:T.text3, whiteSpace:'nowrap' }}>{r.ts}</td>
                    <td style={{ padding:'9px 12px', color:T.text2 }}>{r.trigger}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{
                        background:badge.bg, color:badge.color,
                        borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:500,
                      }}>{badge.label}</span>
                    </td>
                    <td style={{ padding:'9px 12px', color:T.text3, fontSize:12 }}>{r.detail}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
            <button style={{
              background:'transparent', border:'none', color:T.accent,
              fontSize:13, cursor:'pointer', padding:0,
            }}>
              Ver histórico completo →
            </button>
          </div>
        </div>
      </div>

      {/* Save toast */}
      {saved && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:9999,
          background:T.bgSurface, border:`1px solid ${T.accentBorder}`,
          borderRadius:10, padding:'12px 20px',
          color:T.success, fontSize:13, fontWeight:500,
          boxShadow:T.shadowModal,
          display:'flex', alignItems:'center', gap:8,
        }}>
          ✅ Automação salva com sucesso.
        </div>
      )}
    </div>
  )
}
