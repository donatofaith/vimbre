import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { safeSearch } from '../team/team-utils'
import { ItemForm, DecisionForm } from './RecordForms'
import type { RoleItem, Decision } from './RecordForms'
import { itemKinds, recordError, safeRecordUrl } from './record-utils'
import type { ItemKind } from './record-utils'
import { recordExamples } from './record-examples'
import './role-record.css'

type Tab = ItemKind | 'decision'
type Owner = { id: string; full_name: string }

const guides: Record<Tab, { examples: string[]; empty: string }> = {
  responsibility: {
    examples: [
      'Prepare the weekly report',
      'Coordinate supplier reviews',
      'Keep team procedures up to date',
    ],
    empty:
      'Add the work you are responsible for, so someone else knows where to start.',
  },
  workstream: {
    examples: [
      'Monthly reporting',
      'Supplier onboarding',
      'Quarterly planning',
    ],
    empty:
      'Group ongoing work so its records and decisions have a clear home.',
  },
  external_contact: {
    examples: [
      'A supplier contact',
      'An external adviser',
      'A delivery partner',
    ],
    empty:
      'Add the people outside your team that someone covering your work may need.',
  },
  document: {
    examples: [
      'A reporting guide',
      'A shared project folder',
      'A team checklist',
    ],
    empty: 'Link the documents that explain how your work gets done.',
  },
  recurring_deadline: {
    examples: [
      'Friday operations report',
      'Monthly invoice review',
      'Quarterly supplier check-in',
    ],
    empty:
      'Add the next due date and explain how often the work repeats.',
  },
  decision: {
    examples: [
      'Why a reporting date changed',
      'Why a supplier was chosen',
      'Why a process was updated',
    ],
    empty: 'Record what was decided, why, and what it affects.',
  },
}

