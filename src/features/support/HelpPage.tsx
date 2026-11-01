import {useLocation} from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import './support-layout.css'
import {SupportApproval}from './SupportApproval'
import {WorkspaceIcon} from '../../components/ui/WorkspaceIcon'

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
const statusLabel = (status: string) => ({ new: 'Open', open: 'Open', in_progress: 'Open', waiting_customer: 'Support replied', resolved: 'Closed', closed: 'Closed' }[status] ?? status.replaceAll('_', ' '))
const formatDate = (value: string) => new Date(value).toLocaleString()

export function HelpPage() {
  const location=useLocation()
  const sending=useRef(false),messagesEnd=useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState(() => {const id=new URLSearchParams(window.location.search).get('ticket')||'';return /^[a-f0-9-]{36}$/i.test(id)?id:''})
  const [detail, setDetail] = useState<Detail | null>(null)
  const [replies, setReplies] = useState<Record<string, string>>({})
  const reply = replies[selected] ?? ''
  const [loading, setLoading] = useState(true)
  const [detailError, setDetailError] = useState('')
  const [requestDraft, setRequestDraft] = useState({subject: '', category: 'how_to', message: ''})
  const [refresh, setRefresh] = useState(0)
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const [search,setSearch]=useState('')
  const [view,setView]=useState('all')
  useEffect(()=>{const id=new URLSearchParams(location.search).get('ticket')||'';if(/^[a-f0-9-]{36}$/i.test(id)){setSelected(id);setNewRequestOpen(false)}},[location.search,location.key])

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
    if(sending.current)return
    sending.current=true
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
    finally { sending.current=false;setBusy(false) }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !reply.trim() || sending.current) return
    sending.current=true
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await call('reply', { ticket_id: selected, body: reply.trim() })
      if (!result.ok) { setError(errors[result.code ?? ''] ?? 'Your reply could not be sent. Please retry.'); return }
      setReplies(current => ({...current, [selected]: ''}))
      setNotice('Reply sent to support.')
      setRefresh(n => n + 1)
    } catch { setError('Your reply could not be sent. Please retry.') }
    finally { sending.current=false;setBusy(false) }
  }

  async function changeState(close: boolean) {
    if (!selected || sending.current) return
    sending.current=true; setBusy(true); setError(''); setNotice('')
    try {
      const {data,error:failure}=await supabase.rpc('customer_support_state',{p_ticket:selected,p_close:close})
      const result=data as unknown as Result
      if(failure || !result?.ok){setError('Could not update this conversation. Please retry.');return}
      setNotice(close?'Conversation closed.':'Conversation reopened.')
      setRefresh(n=>n+1)
    } catch {setError('Could not update this conversation. Please retry.')}
    finally {sending.current=false;setBusy(false)}
  }

  useEffect(()=>{messagesEnd.current?.scrollIntoView({block:'nearest'})},[detail?.messages.length,selected])
  const activeTicket = tickets.find(ticket => ticket.id === selected)
  const visibleTickets=tickets.filter(t=>t.subject.toLowerCase().includes(search.toLowerCase())&&(view==='all'||view==='active'&&!['resolved','closed'].includes(t.status)||view==='resolved'&&['resolved','closed'].includes(t.status)))

  return <div className="support-page">
    <div className="page-heading support-page-heading">
      <div className="support-title"><span className="support-brand-icon"><WorkspaceIcon name="support"/></span><h1 tabIndex={-1}>Help and support</h1></div>
    </div>

    {ticketNumber !== null && <p className="notice" role="status">Request received. Your ticket number is #{ticketNumber}.</p>}
    {notice && ticketNumber === null && <p className="notice" role="status">{notice}</p>}
    {error && <div className="support-error"><p className="field-error" role="alert">{error}</p><Button variant="secondary" disabled={busy || loading} onClick={() => setRefresh(n => n + 1)}>Retry</Button></div>}
    <section className={'support-workspace' + (selected || newRequestOpen ? ' support-panel-open' : '')} aria-label="Support inbox">
      <aside className="support-sidebar" aria-label="Support requests">
        <div className="support-list-heading"><h2>Messages</h2><Button variant="secondary" disabled={busy || loading} onClick={() => setRefresh(n => n + 1)}>{loading ? 'Refreshing…' : 'Refresh'}</Button></div>
        <Button className="support-new-request" disabled={busy} onClick={() => { setNewRequestOpen(true); setSelected(''); setError(''); setNotice(''); setTicketNumber(null) }}>New request</Button>
        <div className="support-request-filters"><label className="sr-only" htmlFor="request-search">Search requests</label><input id="request-search" placeholder="Search requests" value={search} onChange={e=>setSearch(e.target.value)}/><label className="sr-only" htmlFor="request-view">Request status</label><select id="request-view" value={view} onChange={e=>setView(e.target.value)}><option value="all">All requests</option><option value="active">Active requests</option><option value="resolved">Closed conversations</option></select></div>
        <div className="support-ticket-list" aria-busy={loading}>
          {!tickets.length ? <p className="support-list-empty" role="status">{loading ? 'Loading requests…' : error ? 'Requests could not be loaded.' : 'No requests yet. Contact support to start a conversation.'}</p> : visibleTickets.map(ticket => <button type="button" key={ticket.id} className={'ticket-row' + (selected === ticket.id ? ' ticket-row-active' : '')} aria-current={selected === ticket.id ? 'true' : undefined} disabled={busy} onClick={() => { setSelected(ticket.id); setError(''); setNotice(''); setTicketNumber(null); setNewRequestOpen(false) }}>
            <span className="ticket-row-top"><span>#{ticket.ticket_number}</span><span className={'ticket-status status-' + ticket.status}>{statusLabel(ticket.status)}</span></span>
            <strong>{ticket.subject}</strong><time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time>
          </button>)}
          {tickets.length>0&&visibleTickets.length===0&&<p className="support-list-empty">No requests match this view.</p>}
        </div>
      </aside>
      <div className="support-chat">
        {newRequestOpen ?           <form className="support-request-form" onSubmit={submit}>
            <div className="support-request-fields"><div className="support-form-heading"><span className="eyebrow">New request</span><h2>Contact Vimbre Support</h2></div>
            <Input label="Subject" name="subject" disabled={busy} value={requestDraft.subject} onChange={event => setRequestDraft(current => ({...current, subject: event.target.value}))} required maxLength={200} placeholder="What do you need help with?" />
            <div className="field">
              <label htmlFor="support-category">Category</label>
              <select id="support-category" name="category" disabled={busy} value={requestDraft.category} onChange={event => setRequestDraft(current => ({...current, category: event.target.value}))} required>
                <option value="billing">Billing</option><option value="how_to">Using Vimbre</option><option value="bug">Report a problem</option><option value="feature_idea">Feature suggestion</option><option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="support-message">Message</label>
              <textarea id="support-message" name="message" disabled={busy} value={requestDraft.message} onChange={event => setRequestDraft(current => ({...current, message: event.target.value}))} required maxLength={10000} rows={5} placeholder="Describe the problem and what you expected to happen…" />
            </div>
            <p className="muted">Do not include passwords or sensitive personal information. Up to three tickets per day.</p>
            </div><div className="support-form-actions"><Button variant="secondary" disabled={busy} onClick={() => setNewRequestOpen(false)}>Back to messages</Button><Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button></div>
          </form> : !selected ? <div className="support-empty-thread"><span className="support-empty-icon" aria-hidden="true"><WorkspaceIcon name="support"/></span><h2>Support messages</h2><p>Select a request to read replies, or start a new request.</p></div> : <>
          <header className="support-chat-header"><div className="support-chat-title"><span className="eyebrow">Request #{detail?.ticket.ticket_number ?? activeTicket?.ticket_number ?? ''}</span><h2>{detail?.ticket.subject ?? activeTicket?.subject ?? 'Support conversation'}</h2>{detail && <span className={'ticket-status status-' + detail.ticket.status}>{statusLabel(detail.ticket.status)}</span>}</div><div className="support-chat-actions"><Button variant="secondary" disabled={busy} aria-label="Back to messages" onClick={() => { setSelected(''); setDetail(null); setError(''); setNotice('') }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></Button></div></header>
          {detailError ? <div className="support-empty-thread"><p className="field-error" role="alert">{detailError}</p><Button variant="secondary" onClick={() => setRefresh(n => n + 1)}>Retry conversation</Button></div> : !detail ? <p className="support-loading" role="status">Loading conversation…</p> : <>
            <SupportApproval key={selected} ticket={selected}/><div className="support-chat-thread" role="region" aria-label="Support conversation" tabIndex={0}>
              {detail.messages.map(message => <article key={message.id} className={'thread-message ' + message.sender_kind}><div className="thread-message-meta"><strong>{message.sender_kind === 'staff' ? 'Vimbre Support' : 'You'}</strong><time dateTime={message.created_at}>{formatDate(message.created_at)}</time></div><p>{message.body}</p></article>)}
              <div ref={messagesEnd}/>
              {!detail.messages.length && <p className="muted">Your request is in the support queue. Replies will appear here.</p>}
            </div>
            <form className="support-reply-form" onSubmit={sendReply}><div className="field"><label htmlFor="support-reply">Reply to Vimbre Support</label><textarea id="support-reply" disabled={busy} value={reply} onChange={event => setReplies(current => ({...current, [selected]: event.target.value}))} required maxLength={10000} rows={3} placeholder="Write your reply…" /></div><div className="support-reply-actions">{detail&&<Button variant="secondary" disabled={busy} onClick={()=>void changeState(detail.ticket.status!=='resolved')}>{detail.ticket.status==='resolved'?'Reopen':'This solved it'}</Button>}<Button type="submit" disabled={busy || !reply.trim()}>{busy ? 'Sending…' : 'Send message'}</Button></div></form>
          </>}
        </>}
      </div>
    </section>
    <details className="support-email-options"><summary>Contact by email</summary>
    <div className="support-contact-options"><a href="mailto:support@vimbre.com?subject=Vimbre%20support"><strong>Account and workspace support</strong><span>support@vimbre.com</span></a><a href="mailto:hello@vimbre.com"><strong>General enquiries</strong><span>hello@vimbre.com</span></a></div>
    </details>
  </div>
}
