import type {CSSProperties} from 'react'
import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {trackMarketing} from './marketing-analytics'
import './animated-cta.css'

const stages=[
 {label:'Tasks',path:'M9 5h10v16H5V5h4m0-2h6v4H9zM8 12l2 2 4-4M8 18h8'},
 {label:'Decisions',path:'M6 3v7m0 4v7m12-14v14M6 10c0 5 12-3 12 4M3 3h6m6 4h6M3 21h6m6 0h6'},
 {label:'Handover',path:'M13 3H5v18h14V9l-6-6Zm0 0v6h6M8 13h7m-7 4h5'},
]
export function AnimatedCTA({to='/signup',authenticated=false}:{to?:string;authenticated?:boolean}){
 const section=useRef<HTMLElement>(null)
 const [motionAllowed,setMotionAllowed]=useState(false),[paused,setPaused]=useState(false)
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)')
  let visible=false
  const sync=()=>setMotionAllowed(visible&&!document.hidden&&!media.matches)
  const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);sync()},{threshold:.2})
  if(section.current)observer.observe(section.current)
  media.addEventListener('change',sync)
  document.addEventListener('visibilitychange',sync)
  return()=>{observer.disconnect();media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync)}
 },[])
 return <section ref={section} className="rs-section vimbre-cta" data-moving={motionAllowed&&!paused} aria-labelledby="closing-cta-title">
  <div className="rs-container"><div className="vimbre-cta-shell">
   <div className="vimbre-cta-copy"><h2 id="closing-cta-title">Start with your first conversation.</h2><p>Review suggested tasks, plan your day and prepare your handover.</p></div>
   <div className="vimbre-cta-visual">
    {motionAllowed&&<button className="vimbre-cta-pause" type="button" onClick={()=>setPaused(value=>!value)} aria-label={paused?'Play animation':'Pause animation'} title={paused?'Play animation':'Pause animation'}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{paused?<path d="m9 5 11 7-11 7z"/>:<path d="M9 5v14M15 5v14"/>}</svg></button>}
    <div className="vimbre-cta-story" role="img" aria-label="Conversations organised into tasks, decisions and a handover.">
     <div className="vimbre-cta-source"><div className="vimbre-cta-source-face"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 4h18v13H9l-6 4V4Zm4 5h10M7 13h6"/></svg><span>Conversation</span><i/><i/></div></div>
     <div className="vimbre-cta-flow"><i/></div>
     <div className="vimbre-cta-results">{stages.map((stage,index)=><div className="vimbre-cta-result" key={stage.label} style={{'--stage':index} as CSSProperties}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={stage.path}/></svg><span>{stage.label}</span><div className="vimbre-cta-record-lines"><i/><i/></div></div>)}</div>
    </div>
   </div>
   <div className="vimbre-cta-action"><Link className="rs-button" to={to} onClick={()=>trackMarketing('cta_click',{location:'final'})}>{authenticated?'Go to workspace':'Get started'}<span aria-hidden="true">→</span></Link>{!authenticated&&<small>no card required</small>}</div>
  </div></div>
 </section>
}
