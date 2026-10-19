import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import './capture.css'

type Source = {
  id: string
  title: string
  source_text: string
  source_date: string
  source_type: string
  deleted_at: string | null
}

type Draft = {
  id: string
  kind: string
  status: string
  version: number
  payload: Record<string, string | null>
}

type Detail = {
  source: Source
  items: Draft[]
}

type Listing = {
  rows: Source[]
  count: number
}

const labels: Record<string, string> = {
  decision: 'Decision',
  action: 'Task',
  contact: 'External contact',
}

function failure(reason: unknown) {
  const code = (reason as { code?: string })?.code

  if (code === '40001') {
    return 'This draft changed in another session. Reload the capture before continuing.'
  }

  if (
    code === '23502' ||
    code === '23514' ||
    code === '22007' ||
    code === '22008'
  ) {
    return 'Check the required details, dates and contact information before confirming.'
  }

  if (code === '42501') {
    return 'This capture is unavailable. Check that you are signed in to the right account.'
  }

  return 'That change could not be saved. Your form is still here. Please try again.'
}

export function CapturePage() {
  const { profile } = useAuth()
  return <CaptureWorkspace key={profile!.id} />
}

function CaptureWorkspace() {
  const { company } = useAuth()
  const [params, setParams] = useSearchParams()
  const selected = params.get('capture') ?? ''

  const [page, setPage] = useState(0)
  const [archived, setArchived] = useState(false)
  const [revision, setRevision] = useState(0)

  const [list, setList] = useState<{
    key: string
    data: Listing | null
    error: boolean
  } | null>(null)

  const [result, setResult] = useState<{
    key: string
    data: Detail | null
    error: boolean
  } | null>(null)

  const [editor, setEditor] = useState<{
    draft?: Draft
  } | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const sourceRequest = useRef<string | null>(null)

  const listKey = `${page}:${archived}:${revision}`
  const detailKey = `${selected}:${revision}`

  useEffect(() => {
    let cancelled = false

    void supabase
      .rpc('capture_list', {
        p_page: page,
        p_archived: archived,
      })
      .then(({ data, error }) => {
        if (!cancelled) {
          setList({
            key: listKey,
            data: data as unknown as Listing | null,
            error: Boolean(error),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [listKey, page, archived])

  useEffect(() => {
    if (!selected) return

    let cancelled = false

    void supabase
      .rpc('capture_detail', { p_id: selected })
      .then(({ data, error }) => {
        if (!cancelled) {
          setResult({
            key: detailKey,
            data: data as unknown as Detail | null,
            error: Boolean(error),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [detailKey, selected])

  const current = result?.key === detailKey ? result : null
  const detail = current?.data
  const listing = list?.key === listKey ? list : null

  function reload() {
    setRevision(value => value + 1)
  }

  function open(id: string) {
    if (
      editor &&
      !window.confirm(
        'Leave this draft form? Unsaved changes will be lost.',
      )
    ) {
      return
    }

    setEditor(null)
    setError('')
    setMessage('')
    setParams(id ? { capture: id } : {})
  }

  async function change(
    operation: string,
    id: string,
    data: Json,
    capture: string | null = selected || null,
  ) {
    const response = await supabase.rpc('capture_change', {
      p_operation: operation,
      p_id: id,
      p_capture: capture,
      p_data: data,
    })

    if (response.error) throw response.error
    return response.data
  }

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)
    sourceRequest.current ??= crypto.randomUUID()

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const id = await change(
        'create',
        sourceRequest.current,
        {
          title: String(form.get('title') ?? '').trim(),
          source_text: String(form.get('source_text') ?? '').trim(),
          source_type: String(form.get('source_type')),
          source_date: String(form.get('source_date')),
        },
        null,
      )

      sourceRequest.current = null
      setParams({ capture: id })
      setPage(0)
      setArchived(false)
      setMessage(
        'Source saved. Add drafts below, then review each one before confirming.',
      )
      reload()
    } catch (reason) {
      setError(failure(reason))
    } finally {
      setBusy(false)
    }
  }

  async function review(
    draft: Draft,
    operation: 'confirm' | 'discard',
  ) {
    if (
      operation === 'discard' &&
      !window.confirm(
        `Discard “${draft.payload.title}”? This draft will stay in the capture history.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await change(operation, draft.id, {
        version: draft.version,
      })

      setMessage(
        operation === 'confirm'
          ? `${labels[draft.kind]} confirmed and saved to ${
              draft.kind === 'action' ? 'My day' : 'your role record'
            }.`
          : 'Draft discarded.',
      )

      reload()
    } catch (reason) {
      setError(failure(reason))
    } finally {
      setBusy(false)
    }
  }

  async function archiveSource() {
    if (!detail) return

    const operation = detail.source.deleted_at
      ? 'restore'
      : 'archive'

    if (
      operation === 'archive' &&
      !window.confirm(
        'Archive this source? Confirmed records will remain in your workspace.',
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await change(operation, selected, {})

      setEditor(null)
      setParams({})
      setPage(0)

      setMessage(
        operation === 'archive'
          ? 'Capture archived. Confirmed records remain in your workspace.'
          : 'Capture restored.',
      )

      reload()
    } catch (reason) {
      setError(failure(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vc-page">
      <header className="vw-page-heading">
        <div>
          <span className="vw-eyebrow">
            {company?.name ?? 'Your workspace'}
          </span>

          <h1 tabIndex={-1} aria-label="Capture">
            Capture the context.
          </h1>

          <p>
            Keep work notes, then turn the important details into
            records.
          </p>
        </div>

        {selected && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => open('')}
          >
            New capture
          </Button>
        )}
      </header>

      <ol className="vc-steps" aria-label="Capture workflow">
        <li data-active={!selected}>
          <span>1</span>
          Add a source
        </li>
        <li data-active={Boolean(selected)}>
          <span>2</span>
          Review drafts
        </li>
        <li>
          <span>3</span>
          Confirm records
        </li>
      </ol>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="vc-error" role="alert">
          {error}
        </p>
      )}

      <div className="vc-grid">
        <section className="vc-card">
          {!selected ? (
            <>
              <h2>Paste notes</h2>

              <form onSubmit={saveSource} className="vc-form">
                <fieldset disabled={busy}>
                  <div className="vc-source-fields">
                    <Input
                      label="Source title (optional)"
                      name="title"
                      placeholder="e.g. Monday operations meeting"
                      maxLength={200}
                    />

                    <Input
                      label="Source date"
                      name="source_date"
                      type="date"
                      required
                      hint="Use the date of the original notes or email."
                    />

                    <div className="field">
                      <label htmlFor="vc-source-type">
                        Source type
                      </label>

                      <select
                        id="vc-source-type"
                        name="source_type"
                      >
                        <option value="meeting">Meeting notes</option>
                        <option value="email">Email text</option>
                        <option value="note">Work note</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="vc-notes">
                      Notes or email text
                    </label>

                    <textarea
                      id="vc-notes"
                      name="source_text"
                      rows={9}
                      maxLength={50000}
                      required
                      placeholder="Paste meeting notes or an email thread here. Include what was agreed, why, who is responsible and any dates."
                      aria-describedby="vc-source-help"
                    />
                  </div>

                  <p id="vc-source-help" className="vc-note">
                    Your source text is saved privately. Only
                    confirmed records become part of your role record
                    or My day.
                  </p>

                  <div className="form-actions">
                    <Button type="submit">
                      {busy ? 'Saving…' : 'Save source & review'}
                    </Button>

                    <Link to="/app/role-record">
                      Add a role record directly
                    </Link>
                  </div>
                </fieldset>
              </form>
            </>
          ) : !current ? (
            <p role="status">Loading capture…</p>
          ) : current.error ? (
            <>
              <p role="alert">This capture could not be loaded.</p>
              <Button variant="secondary" onClick={reload}>
                Retry capture
              </Button>
            </>
          ) : !detail ? (
            <p>This capture is unavailable for your account.</p>
          ) : (
            <>
              <div className="vc-section-heading">
                <div>
                  <span className="vw-eyebrow">
                    {detail.source.source_type} ·{' '}
                    {detail.source.source_date}
                  </span>
                  <h2>{detail.source.title}</h2>
                </div>

                <Button
                  variant="secondary"
                  disabled={busy || Boolean(editor)}
                  onClick={() => {
                    void archiveSource()
                  }}
                >
                  {detail.source.deleted_at
                    ? 'Restore capture'
                    : 'Archive capture'}
                </Button>
              </div>

              <details className="vc-source">
                <summary>Read original source</summary>
                <p>{detail.source.source_text}</p>
              </details>

              <div className="vc-section-heading">
                <h2>Review drafts</h2>

                {!detail.source.deleted_at && !editor && (
                  <Button
                    disabled={busy}
                    onClick={() => setEditor({})}
                  >
                    Add draft manually
                  </Button>
                )}
              </div>

              {detail.source.deleted_at && (
                <p className="vc-note">
                  Restore this capture to add or review drafts.
                  Confirmed records remain in your workspace.
                </p>
              )}

              {editor && (
                <DraftForm
                  key={editor.draft?.id ?? 'new'}
                  draft={editor.draft}
                  busy={busy}
                  setBusy={setBusy}
                  save={async (id, data) => {
                    await change(
                      editor.draft ? 'edit' : 'add',
                      id,
                      data,
                    )
                    setEditor(null)
                    setMessage(
                      'Draft saved for review. It is not a confirmed record yet.',
                    )
                    reload()
                  }}
                  cancel={() => setEditor(null)}
                />
              )}

              {detail.items.length === 0 ? (
                <div className="vc-empty">
                  <span className="vw-empty-icon">
                    <WorkspaceIcon name="record" />
                  </span>

                  <h3>No drafts yet</h3>

                  <p>
                    Read your source, then add a decision, task or
                    external contact to review.
                  </p>
                </div>
              ) : (
                <ul className="vc-drafts">
                  {detail.items.map(draft => (
                    <li key={draft.id}>
                      <div className="vc-draft-meta">
                        <span>{labels[draft.kind]}</span>
                        <span>{draft.status}</span>
                      </div>

                      <h3>{draft.payload.title}</h3>

                      <p className="vc-text">
                        {draft.kind === 'decision'
                          ? draft.payload.reason
                          : draft.payload.details}
                      </p>

                      {draft.kind === 'decision' && (
                        <p>
                          Decided by{' '}
                          {draft.payload.decided_by || 'Not specified'}
                          {' · '}
                          {draft.payload.decided_on || 'Date needed'}
                        </p>
                      )}

                      {draft.kind === 'action' && (
                        <p>
                          Due: {draft.payload.due_date || 'Date needed'}
                          {' · '}Assigned to you
                        </p>
                      )}

                      {draft.kind === 'contact' && (
                        <p>
                          {draft.payload.contact_email}
                          {draft.payload.contact_email &&
                          draft.payload.contact_phone
                            ? ' · '
                            : ''}
                          {draft.payload.contact_phone}
                        </p>
                      )}

                      {draft.status === 'pending' &&
                        !detail.source.deleted_at && (
                          <div className="form-actions">
                            <Button
                              disabled={busy || Boolean(editor)}
                              onClick={() => {
                                void review(draft, 'confirm')
                              }}
                            >
                              Confirm{' '}
                              {labels[draft.kind].toLowerCase()}
                            </Button>

                            <Button
                              variant="secondary"
                              disabled={busy || Boolean(editor)}
                              onClick={() => setEditor({ draft })}
                              aria-label={`Edit ${draft.payload.title}`}
                            >
                              Edit
                            </Button>

                            <Button
                              variant="secondary"
                              disabled={busy || Boolean(editor)}
                              onClick={() => {
                                void review(draft, 'discard')
                              }}
                              aria-label={`Discard ${draft.payload.title}`}
                            >
                              Discard
                            </Button>
                          </div>
                        )}

                      {draft.status === 'confirmed' && (
                        <Link
                          to={
                            draft.kind === 'action'
                              ? '/app'
                              : '/app/role-record'
                          }
                        >
                          Open{' '}
                          {draft.kind === 'action'
                            ? 'My day'
                            : 'role record'}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <p className="vc-card-footer">
            Check dates and names before confirming any draft.
          </p>
        </section>

        <aside className="vc-guide">
          <h2>You stay in control.</h2>

          {[
            [
              'record',
              'Decisions & reasons',
              'What was agreed and why.',
            ],
            [
              'check',
              'Tasks & dates',
              'What needs doing and when.',
            ],
            [
              'people',
              'Useful contacts',
              'People mentioned in the source.',
            ],
          ].map(([icon, title, copy]) => (
            <div className="vc-guide-row" key={title}>
              <span className="vr-icon">
                <WorkspaceIcon name={icon} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </div>
          ))}

          <p className="vc-guide-note">
            Add drafts manually, then edit, confirm or discard each
            one.
          </p>

          <p className="vc-note">
            Source notes and drafts are private to you. Confirmed
            records follow your workspace’s existing access rules.
          </p>
        </aside>
      </div>

      <section className="vc-card vc-history">
        <div className="vc-section-heading">
          <h2>Your captures</h2>

          <label className="vc-archive-filter">
            <input
              type="checkbox"
              checked={archived}
              disabled={busy}
              onChange={event => {
                setArchived(event.target.checked)
                setPage(0)
              }}
            />
            Show archived captures
          </label>
        </div>

        {!listing ? (
          <p role="status">Loading captures…</p>
        ) : listing.error ? (
          <>
            <p role="alert">Captures could not be loaded.</p>
            <Button variant="secondary" onClick={reload}>
              Retry list
            </Button>
          </>
        ) : listing.data?.count === 0 ? (
          <div className="vc-empty vc-history-empty">
            <WorkspaceIcon name="record" />
            <h3>
              {archived ? 'No archived captures' : 'No captures yet'}
            </h3>
            <p>Sources you save will appear here for review.</p>
          </div>
        ) : (
          <>
            <ul className="vc-source-list">
              {listing.data?.rows.map(source => (
                <li key={source.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => open(source.id)}
                    aria-current={
                      selected === source.id ? 'true' : undefined
                    }
                  >
                    <strong>{source.title}</strong>
                    <span>
                      {source.source_type} · {source.source_date}
                      {source.deleted_at ? ' · Archived' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {((listing.data?.count ?? 0) > 10 || page > 0) && (
              <div className="pagination">
                <Button
                  variant="secondary"
                  disabled={busy || page === 0}
                  onClick={() => setPage(value => value - 1)}
                >
                  Previous captures
                </Button>

                <span>Page {page + 1}</span>

                <Button
                  variant="secondary"
                  disabled={
                    busy ||
                    (page + 1) * 10 >= (listing.data?.count ?? 0)
                  }
                  onClick={() => setPage(value => value + 1)}
                >
                  Next captures
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function DraftForm({
  draft,
  busy,
  setBusy,
  save,
  cancel,
}: {
  draft?: Draft
  busy: boolean
  setBusy: (value: boolean) => void
  save: (id: string, data: Json) => Promise<void>
  cancel: () => void
}) {
  const [kind, setKind] = useState(draft?.kind ?? 'decision')
  const [error, setError] = useState('')
  const requestId = useRef<string | null>(draft?.id ?? null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)
    const values: Record<string, string | number> = {
      kind,
      version: draft?.version ?? 1,
    }

    for (const [key, value] of form.entries()) {
      values[key] = String(value).trim()
    }

    requestId.current ??= crypto.randomUUID()

    setBusy(true)
    setError('')

    try {
      await save(requestId.current, values)
    } catch (reason) {
      setError(failure(reason))
    } finally {
      setBusy(false)
    }
  }

  const value = (name: string) => draft?.payload[name] ?? ''

  return (
    <form className="vc-draft-form" onSubmit={submit}>
      <h3>{draft ? 'Edit draft' : 'Add a draft'}</h3>

      <fieldset disabled={busy}>
        <div className="field">
          <label htmlFor="vc-kind">Record type</label>
          <select
            id="vc-kind"
            value={kind}
            onChange={event => setKind(event.target.value)}
          >
            <option value="decision">Decision</option>
            <option value="action">Task</option>
            <option value="contact">External contact</option>
          </select>
        </div>

        <Input
          autoFocus
          label={kind === 'contact' ? 'Person or company name' : 'Title'}
          name="title"
          placeholder={
            kind === 'contact'
              ? 'e.g. Ada at Acme Supplies'
              : 'e.g. Move the weekly review to Friday'
          }
          required
          maxLength={200}
          defaultValue={value('title')}
        />

        <div className="field">
          <label htmlFor="vc-draft-detail">
            {kind === 'decision' ? 'Why was it decided?' : 'Details'}
          </label>

          <textarea
            key={kind === 'decision' ? 'reason' : 'details'}
            id="vc-draft-detail"
            name={kind === 'decision' ? 'reason' : 'details'}
            rows={4}
            maxLength={5000}
            required={kind === 'decision'}
            defaultValue={value(
              kind === 'decision' ? 'reason' : 'details',
            )}
            placeholder="Add the context someone else would need."
          />
        </div>

        {kind === 'decision' && (
          <div className="form-grid">
            <Input
              label="Who decided?"
              name="decided_by"
              placeholder="e.g. The operations team"
              maxLength={200}
              required
              defaultValue={value('decided_by')}
            />

            <Input
              label="Decision date"
              name="decided_on"
              type="date"
              required
              defaultValue={value('decided_on')}
            />
          </div>
        )}

        {kind === 'action' && (
          <Input
            label="Due date"
            name="due_date"
            type="date"
            required
            defaultValue={value('due_date')}
            hint="This task will be assigned to you in My day."
          />
        )}

        {kind === 'contact' && (
          <div className="form-grid">
            <Input
              label="Contact email"
              name="contact_email"
              type="email"
              maxLength={320}
              defaultValue={value('contact_email')}
            />

            <Input
              label="Contact phone"
              name="contact_phone"
              type="tel"
              maxLength={80}
              defaultValue={value('contact_phone')}
            />
          </div>
        )}

        {error && (
          <p className="vc-error" role="alert">
            {error}
          </p>
        )}

        <p className="vc-note">
          Saving a draft does not confirm it. Do not include passwords
          or secret links.
        </p>

        <div className="form-actions">
          <Button type="submit">
            {busy ? 'Saving…' : 'Save draft'}
          </Button>

          <Button variant="secondary" onClick={cancel}>
            Cancel draft
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
