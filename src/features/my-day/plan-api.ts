import {supabase} from '../../lib/supabase'
import {trackTaskCompleted} from '../../lib/analytics'
import type {Task} from './types'
export type PlanTask=Task&{covering?:boolean;owner_name?:string;needs_reason?:boolean;decision_reason?:string;duration_source?:string}
export type PlanItem={id:string;start:string;minutes:number;reason:string;decision_reason?:string}
export type PlanSource={today:string;timezone:string;start:string;end:string;tasks:PlanTask[];completed?:{id:string;title:string}[];busy?:{start:string;end:string}[];calendar?:string;plan:{items:PlanItem[];replans:number}|null}
export async function loadPlan(syncCalendar=false):Promise<PlanSource>{
 let calendar='Working hours from Settings'
 if(syncCalendar){const r=await supabase.functions.invoke('capture-connect',{body:{action:'calendar_busy'}});if(r.error||!r.data?.ok)throw Error('Calendar availability could not be checked. Retry before planning.');if(r.data.connected)calendar='Connected calendar busy times'}
 const r=await supabase.rpc('myday_plan',{p_operation:'get'});if(r.error)throw r.error
 const data=r.data as unknown as PlanSource
 if(!Array.isArray(data?.tasks)||!Number.isFinite(Date.parse(data.start))||!Number.isFinite(Date.parse(data.end)))throw Error('Today’s plan could not be loaded. Try again.')
 return {...data,calendar}
}
export async function planTaskAction(task:string,operation:'start'|'done',reason?:string){
 const r=await supabase.rpc('myday_plan_action',{p_task:task,p_operation:operation,p_reason:reason??null});if(r.error)throw r.error
 if(operation==='done')trackTaskCompleted(task,'plan')
 window.dispatchEvent(new Event('vimbre:work-changed'))
}
