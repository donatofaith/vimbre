import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PublicHeader } from './PublicHeader'
import './landing.css'

const features = [
  { title: 'Keep the role record', text: 'Responsibilities, workstreams, useful contacts, document links and recurring deadlines. The context behind a role, kept together.' },
  { title: 'Keep the reason', text: 'Record what was decided, why, who decided and the source. Give the next person more than the final answer.' },
  { title: 'Bring your team in', text: 'One company workspace for your team. Set up departments when you need them and give each person the right access.' },
  { title: 'Capture from everyday work', text: 'Forward an email, paste notes or upload a file. Review the AI draft before adding decisions and actions to the record.' },
  { title: 'Hand over with context', text: 'Prepare the record, get approval and give the person covering you a clear place to start.' },
  { title: 'Know what to do next', text: 'Keep actions with due dates and decision links. See what needs attention and leave a note when the work is done.' },
]
const featureIcons = [
  'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h6',
  'M9 4h6v4H9z M9 6H5v15h14V6h-4 M8 14l3 3 5-6',
  'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 4a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-3.9 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  'M12 3v12 M8 11l4 4 4-4 M4 16v5h16v-5',
  'M3 7h12 M11 3l4 4-4 4 M21 17H9 M13 13l-4 4 4 4',
  'M9 11l3 3L22 4 M21 12v8H3V2h13',
]
function Icon({ index }: { index: number }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={featureIcons[index]} /></svg>
}