function WebLink({
  href,
  children,
}: {
  href: string | null
  children: string
}) {
  const safe = safeRecordUrl(href)

  return safe ? (
    <a href={safe} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : null
}

export function RoleRecordPage() {
  const [params] = useSearchParams()
  return <RoleRecordContent key={params.get('record') ?? 'all'} />
}

function RoleRecordContent() {
  const { profile, company } = useAuth()
  const accessDialog = useRef<HTMLDialogElement>(null)

  const [ownerId, setOwnerId] = useState(profile!.id)
  const [ownerName, setOwnerName] = useState(profile!.full_name)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [owners, setOwners] = useState<Owner[]>([])
  const [ownerError, setOwnerError] = useState(false)

  const [sectionParams, setSectionParams] = useSearchParams()
  const requestedRecord = sectionParams.get('record') ?? ''
  const recordId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedRecord) ? requestedRecord : ''
  const requestedSection = sectionParams.get('section')
  const tab: Tab = requestedSection === 'decision' || itemKinds.some(([kind]) => kind === requestedSection)
    ? requestedSection as Tab : 'responsibility'
  const setTab = (value: Tab) => setSectionParams({ section: value })
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [decisionStatus, setDecisionStatus] = useState('all')

  const [result, setResult] = useState<{
    key: string
    items: RoleItem[]
    decisions: Decision[]
    count: number
    error: boolean
  } | null>(null)

  const [workstreams, setWorkstreams] = useState<RoleItem[]>([])
  const [streamSearch, setStreamSearch] = useState('')
  const [streamError, setStreamError] = useState(false)

  const [editor, setEditor] = useState<{
    item?: RoleItem
    decision?: Decision
  } | null>(null)

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const own = ownerId === profile!.id

  const key =
    `${ownerId}:${tab}:${archived}:${page}:` +
    `${revision}:${query}:${decisionStatus}:${recordId}`

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(safeSearch(search))
      setPage(0)
    }, 250)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (profile?.role === 'employee') return

    let cancelled = false

    const timer = setTimeout(async () => {
      const { data, error: failure } = await supabase
        .from('profiles')
        .select('id,full_name')
        .eq('active', true)
        .ilike('full_name', `%${safeSearch(ownerSearch)}%`)
        .order('full_name')
        .order('id')
        .limit(20)

      if (!cancelled) {
        setOwners(data ?? [])
        setOwnerError(Boolean(failure))
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [profile?.role, ownerSearch])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (tab === 'decision') {
        let request = supabase
          .from('decisions')
          .select(
            '*,workstream:role_items!decisions_workstream_id_owner_id_company_id_fkey(title,deleted_at)',
            { count: 'exact' },
          )
          .eq('owner_id', ownerId)
          .ilike('title', `%${query}%`)

        request = archived
          ? request.not('deleted_at', 'is', null)
          : request.is('deleted_at', null)

        if (decisionStatus !== 'all') {
          request = request.eq('status', decisionStatus)
        }

        const { data, count, error: failure } = await request
          .order('decided_on', { ascending: false })
          .order('id')
          .range(page * 20, page * 20 + 19)

        if (!cancelled) {
          setResult({
            key,
            items: [],
            decisions: data ?? [],
            count: count ?? 0,
            error: Boolean(failure),
          })
        }
      } else {
        let request = supabase
          .from('role_items')
          .select('*', { count: 'exact' })
          .eq('owner_id', ownerId)
          .eq('kind', tab)
          .ilike('title', `%${query}%`)

        if (recordId) request = request.eq('id', recordId)

        request = archived
          ? request.not('deleted_at', 'is', null)
          : request.is('deleted_at', null)

        const { data, count, error: failure } = await request
          .order('created_at', { ascending: false })
          .order('id')
          .range(page * 20, page * 20 + 19)

        if (!cancelled) {
          setResult({
            key,
            items: data ?? [],
            decisions: [],
            count: count ?? 0,
            error: Boolean(failure),
          })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [key, ownerId, tab, archived, page, query, decisionStatus, recordId])

  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      const { data, error: failure } = await supabase
        .from('role_items')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('kind', 'workstream')
        .is('deleted_at', null)
        .ilike('title', `%${safeSearch(streamSearch)}%`)
        .order('title')
        .order('id')
        .limit(20)

      if (!cancelled) {
        setWorkstreams(data ?? [])
        setStreamError(Boolean(failure))
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ownerId, streamSearch, revision])

  useEffect(() => {
    void supabase
      .rpc('log_role_view', { p_owner: ownerId })
      .then(({ error }) => {
        if (error) console.error('Role view audit failed', error)
      })
  }, [ownerId])

  const reload = () => { setRevision(value => value + 1); window.dispatchEvent(new Event('vimbre:work-changed')) }

  const saved = () => {
    setEditor(null)
    setMessage(
      tab === 'decision' ? 'Decision saved.' : 'Role record saved.',
    )
    reload()
  }

  function changeView() {
    setEditor(null)
    setPage(0)
    setMessage('')
    setError('')
  }

  async function archive(row: RoleItem | Decision) {
    const restore = Boolean(row.deleted_at)

    if (
      !restore &&
      !window.confirm(
        `Archive “${row.title}”? You can restore it from archived records.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      // oxlint-disable-next-line react/purity -- Timestamp is created in an event handler.
      const archivedAt = restore ? null : new Date().toISOString()
      const { error: failure } = await supabase
        .from(tab === 'decision' ? 'decisions' : 'role_items')
        .update({
          deleted_at: archivedAt,
        })
        .eq('id', row.id)
        .select('id')
        .single()

      if (failure) throw failure

      setMessage(restore ? 'Record restored.' : 'Record archived.')
      reload()
    } catch (reason) {
      console.error('Record archive failed', reason)
      setError(recordError(reason))
    } finally {
      setBusy(false)
    }
  }

  const current = result?.key === key ? result : null

  const label =
    tab === 'decision'
      ? 'Decision Log'
      : itemKinds.find(row => row[0] === tab)![1]

  const guidance =
    tab === 'decision'
      ? 'Record what was decided and why. This helps the next person understand the choices behind the work.'
      : recordExamples[tab].guidance

  const addLabel = tab === 'decision' ? 'Add decision' : 'Add record'

  function openEditor() {
    setEditor({})
    setError('')
    setMessage('')
  }

  function selectTab(value: Tab) {
    setTab(value)
    setArchived(false)
    setSearch('')
    setQuery('')
    setDecisionStatus('all')
    changeView()
  }

  return (
    <div className="vr-page">
      <header className="vw-page-heading">
        <div>
          <span className="vw-eyebrow">
            {company?.name ?? 'Your workspace'}
          </span>

          <h1 tabIndex={-1} aria-label="Role record">
            {own ? 'Your role record' : 'Role record'}
          </h1>


        </div>

        {own && !archived && !editor && (
          <Button disabled={busy} onClick={openEditor}>
            <WorkspaceIcon name="plus" />
            {addLabel}
          </Button>
        )}
      </header>

      {recordId && <Link to={`/app/role-record?section=${tab}`}>All records</Link>}
      {profile?.role !== 'employee' && (
        <section
          className="vr-owner"
          aria-label="Choose a role record"
        >
          <h2>{own ? 'Your role' : ownerName}</h2>

          <div className="form-grid">
            <Input
              label="Find a team member"
              type="search"
              value={ownerSearch}
              disabled={busy}
              onChange={event => setOwnerSearch(event.target.value)}
            />

            <div className="field">
              <label htmlFor="record-owner">Role record owner</label>

              <select
                id="record-owner"
                value={ownerId}
                disabled={busy}
                onChange={event => {
                  const id = event.target.value

                  setOwnerId(id)
                  setOwnerName(
                    id === profile!.id
                      ? profile!.full_name
                      : owners.find(row => row.id === id)?.full_name ??
                          'Team member',
                  )
                  changeView()
                }}
              >
                <option value={profile!.id}>My role record</option>

                {ownerId !== profile!.id &&
                  !owners.some(row => row.id === ownerId) && (
                    <option value={ownerId}>{ownerName}</option>
                  )}

                {owners
                  .filter(row => row.id !== profile!.id)
                  .map(row => (
                    <option key={row.id} value={row.id}>
                      {row.full_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {ownerError && (
            <p role="alert">
              Team choices could not be loaded. Try searching again.
            </p>
          )}
        </section>
      )}

      <section
        className="form-actions"
        aria-label="Role record visibility"
      >
        <button
          className="vw-access-button"
          type="button"
          onClick={() => accessDialog.current?.showModal()}
        >
          <WorkspaceIcon name="eye" />
          What my manager can see
        </button>
      </section>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="vr-error" role="alert">
          {error}
        </p>
      )}

      <section
        className="vr-module"
        aria-label="Role record sections and records"
      >
        <nav className="vr-tabs" aria-label="Role record sections">
          {[
            ...itemKinds,
            ['decision', 'Decision Log'] as const,
          ].map(([value, title]) => (
            <button
              type="button"
              key={value}
              aria-label={title}
              aria-pressed={tab === value}
              disabled={busy}
              onClick={() => selectTab(value)}
            >
              {value === 'decision' ? 'Decision log' : title}
            </button>
          ))}
        </nav>

        {editor && own && (
          <div className="vr-editor-area">
            {tab === 'decision' ? (
              <>
                <div className="vr-stream-search">
                  <Input
                    label="Find a workstream for this decision"
                    type="search"
                    value={streamSearch}
                    onChange={event =>
                      setStreamSearch(event.target.value)
                    }
                  />

                  <p className="muted">
                    Search to find workstreams beyond the first 20
                    choices.
                  </p>

                  {streamError && (
                    <p role="alert">
                      Workstream choices could not be loaded. Try
                      searching again.
                    </p>
                  )}
                </div>

                <DecisionForm
                  key={editor.decision?.id ?? 'new-decision'}
                  decision={editor.decision}
                  workstreams={workstreams}
                  companyId={company!.id}
                  ownerId={ownerId}
                  saved={saved}
                  cancel={() => setEditor(null)}
                />
              </>
            ) : (
              <ItemForm
                key={editor.item?.id ?? tab}
                kind={tab}
                item={editor.item}
                companyId={company!.id}
                ownerId={ownerId}
                saved={saved}
                cancel={() => setEditor(null)}
              />
            )}
          </div>
        )}

        <div className="vr-filters">
          <div className="vr-search">
            <Input
              label="Search titles"
              placeholder={`Search ${label.toLowerCase()}`}
              type="search"
              value={search}
              disabled={busy}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          {tab === 'decision' && (
            <div className="field">
              <label htmlFor="filter-status">
                Filter decision status
              </label>

              <select
                id="filter-status"
                value={decisionStatus}
                disabled={busy}
                onChange={event => {
                  setDecisionStatus(event.target.value)
                  setPage(0)
                }}
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="replaced">Replaced</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>
          )}

          <label className="vr-archived">
            <input
              type="checkbox"
              checked={archived}
              disabled={busy}
              onChange={event => {
                setArchived(event.target.checked)
                changeView()
              }}
            />
            Show archived records
          </label>
        </div>

        <div className="vr-records-grid">
          <div
            className="vr-records-main"
            aria-busy={!current}
          >
            {!current ? (
              <div className="vr-state">
                <p role="status">Loading records…</p>
              </div>
            ) : current.error ? (
              <div className="vr-state">
                <p role="alert">Records could not be loaded.</p>
                <Button variant="secondary" onClick={reload}>
                  Retry records
                </Button>
              </div>
            ) : current.count === 0 ? (
              <div className="vr-state">
                <span className="vw-empty-icon">
                  <WorkspaceIcon
                    name={tab === 'decision' ? 'check' : 'record'}
                  />
                </span>

                <h2>
                  {query || decisionStatus !== 'all'
                    ? 'No records match these filters.'
                    : archived
                      ? 'No archived records here.'
                      : `No ${label.toLowerCase()} yet.`}
                </h2>

                <p>
                  {query || decisionStatus !== 'all'
                    ? 'Try another title or change your filters.'
                    : archived
                      ? 'Archived records will appear here when you have them.'
                      : own
                        ? guides[tab].empty
                        : 'This team member has not added records in this section.'}
                </p>

                {own &&
                  !archived &&
                  !editor &&
                  !query &&
                  decisionStatus === 'all' && (
                    <Button
                      disabled={busy}
                      onClick={openEditor}
                      aria-label={`${addLabel}: your first ${
                        tab === 'decision' ? 'decision' : 'record'
                      }`}
                    >
                      <WorkspaceIcon name="plus" />
                      {addLabel}
                    </Button>
                  )}
              </div>
            ) : (
              <>
                <ul className="vr-list">
                  {current.items.map(item => (
                    <li key={item.id}>
                      <article>
                        <h3>{item.title}</h3>

                        {item.details && (
                          <p className="record-text">
                            {item.details}
                          </p>
                        )}

                        {item.contact_email && (
                          <p>Email: {item.contact_email}</p>
                        )}

                        {item.contact_phone && (
                          <p>Phone: {item.contact_phone}</p>
                        )}

                        {item.due_date && (
                          <p>
                            {item.kind === 'responsibility' ? 'Deadline: ' : 'Next deadline: '}
                            <time dateTime={item.due_date}>
                              {item.due_date}
                            </time>
                          </p>
                        )}

                        {item.recurrence && (
                          <p>Recurrence: {item.recurrence}</p>
                        )}

                        <WebLink href={item.url}>
                          {item.kind === 'document'
                            ? 'Open document'
                            : 'Open supporting link'}
                        </WebLink>
                      </article>

                      {own && (
                        <div className="form-actions">
                          {!archived && (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => setEditor({ item })}
                              aria-label={`Edit ${item.title}`}
                            >
                              Edit
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              void archive(item)
                            }}
                            aria-label={`${
                              archived ? 'Restore' : 'Archive'
                            } ${item.title}`}
                          >
                            {archived ? 'Restore' : 'Archive'}
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}

                  {current.decisions.map(decision => (
                    <li key={decision.id}>
                      <article>
                        <span className="badge">
                          {decision.status}
                        </span>

                        <h3>{decision.title}</h3>

                        <p className="record-text">
                          <strong>Why:</strong> {decision.reason}
                        </p>

                        <p>
                          Decided by {decision.decided_by} on{' '}
                          <time dateTime={decision.decided_on}>
                            {decision.decided_on}
                          </time>
                        </p>

                        <p>
                          {decision.workstream_id
                            ? `Workstream: ${
                                decision.workstream?.title ??
                                'Linked workstream'
                              }${
                                decision.workstream?.deleted_at
                                  ? ' (archived)'
                                  : ''
                              }`
                            : 'Applies to the whole role'}
                        </p>

                        <div className="form-actions">
                          <WebLink href={decision.source_url}>
                            Open source
                          </WebLink>

                          <WebLink href={decision.related_task_url}>
                            Open related task
                          </WebLink>

                          {own && (
                            <Link
                              to={`/app?decision=${decision.id}`}
                            >
                              View linked tasks
                            </Link>
                          )}
                        </div>
                      </article>

                      {own && (
                        <div className="form-actions">
                          {!archived && (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                setEditor({ decision })
                              }
                              aria-label={`Edit ${decision.title}`}
                            >
                              Edit
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              void archive(decision)
                            }}
                            aria-label={`${
                              archived ? 'Restore' : 'Archive'
                            } ${decision.title}`}
                          >
                            {archived ? 'Restore' : 'Archive'}
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {(current.count > 20 || page > 0) && (
                  <div className="pagination">
                    <Button
                      variant="secondary"
                      disabled={page === 0 || busy}
                      onClick={() => setPage(value => value - 1)}
                    >
                      Previous records
                    </Button>

                    <span>Page {page + 1}</span>

                    <Button
                      variant="secondary"
                      disabled={
                        (page + 1) * 20 >= current.count || busy
                      }
                      onClick={() => setPage(value => value + 1)}
                    >
                      Next records
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="vr-guide" aria-label="Record guidance">
            <h2>What belongs here</h2>
            <p>{guidance}</p>

            <div>
              <h3>Examples to guide you</h3>
              <ul>
                {guides[tab].examples.map(example => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>


          </aside>
        </div>


      </section>

      {tab !== 'decision' && (
        <section className="vr-decision-callout">
          <span className="vr-icon">
            <WorkspaceIcon name="check" />
          </span>

          <div>
            <h2>Keep the reason behind the decision.</h2>
            <p>Record what was decided, why, and what it affects.</p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => selectTab('decision')}
          >
            Open decision log
            <WorkspaceIcon name="arrow" />
          </button>
        </section>
      )}



      <dialog
        ref={accessDialog}
        className="vw-dialog"
        aria-labelledby="vr-access-title"
      >
        <h2 id="vr-access-title">What my manager can see</h2>

        <p>
          Managers in your department can read your responsibilities,
          workstreams, external contacts, document links, recurring
          deadlines, decisions, tasks, completion notes and archived
          records. Your company’s HR Admin can read these across the
          company.
        </p>

        <p>
          Managers outside your department and employees outside your
          role cannot read it. If you have no department, only you and
          company HR Admins can read it.
        </p>

        <form method="dialog">
          <Button type="submit">Got it</Button>
        </form>
      </dialog>
    </div>
  )
}
