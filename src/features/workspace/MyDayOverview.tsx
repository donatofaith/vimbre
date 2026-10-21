import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MyDaySummary } from './useMyDaySummary'
import { supabase } from '../../lib/supabase'
import { localDate, formatRecordDate } from '../records/record-utils'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'

const roleSteps = [
  ['responsibility', 'Responsibilities', 'record'],
  ['workstream', 'Projects you handle', 'projects'],
  ['external_contact', 'External contacts', 'people'],
  ['document', 'Documents', 'record'],
  ['recurring_deadline', 'Recurring deadlines', 'calendar'],
] as const
export function CaptureSummary({ data }: { data: MyDaySummary | null }) {
  const [copyMessage, setCopyMessage] = useState('')
  const [copiedAddress, setCopiedAddress] = useState('')
  async function copyAddress() {
    if (!data?.forwarding_address) return
    try { await navigator.clipboard.writeText(data.forwarding_address); setCopiedAddress(data.forwarding_address); setCopyMessage('Address copied.') }
    catch { setCopiedAddress(data.forwarding_address); setCopyMessage('Could not copy. Select the address and copy it manually.') }
  }
  return <>
    {data && data.pending_drafts > 0 && <Link className="vw-draft-notice" to="/app/capture"><WorkspaceIcon name="record" /><span>{data.pending_drafts} {data.pending_drafts === 1 ? 'draft' : 'drafts'} to review</span><WorkspaceIcon name="arrow" /></Link>}
    {data?.forwarding_address && <section className="vw-forward-card" aria-label="Email capture address"><div><h2>Forward emails to your Vimbre address</h2><span className="vw-forward-address">{data.forwarding_address}</span></div><button className="button button-secondary" type="button" onClick={() => { void copyAddress() }}>Copy address</button>{copyMessage && copiedAddress === data.forwarding_address && <p role="status">{copyMessage}</p>}</section>}
  </>
}
export function RoleChecklist({ data, error, retry }: { data: MyDaySummary | null; error: boolean; retry: () => void }) {
  const done = roleSteps.filter(([kind]) => data?.completed_sections.includes(kind)).length
  return <aside className="vw-role-guide"><span className="vw-eyebrow">Get started</span><h2>Write down what the next person needs to know</h2>
    {error ? <p role="alert">Progress could not be loaded. <button className="vw-inline-button" type="button" onClick={retry}>Retry progress</button></p> : !data ? <p role="status">Loading progress…</p> : <><p className="vw-checklist-count">{done} of 5 done</p><progress value={done} max={5} aria-label="Role record completion" /></>}
    <ul>{roleSteps.map(([kind, label, icon]) => {
      const complete = Boolean(data?.completed_sections.includes(kind))
      return <li key={kind}><Link to={`/app/role-record?section=${kind}`} aria-label={`${label}${data ? complete ? ', done' : ', not done' : ''}`}><WorkspaceIcon name={icon} /><span>{label}</span><span className={`vw-checklist-state${complete ? ' is-done' : ''}`} aria-hidden="true">{complete ? <WorkspaceIcon name="tick" /> : <WorkspaceIcon name="arrow" />}</span></Link></li>
    })}</ul>
  </aside>
}


export function RecurringDue({owner, revision}: {owner: string; revision: number}) {
  const [result,setResult]=useState<{owner:string; rows:{id:string; title:string; due_date:string|null}[]; error:boolean}|null>(null)
  useEffect(()=>{
    let cancelled=false
    async function load(){const {data,error}=await supabase.from('role_items').select('id,title,due_date').eq('owner_id',owner).eq('kind','recurring_deadline').is('deleted_at',null).lte('due_date',localDate()).order('due_date').limit(20);if(!cancelled)setResult({owner,rows:data??[],error:Boolean(error)})}
    void load()
    const refresh=()=>{if(!document.hidden)void load()}
    window.addEventListener('vimbre:work-changed',refresh);window.addEventListener('focus',refresh)
    return()=>{cancelled=true;window.removeEventListener('vimbre:work-changed',refresh);window.removeEventListener('focus',refresh)}
  },[owner,revision])
  if(result?.owner!==owner)return null
  if(result.error)return <p role="alert">Recurring deadlines could not be loaded. <Link to="/app/role-record?section=recurring_deadline">View deadlines</Link></p>
  if(!result.rows.length)return null
  return <section className="vw-recurring-due card"><h2>Recurring deadlines</h2><ul>{result.rows.map(row=><li key={row.id}><Link to={`/app/role-record?section=recurring_deadline&record=${row.id}`}>{row.title}</Link>{row.due_date && <time dateTime={row.due_date}>{formatRecordDate(row.due_date)}</time>}</li>)}</ul><Link to="/app/role-record?section=recurring_deadline">View all deadlines</Link></section>
}
