import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
export function UpcomingPreview({owner,company,today}:{owner:string;company:string;today:string}) {
 const [rows,setRows]=useState<{id:string;title:string}[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0)
 useEffect(()=>{let live=true;void supabase.from('actions').select('id,title').eq('owner_id',owner).eq('company_id',company).is('deleted_at',null).neq('status','done').gt('due_date',today).order('due_at').order('id').limit(3).then(({data,error})=>{if(live){setRows(Array.isArray(data)?data:[]);setError(Boolean(error))}});return()=>{live=false}},[owner,company,today,retry])
 if(error)return <p role="alert">Upcoming tasks could not be loaded. <button className="md-text-button" onClick={()=>setRetry(v=>v+1)}>Retry upcoming tasks</button></p>
 if(!rows)return <p role="status">Loading upcoming tasks…</p>
 return <>{rows.map(t=><Link key={t.id} to={`/app?task=${t.id}`}>{t.title}</Link>)}</>
}
