import type Stripe from 'stripe'
import {livePlans} from './live-catalog.ts'

const timestamp=(value:number|null|undefined)=>value==null?null:new Date(value*1000).toISOString()

// Called only after signature verification and the customer billing sync succeeds.
// Keep customer content and payment instruments outside the staff projection.
export function consoleProjection(sub:Stripe.Subscription,event:{id:string;created:number},invoice?:Stripe.Invoice){
 const item=sub.items.data[0]
 const plan=Object.values(livePlans).find(plan=>plan.price===item?.price.id)
 if(!sub.livemode||!/^evt_[a-zA-Z0-9]+$/.test(event.id)||!Number.isSafeInteger(event.created)||event.created<0)throw Error('Invalid live event')
 if(sub.metadata.application!=='vimbre'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sub.metadata.company_id??''))throw Error('Company mapping required')
 if(!plan||sub.items.data.length!==1||item.quantity!==1||item.price.currency!=='gbp'||item.price.unit_amount!==plan.amount||item.price.recurring?.interval!=='month'||item.price.recurring.interval_count!==1||item.price.recurring.usage_type!=='licensed'||item.price.billing_scheme!=='per_unit')throw Error('Unsupported plan')
 // Do not report list price as revenue for a discounted contract.
 const needsReview=sub.discounts.length>0
 if(invoice){
  const subscription=invoice.parent?.subscription_details?.subscription
  const invoiceSubscription=typeof subscription==='string'?subscription:subscription?.id
  const customer=typeof sub.customer==='string'?sub.customer:sub.customer.id
  const invoiceCustomer=typeof invoice.customer==='string'?invoice.customer:invoice.customer?.id
  if(!invoice.livemode||invoiceSubscription!==sub.id||invoiceCustomer!==customer||invoice.currency!=='gbp'||!Number.isSafeInteger(invoice.amount_due)||!Number.isSafeInteger(invoice.amount_paid))throw Error('Invoice mismatch')
 }
 return {event_id:event.id,event_created:event.created,live:true,subscription:{id:sub.id,customer_id:typeof sub.customer==='string'?sub.customer:sub.customer.id,company_id:sub.metadata.company_id,plan_name:plan.name,seat_limit:plan.seats,amount_minor:plan.amount,currency:'gbp',billing_interval:'month',status:!needsReview&&['trialing','active','past_due','canceled','incomplete','unpaid'].includes(sub.status)?sub.status:'unknown',current_period_end:timestamp(item.current_period_end),trial_end:timestamp(sub.trial_end),cancel_at_period_end:sub.cancel_at_period_end,cancellation_reason:sub.cancellation_details?.reason??null},invoice:invoice?{id:invoice.id,status:invoice.status??'unknown',amount_due_minor:invoice.amount_due,amount_paid_minor:invoice.amount_paid,currency:invoice.currency,due_at:timestamp(invoice.due_date),paid_at:timestamp(invoice.status_transitions.paid_at),hosted_invoice_url:invoice.hosted_invoice_url?.startsWith('https://invoice.stripe.com/')?invoice.hosted_invoice_url:null,attempt_count:invoice.attempt_count}:null}
}
