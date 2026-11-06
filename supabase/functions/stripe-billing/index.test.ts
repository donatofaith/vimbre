import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {livePlans} from './live-catalog'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),retrieve:vi.fn(),verify:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc:mocks.rpc})}))
vi.mock('stripe',()=>({default:class{
 static createFetchHttpClient(){return {}}
 static createSubtleCryptoProvider(){return {}}
 subscriptions={retrieve:mocks.retrieve}
 webhooks={constructEventAsync:mocks.verify}
}}))
let handler:(req:Request)=>Promise<Response>
beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks()
 vi.stubGlobal('Deno',{env:{get:(name:string)=>name==='STRIPE_LIVE_SECRET_KEY'?'rk_live_fixture':name==='STRIPE_SECRET_KEY'?'rk_test_fixture':'fixture'},serve:(callback:typeof handler)=>{handler=callback}})
 mocks.rpc.mockResolvedValue({data:{ok:true},error:null})
 const p=livePlans.starter
 mocks.retrieve.mockResolvedValue({id:'sub_fixture',customer:'cus_fixture',livemode:true,status:'active',metadata:{application:'vimbre',company_id:'11111111-1111-4111-8111-111111111111'},items:{data:[{quantity:1,price:{id:p.price,currency:'gbp',unit_amount:p.amount,billing_scheme:'per_unit',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}}}]},discounts:[],cancel_at_period_end:false})
 mocks.verify.mockResolvedValue({id:'evt_fixture',type:'customer.subscription.updated',created:1793577600,livemode:true,data:{object:{id:'sub_fixture'}}})
 await import('./index')
})
afterEach(()=>vi.unstubAllGlobals())
const request=(path='live-webhook')=>new Request('https://fixture.invalid/stripe-billing/'+path,{method:'POST',body:'signed fixture',headers:{'stripe-signature':'fixture'}})
describe('billing webhook bridge',()=>{
 it('syncs customer billing before the staff copy',async()=>{expect((await handler(request())).status).toBe(200);expect(mocks.rpc.mock.calls.map(call=>call[0])).toEqual(['billing_live_backend','console_billing_sync'])})
 it.each([
  ['invoice.finalized','open'],
  ['invoice.voided','void'],
  ['invoice.marked_uncollectible','uncollectible'],
 ])('projects %s as %s',async(type,status)=>{
  mocks.verify.mockResolvedValue({id:'evt_fixture',type,created:1793577600,livemode:true,data:{object:{
   id:'in_fixture',livemode:true,customer:'cus_fixture',currency:'gbp',amount_due:2900,
   amount_paid:0,status,attempt_count:0,status_transitions:{paid_at:null},parent:{subscription_details:{subscription:'sub_fixture'}},
  }}})
  expect((await handler(request())).status).toBe(200)
  expect(mocks.rpc).toHaveBeenLastCalledWith('console_billing_sync',{p_payload:expect.objectContaining({
   invoice:expect.objectContaining({status,amount_due_minor:2900,amount_paid_minor:0}),
  })})
 })
 it('does not project an invalid signature',async()=>{mocks.verify.mockRejectedValue(Error('bad signature'));expect((await handler(request())).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled()})
 it('does not mix sandbox events into live billing',async()=>{mocks.verify.mockResolvedValue({livemode:false});expect((await handler(request())).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled()})
 it('asks Stripe to retry a failed staff projection',async()=>{mocks.rpc.mockImplementation(async(name:string)=>({data:{ok:true},error:name==='console_billing_sync'?Error('unavailable'):null}));expect((await handler(request())).status).toBe(503);expect(mocks.rpc.mock.calls[0][0]).toBe('billing_live_backend')})
 it('keeps the sandbox webhook separate',async()=>{mocks.verify.mockResolvedValue({id:'evt_fixture',type:'customer.subscription.updated',created:1793577600,livemode:false,data:{object:{id:'sub_fixture'}}});mocks.retrieve.mockResolvedValue({id:'sub_fixture',customer:'cus_fixture',livemode:false,status:'active',items:{data:[{quantity:1,price:{id:'unknown'}}]}});expect((await handler(request('webhook'))).status).toBe(503);expect(mocks.rpc.mock.calls.some(call=>call[0]==='console_billing_sync')).toBe(false)})
})
