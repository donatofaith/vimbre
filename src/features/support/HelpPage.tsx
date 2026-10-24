import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

type Result = { ok?: boolean; code?: string; ticket_number?: number; data?: unknown }
type Ticket = { id: string; ticket_number: number; subject: string; category: string; status: string; created_at: string; updated_at: string; first_reply_at: string | null }
type TicketMessage = { id: string; sender_kind: 'customer' | 'staff'; body: string; created_at: string }
type Detail = { ticket: Ticket; messages: TicketMessage[] }

const errors: Record<string, string> = {
  sign_in: 'Your session has expired. Sign in again and retry.',
  access_denied: 'Your workspace access could not be verified. Contact your administrator.',
  invalid_input: 'Check the subject, category and message, then try again.',
  rate_limited: 'You have reached the limit of three support tickets today. Please try again tomorrow.',
  workspace_unavailable: 'Your workspace could not be matched. Please contact support another way.',
  not_found: 'That support ticket could not be found.',
}
const statusLabel = (status: string) => status.replaceAll('_', ' ')
const formatDate = (value: string) => new Date(value).toLocaleString()

export function HelpPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [reply, setReply] = useState('')
  const [refresh, setRefresh] = useState(0)

  async function call(action: string, payload: Record<string, unknown> = {}) {
    const { data, error: failure } = await supabase.rpc('customer_support', { p_action: action, p_payload: payload as import('../../lib/database.types').Json })
    if (failure) throw failure
    return (data ?? {}) as unknown as Result
  }

  useEffect(() => {
    let live = true
    void call('list').then(result => {
      if (!live) return
      if (result.ok) {
        setTickets((result.data ?? []) as Ticket[])
        setError('')
      } else setError(errors[result.code ?? ''] ?? 'Could not load your support requests.')
    }).catch(() => { if (live) setError('Support is temporarily unavailable. Please retry.') })
    return () => { live = false }
  }, [refresh])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    let live = true
    setDetail(null)
    void call('detail', { ticket_id: selected }).then(result => {
      if (!live) return
      if (result.ok) setDetail(result.data as Detail)
      else setError(errors[result.code ?? ''] ?? 'Could not load this conversation.')
    }).catch(() => { if (live) setError('Could not load this conversation. Please refresh and retry.') })
    return () => { live = false }
  }, [selected, refresh])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setBusy(true); setError(''); setNotice(''); setTicketNumber(null)
    const form = new FormData(formElement)
    const subject = String(form.get('subject') ?? '').trim()
    const category = String(form.get('category') ?? 'other')
    const body = String(form.get('message') ?? '').trim()
    try {
      const result = await call('submit', { subject, category, body })
      if (!result.ok) { setError(errors[result.code ?? ''] ?? 'Your request could not be submitted. Please retry.'); return }
      setTicketNumber(result.ticket_number ?? null)
      setNotice('Your request has been sent. You can follow the conversation below.')
      formElement.reset()
      setRefresh(n => n + 1)
    } catch { setError('Support is temporarily unavailable. Please retry in a moment.') }
    finally { setBusy(false) }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !reply.trim()) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await call('reply', { ticket_id: selected, body: reply.trim() })
      if (!result.ok) { setError(errors[result.code ?? ''] ?? 'Your reply could not be sent. Please retry.'); return }
      setReply('')
      setNotice('Reply sent to support.')
      setRefresh(n => n + 1)
    } catch { setError('Your reply could not be sent. Please retry.') }
    finally { setBusy(false) }
  }

  return <>
    <div className="page-heading">
      <span className="eyebrow">Vimbre support</span>
      <h1 tabIndex={-1}>Help and support</h1>
      <p>Send our team a question, report a problem, or continue an existing conversation.</p>
    </div>
    {ticketNumber !== null && <p className="notice" role="status">Request received. Your ticket number is #{ticketNumber}.</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {error && <p className="field-error" role="alert">{error}</p>}

    {!selected && <section className="card settings-card">
      <form className="auth-form" onSubmit={submit}>
        <h2>Contact support</h2>
        <Input label="Subject" name="subject" required maxLength={200} placeholder="Briefly describe what you need help with" />
        <div className="field">
          <label htmlFor="support-category">What is this about?</label>
          <select id="support-category" name="category" defaultValue="how_to" required>
            <option value="billing">Billing</option><option value="how_to">Using Vimbre</option><option value="bug">Report a problem</option><option value="feature_idea">Feature suggestion</option><option value="other">Something else</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="support-message">Details</label>
          <textarea id="support-message" name="message" required minLength={1} maxLength={10000} rows={7} placeholder="Tell us what happened and what you expected." />
        </div>
        <p className="muted">Please do not include passwords or sensitive personal information. You can submit up to three tickets per day.</p>
        <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send support request'}</Button>
      </form>
    </section>}

    <section className="card settings-card support-center">
      {!selected ? <>
        <div className="support-list-heading">
          <div><h2>Your support requests</h2><p className="muted">Select a request to open the conversation. Select it again to collapse it.</p></div>
          <Button type="button" disabled={busy} onClick={() => setRefresh(n => n + 1)}>Refresh</Button>
        </div>
        {!tickets.length ? <p className="muted">Your submitted requests will appear here.</p> : <div className="support-ticket-list">
          {tickets.map(ticket => <button type="button" key={ticket.id} className="ticket-row" aria-expanded={selected === ticket.id} onClick={() => { setSelected(ticket.id); setError(''); setNotice('') }}>
            <span className="ticket-row-main">
              <strong>#{ticket.ticket_number} · {ticket.subject}</strong>
              <span className="ticket-row-meta"><span className={'ticket-status status-' + ticket.status}>{statusLabel(ticket.status)}</span><span>Updated {formatDate(ticket.updated_at)}</span></span>
            </span>
            <span className="ticket-chevron" aria-hidden="true">›</span>
          </button>)}
        </div>}
      </> : <div className="support-chat">
        <div className="support-chat-header">
          <Button type="button" onClick={() => { setSelected(''); setDetail(null); setReply(''); setError(''); setNotice('') }}>← All requests</Button>
          <div className="support-chat-title">
            <span className="eyebrow">Support request #{detail?.ticket.ticket_number ?? tickets.find(t => t.id === selected)?.ticket_number ?? ''}</span>
            <h2>{detail?.ticket.subject ?? tickets.find(t => t.id === selected)?.subject ?? 'Loading conversation…'}</h2>
            {detail && <span className={'ticket-status status-' + detail.ticket.status}>{statusLabel(detail.ticket.status)}</span>}
          </div>
        </div>
        {!detail ? <p className="muted" role="status">Loading conversation…</p> : <>
          <div className="support-chat-thread" aria-label="Support conversation">
            {detail.messages.map(message => <article key={message.id} className={'thread-message ' + message.sender_kind}>
              <div className="thread-message-meta"><strong>{message.sender_kind === 'staff' ? 'Vimbre Support' : 'You'}</strong><time dateTime={message.created_at}>{formatDate(message.created_at)}</time></div>
              <p>{message.body}</p>
            </article>)}
            {!detail.messages.length && <div className="support-empty-thread"><p>Your request is in our support queue.</p><p className="muted">Send a message below if you have more details to add. Our team will reply here.</p></div>}
          </div>
          <form className="support-reply-form" onSubmit={sendReply}>
            <div className="field"><label htmlFor="support-reply">Message</label><textarea id="support-reply" value={reply} onChange={event => setReply(event.target.value)} required maxLength={10000} rows={3} placeholder="Write a message to Vimbre Support…" /></div>
            <div className="support-reply-actions"><span className="muted">Replies stay in this conversation.</span><Button type="submit" disabled={busy || !reply.trim()}>{busy ? 'Sending…' : 'Send message'}</Button></div>
          </form>
        </>}
      </div>}
    </section>
  </>
}
