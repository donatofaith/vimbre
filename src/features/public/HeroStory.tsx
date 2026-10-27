import type { RefObject } from 'react'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { record, storySummary } from './landing-content'

function DecisionFields() {
  return <dl className="rs-demo-fields">{record.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

function DraftActions() {
  const actions = [
    ['Share the review notes', 'Alex', '12 Nov 2026'],
    ['Schedule the monthly supplier review', 'Sam', '16 Nov 2026'],
    ['Update the supplier review agenda', 'Alex', '20 Nov 2026'],
  ]
  return <ul className="rs-demo-action-list">{actions.map(([title, owner, due]) => <li className="rs-demo-action-row" key={title} data-draft-row>
    <span className="rs-demo-action-check" aria-hidden="true">✓</span><div><strong>{title}</strong><p>Owner: {owner} · Due: {due}</p></div>
  </li>)}</ul>
}

/** An illustrative, isolated preview. It never reads an inbox or submits app data. */
export function HeroStory({ rootRef, paused, ready, toggle }: {
  rootRef: RefObject<HTMLDivElement | null>
  paused: boolean
  ready: boolean
  toggle: () => void
}) {
  return <div className="rs-hero-visual">
    <div ref={rootRef} className="rs-story-shell">
      <div className="rs-story-stage" aria-hidden="true" inert>
        <div className="rs-demo-depth">
          <div className="rs-demo-window">
            <div className="rs-demo-bar"><BrandLogo /><small className="rs-example">Example</small></div>
            <div className="rs-demo-layout">
              <div className="rs-demo-sidebar">{[['home', 'My day'], ['capture', 'Capture'], ['record', 'My role']].map(([icon, label]) => <span key={label} className={label === 'Capture' ? 'rs-demo-selected' : ''}><WorkspaceIcon name={icon} />{label}{label === 'Capture' && <i data-capture-dot />}</span>)}</div>
              <div className="rs-demo-viewport">
                <div className="rs-demo-camera">
                  <div className="rs-demo-scene" data-scene="email">
                    <p className="rs-demo-page-label">Bring it in</p>
                    <Card className="rs-demo-email">
                      <span className="rs-demo-overline"><WorkspaceIcon name="email" />RE: Monthly supplier reviews · 6 replies</span>
                      <h3>Re: Changing supplier review cadence</h3>
                      <p><strong>Alex:</strong> Could we move supplier reviews to monthly?</p>
                      <p><strong>Sam:</strong> Yes. I will schedule the first monthly review for 16 Nov.</p>
                      <p><strong>Alex:</strong> I will share the notes by 12 Nov and update the agenda by 20 Nov.</p>
                    </Card>
                    <Button className="rs-demo-capture-button" tabIndex={-1}>Bring in an email or notes<WorkspaceIcon name="arrow" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="capture">
                    <p className="rs-demo-page-label">Bring it in</p>
                    <Card className="rs-demo-paste">
                      <span className="rs-demo-overline">Supplier review conversation · 9 Nov 2026</span>
                      <p>Move supplier reviews to <mark><span>monthly</span><i data-phrase /></mark>.</p>
                      <p>To <mark><span>reduce meeting load</span><i data-phrase /></mark> and focus on key updates.</p>
                      <p>Owner: <mark><span>Alex</span><i data-phrase /></mark> · Due: <mark><span>12 Nov 2026</span><i data-phrase /></mark></p>
                      <p>Sam: <mark><span>schedule first monthly review by 16 Nov 2026</span><i data-phrase /></mark>.</p>
                      <p>Alex: <mark><span>update the agenda by 20 Nov 2026</span><i data-phrase /></mark>.</p>
                    </Card>
                    <Button className="rs-demo-review rs-demo-next" tabIndex={-1}>Draft with Vimbre AI<WorkspaceIcon name="arrow" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="draft">
                    <p className="rs-demo-page-label">Vimbre AI drafts</p>
                    <div className="rs-demo-ai-label"><span>Three action suggestions. Check before saving.</span></div>
                    <Card className="rs-demo-decision">
                      <DraftActions />
                      <Button className="rs-demo-save" tabIndex={-1}>Check before saving<WorkspaceIcon name="tick" /></Button>
                    </Card>
                  </div>
                  <div className="rs-demo-scene" data-scene="confirmed">
                    <p className="rs-demo-page-label">You check</p>
                    <Card className="rs-demo-decision"><DecisionFields /></Card>
                    <Button className="rs-demo-role rs-demo-next" tabIndex={-1}>Confirm reviewed records<WorkspaceIcon name="tick" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="saved">
                    <p className="rs-demo-page-label">Handover</p>
                    <Card className="rs-demo-decision"><DecisionFields /></Card>
                    <Button className="rs-demo-handovers rs-demo-next" tabIndex={-1}>Prepare handover<WorkspaceIcon name="arrow" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="away">
                    <p className="rs-demo-page-label">Handover prepared</p>
                    <Card className="rs-demo-away"><span className="rs-avatar">S</span><strong>Sam</strong><span>Away 9 to 16 November 2026</span><span className="button button-primary rs-demo-cover-button">View cover<WorkspaceIcon name="arrow" /></span></Card>
                  </div>
                  <div className="rs-demo-scene rs-demo-cover" data-scene="cover">
                    <div className="rs-demo-cover-header"><span className="rs-avatar rs-avatar-blue">A</span><div><p className="rs-demo-page-label">Alex, covering for Sam</p><h3 className="rs-demo-cover-title">What comes first</h3></div></div>
                    <div className="rs-demo-cover-grid">
                      <Card data-cover-row><h3>12 Nov · First</h3><p>Share the review notes</p><small>Owner: Alex</small></Card>
                      <Card data-cover-row><h3>16 Nov 2026</h3><p>Schedule the monthly supplier review</p><small>Owner: Sam</small></Card>
                      <Card data-cover-row><h3>20 Nov 2026</h3><p>Update the supplier review agenda</p><small>Owner: Alex</small></Card>
                      <Card data-cover-row><h3>Decision and reason</h3><p>Supplier reviews move to monthly</p><div className="rs-demo-why"><i data-cover-highlight /><strong>Why</strong><p>To reduce meeting load and focus on key updates</p></div></Card>
                    </div>
                  </div>
                </div>
              </div>
              <svg className="rs-demo-cursor" data-demo-cursor viewBox="0 0 20 24"><path d="m3 2 13 12-6 1-3 6z" /></svg>
              {['capture', 'review', 'save', 'role', 'handovers', 'cover'].map(step => <span key={step} className="rs-demo-click" data-demo-click={step} />)}
            </div>
          </div>
        </div>
        <p className="rs-story-resolution" data-story-resolution>What comes first</p>
      </div>
      <p className="sr-only">{storySummary}</p>
      <button className="rs-story-control" type="button" disabled={!ready} aria-label={paused ? 'Play hero story' : 'Pause hero story'} onClick={toggle}><svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="m9 5 10 7-10 7z" /> : <path d="M8 5v14M16 5v14" />}</svg>{paused ? 'Play' : 'Pause'}</button>
    </div>
  </div>
}
