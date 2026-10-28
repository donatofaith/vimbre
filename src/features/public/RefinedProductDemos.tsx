import { useEffect, useRef, useState } from 'react'

const scrollSteps = [
  { title: 'Bring it in', intro: 'Paste a conversation or choose a connected source.', screen: 'Source received', headline: 'Supplier review thread', body: '“Let’s move supplier reviews to monthly. We need fewer meetings, and Alex can share the notes next week.”', foot: 'Pasted conversation · 9 Nov 2026' },
  { title: 'Vimbre AI drafts', intro: 'Ask for a draft. Vimbre suggests actions and context from the source.', screen: 'AI draft', headline: 'Three suggestions found', foot: 'Draft only · Nothing saved yet' },
  { title: 'You check', intro: 'Check the wording, owner and date. Edit or dismiss anything that is wrong.', screen: 'Review before saving', headline: 'Check the details', foot: 'You decide what becomes a record' },
  { title: 'Handover', intro: 'Give the person covering the work a clear view of what comes first.', screen: 'Cover view', headline: 'What comes first', foot: 'Operations · 9 to 27 Nov 2026' },
]
export function ConnectedTimeline() {
  const storyRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const root = storyRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const visible = new Map<Element, number>()
    const observer = new IntersectionObserver(entries => {
      for(const entry of entries){if(entry.isIntersecting)visible.set(entry.target,entry.intersectionRatio);else visible.delete(entry.target)}
      const candidates=[...visible].sort((a,b)=>b[1]-a[1])
      if(candidates[0])setActive(Number((candidates[0][0] as HTMLElement).dataset.scrollStep??0))
    }, { rootMargin: '-28% 0px -35% 0px', threshold: [0.1, 0.25, 0.5, 0.75] })
    root.querySelectorAll<HTMLElement>('[data-scroll-step]').forEach(step => observer.observe(step))
    return () => observer.disconnect()
  }, [])
  const selected = scrollSteps[active]
  return <div className="rf-scroll-story" ref={storyRef}>
    <div className="rf-scroll-steps" aria-label="Four steps">
      {scrollSteps.map((step, index) => <article className={'rf-scroll-step' + (active === index ? ' rf-active' : '')} data-scroll-step={index} key={step.title} aria-describedby={'rf-scroll-copy-' + index}>
        <span className="rf-scroll-index">0{index + 1} / 04</span><h3>{step.title}</h3><p id={'rf-scroll-copy-' + index}>{step.intro}</p>
      </article>)}
    </div>
    <div className="rf-scroll-screen" aria-label={'Example product screen: ' + selected.screen} aria-live="polite">
      <div className="rf-screen-topbar"><span className="rf-screen-brand">Vimbre</span><span className="rf-screen-location">{selected.screen}</span></div>
      <small className="rs-example">Example</small>
      <div className="rf-screen-sheet" key={selected.screen}>
        <span className="rf-screen-kicker">{selected.screen}</span><h3>{selected.headline}</h3>
        {active === 0 && <blockquote className="rf-screen-source">{selected.body}</blockquote>}
        {active === 1 && <ul className="rf-screen-rows">
          <li><span className="rf-screen-check">✓</span><div><strong>Share the review notes</strong><small>Owner: Alex · Due: 12 Nov 2026</small></div></li>
          <li><span className="rf-screen-check">✓</span><div><strong>Move supplier reviews to monthly</strong><small>Decision suggestion · Check source</small></div></li>
          <li><span className="rf-screen-check">✓</span><div><strong>Reduce meeting load</strong><small>Reason suggestion · Check wording</small></div></li>
        </ul>}
        {active === 2 && <ul className="rf-screen-rows">
          <li><span className="rf-screen-unchecked">□</span><div><strong>Owner: Alex</strong><small>Matches the source</small></div></li>
          <li><span className="rf-screen-unchecked">□</span><div><strong>Due: 12 Nov 2026</strong><small>Review before confirming</small></div></li>
          <li><span className="rf-screen-unchecked">□</span><div><strong>Decision and reason</strong><small>Edit or discard if incorrect</small></div></li>
        </ul>}
        {active === 3 && <div className="rf-screen-handover">
          <p><strong>First:</strong> Share the review notes with Operations.</p><p><strong>Decision:</strong> Supplier reviews move to monthly.</p><p><strong>Why:</strong> Reduce meeting load and focus on key updates.</p><p><strong>Next date:</strong> 12 Nov 2026</p>
        </div>}
        <p className="rf-screen-foot">{selected.foot}</p>
      </div>
      <div className="rf-screen-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(active + 1) / 4})` }} /></div>
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
