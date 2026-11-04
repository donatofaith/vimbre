/** Isolated, fictional public demo. All data operations use the in-memory adapter. */
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Routes,Route,Navigate} from 'react-router-dom'
import {AuthProvider,RequireAuth} from '../src/features/auth/AuthProvider'
import {AuthPage} from '../src/features/auth/AuthPage'
import {AppLayout} from '../src/app/layouts/AppLayout'
import {MyDayPage} from '../src/features/my-day/MyDayPage'
import {CapturePage} from '../src/features/capture/CapturePage'
import {RoleRecordPage} from '../src/features/records/RoleRecordPage'
import {HandoversPage} from '../src/features/handovers/HandoversPage'
import {WeeklySummaryPage} from '../src/features/my-day/WeeklySummaryPage'
import {supabase} from './client'
import '../src/styles/fonts.css'
import '../src/styles/tokens.css'
import '../src/styles/global.css'
import '../src/styles/polish.css'
import '../src/styles/action-colours.css'
import '../src/app/layouts/workspace.css'
import '../src/app/layouts/workspace-refinement.css'
import '../src/app/layouts/workspace-product.css'
const day=new Date().toISOString().slice(0,10),at=day+'T09:00:00Z'
const id='22222222-2222-4222-8222-222222222222',companyId='33333333-3333-4333-8333-333333333333',roleId='44444444-4444-4444-8444-444444444444',sourceId='88888888-8888-4888-8888-888888888888',handoverId='77777777-7777-4777-8777-777777777777'
const user={id,email:'alex@demo.invalid',email_confirmed_at:at,user_metadata:{full_name:'Alex Morgan',workspace_type:'company'}}
const profile={id,company_id:companyId,full_name:'Alex Morgan',role:'employee',active:true,email:user.email}
const company={id:companyId,name:'Demo workspace',created_by:'other',logo_path:null}
let session:any={user,access_token:'demo-only'}
const listeners=new Set<any>();const emit=()=>listeners.forEach(fn=>fn(session?'SIGNED_IN':'SIGNED_OUT',session))
supabase.auth.onAuthStateChange=((fn:any)=>{listeners.add(fn);queueMicrotask(()=>fn('INITIAL_SESSION',session));return{data:{subscription:{unsubscribe(){listeners.delete(fn)}}}}})as any
supabase.auth.getSession=async()=>({data:{session},error:null})as any
supabase.auth.getUser=async()=>({data:{user:session?user:null},error:null})as any
supabase.auth.signInWithPassword=(async({email,password}:any)=>{if(email!==user.email||password!=='demo-workspace-only')return{data:{session:null,user:null},error:{message:'Use the local Demo workspace account.'}};session={user,access_token:'demo-only'};sessionStorage.setItem('vimbre-demo-session','yes');emit();return{data:{session,user},error:null}})as any
supabase.auth.signOut=(async()=>{session=null;sessionStorage.removeItem('vimbre-demo-session');emit();return{error:null}})as any
supabase.from=((name:string)=>{let single=false;const chain:any=new Proxy({}, {get(_target,key){if(key==='then')return(resolve:any)=>resolve({data:single?(name==='profiles'?profile:company):[],error:null,count:0});if(key==='single'||key==='maybeSingle')return()=>{single=true;return chain};return()=>chain}});return chain})as any
supabase.channel=(()=>{const c:any={on:()=>c,subscribe:()=>c,unsubscribe:async()=>null};return c})as any;supabase.removeChannel=(async()=>null)as any
const tasks=['Confirm the supplier delivery slot','Send the launch checklist to Sam','Review the monthly supplier notes'].map((title,i)=>({id:`11111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`,title,details:['Confirm delivery before the launch.','Sam is covering the launch checklist.','Keep the monthly review decision with the notes.'][i],status:i===1?'in_progress':'open',priority:i===0?'high':'normal',due_date:day,due_at:day+'T16:00:00Z',due_time:'16:00',created_at:at,updated_at:at,source_kind:'manual',steps:[],links:[],reminder_option:'none',pinned_at:null,deleted_at:null}))
const decision={id:'55555555-5555-4555-8555-555555555555',kind:'decision',title:'Review suppliers monthly',status:'live',reviewed_at:at,updated_at:at,version:1,is_private:false,include_in_handover:true,role_fields:{reason:'Reduce meetings while keeping delivery risks visible.',decided_by:'Alex Morgan',decided_on:day,next_step:'Sam will share the review notes at month end.',importance:'Normal'}}
const contact={id:'66666666-6666-4666-8666-666666666666',kind:'external_contact',title:'Jamie Reed · Northline Supplies',status:'live',reviewed_at:at,updated_at:at,version:1,is_private:false,include_in_handover:true,role_fields:{organisation:'Northline Supplies',details:'Coordinates supplier deliveries for the launch.',contact_details:'jamie@northline.example',contact_context:'Ask Jamie to confirm the delivery slot.',importance:'Normal'}}
const role={role:{id:roleId,title:'Operations lead',holder_id:id,manager_id:'manager',cover_id:'cover'},holder:'Alex Morgan',department:'Operations',manager:'Sam Taylor',cover:'Jordan Ellis',own:true,can_suggest:false,can_review:false,can_reassign:false,can_manage_templates:false,flags:{},items:[contact,{...contact,id:'work-1',kind:'responsibility',title:'Keep supplier deliveries on schedule',role_fields:{details:'Confirm delivery dates and keep the team informed.',recurrence:'Weekly',importance:'High'}}],decisions:[decision],people:[],notes:'',note_entries:[],outcomes:[],history:[],task_stats:[],incoming:[],templates:[],areas:[],summary:'Operations lead for the launch. Confirm deliveries and keep supplier notes current.'}
const summary='Completed\nShared the launch checklist with Sam Taylor. Confirmed the current supplier for the launch.\n\nStill open\nConfirm the supplier delivery slot. Review the monthly supplier notes.\n\nWith teammates\nSam Taylor is checking the launch checklist. Jordan Ellis is preparing cover for the supplier review.\n\nDecisions and approvals\nReview suppliers monthly — agreed by Alex Morgan to reduce meetings while keeping delivery risks visible.\n\nUpcoming deadlines\nDelivery confirmation is due '+day+'.'
const handover={handover_type:'leave',cover_name:'Jordan Ellis',owner_name:'Alex Morgan',manager_name:'Sam Taylor',role_title:'Operations lead',sections:{priorities:'Confirm the supplier delivery slot first.',work:'Keep supplier delivery updates current.',summary:'Jordan covers supplier delivery updates.',tasks:'Confirm the supplier delivery slot.',decisions:'Review suppliers monthly.',contacts:'Jamie Reed · Northline Supplies',documents:'',dates:day,watch_outs:'Confirm the slot before the launch.',notes:''},inclusions:[],items:[],return_unknown:false,review_comment:'',changed_since_approval:false,approved_at:null,id:handoverId,title:'Supplier review cover',kind:'leave',status:'draft',role_id:roleId,owner_id:id,cover_id:'cover',manager_id:'manager',starts_on:day,ends_on:day,return_date:day,summary:'Jordan covers supplier delivery updates. Confirm the delivery slot first and keep the monthly review notes with the work.',created_at:at,updated_at:at,version:1}
const source={id:sourceId,title:'Supplier launch conversation',source_text:'Alex: Please confirm the supplier delivery slot today. Sam: I will check the launch checklist. We agreed to review suppliers monthly to reduce meetings and keep delivery risks visible.',source_date:day,source_type:'note',deleted_at:null,trashed_at:null,channel:'paste',status:'drafts_ready',draft_attempts:1}
const items=[{id:'draft-1',capture_id:sourceId,kind:'action',origin:'ai',status:'pending',version:1,payload:{title:tasks[0].title,details:tasks[0].details,owner_id:id,due_date:day,priority:'high',owner_reviewed:'false'}},{id:'draft-2',capture_id:sourceId,kind:'decision',origin:'ai',status:'pending',version:1,payload:{title:decision.title,...decision.role_fields,owner_id:id}}]
function response(data:any){const result:any=Promise.resolve({data,error:null});result.abortSignal=()=>result;return result}
supabase.rpc=((name:string,args:any={})=>{let data:any={rows:[],items:[],unread:0,count:0};const op=args.p_operation;
 if(name==='claim_signup_analytics')data=false;
 else if(name==='member_profile'||name==='member_heartbeat')data={id,company_id:companyId,full_name:profile.full_name,job_title:'Operations lead',presence:'active',availability:'active'};
 else if(name==='role_workspace')data=op==='get'?role:op==='list'?[{id:roleId,title:'Operations lead',holder:'Alex Morgan',own:true}]:op==='upcoming'?{deadlines:[],review:false}:op==='own_records'?{items:role.items,decisions:role.decisions}:op==='preview'?role:[];
 else if(name==='my_day_summary')data={pending_drafts:0,completed_sections:[],forwarding_address:null,task_counts:{today:3,overdue:0,open:3},today_count:3,overdue_count:0,review_count:0};
 else if(name==='myday_counts')data={today:3,open:3,week:3,all:3,overdue:0,done:0,archived:0};
 else if(name==='myday_tasks')data={rows:tasks,context_waiting:[],count:3,today:day,timezone:'Europe/London',counts:{today:3,todo:2,progress:1,overdue:0,done:0},tab_counts:{today:3,week:3,all:3,done:0,archived:0},overdue_rows:[],done_today:[],undated:[],upcoming:[],review_drafts:[],cover_tasks:[],covering:[],handovers_waiting:[]};
 else if(name==='myday_daily')data={today:day,day,timezone:'Europe/London',priorities:[],decisions:[],done:[],waiting:[],show_review:false};
 else if(name==='myday_priority_review')data={today:day,timezone:'Europe/London',items:[],tasks,reviewed_at:null};
 else if(name==='myday_suite')data=op==='overview'?{settings:{language:'en-GB',date_style:'medium'},flags:{},incoming:[],waiting:[],notifications:[],away:[],calendar_enabled:false}:op==='notifications'?{rows:[],unread:0}:op==='task_extra'?{repeat:null,assignment:null,files:[],decisions:[]}:[];
 else if(name==='myday_preferences')data={timezone:'Europe/London',working_days:[1,2,3,4,5],start_time:'09:00',end_time:'17:00'};
 else if(name==='myday_alerts'||name==='chat_inbox'||name==='chat_list')data=[];
 else if(name==='myday_plan')data={today:day,timezone:'Europe/London',start:at,end:day+'T17:00:00Z',tasks,completed:[],plan:null};
 else if(name==='billing_access')data={plan:'growth',needs_choice:false};
 else if(name==='ai_allowance_summary')data={enabled:true,daily_request_limit:200,daily_requests:8};
 else if(name==='my_invitation')data=[];
 else if(name==='capture_workspace')data=args.p_action==='detail'?{source,items}:{rows:[source],count:1};
 else if(name==='capture_pipeline')data=op==='options'?{today:day,remaining:192,ai_enabled:true,forwarding:false,upload:false,address:null,records:[],contacts:[],departments:[]}:[];
 else if(name==='capture_notifications')data=[];
 else if(name==='capture_list')data={rows:[source],count:1};
 else if(name==='capture_detail')data={source,items};
 else if(name==='capture_options')data={people:[{id,name:profile.full_name}],roles:[role.role],channels:[]};
 else if(name==='handover_workspace')data=op==='options'?{role:role.role,people:[{id,name:profile.full_name,reviewer:false},{id:'cover',name:'Jordan Ellis',reviewer:false},{id:'manager',name:'Sam Taylor',reviewer:true}],roles:[],records:role.items.map(r=>({id:r.id,title:r.title,group:r.kind==='external_contact'?'contacts':'work'})),notes:[],tasks,decisions:[decision],policy:{approval_required:true,allow_top_no_approval:false,external_sharing:false,link_expiry_days:7},last_return:null}:op==='list'?{rows:[handover],count:1,flags:{pdf:true}}:op==='get'||op==='detail'?{...handover,handover,items:[],tasks,history:[],comments:[],shares:[],manager_notes:[],notifications:[]}:[];
 return response(data)})as any
