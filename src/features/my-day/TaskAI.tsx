import {loadPlan} from './plan-api'
import type {PlanSource} from './plan-api'
import {ScheduledPlan} from './ScheduledPlan'
import {AllowanceLine} from './AllowanceLine'
import {useState} from 'react'
import {Button} from '../../components/ui/Button'
import {RoleDrawer} from '../records/RoleDrawer'
import {runAI} from '../../lib/ai-gateway'
import {daySuite,sourceHash,suiteError} from './suite-api'
import type {Task} from './types'
import {parsePlan} from './plan-output'
import type {PlanItem} from './plan-output'
export function PlanMyDay({close,aiEnabled=true}:{close:()=>void;aiEnabled?:boolean}){
 const [basic,setBasic]=useState(!aiEnabled),[source,setSource]=useState<PlanSource|undefined>(),[rows,setRows]=useState<PlanItem[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function plan(){setBusy(true);setError('');try{const input=await loadPlan(true);setSource(input);if(!input.tasks.length)throw Error('No open tasks to plan. Add a task first.');const text=JSON.stringify({today:input.today,timezone:input.timezone,working_hours:{end:input.end},busy:input.busy,tasks:input.tasks}),hash=await sourceHash(text),previous=await daySuite<string|null>('ai_cache_get',null,{kind:'day_plan',fingerprint:hash});let output=previous;if(!output){const r=await runAI('day_plan',text);if(!r.ok)throw Error(r.message);output=r.text}const proposed=parsePlan(output,new Set(input.tasks.map(t=>t.id)));if(!previous)await daySuite('ai_cache_save',null,{kind:'day_plan',fingerprint:hash,output});setRows(proposed)}catch(e){setError((e as Error).message||suiteError(e))}finally{setBusy(false)}}
 if(basic||rows)return <ScheduledPlan close={close} suggestions={rows??undefined} source={source}/>
 return <RoleDrawer context="My day" title="Plan my day" close={close}><div className="md-task-panel"><h2>Plan my day</h2><AllowanceLine/><p>Review the proposed order, times and reasons before using the plan.</p><Button loading={busy} onClick={()=>void plan()}>Suggest today’s plan</Button><Button variant="secondary" disabled={busy} onClick={()=>setBasic(true)}>Build a basic plan</Button>{error&&<p className="field-error" role="alert">{error} You can build a basic plan without AI.</p>}</div></RoleDrawer>
}
export function TaskAI({task}:{task:Task}){
 const [output,setOutput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[cached,setCached]=useState(false)
 return <section><AllowanceLine/><Button variant="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const source=await daySuite<string|null>('ai_source',task.id,{kind:'conversation_summary'});if(!source)throw Error('No captured conversation is available for this task.');const fingerprint=await sourceHash(source),prior=await daySuite<string|null>('ai_cache_get',null,{kind:'conversation_summary',fingerprint});setCached(Boolean(prior));if(prior)setOutput(prior);else{const r=await runAI('conversation_summary',source);if(!r.ok)throw Error(r.message);setOutput(r.text);await daySuite('ai_cache_save',null,{kind:'conversation_summary',fingerprint,output:r.text})}}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>{busy?'Summarising…':'Summarise this conversation'}</Button>{output&&<div className="md-ai-summary"><h3>Conversation summary</h3><p className="record-text">{output}</p>{cached&&<span className="md-muted">Cached summary · No additional AI request</span>}</div>}{error&&<p className="field-error" role="alert">{error}</p>}</section>
}
