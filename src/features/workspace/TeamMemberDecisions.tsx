import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { safeRecordUrl } from '../records/record-utils'
type Decision = { id:string; title:string; reason:string; decided_by:string; decided_on:string; status:string; source_url:string|null }
export function TeamMemberDecisions({owner}: {owner:string}) {
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const key=`${owner}:${page}:${revision}`
 const [result,setResult]=useState<{key:string;rows:Decision[];count:number;error:boolean}|null>(null)
 useEffect(()=>{
  let cancelled=false
  void supabase.from('decisions').select('id,title,reason,decided_by,decided_on,status,source_url',{count:'exact'}).eq('owner_id',owner).is('deleted_at',null).order('decided_on',{ascending:false}).order('id').range(page*20,page*20+19).then(({data,count,error})=>{if(!cancelled)setResult({key,rows:data??[],count:count??0,error:Boolean(error)})})
  return()=>{cancelled=true}
 },[owner,page,key])
 const current=result?.key===key?result:null
 return <section className="card vt-decisions"><h2>Decisions</h2>{!current?<p role="status">Loading decisions…</p>:current.error?<><p role="alert">Decisions could not be loaded.</p><Button onClick={()=>setRevision(n=>n+1)}>Retry decisions</Button></>:<>{current.rows.length===0?<p>No confirmed decisions.</p>:<ul className="record-list">{current.rows.map(d=><li key={d.id}><article><h3>{d.title}</h3><p className="record-text">{d.reason}</p><p>{d.decided_by} · <time dateTime={d.decided_on}>{d.decided_on}</time> · {d.status}</p>{safeRecordUrl(d.source_url) && <a href={safeRecordUrl(d.source_url)!} target="_blank" rel="noopener noreferrer">Open source link</a>}</article></li>)}</ul>}{(page>0||current.count>20)&&<div className="pagination"><Button disabled={page===0} onClick={()=>setPage(n=>n-1)}>Previous decisions</Button><span>Page {page+1}</span><Button disabled={(page+1)*20>=current.count} onClick={()=>setPage(n=>n+1)}>Next decisions</Button></div>}</>}</section>
}
