import type { RefObject } from 'react'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { record, storySummary } from './landing-content'

export function HeroStory({ rootRef, paused, ready, toggle }: {
  rootRef: RefObject<HTMLDivElement | null>
  paused: boolean
  ready: boolean
  toggle: () => void
}) {
  return <div className="rs-hero-visual">
    <div ref={rootRef} className="rs-story-shell">
      <div className="rs-story-stage" aria-hidden="true">
        <small className="rs-example rs-story-example">Example</small>
        <div className="rs-story-main">
          <div className="rs-story-sources">{['Meeting notes', 'Supplier email', 'Daily notes'].map((label, i) => <div className={`rs-story-source ${i === 2 ? 'rs-daily-source' : ''}`} key={label} data-story-source>
            <span className="rs-source-title">{i === 1 ? <svg viewBox="0 0 24 24"><path d="M3 5h18v14H3zM3 5l9 8 9-8" /></svg> : <WorkspaceIcon name="record" />}{label}</span>
            <span className="rs-skeleton-lines"><i /><i /></span>
            <small className="rs-story-chip" data-story-chip>{['Decision', 'Owner', 'Next step'][i]}</small>
          </div>)}</div>
          <div className="rs-story-connections">
            <svg className="rs-story-paths" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
              {[100 / 6, 50, 500 / 6].map(y => <path key={y} d={`M0 ${y} C60 ${y},40 50,100 50`} vectorEffect="non-scaling-stroke" />)}
            </svg>
            {[100 / 6, 50, 500 / 6].map((y, i) => <i className="rs-story-dot" data-story-dot data-dot-index={i} key={y} style={{ top: `calc(${y}% - 3px)` }} />)}
          </div>
          <div className="rs-record rs-story-record" data-story-record>
            <div className="rs-record-bar"><span><WorkspaceIcon name="record" />Decision record</span></div>
            <dl>{record.map(([label, value]) => <div key={label} className={label === 'Why' ? 'rs-why-row' : ''} data-story-row><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <div className="rs-story-ring" data-story-ring />
          </div>
        </div>
        <div className="rs-story-people">
          <div className="rs-story-person rs-story-sam" data-story-sam><span className="rs-avatar">S</span><span>Sam<small>Away this week</small></span></div>
          <div className="rs-story-person rs-story-alex" data-story-alex><i className="rs-story-cover-link" data-story-line /><span className="rs-avatar rs-avatar-blue">A</span><span>Alex, covering</span><div className="rs-alex-panel"><span>Open work</span><i /><span>Recent decisions</span><i /></div></div>
        </div>
        <p className="rs-story-resolution" data-story-resolution>Nothing lost.</p>
      </div>
      <p className="sr-only">{storySummary}</p>
      <button className="rs-story-control" type="button" disabled={!ready} aria-label={paused ? 'Play hero story' : 'Pause hero story'} onClick={toggle}><svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="m9 5 10 7-10 7z" /> : <path d="M8 5v14M16 5v14" />}</svg>{paused ? 'Play' : 'Pause'}</button>
    </div>
  </div>
}
