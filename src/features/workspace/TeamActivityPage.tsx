import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { safeSearch } from '../team/team-utils'
import { TeamMemberActions } from './WorkspacePage'
import { TeamMemberDecisions } from './TeamMemberDecisions'
import { useTeamOverview } from './useTeamOverview'
const trust='You can see confirmed tasks and decisions. You cannot see private drafts or the original emails.'
export function TeamActivityPage() {
 const {profile}=useAuth()
 if(profile?.role==='employee')return <><h1 tabIndex={-1}>Team activity</h1><p>This page is for Managers and HR Admins.</p><Link to="/app">Open My day</Link></>
 return <TeamActivity key={`${profile!.id}:${profile!.role}:${profile!.department_id}`} />
}
function TeamActivity() {
 const {profile}=useAuth()
 const [params,setParams]=useSearchParams()
 const requested=params.get('member')
 const validId=requested && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requested)?requested:null
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0)
 const missingDepartment=profile?.role==='manager'&&!profile.department_id
 const {data,error,retry}=useTeamOverview(profile!.id,validId?'':query,validId?0:page,validId)
 const member=validId?data?.rows.find(row=>row.id===validId):null
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(safeSearch(search));setPage(0)},250);return()=>clearTimeout(timer)},[search])
 function overview(){setParams({});setPage(0);setSearch('')}
 return <div className="vt-page">
  <header className="page-heading"><h1 tabIndex={-1}>Team activity</h1><p>See what your team has captured, finished and left open.</p><Link to="/app">Back to My day</Link></header>
  <p className="vt-trust"><Link to="/app?visibility=manager">{trust}</Link></p>
  {missingDepartment?<section className="card"><h2>Your department is not set up yet</h2><p>Ask your HR Admin to assign you to a department.</p></section>:error?<section className="card"><p role="alert">Your team could not be loaded.</p><Button onClick={retry}>Retry team activity</Button></section>:!data?<p role="status">Loading your team…</p>:requested&&!validId?<section className="card"><p role="alert">Team member is not available.</p><Button onClick={overview}>Back to team overview</Button></section>:validId?<>
   <Button variant="secondary" onClick={overview}>Back to team overview</Button>
   {member?<><h2>{member.full_name}</h2><TeamMemberActions member={member}/><TeamMemberDecisions key={member.id} owner={member.id}/></>:<p role="alert">Team member is not available.</p>}
  </>:<>
   <section aria-label={data.scope==='company'?'Company flags':'Department flags'}>
    <div className="vt-section-heading"><h2>{data.scope==='company'?'Company overview':'Department overview'}</h2><p>Week of <time dateTime={data.week_start}>{data.week_start}</time></p></div>
    <dl className="vt-flags"><div><dt>Overdue tasks</dt><dd>{data.flags.overdue_tasks}</dd></div><div><dt>Handovers not started</dt><dd aria-label={data.flags.handovers_not_started===null?'Unavailable':undefined}>{data.flags.handovers_not_started??'—'}</dd></div><div><dt>People with no role record</dt><dd>{data.flags.people_without_role_record}</dd></div></dl>
   </section>
   <section className="card vt-overview"><h2>Pick a person to see their tasks and decisions.</h2>
    {data.total_active_count>=5&&<Input label="Search team members" type="search" placeholder="Search by name" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/>}
    {data.total_active_count===1?<div className="empty-state"><p>It’s just you so far. Invite a teammate to see their work here.</p>{profile?.role==='hr_admin'&&<Link className="button button-primary" to="/app/team#invite-teammate">Invite a teammate</Link>}</div>:data.rows.length===0?<div className="empty-state"><h3>{query?'No names match your search':page>0?'No more people on this page':'No active team members'}</h3>{query&&<Button variant="secondary" onClick={()=>setSearch('')}>Clear search</Button>}</div>:<div className="table-scroll"><table className="vt-members"><thead><tr><th>Team member</th><th>Tasks done this week</th><th>Tasks overdue</th><th>Drafts waiting</th><th>Handover status</th></tr></thead><tbody>{data.rows.map(row=><tr key={row.id} onClick={e=>{if(!(e.target as HTMLElement).closest('a'))setParams({member:row.id})}}><td><Link to={`?member=${row.id}`}>{row.full_name}</Link></td><td>{row.tasks_done}</td><td>{row.tasks_overdue}</td><td>{row.drafts_waiting}</td><td>{row.handover_status??<span aria-label="Handover status unavailable">—</span>}</td></tr>)}</tbody></table></div>}
    {(data.count>20||page>0)&&data.total_active_count>1&&<div className="pagination"><Button variant="secondary" disabled={page===0} onClick={()=>setPage(n=>n-1)}>Previous people</Button><span>Page {page+1}</span><Button variant="secondary" disabled={(page+1)*20>=data.count} onClick={()=>setPage(n=>n+1)}>Next people</Button></div>}
   </section>
  </>}
 </div>
}
