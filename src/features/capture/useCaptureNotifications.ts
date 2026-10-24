import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../auth/AuthProvider'
type Inbox={count:number;rows:{id:string;title:string;created_at:string}[]}
const empty:Inbox={count:0,rows:[]}
export function useCaptureNotifications(){const {profile}=useAuth();const [inbox,setInbox]=useState(empty),[error,setError]=useState(false),[revision,setRevision]=useState(0)
 useEffect(()=>{let active=true;async function load(){if(document.hidden)return;const r=await supabase.rpc('capture_notifications');if(!active)return;const d=r.data as unknown as Inbox;if(!r.error&&d&&Array.isArray(d.rows)&&Number.isInteger(d.count)){setInbox(d);setError(false)}else if(r.error)setError(true)}void load();const timer=setInterval(()=>void load(),30000);const refresh=()=>void load();window.addEventListener('vimbre:work-changed',refresh);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('vimbre:work-changed',refresh);window.removeEventListener('focus',refresh)}},[profile?.id,revision]);return{...inbox,error,refresh:()=>setRevision(n=>n+1)}
}
