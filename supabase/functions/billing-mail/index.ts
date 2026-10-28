import {createClient} from '@supabase/supabase-js'
import {deliverBillingTrials} from '../my-day-mail/billing-worker.ts'
declare const EdgeRuntime:{waitUntil(work:Promise<void>):void}
const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
const key=Deno.env.get('BREVO_TRANSACTIONAL_KEY'),sender=Deno.env.get('VIMBRE_REMINDER_SENDER')
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response(null,{status:405})
 const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('authorization')??'')?.[1]
 if(!token)return new Response(null,{status:401})
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('')
 const auth=await service.rpc('billing_trial_authorize',{p_hash:hash})
 if(auth.error||auth.data!==true)return new Response(null,{status:401})
 if(!key||!sender)return new Response('Billing email is not configured',{status:503})
 EdgeRuntime.waitUntil(deliverBillingTrials({rpc:async(action,id,state)=>{const r=await service.rpc('billing_trial_delivery',{p_action:action,p_id:id??null,p_state:state??null});if(r.error)throw Error('Billing reminder queue unavailable');return r.data},send:job=>fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'Content-Type':'application/json','api-key':key},body:JSON.stringify({sender:{email:sender,name:'Vimbre'},to:[{email:job.email,name:job.name}],subject:job.title,textContent:job.body,headers:{'Idempotency-Key':job.id},replyTo:{email:'support@vimbre.com',name:'Vimbre Support'}}),signal:AbortSignal.timeout(15000)})}).catch(()=>{console.warn('Billing reminder delivery requires review')}))
 return new Response(null,{status:202})
})
