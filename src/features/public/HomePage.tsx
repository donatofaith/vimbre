import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import './landing.css'

const plans = [
  { name: 'Starter', price: '£29', size: 'Up to 10 people', items: ['Unlimited handovers', 'Leave workflows', 'Basic AI generator', 'Email notifications'] },
  { name: 'Growth', price: '£99', size: 'Up to 50 people', items: ['Everything in Starter', 'Manager dashboards', 'Approval workflows', 'Templates and reports'] },
  { name: 'Business', price: '£249', size: 'Up to 250 people', items: ['Everything in Growth', 'Advanced reporting', 'Role permissions'] },
  { name: 'Enterprise', price: 'Custom', size: '250 people and above', items: ['Custom team size', 'Dedicated support', 'Custom security policies'] },
]
function Mark() { return <span className="rs-mark" aria-hidden="true"><i /><i /></span> }
function Icon({ type = 'document' }: { type?: 'document' | 'check' | 'arrow' | 'capture' }) {
  const paths = { document: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h5', check: 'M4 12l5 5L20 5', arrow: 'M4 12h16 M14 6l6 6-6 6', capture: 'M12 3v12 M8 11l4 4 4-4 M4 16v5h16v-5' }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} /></svg>
}
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`rs-reveal ${className}`} data-rs-reveal>{children}</div> }
function Eclipse() {
  return <svg className="rs-eclipse" viewBox="0 0 1200 750" aria-hidden="true"><defs>
    <linearGradient id="rs-rim" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#EAF2FE" /><stop offset=".12" stopColor="#2F80ED" /><stop offset=".55" stopColor="#102A43" /><stop offset="1" stopColor="#102A43" stopOpacity="0" /></linearGradient>
    <radialGradient id="rs-glass"><stop stopColor="#EAF2FE" stopOpacity=".5" /><stop offset=".58" stopColor="#2F80ED" stopOpacity=".3" /><stop offset="1" stopColor="#102A43" stopOpacity="0" /></radialGradient>
    <linearGradient id="rs-outline" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#EAF2FE" stopOpacity=".9" /><stop offset=".3" stopColor="#2F80ED" stopOpacity=".45" /><stop offset=".7" stopColor="#102A43" stopOpacity="0" /></linearGradient>
    <filter id="rs-bloom"><feGaussianBlur stdDeviation="24" /></filter>
  </defs><ellipse cx="600" cy="330" rx="420" ry="225" fill="#2F80ED" opacity=".25" filter="url(#rs-bloom)" /><path d="M60 650C60 260 280 35 600 35s540 225 540 615H1040c0-330-180-515-440-515S160 320 160 650Z" fill="url(#rs-rim)" /><path d="M60 650C60 260 280 35 600 35s540 225 540 615" fill="none" stroke="url(#rs-outline)" strokeWidth="3" /><path d="M160 650c0-330 180-515 440-515s440 185 440 515" fill="none" stroke="url(#rs-outline)" strokeWidth="3" /><ellipse cx="600" cy="200" rx="380" ry="180" fill="url(#rs-glass)" opacity=".55" /></svg>
}
function RecordVisual({ compact = false }: { compact?: boolean }) {
  return <div className={`rs-record${compact ? ' rs-record-compact' : ''}`} aria-label="An outline of the information a role record contains">
    <div className="rs-record-nav"><span className="rs-record-brand"><Mark />vimbre</span><div><span className="rs-record-active">Role record</span><span>Decisions</span><span>My day</span><span>Handovers</span></div><Icon type="document" /></div>
    <div className="rs-record-body"><div className="rs-record-heading"><div><small>THE CONTEXT BEHIND THE WORK</small><h3>Your role. The full picture.</h3></div><span className="rs-record-tag">One shared record</span></div>
      <div className="rs-record-columns"><div className="rs-knowledge"><span className="rs-record-label">ROLE KNOWLEDGE</span>{['Responsibilities', 'Workstreams', 'External contacts', 'Documents', 'Recurring deadlines'].map((label, i) => <div className="rs-knowledge-row" key={label}><span className="rs-knowledge-icon"><Icon type={i === 4 ? 'check' : 'document'} /></span><span>{label}</span><span className="rs-row-arrow">↗</span></div>)}</div><div className="rs-context"><div className="rs-decision-card"><span className="rs-record-label">THE DECISION LOG</span><div className="rs-field"><span>What was decided</span><i /></div><div className="rs-field"><span>The reason behind it</span><i /></div><div className="rs-field"><span>The source</span><i /></div><div className="rs-record-note"><Icon type="check" />People confirm. AI drafts.</div></div><div className="rs-next-card"><Icon type="arrow" /><div><strong>What comes first</strong><p>A clear start for the person stepping in</p></div></div></div></div>
    </div><div className="rs-record-bottom">The record your other tools miss<span>Decisions · Reasons · Next steps</span></div>
  </div>
}
function DocumentArt({ kind = 'document' }: { kind?: 'document' | 'check' | 'arrow' | 'capture' }) {
  return <div className="rs-document-art" aria-hidden="true"><div className="rs-art-orbit" /><div className="rs-art-orbit rs-art-orbit-inner" /><div className="rs-art-paper rs-art-back" /><div className="rs-art-paper"><Icon type={kind} /><i /><i /><i /></div><span className="rs-art-star">✦</span></div>
}

