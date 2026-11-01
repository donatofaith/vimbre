import {describe,it,expect} from 'vitest'
import type Stripe from 'stripe'
import {consoleProjection} from './console-projection'
import {livePlans} from './live-catalog'
const event={id:'evt_fixture',created:1793577600}
function subscription(plan:keyof typeof livePlans='starter'){
 const p=livePlans[plan]
 return {id:'sub_fixture',livemode:true,customer:'cus_fixture',metadata:{application:'vimbre',company_id:'11111111-1111-4111-8111-111111111111'},items:{data:[{quantity:1,current_period_end:1796169600,price:{id:p.price,currency:'gbp',unit_amount:p.amount,billing_scheme:'per_unit',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}}}]},discounts:[],status:'active',trial_end:null,cancel_at_period_end:false,cancellation_details:{reason:null}} as unknown as Stripe.Subscription
}
function invoice(){return {id:'in_fixture',livemode:true,parent:{subscription_details:{subscription:'sub_fixture'}},customer:'cus_fixture',currency:'gbp',amount_due:2900,amount_paid:2900,status:'paid',due_date:null,status_transitions:{paid_at:1793577600},hosted_invoice_url:'https://invoice.stripe.com/i/fixture',attempt_count:1} as unknown as Stripe.Invoice}
describe('verified live billing projection',()=>{
 it.each(['starter','growth','business'] as const)('maps %s to approved price and seats',plan=>{const p=consoleProjection(subscription(plan),event);expect(p.subscription).toMatchObject({plan_name:livePlans[plan].name,seat_limit:livePlans[plan].seats,amount_minor:livePlans[plan].amount,currency:'gbp'});expect(p.invoice).toBeNull()})
 it('copies actual invoice totals without card or customer content',()=>{const p=consoleProjection(subscription(),event,invoice());expect(p.invoice).toMatchObject({amount_due_minor:2900,amount_paid_minor:2900,status:'paid'});expect(JSON.stringify(p)).not.toMatch(/payment_method|card|email|description/)})
 it.each(['livemode','price','quantity','company'] as const)('refuses an unreportable %s',change=>{const s=subscription();if(change==='livemode')s.livemode=false;if(change==='price')s.items.data[0].price.unit_amount=1;if(change==='quantity')s.items.data[0].quantity=2;if(change==='company')s.metadata.company_id='invalid';expect(()=>consoleProjection(s,event)).toThrow()})
 it('excludes discounted contracts from reported revenue until reviewed',()=>{const s=subscription();s.discounts=['di_fixture'];expect(consoleProjection(s,event).subscription.status).toBe('unknown')})
 it('rejects a cross subscription invoice',()=>{const i=invoice();i.parent!.subscription_details!.subscription='sub_other';expect(()=>consoleProjection(subscription(),event,i)).toThrow('Invoice mismatch')})
 it('removes an untrusted hosted invoice link',()=>{const i=invoice();i.hosted_invoice_url='https://example.invalid';expect(consoleProjection(subscription(),event,i).invoice?.hosted_invoice_url).toBeNull()})
 it('does not accept reconciliation IDs as provider events',()=>{expect(()=>consoleProjection(subscription(),{...event,id:'reconcile_fixture'})).toThrow()})
})
