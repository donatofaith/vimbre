import {useId,useState,type ReactNode} from 'react'
function read(key:string){try{return sessionStorage.getItem(key)==='closed'}catch{return false}}
export function DailySection({owner,day,name,title,actions,children}:{owner:string;day:string;name:string;title:string;actions?:ReactNode;children:ReactNode}){
 const content=useId(),key=`vimbre:daily-panel:${owner}:${day}:${name}`
 const [choice,setChoice]=useState(()=>({key,closed:read(key)}))
 const closed=choice.key===key?choice.closed:read(key)
 function toggle(){setChoice({key,closed:!closed});try{sessionStorage.setItem(key,closed?'open':'closed')}catch{/* The panel still works without storage. */}}
 return <div className="daily-section"><div className="daily-heading"><h2>{title}</h2><button type="button"className="daily-panel-toggle"aria-label={`${closed?'Show':'Hide'} ${title.toLowerCase()}`}aria-expanded={!closed}aria-controls={content}onClick={toggle}><span>{closed?'Show':'Hide'}</span><svg viewBox="0 0 20 20"width="18"height="18"fill="none"stroke="currentColor"strokeWidth="1.8"aria-hidden="true"><path d={closed?'m5 7 5 5 5-5':'m5 12 5-5 5 5'}/></svg></button></div><div id={content}hidden={closed}>{actions&&<div className="daily-section-actions">{actions}</div>}{children}</div></div>
}
