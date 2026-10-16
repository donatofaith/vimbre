import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { safeSearch } from '../team/team-utils'
import { ItemForm, DecisionForm } from './RecordForms'
import type { RoleItem, Decision } from './RecordForms'
import { itemKinds, recordError, safeRecordUrl } from './record-utils'
import type { ItemKind } from './record-utils'

type Tab = ItemKind | 'decision'
type Owner = { id: string; full_name: string }
function WebLink({ href, children }: { href: string | null; children: string }) { const safe = safeRecordUrl(href); return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children}</a> : null }
export function RoleRecordPage() {
  const { profile, company } = useAuth()
  const [ownerId, setOwnerId] = useState(profile!.id), [ownerName, setOwnerName] = useState(profile!.full_name)
  const [ownerSearch, setOwnerSearch] = useState(''), [owners, setOwners] = useState<Owner[]>([]), [ownerError, setOwnerError] = useState(false)
  const [tab, setTab] = useState<Tab>('responsibility'), [archived, setArchived] = useState(false), [page, setPage] = useState(0), [revision, setRevision] = useState(0)
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [decisionStatus, setDecisionStatus] = useState('all')
  const [result, setResult] = useState<{ key: string; items: RoleItem[]; decisions: Decision[]; count: number; error: boolean } | null>(null)
  const [workstreams, setWorkstreams] = useState<RoleItem[]>([]), [streamSearch, setStreamSearch] = useState(''), [streamError, setStreamError] = useState(false)
  const [editor, setEditor] = useState<{ item?: RoleItem; decision?: Decision } | null>(null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const own = ownerId === profile!.id
  const key = `${ownerId}:${tab}:${archived}:${page}:${revision}:${query}:${decisionStatus}`
  useEffect(() => { const timer = setTimeout(() => { setQuery(safeSearch(search)); setPage(0) }, 250); return () => clearTimeout(timer) }, [search])
  useEffect(() => {
    if (profile?.role === 'employee') return
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data, error: failure } = await supabase.from('profiles').select('id,full_name').eq('active', true).ilike('full_name', `%${safeSearch(ownerSearch)}%`).order('full_name').order('id').limit(20)
      if (!cancelled) { setOwners(data ?? []); setOwnerError(Boolean(failure)) }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [profile?.role, ownerSearch])
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (tab === 'decision') {
        let request = supabase.from('decisions').select('*,workstream:role_items!decisions_workstream_id_owner_id_company_id_fkey(title,deleted_at)', { count: 'exact' }).eq('owner_id', ownerId).ilike('title', `%${query}%`)
        request = archived ? request.not('deleted_at', 'is', null) : request.is('deleted_at', null)
        if (decisionStatus !== 'all') request = request.eq('status', decisionStatus)
        const { data, count, error: failure } = await request.order('decided_on', { ascending: false }).order('id').range(page * 20, page * 20 + 19)
        if (!cancelled) setResult({ key, items: [], decisions: data ?? [], count: count ?? 0, error: Boolean(failure) })
      } else {
        let request = supabase.from('role_items').select('*', { count: 'exact' }).eq('owner_id', ownerId).eq('kind', tab).ilike('title', `%${query}%`)
        request = archived ? request.not('deleted_at', 'is', null) : request.is('deleted_at', null)
        const { data, count, error: failure } = await request.order('created_at', { ascending: false }).order('id').range(page * 20, page * 20 + 19)
        if (!cancelled) setResult({ key, items: data ?? [], decisions: [], count: count ?? 0, error: Boolean(failure) })
      }
    }
    void load(); return () => { cancelled = true }
  }, [key, ownerId, tab, archived, page, query, decisionStatus])
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data, error: failure } = await supabase.from('role_items').select('*').eq('owner_id', ownerId).eq('kind', 'workstream').is('deleted_at', null).ilike('title', `%${safeSearch(streamSearch)}%`).order('title').order('id').limit(20)
      if (!cancelled) { setWorkstreams(data ?? []); setStreamError(Boolean(failure)) }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [ownerId, streamSearch, revision])
  useEffect(() => {
    void supabase.rpc('log_role_view', { p_owner: ownerId }).then(({ error }) => { if (error) console.error('Role view audit failed', error) })
  }, [ownerId])
  const reload = () => setRevision(value => value + 1)
  const saved = () => { setEditor(null); setMessage(tab === 'decision' ? 'Decision saved.' : 'Role record saved.'); reload() }
  function changeView() { setEditor(null); setPage(0); setMessage(''); setError('') }
  async function archive(row: RoleItem | Decision) {
    const restore = Boolean(row.deleted_at)
    if (!restore && !window.confirm(`Archive “${row.title}”? You can restore it from archived records.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      // oxlint-disable-next-line react/purity -- This timestamp is made in an event handler, not during render.
      const { error: failure } = await supabase.from(tab === 'decision' ? 'decisions' : 'role_items').update({ deleted_at: restore ? null : new Date().toISOString() }).eq('id', row.id).select('id').single()
      if (failure) throw failure
      setMessage(restore ? 'Record restored.' : 'Record archived.'); reload()
    } catch (reason) { console.error('Record archive failed', reason); setError(recordError(reason)) } finally { setBusy(false) }
  }
  const current = result?.key === key ? result : null
  const label = tab === 'decision' ? 'Decision Log' : itemKinds.find(row => row[0] === tab)![1]
  return <><div className="page-heading"><span className="eyebrow">{company?.name}</span><h1 tabIndex={-1}>Role record</h1><p>{own ? 'Keep the context behind your role, so someone else can pick up the work.' : `Reading ${ownerName}’s role record. Only the owner can edit it.`}</p></div>
    <section className="card"><h2>{own ? 'Your role' : ownerName}</h2>{profile?.role !== 'employee' && <div className="form-grid"><Input label="Find a team member" type="search" value={ownerSearch} onChange={event => setOwnerSearch(event.target.value)} /><div className="field"><label htmlFor="record-owner">Role record owner</label><select id="record-owner" value={ownerId} onChange={event => { const id = event.target.value; setOwnerId(id); setOwnerName(id === profile!.id ? profile!.full_name : owners.find(row => row.id === id)?.full_name ?? 'Team member'); changeView() }}><option value={profile!.id}>My role record</option>{ownerId !== profile!.id && !owners.some(row => row.id === ownerId) && <option value={ownerId}>{ownerName}</option>}{owners.filter(row => row.id !== profile!.id).map(row => <option key={row.id} value={row.id}>{row.full_name}</option>)}</select></div>{ownerError && <p role="alert">Team choices could not be loaded. Try searching again.</p>}</div>}<details className="visibility-panel"><summary>What my manager can see</summary><p>Managers in your department can read your responsibilities, workstreams, external contacts, document links, recurring deadlines, decisions and archived records. Your company’s HR Admin can read these across the company. Only you can edit your role record.</p><p>Managers outside your department and employees outside your role cannot read it. If you have no department, only you and company HR Admins can read it. Cover access is coming with handovers.</p></details></section>
    <nav className="record-tabs" aria-label="Role record sections">{[...itemKinds, ['decision', 'Decision Log'] as const].map(([value, title]) => <Button key={value} variant={tab === value ? 'primary' : 'secondary'} aria-pressed={tab === value} onClick={() => { setTab(value); changeView() }}>{title}</Button>)}</nav>
    {message && <p className="notice" role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {editor && own && (tab === 'decision' ? <><section className="card"><Input label="Find a workstream for this decision" type="search" value={streamSearch} onChange={event => setStreamSearch(event.target.value)} /><p className="muted">Search to find workstreams beyond the first 20 choices.</p>{streamError && <p role="alert">Workstream choices could not be loaded. Try searching again.</p>}</section><DecisionForm key={editor.decision?.id ?? 'new-decision'} decision={editor.decision} workstreams={workstreams} companyId={company!.id} ownerId={ownerId} saved={saved} cancel={() => setEditor(null)} /></> : <ItemForm key={editor.item?.id ?? tab} kind={tab} item={editor.item} companyId={company!.id} ownerId={ownerId} saved={saved} cancel={() => setEditor(null)} />)}
    <section className="card"><div className="record-section-heading"><h2>{label}</h2>{own && !archived && !editor && <Button onClick={() => { setEditor({}); setError(''); setMessage('') }}>{tab === 'decision' ? 'Add decision' : 'Add record'}</Button>}</div><div className="record-filters"><Input label="Search titles" type="search" value={search} onChange={event => setSearch(event.target.value)} />{tab === 'decision' && <div className="field"><label htmlFor="filter-status">Filter decision status</label><select id="filter-status" value={decisionStatus} onChange={event => { setDecisionStatus(event.target.value); setPage(0) }}><option value="all">All statuses</option><option value="live">Live</option><option value="replaced">Replaced</option><option value="reversed">Reversed</option></select></div>}<label className="checkbox-line"><input type="checkbox" checked={archived} onChange={event => { setArchived(event.target.checked); changeView() }} />Show archived records</label></div>
    {!current ? <p role="status">Loading records…</p> : current.error ? <><p role="alert">Records could not be loaded.</p><Button onClick={reload}>Retry records</Button></> : current.count === 0 ? <p>{query || decisionStatus !== 'all' ? 'No records match these filters.' : archived ? 'No archived records here.' : `No ${label.toLowerCase()} yet.${own ? ' Add your first record when you are ready.' : ''}`}</p> : <><ul className="record-list role-record-list">{current.items.map(item => <li key={item.id}><article><h3>{item.title}</h3>{item.details && <p className="record-text">{item.details}</p>}{item.contact_email && <p>Email: {item.contact_email}</p>}{item.contact_phone && <p>Phone: {item.contact_phone}</p>}{item.due_date && <p>Next deadline: <time dateTime={item.due_date}>{item.due_date}</time></p>}{item.recurrence && <p>Recurrence: {item.recurrence}</p>}<WebLink href={item.url}>{item.kind === 'document' ? 'Open document' : 'Open supporting link'}</WebLink></article>{own && <div className="form-actions">{!archived && <Button variant="secondary" disabled={busy} onClick={() => setEditor({ item })} aria-label={`Edit ${item.title}`}>Edit</Button>}<Button variant="secondary" disabled={busy} onClick={() => { void archive(item) }} aria-label={`${archived ? 'Restore' : 'Archive'} ${item.title}`}>{archived ? 'Restore' : 'Archive'}</Button></div>}</li>)}{current.decisions.map(decision => <li key={decision.id}><article><span className="badge">{decision.status}</span><h3>{decision.title}</h3><p className="record-text"><strong>Why:</strong> {decision.reason}</p><p>Decided by {decision.decided_by} on <time dateTime={decision.decided_on}>{decision.decided_on}</time></p><p>{decision.workstream_id ? `Workstream: ${decision.workstream?.title ?? 'Linked workstream'}${decision.workstream?.deleted_at ? ' (archived)' : ''}` : 'Applies to the whole role'}</p><div className="form-actions"><WebLink href={decision.source_url}>Open source</WebLink><WebLink href={decision.related_task_url}>Open related task</WebLink></div></article>{own && <div className="form-actions">{!archived && <Button variant="secondary" disabled={busy} onClick={() => setEditor({ decision })} aria-label={`Edit ${decision.title}`}>Edit</Button>}<Button variant="secondary" disabled={busy} onClick={() => { void archive(decision) }} aria-label={`${archived ? 'Restore' : 'Archive'} ${decision.title}`}>{archived ? 'Restore' : 'Archive'}</Button></div>}</li>)}</ul><div className="pagination"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous records</Button><span>Page {page + 1}</span><Button variant="secondary" disabled={(page + 1) * 20 >= current.count} onClick={() => setPage(value => value + 1)}>Next records</Button></div></>}
    </section>
  </>
}
