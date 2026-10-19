import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { safeSearch } from '../team/team-utils'
import { localDate, safeRecordUrl } from '../records/record-utils'
import { ActionForm, CompleteAction } from './ActionForm'
import type { Action } from './ActionForm'
import { actionError } from './action-utils'

type View = 'open' | 'today' | 'overdue' | 'done' | 'archived'
const views: [View, string][] = [['open', 'All open'], ['today', 'Due today'], ['overdue', 'Overdue'], ['done', 'Recently done'], ['archived', 'Archived']]
export function WorkspacePage() {
  return <ActionWorkspace />
}
export function TeamMemberActions({ member }: { member: { id: string; full_name: string } }) {
  return <ActionWorkspace key={member.id} member={member} />
}
function ActionWorkspace({ member }: { member?: { id: string; full_name: string } }) {
  const { profile, company } = useAuth()
  const [params, setParams] = useSearchParams()
  const linked = params.get('decision') ?? ''
  const decisionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linked) ? linked : ''
  const ownerId = member?.id ?? profile!.id
  const [today, setToday] = useState(localDate), [view, setView] = useState<View>('open')
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(0), [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; rows: Action[]; count: number; error: boolean } | null>(null)
  const [editor, setEditor] = useState<{ action?: Action } | null>(null), [finishing, setFinishing] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const own = !member && ownerId === profile!.id
  const key = `${ownerId}:${view}:${query}:${page}:${revision}:${today}:${decisionId}`
  const reload = () => setRevision(value => value + 1)
  useEffect(() => { const timer = setInterval(() => setToday(localDate()), 60000); return () => clearInterval(timer) }, [])
  useEffect(() => { const timer = setTimeout(() => { setQuery(safeSearch(search)); setPage(0) }, 250); return () => clearTimeout(timer) }, [search])
  useEffect(() => {
    let cancelled = false
    async function load() {
      let request = supabase.from('actions').select('*,decision:decisions!actions_decision_id_owner_id_company_id_fkey(title,deleted_at)', { count: 'exact' }).eq('owner_id', ownerId).ilike('title', `%${query}%`)
      request = view === 'archived' ? request.not('deleted_at', 'is', null) : request.is('deleted_at', null)
      if (view === 'done') request = request.eq('status', 'done')
      else if (view !== 'archived') request = request.neq('status', 'done')
      if (view === 'today') request = request.eq('due_date', today)
      if (view === 'overdue') request = request.lt('due_date', today)
      if (decisionId) request = request.eq('decision_id', decisionId)
      const order = view === 'done' ? 'completed_at' : view === 'archived' ? 'deleted_at' : 'due_date'
      const { data, count, error: failure } = await request.order(order, { ascending: view !== 'done' && view !== 'archived' }).order('id').range(page * 20, page * 20 + 19)
      if (!cancelled) { if (failure) console.error('Actions load failed', failure); setResult({ key, rows: Array.isArray(data) ? data : [], count: count ?? 0, error: Boolean(failure) }) }
    }
    void load(); return () => { cancelled = true }
  }, [key, ownerId, view, query, page, today, decisionId])
  useEffect(() => { void supabase.rpc('log_action_view', { p_owner: ownerId }).then(({ error }) => { if (error) console.error('Actions view audit failed', error) }) }, [ownerId])
  function changeView() { setPage(0); setEditor(null); setFinishing(null); setError(''); setMessage('') }
  function saved(text: string) { setEditor(null); setFinishing(null); setMessage(text); reload() }
  async function changeAction(action: Action, restore = false, reopen = false) {
    if (!restore && !reopen && !window.confirm(`Archive “${action.title}”? You can restore it from Archived.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      // oxlint-disable-next-line react/purity -- Executed from a button event, not render.
      const values = reopen ? { status: 'open' } : { deleted_at: restore ? null : new Date().toISOString() }
      const { error: failure } = await supabase.from('actions').update(values).eq('id', action.id).select('id').single()
      if (failure) throw failure; saved(reopen ? 'Action reopened.' : restore ? 'Action restored.' : 'Action archived.')
    } catch (reason) { console.error('Action change failed', reason); setError(actionError(reason)) } finally { setBusy(false) }
  }
  const current = result?.key === key ? result : null
  return <>{!member && <div className="page-heading"><span className="eyebrow">{company?.name}</span><h1 tabIndex={-1}>My day</h1><p>Your tasks, due dates and progress. This page always shows your own work.</p><div className="form-actions"><Link to="/app/role-record">Open role record</Link>{profile?.role !== 'employee' && <Link to="/app/team-activity">View team activity</Link>}</div></div>}
    <section className="card"><div className="record-section-heading"><h2>{member ? `${member.full_name}’s actions` : 'Your actions'}</h2>{own && !editor && !finishing && <Button onClick={() => { setEditor({}); setMessage(''); setError('') }}>Add action</Button>}</div><p className="muted">{member ? 'Read their open work and completed outcomes. Only this person can change their actions.' : 'An action is one task with an outcome and a due date. For example: Send the weekly report by Friday. Add your own work to get started.'}</p>{!member && <p className="muted">Cover duties will appear here when handovers are available.</p>}</section>
    {message && <p role="status" className="notice">{message}</p>}{error && <p role="alert">{error}</p>}
    {editor && own && <ActionForm key={editor.action?.id ?? `new:${decisionId}`} action={editor.action} ownerId={ownerId} companyId={company!.id} initialDecision={decisionId} saved={() => saved('Action saved.')} cancel={() => setEditor(null)} />}
    {finishing && own && <CompleteAction key={finishing.id} action={finishing} saved={() => saved('Action completed. Check Recently done to see the outcome.')} cancel={() => setFinishing(null)} />}
    <section className="card"><nav className="record-tabs" aria-label="Action views">{views.map(([value, label]) => <Button key={value} variant={view === value ? 'primary' : 'secondary'} aria-pressed={view === value} onClick={() => { setView(value); changeView() }}>{label}</Button>)}</nav><Input label="Search actions" type="search" placeholder="e.g. Weekly report" value={search} onChange={event => setSearch(event.target.value)} />{decisionId && <p className="notice">Showing actions linked to the selected decision. <Button variant="secondary" onClick={() => { setParams({}); changeView() }}>Show all decisions</Button></p>}
    {!current ? <p role="status">Loading actions…</p> : current.error ? <><p role="alert">Actions could not be loaded.</p><Button onClick={reload}>Retry actions</Button></> : <>{current.rows.length === 0 ? <p>{page > 0 ? 'No more actions on this page. Go back to the previous page.' : view === 'done' ? 'No completed actions match this view yet.' : view === 'archived' ? 'No archived actions match this view.' : member ? 'No open actions match this view for this person.' : 'No open actions match this view. Add an action or choose another view.'}</p> : <ul className="record-list role-record-list">{current.rows.map(action => <li key={action.id}><article><div className="form-actions"><span className="badge">{action.status === 'in_progress' ? 'In progress' : action.status === 'done' ? 'Done' : 'Open'}</span>{!action.deleted_at && action.status !== 'done' && action.due_date < today && <span className="badge">Overdue</span>}</div><h3>{action.title}</h3><p>Due <time dateTime={action.due_date}>{action.due_date}</time></p>{action.details && <p className="record-text">{action.details}</p>}{action.decision_id && <p>Decision: {action.decision?.title ?? 'Linked decision'}{action.decision?.deleted_at ? ' (archived)' : ''}</p>}{safeRecordUrl(action.source_url) && <a href={safeRecordUrl(action.source_url)!} target="_blank" rel="noopener noreferrer">Open source</a>}{action.status === 'done' && <><p>Completed <time dateTime={action.completed_at ?? ''}>{action.completed_at ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(Date.parse(action.completed_at)) : 'just now'}</time></p>{action.completion_note && <p className="record-text"><strong>Completion note:</strong> {action.completion_note}</p>}</>}</article>{own && <div className="form-actions">{action.deleted_at ? <Button variant="secondary" disabled={busy} onClick={() => { void changeAction(action, true) }} aria-label={`Restore ${action.title}`}>Restore</Button> : <><Button variant="secondary" disabled={busy} onClick={() => { setEditor({ action }); setFinishing(null) }} aria-label={`Edit ${action.title}`}>Edit</Button>{action.status !== 'done' ? <Button disabled={busy} onClick={() => { setFinishing(action); setEditor(null) }} aria-label={`Complete ${action.title}`}>Complete</Button> : <Button variant="secondary" disabled={busy} onClick={() => { void changeAction(action, false, true) }} aria-label={`Reopen ${action.title}`}>Reopen</Button>}<Button variant="secondary" disabled={busy} onClick={() => { void changeAction(action) }} aria-label={`Archive ${action.title}`}>Archive</Button></>}</div>}</li>)}</ul>}<div className="pagination"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous actions</Button><span>Page {page + 1}</span><Button variant="secondary" disabled={(page + 1) * 20 >= current.count} onClick={() => setPage(value => value + 1)}>Next actions</Button></div></>}
    </section>
  </>
}
