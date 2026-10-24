import {afterEach,describe,it,expect,vi} from 'vitest'
// @ts-expect-error Node function is intentionally dependency-free JavaScript.
import handler from '../api/capture/callback.mjs'
const state='a'.repeat(64)
async function call(url:string,method='GET') {const headers:Record<string,string>={};const res={statusCode:0,setHeader:(k:string,v:string)=>{headers[k]=v},end:()=>{}};await handler({url,method},res);return {status:res.statusCode,headers}}
afterEach(()=>vi.unstubAllGlobals())
describe('branded OAuth callback',()=>{
 it('passes only whitelisted parameters to a fixed backend and returns a private fragment',async()=>{const fetch=vi.fn().mockResolvedValue(new Response(null,{status:303,headers:{location:'https://vimbre.com/app/capture#tool_connect=1&state='+state+'&code=test-code'}}));vi.stubGlobal('fetch',fetch);const r=await call('/api/capture/callback?state='+state+'&code=test-code&redirect_uri=https://evil.invalid');expect(r.status).toBe(303);expect(r.headers.Location).toContain('#tool_connect=1');expect(r.headers['Cache-Control']).toContain('no-store');expect(r.headers['Referrer-Policy']).toBe('no-referrer');const u=fetch.mock.calls[0][0] as URL;expect(u.origin).toBe('https://ijyjrooarwoafkykvzjp.supabase.co');expect(u.searchParams.has('redirect_uri')).toBe(false);expect(fetch.mock.calls[0][1].redirect).toBe('manual')})
 it.each(['https://evil.invalid/app/capture#tool_connect=1&state='+state,'https://vimbre.com/login','https://vimbre.com/app/capture#tool_connect=1&state='+('b'.repeat(64)),'https://vimbre.com/app/capture?code=leak'])('rejects unsafe upstream location %s',async location=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:303,headers:{location}})));expect((await call('?state='+state)).headers.Location).toBe('https://vimbre.com/app/capture?connection=failed')})
 it('rejects malformed or duplicate state before network access',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);await call('?state=bad');await call('?state='+state+'&state='+state);expect(f).not.toHaveBeenCalled()})
 it('fails closed when backend is unavailable',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));expect((await call('?state='+state)).headers.Location).toBe('https://vimbre.com/app/capture?connection=failed')})
 it('rejects POST without forwarding credentials or body',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);expect((await call('?state='+state,'POST')).status).toBe(405);expect(f).not.toHaveBeenCalled()})
})
