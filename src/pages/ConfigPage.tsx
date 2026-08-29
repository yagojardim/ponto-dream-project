import React, { useState } from 'react'
import { useCatalog } from '../data/CatalogContext'
import { T } from '../components/ds/tokens'

type Tab = 'workflow' | 'issueTypes' | 'components' | 'labels' | 'priorities' | 'board'

const TABS: { id: Tab; label: string }[] = [
  { id:'workflow',    label:'Workflow' },
  { id:'issueTypes',  label:'Tipos de Demanda' },
  { id:'components',  label:'Componentes' },
  { id:'labels',      label:'Labels' },
  { id:'priorities',  label:'Prioridades' },
  { id:'board',       label:'Config do Board' },
]

const COLOR_PRESETS = ['#7d92ff','#35c9ae','#e6b23c','#f0805c','#a78bfa','#22d3ee','#fb923c','#f472b6']
const ICON_OPTIONS  = ['◇','⬟','☑','◻','⚡','▣','★','●']

function useToast() {
  const [show, setShow] = useState(false)
  function fire() { setShow(true); setTimeout(() => setShow(false), 2000) }
  return { show, fire }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function WorkflowTab() {
  const { catalog, updateWorkflow } = useCatalog()
  const toast = useToast()
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editName, setEditName] = useState('')

  const categories: { cat: 'todo'|'in-progress'|'done'; label: string; color: string }[] = [
    { cat:'todo',        label:'A Fazer',      color:T.text3 },
    { cat:'in-progress', label:'Em andamento', color:T.accent },
    { cat:'done',        label:'Concluído',    color:T.success },
  ]

  function startEdit(id: string, name: string) { setEditingId(id); setEditName(name) }

  function commitEdit() {
    if (!editingId) return
    updateWorkflow(prev => prev.map(s => s.id === editingId ? { ...s, name: editName } : s))
    setEditingId(null)
    toast.fire()
  }

  function deleteStatus(id: string) {
    updateWorkflow(prev => { if (prev.length <= 1) return prev; return prev.filter(s => s.id !== id) })
    toast.fire()
  }

  function addStatus(cat: 'todo'|'in-progress'|'done') {
    const newS = {
      id: 'w' + Date.now(),
      name: 'Novo status',
      color: cat === 'todo' ? T.text3 : cat === 'in-progress' ? T.accent : T.success,
      category: cat,
      order: 99,
    }
    updateWorkflow(prev => [...prev, newS])
    toast.fire()
  }

  const inputStyle: React.CSSProperties = {
    background:T.bgSurface2, border:`1px solid ${T.accentBorder}`, borderRadius:6,
    color:T.text1, padding:'4px 8px', fontSize:13, outline:'none', width:'100%',
  }

  return (
    <div data-tour="config-workflow">
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:600, color:T.text1, marginBottom:4 }}>Editor de Workflow</div>
        <div style={{ fontSize:13, color:T.text3 }}>Gerencie os status e categorias do seu fluxo de trabalho.</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
        {categories.map(({ cat, label, color }) => {
          const items = catalog.workflow.filter(s => s.category === cat).sort((a,b) => a.order - b.order)
          return (
            <div key={cat} style={{
              background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:12,
              padding:16,
            }}>
              <div style={{ fontSize:12, fontWeight:700, color, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                {label}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                {items.map(s => (
                  <div key={s.id} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
                    background:T.bgSurface2, borderRadius:8, border:`1px solid ${T.border}`,
                  }}>
                    <span style={{ color:T.text3, fontSize:14, cursor:'grab' }}>⠿</span>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                    {editingId === s.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
                        style={inputStyle}
                      />
                    ) : (
                      <span
                        onDoubleClick={() => startEdit(s.id, s.name)}
                        style={{ fontSize:13, color:T.text1, flex:1, cursor:'text' }}
                        title="Duplo clique para editar"
                      >{s.name}</span>
                    )}
                    <button
                      onClick={() => deleteStatus(s.id)}
                      style={{ background:'none', border:'none', color:T.text3, cursor:'pointer', fontSize:14, padding:0 }}
                    >×</button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addStatus(cat)}
                style={{
                  width:'100%', padding:'7px', borderRadius:8, border:`1px dashed ${T.border2}`,
                  background:'transparent', color:T.text3, fontSize:12, cursor:'pointer',
                }}
              >
                + Adicionar status
              </button>
            </div>
          )
        })}
      </div>
      <div style={{
        padding:'12px 16px', borderRadius:8, background:T.accentDim,
        border:`1px solid ${T.accentBorder}`, fontSize:13, color:T.accent,
      }}>
        ℹ️ Estas configurações refletem no Board e na seleção de status das issues.
      </div>
      {toast.show && <Toast />}
    </div>
  )
}

