import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { LandingHeader } from './LandingHeader'
import { ContactSection } from './ContactSection'
import { legalDocuments } from './legal-content'
import { faq, plans, record, schema } from './landing-content'
import { HeroStory } from './HeroStory'
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
function RecordCard() {
  return <div className="rs-record">
    <div className="rs-record-bar"><span><Icon />Decision record</span><Example /></div>
    <dl>{record.map(([label, value]) => <div key={label} className={label === 'Why' ? 'rs-why-row' : ''} data-record-row>
      <dt>{label}</dt><dd>{value}</dd>
    </div>)}</dl>
  </div>
}
function StreamMotif({ className = '' }: { className?: string }) {
  // The supplied mark, never reconstructed or recoloured.
  return <img className={`rs-stream-motif ${className}`} src="/vimbre-mark-colour.svg" width="512" height="512" alt="" aria-hidden="true" />
}
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return <div className="rs-faq-list">{faq.map(([question, answer], i) => <div className={`rs-faq-item${open === i ? ' rs-faq-open' : ''}`} key={question}>
    <h3><button type="button" id={`faq-button-${i}`} aria-expanded={open === i} aria-controls={`faq-panel-${i}`} onClick={() => setOpen(open === i ? null : i)}>{question}<span aria-hidden="true">+</span></button></h3>
    <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-button-${i}`} className="rs-faq-panel" inert={open !== i}><div><p>{answer}</p></div></div>
  </div>)}</div>
}
function RoleRecordGrowth() {
  const moments = [
    ['Week 1', ['Supplier review notes']],
    ['Week 4', ['Supplier review notes', 'Move supplier reviews to monthly', 'Alex, Operations']],
    ['Week 12', ['Supplier review notes', 'Move supplier reviews to monthly', 'Alex, Operations', 'Share the review notes', 'Supplier review, 27 October']],
  ] as const
  return <Reveal className="rs-role-growth"><div className="rs-growth-bar"><strong>Operations role record</strong><Example /></div><div className="rs-growth-moments">{moments.map(([week, items], i) => <div className="rs-growth-moment" key={week}><h3>{week}</h3><ul>{items.map((item, j) => <li data-growth-item style={{ '--reveal-delay': `${i * 120 + j * 80}ms` } as CSSProperties} key={item}><Icon kind="check" />{item}</li>)}</ul></div>)}</div></Reveal>
}
export function LandingPage({ authenticated = false, loading = false }: { authenticated?: boolean; loading?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const motion = useRef<{ dispose: () => void; toggle: () => void } | null>(null)
  const [story, setStory] = useState({ paused: false, ready: false })
  useEffect(() => {
    let disposed = false
    let frame = 0
    let generation = 0
    let resizeTimer = 0
    let lastWidth = window.innerWidth
    const compact = window.matchMedia('(max-width: 767px)')
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const start = () => {
      const currentGeneration = ++generation
      cancelAnimationFrame(frame)
      motion.current?.dispose()
      motion.current = null
      setStory({ paused: false, ready: false })
      if (media.matches) return
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
        void import('./landing-motion').then(async ({ createLandingMotion }) => {
          await document.fonts.ready
          if (disposed || currentGeneration !== generation || media.matches || !root.current || !stage.current) return
          motion.current = createLandingMotion(root.current, stage.current, setStory)
        }).catch(() => { /* Complete static frames remain usable if enhancement fails. */ })
      }) })
    }
    const resized = () => {
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(start, 150)
    }
    start()
    window.addEventListener('resize', resized, {passive:true})
    media.addEventListener('change', start)
    compact.addEventListener('change', start)
    return () => { disposed = true; window.removeEventListener('resize', resized); window.clearTimeout(resizeTimer); cancelAnimationFrame(frame); media.removeEventListener('change', start); compact.removeEventListener('change', start); motion.current?.dispose(); motion.current = null }
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
            <h1 id="hero-title" tabIndex={-1}>Someone leaving or away? The next person <span>already knows where to start.</span></h1>
            <p className="rs-hero-subhead">Capture decisions, finish tasks, and keep the context. Vimbre builds the handover as your team works.</p>
            <div className="rs-actions"><Link className="rs-button" to={to}>{cta}<Arrow /></Link><a className="rs-text-link" href="#how-it-works">See how it works<Arrow /></a></div>
          </div>
          <HeroStory rootRef={stage} paused={story.paused} ready={story.ready} toggle={() => motion.current?.toggle()} />
        </div>
      </section>
      <section id="features" className="rs-section rs-problem" aria-labelledby="problem-title">
        <div className="rs-container"><Reveal className="rs-section-heading"><h2 id="problem-title">Decisions get made. Then they disappear.</h2><p>They sit in emails, notes and one person's head. When that person leaves or is away, nobody can find them.</p></Reveal>
          <div className="rs-problem-visual" data-problem><div className="rs-problem-sources">{['Email', 'Meeting notes', 'Daily notes', 'Documents'].map((label, i) => <div className="rs-source" key={label} data-problem-source><Example /><Icon kind={i === 0 ? 'email' : 'notes'} /><strong>{label}</strong><span className="rs-skeleton-lines"><i /><i /></span></div>)}</div>
            <div className="rs-problem-record" data-problem-record><div className="rs-record"><div className="rs-record-bar"><span><Icon />Decision record</span><Example /></div><dl>{record.filter(([label]) => label !== 'Date').map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></div>
          </div>
        </div>
      </section>
      <section className="rs-section rs-dark-section" aria-labelledby="why-title">
        <div className="rs-container rs-two-col"><Reveal className="rs-section-heading"><h2 id="why-title">Keep the why with the what.</h2><p>Every decision stays with its reason, date, owner and next step.</p></Reveal><Reveal className="rs-why-visual"><RecordCard /></Reveal></div>
      </section>
      <section id="how-it-works" className="rs-section" aria-labelledby="how-title"><div className="rs-container"><Reveal><h2 id="how-title">A little each day adds up.</h2><p className="rs-section-line">Use Vimbre as you work, and the handover is already done when you need it.</p></Reveal><div className="rs-steps">{[
        ['01', 'Capture it.', 'Paste an email or notes, or type a task.'],
        ['02', 'Do your day.', 'Tasks and reminders keep you on track.'],
        ['03', 'Add to context.', 'One click keeps what you did and decided.'],
      ].map(([n, title, text], i) => <Reveal key={n} delay={i * 120}><span className="rs-step-number">{n}<i /></span><h3>{title}</h3><p>{text}</p></Reveal>)}</div><RoleRecordGrowth /></div></section>
      <section className="rs-section rs-tinted" aria-labelledby="cover-title"><div className="rs-container"><Reveal className="rs-section-heading"><h2 id="cover-title">When someone steps in, they start with the facts.</h2><p>Open work, recent decisions, people to know and coming deadlines, all in one place.</p></Reveal>
        <div className="rs-cover-layout"><Reveal className="rs-away-person"><Example /><Icon kind="calendar" /><span>Sam, away this week</span></Reveal><div className="rs-cover-view"><Example /><div className="rs-cover-grid">{[
          ['Open work', 'Share the review notes'],
          ['Recent decisions', 'Move supplier reviews to monthly'],
          ['People to know', 'Alex, Operations'],
          ['Coming deadlines', 'Supplier review, 27 October'],
        ].map(([title, value], i) => <Reveal className="rs-cover-card" key={title} delay={i * 80}><h3>{title}</h3><p>{value}</p></Reveal>)}</div></div></div>
      </div></section>
      <section className="rs-section" aria-labelledby="people-title"><div className="rs-container"><Reveal><h2 id="people-title">Everyone has a reason to open it.</h2></Reveal><div className="rs-audiences">{[
        ['Employees', 'Keep your day in one place and leave nothing behind.', 'notes'],
        ['Managers', 'See who is covering and what is open.', 'people'],
      ].map(([title, text, kind], i) => <Reveal className="rs-audience-card" key={title} delay={i * 80}><Icon kind={kind} /><h3>{title}</h3><p>{text}</p></Reveal>)}</div></div></section>
      <section className="rs-section rs-tinted" aria-labelledby="tools-title"><div className="rs-container rs-two-col"><Reveal className="rs-section-heading"><h2 id="tools-title">Works next to the tools you already use.</h2><p>Nothing to replace. Vimbre keeps the decisions and context they miss.</p></Reveal><Reveal className="rs-tools-visual"><Example /><div className="rs-tools-flow"><div className="rs-tool-input"><Icon /><span>Notes</span></div><svg className="rs-tools-lines" viewBox="0 0 240 130" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 65 C80 65 160 65 240 65" /></svg><span className="rs-tools-mark"><BrandLogo variant="symbol" decorative /></span></div></Reveal></div></section>
      <section id="pricing" className="rs-section rs-pricing-section" aria-labelledby="pricing-title"><div className="rs-container"><Reveal><h2 id="pricing-title">Simple plans for every team size.</h2></Reveal><div className="rs-pricing">{plans.map((plan, i) => <Reveal key={plan.name} className={`rs-plan ${i === 1 ? 'rs-plan-featured' : ''}`} delay={i * 60}>
        <h3>{plan.name}</h3><div className="rs-plan-price">{plan.price}{i < 3 && <span>a month</span>}</div><p>{plan.size}</p><ul>{plan.items.map(item => <li key={item}><Icon kind="check" />{item}</li>)}</ul>{i === 3 ? <a className="rs-button rs-button-outline" href="mailto:hello@vimbre.com?subject=Vimbre%20Enterprise">{cta}<Arrow /></a> : <Link className={`rs-button ${i !== 1 ? 'rs-button-outline' : ''}`} to={to}>{cta}<Arrow /></Link>}
      </Reveal>)}</div></div></section>
      <section id="questions" className="rs-section" aria-labelledby="faq-title"><div className="rs-container rs-faq"><Reveal><h2 id="faq-title">Questions people ask.</h2></Reveal><FAQ /></div></section>
      <section className="rs-section rs-final" aria-labelledby="final-title" data-final-section><StreamMotif /><div className="rs-container"><Reveal><h2 id="final-title">Start with your next email or meeting.</h2><p>Add one decision. See what it feels like when the next person can find it.</p><Link className="rs-button rs-button-white" to={to}>{cta}<Arrow /></Link></Reveal></div></section>
      <ContactSection />
    </main>
    <footer className="rs-footer"><div className="rs-container"><div className="rs-footer-top"><Link className="rs-footer-brand" to="/" aria-label="Vimbre home"><BrandLogo /></Link><nav aria-label="Footer">{[['Product', '#features'], ['How it works', '#how-it-works'], ['Pricing', '#pricing'], ['Contact', '#contact']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}{Object.entries(legalDocuments).filter(([, document]) => document !== null).map(([slug]) => <Link key={slug} to={`/${slug}`}>{slug === 'privacy' ? 'Privacy' : 'Terms'}</Link>)}</nav></div><p>© 2026 Genade Global Services Ltd, Glasgow, United Kingdom.</p></div></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
  </div>
}

