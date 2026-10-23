// Stateful browser fixture; all network calls remain intercepted.
module.exports=function roleFixture(user){
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const state={role:{id,title:'Operations lead',holder_id:user.id,manager_id:null,cover_id:null},holder:'Record Owner',department:'Operations',manager:'Sam Manager',cover:null,own:true,can_suggest:false,can_reassign:false,flags:{},items:[],decisions:[],notes:'',areas:[],proposals:[],people:[],failRead:false,failSave:false,writes:[],cache:{}};
 return {state,handle(args){const op=args.p_operation,d=args.p_data||{};
 if(op==='upcoming')return {deadlines:[],review:false};
 if(op==='own_records')return {items:state.items,decisions:state.decisions};
 if(op==='task_choices')return state.items.filter(i=>i.kind==='responsibility');
 if(op==='list')return [{id,title:state.role.title,holder:state.holder,own:state.own}];
 if(op==='get'){if(state.failRead)throw Error('Test read failure');return state;}
 if(op==='ai_source')return {source:'Confirmed supplier reviews',fingerprint:'fixture-'+d.kind,cached:state.cache[d.kind]||null};
 if(op==='ai_cache'){state.cache[d.kind]=d.output;return {};}
 if(state.failSave)throw Error('Test save failure');state.writes.push({op,data:d});
 if(op==='notes')state.notes=d.body;
 if(op==='profile')Object.assign(state.role,d);
 if(op==='save'||op==='replace'){const rows=d.kind==='decision'?state.decisions:state.items;const old=rows.find(r=>r.id===d.id);let row=op==='save'?old:null;if(!row){row={id:require('node:crypto').randomUUID(),kind:d.kind==='decision'?undefined:d.kind,status:'live',deleted_at:null,reviewed_at:new Date().toISOString()};rows.unshift(row)}Object.assign(row,d.fields,{title:d.title,role_fields:d.fields});if(op==='replace'){old.status='replaced';old.replaced_by_id=row.id;row.replaces_id=old.id}return {id:row.id};}
 if(op==='archive'){const row=[...state.items,...state.decisions].find(r=>r.id===d.id);row.deleted_at=d.restore?null:new Date().toISOString();}
 if(op==='review')return {};
 if(op==='handover')return {body:[...state.items,...state.decisions.filter(d=>d.status==='live')].map(r=>r.title).join('\n')+'\n'+state.notes};
 return {};
 }};
};
