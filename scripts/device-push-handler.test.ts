import {it,expect,vi} from 'vitest'
import {pushHandler} from '../supabase/functions/myday-push/handler'
const request=(token='a'.repeat(64))=>new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer '+token}})
it('rejects invalid authentication before accessing jobs',async()=>{const claim=vi.fn();const r=await pushHandler({claim,rpc:vi.fn(),fetch:vi.fn()})(request('bad'));expect(r.status).toBe(401);expect(claim).not.toHaveBeenCalled()})
it('does not deliver when the database rejects the dispatch credential',async()=>{const rpc=vi.fn(),send=vi.fn();const r=await pushHandler({claim:async()=>{throw Error('Denied')},rpc,fetch:send})(request());expect(r.status).toBe(401);expect(rpc).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled()})
it('hashes the dispatch token and handles an empty push queue without email or AI',async()=>{const claim=vi.fn(async()=>[]),rpc=vi.fn(),send=vi.fn();const r=await pushHandler({claim,rpc,fetch:send})(request());expect(r.status).toBe(204);expect(claim.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);expect(claim.mock.calls[0][0]).not.toBe('a'.repeat(64));expect(rpc).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled()})
it('cancels read or inaccessible chat sources without external delivery',async()=>{const rpc=vi.fn(async()=>null),send=vi.fn();const r=await pushHandler({claim:async()=>[{id:'job',kind:'push'}],rpc,fetch:send})(request());expect(r.status).toBe(204);expect(rpc).toHaveBeenLastCalledWith('finish','job',{state:'cancelled'});expect(send).not.toHaveBeenCalled()})

vi.mock('../supabase/functions/my-day-mail/web-push.ts',()=>({pushRequest:vi.fn(async()=>({url:'https://fcm.googleapis.com/test',headers:{},body:new Uint8Array()}))}))
for(const [status,state] of [[201,'sent'],[403,'failed'],[410,'cancelled']] as const)it(`records provider ${status} as ${state}`,async()=>{
 const rpc=vi.fn(async(op:string)=>op==='source'?{notice:{title:'New chat message'},subscriptions:[{endpoint:'https://fcm.googleapis.com/test'}]}:op==='vapid_private'?{}:{}),send=vi.fn(async()=>new Response(null,{status}));
 const response=await pushHandler({claim:async()=>[{id:'push',kind:'push'}],rpc,fetch:send})(request());
 expect(response.status).toBe(204);expect(send).toHaveBeenCalledOnce();expect(rpc).toHaveBeenLastCalledWith('finish','push',{state});if(status===410)expect(rpc).toHaveBeenCalledWith('push_remove','push',{endpoint:'https://fcm.googleapis.com/test'});
})
it('records an ambiguous provider timeout without a blind resend',async()=>{const send=vi.fn(async()=>{throw Error('timeout')}),rpc=vi.fn(async(op:string)=>op==='source'?{notice:{},subscriptions:[{endpoint:'https://fcm.googleapis.com/test'}]}:{});await pushHandler({claim:async()=>[{id:'push',kind:'push'}],rpc,fetch:send})(request());expect(send).toHaveBeenCalledOnce();expect(rpc).toHaveBeenLastCalledWith('finish','push',{state:'uncertain'})})
