import {useSearchParams} from 'react-router-dom'
import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { StructuredAI } from '../ai/StructuredAI'
import { DepartmentPicker } from './DepartmentPicker'
import { invitationStatus, roleLabel, roles, teamError } from './team-utils'
type Profile = Database['public']['Tables']['profiles']['Row']
type Invitation = Database['public']['Tables']['invitations']['Row']
type Member = Profile & { department: { name: string;manager_id?:string|null } | null }
type Invite = Invitation & { department: { name: string;manager_id?:string|null } | null }
function ResponsibilityContext({value=''}: {value?:string}) {
 const id=useId()
 const [text,setText]=useState(value), [open,setOpen]=useState(false)
 return <section><div className="field"><label htmlFor={id}>What are they responsible for?</label><textarea id={id} name="role_description" rows={4} maxLength={5000} value={text} onChange={event=>setText(event.target.value)} placeholder="e.g. Supplier reviews and the weekly operations report" /></div>
 <Button variant="secondary" onClick={()=>setOpen(value=>!value)}>{open?'Close AI review':'Use Vimbre AI'}</Button>
 {open&&<StructuredAI kind="responsibility" choose={draft=>{const next=[text,`${draft.title}. ${draft.details}`].filter(Boolean).join('\n');if(next.length>5000){window.alert('Shorten the responsibilities before adding another draft.');return}setText(next);setOpen(false)}}/>}</section>
}
const pageSize = 20
function MemberEditor({ member, departmentsRequired, onSaved, onCancel }: { member: Member; departmentsRequired: boolean; onSaved: () => void; onCancel: () => void }) {
  const { company } = useAuth()
  const editorRef=useRef<HTMLElement>(null)
  useEffect(()=>{editorRef.current?.scrollIntoView({block:'start'})},[member.id])
  const [role, setRole] = useState(member.role)
  const [departmentId,setDepartmentId]=useState(member.department_id??'')
  const [appoint,setAppoint]=useState(member.department?.manager_id===member.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    const active = form.get('active') === 'on'
    if (member.active && !active && !window.confirm(`Deactivate ${member.full_name}? They will lose workspace access.`)) { setBusy(false); return }
    try {
      const { error: failure } = await supabase.rpc('manage_member_context', { p_id: member.id, p_full_name: String(form.get('name')).trim(), p_role: role, p_department: String(form.get('department_id')) || null, p_active: active, p_description: String(form.get('role_description') ?? '').trim(), p_start: String(form.get('role_start_date') ?? '') || null })
      if (failure) throw failure
      if(departmentId&&(role==='manager'||role==='hr_admin')){
        const dept=await supabase.from('departments').select('id,name,manager_id').eq('id',departmentId).single()
        if(dept.error)throw Error('Member saved. Department manager details could not be loaded; retry assigning the manager.')
        if(appoint||dept.data.manager_id===member.id){const assigned=await supabase.rpc('manage_department',{p_id:departmentId,p_name:dept.data.name,p_manager:appoint?member.id:null});if(assigned.error)throw Error('Member saved. Department manager could not be updated; retry assigning the manager.')}
      }
      onSaved()
    } catch (reason) { setError((reason as Error).message?.startsWith('Member saved.')?(reason as Error).message:teamError((reason as { message?: string }).message)) }
    finally { setBusy(false) }
  }
  return <section className="card settings-card" aria-label="Edit member" ref={editorRef}><h2>Edit {member.full_name}</h2><p>{member.email}</p><form className="auth-form" onSubmit={save}>
    <Input label="Full name" name="name" defaultValue={member.full_name} required maxLength={100} />
    <div className="field"><label htmlFor={`role-${member.id}`}>Role</label><select id={`role-${member.id}`} value={role} onChange={event => setRole(event.target.value)}>{roles.map(value => <option key={value} value={value}>{roleLabel(value, member.id === company?.created_by && value === 'hr_admin')}</option>)}</select></div>
    <DepartmentPicker initial={member.department_id ? { id: member.department_id, name: member.department?.name ?? 'Current department' } : null} required={departmentsRequired && role !== 'hr_admin'} onChange={id=>{setDepartmentId(id);setAppoint(false)}} />
    {departmentId&&(role==='manager'||role==='hr_admin')&&<label className="checkbox-line"><input type="checkbox" name="department_manager" checked={appoint} onChange={e=>setAppoint(e.target.checked)}/>Assign as department manager</label>}
    <ResponsibilityContext value={member.role_description} />
    <Input label="Start date" name="role_start_date" type="date" defaultValue={member.role_start_date ?? ''} />
    <label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={member.active} />Active account</label><p className="muted">Changing a manager’s role or department clears any manager assignment they can no longer hold.</p>
    {error && <p role="alert" className="field-error">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save member'}</Button><Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel edit</Button></div>
  </form></section>
}
export function TeamPage() {
  const { profile, company, refresh } = useAuth()
  const admin = profile?.role === 'hr_admin'
  const [params,setParams]=useSearchParams()
  const requestedMember=params.get('member')
  const [page, setPage] = useState(0)
  const [invitePage, setInvitePage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; members: Member[]; invitations: Invite[]; memberCount: number; inviteCount: number; error: boolean } | null>(null)
  const [editing, setEditing] = useState<Member | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [inviteRole, setInviteRole] = useState('employee')
  const [formVersion, setFormVersion] = useState(0)
  const key = `${profile?.id}:${page}:${invitePage}:${revision}:${admin}`
  const reload = () => setRevision(value => value + 1)
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [members, invitations] = await Promise.all([
        supabase.from('profiles').select('*,department:departments!profiles_department_id_company_id_fkey(name,manager_id)', { count: 'exact' }).order('full_name').order('id').range(page * pageSize, page * pageSize + pageSize - 1),
        admin ? supabase.from('invitations').select('*,department:departments!invitations_department_id_company_id_fkey(name)', { count: 'exact' }).neq('status','accepted').order('created_at', { ascending: false }).order('id').range(invitePage * pageSize, invitePage * pageSize + pageSize - 1) : Promise.resolve({ data: [], error: null, count: 0 }),
      ])
      if(!cancelled&&admin&&requestedMember){let target=members.data?.find(m=>m.id===requestedMember);if(!target){const found=await supabase.from('profiles').select('*,department:departments!profiles_department_id_company_id_fkey(name,manager_id)').eq('id',requestedMember).single();target=found.data??undefined}if(target)setEditing(target)}
      if (!cancelled) setResult({ key, members: members.data ?? [], invitations: invitations.data ?? [], memberCount: members.count ?? 0, inviteCount: invitations.count ?? 0, error: Boolean(members.error || invitations.error) })
    }
    void load()
    return () => { cancelled = true }
  }, [key, admin, page, invitePage,requestedMember])
  async function send(action: 'create' | 'resend', form?: FormData, id?: string) {
    setBusy(true); setError(''); setMessage('')
    try {
      const { data, error: failure } = await supabase.functions.invoke('team-invitations', { body: action === 'create' ? { action, email: String(form?.get('email')).trim(), full_name: String(form?.get('name')).trim(), role: inviteRole, department_id: String(form?.get('department_id')) || null, role_description: String(form?.get('role_description') ?? '').trim(), role_start_date: String(form?.get('role_start_date') ?? '') || null } : { action, id } })
      if (failure) {
        let detail = 'Could not request the invitation email. Check your connection and HR Admin access, then retry.'
        if ('context' in failure && failure.context instanceof Response) {
          try { const body = await failure.context.json(); if (typeof body.error === 'string') detail = body.error } catch { /* Retain the friendly fallback. */ }
        }
        throw new Error(detail)
      }
      if (data?.error) throw new Error(data.error)
      setMessage('Invitation email requested. Ask the recipient to check their inbox and spam folder, open the sign in link, and accept their invitation.')
      if (action === 'create') { setInviteRole('employee'); setFormVersion(value => value + 1) }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The invitation could not be sent.') }
    finally { setBusy(false); reload() }
  }
  async function cancel(invite: Invite) {
    if (!window.confirm(`Cancel the invitation for ${invite.email}? They will no longer be able to join with it.`)) return
    setBusy(true); setError(''); setMessage('')
    try { const { error: failure } = await supabase.rpc('cancel_invitation', { p_id: invite.id }); if (failure) throw failure; setMessage('Invitation cancelled.') }
    catch { setError('Could not cancel this invitation. Please retry.') }
    finally { setBusy(false); reload() }
  }
  async function changeStatus(member:Member,status:string){
    const label=status==='dismissed'?'Dismiss':status==='left'?'Mark as left':status==='suspended'?'Suspend':'Reactivate'
    if(!window.confirm(`${label} ${member.full_name}? ${status==='active'?'They will regain workspace access, subject to your plan limit.':'They will lose workspace access. Their work records will be retained.'}`))return
    setBusy(true);setError('');setMessage('')
    try{const r=await supabase.rpc('set_member_status',{p_id:member.id,p_status:status});if(r.error)throw r.error;setMessage('Member status updated.');reload();refresh()}catch(reason){setError(teamError((reason as {message?:string}).message))}finally{setBusy(false)}
  }
  const current = result?.key === key ? result : null
  return <><div className="page-heading"><span className="eyebrow">{company?.name}</span><h1 tabIndex={-1}>Team</h1></div>
    {message && <p role="status" className="notice">{message}</p>}{error && <p role="alert" className="field-error">{error}</p>}
    {admin && <section id="invite-teammate" className="card settings-card"><h2>Invite a teammate</h2><p>Invitations expire after seven days.</p><form className="auth-form" key={formVersion} onSubmit={event => { event.preventDefault(); void send('create', new FormData(event.currentTarget)) }}>
      <Input label="Full name" name="name" required maxLength={100} autoComplete="off" /><Input label="Email address" name="email" type="email" required maxLength={320} autoComplete="off" />
      <div className="field"><label htmlFor="invite-role">Role</label><select aria-describedby="invite-role-hint" id="invite-role" value={inviteRole} onChange={event => setInviteRole(event.target.value)}>{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select><p className="field-hint" id="invite-role-hint">Choose Employee for most teammates, Manager for a department lead, or HR Admin for company and team administration.</p></div>
      <ResponsibilityContext />
      <Input label="Start date" name="role_start_date" type="date" />
      <DepartmentPicker required={company?.team_mode === 'departments' && inviteRole !== 'hr_admin'} /><Button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Send invitation'}</Button>
    </form></section>}
    {editing && admin && <MemberEditor key={editing.id} member={editing} departmentsRequired={company?.team_mode === 'departments'} onCancel={() => {setEditing(null);setParams({})}} onSaved={() => { setEditing(null);setParams({}); setMessage('Member updated.'); refresh(); reload() }} />}
    <section className="card"><h2>Members</h2>{!current ? <p role="status">Loading members…</p> : current.error ? <><p role="alert">The team could not be loaded.</p><Button onClick={reload}>Retry</Button></> : current.members.length === 0 ? <p>No members are visible.</p> : <><div className="table-scroll"><table><thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Status</th>{admin && <th>Manage</th>}</tr></thead><tbody>{current.members.map(member => <tr key={member.id}><td data-label="Name"><div><strong>{member.full_name}</strong><br /><span className="muted">{member.email}</span></div></td><td data-label="Role">{roleLabel(member.role, member.id === company?.created_by)}</td><td data-label="Department">{member.department?.name ?? 'No department'}</td><td data-label="Status">{member.active?'Active':({suspended:'Suspended',left:'Left',dismissed:'Dismissed'}[member.employment_status]??'Inactive or invited')}</td>{admin && <td data-label="Manage"><div className="member-status-actions"><Button variant="secondary" aria-label={`Edit ${member.full_name}`} onClick={() => { setEditing(member); setError(''); setMessage('') }}>Edit</Button>{member.id!==profile?.id&&(member.active?<details><summary>Account status</summary><div className="member-status-actions">{[['suspended','Suspend'],['left','Mark as left'],['dismissed','Dismiss']].map(([status,label])=><Button key={status} variant={status==='suspended'?'warning':status==='dismissed'?'danger':'secondary'} disabled={busy} onClick={()=>void changeStatus(member,status)}>{label}</Button>)}</div></details>:<Button variant="secondary" disabled={busy} onClick={()=>void changeStatus(member,'active')}>Reactivate</Button>)}</div></td>}</tr>)}</tbody></table></div><div className="pagination"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous members</Button><span>Page {page + 1}</span><Button variant="secondary" disabled={(page + 1) * pageSize >= current.memberCount} onClick={() => setPage(value => value + 1)}>Next members</Button></div></>}
    </section>
    {admin && <section className="card"><h2>Invitations</h2>{!current ? <p role="status">Loading invitations…</p> : current.error ? <p role="alert">Invitations could not be loaded. Please retry loading the team.</p> : current.invitations.length === 0 ? <p>No invitations yet.</p> : <><ul className="record-list">{current.invitations.map(invite => { const status = invitationStatus(invite.status, invite.expires_at); return <li key={invite.id}><div><strong>{invite.full_name}</strong><p>{invite.email} · {roleLabel(invite.role)}{invite.department ? ` · ${invite.department.name}` : ''}</p><span className="badge">{status}</span><p className="muted">Expires {new Date(invite.expires_at).toLocaleString()}</p></div>{['pending','expired'].includes(status) && <div className="form-actions"><Button variant="secondary" aria-label={`Resend to ${invite.full_name}`} disabled={busy} onClick={() => { void send('resend', undefined, invite.id) }}>Resend</Button><Button variant="secondary" aria-label={`Cancel invitation for ${invite.full_name}`} disabled={busy} onClick={() => { void cancel(invite) }}>Cancel invitation</Button></div>}</li> })}</ul><div className="pagination"><Button variant="secondary" disabled={invitePage === 0} onClick={() => setInvitePage(value => value - 1)}>Previous invitations</Button><span>Page {invitePage + 1}</span><Button variant="secondary" disabled={(invitePage + 1) * pageSize >= current.inviteCount} onClick={() => setInvitePage(value => value + 1)}>Next invitations</Button></div></>}
    </section>}
  </>
}