function IssueTypesTab() {
  const { catalog, updateIssueTypes } = useCatalog()
  const toast = useToast()
  const [editingId, setEditingId] = useState<string|null>(null)
  const [form, setForm] = useState({ name:'', icon:'◇', color:'#7d92ff' })

  function openEdit(id: string) {
    const t = catalog.issueTypes.find(x => x.id === id)!
    setEditingId(id); setForm({ name:t.name, icon:t.icon, color:t.color })
  }

  function commitEdit() {
    updateIssueTypes(prev => prev.map(t => t.id === editingId ? { ...t, ...form } : t))
    setEditingId(null); toast.fire()
  }

  function deleteType(id: string) {
    if (catalog.issueTypes.length <= 1) return
    updateIssueTypes(prev => prev.filter(t => t.id !== id)); toast.fire()
  }

  function addType() {
    updateIssueTypes(prev => [...prev, { id:'t'+Date.now(), name:'Novo tipo', icon:'★', color:'#7d92ff' }])
    toast.fire()
  }

  const inputStyle: React.CSSProperties = {
    background:T.bgSurface2, border:`1px solid ${T.border2}`, borderRadius:6,
    color:T.text1, padding:'5px 8px', fontSize:13, outline:'none', width:'100%',
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:600, color:T.text1, marginBottom:4 }}>Tipos de Demanda</div>
        <div style={{ fontSize:13, color:T.text3 }}>Defina os tipos disponíveis na criação de issues.</div>
      </div>

      {editingId && (
        <div style={{
          background:T.bgSurface2, border:`1px solid ${T.accentBorder}`, borderRadius:12,
          padding:20, marginBottom:20, display:'flex', flexDirection:'column', gap:14,
        }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.accent }}>Editando tipo</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:12, alignItems:'end' }}>
            <div>
              <label style={{ fontSize:11, color:T.text3, display:'block', marginBottom:4 }}>Nome</label>
              <input value={form.name} onChange={e => setForm({...form,name:e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize:11, color:T.text3, display:'block', marginBottom:4 }}>Ícone</label>
              <select
                value={form.icon}
                onChange={e => setForm({...form,icon:e.target.value})}
                style={{ ...inputStyle, width:'auto' }}
              >
                {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:T.text3, display:'block', marginBottom:4 }}>Cor</label>
              <div style={{ display:'flex', gap:6 }}>
                {COLOR_PRESETS.slice(0,5).map(c => (
                  <button
                    key={c}
                    onClick={() => setForm({...form,color:c})}
                    style={{
                      width:22, height:22, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
                      outline: form.color === c ? `2px solid ${T.text1}` : 'none', outlineOffset:2,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={commitEdit} style={{ padding:'6px 16px', borderRadius:8, border:'none', background:T.accent, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>Salvar</button>
            <button onClick={() => setEditingId(null)} style={{ padding:'6px 16px', borderRadius:8, border:`1px solid ${T.border2}`, background:'transparent', color:T.text2, fontSize:12, cursor:'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        {catalog.issueTypes.map(t => (
          <div key={t.id} style={{
            display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
            background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:10,
          }}>
            <span style={{ fontSize:20, color:t.color }}>{t.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:T.text1 }}>{t.name}</div>
              {t.isDefault && (
                <span style={{ fontSize:10, background:T.accentDim, color:T.accent, borderRadius:20, padding:'1px 6px' }}>Padrão</span>
              )}
            </div>
            <span style={{ width:10, height:10, borderRadius:'50%', background:t.color, flexShrink:0 }} />
            <button onClick={() => openEdit(t.id)} style={{ background:'none', border:`1px solid ${T.border2}`, borderRadius:6, color:T.text2, fontSize:12, padding:'4px 10px', cursor:'pointer' }}>Editar</button>
            <button
              onClick={() => deleteType(t.id)}
              disabled={catalog.issueTypes.length <= 1}
              style={{ background:'none', border:'none', color:catalog.issueTypes.length>1?T.crit:T.text3, fontSize:16, cursor:catalog.issueTypes.length>1?'pointer':'not-allowed', padding:0 }}
            >×</button>
          </div>
        ))}
      </div>
      <button onClick={addType} style={{ padding:'8px 18px', borderRadius:8, border:`1px dashed ${T.border2}`, background:'transparent', color:T.text3, fontSize:13, cursor:'pointer' }}>
        + Novo tipo
      </button>
      {toast.show && <Toast />}
    </div>
  )
}

function ComponentsTab() {
  const { catalog, updateComponents } = useCatalog()
  const toast = useToast()
  const [editingId, setEditingId] = useState<string|null>(null)
  const [form, setForm] = useState({ name:'', lead:'', desc:'' })

  function startEdit(id: string) {
    const c = catalog.components.find(x => x.id === id)!
    setEditingId(id); setForm({ name:c.name, lead:c.lead, desc:c.desc })
  }

  function commitEdit() {
    updateComponents(prev => prev.map(c => c.id === editingId ? { ...c, ...form } : c))
    setEditingId(null); toast.fire()
  }

  function deleteComp(id: string) {
    updateComponents(prev => prev.filter(c => c.id !== id)); toast.fire()
  }

  function addNew() {
    const newId = 'c'+Date.now()
    updateComponents(prev => [...prev, { id:newId, name:'Novo componente', lead:'', desc:'' }])
    setTimeout(() => { setEditingId(newId); setForm({ name:'Novo componente', lead:'', desc:'' }) }, 0)
  }

  const inputStyle: React.CSSProperties = {
    background:T.bgSurface2, border:`1px solid ${T.border2}`, borderRadius:6,
    color:T.text1, padding:'5px 8px', fontSize:13, outline:'none', width:'100%',
  }

  const thStyle: React.CSSProperties = {
    textAlign:'left', padding:'8px 12px', fontSize:11, color:T.text3,
    fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
    borderBottom:`1px solid ${T.border}`,
  }

  const tdStyle: React.CSSProperties = { padding:'10px 12px', fontSize:13 }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:600, color:T.text1, marginBottom:4 }}>Componentes</div>
        <div style={{ fontSize:13, color:T.text3 }}>Organize o projeto em componentes com líderes definidos.</div>
      </div>
      <div style={{ background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Componente</th>
              <th style={thStyle}>Lead</th>
              <th style={thStyle}>Descrição</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {catalog.components.map((c, i) => (
              <tr key={c.id} style={{ background: i%2===0?'transparent':T.bgSurface2, borderBottom:`1px solid ${T.border}` }}>
                {editingId === c.id ? (
                  <>
                    <td style={tdStyle}><input value={form.name} onChange={e => setForm({...form,name:e.target.value})} style={inputStyle} /></td>
                    <td style={tdStyle}><input value={form.lead} onChange={e => setForm({...form,lead:e.target.value})} style={{...inputStyle,width:60}} /></td>
                    <td style={tdStyle}><input value={form.desc} onChange={e => setForm({...form,desc:e.target.value})} style={inputStyle} /></td>
                    <td style={tdStyle}>
                      <button onClick={commitEdit} style={{ padding:'4px 10px', borderRadius:6, border:'none', background:T.accent, color:'#fff', fontSize:12, cursor:'pointer', marginRight:6 }}>OK</button>
                      <button onClick={() => setEditingId(null)} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.border2}`, background:'transparent', color:T.text2, fontSize:12, cursor:'pointer' }}>✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ ...tdStyle, color:T.text1, fontWeight:500 }}>{c.name}</td>
                    <td style={tdStyle}>
                      <span style={{ background:T.accentDim, color:T.accent, borderRadius:20, padding:'2px 8px', fontSize:12 }}>{c.lead}</span>
                    </td>
                    <td style={{ ...tdStyle, color:T.text3 }}>{c.desc}</td>
                    <td style={tdStyle}>
                      <button onClick={() => startEdit(c.id)} style={{ background:'none', border:`1px solid ${T.border2}`, borderRadius:6, color:T.text2, fontSize:12, padding:'3px 10px', cursor:'pointer', marginRight:6 }}>Editar</button>
                      <button onClick={() => deleteComp(c.id)} style={{ background:'none', border:'none', color:T.crit, fontSize:16, cursor:'pointer', padding:0 }}>×</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addNew} style={{ padding:'8px 18px', borderRadius:8, border:`1px dashed ${T.border2}`, background:'transparent', color:T.text3, fontSize:13, cursor:'pointer' }}>
        + Novo componente
      </button>
      {toast.show && <Toast />}
    </div>
  )
}

function LabelsTab() {
  const { catalog, updateLabels } = useCatalog()
  const toast = useToast()
  const [addingLabel, setAddingLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [colorPickerId, setColorPickerId] = useState<string|null>(null)

  function removeLabel(id: string) {
    updateLabels(prev => prev.filter(l => l.id !== id)); toast.fire()
  }

  function addLabel() {
    if (!newLabelName.trim()) return
    updateLabels(prev => [...prev, { id:'l'+Date.now(), name:newLabelName.trim(), color:T.accent }])
    setNewLabelName(''); setAddingLabel(false); toast.fire()
  }

  function changeColor(id: string, color: string) {
    updateLabels(prev => prev.map(l => l.id === id ? { ...l, color } : l))
    setColorPickerId(null); toast.fire()
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:600, color:T.text1, marginBottom:4 }}>Labels</div>
        <div style={{ fontSize:13, color:T.text3 }}>Labels são aplicadas às issues para categorização.</div>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:20, position:'relative' }}>
        {catalog.labels.map(l => (
          <div key={l.id} style={{ position:'relative' }}>
            <div style={{
              display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20,
              background: l.color + '22', border:`1px solid ${l.color}55`,
            }}>
              <button
                onClick={() => setColorPickerId(colorPickerId === l.id ? null : l.id)}
                style={{ width:12, height:12, borderRadius:'50%', background:l.color, border:'none', cursor:'pointer', flexShrink:0 }}
              />
              <span style={{ fontSize:13, color:T.text1 }}>{l.name}</span>
              <button
                onClick={() => removeLabel(l.id)}
                style={{ background:'none', border:'none', color:T.text3, cursor:'pointer', fontSize:14, padding:0, lineHeight:1 }}
              >×</button>
            </div>
            {colorPickerId === l.id && (
              <div style={{
                position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:100,
                background:T.bgSurface2, border:`1px solid ${T.border2}`, borderRadius:10,
                padding:10, display:'flex', gap:6, boxShadow:T.shadow2,
              }}>
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => changeColor(l.id, c)}
                    style={{ width:20, height:20, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
                      outline: l.color===c?`2px solid ${T.text1}`:'none', outlineOffset:2 }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {addingLabel ? (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <input
              autoFocus
              value={newLabelName}
              onChange={e => setNewLabelName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addLabel(); if (e.key === 'Escape') setAddingLabel(false) }}
              placeholder="Nome da label..."
              style={{
                background:T.bgSurface2, border:`1px solid ${T.accentBorder}`, borderRadius:20,
                color:T.text1, padding:'5px 12px', fontSize:13, outline:'none',
              }}
            />
            <button onClick={addLabel} style={{ padding:'5px 12px', borderRadius:20, border:'none', background:T.accent, color:'#fff', fontSize:12, cursor:'pointer' }}>OK</button>
            <button onClick={() => setAddingLabel(false)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${T.border2}`, background:'transparent', color:T.text2, fontSize:12, cursor:'pointer' }}>✕</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingLabel(true)}
            style={{ padding:'6px 14px', borderRadius:20, border:`1px dashed ${T.border2}`, background:'transparent', color:T.text3, fontSize:13, cursor:'pointer' }}
          >
            + Nova label
          </button>
        )}
      </div>
      <div style={{ fontSize:12, color:T.text3 }}>Clique na cor para alterá-la. × para remover.</div>
      {toast.show && <Toast />}
    </div>
  )
}

function PrioritiesTab() {
  const { catalog, updatePriorities } = useCatalog()
  const toast = useToast()
  const [addingNew, setAddingNew] = useState(false)
  const [newPrio, setNewPrio] = useState<{name:string;icon:string;color:string}>({ name:'', icon:'→', color:T.accent })

  const sorted = [...catalog.priorities].sort((a,b) => a.order - b.order)

  function move(id: string, dir: -1|1) {
    updatePriorities(prev => {
      const arr = [...prev].sort((a,b) => a.order-b.order)
      const idx = arr.findIndex(p => p.id === id)
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= arr.length) return prev
      const next = arr.map((p,i) => {
        if (i === idx) return { ...p, order: arr[swapIdx].order }
        if (i === swapIdx) return { ...p, order: arr[idx].order }
        return p
      })
      return next
    })
    toast.fire()
  }

  function addPriority() {
    if (!newPrio.name.trim()) return
    updatePriorities(prev => [...prev, { id:'p'+Date.now(), name:newPrio.name, icon:newPrio.icon, color:newPrio.color, order:prev.length }])
    setAddingNew(false); setNewPrio({ name:'', icon:'→', color:T.accent }); toast.fire()
  }

  const inputStyle: React.CSSProperties = {
    background:T.bgSurface2, border:`1px solid ${T.border2}`, borderRadius:6,
    color:T.text1, padding:'5px 8px', fontSize:13, outline:'none',
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:600, color:T.text1, marginBottom:4 }}>Prioridades</div>
        <div style={{ fontSize:13, color:T.text3 }}>Defina a ordem e aparência das prioridades das issues.</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
        {sorted.map((p, i) => (
          <div key={p.id} style={{
            display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
            background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:10,
          }}>
            <span style={{ color:T.text3, fontSize:16, cursor:'grab' }}>⠿</span>
            <span style={{ fontSize:16, color:p.color, width:24, textAlign:'center' }}>{p.icon}</span>
            <span style={{ fontSize:13, color:T.text1, flex:1, fontWeight:500 }}>{p.name}</span>
            <span style={{ width:14, height:14, borderRadius:'50%', background:p.color, flexShrink:0 }} />
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <button onClick={() => move(p.id,-1)} disabled={i===0} style={{ background:'none', border:'none', color:i===0?T.text3:T.text2, cursor:i===0?'not-allowed':'pointer', fontSize:12, padding:0, lineHeight:1 }}>↑</button>
              <button onClick={() => move(p.id,1)} disabled={i===sorted.length-1} style={{ background:'none', border:'none', color:i===sorted.length-1?T.text3:T.text2, cursor:i===sorted.length-1?'not-allowed':'pointer', fontSize:12, padding:0, lineHeight:1 }}>↓</button>
            </div>
          </div>
        ))}
      </div>
      {addingNew ? (
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
          background:T.bgSurface2, border:`1px solid ${T.accentBorder}`, borderRadius:10, marginBottom:12,
        }}>
          <input value={newPrio.name} onChange={e => setNewPrio({...newPrio,name:e.target.value})} placeholder="Nome" style={{...inputStyle,width:120}} />
          <select value={newPrio.icon} onChange={e => setNewPrio({...newPrio,icon:e.target.value})} style={{...inputStyle,width:'auto'}}>
            {['↑↑','↑','→','↓'].map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <div style={{ display:'flex', gap:6 }}>
            {COLOR_PRESETS.slice(0,5).map(c => (
              <button key={c} onClick={() => setNewPrio({...newPrio,color:c})}
                style={{ width:18, height:18, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline:newPrio.color===c?`2px solid ${T.text1}`:'none', outlineOffset:2 }} />
            ))}
          </div>
          <button onClick={addPriority} style={{ padding:'5px 12px', borderRadius:8, border:'none', background:T.accent, color:'#fff', fontSize:12, cursor:'pointer' }}>Adicionar</button>
          <button onClick={() => setAddingNew(false)} style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${T.border2}`, background:'transparent', color:T.text2, fontSize:12, cursor:'pointer' }}>Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setAddingNew(true)} style={{ padding:'8px 18px', borderRadius:8, border:`1px dashed ${T.border2}`, background:'transparent', color:T.text3, fontSize:13, cursor:'pointer' }}>
          + Adicionar prioridade
        </button>
      )}
      {toast.show && <Toast />}
    </div>
  )
}

function BoardConfigTab() {
  const { catalog, updateBoardCols } = useCatalog()
  const toast = useToast()
  const [editingCol, setEditingCol] = useState<string|null>(null)
  const [colForm, setColForm] = useState({ name:'', wipLimit:'' as string|number })
  const [showSwimlanes, setShowSwimlanes] = useState(false)
  const [showNoSprint, setShowNoSprint] = useState(true)
  const [compactMode, setCompactMode] = useState(false)

  function startEditCol(id: string) {
    const c = catalog.boardCols.find(x => x.id === id)!
    setEditingCol(id); setColForm({ name:c.name, wipLimit:c.wipLimit ?? '' })
  }

  function commitCol() {
    updateBoardCols(prev => prev.map(c => c.id === editingCol ? {
      ...c,
      name: String(colForm.name),
      wipLimit: colForm.wipLimit === '' ? null : Number(colForm.wipLimit),
    } : c))
    setEditingCol(null); toast.fire()
  }

  function addCol() {
    updateBoardCols(prev => [...prev, { id:'bc'+Date.now(), name:'Nova coluna', statusIds:[], wipLimit:null }])
    toast.fire()
  }

  function deleteCol(id: string) {
    updateBoardCols(prev => prev.filter(c => c.id !== id)); toast.fire()
  }

  function toggleStatus(colId: string, statusId: string) {
    updateBoardCols(prev => prev.map(c => {
      if (c.id !== colId) return c
      const has = c.statusIds.includes(statusId)
      return { ...c, statusIds: has ? c.statusIds.filter(s => s !== statusId) : [...c.statusIds, statusId] }
    }))
    toast.fire()
  }

  const inputStyle: React.CSSProperties = {
    background:T.bgSurface2, border:`1px solid ${T.border2}`, borderRadius:6,
    color:T.text1, padding:'5px 8px', fontSize:13, outline:'none',
  }

  function Toggle({ val, onChange, label }: { val:boolean; onChange:(v:boolean)=>void; label:string }) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:`1px solid ${T.border}` }}>
        <span style={{ fontSize:13, color:T.text2 }}>{label}</span>
        <button
          onClick={() => { onChange(!val); toast.fire() }}
          style={{
            width:40, height:22, borderRadius:11, border:'none', cursor:'pointer',
            background: val ? T.accent : T.border2,
            position:'relative', transition:'background 0.2s',
          }}
        >
          <span style={{
            position:'absolute', top:3, left: val ? 20 : 2, width:16, height:16,
            borderRadius:'50%', background:'#fff', transition:'left 0.2s',
          }} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:600, color:T.text1, marginBottom:4 }}>Configuração do Board</div>
      </div>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.text2, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.07em' }}>Colunas do Board</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
          {catalog.boardCols.map(col => (
            <div key={col.id} style={{
              background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:10,
              padding:'12px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
            }}>
              {editingCol === col.id ? (
                <>
                  <input value={String(colForm.name)} onChange={e => setColForm({...colForm,name:e.target.value})} style={{...inputStyle,width:140}} />
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, flex:1 }}>
                    {catalog.workflow.map(s => (
                      <button
                        key={s.id}
                        onClick={() => toggleStatus(col.id, s.id)}
                        style={{
                          padding:'3px 10px', borderRadius:20, fontSize:12, cursor:'pointer', border:'none',
                          background: col.statusIds.includes(s.id) ? s.color+'33' : T.bgSurface2,
                          color: col.statusIds.includes(s.id) ? s.color : T.text3,
                          outline: col.statusIds.includes(s.id) ? `1px solid ${s.color}66` : 'none',
                        }}
                      >{s.name}</button>
                    ))}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:12, color:T.text3 }}>WIP</span>
                    <input
                      type="number" placeholder="∞"
                      value={colForm.wipLimit}
                      onChange={e => setColForm({...colForm,wipLimit:e.target.value})}
                      style={{...inputStyle,width:60}}
                    />
                  </div>
                  <button onClick={commitCol} style={{ padding:'5px 12px', borderRadius:8, border:'none', background:T.accent, color:'#fff', fontSize:12, cursor:'pointer' }}>OK</button>
                  <button onClick={() => setEditingCol(null)} style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${T.border2}`, background:'transparent', color:T.text2, fontSize:12, cursor:'pointer' }}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize:13, fontWeight:500, color:T.text1, minWidth:100 }}>{col.name}</span>
                  <div style={{ display:'flex', gap:6, flex:1, flexWrap:'wrap' }}>
                    {col.statusIds.map(sid => {
                      const s = catalog.workflow.find(w => w.id === sid)
                      if (!s) return null
                      return <span key={sid} style={{ fontSize:11, background:s.color+'22', color:s.color, borderRadius:20, padding:'2px 8px' }}>{s.name}</span>
                    })}
                    {col.statusIds.length === 0 && <span style={{ fontSize:12, color:T.text3 }}>Nenhum status</span>}
                  </div>
                  <span style={{ fontSize:12, color:T.text3 }}>WIP: {col.wipLimit ?? '∞'}</span>
                  <button onClick={() => startEditCol(col.id)} style={{ background:'none', border:`1px solid ${T.border2}`, borderRadius:6, color:T.text2, fontSize:12, padding:'3px 10px', cursor:'pointer' }}>Editar</button>
                  <button onClick={() => deleteCol(col.id)} style={{ background:'none', border:'none', color:T.crit, fontSize:16, cursor:'pointer', padding:0 }}>×</button>
                </>
              )}
            </div>
          ))}
        </div>
        <button onClick={addCol} style={{ padding:'8px 18px', borderRadius:8, border:`1px dashed ${T.border2}`, background:'transparent', color:T.text3, fontSize:13, cursor:'pointer' }}>
          + Nova coluna
        </button>
      </div>
      <div style={{ background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:12, padding:'4px 20px' }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.text2, paddingTop:12, marginBottom:4 }}>Configurações gerais</div>
        <Toggle val={showSwimlanes} onChange={setShowSwimlanes} label="Mostrar swimlanes por épico" />
        <Toggle val={showNoSprint} onChange={setShowNoSprint} label="Mostrar issues sem sprint" />
        <Toggle val={compactMode} onChange={setCompactMode} label="Modo compacto" />
        <div style={{ height:8 }} />
      </div>
      {toast.show && <Toast />}
    </div>
  )
}


