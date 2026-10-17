import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import './landing.css'

// Starting bundles from the original Vimbre product notes, page 7.
const plans = [
  { name: 'Starter', price: '£29', period: 'per company / month', description: 'Up to 10 people', features: ['Unlimited handovers', 'Leave workflows', 'Basic AI generator', 'Email notifications'] },
  { name: 'Growth', price: '£99', period: 'per company / month', description: 'Up to 50 people', features: ['Everything in Starter', 'Manager dashboards', 'Approval workflows', 'Templates and reports'] },
  { name: 'Business', price: '£249', period: 'per company / month', description: 'Up to 250 people', features: ['Everything in Growth', 'Advanced reporting', 'Role permissions'] },
  { name: 'Enterprise', price: 'Custom', period: 'tailored to your company', description: '250 people and above', features: ['Custom team size', 'Dedicated support', 'Custom security policies'] },
]
const features = [
  { title: 'Keep the role record', text: 'The responsibilities, contacts and documents behind the work.', icon: '▤', className: 'v-feature-wide', visual: 'record' },
  { title: 'Keep the reason', text: 'What was decided, why, and what comes next.', icon: '↳', className: '', visual: 'decision' },
  { title: 'Capture from everyday work', text: 'Bring in notes or emails. Review the AI draft before saving.', icon: '↥', className: '', visual: 'capture' },
  { title: 'Hand over with context', text: 'Give the person covering you the full picture.', icon: '⇄', className: 'v-feature-wide', visual: 'handover' },
]

