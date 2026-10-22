import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { LandingHeader } from './LandingHeader'
import { ContactSection } from './ContactSection'
import { legalDocuments } from './legal-content'
import { ConnectedTimeline, CapabilityDemos, ContextHistory, HandoverExample } from './RefinedProductDemos'
import { faq, plans, schema, heroCopy } from './landing-content'
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
      <section className="rs-hero rf-hero" aria-labelledby="hero-title">
        <div className="rs-container rs-hero-grid">
          <div className="rs-hero-copy">
            <h1 id="hero-title" tabIndex={-1}>The missing layer <span>behind your work.</span></h1>
            <p className="rs-hero-subhead">{heroCopy.supporting}</p>
            <div className="rs-actions"><a className="rs-button" href="#product-demo">See how Vimbre works<Arrow /></a><a className="rs-button rs-button-outline" href="#features">Explore the platform<Arrow /></a></div>
            <p className="rf-hero-microcopy">Works alongside the tools your team already uses.</p>
          </div>
          <div className="rf-wide-demo" id="product-demo"><HeroStory rootRef={stage} paused={story.paused} ready={story.ready} toggle={() => motion.current?.toggle()} /></div>
        </div>
      </section>
      <section id="problem" className="rs-section rs-problem" aria-labelledby="problem-title">
        <div className="rs-container"><Reveal className="rs-section-heading"><h2 id="problem-title">Work happens everywhere. The full picture doesn't.</h2><p>Conversations, decisions, tasks and outcomes end up in different places, leaving people to reconstruct what happened.</p></Reveal>
          <Example /><div className="rs-problem-visual" data-problem><div className="rs-problem-sources">{['Conversation', 'Decision', 'Action', 'Outcome'].map((label,i)=><div className="rs-source" key={label} data-problem-source><Icon kind={i===0?'email':'notes'} /><strong>{label}</strong><span className="rs-skeleton-lines"><i /><i /></span></div>)}</div><div className="rs-problem-record" data-problem-record><div className="rs-record"><div className="rs-record-bar"><span><Icon />One connected picture</span></div><dl>{[['Conversation','Proposal meeting notes'],['Decision','Use the updated pricing model'],['Action','Revise proposal'],['Outcome','Completed and shared']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></div></div>
        </div>
      </section>
      <section id="how-it-works" className="rs-section rf-how" aria-labelledby="how-title"><div className="rs-container"><Reveal className="rs-section-heading"><h2 id="how-title">Connect the conversation to the outcome.</h2><p>Vimbre links what was discussed, what was decided, what needs doing and what happened next.</p></Reveal><Reveal><ConnectedTimeline /></Reveal></div></section>
      <section id="features" className="rs-section rs-tinted" aria-labelledby="features-title"><div className="rs-container"><Reveal className="rs-section-heading"><h2 id="features-title">Keep the context connected.</h2></Reveal><Reveal><CapabilityDemos /></Reveal></div></section>
      <section className="rs-section" aria-labelledby="context-title"><div className="rs-container"><Reveal className="rs-section-heading"><h2 id="context-title">The context builds as the work happens.</h2><p>Each connected decision, action and outcome adds to the history people can use later.</p></Reveal><Reveal><ContextHistory /></Reveal></div></section>
      <section id="handover" className="rs-section rs-tinted" aria-labelledby="cover-title"><div className="rs-container"><Reveal className="rs-section-heading"><h2 id="cover-title">When someone steps in, they know where to start.</h2><p>Prepare an editable handover from your own records or notes.</p></Reveal><Reveal><HandoverExample /></Reveal></div></section>
      <section className="rs-section" aria-labelledby="tools-title"><div className="rs-container rs-two-col"><Reveal className="rs-section-heading"><h2 id="tools-title">Keep your tools. Connect the work between them.</h2><p>Vimbre is designed to sit alongside your existing tools, not ask your team to replace them.</p><p className="rf-method-note">Capture from pasted email text or notes. Direct connections to Teams, email and task tools are planned.</p></Reveal><Reveal className="rs-tools-visual"><Example /><div className="rs-tools-flow"><div className="rs-tool-input"><Icon /><span>Pasted notes</span></div><svg className="rs-tools-lines" viewBox="0 0 240 130" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 65 C80 65 160 65 240 65" /></svg><span className="rs-tools-mark"><BrandLogo variant="symbol" decorative /></span></div></Reveal></div></section>
      <section className="rs-section" aria-labelledby="people-title"><div className="rs-container"><Reveal><h2 id="people-title">One connected picture. Different value for everyone.</h2></Reveal><div className="rs-audiences">{[
        ['Employees','Know what you committed to and pick up where you left off.','notes'],
        ['Managers','Understand open work, decisions and next steps without reconstructing every conversation.','people'],
        ['People covering a role','See recent decisions, current responsibilities and what needs attention.','people'],
        ['New starters','Build an understanding of ongoing work and why things are done a certain way.','notes'],
      ].map(([title,text,kind],i)=><Reveal className="rs-audience-card" key={title} delay={i*80}><Icon kind={kind} /><h3>{title}</h3><p>{text}</p></Reveal>)}</div></div></section>
      <section id="pricing" className="rs-section rs-pricing-section" aria-labelledby="pricing-title"><div className="rs-container"><Reveal><h2 id="pricing-title">Simple plans for every team size.</h2></Reveal><div className="rs-pricing">{plans.map((plan, i) => <Reveal key={plan.name} className={`rs-plan ${i === 1 ? 'rs-plan-featured' : ''}`} delay={i * 60}>
        <h3>{plan.name}</h3><div className="rs-plan-price">{plan.price}{i < 3 && <span>a month</span>}</div><p>{plan.size}</p><ul>{plan.items.map(item => <li key={item}><Icon kind="check" />{item}</li>)}</ul>{i === 3 ? <a className="rs-button rs-button-outline" href="mailto:hello@vimbre.com?subject=Vimbre%20Enterprise">{cta}<Arrow /></a> : <Link className={`rs-button ${i !== 1 ? 'rs-button-outline' : ''}`} to={to}>{cta}<Arrow /></Link>}
      </Reveal>)}</div></div></section>
      <section id="questions" className="rs-section" aria-labelledby="faq-title"><div className="rs-container rs-faq"><Reveal><h2 id="faq-title">Questions people ask.</h2></Reveal><FAQ /></div></section>
      <section className="rs-section rs-final" aria-labelledby="final-title" data-final-section><StreamMotif /><div className="rs-container"><Reveal><h2 id="final-title">Let the work build on itself.</h2><p>Connect decisions, actions and outcomes, and keep the context available for the next step.</p><Link className="rs-button rs-button-white" to={to}>{authenticated ? 'Open workspace' : 'Get started with Vimbre'}<Arrow /></Link></Reveal></div></section>
      <ContactSection />
    </main>
    <footer className="rs-footer"><div className="rs-container"><div className="rs-footer-top"><Link className="rs-footer-brand" to="/" aria-label="Vimbre home"><BrandLogo /></Link><nav aria-label="Footer">{[['Product', '#features'], ['How it works', '#how-it-works'], ['Handover', '#handover'], ['FAQ', '#questions'], ['Pricing', '#pricing'], ['Contact', '#contact']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}{Object.entries(legalDocuments).filter(([, document]) => document !== null).map(([slug]) => <Link key={slug} to={`/${slug}`}>{slug === 'privacy' ? 'Privacy' : 'Terms'}</Link>)}</nav></div><p>© 2026 Genade Global Services Ltd, Glasgow, United Kingdom.</p></div></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
  </div>
}

