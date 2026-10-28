import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { LandingHeader } from './LandingHeader'
import { ContactSection } from './ContactSection'
import { legalDocuments } from './legal-content'
import { ConnectedTimeline, CapabilityDemos, HandoverExample } from './RefinedProductDemos'
import { faq, plans, schema, heroCopy, pricingDisclosure } from './landing-content'
import { HeroStory } from './HeroStory'
import { PricingValueCalculator } from './PricingValueCalculator'
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
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={'rs-reveal ' + className} data-reveal style={{ '--reveal-delay': String(delay) + 'ms' } as CSSProperties}>{children}</div>
}
function StreamMotif() {
  return <img className="rs-stream-motif" src="/vimbre-mark-colour.svg" width="512" height="512" alt="" aria-hidden="true" />
}
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return <div className="rs-faq-list">{faq.map(([question, answer], i) => <div className={'rs-faq-item' + (open === i ? ' rs-faq-open' : '')} key={question}>
    <h3><button type="button" id={'faq-button-' + i} aria-expanded={open === i} aria-controls={'faq-panel-' + i} onClick={() => setOpen(open === i ? null : i)}>{question}<span aria-hidden="true">+</span></button></h3>
    <div id={'faq-panel-' + i} role="region" aria-labelledby={'faq-button-' + i} className="rs-faq-panel" inert={open !== i}><div><p>{answer}</p></div></div>
  </div>)}</div>
}
function ToolAvailability() {
  const tools = [
    { name: 'Paste email or notes', state: 'Available now', active: true },
    { name: 'Gmail', state: 'Available · Connect your account', active: true },
    { name: 'Google Drive', state: 'Available · Connect your account', active: true },
    { name: 'Outlook', state: 'Available · Connect your account', active: true },
    { name: 'Microsoft Teams', state: 'Available · Connect your account', active: true },
    { name: 'Slack', state: 'Available · Connect your account', active: true },
    { name: 'Trello', state: 'Available · Connect your account', active: true },
  ]
  return <div className="rf-tools-status">
    <div className="rf-tools-status-heading"><div><span className="rs-eyebrow">Source availability</span><h3>Paste a conversation or connect your tools.</h3></div><p>Vimbre does not replace your tools. Choose Gmail, Google Drive, Outlook, Teams, Slack or Trello. Your company must allow the tool, and you approve account access.</p></div>
    <div className="rf-tool-availability">{tools.map(tool => <div className="rf-tool-status" key={tool.name}>
      <span className={'rf-tool-state-dot' + (tool.active ? ' rf-tool-state-live' : '')} aria-hidden="true" />
      <strong>{tool.name}</strong><span className={'rf-tool-state-label' + (tool.active ? ' rf-tool-state-live-label' : '')}>{tool.state}</span>
    </div>)}</div>
  </div>
}
function AITrustBlock() {
  return <section className="rs-section rf-ai-trust" aria-labelledby="ai-trust-title">
    <div className="rs-container rf-ai-trust-layout">
      <Reveal><span className="rs-eyebrow">You stay in control</span><h2 id="ai-trust-title">Vimbre AI drafts. You decide what gets saved.</h2><p>For normal drafts, Vimbre AI runs only when you tap to request it. Read the source, check names and dates, edit what needs changing, and confirm only what is correct. Nothing becomes a shared action or decision until you confirm it. Your source and pending draft remain private. If you enable a Watch rule separately, it can prepare private drafts under that rule; it never confirms actions for you.</p></Reveal>
      <div className="rf-ai-trust-points">
        <article><span className="rf-ai-point-number">01</span><div><h3>It drafts</h3><p>It suggests actions and context from text or a selected source.</p></div></article>
        <article><span className="rf-ai-point-number">02</span><div><h3>You check</h3><p>Review the wording, owners and dates before anything becomes a record.</p></div></article>
        <article><span className="rf-ai-point-number">03</span><div><h3>You confirm</h3><p>At the AI limit, drafting pauses. Your saved records and manual work continue.</p></div></article>
      </div>
    </div>
  </section>
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
        }).catch(() => { /* Static product screens remain usable if motion enhancement fails. */ })
      }) })
    }
    const resized = () => {
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(start, 150)
    }
    start()
    window.addEventListener('resize', resized, { passive: true })
    media.addEventListener('change', start)
    compact.addEventListener('change', start)
    return () => { disposed = true; window.removeEventListener('resize', resized); window.clearTimeout(resizeTimer); cancelAnimationFrame(frame); media.removeEventListener('change', start); compact.removeEventListener('change', start); motion.current?.dispose(); motion.current = null }
  }, [])
  const to = authenticated ? '/app' : '/signup'
  const cta = authenticated ? 'Open workspace' : 'Start free trial'
  const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return <div className="rs-site" data-theme="light" ref={root}>
    <a className="skip-link" href="#rs-main">Skip to content</a>
    <LandingHeader authenticated={authenticated} loading={loading} />
    <main id="rs-main">
      <section className="rs-hero rf-hero" aria-labelledby="hero-title">
        <div className="rs-container rs-hero-grid">
          <div className="rs-hero-copy">
            <h1 id="hero-title" tabIndex={-1}>Turn conversations into <span>work people can pick up.</span></h1>
            <p className="rs-hero-subhead">{heroCopy.supporting}</p>
            <div className="rs-actions"><Link className="rs-button" to={to}>{cta}<Arrow /></Link><a className="rs-text-link" href="#product-demo">See the walkthrough<Arrow /></a></div>
            <p className="rf-hero-microcopy">No card required. Check every AI draft before saving.</p>
          </div>
          <div className="rf-wide-demo" id="product-demo"><HeroStory rootRef={stage} paused={story.paused} ready={story.ready} toggle={() => motion.current?.toggle()} /></div>
        </div>
      </section>
      <section id="how-it-works" className="rs-section rf-how" aria-labelledby="how-title">
        <div className="rs-container">
          <Reveal className="rs-section-heading"><span className="rs-eyebrow">Four steps</span><h2 id="how-title">From a conversation to a useful handover.</h2><p>Bring it in. Vimbre AI drafts. You check. Then the next person can see what comes first.</p></Reveal>
          <ConnectedTimeline />
        </div>
      </section>
      <section id="features" className="rs-section rs-tinted" aria-labelledby="features-title">
        <div className="rs-container"><Reveal className="rs-section-heading"><span className="rs-eyebrow">In the workspace</span><h2 id="features-title">Decisions, tasks and role records.</h2><p>Keep the decision, the next action and the role information together, without turning Vimbre into another chat app.</p></Reveal><Reveal><CapabilityDemos /></Reveal></div>
      </section>
      <AITrustBlock />
      <section id="handover" className="rs-section" aria-labelledby="cover-title"><div className="rs-container"><Reveal className="rs-section-heading"><span className="rs-eyebrow">Cover with context</span><h2 id="cover-title">Show the next person what needs doing.</h2><p>Preview an example handover. Change the date range to see the included records; real handovers use the information you choose to include.</p></Reveal><Reveal><HandoverExample /></Reveal></div></section>
      <section id="tools" className="rs-section rs-tinted" aria-label="Connected tools"><div className="rs-container"><Reveal><ToolAvailability /></Reveal></div></section>
      <section id="pricing" className="rs-section rs-pricing-section" aria-labelledby="pricing-title">
        <div className="rs-container">
          <Reveal><span className="rs-eyebrow">Company plans</span><h2 id="pricing-title">Plans and prices.</h2><p className="rf-pricing-intro">Company bundles shown per month, with the price per person at each plan's maximum team size. Choose the team size and AI allowance that fit your work.</p><p className="rf-pricing-start-note">Start a trial without a card. Paid subscriptions and checkout are not active yet.</p></Reveal>
          <div className="rs-pricing">{plans.map((plan, i) => <Reveal key={plan.name} className={'rs-plan ' + (i === 1 ? 'rs-plan-featured' : '')} delay={i * 60}>
            {i === 1 && <span className="rf-popular-label">More AI requests</span>}
            <h3>{plan.name}</h3><div className="rs-plan-price">{plan.price}{plan.amount !== null && <span>per company / month</span>}</div>
            {plan.seats !== null && plan.amount !== null && <p className="rf-per-person">{money(plan.amount / plan.seats)} <span>per person / month at full team size</span></p>}
            <p className="rf-plan-positioning">{plan.size}<br />{plan.positioning}</p>
            <ul>{plan.items.map(item => <li key={item}><Icon kind="check" />{item}</li>)}</ul>
            <Link className={'rs-button ' + (i !== 1 ? 'rs-button-outline' : '')} to={to}>{cta}<Arrow /></Link>
          </Reveal>)}</div>
          <p className="rf-pricing-disclosure">{pricingDisclosure}</p>
          <PricingValueCalculator />
        </div>
      </section>
      <section id="questions" className="rs-section" aria-labelledby="faq-title"><div className="rs-container rs-faq"><Reveal><span className="rs-eyebrow">Straight answers</span><h2 id="faq-title">Questions people ask.</h2></Reveal><FAQ /></div></section>
      <section className="rs-section rs-final" aria-labelledby="final-title" data-final-section><StreamMotif /><div className="rs-container"><Reveal><h2 id="final-title">Make the next handover easier.</h2><p>Start with the conversations, tasks and decisions your team already has. Build a clearer handover from there.</p><Link className="rs-button rs-button-white" to={to}>{authenticated ? 'Open workspace' : 'Start free trial'}<Arrow /></Link></Reveal></div></section>
      <ContactSection />
    </main>
    <footer className="rs-footer"><div className="rs-container"><div className="rs-footer-top"><Link className="rs-footer-brand" to="/" aria-label="Vimbre home"><BrandLogo /></Link><nav aria-label="Footer">{[['Product', '#features'], ['How it works', '#how-it-works'], ['Handover', '#handover'], ['Tools', '#tools'], ['FAQ', '#questions'], ['Pricing', '#pricing'], ['Contact', '#contact']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}{Object.entries(legalDocuments).filter(([, document]) => document !== null).map(([slug]) => <Link key={slug} to={'/' + slug}>{slug === 'privacy' ? 'Privacy' : 'Terms'}</Link>)}</nav></div><p>© 2026 Genade Global Services Ltd, Glasgow, United Kingdom.</p></div></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
  </div>
}
