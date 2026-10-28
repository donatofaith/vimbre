import Stripe from 'stripe'
import {createClient} from '@supabase/supabase-js'
import {plans,planForPrice,PORTAL_CONFIGURATION,STRIPE_ACCOUNT,remainingTrial,type Plan} from './catalog.ts'
const origins=new Set(['https://vimbre.com','https://www.vimbre.com','https://vimbre.co.uk','https://www.vimbre.co.uk','http://localhost:5173'])
const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
const key=Deno.env.get('STRIPE_SECRET_KEY')??''
const stripe=key.startsWith('rk_test_')?new Stripe(key,{apiVersion:'2026-08-26.dahlia',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:15000}):null
type BillingAccount={company_id:string;company_name:string;customer_id:string|null;subscription_id:string|null;trial_ends_at:string;members:number;checkout_token:string}
async function backend(operation:string,data:Record<string,unknown>){const r=await service.rpc('billing_sandbox_backend',{p_operation:operation,p_data:data});if(r.error)throw r.error;return r.data}
const acceptedEvents=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed','invoice.paid','invoice.payment_failed'])
async function syncSubscription(subscriptionId:string,event:{id:string;type:string}){
 if(!stripe)throw Error('not_configured')
 const syncedAt=new Date().toISOString()
 const sub=await stripe.subscriptions.retrieve(subscriptionId)
 if(sub.livemode||sub.items.data.length!==1||!planForPrice(sub.items.data[0].price.id)||sub.items.data[0].quantity!==1)throw Error('subscription_mismatch')
 const item=sub.items.data[0]
 return backend('event',{stripe_account:STRIPE_ACCOUNT,livemode:false,event_id:event.id,event_type:event.type,customer_id:typeof sub.customer==='string'?sub.customer:sub.customer.id,subscription_id:sub.id,price_id:item.price.id,status:sub.status,period_ends_at:item.current_period_end?new Date(item.current_period_end*1000).toISOString():null,cancel_at_period_end:sub.cancel_at_period_end,synced_at:syncedAt})
}
async function webhook(req:Request){
 const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET')
 if(!stripe||!secret)return Response.json({error:'Webhook is not configured.'},{status:503})
 if(Number(req.headers.get('content-length')??0)>1000000)return new Response(null,{status:413})
 const raw=await req.text();if(raw.length>1000000)return new Response(null,{status:413})
 let event:Stripe.Event
 try{event=await stripe.webhooks.constructEventAsync(raw,req.headers.get('stripe-signature')??'',secret,300,Stripe.createSubtleCryptoProvider())}catch{return new Response(null,{status:400})}
 if(event.livemode)return new Response(null,{status:400})
 if(!acceptedEvents.has(event.type))return Response.json({ignored:true})
 try{
   let id:string|undefined
   if(event.type.startsWith('customer.subscription.'))id=(event.data.object as Stripe.Subscription).id
   else if(event.type.startsWith('checkout.session.')){const session=event.data.object as Stripe.Checkout.Session;if(session.mode!=='subscription')return Response.json({ignored:true});id=typeof session.subscription==='string'?session.subscription:session.subscription?.id}
   else{const invoice=event.data.object as Stripe.Invoice;const sub=invoice.parent?.subscription_details?.subscription;id=typeof sub==='string'?sub:sub?.id}
   if(!id)return Response.json({ignored:true})
   return Response.json(await syncSubscription(id,event))
 }catch{return Response.json({error:'Subscription update could not be processed.'},{status:503})}
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')??''
 const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://vimbre.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'}
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return new Response(null,{status:405,headers})
 if(new URL(req.url).pathname.endsWith('/webhook'))return webhook(req)
 if(origin&&!origins.has(origin))return new Response(null,{status:403,headers})
 if(!stripe)return Response.json({error:'Sandbox billing is not configured.'},{status:503,headers})
 try{
   const token=req.headers.get('authorization')?.replace(/^Bearer /,'')
   if(!token)return new Response(null,{status:401,headers})
   const auth=await service.auth.getUser(token)
   if(auth.error||!auth.data.user?.email_confirmed_at)return new Response(null,{status:401,headers})
   const userId=auth.data.user.id
   let account:BillingAccount
   try{account=await backend('context',{user_id:userId})}catch{return new Response(null,{status:403,headers})}
   const input=await req.json();const operation=input.operation
   if(operation==='status'){
     let hasPaymentMethod=false
     if(account.customer_id){
       const customerId=account.customer_id
       const list=await stripe.subscriptions.list({customer:customerId,status:'all',limit:100})
       const current=list.data.find(s=>s.id===account.subscription_id)??list.data.find(s=>s.metadata.application==='vimbre')
       if(current){await syncSubscription(current.id,{id:'reconcile_'+crypto.randomUUID(),type:'billing.status.refreshed'});account=await backend('context',{user_id:userId});hasPaymentMethod=Boolean(current.default_payment_method||current.default_source)}
       const customer=await stripe.customers.retrieve(customerId)
       if(!customer.deleted)hasPaymentMethod=hasPaymentMethod||Boolean(customer.invoice_settings.default_payment_method||customer.default_source)
     }
     return Response.json({...account,has_payment_method:hasPaymentMethod,checked_at:new Date().toISOString(),ready:Boolean(Deno.env.get('STRIPE_WEBHOOK_SECRET'))},{headers})
   }
   if(!Deno.env.get('STRIPE_WEBHOOK_SECRET'))return Response.json({error:'Billing is temporarily unavailable. Please try again.'},{status:503,headers})
   if(operation!=='checkout'&&operation!=='portal')return new Response(null,{status:400,headers})
   if(!account.customer_id){const customer=await stripe.customers.create({name:account.company_name,email:auth.data.user.email,metadata:{application:'vimbre',company_id:account.company_id}},{idempotencyKey:'vimbre-sandbox-customer-'+account.company_id});account=await backend('bind_customer',{user_id:userId,customer_id:customer.id})}
   const customerId=account.customer_id
   if(!customerId)throw Error('customer_missing')
   if(operation==='portal'){
     const portal=await stripe.billingPortal.sessions.create({customer:customerId,configuration:PORTAL_CONFIGURATION,return_url:'https://vimbre.com/app/billing?billing=sandbox'})
     return Response.json({url:portal.url},{headers})
   }
   const plan=typeof input.plan==='string'&&Object.hasOwn(plans,input.plan)?plans[input.plan as Plan]:null
   if(!plan)return Response.json({error:'Choose a listed plan.'},{status:400,headers})
   if(account.members>plan.seats)return Response.json({error:'Choose a plan that fits your active team size.'},{status:409,headers})
   // Check provider state too: webhook delivery may lag behind a previous completed checkout.
   const subscriptions=await stripe.subscriptions.list({customer:customerId,status:'all',limit:100})
   if(subscriptions.has_more||subscriptions.data.some(s=>!['canceled','incomplete_expired'].includes(s.status)))return Response.json({error:'A subscription already exists. Use Manage billing.'},{status:409,headers})
   const existing=await stripe.checkout.sessions.list({customer:customerId,status:'open',limit:100})
   if(existing.data.length||existing.has_more){const current=existing.data.find(s=>s.mode==='subscription'&&s.metadata?.application==='vimbre');if(current?.url)return Response.json({url:current.url},{headers});return Response.json({error:'A checkout is already in progress.'},{status:409,headers})}
   const providerPrice=await stripe.prices.retrieve(plan.price)
   if(providerPrice.livemode||providerPrice.unit_amount!==plan.amount||providerPrice.currency!=='gbp'||providerPrice.recurring?.interval!=='month')throw Error('price_mismatch')
   account=await backend('checkout_claim',{user_id:userId,plan:input.plan})
   const trialEnd=remainingTrial(account.trial_ends_at)
   // Stripe requires at least 48 hours for a trial Checkout. Shorter remaining trials stay local;
   // paid checkout is explicit in the UI and never silently charges before the trial deadline.
   if(!trialEnd&&Date.parse(account.trial_ends_at)>Date.now())return Response.json({error:'Your free trial is still running. Add billing after it ends, or manage an existing subscription.'},{status:409,headers})
   const suffix=account.checkout_token.replaceAll('-','').slice(0,8).split('').map((c:string)=>String.fromCharCode(97+parseInt(c,16))).join('')
   const session=await stripe.checkout.sessions.create({mode:'subscription',customer:customerId,line_items:[{price:plan.price,quantity:1}],payment_method_collection:trialEnd?'if_required':'always',client_reference_id:account.company_id,metadata:{application:'vimbre',company_id:account.company_id},subscription_data:{metadata:{application:'vimbre',company_id:account.company_id},billing_mode:{type:'flexible'},...(trialEnd?{trial_end:trialEnd,trial_settings:{end_behavior:{missing_payment_method:'cancel' as const}}}:{})},success_url:'https://vimbre.com/app/billing?billing=sandbox&checkout=returned',cancel_url:'https://vimbre.com/app/billing?billing=sandbox',integration_identifier:'vimbre_sandbox_'+suffix},{idempotencyKey:'vimbre-sandbox-checkout-'+account.checkout_token})
   return Response.json({url:session.url},{headers})
 }catch{return Response.json({error:'Billing could not be updated. Your workspace has not changed.'},{status:503,headers})}
})
