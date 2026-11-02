import {useState,type ReactNode} from 'react'
function read(key:string){try{return sessionStorage.getItem(key)==='closed'}catch{return false}}
export function DailySection({owner,day,name,title,actions,children}:{owner:string;day:string;name:string;title:string;actions?:ReactNode;children:ReactNode}){
 const key=`vimbre:daily-panel:${owner}:${day}:${name}`
 const [choice,setChoice]=useState(()=>({key,closed:read(key)}))
 const closed=choice.key===key?choice.closed:read(key)
 function toggle(){setChoice({key,closed:!closed});try{sessionStorage.setItem(key,closed?'open':'closed')}catch{/* The panel still works without storage. */}}
 return <div className="daily-section"><div className="daily-heading"><h2>{title}</h2><div className="daily-section-actions">{!closed&&actions}<button type="button"className="daily-panel-toggle"aria-label={`${closed?'Show':'Close'} ${title.toLowerCase()}`}aria-expanded={!closed}onClick={toggle}>{closed?'Show':'Close'}</button></div></div><div hidden={closed}>{children}</div></div>
}