export function HomePage() {
  const { profile } = useAuth()
  const root = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return localStorage.getItem('vimbre-public-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' } })
  useEffect(() => { try { localStorage.setItem('vimbre-public-theme', theme) } catch { /* Storage is optional. */ } }, [theme])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('rs-visible'); observer.unobserve(entry.target) } }), { threshold: .08 })
    root.current?.querySelectorAll('[data-rs-reveal]').forEach(el => { el.classList.add('rs-pending'); observer.observe(el) })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); root.current?.querySelector<HTMLButtonElement>('.rs-menu')?.focus() } }
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close)
  }, [menuOpen])
  const to = profile ? '/app' : '/signup'
  const cta = profile ? 'Open workspace' : 'Create your company'
  return <div className="rs-site" ref={root} data-theme={theme}>
    <a className="skip-link" href="#rs-main">Skip to content</a>
    <header className="rs-header"><div className="rs-container rs-header-inner"><Link className="rs-brand" to="/" aria-label="Vimbre home"><Mark />vimbre</Link><nav id="rs-navigation" className={menuOpen ? 'rs-nav rs-nav-open' : 'rs-nav'} aria-label="Public"><a href="#features" onClick={() => setMenuOpen(false)}>Features</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a><a href="#questions" onClick={() => setMenuOpen(false)}>Questions</a></nav><div className="rs-header-actions"><button className="rs-theme" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀' : '☾'}</button><Link className="rs-login" to={profile ? '/app' : '/login'}>{profile ? 'Workspace' : 'Log in'}</Link><Link className="rs-button rs-header-cta" to={to}>{profile ? 'Open workspace' : 'Get started'}<Icon type="arrow" /></Link><button className="rs-menu" type="button" aria-label={menuOpen ? 'Close website menu' : 'Open website menu'} aria-expanded={menuOpen} aria-controls="rs-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button></div></div></header>
    <main id="rs-main">
      <section className="rs-hero"><div className="rs-hero-copy"><span className="rs-pill"><span>The record</span> your other tools miss <span aria-hidden="true">›</span></span><h1 tabIndex={-1}>Stop losing what<br />your team already decided</h1><p>Keep the decisions, reasons and role knowledge<br className="rs-desktop-break" /> the next person needs.</p><div className="rs-actions"><a className="rs-button rs-button-soft" href="#features">See how it works<Icon type="arrow" /></a><Link className="rs-button" to={to}>{cta}<Icon type="arrow" /></Link></div></div><div className="rs-hero-art rs-container"><Eclipse /><Reveal className="rs-showcase"><RecordVisual /></Reveal></div><div className="rs-source-strip rs-container"><p>Works next to the tools you already use.</p><div><span><Icon type="capture" />Emails</span><span><Icon />Meeting notes</span><span><Icon />Documents</span><span><Icon type="arrow" />The next step</span></div></div></section>

      <section className="rs-container rs-bento-section" id="features"><Reveal className="rs-section-intro"><h2>Decisions get made.<br />Then they disappear.</h2><p>Give the context a place to stay.</p></Reveal><div className="rs-bento">
        <Reveal className="rs-tile rs-tile-record"><h3>Keep the role record</h3><p>The knowledge behind a role,<br />kept in one place.</p><div className="rs-mini-rows" aria-hidden="true"><span><i />Responsibilities <b>↗</b></span><span><i />Contacts and documents <b>↗</b></span><span><i />What comes first <b>↗</b></span></div></Reveal>
        <Reveal className="rs-tile rs-tile-decision"><h3>Keep the reason</h3><p>What was decided.<br />Why it was decided.</p><div className="rs-mini-decision" aria-hidden="true"><span>THE DECISION</span><i /><i /><div><Icon type="arrow" />The reason stays with it</div></div></Reveal>
        <Reveal className="rs-tile rs-tile-handover"><DocumentArt kind="arrow" /><div><h3>Hand over with context</h3><p>Give the next person<br />the full picture.</p></div></Reveal>
        <Reveal className="rs-tile rs-tile-capture"><div><h3>Capture from everyday work</h3><p>Bring in notes, emails or files.<br />Review the draft. Confirm the facts.</p></div><div className="rs-capture-diagram" aria-hidden="true"><span><Icon type="capture" /></span><i /><span><Icon /></span><i /><span><Icon type="check" /></span></div></Reveal>
      </div></section>

      <section id="how-it-works" className="rs-container rs-explain"><Reveal className="rs-section-intro"><h2>What Vimbre does</h2><p>The record behind the work.<br />The context behind the handover.</p></Reveal><div className="rs-feature-row"><Reveal className="rs-feature-copy"><span className="rs-eyebrow">THE RECORD</span><h3>The work makes sense.<br />Even when someone is away.</h3><p>Keep the decisions, reasons and useful details the next person needs to pick things up.</p><a className="rs-text-link" href="#pricing">Find your plan <Icon type="arrow" /></a><ul><li><Icon type="check" />Responsibilities and workstreams</li><li><Icon type="check" />Decisions with their source</li><li><Icon type="check" />Contacts, documents and deadlines</li></ul></Reveal><Reveal className="rs-feature-art"><div className="rs-art-caption"><span className="rs-square-icon"><Icon /></span><div><strong>The role record</strong><p>More than a list of tasks.</p></div></div><DocumentArt kind="check" /></Reveal></div><div className="rs-feature-row rs-row-reverse"><Reveal className="rs-feature-copy"><span className="rs-eyebrow">THE HANDOVER</span><h3>What it saves you</h3><p>Less searching. Less repeating.<br />A clearer place to start.</p><Link className="rs-text-link" to={to}>{cta}<Icon type="arrow" /></Link><ul><li><Icon type="check" />Prepare what comes first</li><li><Icon type="check" />Review and approve the handover</li><li><Icon type="check" />Give the cover person the context</li></ul></Reveal><Reveal className="rs-feature-art rs-handover-art"><div className="rs-art-caption"><span className="rs-square-icon"><Icon type="arrow" /></span><div><strong>Ready for the next person</strong><p>The context stays with the work.</p></div></div><DocumentArt kind="arrow" /></Reveal></div></section>

      <section id="pricing" className="rs-container rs-pricing-section"><Reveal className="rs-section-intro"><h2>Pricing for your team</h2><p>Company plans. Clear team sizes.</p></Reveal><div className="rs-pricing">{plans.map((plan, index) => <Reveal className={`rs-plan${index === 1 ? ' rs-plan-featured' : ''}`} key={plan.name}><div className="rs-plan-price">{plan.price}<span>{plan.price === 'Custom' ? 'Tailored to your company' : 'per company / month'}</span></div><h3>{plan.name}</h3><p>{plan.size}</p><Link className={index === 1 ? 'rs-button' : 'rs-button rs-button-soft'} to={to}>{cta}<Icon type="arrow" /></Link><ul>{plan.items.map(item => <li key={item}><Icon type="check" />{item}</li>)}</ul></Reveal>)}</div></section>

      <section className="rs-container rs-faq" id="questions"><Reveal className="rs-section-intro"><h2>A few things to know</h2></Reveal><div className="rs-faq-list"><details><summary>Does it replace our work tools?</summary><p>No. Your team keeps its work tools. Vimbre holds the decisions and role knowledge beside them.</p></details><details><summary>Does AI save things without my approval?</summary><p>No. AI drafts. A person reviews and confirms before anything becomes part of the record.</p></details><details><summary>How does my team join?</summary><p>Your company’s HR Admin invites teammates into the same workspace by email.</p></details><details><summary>Who can see my records?</summary><p>You see your own records. Managers can read their department’s work, and HR Admins can read company records.</p></details></div></section>

      <section className="rs-container rs-final"><Reveal className="rs-final-frame"><div><span className="rs-eyebrow">KEEP THE CONTEXT</span><h2>Start with your next<br />email or meeting.</h2><p>The record your other tools miss.</p><Link className="rs-button" to={to}>{cta}<Icon type="arrow" /></Link></div><div className="rs-final-visual"><RecordVisual compact /></div></Reveal></section>
    </main><footer className="rs-footer">© 2026 Vimbre. All rights reserved.</footer>
  </div>
}
