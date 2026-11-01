import {CompanyStructure} from './CompanyStructure'
import {useSearchParams} from 'react-router-dom'
import {DepartmentPicker} from './DepartmentPicker'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { safeSearch, teamError } from './team-utils'
type Department = Database['public']['Tables']['departments']['Row'] & { manager: { full_name: string } | null }
function DepartmentEditor({ department, saved, cancel }: { department: Department; saved: () => void; cancel: () => void }) {
  const [search, setSearch] = useState('')
  const [manager, setManager] = useState(department.manager_id ?? '')
  const [options, setOptions] = useState<{ id: string; full_name: string }[]>([])
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const { data, error: failure } = await supabase.from('profiles').select('id,full_name').eq('active', true).in('role', ['hr_admin','manager']).or(`role.eq.hr_admin,department_id.eq.${department.id}`).ilike('full_name', `%${safeSearch(search)}%`).order('full_name').limit(20)
      if (!cancelled) { setOptions(data ?? []); setLoadError(Boolean(failure)) }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [department.id, search])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const form = new FormData(event.currentTarget)
      const { error: failure } = await supabase.rpc('manage_department', { p_id: department.id, p_name: String(form.get('name')).trim(), p_manager: manager || null })
      if (failure) throw failure
      saved()
    } catch (reason) { setError(teamError((reason as { message?: string }).message)) }
    finally { setBusy(false) }
  }
  return <section className="card settings-card"><h2>Edit {department.name}</h2><form className="auth-form" onSubmit={save}><Input label="Name" name="name" defaultValue={department.name} required maxLength={120} /><Input label="Find a manager" type="search" value={search} onChange={event => setSearch(event.target.value)} /><div className="field"><label htmlFor={`manager-${department.id}`}>Manager</label><select autoFocus id={`manager-${department.id}`} value={manager} onChange={event => setManager(event.target.value)}><option value="">Not assigned</option>{department.manager_id && !options.some(person => person.id === department.manager_id) && <option value={department.manager_id}>{department.manager?.full_name ?? 'Current manager'}</option>}{options.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div><p className="muted">Choose a Manager assigned to this department, or an HR Admin.</p>{loadError && <p role="alert">Manager choices could not be loaded. Try searching again.</p>}{error && <p role="alert" className="field-error">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save department'}</Button><Button variant="secondary" onClick={cancel}>Cancel edit</Button></div></form></section>
}
function MemberDepartmentTarget({id,focus}:{id:string;focus:string|null}){
 const [member,setMember]=useState<Database['public']['Tables']['profiles']['Row']|null>(null),[department,setDepartment]=useState<Department|null>(null),[chosen,setChosen]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
 useEffect(()=>{let live=true;void(async()=>{const r=await supabase.from('profiles').select('*').eq('id',id).single();if(r.error){if(live)setError('This member could not be loaded.');return}let d:Department|null=null;if(r.data.department_id){const found=await supabase.from('departments').select('*,manager:profiles!departments_manager_company_fkey(full_name)').eq('id',r.data.department_id).single();d=found.data}if(live){setMember(r.data);setChosen(r.data.department_id??'');setDepartment(d)}})();return()=>{live=false}},[id,revision])
 if(!member)return <p role={error?'alert':'status'}>{error||'Loading department details…'}</p>
 if(focus==='manager'&&department)return <>{message&&<p role="status">{message}</p>}<DepartmentEditor key={department.id+revision} department={department} saved={()=>{setMessage('Department manager updated.');setRevision(v=>v+1)}} cancel={()=>window.history.back()}/></>
 return <section className="card settings-card" aria-label="Assign member department"><h2>Department for {member.full_name}</h2>{focus==='manager'&&<p>Choose a department first, then assign its manager.</p>}<form className="auth-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await supabase.rpc('manage_member_context',{p_id:member.id,p_full_name:member.full_name,p_role:member.role,p_department:chosen||null,p_active:member.active,p_description:member.role_description??'',p_start:member.role_start_date??null});if(r.error)throw r.error;setMessage('Department assigned.');setRevision(v=>v+1)}catch(e){setError(teamError((e as Error).message))}finally{setBusy(false)}}}><DepartmentPicker key={member.department_id} initial={department?{id:department.id,name:department.name}:null} onChange={setChosen}/><Button type="submit" disabled={busy}>{busy?'Saving…':'Assign department'}</Button></form>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>
}
export function DepartmentsPage() {
  const { profile, company } = useAuth()
  const admin = profile?.role === 'hr_admin'
  const [params]=useSearchParams()
  const [adding,setAdding]=useState(false)
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; rows: Department[]; count: number; error: boolean } | null>(null)
  const [editing, setEditing] = useState<Department | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const key = `${page}:${revision}:${profile?.id}:${profile?.role}`
  const reload = () => setRevision(value => value + 1)
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, count, error: failure } = await supabase.from('departments').select('*,manager:profiles!departments_manager_company_fkey(full_name)', { count: 'exact' }).is('archived_at', null).order('name').order('id').range(page * 20, page * 20 + 19)
      if (!cancelled) setResult({ key, rows: data ?? [], count: count ?? 0, error: Boolean(failure) })
    }
    void load()
    return () => { cancelled = true }
  }, [key, page])
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('')
    const form = event.currentTarget
    try {
      const { error: failure } = await supabase.rpc('manage_department', { p_name: String(new FormData(form).get('name')).trim() })
      if (failure) throw failure
      form.reset(); setAdding(false); setMessage('Department created. Assign people on the Team page, then choose its manager here.'); reload()
    } catch (reason) { setError(teamError((reason as { message?: string }).message)) }
    finally { setBusy(false) }
  }
  async function archive(department: Department) {
    if (!window.confirm(`Archive ${department.name}? It must have no assigned members or pending invitations.`)) return
    setBusy(true); setError(''); setMessage('')
    try { const { error: failure } = await supabase.rpc('manage_department', { p_id: department.id, p_archive: true }); if (failure) throw failure; setMessage('Department archived.'); reload() }
    catch (reason) { setError(teamError((reason as { message?: string }).message)) }
    finally { setBusy(false) }
  }
  const current = result?.key === key ? result : null
  return <><div className="page-heading"><span className="eyebrow">{company?.name}</span><h1 tabIndex={-1}>Departments</h1><CompanyStructure/><p>Organize your team and assign a manager to each department.</p></div>{message && <p role="status" className="notice">{message}</p>}{error && <p role="alert" className="field-error">{error}</p>}
    {!admin&&params.get('member')&&<p>Ask your company administrator to assign your department or manager.</p>}{admin&&params.get('member')&&<MemberDepartmentTarget id={params.get('member')!} focus={params.get('focus')}/>}
    {admin&&!adding&&<div className="department-toolbar"><Button aria-label="Add department" onClick={()=>setAdding(true)}>+ Add</Button></div>}{admin && adding&&<section className="card settings-card"><h2>New department</h2><form className="auth-form" onSubmit={create}><Input label="Name" name="name" required maxLength={120} /><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Save'}</Button><Button variant="secondary" disabled={busy} onClick={()=>setAdding(false)}>Cancel</Button></form></section>}
    {admin && editing && <DepartmentEditor key={editing.id} department={editing} saved={() => { setEditing(null); setMessage('Department updated.'); reload() }} cancel={() => setEditing(null)} />}
    <section className="card" aria-label="Departments list">{!current ? <p role="status">Loading departments…</p> : current.error ? <><p role="alert">Departments could not be loaded.</p><Button onClick={reload}>Retry</Button></> : current.rows.length === 0 ? <p>No departments yet. Add one when your team needs it.</p> : <><ul className="record-list">{current.rows.map(department => <li key={department.id}><div><strong>{department.name}</strong><p>Manager: {department.manager?.full_name ?? (department.manager_id ? 'Assigned' : 'Not assigned')}</p></div>{admin && <div className="form-actions"><Button variant="secondary" onClick={() => setEditing(department)}>Edit {department.name}</Button><Button variant="secondary" disabled={busy} onClick={() => { void archive(department) }}>Archive {department.name}</Button></div>}</li>)}</ul><div className="pagination"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous departments</Button><span>Page {page + 1}</span><Button variant="secondary" disabled={(page + 1) * 20 >= current.count} onClick={() => setPage(value => value + 1)}>Next departments</Button></div></>}
    </section>
  </>
}
