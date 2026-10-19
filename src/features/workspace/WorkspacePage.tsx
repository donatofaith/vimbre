import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { safeSearch } from '../team/team-utils'
import { localDate, safeRecordUrl } from '../records/record-utils'
import { ActionForm, CompleteAction } from './ActionForm'
import type { Action } from './ActionForm'
import { actionError } from './action-utils'

type View = 'open' | 'today' | 'overdue' | 'done' | 'archived'

const views: [View, string][] = [
  ['open', 'All open'],
  ['today', 'Due today'],
  ['overdue', 'Overdue'],
  ['done', 'Recently done'],
  ['archived', 'Archived'],
]

export function WorkspacePage() {
  return <ActionWorkspace />
}

export function TeamMemberActions({
  member,
}: {
  member: { id: string; full_name: string }
}) {
  return <ActionWorkspace key={member.id} member={member} />
}

function ActionWorkspace({
  member,
}: {
  member?: { id: string; full_name: string }
}) {
  const { profile, company } = useAuth()
  const access = useRef<HTMLDialogElement>(null)
  const [params, setParams] = useSearchParams()

  const linked = params.get('decision') ?? ''

  const decisionId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      linked,
    )
      ? linked
      : ''

  const ownerId = member?.id ?? profile!.id

  const [today, setToday] = useState(localDate)
  const [view, setView] = useState<View>('open')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)

  const [result, setResult] = useState<{
    key: string
    rows: Action[]
    count: number
    error: boolean
  } | null>(null)

  const [editor, setEditor] = useState<{
    action?: Action
  } | null>(null)

  const [finishing, setFinishing] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const own = !member && ownerId === profile!.id

  const key = `${ownerId}:${view}:${query}:${page}:${revision}:${today}:${decisionId}`

  const reload = () => setRevision(value => value + 1)

  useEffect(() => {
    const timer = setInterval(() => setToday(localDate()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(safeSearch(search))
      setPage(0)
    }, 250)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false

    async function load() {
      let request = supabase
        .from('actions')
        .select(
          '*,decision:decisions!actions_decision_id_owner_id_company_id_fkey(title,deleted_at)',
          { count: 'exact' },
        )
        .eq('owner_id', ownerId)
        .ilike('title', `%${query}%`)

      request =
        view === 'archived'
          ? request.not('deleted_at', 'is', null)
          : request.is('deleted_at', null)

      if (view === 'done') {
        request = request.eq('status', 'done')
      } else if (view !== 'archived') {
        request = request.neq('status', 'done')
      }

      if (view === 'today') {
        request = request.eq('due_date', today)
      }

      if (view === 'overdue') {
        request = request.lt('due_date', today)
      }

      if (decisionId) {
        request = request.eq('decision_id', decisionId)
      }

      const order =
        view === 'done'
          ? 'completed_at'
          : view === 'archived'
            ? 'deleted_at'
            : 'due_date'

      const {
        data,
        count,
        error: failure,
      } = await request
        .order(order, {
          ascending: view !== 'done' && view !== 'archived',
        })
        .order('id')
        .range(page * 20, page * 20 + 19)

      if (!cancelled) {
        if (failure) console.error('Actions load failed', failure)

        setResult({
          key,
          rows: Array.isArray(data) ? data : [],
          count: count ?? 0,
          error: Boolean(failure),
        })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [key, ownerId, view, query, page, today, decisionId])

  useEffect(() => {
    void supabase
      .rpc('log_action_view', { p_owner: ownerId })
      .then(({ error }) => {
        if (error) console.error('Actions view audit failed', error)
      })
  }, [ownerId])

  function changeView() {
    setPage(0)
    setEditor(null)
    setFinishing(null)
    setError('')
    setMessage('')
  }

  function saved(text: string) {
    setEditor(null)
    setFinishing(null)
    setMessage(text)
    reload()
  }

  function addAction() {
    setEditor({})
    setMessage('')
    setError('')
    setFinishing(null)
  }

  async function changeAction(
    action: Action,
    restore = false,
    reopen = false,
  ) {
    if (
      !restore &&
      !reopen &&
      !window.confirm(
        `Archive “${action.title}”? You can restore it from Archived.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      // oxlint-disable-next-line react/purity -- Runs from a button event.
      const values = reopen
        ? { status: 'open' }
        : { deleted_at: restore ? null : new Date().toISOString() }

      const { error: failure } = await supabase
        .from('actions')
        .update(values)
        .eq('id', action.id)
        .select('id')
        .single()

      if (failure) throw failure

      saved(
        reopen
          ? 'Action reopened.'
          : restore
            ? 'Action restored.'
            : 'Action archived.',
      )
    } catch (reason) {
      console.error('Action change failed', reason)
      setError(actionError(reason))
    } finally {
      setBusy(false)
    }
  }

  const current = result?.key === key ? result : null

  const roleParts = [
    'Responsibilities',
    'Workstreams',
    'External contacts',
    'Documents',
    'Recurring deadlines',
  ]

  return (
    <div className={own ? 'vw-myday' : 'vw-member-actions'}>
      {!member && (
        <>
          <div className="vw-page-heading">
            <div>
              <span className="vw-eyebrow">Your workspace</span>
              <h1 tabIndex={-1} aria-label="My day">
                A clear place to start.
              </h1>
              <p>My day · Your actions and next steps</p>
            </div>

            {own && !editor && !finishing && (
              <Button onClick={addAction}>
                <WorkspaceIcon name="plus" />
                Add action
              </Button>
            )}
          </div>

          <div className="vw-shortcuts">
            {[
              [
                '/app/role-record',
                'record',
                'Your role record',
                'Keep the knowledge behind your role together.',
              ],
              [
                '/app/handovers',
                'handover',
                'My handovers',
                'Prepare the context for the next person.',
              ],
              [
                '/app/my-cover-duties',
                'people',
                'Cover duties',
                'Pick up work when you’re assigned cover.',
              ],
            ].map(([to, icon, title, text]) => (
              <Link to={to} key={to}>
                <span className="vw-shortcut-icon">
                  <WorkspaceIcon name={icon} />
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </div>
                <WorkspaceIcon name="arrow" />
              </Link>
            ))}
          </div>

          {profile?.role !== 'employee' && (
            <p className="vw-leader-link">
              My day always shows your own work.{' '}
              <Link to="/app/team-activity">
                View team activity →
              </Link>
            </p>
          )}
        </>
      )}

      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}

      {editor && own && (
        <ActionForm
          key={editor.action?.id ?? `new:${decisionId}`}
          action={editor.action}
          ownerId={ownerId}
          companyId={company!.id}
          initialDecision={decisionId}
          saved={() => saved('Action saved.')}
          cancel={() => setEditor(null)}
        />
      )}

      {finishing && own && (
        <CompleteAction
          key={finishing.id}
          action={finishing}
          saved={() =>
            saved(
              'Action completed. Check Recently done to see the outcome.',
            )
          }
          cancel={() => setFinishing(null)}
        />
      )}

      <section className="vw-actions-module">
        <div className="vw-module-heading">
          <h2>
            {member ? `${member.full_name}’s actions` : 'Your actions'}
          </h2>

          {own && (
            <button
              className="vw-access-button"
              type="button"
              onClick={() => access.current?.showModal()}
            >
              <WorkspaceIcon name="eye" />
              View access details
            </button>
          )}
        </div>

        {member && (
          <p className="vw-readonly-note">
            Only this person can change their actions.
          </p>
        )}

        <div className="vw-filter-row">
          <nav className="vw-tabs" aria-label="Action views">
            {views.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={view === value}
                onClick={() => {
                  setView(value)
                  changeView()
                }}
              >
                {value === 'open'
                  ? 'Open'
                  : value === 'today'
                    ? 'Today'
                    : label}
              </button>
            ))}
          </nav>

          <div className="vw-action-search">
            <Input
              label="Search actions"
              type="search"
              placeholder="Search your actions"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
        </div>

        {decisionId && (
          <p className="notice">
            Showing actions linked to the selected decision.{' '}
            <Button
              variant="secondary"
              onClick={() => {
                setParams({})
                changeView()
              }}
            >
              Show all decisions
            </Button>
          </p>
        )}

        <div className={own ? 'vw-actions-grid' : ''}>
          <div className="vw-actions-main">
            {!current ? (
              <div className="vw-action-state" role="status">
                Loading actions…
              </div>
            ) : current.error ? (
              <div className="vw-action-state">
                <p role="alert">Actions could not be loaded.</p>
                <Button onClick={reload}>Retry actions</Button>
              </div>
            ) : (
              <>
                {current.rows.length === 0 ? (
                  <div className="vw-action-state">
                    <span className="vw-empty-icon">
                      <WorkspaceIcon name="check" />
                    </span>

                    {own &&
                    view === 'open' &&
                    !query &&
                    page === 0 ? (
                      <>
                        <h3>No open actions yet</h3>
                        <p>
                          Add an action to keep your next step clear.
                        </p>

                        {!editor && !finishing && (
                          <Button
                            aria-label="Add action: your first task"
                            onClick={addAction}
                          >
                            <WorkspaceIcon name="plus" />
                            Add action
                          </Button>
                        )}
                      </>
                    ) : (
                      <p>
                        {page > 0
                          ? 'No more actions on this page. Go back to the previous page.'
                          : view === 'done'
                            ? 'No completed actions match this view yet.'
                            : view === 'archived'
                              ? 'No archived actions match this view.'
                              : member
                                ? 'No open actions match this view for this person.'
                                : 'No open actions match this view. Add an action or choose another view.'}
                      </p>
                    )}
                  </div>
                ) : (
                  <ul className="record-list role-record-list vw-action-list">
                    {current.rows.map(action => (
                      <li key={action.id}>
                        <article>
                          <div className="form-actions">
                            <span className="badge">
                              {action.status === 'in_progress'
                                ? 'In progress'
                                : action.status === 'done'
                                  ? 'Done'
                                  : 'Open'}
                            </span>

                            {!action.deleted_at &&
                              action.status !== 'done' &&
                              action.due_date < today && (
                                <span className="badge">Overdue</span>
                              )}
                          </div>

                          <h3>{action.title}</h3>

                          <p>
                            Due{' '}
                            <time dateTime={action.due_date}>
                              {action.due_date}
                            </time>
                          </p>

                          {action.details && (
                            <p className="record-text">
                              {action.details}
                            </p>
                          )}

                          {action.decision_id && (
                            <p>
                              Decision:{' '}
                              {action.decision?.title ??
                                'Linked decision'}
                              {action.decision?.deleted_at
                                ? ' (archived)'
                                : ''}
                            </p>
                          )}

                          {safeRecordUrl(action.source_url) && (
                            <a
                              href={
                                safeRecordUrl(action.source_url)!
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open source
                            </a>
                          )}

                          {action.status === 'done' && (
                            <>
                              <p>
                                Completed{' '}
                                <time
                                  dateTime={
                                    action.completed_at ?? ''
                                  }
                                >
                                  {action.completed_at
                                    ? new Intl.DateTimeFormat(
                                        undefined,
                                        { dateStyle: 'medium' },
                                      ).format(
                                        Date.parse(
                                          action.completed_at,
                                        ),
                                      )
                                    : 'just now'}
                                </time>
                              </p>

                              {action.completion_note && (
                                <p className="record-text">
                                  <strong>Completion note:</strong>{' '}
                                  {action.completion_note}
                                </p>
                              )}
                            </>
                          )}
                        </article>

                        {own && (
                          <div className="form-actions">
                            {action.deleted_at ? (
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => {
                                  void changeAction(action, true)
                                }}
                                aria-label={`Restore ${action.title}`}
                              >
                                Restore
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditor({ action })
                                    setFinishing(null)
                                  }}
                                  aria-label={`Edit ${action.title}`}
                                >
                                  Edit
                                </Button>

                                {action.status !== 'done' ? (
                                  <Button
                                    disabled={busy}
                                    onClick={() => {
                                      setFinishing(action)
                                      setEditor(null)
                                    }}
                                    aria-label={`Complete ${action.title}`}
                                  >
                                    Complete
                                  </Button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => {
                                      void changeAction(
                                        action,
                                        false,
                                        true,
                                      )
                                    }}
                                    aria-label={`Reopen ${action.title}`}
                                  >
                                    Reopen
                                  </Button>
                                )}

                                <Button
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => {
                                    void changeAction(action)
                                  }}
                                  aria-label={`Archive ${action.title}`}
                                >
                                  Archive
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {(current.count > 20 || page > 0) && (
                  <div className="pagination">
                    <Button
                      variant="secondary"
                      disabled={page === 0}
                      onClick={() => setPage(value => value - 1)}
                    >
                      Previous actions
                    </Button>

                    <span>Page {page + 1}</span>

                    <Button
                      variant="secondary"
                      disabled={(page + 1) * 20 >= current.count}
                      onClick={() => setPage(value => value + 1)}
                    >
                      Next actions
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {own && (
            <aside className="vw-role-guide">
              <span className="vw-eyebrow">Get started</span>
              <h2>Build your role record.</h2>

              <p>
                Start with the details someone would need to
                cover your work.
              </p>

              <ul>
                {roleParts.map((part, index) => (
                  <li key={part}>
                    <WorkspaceIcon
                      name={
                        index === 4
                          ? 'calendar'
                          : index === 2
                            ? 'people'
                            : 'record'
                      }
                    />
                    {part}
                  </li>
                ))}
              </ul>

              <Link to="/app/role-record">
                Open role record
                <WorkspaceIcon name="arrow" />
              </Link>
            </aside>
          )}
        </div>
      </section>

      {own && (
        <>
          <div className="vw-personal-note">
            <span>
              <WorkspaceIcon name="eye" />
              My day shows your personal actions.
            </span>

            <button
              type="button"
              onClick={() => access.current?.showModal()}
            >
              What my manager can see →
            </button>
          </div>

          <dialog
            className="vw-dialog"
            ref={access}
            aria-labelledby="vw-access-title"
          >
            <h2 id="vw-access-title">
              What my manager can see
            </h2>

            <p>
              Managers in your department can read your
              responsibilities, workstreams, external contacts,
              document links, recurring deadlines, decisions,
              actions, completion notes and archived records.
              Your company’s HR Admin can read these across the
              company.
            </p>

            <p>
              Only you can change your actions. Managers outside
              your department and other employees cannot read
              them. If you have no department, only you and
              company HR Admins can read them.
            </p>

            <form method="dialog">
              <Button type="submit">Close access details</Button>
            </form>
          </dialog>
        </>
      )}
    </div>
  )
}