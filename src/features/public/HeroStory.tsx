import type { RefObject } from 'react'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { record, storySummary } from './landing-content'

function DecisionFields({ animated = false }: { animated?: boolean }) {
  return <dl className="rs-demo-fields">{record.map(([label, value]) => <div key={label} data-draft-row={animated || undefined}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

/** A decorative, isolated preview. It never reads an inbox or submits app data. */
export function HeroStory({ rootRef, paused, ready, toggle }: {
  rootRef: RefObject<HTMLDivElement | null>
  paused: boolean
  ready: boolean
  toggle: () => void
}) {
  return <div className="rs-hero-visual">
    <div ref={rootRef} className="rs-story-shell">
      <div className="rs-story-stage" aria-hidden="true">
        <div className="rs-demo-depth">
          <div className="rs-demo-window">
            <div className="rs-demo-bar"><BrandLogo /><small className="rs-example">Example</small></div>
            <div className="rs-demo-layout">
              <div className="rs-demo-sidebar">{[['home', 'My day'], ['capture', 'Capture'], ['record', 'My role']].map(([icon, label]) => <span key={label} className={label === 'Capture' ? 'rs-demo-selected' : ''}><WorkspaceIcon name={icon} />{label}{label === 'Capture' && <i data-capture-dot />}</span>)}</div>
              <div className="rs-demo-viewport">
                <div className="rs-demo-camera">
                  <div className="rs-demo-scene" data-scene="email">
                    <p className="rs-demo-page-label">My day</p>
                    <Card className="rs-demo-email"><span className="rs-demo-overline"><WorkspaceIcon name="record" />Operations Manager</span><h3>Supplier reviews are moving to monthly</h3><p>Move supplier reviews to monthly.</p><p>To reduce meeting load and focus on key updates.</p></Card>
                    <Button className="rs-demo-capture-button" tabIndex={-1}>Capture an email or notes<WorkspaceIcon name="arrow" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="capture">
                    <p className="rs-demo-page-label">Add an email or notes</p>
                    <Card className="rs-demo-paste"><span className="rs-demo-overline">Supplier reviews are moving to monthly</span><p>Move supplier reviews to <mark><span>monthly</span><i data-phrase /></mark>.</p><p>To <mark><span>reduce meeting load</span><i data-phrase /></mark> and focus on key updates.</p><p>Owner: <mark><span>Operations</span><i data-phrase /></mark></p><p>Next step: <mark><span>share the notes</span><i data-phrase /></mark>.</p></Card>
                  </div>
                  <div className="rs-demo-scene" data-scene="draft">
                    <p className="rs-demo-page-label">Review drafts</p>
                    <div className="rs-demo-ai-label"><span>Draft from Vimbre AI. Check before saving.</span><small>Coming soon</small></div>
                    <Card className="rs-demo-decision"><DecisionFields animated /><Button className="rs-demo-save" tabIndex={-1}>Save<WorkspaceIcon name="tick" /></Button></Card>
                  </div>
                  <div className="rs-demo-scene" data-scene="saved">
                    <p className="rs-demo-page-label">Operations role record</p>
                    <Card className="rs-demo-decision"><DecisionFields /></Card>
                    <div className="rs-demo-toast" data-save-toast><WorkspaceIcon name="tick" /><span>Decision saved to the Operations role record.</span></div>
                  </div>
                  <div className="rs-demo-scene" data-scene="away">
                    <p className="rs-demo-page-label">My handovers</p>
                    <Card className="rs-demo-away"><span className="rs-avatar">S</span><strong>Sam</strong><span>Away 20 to 27 October</span></Card>
                  </div>
                  <div className="rs-demo-scene rs-demo-cover" data-scene="cover">
                    <div className="rs-demo-cover-header"><span className="rs-avatar rs-avatar-blue">A</span><p className="rs-demo-page-label">Alex, covering for Sam</p></div>
                    <div className="rs-demo-cover-grid">
                      <Card data-cover-row><h3>Open work</h3><p>Share the review notes</p></Card>
                      <Card data-cover-row className="rs-demo-recent"><h3>Recent decisions <small>New</small></h3><p>Move supplier reviews to monthly</p><div className="rs-demo-why"><strong>Why</strong><p>To reduce meeting load and focus on key updates</p></div></Card>
                      <Card data-cover-row><h3>People to know</h3><p>Alex, Operations</p></Card>
                      <Card data-cover-row><h3>Coming deadlines</h3><p>Supplier review, 12 October</p></Card>
                    </div>
                  </div>
                </div>
                <svg className="rs-demo-cursor" data-demo-cursor viewBox="0 0 20 24"><path d="m3 2 13 12-6 1-3 6z" /></svg>
                <span className="rs-demo-click rs-demo-click-capture" data-click-capture />
                <span className="rs-demo-click rs-demo-click-save" data-click-save />
              </div>
            </div>
          </div>
        </div>
        <p className="rs-story-resolution" data-story-resolution>Nothing lost.</p>
      </div>
      <p className="sr-only">{storySummary}</p>
      <button className="rs-story-control" type="button" disabled={!ready} aria-label={paused ? 'Play hero story' : 'Pause hero story'} onClick={toggle}><svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="m9 5 10 7-10 7z" /> : <path d="M8 5v14M16 5v14" />}</svg>{paused ? 'Play' : 'Pause'}</button>
    </div>
  </div>
}
