import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import './support.css'

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
const statusLabel = (status: string) => ({ open: 'Open', in_progress: 'In progress', waiting_customer: 'Awaiting your reply', resolved: 'Resolved', closed: 'Closed' }[status] ?? status.replaceAll('_', ' '))
const formatDate = (value: string) => new Date(value).toLocaleString()

export function HelpPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [replies, setReplies] = useState<Record<string, string>>({})
  const reply = replies[selected] ?? ''
  const [loading, setLoading] = useState(true)
  const [detailError, setDetailError] = useState('')
  const [requestDraft, setRequestDraft] = useState({subject: '', category: 'how_to', message: ''})
  const [refresh, setRefresh] = useState(0)
  const [newRequestOpen, setNewRequestOpen] = useState(false)

  async function call(action: string, payload: Record<string, unknown> = {}) {
    const { data, error: failure } = await supabase.rpc('customer_support', { p_action: action, p_payload: payload as import('../../lib/database.types').Json })
    if (failure) throw failure
    return (data ?? {}) as unknown as Result
  }

  useEffect(() => {
    let live = true
    setLoading(true)
    void call('list').then(result => {
      if (!live) return
      if (result.ok) {
        setTickets((result.data ?? []) as Ticket[])
        setError('')
      } else setError(errors[result.code ?? ''] ?? 'Could not load your support requests.')
    }).catch(() => { if (live) setError('Support is temporarily unavailable. Please retry.') }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [refresh])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    let live = true
    setDetail(null)
    setDetailError('')
    void call('detail', { ticket_id: selected }).then(result => {
      if (!live) return
      if (result.ok) setDetail(result.data as Detail)
      else setDetailError(errors[result.code ?? ''] ?? 'Could not load this conversation.')
    }).catch(() => { if (live) setDetailError('Could not load this conversation. Please retry.') })
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
      setRequestDraft({subject: '', category: 'how_to', message: ''})
      setNewRequestOpen(false)
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
      setReplies(current => ({...current, [selected]: ''}))
      setNotice('Reply sent to support.')
      setRefresh(n => n + 1)
    } catch { setError('Your reply could not be sent. Please retry.') }
    finally { setBusy(false) }
  }

  const activeTicket = tickets.find(ticket => ticket.id === selected)

  return <div className="support-page">
    <div className="page-heading support-page-heading">
      <h1 tabIndex={-1}>Help and support</h1>
      <p>Contact Vimbre Support and follow your requests.</p>
    </div>
    {ticketNumber !== null && <p className="notice" role="status">Request received. Your ticket number is #{ticketNumber}.</p>}
    {notice && ticketNumber === null && <p className="notice" role="status">{notice}</p>}
    {error && <div className="support-error"><p className="field-error" role="alert">{error}</p><Button variant="secondary" disabled={busy || loading} onClick={() => setRefresh(n => n + 1)}>Retry</Button></div>}
    <section className={'support-workspace' + (selected || newRequestOpen ? ' support-panel-open' : '')} aria-label="Support inbox">
      <aside className="support-sidebar" aria-label="Support requests">
        <div className="support-list-heading"><h2>Messages</h2><Button variant="secondary" disabled={busy || loading} onClick={() => setRefresh(n => n + 1)}>{loading ? 'Refreshing…' : 'Refresh'}</Button></div>
        <Button className="support-new-request" disabled={busy} onClick={() => { setNewRequestOpen(true); setSelected(''); setError(''); setNotice(''); setTicketNumber(null) }}>New request</Button>
        <div className="support-ticket-list" aria-busy={loading}>
          {!tickets.length ? <p className="support-list-empty" role="status">{loading ? 'Loading requests…' : error ? 'Requests could not be loaded.' : 'No requests yet. Contact support to start a conversation.'}</p> : tickets.map(ticket => <button type="button" key={ticket.id} className={'ticket-row' + (selected === ticket.id ? ' ticket-row-active' : '')} aria-current={selected === ticket.id ? 'true' : undefined} disabled={busy} onClick={() => { setSelected(ticket.id); setError(''); setNotice(''); setTicketNumber(null); setNewRequestOpen(false) }}>
            <span className="ticket-row-top"><span>#{ticket.ticket_number}</span><span className={'ticket-status status-' + ticket.status}>{statusLabel(ticket.status)}</span></span>
            <strong>{ticket.subject}</strong><time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time>
          </button>)}
        </div>
      </aside>
      <div className="support-chat">
        {newRequestOpen ?           <form className="support-request-form" onSubmit={submit}>
            <div className="support-form-heading"><span className="eyebrow">New request</span><h2>Contact Vimbre Support</h2></div>
            <Input label="Subject" name="subject" value={requestDraft.subject} onChange={event => setRequestDraft(current => ({...current, subject: event.target.value}))} required maxLength={200} placeholder="What do you need help with?" />
            <div className="field">
              <label htmlFor="support-category">Category</label>
              <select id="support-category" name="category" value={requestDraft.category} onChange={event => setRequestDraft(current => ({...current, category: event.target.value}))} required>
                <option value="billing">Billing</option><option value="how_to">Using Vimbre</option><option value="bug">Report a problem</option><option value="feature_idea">Feature suggestion</option><option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="support-message">Message</label>
              <textarea id="support-message" name="message" value={requestDraft.message} onChange={event => setRequestDraft(current => ({...current, message: event.target.value}))} required maxLength={10000} rows={5} placeholder="Describe the problem and what you expected to happen…" />
            </div>
            <p className="muted">Do not include passwords or sensitive personal information. Up to three tickets per day.</p>
            <div className="support-form-actions"><Button variant="secondary" disabled={busy} onClick={() => setNewRequestOpen(false)}>Back to messages</Button><Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button></div>
          </form> : !selected ? <div className="support-empty-thread"><span className="support-empty-icon" aria-hidden="true">✉</span><h2>Support messages</h2><p>Select a request to read replies, or start a new request.</p></div> : <>
          <header className="support-chat-header"><div className="support-chat-title"><span className="eyebrow">Request #{detail?.ticket.ticket_number ?? activeTicket?.ticket_number ?? ''}</span><h2>{detail?.ticket.subject ?? activeTicket?.subject ?? 'Support conversation'}</h2>{detail && <span className={'ticket-status status-' + detail.ticket.status}>{statusLabel(detail.ticket.status)}</span>}</div><Button variant="secondary" disabled={busy} onClick={() => { setSelected(''); setDetail(null); setError(''); setNotice('') }}>Back to messages</Button></header>
          {detailError ? <div className="support-empty-thread"><p className="field-error" role="alert">{detailError}</p><Button variant="secondary" onClick={() => setRefresh(n => n + 1)}>Retry conversation</Button></div> : !detail ? <p className="support-loading" role="status">Loading conversation…</p> : <>
            <div className="support-chat-thread" role="region" aria-label="Support conversation" tabIndex={0}>
              {detail.messages.map(message => <article key={message.id} className={'thread-message ' + message.sender_kind}><div className="thread-message-meta"><strong>{message.sender_kind === 'staff' ? 'Vimbre Support' : 'You'}</strong><time dateTime={message.created_at}>{formatDate(message.created_at)}</time></div><p>{message.body}</p></article>)}
              {!detail.messages.length && <p className="muted">Your request is in the support queue. Replies will appear here.</p>}
            </div>
            <form className="support-reply-form" onSubmit={sendReply}><div className="field"><label htmlFor="support-reply">Reply to Vimbre Support</label><textarea id="support-reply" value={reply} onChange={event => setReplies(current => ({...current, [selected]: event.target.value}))} required maxLength={10000} rows={3} placeholder="Write your reply…" /></div><div className="support-reply-actions"><Button type="submit" disabled={busy || !reply.trim()}>{busy ? 'Sending…' : 'Send message'}</Button></div></form>
          </>}
        </>}
      </div>
    </section>
  </div>
}
