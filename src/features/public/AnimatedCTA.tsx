import type {CSSProperties} from 'react'
import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {trackMarketing} from './marketing-analytics'
import './animated-cta.css'
const records=[
 {label:'Task draft',title:'Review the revised quote',detail:'Alex · Due today',path:'M9 5h10v16H5V5h4m0-2h6v4H9zM8 12l2 2 4-4M8 18h8'},
 {label:'Decision draft',title:'Keep the current supplier',detail:'Check the reason before saving',path:'m5 12 4 4L19 6'},
 {label:'Handover',title:'Quote review still open',detail:'Include the task and its context',path:'M13 3H5v18h14V9l-6-6Zm0 0v6h6M8 13h7m-7 4h5'},
]
export function AnimatedCTA({to='/signup',authenticated=false}:{to?:string;authenticated?:boolean}){
 const section=useRef<HTMLElement>(null),[entered,setEntered]=useState(false)
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setEntered(true);observer.disconnect()}},{threshold:.2});if(section.current)observer.observe(section.current);return()=>observer.disconnect()},[])
 return <section ref={section}className="rs-section vimbre-cta"data-entered={entered}aria-labelledby="closing-cta-title"><div className="rs-container"><div className="vimbre-cta-shell">
  <div className="vimbre-cta-copy"><h2 id="closing-cta-title">Start with your first conversation.</h2><p>Review suggested tasks, plan your day and prepare your handover.</p></div>
  <div className="vimbre-cta-visual"aria-label="Example: a supplier conversation becomes drafts to review and context for a handover."><div className="vimbre-cta-source"><div className="vimbre-cta-example">Example conversation</div><div className="vimbre-cta-message"><span className="vimbre-cta-avatar"aria-hidden="true">JR</span><div><strong>Jamie Reed</strong><span>Supplier update</span></div></div><p>The revised quote is ready. Alex, please review it today. We agreed to keep the current supplier.</p></div><div className="vimbre-cta-flow"aria-hidden="true"><span>↓</span></div><div className="vimbre-cta-results">{records.map((record,index)=><div className="vimbre-cta-result"key={record.label}style={{'--stage':index}as CSSProperties}><svg viewBox="0 0 24 24"width="22"height="22"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round"aria-hidden="true"><path d={record.path}/></svg><div><span>{record.label}</span><strong>{record.title}</strong><small>{record.detail}</small></div></div>)}</div></div>
  <div className="vimbre-cta-action"><Link className="rs-button"to={to}onClick={()=>trackMarketing('cta_click',{location:'final'})}>{authenticated?'Go to workspace':'Get started'}<span aria-hidden="true">→</span></Link>{!authenticated&&<small>no card required</small>}</div>
 </div></div></section>
}
