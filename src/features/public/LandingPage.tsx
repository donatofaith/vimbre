import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { LandingHeader } from './LandingHeader'
import { ContactSection } from './ContactSection'
import { legalDocuments } from './legal-content'
import { definition, faq, plans, record, schema, storySummary } from './landing-content'
import './landing.css'

function Arrow() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg> }
function Icon({ kind = 'notes' }: { kind?: string }) {
  const paths: Record<string, string> = {
    notes: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4',
    email: 'M3 5h18v14H3zM3 5l9 8 9-8',
    calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
    people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M19 15a5 5 0 0 1 3 5',
    check: 'M5 12l4 4L19 6',
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[kind] ?? paths.notes} /></svg>
}
function Example() { return <small className="rs-example">Example</small> }
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={`rs-reveal ${className}`} data-reveal style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</div>
}
function RecordCard({ story = false }: { story?: boolean }) {
  return <div className={`rs-record ${story ? 'rs-story-record' : ''}`} data-story-record={story || undefined}>
    <div className="rs-record-bar"><span><Icon />Decision record</span><Example /></div>
    <dl>{record.map(([label, value]) => <div key={label} className={label === 'Why' ? 'rs-why-row' : ''} data-record-row data-story-row={story || undefined}>
      <dt>{label}</dt><dd>{value}</dd>
    </div>)}</dl>
  </div>
}
function StreamMotif({ className = '' }: { className?: string }) {
  // The supplied mark, never reconstructed or recoloured.
  return <img className={`rs-stream-motif ${className}`} src="/vimbre-mark-colour.svg" width="512" height="512" alt="" aria-hidden="true" />
}
function HeroStory({ rootRef, paused, ready, toggle }: { rootRef: RefObject<HTMLDivElement | null>; paused: boolean; ready: boolean; toggle: () => void }) {
  return <div className="rs-hero-visual">
    <div ref={rootRef} className="rs-story-shell">
      <div className="rs-story-stage" aria-hidden="true">
        <div className="rs-story-sources">{['Meeting notes', 'Supplier email', 'Daily notes'].map((label, i) => <div className={`rs-story-source ${i === 2 ? 'rs-daily-source' : ''}`} key={label} data-story-source>
          <Example /><span className="rs-source-title"><Icon kind={i === 1 ? 'email' : 'notes'} />{label}</span>
          <span className="rs-skeleton-lines"><i /><i /></span>
          <small className="rs-story-chip" data-story-chip>{['Decision', 'Owner', 'Next step'][i]}</small>
        </div>)}</div>
        <svg className="rs-story-paths" viewBox="0 0 640 480" fill="none">
          {[80, 170, 260].map((y, i) => <g key={y}><path d={`M130 ${y} C210 ${y}, 160 190, 250 190`} /><circle data-story-dot data-dot-index={i} cx="130" cy={y} r="3" /></g>)}
        </svg>
        <RecordCard story />
        <div className="rs-story-ring" data-story-ring />
        <div className="rs-story-person rs-story-sam" data-story-sam><span className="rs-avatar">S</span><span>Sam<small>Away this week</small></span><Example /></div>
        <div className="rs-story-person rs-story-alex" data-story-alex><span className="rs-avatar rs-avatar-blue">A</span><span>Alex, covering</span><Example /><div className="rs-alex-panel"><span>Open work</span><i /><span>Recent decisions</span><i /></div></div>
        <div className="rs-story-cover-line" data-story-line />
        <p className="rs-story-resolution" data-story-resolution>Nothing lost.</p>
      </div>
      <p className="sr-only">{storySummary}</p>
      <button className="rs-story-control" type="button" disabled={!ready} aria-label={paused ? 'Play hero story' : 'Pause hero story'} onClick={toggle}><span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>{paused ? 'Play' : 'Pause'}</button>
    </div>
  </div>
}
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return <div className="rs-faq-list">{faq.map(([question, answer], i) => <div className={`rs-faq-item${open === i ? ' rs-faq-open' : ''}`} key={question}>
    <h3><button type="button" id={`faq-button-${i}`} aria-expanded={open === i} aria-controls={`faq-panel-${i}`} onClick={() => setOpen(open === i ? null : i)}>{question}<span aria-hidden="true">+</span></button></h3>
    <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-button-${i}`} className="rs-faq-panel" inert={open !== i}><div><p>{answer}</p></div></div>
  </div>)}</div>
}
export function LandingPage({ authenticated = false, loading = false }: { authenticated?: boolean; loading?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const motion = useRef<{ dispose: () => void; toggle: () => void } | null>(null)
  const [story, setStory] = useState({ paused: false, ready: false })
  useEffect(() => {
    let disposed = false
    let frame = 0
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const start = () => {
      motion.current?.dispose()
      motion.current = null
      setStory({ paused: false, ready: false })
      if (media.matches) return
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
        void import('./landing-motion').then(({ createLandingMotion }) => {
          if (disposed || media.matches || !root.current || !stage.current) return
          motion.current = createLandingMotion(root.current, stage.current, setStory)
        }).catch(() => { /* Complete static frames remain usable if enhancement fails. */ })
      }) })
    }
    start()
    media.addEventListener('change', start)
    return () => { disposed = true; cancelAnimationFrame(frame); media.removeEventListener('change', start); motion.current?.dispose(); motion.current = null }
  }, [])
  const to = authenticated ? '/app' : '/signup'
  const cta = authenticated ? 'Open workspace' : 'Get started'
  return <div className="rs-site" data-theme="light" ref={root}>
    <a className="skip-link" href="#rs-main">Skip to content</a>
    <LandingHeader authenticated={authenticated} loading={loading} />
    <main id="rs-main">
      <section className="rs-hero" aria-labelledby="hero-title">
        <StreamMotif className="rs-hero-motif" />
        <div className="rs-container rs-hero-grid">
          <div className="rs-hero-copy">
            <span className="rs-eyebrow">Decision records for teams</span>
            <h1 id="hero-title" tabIndex={-1}>Know what your team decided, <span>when and why.</span></h1>
            <p className="rs-hero-subhead">Ready for whoever covers, joins or takes over.</p>
            <p className="rs-definition">{definition}</p>
            <div className="rs-actions"><Link className="rs-button" to={to}>{cta}<Arrow /></Link><a className="rs-text-link" href="#how-it-works">See how it works<Arrow /></a></div>
          </div>
          <HeroStory rootRef={stage} paused={story.paused} ready={story.ready} toggle={() => motion.current?.toggle()} />
        </div>
      </section>
      <section id="features" className="rs-section rs-problem" aria-labelledby="problem-title">
        <div className="rs-container"><Reveal className="rs-section-heading"><h2 id="problem-title">Decisions get made. Then they disappear.</h2><p>They sit in emails, meeting notes and one person's head. When that person is away, nobody can find them.</p></Reveal>
          <div className="rs-problem-visual" data-problem><div className="rs-problem-sources">{['Email', 'Meeting notes', 'Daily notes', 'Documents'].map((label, i) => <div className="rs-source" key={label} data-problem-source><Example /><Icon kind={i === 0 ? 'email' : 'notes'} /><strong>{label}</strong><span className="rs-skeleton-lines"><i /><i /></span></div>)}</div>
            <div className="rs-problem-record" data-problem-record><div className="rs-record"><div className="rs-record-bar"><span><Icon />Decision record</span><Example /></div><dl>{record.filter(([label]) => label !== 'Date').map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></div>
          </div>
        </div>
      </section>
      <section className="rs-section rs-dark-section" aria-labelledby="why-title">
        <div className="rs-container rs-two-col"><Reveal className="rs-section-heading"><h2 id="why-title">Keep the why with the what.</h2><p>A task list tells you what to do. Vimbre also keeps the reason behind each decision, who owns it and what happens next.</p></Reveal><Reveal className="rs-why-visual"><RecordCard /></Reveal></div>
      </section>
      <section id="how-it-works" className="rs-section" aria-labelledby="how-title"><div className="rs-container"><Reveal><h2 id="how-title">How it works.</h2></Reveal><div className="rs-steps">{[
        ['01', 'Add a decision.', 'From an email, a meeting or your own notes.'],
        ['02', 'Keep the reason.', 'Vimbre holds the why, the date, the owner and the next step together.'],
        ['03', 'Pass it on.', 'Whoever steps in opens one record and knows where to start.'],
      ].map(([n, title, text], i) => <Reveal key={n} delay={i * 120}><span className="rs-step-number">{n}<i /></span><h3>{title}</h3><p>{text}</p></Reveal>)}</div></div></section>
      <section className="rs-section rs-tinted" aria-labelledby="cover-title"><div className="rs-container"><Reveal className="rs-section-heading"><h2 id="cover-title">When someone steps in, they start with the facts.</h2><p>Cover for leave, a new joiner or a full handover, all from the same record.</p></Reveal>
        <div className="rs-cover-layout"><Reveal className="rs-away-person"><Example /><Icon kind="calendar" /><span>Sam, away this week</span></Reveal><div className="rs-cover-view"><Example /><div className="rs-cover-grid">{[
          ['Open work', 'Share the review notes'],
          ['Recent decisions', 'Move supplier reviews to monthly'],
          ['People to know', 'Alex, Operations'],
          ['Coming deadlines', 'Supplier review, 12 October'],
        ].map(([title, value], i) => <Reveal className="rs-cover-card" key={title} delay={i * 80}><h3>{title}</h3><p>{value}</p></Reveal>)}</div></div></div>
      </div></section>
      <section className="rs-section" aria-labelledby="day-title"><div className="rs-container rs-two-col"><Reveal><h2 id="day-title">See what needs you today.</h2></Reveal><Reveal className="rs-day-panel"><div className="rs-record-bar"><strong>My day</strong><Example /></div>{['3 decisions to review', '2 follow ups due', '1 handover to review'].map((row, i) => <div className="rs-day-row" data-day-row style={{ '--reveal-delay': `${i * 60}ms` } as CSSProperties} key={row}><Icon kind={i === 1 ? 'calendar' : 'notes'} /><span>{row}</span><Arrow /></div>)}</Reveal></div></section>
      <section className="rs-section rs-tinted" aria-labelledby="tools-title"><div className="rs-container rs-two-col"><Reveal className="rs-section-heading"><h2 id="tools-title">Works next to the tools you already use.</h2><p>Nothing to replace. Your team keeps working where it works now.</p></Reveal><Reveal className="rs-tools-visual"><Example /><div className="rs-tools-flow"><div className="rs-tool-input"><Icon /><span>Notes</span></div><svg className="rs-tools-lines" viewBox="0 0 240 130" aria-hidden="true">{[30,65,100].map(y => <path key={y} pathLength="1" d={`M0 ${y}C100 ${y} 130 65 240 65`} />)}</svg><span className="rs-tools-mark"><BrandLogo variant="symbol" decorative /></span></div></Reveal></div></section>
      <section id="pricing" className="rs-section rs-pricing-section" aria-labelledby="pricing-title"><div className="rs-container"><Reveal><h2 id="pricing-title">Start small. Add people when you need to.</h2></Reveal><div className="rs-pricing">{plans.map((plan, i) => <Reveal key={plan.name} className={`rs-plan ${i === 1 ? 'rs-plan-featured' : ''}`} delay={i * 60}>
        <h3>{plan.name}</h3><div className="rs-plan-price">{plan.price}{i < 3 && <span>a month</span>}</div><p>{plan.size}</p><ul>{plan.items.map(item => <li key={item}><Icon kind="check" />{item}</li>)}</ul>{i === 3 ? <a className="rs-button rs-button-outline" href="mailto:hello@vimbre.com?subject=Vimbre%20Enterprise">{cta}<Arrow /></a> : <Link className={`rs-button ${i !== 1 ? 'rs-button-outline' : ''}`} to={to}>{cta}<Arrow /></Link>}
      </Reveal>)}</div></div></section>
      <section id="questions" className="rs-section" aria-labelledby="faq-title"><div className="rs-container rs-faq"><Reveal><h2 id="faq-title">A few things to know.</h2></Reveal><FAQ /></div></section>
      <section className="rs-section rs-final" aria-labelledby="final-title" data-final-section><StreamMotif /><div className="rs-container"><Reveal><h2 id="final-title">Start with your next email or meeting.</h2><p>Add one decision. See what it feels like when the next person can find it.</p><Link className="rs-button rs-button-white" to={to}>{cta}<Arrow /></Link></Reveal></div></section>
      <ContactSection />
    </main>
    <footer className="rs-footer"><div className="rs-container"><div className="rs-footer-top"><Link className="rs-footer-brand" to="/" aria-label="Vimbre home"><BrandLogo /></Link><nav aria-label="Footer">{[['Product', '#features'], ['How it works', '#how-it-works'], ['Pricing', '#pricing'], ['Contact', '#contact']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}{Object.entries(legalDocuments).filter(([, document]) => document !== null).map(([slug]) => <Link key={slug} to={`/${slug}`}>{slug === 'privacy' ? 'Privacy' : 'Terms'}</Link>)}</nav></div><p>© 2026 Genade Global Services Ltd, Glasgow, United Kingdom.</p></div></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
  </div>
}
