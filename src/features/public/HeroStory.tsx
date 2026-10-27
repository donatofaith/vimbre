import type { RefObject } from 'react'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { record, storySummary } from './landing-content'

function DecisionFields({ animated = false }: { animated?: boolean }) {
  return <dl className="rs-demo-fields">{record.map(([label, value]) => <div key={label} data-draft-row={animated || undefined}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
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
                    <p className="rs-demo-page-label">Bring it in</p><Card className="rs-demo-email"><span className="rs-demo-overline"><WorkspaceIcon name="record" />Operations Manager · Email thread</span><h3>Supplier reviews are moving to monthly</h3><p>Move supplier reviews to monthly.</p><p>To reduce meeting load and focus on key updates.</p></Card><Button className="rs-demo-capture-button" tabIndex={-1}>Bring in an email or notes<WorkspaceIcon name="arrow" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="capture">
                    <p className="rs-demo-page-label">Bring it in</p><Card className="rs-demo-paste"><span className="rs-demo-overline">Supplier review conversation · 9 Nov 2026</span><p>Move supplier reviews to <mark><span>monthly</span><i data-phrase /></mark>.</p><p>To <mark><span>reduce meeting load</span><i data-phrase /></mark> and focus on key updates.</p><p>Owner: <mark><span>Alex</span><i data-phrase /></mark></p><p>Next step: <mark><span>share the notes by 12 Nov 2026</span><i data-phrase /></mark>.</p></Card><Button className="rs-demo-review rs-demo-next" tabIndex={-1}>Draft with Vimbre AI<WorkspaceIcon name="arrow" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="draft">
                    <p className="rs-demo-page-label">Vimbre AI drafts</p><div className="rs-demo-ai-label"><span>Draft suggestions. Check before saving.</span></div><Card className="rs-demo-decision"><DecisionFields animated /><Button className="rs-demo-save" tabIndex={-1}>Check suggestions<WorkspaceIcon name="tick" /></Button></Card>
                  </div>
                  <div className="rs-demo-scene" data-scene="confirmed">
                    <p className="rs-demo-page-label">You check</p><Card className="rs-demo-decision"><DecisionFields /></Card><Button className="rs-demo-role rs-demo-next" tabIndex={-1}>Confirm reviewed records<WorkspaceIcon name="arrow" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="saved">
                    <p className="rs-demo-page-label">Handover</p><Card className="rs-demo-decision"><DecisionFields /></Card><Button className="rs-demo-handovers rs-demo-next" tabIndex={-1}>Prepare handover<WorkspaceIcon name="arrow" /></Button>
                  </div>
                  <div className="rs-demo-scene" data-scene="away">
                    <p className="rs-demo-page-label">Handover prepared</p><Card className="rs-demo-away"><span className="rs-avatar">S</span><strong>Sam</strong><span>Away 9 to 16 November 2026</span><span className="button button-primary rs-demo-cover-button">View cover<WorkspaceIcon name="arrow" /></span></Card>
                  </div>
                  <div className="rs-demo-scene rs-demo-cover" data-scene="cover">
                    <div className="rs-demo-cover-header"><span className="rs-avatar rs-avatar-blue">A</span><p className="rs-demo-page-label">Alex, covering for Sam</p></div>
                    <div className="rs-demo-cover-grid">
                      <Card data-cover-row><h3>Open work</h3><p>Share the review notes · 12 Nov 2026</p></Card>
                      <Card data-cover-row className="rs-demo-recent"><h3>What comes first <small>Example</small></h3><p>Move supplier reviews to monthly</p><div className="rs-demo-why"><i data-cover-highlight /><strong>Why</strong><p>To reduce meeting load and focus on key updates</p></div></Card>
                      <Card data-cover-row><h3>People to know</h3><p>Alex, Operations</p></Card>
                      <Card data-cover-row><h3>Coming deadlines</h3><p>Supplier review · 12 Nov 2026</p></Card>
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
