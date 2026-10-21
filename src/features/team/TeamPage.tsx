import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { TextField } from '../records/RecordForms'
import { DepartmentPicker } from './DepartmentPicker'
import { invitationStatus, roleLabel, roles, teamError } from './team-utils'
type Profile = Database['public']['Tables']['profiles']['Row']
type Invitation = Database['public']['Tables']['invitations']['Row']
type Member = Profile & { department: { name: string } | null }
type Invite = Invitation & { department: { name: string } | null }
const pageSize = 20
function MemberEditor({ member, departmentsRequired, onSaved, onCancel }: { member: Member; departmentsRequired: boolean; onSaved: () => void; onCancel: () => void }) {
  const { company } = useAuth()
  const [role, setRole] = useState(member.role)
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
      onSaved()
    } catch (reason) { setError(teamError((reason as { message?: string }).message)) }
    finally { setBusy(false) }
  }
  return <section className="card settings-card" aria-label="Edit member"><h2>Edit {member.full_name}</h2><p>{member.email}</p><form className="auth-form" onSubmit={save}>
    <Input label="Full name" name="name" defaultValue={member.full_name} required maxLength={100} />
    <div className="field"><label htmlFor={`role-${member.id}`}>Role</label><select id={`role-${member.id}`} value={role} onChange={event => setRole(event.target.value)}>{roles.map(value => <option key={value} value={value}>{roleLabel(value, member.id === company?.created_by && value === 'hr_admin')}</option>)}</select></div>
    <DepartmentPicker initial={member.department_id ? { id: member.department_id, name: member.department?.name ?? 'Current department' } : null} required={departmentsRequired && role !== 'hr_admin'} />
    <TextField label="What are they responsible for?" name="role_description" value={member.role_description} placeholder="e.g. Supplier reviews and the weekly operations report" />
    <Input label="Start date" name="role_start_date" type="date" defaultValue={member.role_start_date ?? ''} />
    <label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={member.active} />Active account</label><p className="muted">Changing a manager’s role or department clears any manager assignment they can no longer hold.</p>
    {error && <p role="alert" className="field-error">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save member'}</Button><Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel edit</Button></div>
  </form></section>
}
export function TeamPage() {
  const { profile, company, refresh } = useAuth()
  const admin = profile?.role === 'hr_admin'
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
        supabase.from('profiles').select('*,department:departments!profiles_department_id_company_id_fkey(name)', { count: 'exact' }).order('full_name').order('id').range(page * pageSize, page * pageSize + pageSize - 1),
        admin ? supabase.from('invitations').select('*,department:departments!invitations_department_id_company_id_fkey(name)', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(invitePage * pageSize, invitePage * pageSize + pageSize - 1) : Promise.resolve({ data: [], error: null, count: 0 }),
      ])
      if (!cancelled) setResult({ key, members: members.data ?? [], invitations: invitations.data ?? [], memberCount: members.count ?? 0, inviteCount: invitations.count ?? 0, error: Boolean(members.error || invitations.error) })
    }
    void load()
    return () => { cancelled = true }
  }, [key, admin, page, invitePage])
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
  const current = result?.key === key ? result : null
  return <><div className="page-heading"><span className="eyebrow">{company?.name}</span><h1 tabIndex={-1}>Team</h1></div>
    {message && <p role="status" className="notice">{message}</p>}{error && <p role="alert" className="field-error">{error}</p>}
    {admin && <section id="invite-teammate" className="card settings-card"><h2>Invite a teammate</h2><p>Invitations expire after seven days.</p><form className="auth-form" key={formVersion} onSubmit={event => { event.preventDefault(); void send('create', new FormData(event.currentTarget)) }}>
      <Input label="Full name" name="name" required maxLength={100} autoComplete="off" /><Input label="Email address" name="email" type="email" required maxLength={320} autoComplete="off" />
      <div className="field"><label htmlFor="invite-role">Role</label><select aria-describedby="invite-role-hint" id="invite-role" value={inviteRole} onChange={event => setInviteRole(event.target.value)}>{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select><p className="field-hint" id="invite-role-hint">Choose Employee for most teammates, Manager for a department lead, or HR Admin for company and team administration.</p></div>
      <TextField label="What are they responsible for?" name="role_description" placeholder="e.g. Supplier reviews and the weekly operations report" />
      <div className="vr-ai-unavailable"><Button disabled>Use Vimbre AI</Button><span>Coming soon</span></div>
      <Input label="Start date" name="role_start_date" type="date" />
      <DepartmentPicker required={company?.team_mode === 'departments' && inviteRole !== 'hr_admin'} /><Button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Send invitation'}</Button>
    </form></section>}
    {editing && admin && <MemberEditor key={editing.id} member={editing} departmentsRequired={company?.team_mode === 'departments'} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage('Member updated.'); refresh(); reload() }} />}
    <section className="card"><h2>Members</h2>{!current ? <p role="status">Loading members…</p> : current.error ? <><p role="alert">The team could not be loaded.</p><Button onClick={reload}>Retry</Button></> : current.members.length === 0 ? <p>No members are visible.</p> : <><div className="table-scroll"><table><thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Status</th>{admin && <th>Manage</th>}</tr></thead><tbody>{current.members.map(member => <tr key={member.id}><td data-label="Name"><div><strong>{member.full_name}</strong><br /><span className="muted">{member.email}</span></div></td><td data-label="Role">{roleLabel(member.role, member.id === company?.created_by)}</td><td data-label="Department">{member.department?.name ?? 'No department'}</td><td data-label="Status">{member.active ? 'Active' : 'Inactive or invited'}</td>{admin && <td data-label="Manage"><Button variant="secondary" aria-label={`Edit ${member.full_name}`} onClick={() => { setEditing(member); setError(''); setMessage('') }}>Edit</Button></td>}</tr>)}</tbody></table></div><div className="pagination"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous members</Button><span>Page {page + 1}</span><Button variant="secondary" disabled={(page + 1) * pageSize >= current.memberCount} onClick={() => setPage(value => value + 1)}>Next members</Button></div></>}
    </section>
    {admin && <section className="card"><h2>Invitations</h2>{!current ? <p role="status">Loading invitations…</p> : current.error ? <p role="alert">Invitations could not be loaded. Please retry loading the team.</p> : current.invitations.length === 0 ? <p>No invitations yet.</p> : <><ul className="record-list">{current.invitations.map(invite => { const status = invitationStatus(invite.status, invite.expires_at); return <li key={invite.id}><div><strong>{invite.full_name}</strong><p>{invite.email} · {roleLabel(invite.role)}{invite.department ? ` · ${invite.department.name}` : ''}</p><span className="badge">{status}</span><p className="muted">Expires {new Date(invite.expires_at).toLocaleString()}</p></div>{['pending','expired'].includes(status) && <div className="form-actions"><Button variant="secondary" aria-label={`Resend to ${invite.full_name}`} disabled={busy} onClick={() => { void send('resend', undefined, invite.id) }}>Resend</Button><Button variant="secondary" aria-label={`Cancel invitation for ${invite.full_name}`} disabled={busy} onClick={() => { void cancel(invite) }}>Cancel invitation</Button></div>}</li> })}</ul><div className="pagination"><Button variant="secondary" disabled={invitePage === 0} onClick={() => setInvitePage(value => value - 1)}>Previous invitations</Button><span>Page {invitePage + 1}</span><Button variant="secondary" disabled={(invitePage + 1) * pageSize >= current.inviteCount} onClick={() => setInvitePage(value => value + 1)}>Next invitations</Button></div></>}
    </section>}
  </>
}

