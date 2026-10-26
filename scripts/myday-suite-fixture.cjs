// Browser-only stateful suite fixture. No live accounts or provider calls.
const {randomUUID}=require('node:crypto');
module.exports=(user,tasks)=>{
 const state={settings:{language:'en-GB',date_style:'medium',work_start:'09:00',work_end:'17:00',quiet_start:'22:00',quiet_end:'08:00'},flags:Object.fromEntries(['ai','email','push','team','rules','templates','calendar'].map(k=>[k,true])),templates:[],rules:[],comments:[],incoming:[],waiting:[],notifications:[],repeats:{},calendar:false};
 function handle(a){const {p_operation:op,p_id:id,p_data:d={}}=a;const task=()=>{const t=tasks.find(t=>t.id===id);if(!t)throw Error('Unknown fixture task');return t};
 if(op==='overview')return {settings:state.settings,flags:state.flags,incoming:state.incoming,waiting:state.waiting,notifications:state.notifications,away:[],calendar_enabled:state.calendar};
 if(op==='notifications')return {rows:[],unread:0};
 if(op==='preferences'){Object.assign(state.settings,d);return {}};
 if(op==='company'){Object.assign(state.flags,d);return {}};
 if(op==='people'||op==='mention_people')return [{id:'33333333-3333-4333-8333-333333333333',name:'Sam Reviewer',role:'employee'}];
 if(op==='templates')return state.templates;
 if(op==='template_save'){let t=state.templates.find(t=>t.id===id);if(!t){t={id,owner_id:user.id};state.templates.push(t)}Object.assign(t,d);return id}
 if(op==='template_delete'){state.templates=state.templates.filter(t=>t.id!==id);return {}}
 if(op==='template_use'){const t=state.templates.find(t=>t.id===id);tasks.push({...tasks[0],id:d.task_id,title:t.title,...t.data,due_date:d.due_date||null,deleted_at:null,status:'open'});return d.task_id}
 if(op==='rules')return state.rules;
 if(op==='rule_save'){state.rules.push({id,owner_id:user.id,...d});return id}
 if(op==='rule_delete'){state.rules=state.rules.filter(r=>r.id!==id);return {}}
 if(op==='task_extra')return {repeat:state.repeats[id]||null,assignment:null,files:[],decisions:[]};
 if(op==='repeat'){state.repeats[id]=d.stop?null:{id,...d,next_date:'2026-10-28'};return {}}
 if(op==='comments')return {task:{id,title:task().title,status:task().status,due_date:task().due_date},rows:state.comments.filter(c=>c.task_id===id)};
 if(op==='comment_save'){const existing=state.comments.find(c=>c.id===d.id);if(existing)Object.assign(existing,d);else state.comments.push({...d,task_id:id,author_id:user.id,author:'Alex Example',created_at:new Date().toISOString()});return {}}
 if(op==='comment_delete'){state.comments=state.comments.filter(c=>c.id!==d.id);return {}}
 if(op==='team')return [];
 if(op==='calendar'){state.calendar=!d.revoke;return d.revoke?{}:{token:'a'.repeat(64)}}
 if(op==='batch'){for(const row of tasks.filter(t=>d.ids.includes(t.id))){if(d.operation==='done')row.status='done';if(d.operation==='delete')row.deleted_at=new Date().toISOString();if(d.operation==='tomorrow')row.due_date='2026-10-23'}return {}}
 if(op==='accept'){const a=state.incoming.find(a=>a.id===id);tasks.push({...tasks[0],id:randomUUID(),title:a.title,status:'open',deleted_at:null});state.incoming=state.incoming.filter(a=>a.id!==id);return {}}
 if(op==='decline'){state.incoming=state.incoming.filter(a=>a.id!==id);return {}}
 if(op==='suggest_date'){state.incoming.find(a=>a.id===id).suggested_date=d.date;return {}}
 if(op==='assign'){state.waiting.push({id,...d,status:'pending',recipient_name:'Alex Example'});return id}
 if(op==='import'){for(const row of d.rows)tasks.push({...tasks[0],...row,id:randomUUID(),deleted_at:null,status:'open'});return {added:d.rows.length,duplicates:0}}
 if(op==='ai_cache_get')return null;
 if(op==='ai_source')return {tasks:tasks.filter(t=>t.status!=='done'&&!t.deleted_at).map(({id,title})=>({id,title}))};
 return {};
 }
 return {state,handle}
}
