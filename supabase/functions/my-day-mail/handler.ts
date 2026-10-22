import { reminderMail } from './template.ts'
import type { Batch } from './template.ts'
type Deps={configured:boolean;claim:(hash:string)=>Promise<Batch|null>;finish:(batch:string,state:'sent'|'failed'|'uncertain')=>Promise<void>;send:(mail:ReturnType<typeof reminderMail>,batch:Batch)=>Promise<Response>}
export function mailHandler(d:Deps){return async(request:Request)=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405})
 const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization')??'')?.[1]
 if(!token)return new Response('Not authorised',{status:401})
 if(!d.configured)return new Response('Email reminders are not configured',{status:503})
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('')
 let batch:Batch|null
 try{batch=await d.claim(hash)}catch{return new Response('Not authorised',{status:401})}
 if(!batch||!batch.items.length)return new Response(null,{status:204})
 let state:'sent'|'failed'|'uncertain'='uncertain'
 try{const response=await d.send(reminderMail(batch),batch);state=response.ok?'sent':response.status>=400&&response.status<500?'failed':'uncertain';await response.body?.cancel()}catch{state='uncertain'}
 try{await d.finish(batch.batch,state)}catch{return new Response('Delivery status could not be saved',{status:503})}
 return new Response(state==='sent'?'Reminder sent':'Reminder delivery requires review',{status:state==='sent'?200:503})
}}
