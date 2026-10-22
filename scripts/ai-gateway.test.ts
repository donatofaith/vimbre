import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGateway } from '../supabase/functions/ai-run/gateway'
import type { GatewayDependencies } from '../supabase/functions/ai-run/gateway'
import { ProviderError, zeroUsage } from '../supabase/functions/ai-run/types'
import type { AdapterInput, AdapterOutput, Model, Reservation } from '../supabase/functions/ai-run/types'
import { anthropicAdapter } from '../supabase/functions/ai-run/adapters/anthropic'
import { providerAdapter } from '../supabase/functions/ai-run/adapters/index'
import { readFileSync, readdirSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const primary:Model={id:'primary',provider:'anthropic',model_name:'claude-haiku-5-5',input_price_per_million:0.1,output_price_per_million:0.5,enabled:true}
const fallback:Model={...primary,id:'fallback',model_name:'claude-sonnet-5-5',input_price_per_million:2,output_price_per_million:10}
const result:AdapterOutput={text:'A reviewed draft.',inputTokens:12,outputTokens:7,model:primary.model_name,stopReason:'end_turn'}
const reservation:Reservation={ok:true,usage_id:'usage-id',company_id:'server-company',route:{task:'tidy_text',primary,fallback,max_output_tokens:2048,temperature:null}}
function fixture() {
 const generate=vi.fn<(...args: [AdapterInput])=>Promise<AdapterOutput>>().mockResolvedValue(result)
 const deps:GatewayDependencies={identify:vi.fn(async(token:string)=>token==='valid'?{userId:'server-user',companyId:'server-company'}:null),begin:vi.fn(async()=>reservation),finish:vi.fn(async()=>{}),adapter:vi.fn(()=>({generate}))}
 const handle=createGateway(deps,20)
 const call=(body:unknown={task:'tidy_text',text:'Fix this sentence.'},headers:Record<string,string>={})=>handle(new Request('https://example.invalid/ai-run',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json',origin:'https://vimbre.com',...headers},body:JSON.stringify(body)}))
 return {deps,generate,handle,call}
}
describe('AI gateway boundary and routing',()=>{
 beforeEach(()=>vi.restoreAllMocks())
 it('denies signed out and inactive callers before reservations or provider calls',async()=>{
  const app=fixture();expect((await app.call(undefined,{authorization:''})).status).toBe(401);expect((await app.call(undefined,{authorization:'Bearer inactive'})).status).toBe(401);expect(app.deps.begin).not.toHaveBeenCalled();expect(app.generate).not.toHaveBeenCalled()
 })
 it('rejects forged company/user/model/token/temperature/prompt fields',async()=>{
  for(const field of ['company_id','user_id','model','max_output_tokens','temperature','system','api_key']){const app=fixture();expect((await app.call({task:'tidy_text',text:'Text',[field]:'forged'})).status).toBe(400);expect(app.deps.begin).not.toHaveBeenCalled()}
 })
 it('checks tasks, malformed input and UTF8 size rather than character count',async()=>{
  const app=fixture();for(const body of [null,[],{}, {task:'toString',text:'Text'},{task:'unknown',text:'Text'},{task:'tidy_text',text:'   '},{task:'tidy_text',text:'😀'.repeat(5000)}])expect((await app.call(body)).status).toBe(400)
  expect(app.generate).not.toHaveBeenCalled()
 })
 it('rejects unapproved origins and supports explicit preflight',async()=>{
  const app=fixture();expect((await app.call(undefined,{origin:'https://untrusted.invalid'})).status).toBe(403)
  expect((await app.handle(new Request('https://example.invalid',{method:'OPTIONS',headers:{origin:'https://vimbre.com'}}))).status).toBe(204)
  expect((await app.handle(new Request('https://example.invalid'))).status).toBe(405)
 })
 it('takes identity from the verified profile and settings from the service route',async()=>{
  const app=fixture();const response=await app.call();expect(response.status).toBe(200);expect(app.deps.begin).toHaveBeenCalledWith('server-user',expect.any(String),'tidy_text',expect.stringMatching(/^[0-9a-f]{64}$/));expect(app.generate.mock.calls[0][0]).toMatchObject({model:primary,maxOutputTokens:2048,temperature:null});expect(app.generate.mock.calls[0][0].system).toContain('Correct spelling');expect(app.deps.finish).toHaveBeenCalledExactlyOnceWith('usage-id',[{model_id:'primary',input_tokens:12,output_tokens:7,outcome:'success'}]);expect(await response.json()).not.toHaveProperty('company_id')
 })
 it.each(['not_configured','limit_reached','already_requested','idempotency_conflict','route_unavailable'])('blocks %s without a provider call',async(code)=>{
  const app=fixture();vi.mocked(app.deps.begin).mockResolvedValue({ok:false,code});const response=await app.call();expect(response.status).not.toBe(200);expect(await response.json()).toMatchObject({ok:false,can_continue_manually:true});expect(app.generate).not.toHaveBeenCalled();expect(app.deps.finish).not.toHaveBeenCalled()
 })
 it('preserves caller retry references and rejects malformed references',async()=>{
  const app=fixture();const id='11111111-1111-4111-8111-111111111111';expect((await app.call(undefined,{'idempotency-key':id})).status).toBe(200);expect(app.deps.begin).toHaveBeenCalledWith('server-user',id,'tidy_text',expect.any(String));expect((await app.call(undefined,{'idempotency-key':'invalid'})).status).toBe(400)
 })
 it('retries once using the fallback and logs both attempts in one usage completion',async()=>{
  const app=fixture();app.generate.mockRejectedValueOnce(new ProviderError('failed',zeroUsage));expect((await app.call()).status).toBe(200);expect(app.generate).toHaveBeenCalledTimes(2);expect(app.generate.mock.calls[1][0].model.id).toBe('fallback');expect(app.deps.finish).toHaveBeenCalledTimes(1);expect(vi.mocked(app.deps.finish).mock.calls[0][1]).toHaveLength(2)
 })
 it('aborts a hung primary after the deadline, retains unknown billing and falls back once',async()=>{
  const app=fixture();let signal:AbortSignal|undefined
  app.generate.mockImplementationOnce(async input=>{signal=input.signal;input.onDispatch();return new Promise(()=>{})})
  expect((await app.call()).status).toBe(200);expect(signal?.aborted).toBe(true);expect(app.generate).toHaveBeenCalledTimes(2);expect(vi.mocked(app.deps.finish).mock.calls[0][1][0]).toMatchObject({outcome:'timeout',input_tokens:null,output_tokens:null})
 })
 it('does not charge a preflight timeout as a dispatched generation',async()=>{
  const app=fixture();app.generate.mockImplementationOnce(async()=>new Promise(()=>{}));await app.call();expect(vi.mocked(app.deps.finish).mock.calls[0][1][0]).toMatchObject({outcome:'timeout',input_tokens:0,output_tokens:0})
 })
 it('has no third provider attempt, exposes no provider error and allows manual work',async()=>{
  const app=fixture();app.generate.mockRejectedValue(new Error('Secret upstream diagnostic'));const response=await app.call();expect(response.status).toBe(502);const body=await response.json();expect(body.message).toContain('continue by hand');expect(JSON.stringify(body)).not.toContain('Secret');expect(app.generate).toHaveBeenCalledTimes(2);expect(app.deps.finish).toHaveBeenCalledTimes(1)
 })
 it('counts a billed but empty, refused or truncated primary before fallback',async()=>{
  for(const bad of [{...result,text:''},{...result,stopReason:'max_tokens'},{...result,stopReason:'refusal'}]){const app=fixture();app.generate.mockResolvedValueOnce(bad);await app.call();expect(app.generate).toHaveBeenCalledTimes(2);expect(vi.mocked(app.deps.finish).mock.calls[0][1][0]).toMatchObject({input_tokens:12,output_tokens:7,outcome:'failed'})}
 })
 it('does not rerun providers if usage logging must be retried',async()=>{
  const app=fixture();vi.mocked(app.deps.finish).mockRejectedValueOnce(new Error('temporary'));expect((await app.call()).status).toBe(200);expect(app.generate).toHaveBeenCalledTimes(1);expect(app.deps.finish).toHaveBeenCalledTimes(2)
 })
 it('does not return a draft when logging fails twice or reservation identity disagrees',async()=>{
  const app=fixture();vi.mocked(app.deps.finish).mockRejectedValue(new Error('unavailable'));expect((await app.call()).status).toBe(503);expect(app.generate).toHaveBeenCalledTimes(1)
  const other=fixture();vi.mocked(other.deps.begin).mockResolvedValue({...reservation,company_id:'foreign-company'});expect((await other.call()).status).toBe(503);expect(other.generate).not.toHaveBeenCalled()
 })
})
const adapterInput=(extra:Partial<AdapterInput>={}):AdapterInput=>({model:primary,system:'Do the task.',text:'Source text.',maxOutputTokens:128,temperature:null,signal:new AbortController().signal,onDispatch:vi.fn(),...extra})
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
const message={model:'claude-haiku-5-5',content:[{type:'thinking',thinking:'Private thinking'},{type:'text',text:'Clean draft.'}],usage:{input_tokens:15,output_tokens:9},stop_reason:'end_turn'}
describe('Anthropic provider adapter contract',()=>{
 it('counts tokens, sends only server settings, reads actual usage and never returns thinking',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValueOnce(json({input_tokens:15})).mockResolvedValueOnce(json(message));const output=await anthropicAdapter('test-key',request).generate(adapterInput())
  expect(output).toEqual({text:'Clean draft.',model:'claude-haiku-5-5',inputTokens:15,outputTokens:9,stopReason:'end_turn'});expect(request.mock.calls[0][0]).toContain('/count_tokens');const options=request.mock.calls[1][1]!;expect(options.headers).toMatchObject({'x-api-key':'test-key','anthropic-version':'2023-06-01'});const body=JSON.parse(String(options.body));expect(body.max_tokens).toBe(128);expect(body).not.toHaveProperty('temperature');expect(body).not.toHaveProperty('tools');expect(body).not.toHaveProperty('cache_control')
 })
 it('does not generate after counting errors or an input over the pricing-safe ceiling',async()=>{
  for(const response of [json({},503),json({input_tokens:32769}),json({input_tokens:-1})]){const request=vi.fn<typeof fetch>().mockResolvedValue(response);await expect(anthropicAdapter('test-key',request).generate(adapterInput())).rejects.toMatchObject({usage:zeroUsage});expect(request).toHaveBeenCalledTimes(1)}
 })
 it('rejects missing credentials and custom sampling before making network calls',async()=>{
  const request=vi.fn<typeof fetch>();await expect(anthropicAdapter('',request).generate(adapterInput())).rejects.toMatchObject({usage:zeroUsage});await expect(anthropicAdapter('test-key',request).generate(adapterInput({temperature:0.2}))).rejects.toMatchObject({usage:zeroUsage});expect(request).not.toHaveBeenCalled()
 })
 it('keeps 4xx failures unbilled and 5xx/network outcomes uncertain',async()=>{
  for(const [status,expected] of [[429,zeroUsage],[401,zeroUsage],[503,null]] as const){const request=vi.fn<typeof fetch>().mockResolvedValueOnce(json({input_tokens:15})).mockResolvedValueOnce(json({},status));await expect(anthropicAdapter('test-key',request).generate(adapterInput())).rejects.toMatchObject({usage:expected})}
 })
 it('rejects an unrelated model and missing usage without returning an unlogged draft',async()=>{
  for(const body of [{...message,model:'unrelated'},{...message,usage:{}}]){const request=vi.fn<typeof fetch>().mockResolvedValueOnce(json({input_tokens:15})).mockResolvedValueOnce(json(body));await expect(anthropicAdapter('test-key',request).generate(adapterInput())).rejects.toBeInstanceOf(ProviderError)}
 })
 it('keeps provider registry secrets on the server and refuses unknown providers',()=>{
  const secret=vi.fn(()=>undefined);expect(providerAdapter('anthropic',secret)).toHaveProperty('generate');expect(secret).toHaveBeenCalledExactlyOnceWith('ANTHROPIC_API_KEY');expect(()=>providerAdapter('unknown',secret)).toThrow(ProviderError)
 })
})
describe('deployed entrypoint authorization wiring',()=>{
 it('uses getUser and the active protected profile, never metadata or caller company',async()=>{
  let handler:(r:Request)=>Promise<Response>;let verified=false;let active=true
  const source=readFileSync(new URL('../supabase/functions/ai-run/index.ts',import.meta.url),'utf8')
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
  const client=()=>({auth:{getUser:vi.fn(async()=>({data:{user:verified?{id:'verified-user',email_confirmed_at:'date',user_metadata:{company_id:'forged-company'}}:null},error:null}))},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'verified-user',company_id:'protected-company',active},error:null})})})})})
  let captured:GatewayDependencies|undefined
  vm.runInNewContext(code,{exports:{},Request,Response,AbortSignal,fetch,require:(name:string)=>name==='@supabase/supabase-js'?{createClient:client}:name==='./gateway.ts'?{createGateway:(deps:GatewayDependencies)=>{captured=deps;return async()=>new Response()}}:{providerAdapter},Deno:{env:{get:()=>''},serve:(h:typeof handler)=>{handler=h}}})
  expect(await captured!.identify('invalid')).toBeNull();verified=true;expect(await captured!.identify('valid')).toEqual({userId:'verified-user',companyId:'protected-company'});active=false;expect(await captured!.identify('valid')).toBeNull()
 })
 it('leaves provider HTTP calls out of frontend and all other features',()=>{
  function files(directory:string):string[]{return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(`${directory}/${entry.name}`):[`${directory}/${entry.name}`])}
  for(const file of files('src').filter(path=>/\.[tj]sx?$/.test(path))){const body=readFileSync(file,'utf8');expect(body,file).not.toMatch(/api\.anthropic\.com|api\.openai\.com|ANTHROPIC_API_KEY|@anthropic-ai/)}
  expect(readFileSync('src/lib/ai-gateway.ts','utf8')).toContain("invoke('ai-run'")
 })
})