export function HomePage() {
  const { profile } = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('vimbre-public-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  useEffect(() => { try { localStorage.setItem('vimbre-public-theme', theme) } catch { /* The toggle also works without browser storage. */ } }, [theme])
  const workspacePath = profile ? '/app' : '/signup'
  const workspaceLabel = profile ? 'Open your workspace' : 'Create your company'

  return <div className="public-page landing-page" data-theme={theme}>
    <a className="skip-link" href="#public-main">Skip to content</a>
    <PublicHeader theme={theme} onToggleTheme={() => setTheme(value => value === 'light' ? 'dark' : 'light')} />
    <main id="public-main">
      <section className="hero landing-hero">
        <div className="hero-copy">
          <span className="eyebrow hero-label">The record your other tools miss</span>
          <h1 tabIndex={-1}>Stop losing what your team already decided</h1>
          <p className="hero-description">When someone is away, joins or moves on, the work should still make sense. Keep the decisions, reasons and role knowledge the next person needs.</p>
          <div className="form-actions"><Link className="button button-primary" to={workspacePath}>{workspaceLabel}<span aria-hidden="true">↗</span></Link><a className="button button-secondary" href="#how-it-works">See how it works<span aria-hidden="true">↓</span></a></div>
          <p className="hero-compatibility">Works next to the tools you already use.</p>
          <p className="account-prompt">{profile ? <Link to="/app">Return to your workspace</Link> : <>Already have an account? <Link to="/login">Log in</Link></>}</p>
        </div>
        <aside className="record-stage" aria-label="How Vimbre keeps role context together">
          <div className="source-strip"><span><Icon index={3} />Emails</span><span><Icon index={1} />Meeting notes</span><span><Icon index={0} />Documents</span></div>
          <div className="record-connector" aria-hidden="true"><span />↓<span /></div>
          <div className="record-outline">
            <div className="record-topline"><span className="eyebrow">The role record</span><span className="record-symbol" aria-hidden="true">↗</span></div>
            <h2>A role is more than a list of tasks.</h2>
            <ul>
              <li><span className="record-icon"><Icon index={0} /></span><div><strong>What the role does</strong><p>Responsibilities and workstreams</p></div></li>
              <li><span className="record-icon"><Icon index={1} /></span><div><strong>What was decided</strong><p>The reason, the person and the source</p></div></li>
              <li><span className="record-icon"><Icon index={5} /></span><div><strong>What someone needs</strong><p>Contacts, documents and deadlines</p></div></li>
            </ul>
            <div className="record-caption"><span aria-hidden="true">◎</span> The context stays with the work</div>
          </div>
          <div className="record-bottom"><span aria-hidden="true">↳</span> Ready for the next person</div>
        </aside>
      </section>

      <div className="context-ribbon" aria-label="The context Vimbre keeps"><span>The decision.</span><span>The reason.</span><span>The next step.</span><p>One record to come back to.</p></div>

      <section className="landing-section problem-section">
        <div><span className="eyebrow">Sound familiar?</span><h2>Decisions get made. Then they disappear.</h2></div>
        <div className="problem-copy"><p>The reason is in an email. The contact is in someone’s head. The deadline is in a different tool. When that person is away, the next person has to piece it together.</p><p>Vimbre gives that context a place to live beside the tools your team already uses.</p></div>
      </section>

      <section id="how-it-works" className="landing-section">
        <div className="section-intro"><span className="eyebrow">How it works</span><h2>A clear place to start</h2><p>Bring the context in. Confirm what matters. Keep the next step visible.</p></div>
        <ol className="public-steps">
          <li><span className="step-number" aria-hidden="true">01</span><h3>Bring in the work</h3><p>Forward an email, paste meeting notes or upload a document. Keep the source beside the record.</p></li>
          <li><span className="step-number" aria-hidden="true">02</span><h3>Keep what matters</h3><p>Review the draft decisions and actions. Confirm the facts and keep the reasons that explain them.</p></li>
          <li><span className="step-number" aria-hidden="true">03</span><h3>Give context to the next person</h3><p>Build the role record as work happens. Use it to prepare a handover when someone needs to step in.</p></li>
        </ol>
      </section>

      <section id="features" className="landing-section product-section">
        <div className="section-intro"><span className="eyebrow">The record behind the work</span><h2>What Vimbre does</h2><p>From the first note to the next handover, keep the work understandable.</p></div>
        <div className="feature-grid">{features.map((feature, index) => <article className={`card feature-card feature-card-${index}`} key={feature.title}>
          <span className="feature-icon"><Icon index={index} /></span><h3>{feature.title}</h3><p>{feature.text}</p>
          {index === 0 && <div className="record-map" aria-hidden="true"><span>Responsibilities</span><span>Workstreams</span><span>External contacts</span><span>Documents</span><span>Deadlines</span></div>}
        </article>)}</div>
      </section>

      <section className="landing-section handover-section">
        <div className="handover-copy"><span className="eyebrow">When someone needs to step in</span><h2>The person changes.<br />The context stays.</h2><p>A handover should explain more than what is left to do. Give the next person the decisions, the reasons and what comes first.</p><a className="text-link" href="#questions">A few things to know <span aria-hidden="true">↗</span></a></div>
        <ol className="handover-flow"><li><span className="handover-icon"><Icon index={0} /></span><div><strong>Prepare the record</strong><p>What matters and what comes first</p></div></li><li><span className="handover-icon"><Icon index={1} /></span><div><strong>Review and approve</strong><p>A clear record for the person covering</p></div></li><li><span className="handover-icon"><Icon index={4} /></span><div><strong>Pick up with context</strong><p>The next person knows where to start</p></div></li></ol>
      </section>

      <section className="landing-section benefits-section">
        <div><span className="eyebrow">Less starting from scratch</span><h2>What it saves you</h2><p>Less searching through old threads. Less repeating the same explanation. A place to check what happened and why before asking someone to start again.</p><ul className="benefit-list"><li>Find the reason behind a decision</li><li>Keep role knowledge in one place</li><li>See the next action and its due date</li></ul></div>
        <div className="benefit-detail"><span className="eyebrow">Built around your team</span><h3>A shared record.<br />The right access.</h3><dl className="role-access"><div><dt>Employees</dt><dd>Keep their role knowledge and actions</dd></div><div><dt>Managers</dt><dd>Read the record across their department</dd></div><div><dt>HR Admins</dt><dd>Manage people and see the company record</dd></div></dl><p>Start without departments, or group your people as your company grows.</p></div>
      </section>

      <section id="questions" className="landing-section faq-section"><div className="faq-intro"><span className="eyebrow">A little clarity</span><h2>A few things to know</h2><p>Understand where Vimbre fits before you bring your team in.</p></div><div className="faq-list">
        <details><summary>Does Vimbre replace our work tools?</summary><p>No. Your team keeps using its work tools. Vimbre holds the role knowledge, decisions and context beside them.</p></details>
        <details><summary>Does AI save things without my approval?</summary><p>No. AI drafts decisions and actions from the material you bring in. A person reviews and confirms them before they become part of the record.</p></details>
        <details><summary>Who can see my records?</summary><p>You can see your own records. Managers can read records in their department. Your company’s HR Admin can read company records. Each company has its own workspace.</p></details>
        <details><summary>How do teammates join?</summary><p>Your company’s HR Admin invites them by email. They accept the invitation to join your existing company. They do not need to create a separate company.</p></details>
        <details><summary>Do we need departments?</summary><p>No. Small teams can start without departments and add them when they are needed.</p></details>
      </div></section>

      <section className="landing-section landing-cta"><span className="eyebrow">Keep the next person in the picture</span><h2>Start with your next email or meeting.</h2><p>Give the decisions, reasons and role knowledge a place to stay.</p><Link className="button button-primary" to={workspacePath}>{workspaceLabel}<span aria-hidden="true">↗</span></Link></section>
    </main>
    <footer className="public-footer"><small>© 2026 Vimbre. All rights reserved.</small></footer>
  </div>
}
