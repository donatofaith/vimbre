import { useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { runAI } from '../../lib/ai-gateway'
import type { AITask } from '../../lib/ai-gateway'
import { validateAIInput } from './ai-output'
import './ai.css'

type Props = { showHeading?: boolean; task: Exclude<AITask, 'capture_extract'>; initialText?: string; onUse?: (text: string) => void; loadRecords?: () => Promise<string>; maxApplyLength?: number }
/** Source and draft stay in this mounted panel. Only the user's explicit action applies a revision. */
export function AIDraftPanel({ task, initialText = '', onUse, loadRecords, maxApplyLength, showHeading = true }: Props) {
  const sourceId = useId(), draftId = useId()
  const [source, setSource] = useState(initialText)
  const [output, setOutput] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [fromAI, setFromAI] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [limited, setLimited] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  const reference = useRef<{ text: string; id: string } | null>(null)
  const heading = task === 'task_context' ? 'Draft outcome' : task === 'weekly_summary' ? 'Weekly summary' : task === 'handover_draft' ? 'Draft handover' : 'Tidy text'
  async function generate() {
    if (pending.current) return
    const invalid = validateAIInput(source)
    if (invalid) { setError(invalid); return }
    pending.current = true; setBusy(true); setError(''); setLimited(false); setMessage('')
    if (reference.current?.text !== source) reference.current = { text: source, id: crypto.randomUUID() }
    try {
      const result = await runAI(task, source, reference.current!.id)
      if (!result.ok) { setError(result.message); setLimited(result.code === 'limit_reached'); return }
      if (!result.text.trim() || result.text.length > 60000) { setError('The draft could not be read. You can continue by hand.'); return }
      reference.current = null
      setOutput(result.text); setReviewing(true); setFromAI(true)
      setMessage('Draft ready. Review names, dates and details.')
    } finally { pending.current = false; setBusy(false) }
  }
  async function load() {
    if (!loadRecords || pending.current) return
    if (source && !window.confirm('Replace these notes with your current records?')) return
    pending.current = true; setBusy(true); setError(''); setLimited(false); setMessage('')
    try { setSource(await loadRecords()); setOutput(''); setReviewing(false); reference.current = null }
    catch { setError('Your records could not be loaded. Paste the notes you want to use.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="vai-panel" aria-label={heading}>
    {showHeading && <h2>{heading}</h2>}
    {reviewing && fromAI && <p>Draft from Vimbre AI. Check before saving.</p>}
    {loadRecords && <Button variant="secondary" disabled={busy} onClick={() => void load()}>Use my records</Button>}
    <div className="field"><label htmlFor={sourceId}>Notes to use</label><textarea id={sourceId} rows={8} value={source} disabled={busy} onChange={event => { setSource(event.target.value); setOutput(''); setReviewing(false); setMessage(''); reference.current = null }} placeholder="Add the decisions, work and dates to include." /></div>
    <Button disabled={busy || !source.trim()} onClick={() => void generate()}>{busy ? 'Preparing draft…' : task === 'tidy_text' ? 'Tidy text' : 'Generate draft'}</Button>
    {!reviewing && <Button variant="secondary" disabled={busy} onClick={() => { setOutput(source); setReviewing(true); setFromAI(false); setMessage('') }}>Write draft manually</Button>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {error && limited && <a className="button button-secondary" href="mailto:support@vimbre.com?subject=Vimbre%20AI%20allowance">Contact support</a>}
    {message && <p role="status">{message}</p>}
    {reviewing && <div className="vai-result"><div className="field"><label htmlFor={draftId}>Draft</label><textarea id={draftId} rows={12} value={output} onChange={event => setOutput(event.target.value)} /></div><div className="form-actions">
      {onUse && <Button disabled={!output.trim()} onClick={() => { if (maxApplyLength && output.length > maxApplyLength) { setError(`Shorten the draft to ${maxApplyLength} characters before using it.`); return }; onUse(output) }}>Use this draft</Button>}
      <Button variant="secondary" disabled={!output.trim()} onClick={async () => { try { await navigator.clipboard.writeText(output); setMessage('Draft copied.') } catch { setError('Select the draft text to copy it.') } }}>Copy draft</Button>
      <Button variant="secondary" onClick={() => { setOutput(''); setReviewing(false); setMessage('') }}>Discard draft</Button>
    </div></div>}
  </section>
}