describe('Allowance reset messages', () => {
 it('uses UTC reset dates and retains manual continuation', async () => {
  const { allowanceMessage } = await import('../supabase/functions/ai-run/gateway.ts')
  expect(allowanceMessage('day','2026-10-23T00:00:00Z')).toContain('tomorrow (00:00 UTC)')
  expect(allowanceMessage('month','2026-11-01T00:00:00Z')).toContain('1 November 2026 (00:00 UTC)')
  expect(allowanceMessage('month','bad')).toContain('continue by hand')
 })
})

describe('Structured task and PDF requests',()=>{
 it('routes all structured tasks through the same authenticated budget boundary',async()=>{
  for(const task of ['role_responsibility','role_workstream','role_external_contact','role_document','role_recurring_deadline','role_decision','tasks_extract']){const app=fixture();expect((await app.call({task,text:'Supplier review notes'})).status).toBe(200);expect(app.deps.begin).toHaveBeenCalledOnce()}
 })
 it('allows a bounded PDF only for document drafting and fingerprints its contents',async()=>{
  const document={media_type:'application/pdf',data:btoa('%PDF-fixture')},app=fixture()
  expect((await app.call({task:'role_document',text:'Describe this file',document})).status).toBe(200)
  expect(app.generate.mock.calls[0][0].document).toEqual(document)
  const hash=(app.deps.begin as ReturnType<typeof vi.fn>).mock.calls[0][3]
  await app.call({task:'role_document',text:'Describe this file',document:{...document,data:btoa('%PDF-other')}})
  expect((app.deps.begin as ReturnType<typeof vi.fn>).mock.calls[1][3]).not.toBe(hash)
  for(const body of [{task:'tidy_text',text:'Text',document},{task:'role_document',text:'Text',document:{...document,data:btoa('not a PDF')}},{task:'role_document',text:'Text',document:{...document,url:'https://internal.invalid'}}])expect((await app.call(body)).status).toBe(400)
 })
})

 it('counts and generates using the same PDF content without storing or fetching a URL',async()=>{
  const bodies:Record<string, any>[]=[]
  const request=vi.fn(async(_url:unknown,init?:RequestInit)=>{bodies.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify(bodies.length===1?{input_tokens:20}:{model:primary.model_name,usage:{input_tokens:20,output_tokens:10},content:[{type:'text',text:'{"items":[]}'}],stop_reason:'end_turn'}),{status:200})}) as unknown as typeof fetch
  await anthropicAdapter('fixture-key',request).generate({model:primary,system:'Document draft',text:'Describe the file',document:{media_type:'application/pdf',data:btoa('%PDF-fixture')},temperature:null,maxOutputTokens:4096,signal:new AbortController().signal,onDispatch:()=>{}})
  expect(bodies[0].messages).toEqual(bodies[1].messages);expect(bodies[1].messages[0].content[0].source).toEqual({type:'base64',media_type:'application/pdf',data:btoa('%PDF-fixture')})
 })
