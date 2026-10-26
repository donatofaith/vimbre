import {search,filters} from './search.ts'
import {preview} from './preview.ts'
import {refresh,api} from './providers.ts'
import type {Provider,Tokens} from './providers.ts'
type Rpc=(action:string,id?:string|null,data?:Record<string,unknown>)=>Promise<any>
type Connections=(action:string,user:string,data?:Record<string,unknown>)=>Promise<any>
type Deps={rpc:Rpc;connection:Connections;remember:(user:string,data:Record<string,unknown>)=>Promise<void>;draft:(source:{text:string;capture_id:string;owner_id:string;company_id:string},request:string)=>Promise<{ok:boolean;code?:string;message?:string}>}
export async function captureAutomation(d:Deps){
 const watches=await d.rpc('watch_claim') as {id:string;owner_id:string;connection_id:string;place:string;frequency:number;filters:Record<string,unknown>}[]
 await Promise.all(watches.map(async w=>{
  let stored:any,tokens:Tokens|undefined,state='active',error=''
  try{const context=await d.rpc('watch_context',w.id);if(!context)return;stored=await d.connection('get',w.owner_id,{id:w.connection_id});tokens=await refresh(context.provider,stored.secret);const p=context.provider as Provider
   const after=new Date(Date.now()-Math.max(w.frequency*2,60)*60000).toISOString().slice(0,10),f=filters({...w.filters,after,notCaptured:true,...(p==='gmail'||p==='outlook'||p==='drive'?{folder:w.place}:{place:w.place})});
   // Mention filters resolve the account's own provider identity, never the Vimbre display name.
   if(w.filters.mention_me===true){if(p==='slack'){const me=await api(p,tokens,'auth.test');f.query=[f.query,`<@${me.user_id}>`].filter(Boolean).join(' ')}else if(p==='gmail'){const me=await api(p,tokens,'profile');f.query=[f.query,'to:'+me.emailAddress].filter(Boolean).join(' ')}else if(p==='outlook'||p==='teams'){const me=await api(p,tokens,'me?$select=mail,userPrincipalName');f.query=[f.query,p==='teams'?'to:'+String(me.mail||me.userPrincipalName):'to:'+String(me.mail||me.userPrincipalName)].filter(Boolean).join(' ')}else throw Error('mention_unavailable')}
   const page=await search(p,tokens,f);for(const row of page.rows.slice(0,Math.min(3,context.remaining))){if(row.kind!=='item')continue;const source=await preview(p,tokens,row);await d.remember(w.owner_id,{provider:p,source:source.source,container:source.container,text:source.text});await d.rpc('watch_source',w.id,{source})}
  }catch(e){state=e instanceof Error&&e.message==='reconnect'?'reconnect':'error';error=state==='reconnect'?'Reconnect the account in Settings, then resume Watch.':'This place could not be checked. Review the rule or try again.'}finally{if(stored&&tokens)try{await d.connection('unlock',w.owner_id,{id:w.connection_id,lease_token:stored.lease_token,secret:tokens})}catch{/* A concurrent reconnect supersedes the old lease. */}try{await d.rpc('watch_finish',w.id,{state,error})}catch{/* A quota pause can end the Watch lease before finalization. */}}
 }))
 const jobs=await d.rpc('claim') as {id:string}[]
 await Promise.all(jobs.map(async job=>{let state='failed',error='Drafting could not finish. Open this capture to retry.';try{const source=await d.rpc('source',job.id);if(!source){error='This capture is no longer available.'}else{const result=await d.draft(source,job.id);state=result.ok?'success':['limit_reached','daily_limit','monthly_limit','budget_exceeded','quota_exceeded','ai_disabled'].includes(result.code||'')?'paused':'failed';error=result.ok?'':result.message||error}}catch{/* Stable job ID protects paid retries from duplicate generation. */}await d.rpc('finish',job.id,{state,error})}))
}
