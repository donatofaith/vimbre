import {subscribeWorkspaceRefresh} from '../workspace/workspace-refresh'
import type {Json} from '../../lib/database.types'
import {useEffect, useRef, useState} from 'react'
import {DailySection} from './DailySection'
import {Button} from '../../components/ui/Button'
import {supabase} from '../../lib/supabase'
import {runAI} from '../../lib/ai-gateway'
import {trackContextGenerated} from '../../lib/analytics'
import {daySuite, sourceHash} from './suite-api'
import {parsePriorities} from './priority-output'
import {schedulePriorityForToday} from './schedule-priority'
import {refreshQueue} from './refresh-queue'
import {AllowanceLine} from './AllowanceLine'

type Row = {id:string; title:string; due_date:string|null; priority:string; reason:string; accepted:boolean}
type Review = {today:string; timezone:string; reviewed_at:string|null; items:Row[]; tasks?:{id:string}[]}
async function review(action='get', task:string|null=null, data:Record<string,unknown>={}):Promise<Review> {
 const result=await supabase.rpc('myday_priority_review',{p_action:action,p_task:task,p_data:data as Json})
 if(result.error)throw result.error
 const value=result.data as unknown as Review
 if(!value||!Array.isArray(value.items)||typeof value.today!=='string')throw Error('Priorities could not be loaded. Try again.')
 return value
}
export function DailyPriorities({owner,openTask}:{owner:string;openTask:(id:string,edit?:boolean)=>Promise<void>}) {
 const [data,setData]=useState<Review|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 const acting=useRef(false)
 useEffect(()=>{let live=true;setError('');const queue=refreshQueue(async()=>{try{const value=await review();if(live){setData(value);setError('')}}catch{if(live)setError('Priorities could not be refreshed. Try again.')}});void queue.run();const refresh=()=>{if(!document.hidden)queue.schedule()};const unsubscribe=subscribeWorkspaceRefresh(refresh);return()=>{live=false;queue.dispose();unsubscribe()}},[owner,revision])
 async function act(id:string,action:()=>Promise<void>){if(acting.current)return;acting.current=true;setBusy(id);setError('');try{await action()}catch(e){setError((e as {message?:string})?.message||'Your choice could not be saved. Try again.')}finally{acting.current=false;setBusy('')}}
 async function suggest(){
  const source=await review('source')
  if(!Array.isArray(source.tasks))throw Error('Tasks could not be loaded. Try again.')
  const text=JSON.stringify({purpose:'daily_priorities',today:source.today,timezone:source.timezone,tasks:source.tasks}),fingerprint=await sourceHash(text)
  let output=await daySuite<string|null>('ai_cache_get',null,{kind:'day_plan',fingerprint}),request=''
  if(!output&&source.tasks.length){const result=await runAI('day_plan',text);if(!result.ok)throw Error(result.message);output=result.text;request=result.request_id}
  const items=output?parsePriorities(output,new Set(source.tasks.map(t=>t.id))):[]
  if(request){trackContextGenerated('day_plan',request,'tasks');await daySuite('ai_cache_save',null,{kind:'day_plan',fingerprint,output})}
  setData(await review('save',null,{day:source.today,items}))
 }
 return <div className="daily-priorities"><DailySection owner={owner}day={data?.today??""}name="priorities"title="Priorities for today"actions={<Button disabled={Boolean(busy)||!data}onClick={()=>void act('ai',suggest)}>{busy==='ai'?'Reviewing tasks…':'Review priorities with AI'}</Button>}><AllowanceLine/>{data?.reviewed_at?<>{data.items.length?<ul className="daily-list">{data.items.map(t=><li key={t.id}><div><button type="button"className="daily-task-link"disabled={Boolean(busy)}onClick={()=>void act(t.id,()=>openTask(t.id))}>{t.title}</button><span className="md-priority-chip">{t.priority==='high'?'High':t.priority==='low'?'Low':'Normal'} priority</span><p>{t.reason}</p>{t.due_date&&<p>Due {t.due_date}</p>}</div><div className="daily-priority-actions"><Button disabled={Boolean(busy)||(t.accepted&&t.due_date===data.today)}onClick={()=>void act(t.id,async()=>{await schedulePriorityForToday(t.id,data.today);setData(await review())})}>{t.accepted&&t.due_date===data.today?'Accepted for today':'Accept for today'}</Button><Button variant="secondary"disabled={Boolean(busy)}onClick={()=>void act(t.id,async()=>setData(await review('reject',t.id,{day:data.today})))}>Reject</Button><Button variant="secondary"disabled={Boolean(busy)}onClick={()=>void act(t.id,()=>openTask(t.id,true))}>Change priority</Button></div></li>)}</ul>:<p>No priorities selected for today.</p>}</>:<p>{data?'Review your tasks to choose what needs attention today.':'Loading priorities…'}</p>}{error&&<p role="alert"className="field-error">{error} <Button variant="secondary"disabled={Boolean(busy)}onClick={()=>setRevision(n=>n+1)}>Retry</Button></p>}</DailySection></div>
}
