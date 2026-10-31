import {isWorkProvider} from './work-tools.ts'
import {calendarBusy} from './calendar.ts'
import {search,filters,places} from './search.ts'
import {preview} from './preview.ts'
import {prepareSource,updateSource} from './source-updates.ts'
import type {Reference} from './source-updates.ts'
import {createClient} from '@supabase/supabase-js'
import {providers,names,configured,start,exchange,refresh,sources,read,drivePdf,revoke,random,digest} from './providers.ts'
import type {Provider,Tokens} from './providers.ts'
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const callback=url+'/functions/v1/capture-connect/callback',brandedCallback='https://vimbre.com/api/capture/callback',home='https://vimbre.com/app/capture'
const origins=new Set(['https://vimbre.com','https://www.vimbre.com','https://vimbre.vercel.app','https://vimbre.co.uk','https://www.vimbre.co.uk','http://127.0.0.1:5173','http://localhost:5173'])
async function service(action:string,user:string|null,data:Record<string,unknown>={}){const r=await db.rpc('capture_connection_service',{p_action:action,p_user:user,p_data:data});if(r.error)throw new Error(r.error.message.includes('connection_busy')?'connection_busy':r.error.message.includes('rate_limited')?'rate_limited':'access_denied');return r.data}
Deno.serve(async req=>{
 const parsed=new URL(req.url),origin=req.headers.get('origin')||''
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://vimbre.com','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers})
 if(req.method==='GET'&&parsed.pathname.endsWith('/capabilities'))return reply(200,{providers:providers.map(p=>({provider:p,configured:configured(p)}))})
 if(req.method==='GET'&&parsed.pathname.endsWith('/callback')){
  try{const state=parsed.searchParams.get('state');if(!state||!/^[a-f0-9]{64}$/.test(state))throw new Error('connection_expired');const binding=await service('state_redirect',null,{hash:await digest(state)});if(!origins.has(binding.origin)||!binding.origin.startsWith('https://'))throw new Error('access_denied');const fragment=new URLSearchParams({tool_connect:'1',state});for(const name of ['code','oauth_token','oauth_verifier','error','denied']){const value=parsed.searchParams.get(name);if(value&&value.length<=4096)fragment.set(name,value)}return new Response(null,{status:303,headers:{Location:binding.origin+'/app/capture#'+fragment,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}catch{return new Response(null,{status:303,headers:{Location:home+'?connection=failed','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}
 }
 if(origin&&!origins.has(origin))return reply(403,{ok:false,code:'access_denied'})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return reply(405,{ok:false,code:'method_not_allowed'})
 try{
  const bearer=req.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))return reply(401,{ok:false,code:'sign_in'})
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await auth.auth.getUser(bearer.slice(7));if(error||!data.user?.email_confirmed_at)return reply(401,{ok:false,code:'sign_in'})
  const user=data.user.id,raw=await req.text();if(raw.length>70000)return reply(413,{ok:false,code:'invalid_input'});const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,{ok:false,code:'invalid_input'})
  const connections=await service('list',user)
  async function sourceService(action:string,payload:Record<string,unknown>){const {data,error}=await db.rpc('myday_source_service',{p_user:user,p_action:action,p_data:payload});if(error)throw Error(['write_disabled','invalid_source'].includes(error.message)?error.message:'access_denied');return data}
  async function searchService(action:string,payload:Record<string,unknown>={}){const r=await db.rpc('capture_search_service',{p_user:user,p_action:action,p_data:payload});if(r.error)throw Error(r.error.message.includes('search_expired')?'search_expired':'access_denied');return r.data}
  if(input.action==='status')return reply(200,{ok:true,...await searchService('policy'),providers:[...providers.map(p=>({provider:p,name:names[p],configured:configured(p),connection:connections.find((c:any)=>c.provider===p)||null})),{provider:'yahoo',name:'Yahoo Mail',configured:false,setup_reason:'Awaiting Yahoo approval',connection:null},...connections.filter((c:any)=>c.provider==='gmail'||c.provider==='drive').map((c:any)=>({provider:c.provider,name:names[c.provider as Provider],configured:false,retired:true,connection:c}))]})
  if(input.action==='calendar_busy'){
   const planner=createClient(url,anon,{global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false}});const context=await planner.rpc('myday_plan',{p_operation:'get'});if(context.error)throw Error('calendar_unavailable');
   const start=new Date(context.data.start),end=new Date(context.data.end);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))throw Error('calendar_unavailable');let connected=0;
   for(const p of ['gmail','outlook'])if(p==='gmail'||!connections.some((c:any)=>c.provider===p)){const cleared=await db.rpc('myday_calendar_busy_service',{p_user:user,p_provider:p,p_slots:[]});if(cleared.error)throw Error('calendar_unavailable')}
   for(const connection of connections.filter((c:any)=>c.provider==='outlook')){
    const stored=await service('get',user,{id:connection.id});let tokens=stored.secret as Tokens;
    try{if(!tokens.calendar){const cleared=await db.rpc('myday_calendar_busy_service',{p_user:user,p_provider:connection.provider,p_slots:[]});if(cleared.error)throw Error('calendar_unavailable');continue;}connected++;const policy=await searchService('policy');if(!policy.allowed.includes(connection.provider))throw Error('access_denied');tokens=await refresh(connection.provider,tokens);const slots=end>start?await calendarBusy(connection.provider,tokens,start.toISOString(),end.toISOString()):[];const saved=await db.rpc('myday_calendar_busy_service',{p_user:user,p_provider:connection.provider,p_slots:slots});if(saved.error)throw Error('calendar_unavailable')}
    finally{await service('unlock',user,{id:connection.id,secret:tokens,lease_token:stored.lease_token})}
   }
   return reply(200,{ok:true,connected})
  }
  if(input.action==='complete'){
   if(!input.params||typeof input.params!=='object'||Array.isArray(input.params))return reply(400,{ok:false,code:'invalid_input'});const params=new URLSearchParams();for(const name of ['state','code','oauth_token','oauth_verifier','error','denied'])if(typeof input.params[name]==='string')params.set(name,input.params[name]);const state=params.get('state');if(!state||!/^[a-f0-9]{64}$/.test(state))return reply(400,{ok:false,code:'invalid_input'});const grant=await service('state_claim',user,{hash:await digest(state)});if(params.has('error')||params.has('denied'))return reply(400,{ok:false,code:'connection_declined'});const p=grant.provider as Provider;if(!providers.includes(p as typeof providers[number]))throw Error('access_denied');const redirect=grant.secret.redirect_uri||callback;if(redirect!==callback&&redirect!==brandedCallback)throw new Error('access_denied');const tokens=await exchange(p,params,grant.secret,redirect);await service('store',user,{provider:p,company_id:grant.company_id,secret:{...tokens,write:grant.secret.write==='true',calendar:grant.secret.calendar==='true'}});return reply(200,{ok:true})
  }
  if(input.action==='connect'){
   const p=input.provider as typeof providers[number];if(!providers.includes(p))return reply(400,{ok:false,code:'invalid_input'});if(!configured(p))return reply(409,{ok:false,code:'setup_required'})
   const policy=await searchService('policy');if(!policy.allowed.includes(p))throw Error('access_denied');
   let keepWrite=input.write===true;if(input.calendar===true){if(p!=='outlook')throw Error('invalid_input');const old=connections.find((c:any)=>c.provider===p);if(old){const stored=await service('get',user,{id:old.id});try{keepWrite=keepWrite||stored.secret.write===true}finally{await service('unlock',user,{id:old.id,secret:stored.secret,lease_token:stored.lease_token})}}}if(keepWrite)await sourceService('write_allowed',{provider:p});
   const redirect=brandedCallback;const state=random(),flow=await start(p,state,redirect,random(),keepWrite,input.calendar===true);await service('state_create',user,{hash:await digest(state),provider:p,secret:{...flow.secret,redirect_uri:redirect,write:keepWrite?'true':'false',calendar:input.calendar===true?'true':'false'},return_origin:origins.has(origin)&&origin.startsWith('https://')?origin:'https://vimbre.com'});return reply(200,{ok:true,url:flow.url,state})
  }
  if(['source_prepare','source_update'].includes(input.action)){
   const context=await sourceService('context',{task:input.task}) as Reference;if(context.provider==='gmail')throw Error('access_denied');const connection=connections.find((c:any)=>c.provider===context.provider);if(!connection)throw Error('reconnect');const stored=await service('get',user,{id:connection.id});let tokens=stored.secret as Tokens;
   try{tokens=await refresh(context.provider,tokens);if(!tokens.write)throw Error('reconnect');if(input.action==='source_prepare')return reply(200,{ok:true,provider:context.provider,...await prepareSource(context,tokens)});
    if(typeof input.request_id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.request_id)||typeof input.body!=='string'||input.body.length>5000||typeof input.operation!=='string')throw Error('invalid_source');const payload={task:input.task,request_id:input.request_id,operation:input.operation,body:input.body,list_id:typeof input.list_id==='string'?input.list_id:''},claim=await sourceService('claim',payload);if(claim.state==='sent')return reply(200,{ok:true});if(claim.state!=='new')throw Error('uncertain');
    try{await updateSource(context,tokens,input.operation,input.body,payload.list_id,input.request_id);await sourceService('finish',{...payload,state:'sent'});return reply(200,{ok:true})}catch(e){await sourceService('finish',{...payload,state:e instanceof Error&&e.message==='uncertain'?'uncertain':'failed'});throw e}
   }finally{await service('unlock',user,{id:connection.id,secret:tokens,lease_token:stored.lease_token})}
  }
  if(!['sources','import','disconnect','search','preview','preview_text','places'].includes(input.action)||typeof input.id!=='string'||!connections.some((c:any)=>c.id===input.id))return reply(403,{ok:false,code:'access_denied'})
  const stored=await service('get',user,{id:input.id}),p=stored.provider as Provider;let tokens=stored.secret as Tokens,removed=false
  try{
   if(input.action==='disconnect'){await revoke(p,tokens);await service('remove',user,{id:input.id,lease_token:stored.lease_token});removed=true;return reply(200,{ok:true})}
   const policy=await searchService('policy');if(!policy.allowed.includes(p))throw Error('access_denied');
   if(!configured(p))return reply(409,{ok:false,code:'setup_required'})
   tokens=await refresh(p,tokens)
   if(input.action==='places'){
    const kind=typeof input.kind==='string'?input.kind:'',parent=typeof input.parent==='string'?input.parent:'',fingerprint=await digest(JSON.stringify(['places',kind,parent]));if(parent.length>1024)throw Error('invalid_source');
    const base={connection:input.id,fingerprint},cursor=input.cursor?await searchService('cursor',{...base,token:input.cursor}):'';
    const data=await searchService('page_get',{...base,cursor})||await searchService('page_put',{...base,cursor,page:await places(p,tokens,kind,parent,cursor)});
    return reply(200,{ok:true,rows:data.rows,next:data.next?data.cache:null,cache:data.cache})
   }
   if(input.action==='search'){
    const f=filters(input.filters),fingerprint=await digest(JSON.stringify(f)),base={connection:input.id,fingerprint};
    const cursor=input.cursor?await searchService('cursor',{...base,token:input.cursor}):'';
    if(input.cursor&&!cursor)throw Error('search_expired');
    const data=await searchService('page_get',{...base,cursor})||await searchService('page_put',{...base,cursor,page:await search(p,tokens,f,cursor)});
    const captured=await searchService('captured',{connection:input.id,references:data.rows.map((r:any)=>r.reference)});
    return reply(200,{ok:true,rows:data.rows.map((r:any)=>({...r,captured:captured[r.reference]||null})).filter((r:any)=>!f.notCaptured||!r.captured),next:data.next?data.cache:null,cache:data.cache})
   }
   if(input.action==='preview_text'){
    if(typeof input.text!=='string'||input.text.length>16000)throw Error('invalid_source');
    return reply(200,{ok:true,...await searchService('preview_finish',{connection:input.id,preview:input.preview,text:input.text})})
   }
   if(input.action==='preview'){
    const row=await searchService('selected_row',{connection:input.id,cache:input.cache,reference:input.reference});
    if(p==='drive'&&row.mime==='application/pdf'){const document=await drivePdf(tokens,row.id),result=await searchService('preview_put',{connection:input.id,source:{title:row.title,text:'PDF extraction pending',date:row.date?.slice(0,10)||new Date().toISOString().slice(0,10),sender:row.sender,source_type:'note',reference:row.reference,source:row.id,container:row.container,url:row.url,provider:p,format:'pdf'}});return reply(200,{ok:true,...result,document,title:row.title})}
    const source=await preview(p,tokens,row);
    if(!isWorkProvider(p))await sourceService('remember',{provider:p,source:source.source,container:source.container,text:source.text});
    const result=await searchService('preview_put',{connection:input.id,source});return reply(200,{ok:true,...result,source})
   }
   if(input.action==='sources')return reply(200,{ok:true,rows:await sources(p,tokens,typeof input.container==='string'?input.container:'')})
   if(typeof input.source!=='string')return reply(400,{ok:false,code:'invalid_input'})
   const container=typeof input.container==='string'?input.container:'',source=await read(p,tokens,input.source,container);if(!isWorkProvider(p))await sourceService('remember',{provider:p,source:input.source,container,text:source.text});return reply(200,{ok:true,source})
  }finally{if(!removed)await service('unlock',user,{id:input.id,secret:tokens,lease_token:stored.lease_token})}
 }catch(e){const allowed=new Set(['sign_in','access_denied','setup_required','connection_busy','rate_limited','provider_busy','reconnect','provider_unavailable','source_too_large','source_empty','invalid_source','unsupported_file','write_disabled','uncertain','search_expired','calendar_permission','calendar_unavailable']);const code=e instanceof Error&&allowed.has(e.message)?e.message:'unavailable';return reply(code==='access_denied'?403:code==='sign_in'?401:code==='rate_limited'?429:400,{ok:false,code})}
})
