import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {Button} from '../../components/ui/Button'
import {changeTask,taskError} from './api'
import type {Task} from './types'
type Plan={timezone:string;tasks:Task[];plan:{items:{id:string;start:string;minutes:number;reason:string}[]}|null}
export function NextPlannedTask({replan,onPlan}:{replan:()=>void;onPlan:(exists:boolean)=>void}){
 const [data,setData]=useState<Plan|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[focus,setFocus]=useState(false),[started,setStarted]=useState<{id:string;at:number}|null>(null),[clock,setClock]=useState(Date.now())
 useEffect(()=>{let live=true;async function load(){const r=await supabase.rpc('myday_plan',{p_operation:'get'});if(live&&!r.error&&r.data&&typeof r.data==='object'&&!Array.isArray(r.data)&&Array.isArray(r.data.tasks)&&typeof r.data.timezone==='string'){setData(r.data as unknown as Plan);onPlan(Boolean(r.data.plan))}}void load();window.addEventListener('vimbre:work-changed',load);return()=>{live=false;window.removeEventListener('vimbre:work-changed',load)}},[onPlan])
 const next=data?.plan?.items?.find(item=>data.tasks.some(task=>task.id===item.id));const task=data?.tasks?.find(t=>t.id===next?.id)
 const timerStart=task?.status==='in_progress'&&started?.id===task.id?started.at:null
 useEffect(()=>{if(timerStart===null)return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[timerStart])
 if(!next||!task||!data)return null
 const remaining=Math.max(0,next.minutes*60-Math.floor((clock-(timerStart??clock))/1000)),timerText=`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`
 async function act(status:string){if(!task)return;setBusy(true);setError('');try{await changeTask(task.id,'status',{status});if(status==='in_progress'){setStarted({id:task.id,at:Date.now()});setClock(Date.now())}}catch(e){setError(taskError(e))}finally{setBusy(false)}}
 return <section className={`md-next-plan ${focus?'md-plan-focus':''}`}><h2>Next at {new Intl.DateTimeFormat('en-GB',{timeStyle:'short',timeZone:data.timezone}).format(new Date(next.start))}: {task.title}</h2><p>{next.minutes} min · {next.reason}</p><>{timerStart!==null&&<p className="md-focus-timer" aria-label="Focus timer">{timerText}</p>}</><div className="form-actions"><Button disabled={busy||task.status==='in_progress'} onClick={()=>void act('in_progress')}>Start</Button><Button variant="secondary" disabled={busy} onClick={()=>void act('done')}>Done</Button><Button variant="secondary" onClick={replan}>Replan from now</Button><label className="checkbox-line"><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)}/>Focus on this task</label></div>{error&&<p role="alert" className="field-error">{error}</p>}</section>
}
