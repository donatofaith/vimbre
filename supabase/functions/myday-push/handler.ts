import {deliverSuite} from '../my-day-mail/suite-worker.ts'
type Rpc = (action:string,id?:string|null,data?:Record<string,unknown>)=>Promise<unknown>
export function pushHandler(deps:{claim:(hash:string)=>Promise<unknown>;rpc:Rpc;fetch:typeof fetch}) {
 return async(req:Request)=>{
  if(req.method!=='POST')return new Response(null,{status:405})
  const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization')??'')?.[1]
  if(!token)return new Response(null,{status:401})
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(v=>v.toString(16).padStart(2,'0')).join('')
  let jobs:unknown
  try{jobs=await deps.claim(hash)}catch{return new Response(null,{status:401})}
  try{
   await deliverSuite({rpc:(action,id,data)=>action==='claim'?Promise.resolve(jobs):deps.rpc(action,id,data),fetch:deps.fetch,
    brief:async()=>{throw Error('AI is unavailable in push delivery')},send:async()=>{throw Error('Email is unavailable in push delivery')}})
   return new Response(null,{status:204})
  }catch{return new Response(null,{status:503})}
 }
}
