import {useCallback,useEffect,useState} from 'react'
import {useAuth} from '../auth/AuthProvider'
import {supabase} from '../../lib/supabase'
type Kind='role'|'capture'|'handover'|'task'
export function useNotificationReceipts(){
 const {profile}=useAuth(),owner=profile?.id
 const [state,setState]=useState<{owner:string;seen:Set<string>}>({owner:'',seen:new Set()}),[error,setError]=useState(false)
 const load=useCallback(async()=>{if(!owner)return;const r=await supabase.rpc('notification_receipt',{});if(r.error||!Array.isArray(r.data)){setError(true);return}const seen=new Set(r.data.flatMap(row=>row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.kind==='string'&&typeof row.id==='string'?[row.kind+':'+row.id]:[]));setState({owner,seen});setError(false)},[owner])
 useEffect(()=>{void load()},[load])
 async function read(kind:Kind,id:string){if(!owner)return;try{const r=await supabase.rpc('notification_receipt',{p_kind:kind,p_id:id});if(r.error)throw r.error;setState(old=>({owner,seen:new Set([...(old.owner===owner?old.seen:[]),kind+':'+id])}));setError(false)}catch{setError(true)}}
 return{has:(kind:Kind,id:string)=>state.owner===owner&&state.seen.has(kind+':'+id),read,error,refresh:load}
}
