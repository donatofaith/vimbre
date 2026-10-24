import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

type Result = { ok?: boolean; code?: string; ticket_number?: number }

const errors: Record<string, string> = {
  sign_in: 'Your session has expired. Sign in again and retry.',
  access_denied: 'Your workspace access could not be verified. Contact your administrator.',
  invalid_input: 'Check the subject, category and message, then try again.',
  rate_limited: 'You have reached the limit of three support tickets today. Please try again tomorrow.',
  workspace_unavailable: 'Your workspace could not be matched. Please contact support another way.',
}

export function HelpPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setBusy(true)
    setError('')
    setTicketNumber(null)
    const form = new FormData(event.currentTarget)
    const subject = String(form.get('subject') ?? '').trim()
    const category = String(form.get('category') ?? 'other')
    const body = String(form.get('message') ?? '').trim()
    try {
      const { data, error: failure } = await supabase.rpc('submit_customer_support', {
        p_subject: subject, p_category: category, p_body: body,
      })
      if (failure) throw failure
      const result = data as Result | null
      if (!result?.ok) {
        setError(errors[result?.code ?? ''] ?? 'Your request could not be submitted. Please retry.')
        return
      }
      setTicketNumber(result.ticket_number ?? null)
      formElement.reset()
    } catch {
      setError('Support is temporarily unavailable. Please retry in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="page-heading">
      <span className="eyebrow">Vimbre support</span>
      <h1 tabIndex={-1}>Help and support</h1>
      <p>Send our team a question or report a problem with your workspace.</p>
    </div>
    {ticketNumber !== null && <p className="notice" role="status">Request received. Your ticket number is #{ticketNumber}. Keep it for reference.</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <section className="card settings-card">
      <form className="auth-form" onSubmit={submit}>
        <Input label="Subject" name="subject" required maxLength={200} placeholder="Briefly describe what you need help with" />
        <div className="field">
          <label htmlFor="support-category">What is this about?</label>
          <select id="support-category" name="category" defaultValue="how_to" required>
            <option value="billing">Billing</option>
            <option value="how_to">Using Vimbre</option>
            <option value="bug">Report a problem</option>
            <option value="feature_idea">Feature suggestion</option>
            <option value="other">Something else</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="support-message">Details</label>
          <textarea id="support-message" name="message" required minLength={1} maxLength={10000} rows={7} placeholder="Tell us what happened and what you expected." />
        </div>
        <p className="muted">Please do not include passwords or sensitive personal information. You can submit up to three tickets per day.</p>
        <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send support request'}</Button>
      </form>
    </section>
  </>
}
