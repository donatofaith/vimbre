import { useId, useState } from 'react'

const chain = [
  {kind:'Conversation', title:'Let’s send the revised proposal by Thursday.', detail:'Source: proposal meeting notes', related:[1,2]},
  {kind:'Action', title:'Revise proposal', detail:'Owner: Alex · Due: Thursday', related:[0,2,3]},
  {kind:'Decision', title:'Use the updated pricing model.', detail:'Source: proposal meeting notes', related:[0,1,3]},
  {kind:'Outcome', title:'Revised proposal completed and shared.', detail:'Linked to: Revise proposal', related:[1,2]},
]
export function ConnectedTimeline() {
  const [selected,setSelected]=useState(0)
  const id=useId()
  return <div className="rf-timeline-demo"><small className="rs-example">Example</small><div className="rf-chain">{chain.map((row,index)=><button type="button" className={`rf-chain-event${selected===index?' rf-selected':''}${chain[selected].related.includes(index)?' rf-related':''}`} key={row.kind} onClick={()=>setSelected(index)} aria-pressed={selected===index} aria-describedby={id}><span className="rf-event-number">0{index+1}</span><span className="rf-event-kind">{row.kind}</span><strong>{row.title}</strong></button>)}</div><p id={id} className="rf-source" aria-live="polite"><strong>{chain[selected].kind}:</strong> {chain[selected].detail}</p></div>
}

export function CapabilityDemos() {
  const [review,setReview]=useState(false)
  const [status,setStatus]=useState(0)
  const [linked,setLinked]=useState(false)
  const [handover,setHandover]=useState(false)
  const statuses=['Open','In progress','Completed']
  return <div className="rf-capabilities">
    <article className="rf-feature"><h3>Extract actions from conversations</h3><p>Paste an email or notes. Review the draft before saving.</p><div className="rf-feature-demo"><small className="rs-example">Example</small><blockquote>Let’s send the revised proposal by Thursday.</blockquote>{review?<div className="rf-edit-example"><label>Action<input defaultValue="Revise proposal" /></label><span>Owner: Alex · Due: Thursday</span><small>Source: proposal meeting notes</small></div>:<p className="rf-preview-placeholder">Conversation → Action draft</p>}<button type="button" className="rs-text-link" aria-expanded={review} onClick={()=>setReview(value=>!value)}>{review?'Close example':'Review example'}<span aria-hidden="true">→</span></button></div></article>
    <article className="rf-feature"><h3>Track actions and reminders</h3><p>Keep open work, dates and completed tasks in view.</p><div className="rf-feature-demo"><small className="rs-example">Example</small><strong>Revise proposal</strong><div className="rf-status-track">{statuses.map((label,index)=><span className={index===status?'rf-current-status':''} key={label}>{label}</span>)}</div><p aria-live="polite">{status===2?'Outcome: proposal completed and shared.':'Due Thursday · Reminder in Vimbre'}</p><button type="button" className="rs-text-link" onClick={()=>setStatus(value=>(value+1)%3)}>Next example status<span aria-hidden="true">→</span></button></div></article>
    <article className="rf-feature"><h3>Connect decisions to outcomes</h3><p>Keep the reason and next step alongside the work.</p><div className="rf-feature-demo"><small className="rs-example">Example</small><strong>Use the updated pricing model.</strong><p>Source: proposal meeting notes</p><button type="button" className="rs-text-link" aria-expanded={linked} onClick={()=>setLinked(value=>!value)}>{linked?'Hide related work':'Show related work'}<span aria-hidden="true">→</span></button>{linked&&<div className="rf-linked-result"><span>Action: Revise proposal</span><span>Outcome: Completed and shared</span></div>}</div></article>
    <article className="rf-feature"><h3>Generate handover information</h3><p>Prepare an editable draft from your own records or notes.</p><div className="rf-feature-demo"><small className="rs-example">Example</small><strong>Operations role record</strong><p>Recent decisions, open work and next steps.</p><button type="button" className="rs-text-link" aria-expanded={handover} onClick={()=>setHandover(value=>!value)}>{handover?'Close preview':'Preview handover'}<span aria-hidden="true">→</span></button>{handover&&<div className="rf-linked-result"><span>Decision: supplier reviews move to monthly</span><span>Next step: share the review notes</span></div>}</div></article>
  </div>
}

export function ContextHistory() {
  const [selected,setSelected]=useState(0)
  const moments=[['Week 1','Supplier review notes','Decision: move reviews to monthly.'],['Week 4','Share the review notes','Action linked to the supplier review decision.'],['Week 12','Review notes shared','Recorded outcome linked to the action.']]
  return <div className="rf-history"><small className="rs-example">Example</small><div className="rf-history-nodes">{moments.map(([week,title],index)=><button type="button" className={selected===index?'rf-history-node rf-selected':'rf-history-node'} key={week} aria-pressed={selected===index} onClick={()=>setSelected(index)}><span>{week}</span><strong>{title}</strong><i aria-hidden="true" /></button>)}</div><div className="rf-history-detail" aria-live="polite"><h3>{moments[selected][1]}</h3><p>{moments[selected][2]}</p><p>Why: reduce meeting load and focus on key updates.</p><small>Source: Operations meeting notes</small></div></div>
}

const reportRecords=[
  {date:'2026-10-12',type:'Recent decisions',text:'Move supplier reviews to monthly. Why: reduce meeting load.'},
  {date:'2026-10-16',type:'Completed work and recorded outcomes',text:'Review notes prepared and shared with Operations.'},
  {date:'2026-10-20',type:'Open actions and next steps',text:'Alex to share the next review notes.'},
  {date:'2026-10-27',type:'Upcoming deadlines',text:'Supplier review due 27 October.'},
]
export function HandoverExample() {
  const [start,setStart]=useState('2026-10-12'),[end,setEnd]=useState('2026-10-27')
  const valid=start&&end&&start<=end
  const records=valid?reportRecords.filter(row=>row.date>=start&&row.date<=end):[]
  return <div className="rf-handover"><div className="rf-report-controls"><small className="rs-example">Example</small><h3>Operations handover</h3><label>Example start date<input type="date" value={start} onChange={event=>setStart(event.target.value)} /></label><label>Example end date<input type="date" value={end} onChange={event=>setEnd(event.target.value)} /></label><p>Explore the example records for a selected period.</p></div><div className="rf-report" aria-live="polite" aria-label="Example handover report">{!valid?<p>Choose an end date on or after the start date.</p>:records.length?records.map(row=><section key={row.type}><h3>{row.type}</h3><p>{row.text}</p><small>Source: Operations role record</small></section>):<p>No example records in this period.</p>}</div></div>
}
