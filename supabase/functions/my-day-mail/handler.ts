import { deliverBatch,drainReminders } from './worker.ts'
import type { Delivery } from './worker.ts'
import type { Batch } from './template.ts'
type Deps=Delivery&{configured:boolean;suite?:()=>Promise<void>;background?:(work:Promise<void>)=>void}
export function mailHandler(d:Deps){return async(request:Request)=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405})
 const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization')??'')?.[1]
 if(!token)return new Response('Not authorised',{status:401})
 if(!d.configured)return new Response('Email reminders are not configured',{status:503})
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('')
 let batch:Batch|null
 try{batch=await d.claim(hash)}catch{return new Response('Not authorised',{status:401})}
 if(d.suite){const work=d.suite();if(d.background)d.background(work);else await work}
 if(!batch?.items.length)return new Response(null,{status:204})
 if(d.background){d.background(drainReminders(d,hash,batch));return new Response('Reminder delivery queued',{status:202})}
 try{const state=await deliverBatch(d,batch);return new Response(state==='sent'?'Reminder sent':'Reminder delivery requires review',{status:state==='sent'?200:503})}catch{return new Response('Delivery status could not be saved',{status:503})}
}}
