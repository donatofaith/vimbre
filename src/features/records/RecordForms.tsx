import { uploadValidated } from '../../lib/validated-upload'
import type { StructuredDraft } from '../ai/structured-output'
import { AIDraftPanel } from '../ai/AIDraftPanel'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database'
import { localDate, recordError, safeRecordUrl } from './record-utils'
import type { ItemKind } from './record-utils'
import { parseContactSignature } from './contact-signature'
import { recordExamples } from './record-examples'
export type RoleItem = Database['public']['Tables']['role_items']['Row']
export type Decision = Database['public']['Tables']['decisions']['Row'] & { workstream?: { title: string; deleted_at: string | null } | null }
type Context = { companyId: string; ownerId: string; saved: () => void; cancel: () => void }

const headings = { responsibility: 'a responsibility', workstream: 'open work', external_contact: 'an external contact', document: 'a document', recurring_deadline: 'a deadline' }
export function TextField({ label, name, value = '', required = false, maxLength = 5000, placeholder }: { label: string; name: string; value?: string; required?: boolean; maxLength?: number; placeholder?: string }) {
  const [text, setText] = useState(value), [tidying, setTidying] = useState(false)
  return <div className="field"><label htmlFor={name}>{label}</label><textarea id={name} name={name} placeholder={placeholder} value={text} onChange={event => setText(event.target.value)} required={required} maxLength={maxLength} rows={3} />
    <Button className="vai-inline" variant="secondary" disabled={!text.trim()} onClick={() => setTidying(value => !value)}>{tidying ? 'Close text review' : 'Tidy with AI'}</Button>
    {tidying && <AIDraftPanel task="tidy_text" maxApplyLength={maxLength} initialText={text} onUse={result => { if (result.length > maxLength) return; setText(result); setTidying(false) }} />}
  </div>
}

