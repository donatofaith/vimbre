import type {Task} from './types'
export type BusySlot={start:number;end:number}
export type ScheduledTask={id:string;start:number;minutes:number;reason:string}
export function basicPlan(tasks:Task[],{start,end,busy=[],today,order=[]}:{start:number;end:number;busy?:BusySlot[];today:string;order?:string[]}){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return {slots:[],skipped:tasks.filter(t=>t.status!=='done'&&!t.deleted_at&&!t.missed_at)}
 const open=tasks.filter(t=>t.status!=='done'&&!t.deleted_at&&!t.missed_at)
 const sorted=[...open].sort((a,b)=>{
  if(order.length){const ai=order.indexOf(a.id),bi=order.indexOf(b.id);const delta=(ai<0?999:ai)-(bi<0?999:bi);if(delta)return delta}
  const due=(t:Task)=>t.due_date??'9999-12-31'
  const overdue=(t:Task)=>due(t)<today?0:due(t)===today?1:2
  return overdue(a)-overdue(b)||due(a).localeCompare(due(b))||(a.due_time??'23:59:59').localeCompare(b.due_time??'23:59:59')||({high:0,normal:1,low:2}[a.priority??'normal']-({high:0,normal:1,low:2}[b.priority??'normal']))||(a.created_at??'').localeCompare(b.created_at??'')||a.id.localeCompare(b.id)
 })
 const slots:ScheduledTask[]=[];const skipped:Task[]=[];let cursor=start
 for(const task of sorted){
  const minutes=Math.max(10,Math.min(480,Number.isFinite(task.time_needed_minutes)?task.time_needed_minutes!:30));let at=cursor
  for(const block of [...busy].filter(b=>b.end>b.start).sort((a,b)=>a.start-b.start))if(at<block.end&&at+minutes*60000>block.start)at=block.end+10*60000
  if(slots.length>=6||at+minutes*60000>end){skipped.push(task);continue}
  slots.push({id:task.id,start:at,minutes,reason:task.due_date&&task.due_date<today?'Overdue task.':task.due_date===today?'Due today.':task.priority==='high'?'High priority.':'Next open task.'});cursor=at+(minutes+10)*60000
 }
 return {slots,skipped}
}
