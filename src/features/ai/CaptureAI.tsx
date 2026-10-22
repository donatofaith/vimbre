import { useRef, useState } from 'react'
import { runAI } from '../../lib/ai-gateway'
import { Button } from '../../components/ui/Button'
import { parseExtraction, validateAIInput } from './ai-output'
import type { ExtractedDraft } from './ai-output'
import './ai.css'
export function CaptureAI({ text, choose, rows, setRows, requestId }: { text: string; choose: (draft: ExtractedDraft) => void; rows: ExtractedDraft[] | null; setRows: (rows: ExtractedDraft[]) => void; requestId: () => string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [limited, setLimited] = useState(false)
  const pending = useRef(false)
  async function extract() {
    if (pending.current) return
    const invalid = validateAIInput(text)
    if (invalid) { setError(invalid); return }
    pending.current = true; setBusy(true); setError(''); setLimited(false)
    try {
      const response = await runAI('capture_extract', text, requestId())
      if (!response.ok) { setError(response.message); setLimited(response.code === 'limit_reached'); return }
      setRows(parseExtraction(response.text))
    } catch { setError('The draft could not be read. You can add a draft manually.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="vai-panel" aria-label="AI capture drafts">
    {rows === null && <Button disabled={busy} onClick={() => void extract()}>{busy ? 'Drafting…' : 'Draft with Vimbre AI'}</Button>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {error && limited && <a className="button button-secondary" href="mailto:support@vimbre.com?subject=Vimbre%20AI%20allowance">Contact support</a>}
    {rows !== null && <><p role="status">{rows.length ? 'Review each suggestion before saving a draft.' : 'No suggestions remain to review.'}</p><ul className="vai-proposals">{rows.map((row, index) => <li key={index}><span>{row.kind === 'action' ? 'Task' : row.kind === 'contact' ? 'External contact' : 'Decision'}</span><h3>{row.payload.title}</h3><p>{row.payload.reason || row.payload.details}</p><Button variant="secondary" onClick={() => choose(row)}>Review suggestion</Button></li>)}</ul></>}
  </section>
}
