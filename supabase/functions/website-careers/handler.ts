export type Env=(name:string)=>string|undefined
const origins=new Set(['https://vimbre.com','https://www.vimbre.com','https://vimbre.co.uk','https://www.vimbre.co.uk','http://localhost:5173','http://127.0.0.1:5173'])
const hex=(value:ArrayBuffer)=>Array.from(new Uint8Array(value),x=>x.toString(16).padStart(2,'0')).join('')
export async function handler(req:Request,env:Env,fetcher:typeof fetch=fetch,background:(p:Promise<unknown>)=>void=p=>{void p}){
 const origin=req.headers.get('origin')??'',headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type, apikey, authorization, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})}
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers})
 if(origin&&!origins.has(origin))return reply(403,{ok:false,code:'access_denied'})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return reply(405,{ok:false,code:'invalid_input'})
 const url=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY'),mailKey=env('BREVO_TRANSACTIONAL_KEY'),sender=env('VIMBRE_REMINDER_SENDER')
 if(!url||!service)return reply(503,{ok:false,code:'unavailable'})
 async function rpc(action:string,id:string|null,data:unknown){const r=await fetcher(url+'/rest/v1/rpc/website_careers_service',{method:'POST',headers:{apikey:service!,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_id:id,p_data:data}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Queue unavailable');return r.json()}
 async function deliver(dispatchHash?:string){if(!mailKey||!sender)return false;const claimed=await rpc('claim',null,dispatchHash?{dispatch_hash:dispatchHash}:{});if(!claimed.ok)return false;for(const job of claimed.jobs??[]){let accepted=false;try{const r=await fetcher('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'Content-Type':'application/json','api-key':mailKey},body:JSON.stringify({sender:{email:sender,name:'Vimbre'},to:[{email:'hellovimbre@gmail.com'}],subject:'New careers enquiry on Vimbre',textContent:'Someone has expressed interest in joining Vimbre. Sign in to the Console to review their details:\n\nhttps://admin.vimbre.com/careers\n\nThis is a careers enquiry, not an application for an advertised role.',headers:{idempotencyKey:job.id}}),signal:AbortSignal.timeout(15000)});accepted=r.ok;if(!accepted){try{const body=await r.json();accepted=body.code==='duplicate_parameter'&&String(body.message).toLowerCase().includes('idempotenc')}catch{/* Leave queued for a later attempt. */}}}catch{/* A failed email never removes the submitted enquiry. */}await rpc('finish',job.id,{lease:job.lease,accepted})}return true}
 try{
  const reader=req.body?.getReader();if(!reader)return reply(400,{ok:false,code:'invalid_input'});const chunks:Uint8Array[]=[];let size=0;try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>16000){await reader.cancel();return reply(413,{ok:false,code:'invalid_input'})}chunks.push(r.value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}const body=JSON.parse(new TextDecoder().decode(bytes))
  if(body.action==='dispatch'){if(origin||typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply(403,{ok:false,code:'access_denied'});const hash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.token)));const delivered=await deliver(hash);return reply(delivered?200:403,{ok:delivered})}
  if(!origins.has(origin)||body.action!=='submit'||typeof body.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.request_id)||!body.application||typeof body.application!=='object'||Array.isArray(body.application))return reply(400,{ok:false,code:'invalid_input'})
  if(body.website)return reply(200,{ok:true,code:'accepted'})
  const a=body.application,fields=['full_name','email','interest','location','portfolio','message']
  if(fields.some(k=>typeof(a[k]??'')!=='string')||a.consent!==true)return reply(400,{ok:false,code:'invalid_input'})
  const application={full_name:String(a.full_name??'').trim(),email:String(a.email??'').trim().toLowerCase(),interest:String(a.interest??''),location:String(a.location??'').trim(),portfolio:String(a.portfolio??'').trim(),message:String(a.message??'').trim(),consent:true}
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('cf-connecting-ip');if(!ip)return reply(503,{ok:false,code:'unavailable'})
  const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(service),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const hash=async(s:string)=>hex(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode('careers:'+s)))
  const result=await rpc('create',body.request_id,{application,ip_hash:await hash('ip:'+ip),email_hash:await hash('email:'+application.email),request_hash:await hash('request:'+JSON.stringify(application))})
  if(result.ok)background(deliver().catch(()=>false))
  return reply(result.ok?200:result.code==='rate_limited'?429:400,result)
 }catch{return reply(503,{ok:false,code:'unavailable'})}
}