export function ItemForm({ item, kind, companyId, ownerId, saved, cancel, people, initialText, initialDraft, initialFile }: Context & { initialDraft?: StructuredDraft; initialFile?: File; initialText?: string; item?: RoleItem; kind: ItemKind; people: {id: string; full_name: string}[] }) {
  const example = recordExamples[kind]
  const formRef = useRef<HTMLFormElement>(null)
  const [signatureOpen, setSignatureOpen] = useState(false), [signature, setSignature] = useState(''), [signatureMessage, setSignatureMessage] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(initialFile ?? null)
  // Retain a completed upload on a failed database save so retries never duplicate it.
  const [uploaded, setUploaded] = useState<{file: File; path: string} | null>(null)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget), text = (name: string) => String(form.get(name) ?? '').trim()
    try {
      if(kind==='recurring_deadline'){const {data:valid,error:invalid}=await supabase.rpc('myday_valid_recurrence',{p_date:text('due_date'),p_rule:text('recurrence')});if(invalid||valid!==true)throw new Error('Use Daily, Weekly, Monthly, Quarterly, Yearly, Every weekday, Every 2 weeks or First Friday of each month.')}
      let filePath = item?.file_path ?? null
      if (kind === 'document' && file) {
        if (file.size > 10485760) throw new Error('Choose a file smaller than 10 MB.')
        if (uploaded?.file === file) filePath = uploaded.path
        else {
          const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
          if (!['pdf','txt','png','jpg','jpeg','docx','xlsx'].includes(extension)) throw new Error('Choose a PDF, text, image, Word or Excel file.')
          const path = `${ownerId}/${crypto.randomUUID()}.${extension}`
          const { error: failure } = await uploadValidated('role-documents',path,file,file.name)
          if (failure) throw new Error('Could not upload the file. Check the file type and try again.')
          filePath = path; setUploaded({file, path})
        }
      }
      if (kind === 'document' && !text('url') && !filePath) throw new Error('Add a document link or upload a file.')
      const values = {
        title: text('title'), details: text('details'),
        ...(kind === 'responsibility' ? {recurrence: text('recurrence'), backup_person_id: text('backup_person_id') || null} : {}),
        ...(kind === 'workstream' ? {work_status: text('work_status'), next_step: text('next_step')} : {}),
        ...(kind === 'external_contact' ? {organisation: text('organisation'), contact_details: text('contact_details'), contact_context: text('contact_context')} : {}),
        ...(kind === 'document' ? {url: safeRecordUrl(text('url')) ?? (text('url') || null), file_path: filePath} : {}),
        ...(kind === 'recurring_deadline' ? {due_date: text('due_date'), recurrence: text('recurrence')} : {}),
      }
      const query = item ? supabase.from('role_items').update(values).eq('id', item.id).select('id').single() : supabase.from('role_items').insert({ ...values, company_id: companyId, owner_id: ownerId, kind }).select('id').single()
      const { error: failure } = await query; if (failure) throw failure
      window.dispatchEvent(new Event('vimbre:work-changed')); saved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : recordError(reason)) } finally { setBusy(false) }
  }
  const titleLabel = kind === 'external_contact' || kind === 'workstream' ? 'Name' : kind === 'recurring_deadline' ? 'What is due' : 'Title'
  const detailLabel = kind === 'responsibility' ? 'What it involves' : kind === 'workstream' ? 'What is happening' : kind === 'external_contact' ? 'What they help with' : kind === 'document' ? 'What it is for' : 'Note'
  return <section className="record-editor" aria-label="Role item editor"><h2>{item ? `Edit ${headings[kind]}` : `Add ${headings[kind]}`}</h2>{initialDraft && <p className="notice">Draft from Vimbre AI. Check before saving.</p>}<form ref={formRef} className="auth-form record-edit-form" onSubmit={save}><div className="record-edit-fields">
    <Input autoFocus label={titleLabel} placeholder={example.title} name="title" defaultValue={item?.title ?? initialDraft?.title} required maxLength={200} />
    {kind === 'external_contact' && <><Button variant="secondary" onClick={() => setSignatureOpen(value => !value)}>Paste an email signature</Button>{signatureOpen && <div className="vr-signature"><label htmlFor="email-signature">Email signature</label><textarea id="email-signature" value={signature} onChange={event => setSignature(event.target.value)} maxLength={5000} rows={4} /><Button variant="secondary" disabled={!signature.trim()} onClick={() => {const parsed = parseContactSignature(signature); const name = formRef.current?.elements.namedItem('title'); const contact = formRef.current?.elements.namedItem('contact_details'); if (name instanceof HTMLInputElement && !name.value.trim()) name.value = parsed.name; if (contact instanceof HTMLInputElement && !contact.value.trim()) contact.value = parsed.contact; setSignatureMessage(parsed.contact ? 'Check the contact details before saving.' : 'No email or phone found. Add the contact details below.')}}>Fill contact fields</Button>{signatureMessage && <p role="status">{signatureMessage}</p>}</div>}<Input label="Organisation" name="organisation" maxLength={200} defaultValue={item?.organisation ?? initialDraft?.organisation} placeholder="e.g. Acme Supplies" /></>}
    <TextField label={detailLabel} name="details" placeholder={example.details} value={item?.details ?? initialDraft?.details ?? initialText} />
    {kind === 'responsibility' && <><div className="field"><label htmlFor="recurrence">How often</label><select id="recurrence" name="recurrence" defaultValue={item?.recurrence ?? initialDraft?.recurrence ?? 'As needed'}>{item?.recurrence && !['Daily','Weekly','Monthly','As needed'].includes(item.recurrence) && <option>{item.recurrence}</option>}{['Daily','Weekly','Monthly','As needed'].map(value => <option key={value}>{value}</option>)}</select></div><div className="field"><label htmlFor="backup">Backup person (optional)</label><select name="backup_person_id" id="backup" defaultValue={item?.backup_person_id ?? ''}><option value="">No backup person</option>{item?.backup_person_id && !people.some(p => p.id === item.backup_person_id) && <option value={item.backup_person_id}>Current backup person</option>}{people.filter(p => p.id !== ownerId).map(p => <option value={p.id} key={p.id}>{p.full_name}</option>)}</select></div></>}
    {kind === 'workstream' && <><div className="field"><label htmlFor="work-status">Status</label><select id="work-status" name="work_status" defaultValue={item?.work_status ?? initialDraft?.work_status ?? 'in_progress'}><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="on_hold">On hold</option><option value="done">Done</option></select></div><TextField label="Next step" name="next_step" value={item?.next_step ?? initialDraft?.next_step} placeholder="e.g. Share the review notes with Operations" /></>}
    {kind === 'external_contact' && <><Input label="Email or phone" name="contact_details" required maxLength={400} defaultValue={item?.contact_details || initialDraft?.contact_details || [item?.contact_email, item?.contact_phone].filter(Boolean).join(' · ')} placeholder="e.g. ada@example.com" /><TextField label="What to know before contacting them" name="contact_context" value={item?.contact_context ?? initialDraft?.contact_context} /></>}
    {kind === 'document' && <><div className="field"><label htmlFor="document-link">Link (optional)</label><input id="document-link" name="url" type="url" placeholder={example.url} maxLength={2048} defaultValue={item?.url ?? initialDraft?.url ?? ''} /><label htmlFor="document-file">Or upload a file</label><input id="document-file" type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.docx,.xlsx" onChange={event => { setFile(event.target.files?.[0] ?? null); setUploaded(null) }} /><p className="field-hint">PDF, text, images, Word or Excel. Up to 10 MB.{item?.file_path && !file ? ' A file is already attached.' : ''}{file ? ` Selected file: ${file.name}.` : ''}</p></div></>}
    {kind === 'recurring_deadline' && <><Input label="How often" name="recurrence" placeholder="e.g. First Friday of each month" maxLength={200} defaultValue={item?.recurrence ?? initialDraft?.recurrence ?? ''} required /><Input label="Next due date" name="due_date" type="date" defaultValue={item?.due_date ?? initialDraft?.due_date ?? ''} required /></>}
    </div>{error && <p role="alert" className="field-error">{error}</p>}<div className="form-actions record-edit-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button><Button variant="secondary" disabled={busy} onClick={cancel}>Cancel</Button></div>
  </form></section>
}
export function DecisionForm({ decision, companyId, ownerId, ownerName, saved, cancel, initialText, initialDraft }: Context & { initialDraft?: StructuredDraft; initialText?: string; decision?: Decision; ownerName: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget), text = (name: string) => String(form.get(name) ?? '').trim()
    const values = { title: text('title'), reason: text('reason'), decided_by: text('decided_by'), decided_on: text('decided_on'), next_step: text('next_step'), source_url: safeRecordUrl(text('source_url')) ?? (text('source_url') || null) }
    try {
      const query = decision ? supabase.from('decisions').update(values).eq('id', decision.id).select('id').single() : supabase.from('decisions').insert({ ...values, company_id: companyId, owner_id: ownerId, status: 'live' }).select('id').single()
      const { error: failure } = await query; if (failure) throw failure; window.dispatchEvent(new Event('vimbre:work-changed')); saved()
    } catch (reason) { setError(recordError(reason)) } finally { setBusy(false) }
  }
  return <section className="record-editor" aria-label="Decision editor"><h2>{decision ? 'Edit decision' : 'Log a decision'}</h2>{initialDraft && <p className="notice">Draft from Vimbre AI. Check before saving.</p>}<form className="auth-form record-edit-form" onSubmit={save}><div className="record-edit-fields">
    <Input autoFocus label="Decision" name="title" required maxLength={300} defaultValue={decision?.title ?? initialDraft?.title} placeholder="e.g. Move supplier reviews to monthly" />
    <TextField label="Why" name="reason" placeholder="e.g. Reduce meeting time and focus on key updates" required value={decision?.reason ?? initialDraft?.reason ?? initialText} />
    <Input label="Date" name="decided_on" type="date" required defaultValue={decision?.decided_on ?? (initialDraft?.decided_on || localDate())} />
    <Input label="Owner" name="decided_by" required maxLength={200} defaultValue={decision?.decided_by ?? (initialDraft?.decided_by || ownerName)} />
    <TextField label="Next step" name="next_step" value={decision?.next_step ?? initialDraft?.next_step} />
    <Input label="Link to email or notes (optional)" name="source_url" type="url" maxLength={2048} defaultValue={decision?.source_url ?? initialDraft?.source_url ?? ''} />
    </div>{error && <p role="alert" className="field-error">{error}</p>}<div className="form-actions record-edit-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button><Button variant="secondary" disabled={busy} onClick={cancel}>Cancel</Button></div>
  </form></section>
}
