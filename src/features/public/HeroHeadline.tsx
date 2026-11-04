import {headline} from './public-content'
import {walkthrough} from './walkthrough.config'
export function HeroHeadline({index=0}:{index?:number}){return <h1 id="hero-title" tabIndex={-1}><span className="sr-only">{headline}</span><span aria-hidden="true" className="rf-headline-fixed">Declutter your</span><span aria-hidden="true" className="rf-rotating-word"><span key={index}>{walkthrough[index].title.toLowerCase()}.</span></span></h1>}
