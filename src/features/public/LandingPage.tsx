import {CookieSettingsLink} from '../analytics/AnalyticsConsent'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { LandingHeader } from './LandingHeader'
import { ContactSection } from './ContactSection'
import { CaptureSourceLogo } from '../capture/CaptureSourceLogo'
import { ConnectedTimeline } from './RefinedProductDemos'
import { faq, plans, schema, heroCopy, pricingDisclosure } from './landing-content'
import { HeroHeadline } from './HeroHeadline'
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
  return <div className="rs-site" data-theme="light" ref={root}>
    <a className="skip-link" href="#rs-main">Skip to content</a>
    <LandingHeader authenticated={authenticated} loading={loading} />
    <main id="rs-main">
      <section className="rs-hero rf-hero" aria-labelledby="hero-title">
        <div className="rs-container rs-hero-grid">
          <div className="rs-hero-copy">
            <p className="rs-eyebrow">Work continuity for teams</p>
            <HeroHeadline/>
            <p className="rs-hero-subhead">{heroCopy.supporting}</p>
            <div className="rs-actions"><Link className="rs-button" to={authenticated?'/app':'/signup'}>{authenticated?'Go to workspace':'Get started'}<Arrow /></Link><a className="rs-text-link" href="#product-demo">See the walkthrough<Arrow /></a></div>
          </div>
          <div className="rf-wide-demo" id="product-demo"><HeroStory rootRef={stage} paused={story.paused} ready={story.ready} toggle={() => motion.current?.toggle()} /></div>
        </div>
      </section>
      <section className="rs-section rf-problem" aria-labelledby="problem-title"><div className="rs-container"><Reveal><h2 id="problem-title">Work shouldn’t depend on memory</h2></Reveal><div className="rf-frustrations" role="list">{['Why was this decided?','Who agreed it?','What changed?',"What’s still outstanding?",'What needs attention next?'].map((text,i)=><Reveal key={text} delay={i*60}><div className="rf-frustration" role="listitem"><Icon kind="notes"/>{text}</div></Reveal>)}</div><p className="rf-problem-answer">Vimbre keeps the answers connected.</p></div></section>
      <section className="rs-section rf-difference" aria-labelledby="difference-title"><div className="rs-container"><Reveal><h2 id="difference-title">What makes Vimbre different</h2></Reveal><div className="rf-comparison" role="table" aria-label="Existing tools and Vimbre"><div className="rf-comparison-row rf-comparison-head" role="row"><div role="columnheader">Your existing tools</div><div role="columnheader">What Vimbre adds</div></div>{[['Trello, ClickUp and monday.com help you organise tasks and projects.','Vimbre keeps the reason for a task and the decision behind it with the work.'],['Teams and email help you discuss work and share updates.','Bring a conversation into Vimbre, check the suggested tasks and decisions, then save them.'],['Your files and notes hold details in different places.','Vimbre brings selected tasks, decisions and role information into a handover someone else can follow.']].map(([existing,vimbre])=><div className="rf-comparison-row" role="row" key={existing}><div role="cell">{existing}</div><div role="cell"><Icon kind="check"/>{vimbre}</div></div>)}</div></div></section>
      <section id="how-it-works" className="rs-section" aria-labelledby="how-title"><div className="rs-container">
       <Reveal><h2 id="how-title">How it works</h2></Reveal>
       <ConnectedTimeline/>
       <div className="rf-tools-row" aria-label="Tool integrations">{[['teams','Microsoft Teams'],['trello','Trello'],['slack','Slack'],['outlook','Outlook'],['github','GitHub'],['notion','Notion'],['asana','Asana'],['yahoo','Yahoo Mail']].map(([provider,name])=><span key={provider} aria-label={name} title={name}><CaptureSourceLogo provider={provider}/></span>)}</div><p className="rf-tools-consent">Connect your account with your company’s permission. You choose what to bring in.</p>
      </div></section>
      <section className="rs-section rf-use-cases" aria-labelledby="use-cases-title"><div className="rs-container"><Reveal><h2 id="use-cases-title">Built for everyday business situations.</h2></Reveal><div className="rf-use-case-grid">{[['Covering a colleague','Pick up work without lengthy briefings.'],['New staff onboarding','Understand ongoing work faster.'],['Handovers','Keep progress moving between people.'],['Management visibility',"Understand what's happening without chasing updates."],['Audit & accountability','Know who decided what and when.']].map(([title,description],i)=><Reveal className="rf-use-case" key={title} delay={i*60}><Icon kind={['people','notes','record','people','check'][i]}/><h3>{title}</h3><p>{description}</p></Reveal>)}</div></div></section>
      <section id="pricing" className="rs-section rs-pricing-section" aria-labelledby="pricing-title">
        <div className="rs-container">
          <Reveal><span className="rs-eyebrow">Company plans</span><h2 id="pricing-title">Plans and prices.</h2><p className="rf-pricing-intro">Choose a company plan for your team size and AI usage.</p></Reveal>
          <div className="rs-pricing">{plans.map((plan, i) => <Reveal key={plan.name} className={'rs-plan ' + (plan.name === 'Growth' ? 'rs-plan-featured' : '')} delay={i * 60}>
            {plan.name === 'Growth' && <span className="rf-popular-label">More AI requests</span>}
            <h3>{plan.name}</h3><div className="rs-plan-price">{plan.price}{plan.amount !== null && <span>per company / month</span>}</div>
            <p className="rf-plan-positioning">{plan.size}<br />{plan.positioning}</p>
            <ul>{plan.items.map(item => <li key={item}><Icon kind="check" />{item}</li>)}</ul>
            <Link className={'rs-button ' + (plan.name !== 'Growth' ? 'rs-button-outline' : '')} to={plan.amount===null?'/#contact':authenticated?'/app/billing?plan='+plan.name.toLowerCase():'/signup?plan='+plan.name.toLowerCase()}>{plan.amount===null?'Contact us':authenticated?'Choose '+plan.name:plan.name==='Free'?'Start free':'Start free trial'}<Arrow /></Link>
          </Reveal>)}</div>
          <p className="rf-pricing-disclosure">{pricingDisclosure}</p>
          <PricingValueCalculator />
        </div>
      </section>
      <section id="questions" className="rs-section" aria-labelledby="faq-title"><div className="rs-container rs-faq"><Reveal><span className="rs-eyebrow">Straight answers</span><h2 id="faq-title">Questions people ask.</h2></Reveal><FAQ /></div></section>
      <section className="rs-section rf-final-cta" aria-labelledby="final-title"><div className="rs-container"><h2 id="final-title">Try it with your next conversation.</h2><Link className="rs-button" to={authenticated?'/app/capture':'/#pricing'}>{authenticated?'Capture a conversation':'Get started'}<Arrow/></Link></div></section>
      <ContactSection />
    </main>
    <footer className="rs-footer"><div className="rs-container"><div className="rs-footer-top"><Link className="rs-footer-brand" to="/" aria-label="Vimbre home"><BrandLogo /></Link><nav aria-label="Footer">{[['Product', '#product-demo'], ['How it works', '#how-it-works'], ['Pricing', '#pricing'], ['FAQ', '#questions'], ['Contact', '#contact']].map(([label, href]) => <a key={label} href={href}>{label}</a>)}<Link to="/blog">Blog</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><CookieSettingsLink /></nav></div><p>© 2026 Genade Global Service Limited.</p></div></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
  </div>
}
