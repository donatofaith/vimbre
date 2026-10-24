import { reminderMail } from './template.ts'
import type { Batch } from './template.ts'
export type Delivery={claim:(hash:string)=>Promise<Batch|null>;finish:(batch:string,state:'sent'|'failed'|'uncertain')=>Promise<void>;send:(mail:ReturnType<typeof reminderMail>,batch:Batch)=>Promise<Response>}
export async function deliverBatch(d:Delivery,batch:Batch){
 let state:'sent'|'failed'|'uncertain'='uncertain'
 try{const response=await d.send(reminderMail(batch),batch);state=response.ok?'sent':response.status>=400&&response.status<500?'failed':'uncertain';await response.body?.cancel()}catch{state='uncertain'}
 await d.finish(batch.batch,state)
 return state
}
// Bounded concurrency drains grouped recipients without making later users wait hours.
// Database claims prevent overlaps from submitting the same alert twice.
export async function drainReminders(d:Delivery,hash:string,first:Batch){
 const deadline=Date.now()+45000;let claimed=1,stop=false
 const deliver=async(batch:Batch)=>{try{if(await deliverBatch(d,batch)!=='sent')stop=true}catch{stop=true}}
 await deliver(first)
 if(stop)return
 await Promise.all(Array.from({length:5},async()=>{
  while(!stop&&claimed<200&&Date.now()<deadline){
   claimed++
   let batch:Batch|null
   try{batch=await d.claim(hash)}catch{stop=true;return}
   if(!batch?.items.length)return
   await deliver(batch)
  }
 }))
}
