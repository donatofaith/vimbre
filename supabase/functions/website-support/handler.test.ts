import{describe,it,expect,vi}from'vitest'
import{handle}from'./handler'
const env=(n:string)=>n==='SUPABASE_URL'?'https://fixture.invalid':n==='SUPABASE_SERVICE_ROLE_KEY'?'server-only-test-key':undefined
const req=(body:unknown,origin='https://vimbre.com')=>new Request('https://fixture.invalid',{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)})
describe('website chat boundary',()=>{
 it('rejects other origins before calling the service',async()=>{const fetch=vi.fn();expect((await handle(req({action:'read',token:'a'.repeat(64)},'https://other.invalid'),env,fetch)).status).toBe(403);expect(fetch).not.toHaveBeenCalled()});
 it('hashes tokens and IPs and never returns the service key',async()=>{const fetch=vi.fn(async(_url,init)=>{const b=JSON.parse(String(init?.body));expect(b.p_hash).toMatch(/^[a-f0-9]{64}$/);expect(b.p_hash).not.toBe('a'.repeat(64));expect(b.p_ip_hash).not.toContain('192.0.2.1');return Response.json({ok:true,data:{messages:[]}})});const r=await handle(req({action:'read',token:'a'.repeat(64)}),env,fetch as typeof globalThis.fetch);expect(r.status).toBe(200);expect(await r.text()).not.toContain('server-only-test-key')});
 it('rejects malformed tokens and oversize messages',async()=>{const fetch=vi.fn();expect((await handle(req({action:'read',token:'bad'}),env,fetch)).status).toBe(400);expect((await handle(req({action:'reply',token:'a'.repeat(64),body:'x'.repeat(2001)}),env,fetch)).status).toBe(400);expect(fetch).not.toHaveBeenCalled()});
 it('preserves rate limiting as a retryable status',async()=>{const r=await handle(req({action:'read',token:'a'.repeat(64)}),env,async()=>Response.json({ok:false,code:'rate_limited'}));expect(r.status).toBe(429)});
})
