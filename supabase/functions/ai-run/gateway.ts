import { tasks } from './tasks.ts'
import type { Adapter, Attempt, Reservation, Usage, AIDocument } from './types.ts'
import { ProviderError, zeroUsage } from './types.ts'
export type Identity = { userId: string; companyId: string }
export type GatewayDependencies = {
  identify: (token: string) => Promise<Identity | null>
  begin: (userId: string, requestId: string, task: string, fingerprint: string) => Promise<Reservation>
  finish: (usageId: string, attempts: Attempt[]) => Promise<void>
  adapter: (provider: string) => Adapter
}
const origins = new Set(['https://vimbre.com', 'https://www.vimbre.com', 'https://vimbre.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function allowanceMessage(period?: string, resetAt?: string) {
  if (period === 'day') return 'AI drafts are paused until tomorrow (00:00 UTC). You can continue by hand.'
  const date = resetAt ? new Date(resetAt) : null
  if (period === 'month' && date && Number.isFinite(date.getTime())) return `AI drafts are paused until ${new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date)} (00:00 UTC). You can continue by hand.`
  return 'Your company’s AI limit has been reached. You can continue by hand.'
}
const unavailable = 'AI is unavailable right now. You can continue by hand.'
const messages: Record<string, string> = {
  not_configured: 'AI is not enabled for this company yet. You can continue by hand.',
  limit_reached: 'Your company’s AI limit has been reached. You can continue by hand.',
  already_requested: 'This AI request has already been received. You can continue by hand.',
  idempotency_conflict: 'Use a new request reference for different text. You can continue by hand.',
}
async function boundedBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('No body')
  let size = 0; const chunks: Uint8Array[] = []
  try {
    while (true) { const {done,value} = await reader.read(); if(done)break; size += value.byteLength; if(size>2900000)throw new Error('Body too large'); chunks.push(value) }
  } catch (error) { await reader.cancel(); throw error }
  finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
async function fingerprint(task: string, text: string, document?: AIDocument) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([task,text,document??null])))
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')
}
function measured(usage: Usage | null) {
  return {input_tokens: usage?.inputTokens ?? null, output_tokens: usage?.outputTokens ?? null}
}
export function createGateway(deps: GatewayDependencies, timeoutMs = 30000) {
  return async function handle(request: Request): Promise<Response> {
    const origin=request.headers.get('origin')
    const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origin&&origins.has(origin)?origin:'https://vimbre.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST, OPTIONS'}
    const fail=(status:number,message=unavailable,code?:string)=>new Response(JSON.stringify({ok:false,message,can_continue_manually:true,...(code?{code}:{})}),{status,headers})
    if(origin&&!origins.has(origin))return fail(403,'This app address is not allowed.')
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
    if(request.method!=='POST')return fail(405,'Use POST to request an AI draft.')
    const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
    if(!token)return fail(401,'Sign in to use AI. You can continue by hand.')
    try {
      const identity=await deps.identify(token)
      if(!identity)return fail(401,'Sign in with an active account to use AI. You can continue by hand.')
      let body: {task: string; text: string; document?: AIDocument}
      try {
        const data=await boundedBody(request)
        if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).some(k=>k!=='task'&&k!=='text'&&k!=='document')||
          typeof data.task!=='string'||!Object.hasOwn(tasks,data.task)||typeof data.text!=='string'||!data.text.trim()||new TextEncoder().encode(data.text).byteLength>16000)throw new Error('Invalid input')
        if(data.document!==undefined) {
          const doc=data.document
          if(data.task!=='role_document'||!doc||typeof doc!=='object'||Array.isArray(doc)||Object.keys(doc).some(k=>k!=='media_type'&&k!=='data')||doc.media_type!=='application/pdf'||typeof doc.data!=='string'||doc.data.length>2796204||!doc.data.length||doc.data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(doc.data))throw new Error('Invalid document')
          const decoded=atob(doc.data)
          if(decoded.length>2097152||!decoded.startsWith('%PDF-'))throw new Error('Invalid document')
        }
        body=data
      } catch {return fail(400,'Choose a valid AI task and add up to 16 KB of text. You can continue by hand.')}
      const requestId=request.headers.get('idempotency-key')??crypto.randomUUID()
      if(!uuid.test(requestId))return fail(400,'Use a valid request reference. You can continue by hand.')
      const reservation=await deps.begin(identity.userId,requestId,body.task,await fingerprint(body.task,body.text,body.document))
      if(!reservation.ok)return fail(reservation.code==='limit_reached'?429:reservation.code==='already_requested'||reservation.code==='idempotency_conflict'?409:403,reservation.code==='limit_reached'?allowanceMessage(reservation.period,reservation.reset_at):messages[reservation.code??'']??unavailable,reservation.code==='limit_reached'?'limit_reached':undefined)
      if(!reservation.route||!reservation.usage_id||reservation.company_id!==identity.companyId) return fail(503)
      const route=reservation.route, attempts:Attempt[]=[]
      let answer=''
      for(const model of [route.primary,route.fallback]) {
        if(!model)break
        const controller=new AbortController()
        let dispatched=false
        let timer:ReturnType<typeof setTimeout>|undefined
        try {
          const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ProviderError('timeout',dispatched?null:zeroUsage))},timeoutMs)})
          const result=await Promise.race([deadline,Promise.resolve().then(()=>deps.adapter(model.provider).generate({model,system:tasks[body.task],text:body.text,document:body.document,maxOutputTokens:route.max_output_tokens,temperature:route.temperature,signal:controller.signal,onDispatch:()=>{dispatched=true}}))])
          const usable=result.text.trim().length>0 && result.stopReason==='end_turn'
          attempts.push({model_id:model.id,...measured(result),outcome:usable?'success':'failed'})
          if(usable){answer=result.text;break}
        } catch(error) {
          const failure=error instanceof ProviderError?error:new ProviderError('failed',dispatched?null:zeroUsage)
          attempts.push({model_id:model.id,...measured(failure.usage),outcome:failure.kind})
        } finally {clearTimeout(timer);controller.abort()}
      }
      // Fail closed if logging fails. Retry only this idempotent DB write, never the provider.
      try {await deps.finish(reservation.usage_id,attempts)} catch {await deps.finish(reservation.usage_id,attempts)}
      if(!answer)return fail(502)
      return new Response(JSON.stringify({ok:true,text:answer,request_id:requestId}),{status:200,headers})
    } catch {return fail(503)}
  }
}
