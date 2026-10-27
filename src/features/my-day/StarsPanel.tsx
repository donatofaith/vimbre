import {useEffect,useState} from 'react'
import {starsDisclosure} from './star-rules'
import {supabase} from '../../lib/supabase'
type Stars={mode:string;visible:boolean;today:number;week:number;history:{points:number;reason:string;created_at:string}[];ranking:{id:string;full_name:string;stars:number}[]}
export function StarsPanel({compact=false}:{compact?:boolean}){
 const [data,setData]=useState<Stars|null>(null),[error,setError]=useState(false)
 useEffect(()=>{let live=true;async function load(){const r=await supabase.rpc('myday_stars',{});if(live){if(r.error)setError(true);else{setError(false);setData(r.data as unknown as Stars)}}}void load();window.addEventListener('vimbre:work-changed',load);return()=>{live=false;window.removeEventListener('vimbre:work-changed',load)}},[])
 if(error)return compact?null:<p role="alert">Stars could not be loaded.</p>
 if(!data)return compact?null:<p role="status">Loading stars…</p>
 if(compact)return data.mode==='off'?null:<div className="md-stars-strip" aria-label="Stars today"><strong>{data.today} stars today</strong><span>{data.week} this week</span></div>
 const level=data.week>=60?'Anchor':data.week>=40?'Trusted':data.week>=25?'Sharp':data.week>=10?'Steady':'Starter'
 return <section className="md-stars-panel"><h2>Your stars</h2><p>{starsDisclosure}</p>{data.mode==='off'?<p>Competition is off for your company.</p>:<><p><strong>{data.week} stars this week · {level}</strong></p><p>Weekly totals reset on Monday. Up to 15 stars can be earned each day.</p><details><summary>How stars are measured</summary><p>A dated task must exist for ten minutes before completion. Credit is weighted by priority and estimated time. Approved cover tasks receive double credit. Repeated completion of the same task earns no additional stars, and Undo removes its award.</p><p>Stars cannot capture every kind of work. Splitting work into tasks must not be used to increase credit.</p></details>{data.visible?<><h3>Your team’s top three</h3>{data.ranking.length?<ol>{data.ranking.map(person=><li key={person.id}>{person.full_name} · {person.stars} stars</li>)}</ol>:<p>No opted-in team members have earned stars this week.</p>}</>:<p>You are hidden from rankings. You can change this in Settings.</p>}<h3>Your recent stars</h3>{data.history.length?<ul>{data.history.map((award,index)=><li key={`${award.created_at}:${index}`}>+{award.points} · {award.reason}</li>)}</ul>:<p>No stars earned yet.</p>}</>}</section>
}
