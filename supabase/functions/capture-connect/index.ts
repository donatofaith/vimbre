import {createClient} from '@supabase/supabase-js'
import {providers,names,configured,start,exchange,refresh,sources,read,revoke,random,digest} from './providers.ts'
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
  const user=data.user.id,raw=await req.text();if(raw.length>6000)return reply(413,{ok:false,code:'invalid_input'});const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,{ok:false,code:'invalid_input'})
  const connections=await service('list',user)
  if(input.action==='status')return reply(200,{ok:true,providers:providers.map(p=>({provider:p,name:names[p],configured:configured(p),connection:connections.find((c:any)=>c.provider===p)||null}))})
  if(input.action==='complete'){
   if(!input.params||typeof input.params!=='object'||Array.isArray(input.params))return reply(400,{ok:false,code:'invalid_input'});const params=new URLSearchParams();for(const name of ['state','code','oauth_token','oauth_verifier','error','denied'])if(typeof input.params[name]==='string')params.set(name,input.params[name]);const state=params.get('state');if(!state||!/^[a-f0-9]{64}$/.test(state))return reply(400,{ok:false,code:'invalid_input'});const grant=await service('state_claim',user,{hash:await digest(state)});if(params.has('error')||params.has('denied'))return reply(400,{ok:false,code:'connection_declined'});const p=grant.provider as Provider;const redirect=grant.secret.redirect_uri||callback;if(redirect!==callback&&(!(p==='gmail'||p==='drive')||redirect!==brandedCallback))throw new Error('access_denied');const tokens=await exchange(p,params,grant.secret,redirect);await service('store',user,{provider:p,company_id:grant.company_id,secret:tokens});return reply(200,{ok:true})
  }
  if(input.action==='connect'){
   const p=input.provider as Provider;if(!providers.includes(p))return reply(400,{ok:false,code:'invalid_input'});if(!configured(p))return reply(409,{ok:false,code:'setup_required'})
   const redirect=p==='gmail'||p==='drive'?brandedCallback:callback;const state=random(),flow=await start(p,state,redirect,random());await service('state_create',user,{hash:await digest(state),provider:p,secret:{...flow.secret,redirect_uri:redirect},return_origin:origins.has(origin)&&origin.startsWith('https://')?origin:'https://vimbre.com'});return reply(200,{ok:true,url:flow.url,state})
  }
  if(!['sources','import','disconnect'].includes(input.action)||typeof input.id!=='string'||!connections.some((c:any)=>c.id===input.id))return reply(403,{ok:false,code:'access_denied'})
  const stored=await service('get',user,{id:input.id}),p=stored.provider as Provider;let tokens=stored.secret as Tokens,removed=false
  try{
   if(input.action==='disconnect'){await revoke(p,tokens);await service('remove',user,{id:input.id,lease_token:stored.lease_token});removed=true;return reply(200,{ok:true})}
   if(!configured(p))return reply(409,{ok:false,code:'setup_required'})
   tokens=await refresh(p,tokens)
   if(input.action==='sources')return reply(200,{ok:true,rows:await sources(p,tokens,typeof input.container==='string'?input.container:'')})
   if(typeof input.source!=='string')return reply(400,{ok:false,code:'invalid_input'})
   return reply(200,{ok:true,source:await read(p,tokens,input.source,typeof input.container==='string'?input.container:'')})
  }finally{if(!removed)await service('unlock',user,{id:input.id,secret:tokens,lease_token:stored.lease_token})}
 }catch(e){const allowed=new Set(['sign_in','access_denied','setup_required','connection_busy','rate_limited','provider_busy','reconnect','provider_unavailable','source_too_large','source_empty','invalid_source','unsupported_file']);const code=e instanceof Error&&allowed.has(e.message)?e.message:'unavailable';return reply(code==='access_denied'?403:code==='sign_in'?401:code==='rate_limited'?429:400,{ok:false,code})}
})
