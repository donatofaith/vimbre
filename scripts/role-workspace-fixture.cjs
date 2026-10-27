// Stateful owner/manager fixture. Provider calls and all persistence are intercepted.
module.exports=function roleFixture(user){
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const state={role:{id,title:'Operations lead',holder_id:user.id,manager_id:null,cover_id:null},holder:'Record Owner',department:'Operations',manager:'Sam Manager',cover:null,own:true,can_suggest:false,can_reassign:false,can_review:false,can_manage_templates:true,flags:{},items:[],decisions:[],notes:'',note_entries:[],outcomes:[],history:[],task_stats:[],incoming:[],templates:[],areas:[],proposals:[],people:[],failRead:false,failSave:false,writes:[],cache:{},summary:''};
 const exportRole=()=>({title:state.role.title,holder:state.holder,department:state.department,summary:state.summary,items:state.items.filter(r=>!r.deleted_at&&!r.is_private&&r.include_in_handover!==false).map(r=>({kind:r.kind,title:r.title,fields:r.role_fields,reviewed_at:r.reviewed_at})),decisions:state.decisions.filter(r=>!r.deleted_at&&r.status==='live'&&!r.is_private&&r.include_in_handover!==false).map(r=>({kind:'decision',title:r.title,fields:r.role_fields,reviewed_at:r.reviewed_at})),notes:state.note_entries.filter(n=>n.include_in_handover).map(n=>({body:n.body}))});
 return {state,handle(args){const op=args.p_operation,d=args.p_data||{};
 if(op==='notices')return [];
 if(op==='upcoming')return {deadlines:[],review:false};
 if(op==='own_records')return {items:state.items,decisions:state.decisions};
 if(op==='task_choices')return state.items.filter(i=>i.kind==='responsibility');
 if(op==='get'){if(state.failRead)throw Error('Test read failure');return {...state,...(!state.own?{note_entries:[],outcomes:[],items:state.items.filter(r=>!r.is_private&&r.include_in_handover!==false)}:{})};}
 if(op==='list')return [{id,title:state.role.title,holder:state.holder,own:state.own}];
 if(op==='preview')return exportRole();
 if(op==='linked_tasks')return [];
 if(op==='guides')return [];
 if(op==='suggestions')return {work:[],contacts:[]};
 if(op==='summary_source')return {source:'Confirmed supplier reviews',fingerprint:'fixture-summary',cached:state.cache.summary||null};
 if(op==='summary_cache'){state.cache.summary=d.output;return {};}
 if(op==='ai_source')return {source:'Confirmed supplier reviews',fingerprint:'fixture-'+d.kind,cached:state.cache[d.kind]||null};
 if(op==='ai_cache'){state.cache[d.kind]=d.output;return {};}
 if(state.failSave)throw Error('Test save failure');state.writes.push({op,data:d});
 if(op==='summary_save')state.summary=d.body;
 if(op==='note_save'){let n=state.note_entries.find(n=>n.id===d.id);if(!n){n={id:d.id};state.note_entries.push(n)}Object.assign(n,d);return {id:d.id};}
 if(op==='note_remove')state.note_entries=state.note_entries.filter(n=>n.id!==d.id);
 if(op==='profile')Object.assign(state.role,d);
 if(op==='save'||op==='replace'){const rows=d.kind==='decision'?state.decisions:state.items;const old=rows.find(r=>r.id===d.id);let row=op==='save'?old:null;if(!row){row={id:require('node:crypto').randomUUID(),kind:d.kind==='decision'?undefined:d.kind,status:'live',deleted_at:null,reviewed_at:new Date().toISOString(),version:1};rows.unshift(row)}Object.assign(row,d.fields,{title:d.title,role_fields:d.fields,include_in_handover:d.include_in_handover??true,is_private:d.is_private??false});if(op==='replace'){old.status='replaced';old.replaced_by_id=row.id;row.replaces_id=old.id}return {id:row.id};}
 if(op==='archive'){const row=[...state.items,...state.decisions].find(r=>r.id===d.id);row.deleted_at=d.restore?null:new Date().toISOString();}
 if(op==='review'){const row=[...state.items,...state.decisions].find(r=>r.id===d.id);row.reviewed_at=new Date().toISOString();}
 if(op==='handover')return {body:JSON.stringify(exportRole())};
 return {};
 }};
};
