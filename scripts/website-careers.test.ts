import {it,expect}from 'vitest'
import {handler}from '../supabase/functions/website-careers/handler'
const env=(key:string)=>({SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-secret',BREVO_TRANSACTIONAL_KEY:'mail-secret',VIMBRE_REMINDER_SENDER:'notifications@example.invalid'}[key])
const application={full_name:' Alex Morgan ',email:' ALEX@example.invalid ',interest:'Engineering',location:'London',portfolio:'https://example.invalid/',message:'I would like to help build Vimbre.',consent:true}
const request=(body:unknown,origin='https://vimbre.com')=>new Request('https://database.invalid/functions/v1/website-careers',{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)})
const body={action:'submit',request_id:'11111111-1111-4111-8111-111111111111',application,website:''}
it('stores normalized details with hashed abuse keys and sends only a Console link to the fixed recipient',async()=>{const calls:{url:string;body:any}[]=[],work:Promise<unknown>[]=[];const fetcher:typeof fetch=async(input,init)=>{const b=JSON.parse(String(init?.body));calls.push({url:String(input),body:b});return Response.json(b.p_action==='claim'?{ok:true,jobs:[{id:'notification-1',lease:'lease-1'}]}:{ok:true})};const r=await handler(request(body),env,fetcher,p=>work.push(p));await Promise.all(work);expect(r.status).toBe(200);expect(calls[0].body.p_data.application.email).toBe('alex@example.invalid');for(const key of ['ip_hash','email_hash','request_hash'])expect(calls[0].body.p_data[key]).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(calls[0].body)).not.toContain('192.0.2.1');const mail=calls.find(c=>c.url.includes('brevo'))!.body;expect(mail.to).toEqual([{email:'hellovimbre@gmail.com'}]);expect(mail.textContent).toContain('https://admin.vimbre.com/careers');expect(mail.textContent).not.toContain('alex@example.invalid');expect(mail.headers.idempotencyKey).toBe('notification-1');expect(calls.at(-1)!.body.p_data.accepted).toBe(true)})
it('records email failure without losing the accepted enquiry',async()=>{const work:Promise<unknown>[]=[],calls:any[]=[];const fetcher:typeof fetch=async(input,init)=>{const b=JSON.parse(String(init?.body));calls.push(b);return String(input).includes('brevo')?Response.json({error:true},{status:503}):Response.json(b.p_action==='claim'?{ok:true,jobs:[{id:'n',lease:'l'}]}:{ok:true})};expect((await handler(request(body),env,fetcher,p=>work.push(p))).status).toBe(200);await Promise.all(work);expect(calls.at(-1).p_data.accepted).toBe(false)})
it('does not store or notify for a filled honeypot',async()=>{let calls=0;const r=await handler(request({...body,website:'spam'}),env,async()=>{calls++;throw Error()});expect(r.status).toBe(200);expect(calls).toBe(0)})
it('rejects an unrelated origin and missing consent before accessing the database',async()=>{let calls=0;const f:typeof fetch=async()=>{calls++;throw Error()};expect((await handler(request(body,'https://unrelated.invalid'),env,f)).status).toBe(403);expect((await handler(request({...body,application:{...application,consent:false}}),env,f)).status).toBe(400);expect(calls).toBe(0)})
it('returns a rate limit response without starting delivery',async()=>{const r=await handler(request(body),env,async()=>Response.json({ok:false,code:'rate_limited'}));expect(r.status).toBe(429)})
it('rejects forged dispatch credentials without sending mail',async()=>{const r=await handler(request({action:'dispatch',token:'a'.repeat(64)},''),env,async()=>Response.json({ok:false,code:'access_denied'}));expect(r.status).toBe(403);expect((await r.json()).ok).toBe(false)})
it('limits request size before parsing or storing it',async()=>{expect((await handler(request({...body,padding:'a'.repeat(17000)}),env)).status).toBe(413)})

it('sends separate branded emails and retries only the job that failed', async () => {
  const work: Promise<unknown>[] = []
  const finished: {p_id:string;p_data:{accepted:boolean}}[] = []
  const sent: {to:{email:string}[];subject:string;textContent:string;htmlContent:string;headers:{idempotencyKey:string}}[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const payload = JSON.parse(String(init?.body))
    if (String(input).includes('brevo')) {
      sent.push(payload)
      return Response.json({}, {status: sent.length === 1 ? 200 : 503})
    }
    if (payload.p_action === 'claim') return Response.json({ok:true,jobs:[
      {id:'staff-job',lease:'staff-lease',kind:'staff'},
      {id:'applicant-job',lease:'applicant-lease',kind:'applicant',recipient:'alex@example.invalid'},
    ]})
    if (payload.p_action === 'finish') finished.push(payload)
    return Response.json({ok:true})
  }
  const response = await handler(request(body), env, fetcher, job => work.push(job))
  expect(response.status).toBe(200)
  await Promise.all(work)
  expect(sent.map(mail => mail.to[0].email)).toEqual(['hellovimbre@gmail.com','alex@example.invalid'])
  expect(sent[0].htmlContent).toContain('Review application')
  expect(sent[0].textContent).not.toContain('advertised role')
  expect(sent[1].textContent).toContain('will be in touch if a suitable opportunity comes up.')
  expect(sent[1].htmlContent).not.toContain('admin.vimbre.com')
  expect(sent[1].headers.idempotencyKey).toBe('applicant-job')
  expect(finished.map(job => [job.p_id,job.p_data.accepted])).toEqual([['staff-job',true],['applicant-job',false]])
})
