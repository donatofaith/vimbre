// A fixed, bounded calendar relay. The capability is never logged or forwarded elsewhere.
const upstream='https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/myday-calendar'
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff')
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');res.statusCode=405;return res.end()}
 const input=new URL(req.url||'','https://vimbre.com'),tokens=input.searchParams.getAll('token')
 if(tokens.length!==1||!/^[a-f0-9]{64}$/.test(tokens[0])){res.statusCode=404;return res.end()}
 try{const target=new URL(upstream);target.searchParams.set('token',tokens[0]);const response=await fetch(target,{method:req.method,redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok){res.statusCode=response.status===404?404:503;return res.end()}if(!response.headers.get('content-type')?.startsWith('text/calendar'))throw Error('invalid_response');const body=req.method==='HEAD'?'':await response.text();if(body.length>2000000)throw Error('too_large');res.statusCode=200;res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition','inline; filename="vimbre-my-day.ics"');return res.end(body)}catch{res.statusCode=503;return res.end()}
}
