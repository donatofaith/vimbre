import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { emptyWorkInbox, parseWorkInbox } from './notification-utils'
import type { WorkInbox } from './notification-utils'
export function useWorkNotifications(page: number) {
 const {profile}=useAuth()
 const owner=profile?.id??''
 const [revision,setRevision]=useState(0)
 const key=`${owner}:${page}`
 const [result,setResult]=useState<{key:string;data:WorkInbox;error:boolean}|null>(null)
 const [readError,setReadError]=useState(false)
 const [busy,setBusy]=useState('')
 const marking=useRef(false)
 const refresh=()=>setRevision(n=>n+1)
 useEffect(()=>{
  if(!owner)return
  let alive=true, sequence=0
  const load=async()=>{
   const n=++sequence
   const {data,error}=await supabase.rpc('work_notification_inbox',{p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',p_page:page})
   const parsed=error?null:parseWorkInbox(data)
   if(alive&&n===sequence)setResult({key,data:parsed??emptyWorkInbox,error:!parsed})
  }
  void load()
  const onReturn=()=>{if(!document.hidden)void load()}
  const timer=setInterval(onReturn,20000)
  window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn)
  window.addEventListener('vimbre:work-changed',onReturn)
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn);window.removeEventListener('vimbre:work-changed',onReturn)}
 },[key,owner,page,revision])
 async function markRead(notificationKey:string){
  if(marking.current)return
  marking.current=true;setBusy(notificationKey);setReadError(false)
  try {
   const {error}=await supabase.rpc('work_notification_read',{p_key:notificationKey,p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'})
   if(error)throw error
   refresh()
  }catch{setReadError(true)}finally{marking.current=false;setBusy('')}
 }
 const current=result?.key===key?result:null
 return {data:current?.data??emptyWorkInbox,error:current?.error??false,loading:!current,refresh,markRead,readError,busy}
}
