import type { RefObject } from 'react'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { ProductWalkthroughScreen } from './ProductWalkthroughScreen'
import { storySummary } from './landing-content'

/** An illustrative, isolated preview. It never reads an inbox or submits app data. */
export function HeroStory({ rootRef, paused, ready, toggle }: {
  rootRef: RefObject<HTMLDivElement | null>
  paused: boolean
  ready: boolean
  toggle: () => void
}) {
 return <div className="rs-hero-visual"><div ref={rootRef} className="rs-story-shell rs-signature rf-current-hero">
  <div className="rs-story-stage" aria-hidden="true" inert><div className="rs-demo-window">
   <div className="rs-demo-bar"><BrandLogo/><small className="rs-example">Product walkthrough</small></div>
   <div className="rs-demo-viewport rs-signature-viewport">
    {['email','draft','confirmed','cover'].map((scene,step)=><div key={scene} className="rs-demo-scene" data-scene={scene}><ProductWalkthroughScreen step={step}/></div>)}
   </div>
  </div></div>
  <p className="sr-only">{storySummary}</p><button className="rs-story-control" type="button" disabled={!ready} aria-label={paused?'Play hero story':'Pause hero story'} onClick={toggle}>{paused?'Play':'Pause'}</button>
 </div></div>
}
