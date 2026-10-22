type Receive = (value:{address:string;sender:string;messageHash:string;title:string;text:string})=>Promise<void>
async function digest(value:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function matches(actual:string,expected:string){const a=await digest(actual),b=await digest(expected);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
async function body(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing body')
 let size=0;const parts:Uint8Array[]=[]
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512000)throw new Error('Body too large');parts.push(value)}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
export function inboundHandler(secret:string|undefined,receive:Receive){return async(request:Request)=>{
 const reply=(status:number)=>new Response(JSON.stringify({received:status===200}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
 if(request.method!=='POST')return reply(405)
 if(!secret||secret.length<32)return reply(503)
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]??''
 if(!await matches(token,secret))return reply(401)
 try {
  const data=await body(request)
  if(!data||!Array.isArray(data.items)||!data.items.length||data.items.length>10)return reply(400)
  const items=[]
  for(const item of data.items){
   if(!item||typeof item!=='object'||typeof item.MessageId!=='string'||!item.MessageId||item.MessageId.length>1000||typeof item.From?.Address!=='string'||!Array.isArray(item.Recipients)||item.Recipients.length>20)return reply(400)
   const spam=item.SpamScore??item.Spam?.Score
   if(typeof spam==='number'&&spam>=5)continue
   const main=item.ExtractedMarkdownMessage||item.RawTextBody||'',signature=item.ExtractedMarkdownSignature||''
   if(typeof main!=='string'||typeof signature!=='string')return reply(400)
   const text=[main,signature].filter(Boolean).join('\n\n')
   if(typeof text!=='string'||!text.trim()||new TextEncoder().encode(text).length>16000)continue
   const recipients=item.Recipients.map((r:unknown)=>typeof r==='string'?r:r&&typeof r==='object'&&'Address' in r?r.Address:null)
   if(recipients.some((r:unknown)=>typeof r!=='string'||r.length>320))return reply(400)
   const hash=Array.from(await digest(item.MessageId),byte=>byte.toString(16).padStart(2,'0')).join('')
   for(const address of new Set<string>(recipients))items.push({address,sender:item.From.Address,messageHash:hash,title:typeof item.Subject==='string'?item.Subject.slice(0,200):'Forwarded email',text})
  }
  // Unknown addresses and senders return the same response; no mailbox enumeration.
  try{for(const item of items)await receive(item)}catch{return reply(503)}
  return reply(200)
 }catch{return reply(400)}
}}
