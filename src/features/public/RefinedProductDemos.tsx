import { useEffect, useRef, useState } from 'react'
import { ProductWalkthroughScreen } from './ProductWalkthroughScreen'

const scrollSteps = [
  { title: 'Bring it in', intro: 'Paste a conversation or choose a connected source.', screen: 'Source received', headline: 'Supplier review thread', body: '“Let’s move supplier reviews to monthly. We need fewer meetings, and Alex can share the notes next week.”', foot: 'Pasted conversation · 9 Nov 2026' },
  { title: 'Vimbre AI drafts', intro: 'Ask for a draft. Vimbre suggests actions and context from the source.', screen: 'AI draft', headline: 'Three suggestions found', foot: 'Draft only · Nothing saved yet' },
  { title: 'You check', intro: 'Check the wording, owner and date. Edit or dismiss anything that is wrong.', screen: 'Review before saving', headline: 'Check the details', foot: 'You decide what becomes a record' },
  { title: 'Handover', intro: 'Give the person covering the work a clear view of what comes first.', screen: 'Cover view', headline: 'What comes first', foot: 'Operations · 9 to 27 Nov 2026' },
]
export function ConnectedTimeline() {
 const storyRef=useRef<HTMLDivElement>(null)
 const [active,setActive]=useState(0)
 const [mobileActive,setMobileActive]=useState(0)
 useEffect(()=>{
  const root=storyRef.current;if(!root)return
  let frame=0
  const update=()=>{frame=0;if(window.matchMedia('(max-width:767px)').matches)return;const steps=[...root.querySelectorAll<HTMLElement>('[data-scroll-step]')];const line=innerHeight*.6;let index=0;for(let i=0;i<steps.length;i++)if(steps[i].getBoundingClientRect().top<=line)index=i;setActive(index)}
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)}
  update();window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true})
  return()=>{window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);cancelAnimationFrame(frame)}
 },[])
 return <div className="rf-scroll-story" ref={storyRef} data-active-step={active}>
  <div className="rf-mobile-walkthrough">
   <div className="rf-mobile-step-picker" role="group" aria-label="Choose a walkthrough step">{scrollSteps.map((step,index)=><button type="button" key={step.title} aria-pressed={mobileActive===index} onClick={()=>setMobileActive(index)}><span>{index+1}</span>{step.title}</button>)}</div>
   <div className="rf-mobile-step-copy" aria-live="polite"><h3>{scrollSteps[mobileActive].title}</h3><p>{scrollSteps[mobileActive].intro}</p></div>
   <div className="rf-mobile-product"><ProductWalkthroughScreen step={mobileActive}/></div>
   <noscript><ol>{scrollSteps.map(step=><li key={step.title}>{step.title}: {step.intro}</li>)}</ol></noscript>
  </div>
  <div className="rf-scroll-steps" aria-label="Four steps">{scrollSteps.map((step,index)=><article className={'rf-scroll-step'+(active===index?' rf-active':'')} data-scroll-step={index} key={step.title}><span className="rf-scroll-index">0{index+1} / 04</span><h3>{step.title}</h3><p>{step.intro}</p></article>)}</div>
  <div className="rf-scroll-screen" aria-label="Product walkthrough">
   <div className="rf-screen-topbar"><span className="rf-screen-brand">Vimbre</span><span className="rf-screen-location">{scrollSteps[active].title}</span></div>
   <small className="rs-example">Sample workspace</small>
   <div className="rf-live-screen" key={active}>
    <ProductWalkthroughScreen step={active}/>
   </div>
   <div className="rf-screen-progress" aria-hidden="true"><span style={{transform:`scaleX(${(active+1)/4})`}}/></div>
  </div>
 </div>
}

