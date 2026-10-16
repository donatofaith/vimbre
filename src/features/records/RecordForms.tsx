import { useState } from 'react'
import type { FormEvent } from 'react'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database'
import { itemKinds, localDate, recordError, safeRecordUrl } from './record-utils'
import type { ItemKind } from './record-utils'
export type RoleItem = Database['public']['Tables']['role_items']['Row']
export type Decision = Database['public']['Tables']['decisions']['Row'] & { workstream?: { title: string; deleted_at: string | null } | null }
type Context = { companyId: string; ownerId: string; saved: () => void; cancel: () => void }
function TextField({ label, name, value = '', required = false, maxLength = 5000 }: { label: string; name: string; value?: string; required?: boolean; maxLength?: number }) { return <div className="field"><label htmlFor={name}>{label}</label><textarea id={name} name={name} defaultValue={value} required={required} maxLength={maxLength} rows={4} /></div> }
export function ItemForm({ item, kind, companyId, ownerId, saved, cancel }: Context & { item?: RoleItem; kind: ItemKind }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget), text = (name: string) => String(form.get(name) ?? '').trim()
    const values = { title: text('title'), details: text('details'), url: safeRecordUrl(text('url')) ?? (text('url') || null), contact_email: text('contact_email') || null, contact_phone: text('contact_phone') || null, due_date: text('due_date') || null, recurrence: text('recurrence') || null }
    try {
      const query = item ? supabase.from('role_items').update(values).eq('id', item.id).select('id').single() : supabase.from('role_items').insert({ ...values, company_id: companyId, owner_id: ownerId, kind }).select('id').single()
      const { error: failure } = await query; if (failure) throw failure; saved()
    } catch (reason) { console.error('Role record save failed', reason); setError(recordError(reason)) } finally { setBusy(false) }
  }
  return <section className="card record-editor" aria-label="Role item editor"><h2>{item ? 'Edit record' : `Add to ${itemKinds.find(row => row[0] === kind)?.[1].toLowerCase()}`}</h2><form className="auth-form" onSubmit={save}><Input autoFocus label={kind === 'external_contact' ? 'Person or company name' : 'Title'} name="title" defaultValue={item?.title} required maxLength={200} /><TextField label="Details" name="details" value={item?.details} />{kind === 'external_contact' && <div className="form-grid"><Input label="Contact email" name="contact_email" type="email" maxLength={320} defaultValue={item?.contact_email ?? ''} /><Input label="Contact phone" name="contact_phone" type="tel" maxLength={80} defaultValue={item?.contact_phone ?? ''} /></div>}<Input label={kind === 'document' ? 'Document link' : 'Supporting web link (optional)'} name="url" type="url" placeholder="https://" required={kind === 'document'} maxLength={2048} defaultValue={item?.url ?? ''} />{kind === 'document' && <p className="muted">Link an existing document. Uploads will come with Capture. People need permission in the service holding the document.</p>}{kind === 'recurring_deadline' && <div className="form-grid"><Input label="Next deadline" name="due_date" type="date" defaultValue={item?.due_date ?? ''} required /><Input label="Recurrence" name="recurrence" placeholder="Every Friday, before 4 pm" maxLength={200} defaultValue={item?.recurrence ?? ''} required /></div>}{kind === 'recurring_deadline' && <p className="muted">Recurrence is a note for your team. Automatic reminders are coming soon.</p>}<p className="muted">Do not include passwords, access tokens or secret links.</p>{error && <p role="alert">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</Button><Button variant="secondary" disabled={busy} onClick={cancel}>Cancel edit</Button></div></form></section>
}
export function DecisionForm({ decision, workstreams, companyId, ownerId, saved, cancel }: Context & { decision?: Decision; workstreams: RoleItem[] }) {
  const [selectedStream, setSelectedStream] = useState(decision?.workstream_id ?? '')
  const [streamLabel, setStreamLabel] = useState(decision?.workstream?.title ?? 'Current workstream')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget), text = (name: string) => String(form.get(name) ?? '').trim()
    const values = { title: text('title'), reason: text('reason'), decided_by: text('decided_by'), decided_on: text('decided_on'), status: text('status'), workstream_id: text('workstream_id') || null, source_url: safeRecordUrl(text('source_url')) ?? (text('source_url') || null), related_task_url: safeRecordUrl(text('related_task_url')) ?? (text('related_task_url') || null) }
    try {
      const query = decision ? supabase.from('decisions').update(values).eq('id', decision.id).select('id').single() : supabase.from('decisions').insert({ ...values, company_id: companyId, owner_id: ownerId }).select('id').single()
      const { error: failure } = await query; if (failure) throw failure; saved()
    } catch (reason) { console.error('Decision save failed', reason); setError(recordError(reason)) } finally { setBusy(false) }
  }
  return <section className="card record-editor" aria-label="Decision editor"><h2>{decision ? 'Edit decision' : 'Add a decision'}</h2><form className="auth-form" onSubmit={save}><Input autoFocus label="What was decided?" name="title" required maxLength={300} defaultValue={decision?.title} /><TextField label="Why was it decided?" name="reason" required value={decision?.reason} /><div className="form-grid"><Input label="Who decided?" name="decided_by" required maxLength={200} defaultValue={decision?.decided_by} /><Input label="Decision date" name="decided_on" type="date" required defaultValue={decision?.decided_on ?? localDate()} /></div><div className="form-grid"><div className="field"><label htmlFor="decision-status">Status</label><select id="decision-status" name="status" defaultValue={decision?.status ?? 'live'}><option value="live">Live</option><option value="replaced">Replaced</option><option value="reversed">Reversed</option></select></div><div className="field"><label htmlFor="decision-workstream">Workstream</label><select id="decision-workstream" name="workstream_id" value={selectedStream} onChange={event => { setSelectedStream(event.target.value); setStreamLabel(event.target.selectedOptions[0]?.textContent ?? 'Selected workstream') }}><option value="">Whole role</option>{selectedStream && !workstreams.some(row => row.id === selectedStream) && <option value={selectedStream}>{streamLabel}</option>}{workstreams.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}</select></div></div><Input label="Source web link (optional)" name="source_url" type="url" maxLength={2048} defaultValue={decision?.source_url ?? ''} /><Input label="Related task web link (optional)" name="related_task_url" type="url" maxLength={2048} defaultValue={decision?.related_task_url ?? ''} /><p className="muted">Use a link to work in your existing tools. Vimbre actions are coming soon. Do not include passwords or secret links.</p>{error && <p role="alert">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save decision'}</Button><Button variant="secondary" disabled={busy} onClick={cancel}>Cancel edit</Button></div></form></section>
}
