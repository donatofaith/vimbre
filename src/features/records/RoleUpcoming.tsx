import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {supabase} from '../../lib/supabase'
import {formatRecordDate} from './record-utils'
export function RoleUpcoming(){
 const [data,setData]=useState<{deadlines:{id:string;role_id:string;title:string;due_date:string}[];review:boolean}|null>(null),[failed,setFailed]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;const refresh=()=>{void supabase.rpc('role_workspace',{p_operation:'upcoming'}).then(({data,error})=>{if(!live)return;setFailed(Boolean(error));setData(!error&&data&&typeof data==='object'&&'deadlines' in data?data as unknown as {deadlines:{id:string;role_id:string;title:string;due_date:string}[];review:boolean}:null)})};refresh();window.addEventListener('vimbre:work-changed',refresh);window.addEventListener('focus',refresh);return()=>{live=false;window.removeEventListener('vimbre:work-changed',refresh);window.removeEventListener('focus',refresh)}},[revision]);
 if(failed)return <p role="alert">Role deadlines could not be loaded. <button onClick={()=>setRevision(v=>v+1)}>Retry deadlines</button></p>;
 if(!data)return null;
 return <>{data.review&&<p><Link to="/app/role-record">Review your role this month</Link></p>}{data.deadlines.slice(0,5).map(d=><p key={d.id}><Link to={`/app/role-record?role=${d.role_id}&section=recurring_deadline&record=${d.id}`}>{d.title}</Link> · {formatRecordDate(d.due_date)}</p>)}</>
}
