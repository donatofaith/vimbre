import type {Member} from '../people/member'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
export type TeamMetric = Member & { active_seconds?:number|null;open_tasks?:number;working_on?:{title:string;status:string;due_date:string|null}[]; id: string; full_name: string; tasks_done: number; tasks_overdue: number; drafts_waiting: number; handover_status: string | null; no_role_record: boolean }
export type TeamOverview = { rows: TeamMetric[]; count: number; total_active_count: number; scope: 'company' | 'department'; today: string; week_start: string; flags: { tasks_done?:number;tasks_in_progress?:number;overdue_tasks: number; handovers_not_started: number | null; people_without_role_record: number }; handovers_available: boolean }
const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
export function parseTeamOverview(value: unknown): TeamOverview | null {
 if (!value || typeof value !== 'object') return null
 const v=value as TeamOverview
 if (!Array.isArray(v.rows) || !count(v.count) || !count(v.total_active_count) || !['company','department'].includes(v.scope) ||
  !/^\d{4}-\d{2}-\d{2}$/.test(v.today) || !/^\d{4}-\d{2}-\d{2}$/.test(v.week_start) || typeof v.handovers_available!=='boolean' ||
  !v.flags || !count(v.flags.overdue_tasks) || !count(v.flags.people_without_role_record) || !(v.flags.handovers_not_started===null || count(v.flags.handovers_not_started)) ||
  !v.rows.every(r=>r && typeof r==='object' && typeof r.id==='string' && typeof r.full_name==='string' && count(r.tasks_done) && count(r.tasks_overdue) && count(r.drafts_waiting) && typeof r.no_role_record==='boolean' && (r.handover_status===null || typeof r.handover_status==='string'))) return null
 return v
}
export function useTeamOverview(owner: string, search: string, page: number, member: string | null) {
 const [refresh,setRefresh]=useState(0)
 const key=`${owner}:${search}:${page}:${member}`
 const [result,setResult]=useState<{key: string; data: TeamOverview | null; error: boolean} | null>(null)
 useEffect(()=>{
  let cancelled=false, sequence=0
  async function load() {
   const request=++sequence
   const {data,error}=await supabase.rpc('team_activity_overview',{p_search:search,p_page:page,p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',p_member:member})
   const parsed=error?null:parseTeamOverview(data)
   if(!cancelled && request===sequence) setResult({key,data:parsed,error:Boolean(error)||!parsed})
  }
  void load()
  const onReturn=()=>{if(!document.hidden)void load()}
  window.addEventListener('vimbre:profile-updated',onReturn);window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn)
  const interval=setInterval(onReturn,60000)
  return()=>{cancelled=true;clearInterval(interval);window.removeEventListener('vimbre:profile-updated',onReturn);window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn)}
 },[key,search,page,member,refresh])
 return {data:result?.key===key?result.data:null,error:result?.key===key && result.error,retry:()=>setRefresh(n=>n+1)}
}
export function useCompanyMemberCount(owner: string, enabled: boolean) {
 const [result,setResult]=useState<{owner:string; count:number}|null>(null)
 useEffect(()=>{
  if(!enabled)return
  let cancelled=false
  const load=async()=>{const {data,error}=await supabase.rpc('company_active_member_count');if(!cancelled && !error && count(data))setResult({owner,count:data!})}
  void load();const onReturn=()=>{if(!document.hidden)void load()}
  window.addEventListener('focus',onReturn);const interval=setInterval(onReturn,60000)
  return()=>{cancelled=true;clearInterval(interval);window.removeEventListener('focus',onReturn)}
 },[owner,enabled])
 return result?.owner===owner?result.count:null
}
