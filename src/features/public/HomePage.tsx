import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import './landing.css'

const plans = [
  { name: 'Starter', price: '£29', size: 'Up to 10 people', items: ['Unlimited handovers', 'Leave workflows', 'Basic AI generator', 'Email notifications'] },
  { name: 'Growth', price: '£99', size: 'Up to 50 people', items: ['Everything in Starter', 'Manager dashboards', 'Approval workflows', 'Templates and reports'] },
  { name: 'Business', price: '£249', size: 'Up to 250 people', items: ['Everything in Growth', 'Advanced reporting', 'Role permissions'] },
  { name: 'Enterprise', price: 'Custom', size: '250+ people', items: ['Dedicated support', 'Custom security policies'] },
]
function Mark() { return <span className="rs-mark" aria-hidden="true"><i /><i /></span> }
function Icon({ kind = 'document' }: { kind?: 'document' | 'check' | 'arrow' | 'mail' | 'person' }) {
  const paths = { document: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6', check: 'M5 12l4 4L19 6', arrow: 'M4 12h16 M14 6l6 6-6 6', mail: 'M3 5h18v14H3z M3 5l9 8 9-8', person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 8 0 0 1 16 0v3' }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[kind]} /></svg>
}
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={`rs-reveal ${className}`} style={{ '--rs-delay': `${delay}ms` } as CSSProperties} data-rs-reveal>{children}</div>
}
function Ribbon({ className = '' }: { className?: string }) {
  return <svg className={`rs-ribbon ${className}`} viewBox="0 0 1200 500" fill="none" aria-hidden="true"><path d="M-100 450C220 580 180 170 520 220S850 530 1300 60" stroke="#eaf2fe" strokeWidth="85" /><path d="M-100 450C220 580 180 170 520 220S850 530 1300 60" stroke="#2f80ed" strokeOpacity=".15" strokeWidth="2" /><path className="rs-ribbon-trace" d="M-100 450C220 580 180 170 520 220S850 530 1300 60" stroke="#2f80ed" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 1200" /></svg>
}
function ProductPreview({ mode = 'role', sidebar = true }: { mode?: 'role' | 'decision' | 'handover'; sidebar?: boolean }) {
  const isDecision = mode === 'decision'
  return <div className={`rs-product rs-product-${mode}`} role="img" aria-label={`Illustrative ${mode === 'role' ? 'role record' : mode === 'decision' ? 'decision log' : 'handover'} preview with example information`}>
    {sidebar && <div className="rs-product-sidebar"><span className="rs-product-brand"><Mark />Vimbre</span><span><Icon />My day</span><span className={!isDecision ? 'rs-selected' : ''}><Icon kind="person" />Role records</span><span className={isDecision ? 'rs-selected' : ''}><Icon />Decisions</span><span><Icon kind="arrow" />Handovers</span></div>}
    <div className="rs-product-content"><div className="rs-product-title"><strong>{isDecision ? 'Decision log' : 'Role record'}</strong><span aria-hidden="true">⌕</span></div>
      {isDecision ? <><div className="rs-decision-labels"><span>Decision</span><span>Context</span><span>Next step</span></div><div className="rs-decision-example"><div><small className="rs-example">Example</small><strong>Move to monthly supplier review</strong></div><p>To reduce meeting load and focus on key updates.</p><p>Share the review notes.</p></div></> : <><div className="rs-product-tabs"><span className="rs-active">Responsibilities</span><span>{mode === 'handover' ? 'Open work' : 'Workstreams'}</span><span>{mode === 'handover' ? 'Useful links' : 'Documents'}</span></div>{mode === 'handover' ? <div className="rs-handover-columns">{[['Responsibilities', 'Own supplier relationships', 'Run weekly review', 'Track operational risks'], ['Open work', 'Prepare supplier review', 'Follow up on actions', 'Update team plan'], ['Useful links', 'Operations handbook', 'Supplier list', 'Review notes']].map((column, i) => <div key={column[0]}><strong>{column[0]}</strong>{column.slice(1).map(item => <span key={item}><i aria-hidden="true">{i === 2 ? '↗' : '○'}</i>{item}</span>)}</div>)}</div> : <div className="rs-weekly"><small className="rs-example">Example</small><strong>Weekly review</strong><p>Owner: <span>Operations</span></p><p>Next step: <span>Share the review notes</span></p></div>}</>}
      <div className="rs-skeleton" aria-hidden="true"><i /><div><b /><b /></div></div>
    </div>
  </div>
}
const faq = [
  ['What is Vimbre?', 'Vimbre keeps role knowledge, decisions and handovers in one place. It holds the context behind the work, so the next person has a clear place to start.'],
  ['Who is it for?', 'Employees keep their role knowledge up to date. Managers review their team’s work, while HR Admins manage the company workspace and handover process.'],
  ['Does it replace our existing tools?', 'No. Vimbre works next to the tools you already use. Keep the decisions, reasons and useful context beside your everyday work.'],
  ['What happens when someone is away?', 'The handover brings together responsibilities, open work and useful links. The employee reviews it before the next person takes over.'],
]
export function HomePage() {
  const { profile } = useAuth()
  const root = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('rs-visible'); observer.unobserve(entry.target) } }), { threshold: .08 })
    root.current?.querySelectorAll('[data-rs-reveal]').forEach(el => { el.classList.add('rs-pending'); observer.observe(el) })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); root.current?.querySelector<HTMLButtonElement>('.rs-menu')?.focus() } }
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close)
  }, [menuOpen])
  const to = profile ? '/login' : '/signup'
  const cta = profile ? 'Open workspace' : 'Get started'
  return <div className="rs-site" data-theme="light" ref={root}>
    <a className="skip-link" href="#rs-main">Skip to content</a>
    <header className="rs-header"><div className="rs-container rs-header-inner"><Link className="rs-brand" to="/" aria-label="Vimbre home"><Mark />Vimbre</Link><nav id="rs-navigation" className={`rs-nav${menuOpen ? ' rs-nav-open' : ''}`} aria-label="Public">{[['Product', '#features'], ['How it works', '#how-it-works'], ['Pricing', '#pricing']].map(([label, href]) => <a href={href} key={label} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav><div className="rs-header-actions"><Link className="rs-login" to="/login">Log in</Link><Link className="rs-button rs-header-cta" to={to}>{cta}</Link><button className="rs-menu" type="button" aria-label={menuOpen ? 'Close website menu' : 'Open website menu'} aria-expanded={menuOpen} aria-controls="rs-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button></div></div></header>
    <main id="rs-main">
      <section className="rs-hero"><Ribbon /><div className="rs-container rs-hero-grid"><div className="rs-hero-copy"><Reveal><span className="rs-eyebrow">The record your other tools miss</span></Reveal><Reveal delay={80}><h1 tabIndex={-1}>Stop losing what <br />your team <span>already decided.</span></h1></Reveal><Reveal delay={150}><p>Keep decisions, role knowledge and handovers in one place.</p><div className="rs-actions"><Link className="rs-button" to={to}>{cta}<Icon kind="arrow" /></Link><a className="rs-text-link" href="#how-it-works">See how it works <Icon kind="arrow" /></a></div></Reveal></div><Reveal className="rs-hero-visual" delay={180}><ProductPreview /><div className="rs-captured"><small className="rs-example">Example</small><strong><span className="rs-captured-check"><Icon kind="check" /></span>Decision captured</strong><p>Added to this role record and linked to your notes.</p></div></Reveal></div></section>
      <section className="rs-context-section" id="features"><div className="rs-container"><div className="rs-context-heading"><Reveal><h2>Decisions get made.<br />Then they disappear.</h2></Reveal><Reveal delay={90}><p>Vimbre keeps the context<br />with the work.</p></Reveal></div><div className="rs-flow"><div className="rs-sources">{['Meeting notes', 'Email', 'Daily notes'].map((source, i) => <Reveal className="rs-source" key={source} delay={i * 100}><Icon kind={i === 1 ? 'mail' : 'document'} /><div><strong>{source}</strong><span aria-hidden="true"><i /><i /></span></div></Reveal>)}</div><svg className="rs-flow-paths" viewBox="0 0 300 280" fill="none" aria-hidden="true"><path d="M0 35C170 35 80 140 290 140 M0 140H290 M0 245C170 245 80 140 290 140 M280 130l10 10-10 10" /><circle className="rs-flow-dot" r="4"><animateMotion dur="5s" repeatCount="indefinite" path="M0 35C170 35 80 140 290 140" /></circle></svg><Reveal className="rs-flow-record" delay={180}><ProductPreview sidebar={false} /></Reveal></div></div></section>
      <section className="rs-dark-section"><div className="rs-container"><Reveal><h2>A clear record. A smoother handover.</h2></Reveal><div className="rs-feature-row"><Reveal><ProductPreview mode="decision" /></Reveal><Reveal className="rs-feature-copy" delay={100}><h3>Keep the why<br />with the what.</h3><p>Capture decisions in context so the next person understands what happened and what’s next.</p></Reveal></div><div className="rs-feature-row rs-feature-reverse"><Reveal className="rs-feature-copy"><h3>Give the next person<br />a clear starting point.</h3><p>A complete view of the role, open work and useful links for a smoother handover.</p></Reveal><Reveal delay={100}><ProductPreview mode="handover" sidebar={false} /></Reveal></div></div></section>
      <section className="rs-steps-section" id="how-it-works"><div className="rs-container"><Reveal><h2>Three steps. Less repeat explaining.</h2></Reveal><div className="rs-steps">{[['Capture your notes.', 'Add meeting notes, decisions and role knowledge.'], ['Keep the context.', 'Link to the work and next steps so nothing gets lost.'], ['Pass it on.', 'Give the next person a clear starting point.']].map(([title, body], i) => <Reveal key={title} delay={i * 110}><span className="rs-step-number">0{i + 1}</span><h3>{title}</h3><p>{body}</p></Reveal>)}</div></div></section>
      <section className="rs-pricing-section" id="pricing"><div className="rs-container"><Reveal><h2>A plan for every team.</h2></Reveal><div className="rs-pricing">{plans.map((plan, index) => <Reveal className={`rs-plan${index === 1 ? ' rs-plan-featured' : ''}`} key={plan.name} delay={index * 70}><h3>{plan.name}</h3><div className="rs-plan-price">{plan.price}{plan.price !== 'Custom' && <span>/ month</span>}</div><p>{plan.size}</p><ul>{plan.items.map(item => <li key={item}><Icon kind="check" />{item}</li>)}</ul><Link className={`rs-button${index === 3 ? ' rs-button-outline' : ''}`} to={to}>{profile ? 'Open workspace' : index === 3 ? 'Discuss your team' : 'Get started'}<Icon kind="arrow" /></Link></Reveal>)}</div></div></section>
      <section className="rs-faq rs-container" id="questions"><Reveal><h2>A few things<br />to know.</h2></Reveal><div className="rs-faq-list">{faq.map(([question, answer], i) => <details key={question} open={i === 0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className="rs-final"><div className="rs-container"><Reveal><h2>Start with your next<br />email or meeting.</h2></Reveal><Reveal delay={120}><Link className="rs-button" to={to}>{cta}<Icon kind="arrow" /></Link></Reveal></div></section>
    </main><footer className="rs-footer rs-container">© 2026 Vimbre.</footer>
  </div>
}
