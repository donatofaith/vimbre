import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { safeSearch } from '../team/team-utils'
import { TeamMemberActions } from './WorkspacePage'

type Member = { id: string; full_name: string }
export function TeamActivityPage() {
  const { profile } = useAuth()
  // The route and navigation express the workflow; database RLS enforces access.
  if (profile?.role === 'employee') return <><h1 tabIndex={-1}>Team activity</h1><p>This page is for Managers and HR Admins. Your own work is in My day.</p><Link to="/app">Open My day</Link></>
  return <TeamActivity />
}
function TeamActivity() {
  const { profile, company } = useAuth()
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(0), [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<Member | null>(null)
  const [result, setResult] = useState<{ key: string; rows: Member[]; count: number; error: boolean } | null>(null)
  const missingDepartment = profile?.role === 'manager' && !profile.department_id
  const key = `${profile?.id}:${profile?.role}:${profile?.department_id}:${query}:${page}:${revision}`
  useEffect(() => { const timer = setTimeout(() => { setQuery(safeSearch(search)); setPage(0) }, 250); return () => clearTimeout(timer) }, [search])
  useEffect(() => {
    if (missingDepartment) return
    let cancelled = false
    async function load() {
      const { data, count, error } = await supabase.from('profiles').select('id,full_name', { count: 'exact' }).eq('active', true).neq('id', profile!.id).ilike('full_name', `%${query}%`).order('full_name').order('id').range(page * 20, page * 20 + 19)
      if (!cancelled) {
        if (error) console.error('Team activity roster failed', error)
        setResult({ key, rows: Array.isArray(data) ? data : [], count: count ?? 0, error: Boolean(error) })
      }
    }
    void load(); return () => { cancelled = true }
  }, [key, missingDepartment, profile, page, query])
  const current = result?.key === key ? result : null
  return <><div className="page-heading"><span className="eyebrow">{company?.name}</span><h1 tabIndex={-1}>Team activity</h1><Link to="/app">Back to my own work</Link></div>
    {missingDepartment ? <section className="card"><h2>Your department is not set up yet</h2><p>Ask your HR Admin to assign you to a department. Your team’s work will appear here once they belong to the same department.</p><p>You can keep adding your own work in <Link to="/app">My day</Link>.</p></section> : selected ? <><section className="card"><Button variant="secondary" onClick={() => setSelected(null)}>Choose another person</Button></section><TeamMemberActions member={selected} /></> : <section className="card"><h2>Choose a team member</h2><Input label="Search team members" type="search" placeholder="e.g. Ada" value={search} onChange={event => setSearch(event.target.value)} />
    {!current ? <p role="status">Loading your team…</p> : current.error ? <><p role="alert">Your team could not be loaded.</p><Button onClick={() => setRevision(value => value + 1)}>Retry team activity</Button></> : <>{current.rows.length === 0 ? <div className="empty-state"><h3>{query ? 'No names match your search' : page > 0 ? 'No more people on this page' : 'No other team members are available yet'}</h3><p>{query ? 'Try another name or clear the search.' : profile?.role === 'hr_admin' ? 'Invite your teammates and wait for them to accept. Only active members appear here.' : 'Only active people in your department appear here. Ask your HR Admin to check their invitations and department assignments.'}</p>{profile?.role === 'hr_admin' && !query && <Link to="/app/team">Manage team invitations</Link>}</div> : <ul className="record-list">{current.rows.map(member => <li key={member.id}><strong>{member.full_name}</strong><Button variant="secondary" aria-label={`View work for ${member.full_name}`} onClick={() => setSelected(member)}>View work</Button></li>)}</ul>}{(current.rows.length > 0 || page > 0) && <div className="pagination"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous people</Button><span>Page {page + 1}</span><Button variant="secondary" disabled={(page + 1) * 20 >= current.count} onClick={() => setPage(value => value + 1)}>Next people</Button></div>}</>}
    </section>}
  </>
}

