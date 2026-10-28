import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { LandingHeader } from './LandingHeader'
import { ContactSection } from './ContactSection'
import { legalDocuments } from './legal-content'
import { ConnectedTimeline } from './RefinedProductDemos'
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
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return <div className="rs-faq-list">{faq.map(([question, answer], i) => <div className={'rs-faq-item' + (open === i ? ' rs-faq-open' : '')} key={question}>
    <h3><button type="button" id={'faq-button-' + i} aria-expanded={open === i} aria-controls={'faq-panel-' + i} onClick={() => setOpen(open === i ? null : i)}>{question}<span aria-hidden="true">+</span></button></h3>
    <div id={'faq-panel-' + i} role="region" aria-labelledby={'faq-button-' + i} className="rs-faq-panel" inert={open !== i}><div><p>{answer}</p></div></div>
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
            <h1 id="hero-title" tabIndex={-1}>Turn conversations into <span>tasks, decisions and handovers.</span></h1>
            <p className="rs-hero-subhead">{heroCopy.supporting}</p>
            <div className="rs-actions"><Link className="rs-button" to={to}>{cta}<Arrow /></Link><a className="rs-text-link" href="#product-demo">See the walkthrough<Arrow /></a></div>
            <p className="rf-hero-microcopy">No card required.</p>
          </div>
          <div className="rf-wide-demo" id="product-demo"><HeroStory rootRef={stage} paused={story.paused} ready={story.ready} toggle={() => motion.current?.toggle()} /></div>
        </div>
      </section>
      <section id="how-it-works" className="rs-section" aria-labelledby="how-title"><div className="rs-container">
       <Reveal><h2 id="how-title">How it works</h2></Reveal>
       <ConnectedTimeline/>
       <aside className="rf-ai-note" aria-labelledby="ai-note-title"><h3 id="ai-note-title">What Vimbre AI does and doesn’t do</h3><p>You tap to request a draft. Check names, owners and dates before saving. It does not confirm work for you. If you separately enable a Watch rule, it can prepare private drafts for review.</p><p>At your AI limit, drafting pauses. Your saved records, tasks and manual work keep working.</p></aside>
       <div className="rf-tools-row" aria-label="Available connections">{['Gmail','Google Drive','Outlook','Microsoft Teams','Slack','Trello'].map(name=><span key={name}><strong>{name}</strong><small>Live</small></span>)}</div><p className="rf-tools-consent">Connect your account with your company’s permission. You choose what to bring in.</p>
      </div></section>
      <section id="pricing" className="rs-section rs-pricing-section" aria-labelledby="pricing-title">
        <div className="rs-container">
          <Reveal><span className="rs-eyebrow">Company plans</span><h2 id="pricing-title">Plans and prices.</h2><p className="rf-pricing-intro">Company bundles shown per month, with the price per person at each plan's maximum team size. Choose the team size and AI allowance that fit your work.</p><p className="rf-pricing-start-note">Start a trial without a card. Paid subscriptions and checkout are not active yet.</p></Reveal>
          <div className="rs-pricing">{plans.map((plan, i) => <Reveal key={plan.name} className={'rs-plan ' + (i === 1 ? 'rs-plan-featured' : '')} delay={i * 60}>
            {i === 1 && <span className="rf-popular-label">More AI requests</span>}
            <h3>{plan.name}</h3><div className="rs-plan-price">{plan.price}{plan.amount !== null && <span>per company / month</span>}</div>
            {plan.seats !== null && plan.amount !== null && <p className="rf-per-person">{money(plan.amount / plan.seats)} <span>per person / month at full team size</span></p>}
            <p className="rf-plan-positioning">{plan.size}<br />{plan.positioning}</p>
            <ul>{plan.items.map(item => <li key={item}><Icon kind="check" />{item}</li>)}</ul>
            <Link className={'rs-button ' + (i !== 1 ? 'rs-button-outline' : '')} to={plan.amount===null?'/#contact':authenticated?'/app/billing?plan='+plan.name.toLowerCase():'/signup?plan='+plan.name.toLowerCase()}>{plan.amount===null?'Contact us':authenticated?'Choose '+plan.name:'Start free trial'}<Arrow /></Link>
          </Reveal>)}</div>
          <p className="rf-pricing-disclosure">{pricingDisclosure}</p>
          <PricingValueCalculator />
        </div>
      </section>
      <section id="questions" className="rs-section" aria-labelledby="faq-title"><div className="rs-container rs-faq"><Reveal><span className="rs-eyebrow">Straight answers</span><h2 id="faq-title">Questions people ask.</h2></Reveal><FAQ /></div></section>
      <section className="rs-section rf-final-cta" aria-labelledby="final-title"><div className="rs-container"><h2 id="final-title">Try it with your next conversation.</h2><Link className="rs-button" to={to}>{cta}<Arrow/></Link><p>No card required.</p></div></section>
      <ContactSection />
    </main>
    <footer className="rs-footer"><div className="rs-container"><div className="rs-footer-top"><Link className="rs-footer-brand" to="/" aria-label="Vimbre home"><BrandLogo /></Link><nav aria-label="Footer">{[['Product', '#product-demo'], ['How it works', '#how-it-works'], ['Pricing', '#pricing'], ['FAQ', '#questions'], ['Contact', '#contact']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}{Object.entries(legalDocuments).filter(([, document]) => document !== null).map(([slug]) => <Link key={slug} to={'/' + slug}>{slug === 'privacy' ? 'Privacy' : 'Terms'}</Link>)}</nav></div><p>© 2026 Genade Global Services Ltd, Glasgow, United Kingdom.</p></div></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
  </div>
}
