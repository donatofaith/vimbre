import {trackTaskCreated,trackTaskCompleted} from '../../lib/analytics'
import type { StructuredDraft } from '../ai/structured-output'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database'
import { safeSearch } from '../team/team-utils'
import { safeRecordUrl } from '../records/record-utils'
import { actionError } from './action-utils'
export type Action = Database['public']['Tables']['actions']['Row'] & { decision?: { title: string; deleted_at: string | null } | null }
export function ActionForm({ action, ownerId, companyId, initialDecision, saved, cancel, initialDraft }: { initialDraft?: StructuredDraft; action?: Action; ownerId: string; companyId: string; initialDecision: string; saved: () => void; cancel: () => void }) {
  const [status, setStatus] = useState(action?.status ?? 'open')
  const [selected, setSelected] = useState(action?.decision_id ?? initialDecision)
  const [label, setLabel] = useState(action?.decision?.title ?? 'Linked decision')
  const [search, setSearch] = useState(''), [options, setOptions] = useState<{ id: string; title: string }[]>([]), [choiceError, setChoiceError] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data, error: failure } = await supabase.from('decisions').select('id,title').eq('owner_id', ownerId).is('deleted_at', null).ilike('title', `%${safeSearch(search)}%`).order('decided_on', { ascending: false }).order('id').limit(20)
      if (!cancelled) { setOptions(data ?? []); setChoiceError(Boolean(failure)) }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [ownerId, search])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget), text = (key: string) => String(form.get(key) ?? '').trim()
    const values = { title: text('title'), details: text('details'), due_date: text('due_date'), status, decision_id: selected || null, source_url: safeRecordUrl(text('source_url')) ?? (text('source_url') || null), completion_note: text('completion_note') }
    try {
      const { data: receipt, error: failure } = await (action ? supabase.from('actions').update(values).eq('id', action.id).select('id').single() : supabase.from('actions').insert({ ...values, owner_id: ownerId, company_id: companyId }).select('id').single())
      if (failure) throw failure;if(!action)trackTaskCreated(receipt?.id,initialDraft?'ai':'manual');if(status==='done'&&action?.status!=='done')trackTaskCompleted(receipt?.id,'manual'); saved()
    } catch (reason) { console.error('Action save failed', reason); setError(actionError(reason)) } finally { setBusy(false) }
  }
  return <section className="card record-editor" aria-label="Task editor"><h2>{action ? 'Edit task' : 'Add a task'}</h2>{initialDraft && <p className="notice">Draft from Vimbre AI. Check before saving.</p>}<form className="auth-form" onSubmit={save}>
    <Input autoFocus label="What needs to be done?" name="title" placeholder="e.g. Send the weekly operations report" required maxLength={300} defaultValue={action?.title ?? initialDraft?.title} />
    <div className="field"><label htmlFor="action-details">Details</label><textarea id="action-details" name="details" placeholder="e.g. Check the figures with Finance, then send the report before the team meeting." defaultValue={action?.details ?? initialDraft?.details} rows={4} maxLength={5000} /></div>
    <div className="form-grid"><Input label="Due date" name="due_date" type="date" required defaultValue={action?.due_date ?? initialDraft?.due_date} /><div className="field"><label htmlFor="action-status">Task status</label><select id="action-status" value={status} onChange={event => setStatus(event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div></div>
    <Input label="Find a related decision" type="search" placeholder="e.g. Weekly reporting" value={search} onChange={event => setSearch(event.target.value)} /><div className="field"><label htmlFor="action-decision">Related decision (optional)</label><select id="action-decision" aria-describedby="action-decision-hint" value={selected} onChange={event => { setSelected(event.target.value); setLabel(event.target.selectedOptions[0]?.textContent ?? 'Linked decision') }}><option value="">No related decision</option>{selected && !options.some(row => row.id === selected) && <option value={selected}>{label}</option>}{options.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}</select><p id="action-decision-hint" className="field-hint">Search for a decision to link.</p>{choiceError && <p role="alert">Decision choices could not be loaded. Try searching again.</p>}</div>
    <Input label="Source web link (optional)" name="source_url" type="url" maxLength={2048} defaultValue={action?.source_url ?? ''} />
    <div className="field"><label htmlFor="completion-note">Anything the next person should know?</label><textarea id="completion-note" name="completion_note" placeholder="e.g. Report sent to Finance. They will confirm the figures on Monday." defaultValue={action?.completion_note} rows={3} maxLength={5000} aria-describedby="completion-note-hint" /><p className="field-hint" id="completion-note-hint">Optional. Do not include passwords or secrets.</p></div>
    {error && <p role="alert">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save task'}</Button><Button variant="secondary" disabled={busy} onClick={cancel}>Cancel edit</Button></div>
  </form></section>
}
export function CompleteAction({ action, saved, cancel }: { action: Action; saved: () => void; cancel: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const note = String(new FormData(event.currentTarget).get('note') ?? '').trim()
    try {
      const { error: failure } = await supabase.from('actions').update({ status: 'done', completion_note: note }).eq('id', action.id).select('id').single()
      if (failure) throw failure;if(action.status!=='done')trackTaskCompleted(action.id,'manual'); saved()
    } catch (reason) { console.error('Complete task failed', reason); setError(actionError(reason)) } finally { setBusy(false) }
  }
  return <section className="card record-editor" aria-label="Complete task"><h2>Finish: {action.title}</h2><form className="auth-form" onSubmit={complete}><div className="field"><label htmlFor="finish-note">Anything the next person should know?</label><textarea autoFocus id="finish-note" name="note" rows={3} maxLength={5000} defaultValue={action.completion_note} placeholder="e.g. Sent the report. Finance will reply on Monday." aria-describedby="finish-note-hint" /><p className="field-hint" id="finish-note-hint">Optional.</p></div>{error && <p role="alert">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Mark done'}</Button><Button variant="secondary" disabled={busy} onClick={cancel}>Cancel completion</Button></div></form></section>
}


