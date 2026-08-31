import { useState } from 'react'
import { T } from './ds/tokens'

export interface SubtaskMember { id: string; name: string }

type SubPriority = 'critical' | 'high' | 'medium' | 'low'

const PRIORITY_OPTS: { k: SubPriority; label: string; color: string }[] = [
  { k:'critical', label:'Crítica', color:T.crit   },
  { k:'high',     label:'Alta',    color:T.warn   },
  { k:'medium',   label:'Média',   color:T.accent },
  { k:'low',      label:'Baixa',   color:T.text3  },
]

interface Props {
  parentKey:   string
  parentTitle: string
  /** Perfis reais do tenant. */
  members?:    SubtaskMember[]
  onClose:     () => void
  onCreate:    (sub: { title:string; description:string; priority:SubPriority; assigneeId:string|null; storyPoints:number; type:'subtask'|'bug' }) => void
}

export function AddSubtaskModal({ parentKey, parentTitle, members = [], onClose, onCreate }: Props) {
  const [childType,   setChildType]   = useState<'subtask'|'bug'>('subtask')
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [reproSteps,  setReproSteps]  = useState('')
  const [environment, setEnvironment] = useState('')
  const [priority,    setPriority]    = useState<SubPriority>('medium')
  const [assignee,    setAssignee]    = useState('')
  const [estimate,    setEstimate]    = useState(1)

  const inputStyle: React.CSSProperties = {
    width:'100%', background:T.bgSurface2, border:`1px solid ${T.border}`,
    borderRadius:8, padding:'8px 12px', color:T.text1, fontSize:13, outline:'none', boxSizing:'border-box',
  }

  function handleCreate() {
    if (!title.trim()) return
    let desc = description.trim()
    if (childType === 'bug') {
      const extra: string[] = []
      if (reproSteps.trim())  extra.push(`Passos para reproduzir:\n${reproSteps.trim()}`)
      if (environment.trim()) extra.push(`Ambiente: ${environment.trim()}`)
      if (extra.length) desc = [desc, extra.join('\n\n')].filter(Boolean).join('\n\n')
    }
    onCreate({ title: title.trim(), description: desc, priority, assigneeId: assignee || null, storyPoints: estimate, type: childType })
    onClose()
  }


  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }}>
      <div style={{ background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:16,padding:28,boxShadow:T.shadowModal,width:440 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
          <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:T.text1 }}>Adicionar item filho</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',color:T.text3,fontSize:20,cursor:'pointer',lineHeight:1 }}>×</button>
        </div>

        {/* Parent context */}
        <div style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:T.bgSurface2,borderRadius:8,marginBottom:20 }}>
          <span style={{ fontSize:11,color:T.text3 }}>Filho de:</span>
          <span style={{ fontSize:11,fontWeight:700,color:T.accent,background:T.accentDim,padding:'2px 7px',borderRadius:4 }}>{parentKey}</span>
          <span style={{ fontSize:12,color:T.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{parentTitle}</span>
        </div>

        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div>
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Tipo</label>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6 }}>
              {([['subtask','Subtarefa'],['bug','Bug']] as const).map(([k,lbl]) => (
                <button key={k} type="button" onClick={()=>setChildType(k)}
                  style={{ padding:'7px 4px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,
                    background: childType===k ? `${T.accent}18` : 'transparent',
                    border:`1px solid ${childType===k ? T.accent : T.border}`,
                    color: childType===k ? T.accent : T.text3 }}>{lbl}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Resumo *</label>
            <input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título da subtarefa"
              onKeyDown={e=>e.key==='Enter'&&handleCreate()} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Descrição</label>
            <textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}
              placeholder="Detalhe o que precisa ser feito (opcional)"
              style={{ ...inputStyle, resize:'vertical', fontFamily:'inherit' }} />
          </div>

          <div>
            <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Prioridade</label>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6 }}>
              {PRIORITY_OPTS.map(p => (
                <button key={p.k} type="button" onClick={()=>setPriority(p.k)}
                  style={{ padding:'6px 4px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600,
                    background: priority===p.k ? `${p.color}18` : 'transparent',
                    border: `1px solid ${priority===p.k ? p.color : T.border}`,
                    color: priority===p.k ? p.color : T.text3 }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>



          {childType === 'bug' && (
            <>
              <div>
                <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Passos para reproduzir</label>
                <textarea rows={3} value={reproSteps} onChange={e=>setReproSteps(e.target.value)}
                  placeholder={'1. …\n2. …\n3. …'}
                  style={{ ...inputStyle, resize:'vertical', fontFamily:'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Ambiente</label>
                <input value={environment} onChange={e=>setEnvironment(e.target.value)}
                  placeholder="Ex.: Produção, Staging, Chrome 128…" style={inputStyle} />
              </div>
            </>
          )}

          <div style={{ display:'grid',gridTemplateColumns:'1fr 120px',gap:12 }}>
            <div>
              <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Responsável</label>
              <select value={assignee} onChange={e=>setAssignee(e.target.value)} style={inputStyle}>
                <option value="">Sem responsável</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11,fontWeight:600,color:T.text3,marginBottom:5,display:'block',textTransform:'uppercase',letterSpacing:'.04em' }}>Estimativa (pts)</label>
              <input type="number" min={0} max={99} value={estimate} onChange={e=>setEstimate(Number(e.target.value))} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:`1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ padding:'8px 18px',borderRadius:8,background:'transparent',color:T.text2,border:`1px solid ${T.border}`,fontSize:13,cursor:'pointer' }}>Cancelar</button>
          <button onClick={handleCreate} disabled={!title.trim()} style={{ padding:'8px 20px',borderRadius:8,background:title.trim()?T.accent:T.border,color:title.trim()?'#fff':T.text3,border:'none',fontSize:13,fontWeight:600,cursor:title.trim()?'pointer':'not-allowed',opacity:title.trim()?1:.55 }}>
            {childType === 'bug' ? 'Criar bug' : 'Criar subtarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}