function Toast() {
  return (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:9999,
      background:'#1e222c', border:`1px solid rgba(53,201,174,0.4)`,
      borderRadius:10, padding:'12px 20px',
      color:T.success, fontSize:13, fontWeight:500,
      boxShadow:'0 32px 80px rgba(0,0,0,0.56)',
      display:'flex', alignItems:'center', gap:8,
    }}>
      ✓ Configuração salva e aplicada.
    </div>
  )
}

// ─── main export ─────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>('workflow')

  return (
    <div style={{
      display:'flex', height:'100%', background:T.bgPage,
      color:T.text1, fontFamily:'Inter,sans-serif',
    }}>
      {/* Tab sidebar */}
      <div data-tour="config-tabs" style={{
        width:200, minWidth:200, borderRight:`1px solid ${T.border}`,
        background:T.bgSurface, paddingTop:24, display:'flex', flexDirection:'column',
      }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:T.text3, padding:'0 16px', marginBottom:12 }}>
          Configurações
        </div>
        {TABS.map(tab => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display:'flex', alignItems:'center', gap:0, width:'100%', textAlign:'left',
                padding:'10px 16px', borderTop:'none', borderRight:'none', borderBottom:'none', cursor:'pointer',
                background:'transparent',
                color: isActive ? T.accent : T.text2,
                fontWeight: isActive ? 600 : 400,
                fontSize:13,
                borderLeft: isActive ? `3px solid ${T.accent}` : '3px solid transparent',
                transition:'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'32px 36px' }}>
        {activeTab === 'workflow'   && <WorkflowTab />}
        {activeTab === 'issueTypes' && <IssueTypesTab />}
        {activeTab === 'components' && <ComponentsTab />}
        {activeTab === 'labels'     && <LabelsTab />}
        {activeTab === 'priorities' && <PrioritiesTab />}
        {activeTab === 'board'      && <BoardConfigTab />}
      </div>
    </div>
  )
}
