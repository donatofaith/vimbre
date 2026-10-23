import { MyNotes } from '../my-day/MyNotes'
import { StructuredAI } from '../ai/StructuredAI'
import type { StructuredDraft } from '../ai/structured-output'
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
import { recordError, safeRecordUrl } from './record-utils'
import type { ItemKind } from './record-utils'
import { recordExamples } from './record-examples'
import { RoleDrawer } from './RoleDrawer'
import { ResponsibilityReview, ResponsibilityPersonal } from './ResponsibilityReview'
import { formatRecordDate } from './record-utils'
import { RoleOwnerPicker } from './RoleOwnerPicker'
import type { RoleOwner as Owner } from './RoleOwnerPicker'
import './role-record.css'

type Tab = Exclude<ItemKind, 'responsibility' | 'workstream'> | 'handled' | 'decision'
const tabs = [['decision', 'Decisions'], ['handled', 'What I handle'], ['external_contact', 'External contacts'], ['document', 'Documents'], ['recurring_deadline', 'Deadlines']] as const
const addTitles = { decision: 'Add decision', handled: 'Add to what I handle', external_contact: 'Add contact', document: 'Add document', recurring_deadline: 'Add deadline' }

const guides: Record<ItemKind | 'decision', { examples: string[]; empty: string }> = {
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
      'Quarterly supplier review',
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
  const [chosenOwner, setChosenOwner] = useState<Owner | null>(null)
  const [ownerName, setOwnerName] = useState(profile!.full_name)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [owners, setOwners] = useState<Owner[]>([])
  const [ownerError, setOwnerError] = useState(false)

  const [sectionParams, setSectionParams] = useSearchParams()
  const requestedRecord = sectionParams.get('record') ?? ''
  const recordId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedRecord) ? requestedRecord : ''
  const requestedSection = sectionParams.get('section')
  const tab: Tab = requestedSection === 'responsibility' || requestedSection === 'workstream' ? 'handled' : tabs.some(([value]) => value === requestedSection) ? requestedSection as Tab : 'decision'
  const [typeFilter, setTypeFilter] = useState<'all' | 'responsibility' | 'workstream'>(requestedSection === 'responsibility' || requestedSection === 'workstream' ? requestedSection : 'all')
  const [formKind, setFormKind] = useState<'responsibility' | 'workstream'>(profile?.role === 'employee' ? 'workstream' : 'responsibility')
  const [progress, setProgress] = useState<{owner: string; filled: number; error: boolean} | null>(null)
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
    total: number
  } | null>(null)

  const [aiRows, setAiRows] = useState<StructuredDraft[] | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [personal, setPersonal] = useState<{item: RoleItem; mode: 'notes' | 'suggest'} | null>(null)

  const [editor, setEditor] = useState<{
    item?: RoleItem
    decision?: Decision
    initialText?: string
    initialDraft?: StructuredDraft
    initialFile?: File
    kind?: ItemKind
  } | null>(null)

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const own = ownerId === profile!.id
  const selectedOwner = own ? profile : chosenOwner ?? owners.find(row => row.id === ownerId)
  const manager = profile?.role === 'hr_admin' || profile?.role === 'manager'
  const canManage = profile?.role === 'hr_admin' || profile?.role === 'manager' && Boolean(profile.department_id) && profile.department_id === selectedOwner?.department_id
  const canEdit = own || canManage
  const editorKind: ItemKind = editor?.item?.kind as ItemKind ?? editor?.kind ?? (tab === 'handled' ? formKind : tab === 'decision' ? 'workstream' : tab)
  const canEditForm = canEdit && (editorKind !== 'responsibility' || canManage)
  const aiKind = tab === 'handled' ? formKind : tab
  const canUseAI = canEdit && (aiKind !== 'responsibility' || canManage)

  const key =
    `${ownerId}:${tab}:${archived}:${page}:` +
    `${revision}:${query}:${decisionStatus}:${recordId}:${typeFilter}`

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
        .select('id,full_name,department_id,role_description,role_start_date')
        .eq('active', true)
        .eq('company_id', company!.id)
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
  }, [profile?.role, ownerSearch, company?.id])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const totals = (tab === 'decision'
        ? supabase.from('decisions').select('id', {count: 'exact', head: true}).eq('owner_id', ownerId)
        : tab === 'handled'
          ? supabase.from('role_items').select('id', {count: 'exact', head: true}).eq('owner_id', ownerId).in('kind', ['responsibility', 'workstream'])
          : supabase.from('role_items').select('id', {count: 'exact', head: true}).eq('owner_id', ownerId).eq('kind', tab)).then(value => value)
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
          const total = await totals
          if (cancelled) return
          setResult({
            key,
            total: total.count ?? count ?? 0,
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

          .ilike('title', `%${query}%`)

        request = tab === 'handled' ? (typeFilter === 'all' ? request.in('kind', ['responsibility', 'workstream']) : request.eq('kind', typeFilter)) : request.eq('kind', tab)
        if (recordId) request = request.eq('id', recordId)

        request = archived
          ? request.not('deleted_at', 'is', null)
          : request.is('deleted_at', null)

        const { data, count, error: failure } = await request
          .order('created_at', { ascending: false })
          .order('id')
          .range(page * 20, page * 20 + 19)

        if (!cancelled) {
          const total = await totals
          if (cancelled) return
          setResult({
            key,
            total: total.count ?? count ?? 0,
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
  }, [key, ownerId, tab, archived, page, query, decisionStatus, recordId, typeFilter])


  useEffect(() => {
    let alive = true
    async function loadProgress() {
      const checks = await Promise.all(tabs.map(([value]) => {
        if (value === 'decision') return supabase.from('decisions').select('id', {count: 'exact', head: true}).eq('owner_id', ownerId).is('deleted_at', null)
        const request = supabase.from('role_items').select('id', {count: 'exact', head: true}).eq('owner_id', ownerId).is('deleted_at', null)
        return value === 'handled' ? request.in('kind', ['responsibility', 'workstream']) : request.eq('kind', value)
      }))
      if (alive) setProgress({owner: ownerId, filled: checks.filter(result => (result.count ?? 0) > 0).length, error: checks.some(result => Boolean(result.error))})
    }
    void loadProgress()
    return () => { alive = false }
  }, [ownerId, revision])

  useEffect(() => {
    void supabase
      .rpc('log_role_view', { p_owner: ownerId })
      .then(({ error }) => {
        if (error) console.error('Role view audit failed', error)
      })
  }, [ownerId])

  const reload = () => { setRevision(value => value + 1); window.dispatchEvent(new Event('vimbre:work-changed')) }

  const saved = () => {
    if (editor?.initialDraft && aiRows?.length) setAiOpen(true)
    setEditor(null)
    setMessage(
      tab === 'decision' ? 'Decision saved.' : 'Role record saved.',
    )
    reload()
  }

  function changeView() {
    setAiOpen(false)
    setAiRows(null)
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

  const label = tabs.find(([value]) => value === tab)![1]
  const guidance = tab === 'handled' ? 'Responsibilities and projects you handle.' : tab === 'decision' ? 'What was decided, why, and what happens next.' : recordExamples[tab].guidance
  const addLabel = addTitles[tab]

  function openEditor() {
    setFormKind(profile?.role === 'employee' ? 'workstream' : 'responsibility')
    setEditor({})
    setError('')
    setMessage('')
  }

  function selectTab(value: Tab) {
    setTab(value)
    setTypeFilter('all')
    setArchived(false)
    setSearch('')
    setQuery('')
    setDecisionStatus('all')
    changeView()
  }

  return (
    <div className="vr-page">
      <header className="vw-page-heading vr-page-heading">
        <div><span className="vw-eyebrow">{company?.name ?? 'Your workspace'}</span><h1 tabIndex={-1}>My role</h1><p>What someone covering you would need to know.</p></div>
        <div className="vr-header-tools">{progress?.owner === ownerId && !progress.error && <p className="vr-progress">Ready for handover: {progress.filled} of 5 areas filled</p>}
          {profile?.role !== 'employee' && <RoleOwnerPicker name={ownerName} rows={owners} query={ownerSearch} search={setOwnerSearch} error={ownerError} disabled={busy} choose={row => {setChosenOwner(row); setOwnerId(row.id); setOwnerName(row.full_name); setArchived(false); setSearch(''); setQuery(''); setTypeFilter('all'); setDecisionStatus('all'); changeView()}} />}
        </div>
      </header>
      <p className="vr-purpose"><WorkspaceIcon name="handover" />So someone can pick up your work without asking you.</p>

      {selectedOwner?.role_start_date && <p className="vr-role-since">In this role since <time dateTime={selectedOwner.role_start_date}>{formatRecordDate(selectedOwner.role_start_date)}</time></p>}
      {selectedOwner?.role_description && <p className="vr-role-description">{selectedOwner.role_description}</p>}
      {own && <MyNotes key={ownerId}/>}
      <ResponsibilityReview manager={manager} revision={revision} changed={reload} />
      {personal && <ResponsibilityPersonal key={`${personal.item.id}:${personal.mode}`} {...personal} close={() => setPersonal(null)} saved={() => {setPersonal(null); setMessage(personal.mode === 'notes' ? 'Notes saved.' : 'Suggestion sent for review.'); reload()}} />}

      {recordId && <Link to={`/app/role-record?section=${tab}`}>All records</Link>}
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
          {tabs.map(([value, title]) => (
            <button type="button" key={value} aria-label={title} aria-pressed={tab === value} disabled={busy} onClick={() => selectTab(value)}>{title}</button>
          ))}
        </nav>

        <div className="vr-section-heading">
          <div><h2>{label}</h2><p>{guidance}</p></div>
          {canEdit && !archived && <div className="vr-section-actions"><Button disabled={busy} onClick={openEditor}>{addLabel}</Button><Link className="button button-secondary" to="/app/capture">Add from an email or notes</Link><Button variant="secondary" disabled={busy} onClick={() => {setFormKind(profile?.role === 'employee' ? 'workstream' : 'responsibility'); setAiOpen(true)}}>Use Vimbre AI</Button></div>}
        </div>
        {aiOpen && canEdit && <RoleDrawer title="Use Vimbre AI" close={() => setAiOpen(false)}>
          {tab === 'handled' && <HandleType value={formKind} change={value => {setFormKind(value); setAiRows(null)}} responsibilities={canManage} />}
          {canUseAI && <StructuredAI key={`${ownerId}:${aiKind}`} kind={aiKind} cached={aiRows} onDrafts={setAiRows} choose={(initialDraft, initialFile, index) => { setAiRows(rows => rows?.filter((_, i) => i !== index) ?? null); setAiOpen(false); setEditor({ initialDraft, initialFile, kind: aiKind === 'decision' ? undefined : aiKind }) }} />}
        </RoleDrawer>}
        {editor && canEditForm && <RoleDrawer title={editor.item || editor.decision ? 'Edit record' : addLabel} close={() => setEditor(null)}>
          {tab === 'handled' && !editor.item && !editor.initialDraft && <HandleType value={formKind} change={setFormKind} responsibilities={canManage} />}
          {tab === 'decision' ? <DecisionForm key={editor.decision?.id ?? 'new-decision'} decision={editor.decision} initialText={editor.initialText} initialDraft={editor.initialDraft} companyId={company!.id} ownerId={ownerId} ownerName={ownerName} saved={saved} cancel={() => setEditor(null)} /> : <ItemForm key={editor.item?.id ?? editorKind} kind={editorKind} item={editor.item} initialText={editor.initialText} initialDraft={editor.initialDraft} companyId={company!.id} ownerId={ownerId} people={owners} initialFile={editor.initialFile} saved={saved} cancel={() => setEditor(null)} />}
        </RoleDrawer>}

        {tab === 'handled' && <div className="vr-kind-filter" role="group" aria-label="Work types">{([['all', 'All'], ['responsibility', 'Responsibilities'], ['workstream', 'Projects']] as const).map(([value, title]) => <button type="button" key={value} aria-pressed={typeFilter === value} onClick={() => {setTypeFilter(value); setPage(0)}}>{title}</button>)}</div>}
        {(Boolean(current?.total) || Boolean(query) || archived || decisionStatus !== 'all' || page > 0) && <div className="vr-filters">
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
        </div>}

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
                      : own && tab === 'handled' && typeFilter === 'responsibility' && !canManage
                        ? 'Your manager will add your responsibilities.'
                        : own
                        ? guides[tab === 'handled' ? 'workstream' : tab].empty
                        : 'This team member has not added records in this section.'}
                </p>
                {own && !query && !archived && <Link to="/app/capture">Or capture an email and we will fill this in.</Link>}
              </div>
            ) : (
              <>
                <ul className="vr-list">
                  {current.items.map(item => (
                    <li key={item.id}>
                      <article>
                        {tab === 'handled' && <span className="vr-kind-badge">{item.kind === 'responsibility' ? 'Responsibility' : 'Project'}</span>}
                        <h3>{item.title}</h3>

                        {item.details && (
                          <p className="record-text">
                            {item.details}
                          </p>
                        )}

                        {item.organisation && <p>Organisation: {item.organisation}</p>}
                        {item.contact_details && <p>{item.contact_details}</p>}
                        {item.contact_context && <p className="record-text">{item.contact_context}</p>}
                        {item.kind === 'workstream' && <p>Status: {{in_progress:'In progress',waiting:'Waiting',on_hold:'On hold',done:'Done'}[item.work_status]}</p>}
                        {item.next_step && <p>Next step: {item.next_step}</p>}
                        {item.backup_person_id && <p>Backup person: {owners.find(row => row.id === item.backup_person_id)?.full_name ?? 'Assigned'}</p>}
                        {item.file_path && <DocumentFile path={item.file_path} />}
                        {item.contact_email && !item.contact_details && (
                          <p>Email: {item.contact_email}</p>
                        )}

                        {item.contact_phone && !item.contact_details && (
                          <p>Phone: {item.contact_phone}</p>
                        )}

                        {item.due_date && (
                          <p>
                            {item.kind === 'responsibility' ? 'Deadline: ' : 'Next deadline: '}
                            <time dateTime={item.due_date}>
                              {formatRecordDate(item.due_date)}
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

                      {canEdit && (item.kind !== 'responsibility' || canManage) && (
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
                      {own && item.kind === 'responsibility' && !archived && <div className="form-actions"><Button variant="secondary" onClick={() => setPersonal({item,mode:'notes'})}>My notes</Button>{!canManage && <Button variant="secondary" onClick={() => setPersonal({item,mode:'suggest'})}>Suggest a change</Button>}</div>}
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

                        {decision.next_step && <p>Next step: {decision.next_step}</p>}
                        <p>
                          Decided by {decision.decided_by} on{' '}
                          <time dateTime={decision.decided_on}>
                            {formatRecordDate(decision.decided_on)}
                          </time>
                        </p>

                        <p>
                          {decision.workstream_id
                            ? `Project: ${
                                decision.workstream?.title ??
                                'Linked open work'
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

                      {canEdit && (
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


        </div>


      </section>

      <dialog
        ref={accessDialog}
        className="vw-dialog"
        aria-labelledby="vr-access-title"
      >
        <h2 id="vr-access-title">What my manager can see</h2>

        <p>
          Managers in your department can read your responsibilities,
          open work, external contacts, document links, recurring
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


function DocumentFile({path}: {path: string}) {
  const [url,setUrl]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{if(!url)return;const timer=setTimeout(()=>setUrl(''),55000);return()=>clearTimeout(timer)},[url])
  return <div className="form-actions">{url ? <a href={url} target="_blank" rel="noopener noreferrer">Open uploaded document</a> : <Button variant="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');const {data,error}=await supabase.storage.from('role-documents').createSignedUrl(path,60);setBusy(false);if(error)setError('Could not open the document. Please retry.');else setUrl(data.signedUrl)}}>{busy?'Preparing document…':'View uploaded document'}</Button>}{error && <p role="alert">{error}</p>}</div>
}

function HandleType({value, change, responsibilities}: {value: 'responsibility' | 'workstream'; change: (value: 'responsibility' | 'workstream') => void; responsibilities: boolean}) {
  return <div className="field vr-handle-type"><label htmlFor="handle-type">Is this a responsibility or a project?</label><select id="handle-type" value={value} onChange={event => change(event.target.value as 'responsibility' | 'workstream')}>{responsibilities && <option value="responsibility">Responsibility</option>}<option value="workstream">Project</option></select></div>
}