export function HomePage() {
  const { profile } = useAuth()
  const root = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('vimbre-public-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' }
  })
  useEffect(() => {
    try { localStorage.setItem('vimbre-public-theme', theme) } catch { /* Theme still works without storage. */ }
  }, [theme])
  useEffect(() => {
    const elements = root.current?.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!elements || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('v-revealed'); observer.unobserve(entry.target) } })
    }, { threshold: 0.12 })
    elements.forEach(element => { element.classList.add('v-ready'); observer.observe(element) })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && menu) { setMenu(false); root.current?.querySelector<HTMLButtonElement>('.v-menu')?.focus() } }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menu])
  const destination = profile ? '/app' : '/signup'
  const action = profile ? 'Open workspace' : 'Create your company'

  return <div className="v-site" data-theme={theme} ref={root}>
    <a className="skip-link" href="#v-main">Skip to content</a>
    <header className="v-header">
      <Link to="/" className="v-brand" aria-label="Vimbre home"><span className="v-mark" aria-hidden="true"><i /><i /></span>vimbre</Link>
      <nav className={`v-nav${menu ? ' v-open' : ''}`} id="v-navigation" aria-label="Public">
        <a href="#how-it-works" onClick={() => setMenu(false)}>How it works</a><a href="#features" onClick={() => setMenu(false)}>Features</a><a href="#pricing" onClick={() => setMenu(false)}>Pricing</a><a href="#questions" onClick={() => setMenu(false)}>Questions</a>
      </nav>
      <div className="v-header-actions"><button className="v-theme" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span></button><Link className="v-login" to={profile ? '/app' : '/login'}>{profile ? 'Workspace' : 'Log in'}</Link><Link className="v-button v-header-cta" to={destination}>{profile ? 'Open workspace' : 'Create account'}</Link><button type="button" className="v-menu" aria-label={menu ? 'Close website menu' : 'Open website menu'} aria-expanded={menu} aria-controls="v-navigation" onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button></div>
    </header>

    <main id="v-main">
      <section className="v-hero">
        <div className="v-glow v-glow-one" aria-hidden="true" /><div className="v-glow v-glow-two" aria-hidden="true" />
        <div className="v-hero-copy"><span className="v-eyebrow">The record your other tools miss</span><h1 tabIndex={-1}><span>Stop losing what </span><span>your team </span><span className="v-blue-text">already decided</span></h1><p>Keep the decisions, reasons and context the next person needs.</p><div className="v-actions"><Link className="v-button" to={destination}>{action}<span aria-hidden="true">↗</span></Link><a className="v-button v-button-quiet" href="#how-it-works">See how it works<span aria-hidden="true">↓</span></a></div><p className="v-plain-line">Works next to the tools you already use.</p></div>
        <div className="v-product" aria-label="A visual outline of the role record">
          <div className="v-product-bar"><span className="v-brand-mini">◎ vimbre</span><span>The role record</span><span aria-hidden="true">↗</span></div>
          <div className="v-product-body"><div className="v-product-nav"><span className="v-active">Role record</span><span>Decisions</span><span>My day</span><span>Handovers</span><div className="v-sidebar-lines" aria-hidden="true"><i /><i /><i /></div></div><div className="v-product-content"><span className="v-eyebrow">The context behind a role</span><h2>The full picture.<br />In one place.</h2><div className="v-record-row"><span>▤</span><div><strong>What the role does</strong><small>Responsibilities and workstreams</small></div></div><div className="v-record-row"><span>↳</span><div><strong>What was decided</strong><small>The reason and the source</small></div></div><div className="v-record-row"><span>⇄</span><div><strong>What comes first</strong><small>A clear start for the next person</small></div></div></div></div>
          <div className="v-product-footer"><span className="v-dot" /> The context stays with the work</div>
        </div>
        <div className="v-hero-bottom"><span aria-hidden="true">↓</span> Scroll to see the record come together</div>
      </section>

      <section className="v-section v-problem" id="how-it-works"><div data-reveal><span className="v-eyebrow">From scattered to shared</span><h2>Decisions get made.<br />Then they disappear.</h2><p>Keep the reason. Keep the record.</p></div><div className="v-source-flow" data-reveal><div><span className="v-source-icon">✉</span><h3>Bring it in</h3><p>An email, a note or a document</p></div><span className="v-flow-arrow" aria-hidden="true">→</span><div><span className="v-source-icon">✓</span><h3>Confirm what matters</h3><p>People review. AI drafts.</p></div><span className="v-flow-arrow" aria-hidden="true">→</span><div><span className="v-source-icon">▤</span><h3>Keep the context</h3><p>A shared record to come back to</p></div></div></section>

      <section className="v-section" id="features"><div className="v-section-heading" data-reveal><div><span className="v-eyebrow">Less searching. More context.</span><h2>What Vimbre does</h2></div><p>The record behind the work.</p></div><div className="v-features">{features.map((feature, index) => <article key={feature.title} className={`v-feature ${feature.className}`} data-reveal style={{ '--v-delay': `${index % 2 * 150}ms` } as CSSProperties}>
        <span className="v-feature-icon" aria-hidden="true">{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p>
        <div className={`v-art v-art-${feature.visual}`} aria-hidden="true">{feature.visual === 'record' ? <><span>Responsibilities</span><span>Decisions</span><span>Contacts</span><span>Documents</span></> : feature.visual === 'handover' ? <><i>▤</i><span className="v-art-line" /><i>✓</i><span className="v-art-line" /><i>⇄</i></> : feature.visual === 'decision' ? <><span>The decision</span><span>The reason ↳</span></> : <><i>✉</i><i>＋</i><i>▤</i><span>Review → Confirm</span></>}</div>
      </article>)}</div></section>

      <section className="v-benefits" data-reveal><div><span className="v-eyebrow">When someone steps in</span><h2>What it saves you</h2><p>Less searching. Less repeating.<br />A clearer handover.</p><Link to={destination} className="v-text-link">{action} <span aria-hidden="true">↗</span></Link></div><div className="v-glass-stack" aria-hidden="true"><div /><div /><div><span>THE CONTEXT</span><i /><i /><i /><b>↗</b></div><span className="v-stack-orbit" /></div></section>

      <section className="v-section" id="pricing"><div className="v-centered" data-reveal><span className="v-eyebrow">Room for your team</span><h2>Pricing</h2><p>Choose the right fit for your company.</p></div><div className="v-pricing">{plans.map((plan, index) => <article className={`v-plan${index === 1 ? ' v-plan-focus' : ''}`} key={index} data-reveal style={{ '--v-delay': `${index * 150}ms` } as CSSProperties}><span className="v-plan-number" aria-hidden="true">0{index + 1}</span><h3>{plan.name}</h3><p>{plan.description}</p><div className="v-price">{plan.price}<small>{plan.period}</small></div>{plan.features.length > 0 && <ul>{plan.features.map(item => <li key={item}>✓ {item}</li>)}</ul>}<Link className={`v-button${index === 1 ? '' : ' v-button-quiet'}`} to={destination}>{action}<span aria-hidden="true">↗</span></Link></article>)}</div></section>

      <section className="v-section v-faq" id="questions"><div data-reveal><span className="v-eyebrow">A little clarity</span><h2>A few things<br />to know</h2></div><div className="v-faq-list" data-reveal><details><summary>Does it replace our work tools?</summary><p>No. Your team keeps its work tools. Vimbre keeps the decisions and role context beside them.</p></details><details><summary>Does AI save things by itself?</summary><p>No. AI drafts. A person reviews and confirms before anything becomes part of the record.</p></details><details><summary>Who can see the record?</summary><p>Employees keep their own records. Managers read their department’s work. HR Admins can read the company record.</p></details><details><summary>How does my team join?</summary><p>Your HR Admin invites teammates into the same company workspace by email.</p></details></div></section>

      <section className="v-cta" data-reveal><span className="v-eyebrow">Keep the next person in the picture</span><h2>Start with your next<br />email or meeting.</h2><Link className="v-button" to={destination}>{action}<span aria-hidden="true">↗</span></Link><div className="v-cta-ring" aria-hidden="true" /></section>
    </main><footer className="v-footer">© 2026 Vimbre. All rights reserved.</footer>
  </div>
}