export function CapabilityDemos() {
  const [showReason, setShowReason] = useState(false)
  const [status, setStatus] = useState(0)
  const [handover, setHandover] = useState(false)
  const statuses = ['To do', 'In progress', 'Done']
  return <div className="rf-capabilities">
    <article className="rf-feature"><span className="rf-feature-index">01</span><h3>Keep the reason with the decision</h3><p>See what changed and why, then open the action connected to it.</p><div className="rf-feature-demo"><small className="rs-example">Example</small><strong>Move supplier reviews to monthly</strong><p>Decision · 9 Nov 2026</p><button type="button" className="rs-text-link" aria-expanded={showReason} onClick={() => setShowReason(value => !value)}>{showReason ? 'Hide reason' : 'Show reason'}<span aria-hidden="true">→</span></button>{showReason && <div className="rf-linked-result"><span>Why: reduce meeting load and focus on key updates.</span><span>Next step: share the notes by 12 Nov 2026.</span></div>}</div></article>
    <article className="rf-feature"><span className="rf-feature-index">02</span><h3>Keep open work and dates in view</h3><p>Track the next action and its outcome instead of reconstructing a thread later.</p><div className="rf-feature-demo"><small className="rs-example">Example</small><strong>Share the review notes</strong><div className="rf-status-track">{statuses.map((label, index) => <span className={index === status ? 'rf-current-status' : ''} key={label}>{label}</span>)}</div><p aria-live="polite"><strong>{statuses[status]}</strong> · Due 12 Nov 2026</p><button type="button" className="rs-text-link" onClick={() => setStatus(value => (value + 1) % 3)}>Change example status<span aria-hidden="true">→</span></button></div></article>
    <article className="rf-feature"><span className="rf-feature-index">03</span><h3>Prepare a cover guide</h3><p>Bring current role information, decisions and due work into a handover someone can use.</p><div className="rf-feature-demo"><small className="rs-example">Example</small><strong>Operations cover guide</strong><p>What comes first · Recent decisions · Upcoming work</p><button type="button" className="rs-text-link" aria-expanded={handover} onClick={() => setHandover(value => !value)}>{handover ? 'Hide cover details' : 'Show cover details'}<span aria-hidden="true">→</span></button>{handover && <div className="rf-linked-result"><span>First: share the review notes.</span><span>Then: prepare the monthly supplier review.</span></div>}</div></article>
  </div>
}

const reportRecords = [
  { date: '2026-11-09', type: 'Recent decision', text: 'Supplier reviews move to monthly to reduce meeting load.' },
  { date: '2026-11-12', type: 'Next action', text: 'Alex to share the review notes with Operations.' },
  { date: '2026-11-20', type: 'Work update', text: 'The monthly supplier review notes are ready to use.' },
  { date: '2026-11-27', type: 'Upcoming deadline', text: 'Prepare the next monthly supplier review.' },
]
const monthNumbers: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
function parseReadableDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/)
  if (!match) return null
  const day = Number(match[1])
  const month = monthNumbers[match[2].slice(0, 3).toLowerCase()]
  const year = Number(match[3])
  if (month === undefined || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month, day))
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month || date.getUTCFullYear() !== year) return null
  return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}
function readableDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}
export function HandoverExample() {
  const [startText, setStartText] = useState('9 Nov 2026')
  const [endText, setEndText] = useState('27 Nov 2026')
  const start = parseReadableDate(startText)
  const end = parseReadableDate(endText)
  const valid = Boolean(start && end && start <= end)
  const records = valid ? reportRecords.filter(row => row.date >= start! && row.date <= end!) : []
  return <div className="rf-handover">
    <div className="rf-report-controls"><small className="rs-example">Example</small><h3>Operations handover</h3><p>Use dates like 9 Nov 2026. This is illustrative content, not a customer's data.</p>
      <label>Start date<input type="text" autoComplete="off" spellCheck={false} inputMode="text" value={startText} onChange={event => setStartText(event.target.value)} aria-describedby="rf-date-help-start" /></label>
      <small id="rf-date-help-start" className="rf-date-help">Format: 9 Nov 2026</small>
      <label>End date<input type="text" autoComplete="off" spellCheck={false} inputMode="text" value={endText} onChange={event => setEndText(event.target.value)} aria-describedby="rf-date-help-end" /></label>
      <small id="rf-date-help-end" className="rf-date-help">Format: 27 Nov 2026</small>
      {(!start || !end) && <p className="rf-date-error" role="status">Enter dates like 9 Nov 2026.</p>}
      {start && end && start > end && <p className="rf-date-error" role="status">Choose an end date on or after the start date.</p>}
    </div>
    <div className="rf-report" aria-live="polite" aria-label="Example handover report"><small className="rs-example">Example</small><h3>What comes first</h3>{!valid ? <p>Enter a valid date range to preview the handover.</p> : records.length ? records.map(row => <section key={row.type}><div className="rf-report-heading"><h4>{row.type}</h4><time dateTime={row.date}>{readableDate(row.date)}</time></div><p>{row.text}</p><small>Operations role record</small></section>) : <p>No example records fall in this date range.</p>}</div>
  </div>
}