Object.defineProperty(supabase,'functions',{configurable:true,value:{invoke:async(name:string,args:any)=>name==='ai-run'?{data:{ok:true,text:args.body.task==='weekly_summary'?summary:JSON.stringify({answer:'Alex Morgan agreed to monthly supplier reviews to reduce meetings and keep delivery risks visible.',citations:[]}),sources:[],request_id:crypto.randomUUID()},error:null}:name==='capture-connect'?{data:{ok:true,providers:[],connections:[]},error:null}:{data:{},error:null}}})
document.addEventListener('click',event=>{if((event.target as Element).closest('a')){event.preventDefault();event.stopPropagation()}},true)
const selected=new URLSearchParams(location.search).get('step')||'tasks';const initial=selected==='conversations'?'/app/capture?capture='+sourceId:selected==='decisions'?'/app/role-record?section=decision':selected==='contacts'?'/app/role-record?section=external_contact':selected==='handovers'?'/app/handovers/'+handoverId:selected==='week'?'/app/weekly-summary':'/app'
function DemoApp(){return <AuthProvider><Routes><Route path="/demo/index.html" element={session?<Navigate to={initial}/>:<AuthPage mode="login"/>}/><Route path="/login" element={<AuthPage mode="login"/>}/><Route element={<RequireAuth/>}><Route path="/app" element={<AppLayout/>}><Route index element={<MyDayPage/>}/><Route path="capture" element={<CapturePage/>}/><Route path="role-record" element={<RoleRecordPage/>}/><Route path="handovers/*" element={<HandoversPage/>}/><Route path="weekly-summary" element={<WeeklySummaryPage/>}/></Route></Route></Routes></AuthProvider>}
// Keep the demo entry loaded across direct page visits using the capture script's app links.
if(!session){const button=document.createElement('button');button.textContent='Sign in to Demo workspace';button.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9999;padding:12px;background:#2867ce;color:white;border:0;border-radius:8px';button.onclick=()=>{session={user,access_token:'demo-only'};sessionStorage.setItem('vimbre-demo-session','yes');emit();button.remove()};document.body.append(button)}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[initial]}><DemoApp/></MemoryRouter>)

// Open the relevant saved example once its actual app page is ready.
const observer=new MutationObserver(()=>{
 if(selected==='decisions'||selected==='contacts'){
  const label=selected==='decisions'?'Decisions':'Contacts';
  const heading=[...document.querySelectorAll<HTMLElement>('.rc-section summary')].find(node=>node.textContent?.startsWith(label));
  if(heading){observer.disconnect();if(!heading.parentElement?.hasAttribute('open'))heading.click();window.scrollTo({top:heading.getBoundingClientRect().top+window.scrollY-80})}
 }else if(selected==='week'){
  const button=[...document.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.textContent==='Use my records');
  if(button){observer.disconnect();button.click()}
 }else if(document.querySelector('#main h1'))observer.disconnect();
});observer.observe(document.getElementById('root')!,{childList:true,subtree:true});
