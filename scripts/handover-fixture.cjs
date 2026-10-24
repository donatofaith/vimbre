const {randomUUID}=require('node:crypto');
module.exports=function(user,person){
const state={rows:[],viewer:user.id,flags:{},failSave:false,failRead:false,notifications:[],history:[],role:{id:randomUUID(),holder_id:user.id,title:'Operations lead',manager_id:person.id,cover_id:person.id},writes:[],people:[{id:person.id,name:person.full_name,reviewer:true}],tasks:[{id:randomUUID(),title:'Send report',due_date:'2026-10-24'}],decisions:[{id:randomUUID(),title:'Keep monthly reviews'}]};
return {state,handle(args){const op=args.p_operation,d=args.p_data||{},id=args.p_id;let row=state.rows.find(r=>r.id===id);if(op==='notifications')return {count:0,rows:[]};if(op==='list'){if(state.failRead)throw Error('Test read failure');return {rows:state.rows,flags:state.flags}}
if(op==='options')return {role:state.role,people:state.people,roles:[{id:state.role.id,owner:user.id,title:'Operations lead',name:'Alex Example'}],tasks:state.tasks,decisions:state.decisions};
if(op==='get')return {handover:row,history:state.history};
if(op==='populate')return {summary:'Operations handover',priorities:d.priorities||'',watch_outs:d.watch_outs||'',work:'Review supplier reports weekly.',tasks:state.tasks.filter(t=>row.items.some(i=>i.id===t.id)).map(t=>t.title).join('\n'),decisions:state.decisions.filter(t=>row.items.some(i=>i.id===t.id)).map(t=>t.title).join('\n'),notes:d.inclusions?.includes('notes')?'Shared role notes.':''};
if(state.failSave)throw Error('Test save failure');state.writes.push({op,id,data:d});
if(op==='save'){if(!row){row={id,owner_id:user.id,created_by:user.id,owner_name:'Alex Example',cover_name:person.full_name,reviewer_name:person.full_name,status:'draft',display_status:'draft',version:0};state.rows.unshift(row)}Object.assign(row,d,{version:row.version+1,structured:true});row.cover_name=state.people.find(p=>p.id===d.cover_id)?.name||null;row.reviewer_name=state.people.find(p=>p.id===d.reviewer_id)?.name||null;}
if(op==='submit'){row.status='pending';row.display_status='submitted'}
if(op==='approve'){row.status='approved';row.display_status='active';row.approved_at=new Date().toISOString()}
if(op==='request_changes'){row.status='declined';row.display_status='changes_requested';row.review_comment=d.comment}
if(op==='take_back'){row.status='completed';row.display_status='completed'}
if(op==='cancel'){row.status='cancelled';row.display_status='cancelled'}
if(op==='cover_task')row.items.find(i=>i.id===d.task).status='done';
state.history.push({version:row.version,operation:op,actor:'Alex Example',at:new Date().toISOString()});return row||{};
}};
};
