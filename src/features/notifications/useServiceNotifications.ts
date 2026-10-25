import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../auth/AuthProvider'
type Notice={id:string;title:string;body:string;link:string;kind:string;read_at:string|null}
export function useServiceNotifications(){
 const {profile}=useAuth(),[rows,setRows]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[error,setError]=useState(false),[revision,setRevision]=useState(0)
 useEffect(()=>{let live=true;async function load(){if(document.hidden||!profile?.id)return;const r=await supabase.rpc('console_customer_notices',{p_action:'list'});if(!live)return;const d=r.data as unknown as {ok?:boolean;data?:{items:Notice[];unread:number}};if(!r.error&&d?.ok&&Array.isArray(d.data?.items)){setRows(d.data.items.filter((n:Notice)=>typeof n.link==='string'&&n.link.startsWith('/app/')&&!n.link.includes('\\')));setUnread(d.data!.unread||0);setError(false)}else if(r.error)setError(true)}void load();const timer=setInterval(()=>void load(),30000);const refresh=()=>void load();window.addEventListener('focus',refresh);return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh)}},[profile?.id,revision])
 async function read(id:string){const r=await supabase.rpc('console_customer_notices',{p_action:'read',p_id:id});if(!r.error&&(r.data as unknown as {ok?:boolean})?.ok)setRevision(n=>n+1);else setError(true)}
 return {rows,unread,error,read,refresh:()=>setRevision(n=>n+1)}
}
