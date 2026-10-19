import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { useChat } from './chat-context'
import { chatTime, mergeMessages, recordPath } from './chat-types'
import type {
  ChatPerson,
  Conversation,
  ChatDetail,
  Message,
} from './chat-types'

export function ChatPage() {
  const { profile } = useAuth()
  const { revision, refresh } = useChat()
  const [params, setParams] = useSearchParams()
  const selected = params.get('conversation') ?? ''
  const anchor = params.get('message')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [listError, setListError] = useState('')
  const [listLoading, setListLoading] = useState(true)
  const [listRetry, setListRetry] = useState(0)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [detailReload, setDetailReload] = useState(0)
  useEffect(() => {
    let alive = true
    void supabase.rpc('chat_list', { p_page: page }).then(({ data, error }) => {
      if (!alive) return
      setListLoading(false)
      if (error || !Array.isArray(data)) {
        setListError('Your conversations could not be loaded.')
        return
      }
      setListError('')
      const rows = data as unknown as Conversation[]
      setConversations(rows)
      setHasMore(rows.length === 50)
    })
    return () => {
      alive = false
    }
  }, [profile?.id, page, revision, listRetry])
  function open(id: string) {
    setParams({ conversation: id })
    setCreating(false)
  }
  return (
    <section className="chat-page">
      <div className="vw-page-heading">
        <div>
          <h1 tabIndex={-1}>Chat</h1>
        </div>
        <button
          className="button button-primary"
          onClick={() => setCreating(true)}
        >
          New chat
        </button>
      </div>
      <div className="chat-workspace" data-conversation={Boolean(selected)}>
        <aside className="chat-list" aria-label="Conversations">
          <label className="chat-search">
            Find a conversation
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              type="search"
            />
          </label>
          {listError && (
            <p role="alert" className="field-error">
              {listError}{' '}
              <button onClick={() => setListRetry((n) => n + 1)}>Retry</button>
            </p>
          )}
          {!listError && listLoading && conversations.length === 0 && (
            <p role="status">Loading conversations…</p>
          )}
          {!listLoading && !listError && conversations.length === 0 && (
            <div className="chat-empty">
              <h2>Start a conversation</h2>
              <p>Message a teammate or create a group.</p>
            </div>
          )}
          <ul>
            {conversations
              .filter((c) =>
                c.title
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
              )
              .map((c) => (
                <li key={c.id}>
                  <button
                    className="chat-conversation"
                    aria-current={selected === c.id ? 'page' : undefined}
                    onClick={() => open(c.id)}
                  >
                    <span className="chat-avatar" aria-hidden="true">
                      {c.kind === 'group'
                        ? '#'
                        : c.title.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="chat-conversation-copy">
                      <strong>{c.title}</strong>
                      <span>{c.preview || 'No messages yet'}</span>
                    </span>
                    {c.unread > 0 && (
                      <span
                        className="chat-count"
                        aria-label={`${c.unread} unread`}
                      >
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
          {search &&
            conversations.length > 0 &&
            !conversations.some((c) =>
              c.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
            ) && <p>No matching conversations.</p>}
          {page > 0 && (
            <button
              className="button button-secondary"
              onClick={() => setPage((p) => p - 1)}
            >
              Previous conversations
            </button>
          )}
          {hasMore && (
            <button
              className="button button-secondary"
              disabled={listLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              More conversations
            </button>
          )}
        </aside>
        {selected ? (
          <ConversationPanel
            key={`${selected}:${profile?.id}`}
            id={selected}
            anchor={anchor}
            revision={revision + detailReload}
            onBack={() => setParams({})}
            onLatest={() => setParams({ conversation: selected })}
            onJump={(message) => {
              setParams({ conversation: selected, message })
              setDetailReload((n) => n + 1)
            }}
            onSent={() => {
              setParams({ conversation: selected })
              setPage(0)
              refresh()
            }}
          />
        ) : (
          <div className="chat-welcome">
            <span className="chat-welcome-mark" aria-hidden="true">
              ↗
            </span>
            <h2>Keep your team in the loop</h2>
            <p>Choose a conversation or start a new chat.</p>
            <button
              className="button button-primary"
              onClick={() => setCreating(true)}
            >
              Start a chat
            </button>
          </div>
        )}
      </div>
      {creating && (
        <NewChat
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            open(id)
            setPage(0)
            refresh()
          }}
        />
      )}
    </section>
  )
}
function NewChat({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState<'direct' | 'group'>('direct')
  const [title, setTitle] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [people, setPeople] = useState<ChatPerson[]>([])
  const [selected, setSelected] = useState<ChatPerson[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [peopleError, setPeopleError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      void supabase
        .rpc('chat_people', { p_search: search, p_page: page })
        .then(({ data, error }) => {
          if (!alive) return
          setLoading(false)
          setPeopleError(Boolean(error) || !Array.isArray(data))
          if (!error && Array.isArray(data)) {
            const rows = data as unknown as ChatPerson[]
            setPeople((old) => (page === 0 ? rows : [...old, ...rows]))
            setMore(rows.length === 50)
          }
        })
    }, 200)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [search, page, retry])
  async function create(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('chat_create', {
        p_kind: kind,
        p_title: title,
        p_members: selected.map((p) => p.id),
      })
      if (error || !data) throw error
      onCreated(data)
    } catch {
      setError(
        'The chat could not be created. Check your selection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="vw-dialog chat-new"
      aria-labelledby="chat-new-title"
      onCancel={(e) => {
        if (busy) e.preventDefault()
      }}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          void create(e)
        }}
      >
        <div className="chat-dialog-heading">
          <h2 id="chat-new-title">New chat</h2>
          <button
            type="button"
            disabled={busy}
            className="button button-secondary"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
        </div>
        <label className="chat-label">
          Conversation type
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as 'direct' | 'group')
              setSelected([])
            }}
          >
            <option value="direct">Direct message</option>
            <option value="group">Group chat</option>
          </select>
        </label>
        {kind === 'group' && (
          <label className="chat-label">
            Group name
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
              placeholder="e.g. Operations team"
            />
          </label>
        )}
        <label className="chat-label">
          Find teammates
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Search by name"
            maxLength={100}
          />
        </label>
        <p>
          {selected.length} selected
          {kind === 'group' ? ' · Up to 49 teammates' : ''}
        </p>
        <div className="chat-selected">
          {selected.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() =>
                setSelected((old) => old.filter((s) => s.id !== p.id))
              }
              aria-label={`Remove ${p.full_name}`}
            >
              {p.full_name} ×
            </button>
          ))}
        </div>
        {loading && <p role="status">Loading teammates…</p>}
        {peopleError && (
          <p className="field-error" role="alert">
            Teammates could not be loaded.{' '}
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Retry
            </button>
          </p>
        )}
        {!loading && !peopleError && people.length === 0 && (
          <p>
            {search
              ? 'No teammates match your search.'
              : 'No other active teammates yet. Invite someone from the Team page.'}
          </p>
        )}
        <fieldset className="chat-people" disabled={busy}>
          <legend>Choose teammates</legend>
          {people.map((p) => (
            <label key={p.id}>
              <input
                type={kind === 'direct' ? 'radio' : 'checkbox'}
                name="chat-member"
                checked={selected.some((s) => s.id === p.id)}
                onChange={(e) =>
                  setSelected((old) =>
                    kind === 'direct'
                      ? [p]
                      : e.target.checked
                        ? [...old, p]
                        : old.filter((s) => s.id !== p.id),
                  )
                }
              />
              <span>{p.full_name}</span>
              <small>
                {p.role === 'hr_admin'
                  ? 'HR Admin'
                  : p.role === 'manager'
                    ? 'Manager'
                    : 'Employee'}
              </small>
            </label>
          ))}
        </fieldset>
        {more && (
          <button
            type="button"
            className="button button-secondary"
            disabled={loading}
            onClick={() => setPage((p) => p + 1)}
          >
            More teammates
          </button>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-primary"
          disabled={busy || selected.length === 0 || selected.length > 49}
        >
          {busy ? 'Creating…' : 'Create chat'}
        </button>
      </form>
    </dialog>
  )
}
function ConversationPanel({
  id,
  anchor,
  revision,
  onBack,
  onLatest,
  onJump,
  onSent,
}: {
  id: string
  anchor: string | null
  revision: number
  onBack: () => void
  onLatest: () => void
  onJump: (message: string) => void
  onSent: () => void
}) {
  const { profile } = useAuth()
  const { refresh } = useChat()
  const [result, setResult] = useState<ChatDetail | null>(null)
  const [error, setError] = useState('')
  const [readError, setReadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [more, setMore] = useState(false)
  const [reply, setReply] = useState<Message | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const scroll = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const lastRead = useRef(0)
  const initial = useRef(true)
  const previousAnchor = useRef(anchor)
  const latestSeq = useRef(0)
  const viewing = useRef({ id, anchor })
  useEffect(() => {
    viewing.current = { id, anchor }
  }, [id, anchor])
  const [loadVersion, setLoadVersion] = useState(0)
  useEffect(() => {
    let alive = true
    if (previousAnchor.current !== anchor) {
      initial.current = true
      previousAnchor.current = anchor
    }
    void supabase
      .rpc('chat_detail', {
        p_conversation: id,
        p_before: null,
        p_anchor: anchor,
      })
      .then(({ data, error }) => {
        if (!alive) return
        if (
          error ||
          !data ||
          typeof data !== 'object' ||
          !('messages' in data) ||
          !Array.isArray(data.messages)
        ) {
          setError('This conversation could not be opened.')
          setResult(null)
          return
        }
        const detail = data as unknown as ChatDetail
        const nearBottom =
          !scroll.current ||
          scroll.current.scrollHeight -
            scroll.current.scrollTop -
            scroll.current.clientHeight <
            100
        setError('')
        const reset = initial.current
        setResult((old) => {
          const overlap = old?.messages.some(message => detail.messages.some(incoming => incoming.id === message.id))
          // Never join disjoint history windows and silently hide the intervening messages.
          if (!old || reset || (!overlap && detail.messages.length > 0)) return detail
          return { ...detail, messages: mergeMessages(old.messages, detail.messages) }
        })
        if (reset) setMore(detail.messages.length === 50)
        if (
          !initial.current &&
          !nearBottom &&
          (detail.messages.at(-1)?.seq ?? 0) > latestSeq.current
        )
          setUnseen((n) => n + 1)
        latestSeq.current = detail.messages.at(-1)?.seq ?? 0
        const shouldScroll = initial.current || nearBottom || Boolean(anchor)
        initial.current = false
        if (shouldScroll)
          requestAnimationFrame(() => {
            if (alive) {
              bottom.current?.scrollIntoView({ block: 'nearest' })
              setUnseen(0)
            }
          })
        setLoadVersion((n) => n + 1)
      })
    return () => {
      alive = false
    }
  }, [id, anchor, revision, retry])
  // Mark only loaded messages at the visible bottom; an older anchor never clears newer messages.
  useEffect(() => {
    if (!result || document.hidden || !document.hasFocus()) return
    const max = result.messages.at(-1)?.seq ?? 0
    const el = scroll.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 120) return
    if (max <= lastRead.current) return
    void supabase
      .rpc('chat_read', { p_conversation: id, p_through: max })
      .then(({ error }) => {
        setReadError(Boolean(error))
        if (!error) {
          lastRead.current = max
          refresh()
        }
      })
  }, [id, anchor, loadVersion, result, refresh])
  async function older() {
    if (!result || loadingOlder) return
    const key = { ...viewing.current }
    setLoadingOlder(true)
    const el = scroll.current
    const height = el?.scrollHeight ?? 0
    try {
      const { data, error } = await supabase.rpc('chat_detail', {
        p_conversation: id,
        p_before: result.messages[0]?.seq ?? null,
        p_anchor: null,
      })
      if (
        viewing.current.id !== key.id ||
        viewing.current.anchor !== key.anchor
      )
        return
      if (error || !data) throw error
      const detail = data as unknown as ChatDetail
      setResult((old) =>
        old
          ? { ...old, messages: mergeMessages(detail.messages, old.messages) }
          : old,
      )
      setMore(detail.messages.length === 50)
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - height
      })
    } catch {
      setError('Earlier messages could not be loaded. Please retry.')
    } finally {
      setLoadingOlder(false)
    }
  }
  const title =
    result?.kind === 'direct'
      ? (result.members.find((p) => p.id !== profile?.id)?.full_name ??
        'Direct message')
      : (result?.title ?? 'Conversation')
  return (
    <section className="chat-thread" aria-label="Conversation">
      <header className="chat-thread-header">
        <button className="button button-secondary chat-back" onClick={onBack}>
          ← Chats
        </button>
        <div>
          <h2>{title}</h2>
          {result && (
            <button
              className="chat-members-button"
              onClick={() => setShowMembers((v) => !v)}
              aria-expanded={showMembers}
            >
              {result.members.length} participants
            </button>
          )}
        </div>
      </header>
      {showMembers && result && (
        <ul className="chat-member-list" aria-label="Participants">
          {result.members.map((p) => (
            <li key={p.id}>
              {p.full_name}
              {p.active === false ? ' · Inactive' : ''}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error chat-error" role="alert">
          {error} <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </p>
      )}
      {readError && (
        <p className="field-error" role="alert">
          Could not mark messages as read.{' '}
          <button
            onClick={() => {
              lastRead.current = 0
              setLoadVersion((n) => n + 1)
            }}
          >
            Retry
          </button>
        </p>
      )}
      {!result && !error && (
        <p className="chat-empty" role="status">
          Loading messages…
        </p>
      )}
      <div
        className="chat-messages"
        ref={scroll}
        tabIndex={0}
        aria-label="Messages"
        onScroll={() => {
          const el = scroll.current
          if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
            setUnseen(0)
            setLoadVersion((n) => n + 1)
          }
        }}
      >
        {more && (
          <button
            className="button button-secondary chat-load-older"
            disabled={loadingOlder}
            onClick={() => {
              void older()
            }}
          >
            {loadingOlder ? 'Loading…' : 'Earlier messages'}
          </button>
        )}
        {result?.messages.length === 0 && (
          <div className="chat-empty">
            <h3>Say hello</h3>
            <p>Send the first message.</p>
          </div>
        )}
        {result?.messages.map((m) => (
          <article
            id={`message-${m.id}`}
            className="chat-message"
            data-own={m.sender_id === profile?.id}
            data-highlight={anchor === m.id}
            key={m.id}
            aria-label={`Message from ${m.sender_name}`}
          >
            <div className="chat-message-meta">
              <strong>{m.sender_name}</strong>
              <time dateTime={m.created_at}>{chatTime(m.created_at)}</time>
            </div>
            <div className="chat-bubble">
              {m.reply && (
                <button
                  className="chat-reply-preview"
                  onClick={() => onJump(m.reply!.id)}
                >
                  <strong>{m.reply.sender_name}</strong>
                  <span>{m.reply.body}</span>
                </button>
              )}
              <p>{m.body}</p>
              {m.mention_names.length > 0 && (
                <div className="chat-mentions">
                  {m.mention_names.map((p) => (
                    <span key={p.id}>@{p.name}</span>
                  ))}
                </div>
              )}
              {m.record_path && (
                <Link to={m.record_path}>Open linked record ↗</Link>
              )}
            </div>
            <button
              className="chat-reply-button"
              onClick={() => {
                setReply(m)
                document.getElementById('chat-message-input')?.focus()
              }}
            >
              Reply<span className="sr-only"> to {m.sender_name}</span>
            </button>
          </article>
        ))}
        <div ref={bottom} />
      </div>
      {anchor && (
        <button className="chat-new-messages" onClick={onLatest}>
          Back to latest messages ↓
        </button>
      )}
      {!anchor && unseen > 0 && (
        <button
          className="chat-new-messages"
          onClick={() => {
            bottom.current?.scrollIntoView({ block: 'nearest' })
            setUnseen(0)
            setLoadVersion((n) => n + 1)
          }}
        >
          Latest messages ↓
        </button>
      )}
      {result && (
        <MessageComposer
          key={id}
          conversation={id}
          members={result.members}
          reply={reply}
          onCancelReply={() => setReply(null)}
          onSent={() => {
            setReply(null)
            initial.current = true
            onSent()
          }}
        />
      )}
    </section>
  )
}
function MessageComposer({
  conversation,
  members,
  reply,
  onCancelReply,
  onSent,
}: {
  conversation: string
  members: ChatPerson[]
  reply: Message | null
  onCancelReply: () => void
  onSent: () => void
}) {
  const { profile } = useAuth()
  const [body, setBody] = useState('')
  const [mentions, setMentions] = useState<ChatPerson[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [link, setLink] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null)
  async function send(event: FormEvent) {
    event.preventDefault()
    if (busy || !body.trim()) return
    const path = link.trim() ? recordPath(link.trim()) : null
    if (link.trim() && !path) {
      setError('Paste a Vimbre role, task, team activity or handover link.')
      return
    }
    const payload = {
      p_conversation: conversation,
      p_body: body.trim(),
      p_reply: reply?.id ?? null,
      p_mentions: mentions.map((p) => p.id),
      p_record_path: path,
    }
    const fingerprint = JSON.stringify(payload)
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, id: crypto.randomUUID() }
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.rpc('chat_send', {
        ...payload,
        p_id: attempt.current!.id,
      })
      if (error) throw error
      attempt.current = null
      setBody('')
      setMentions([])
      setLink('')
      setShowLink(false)
      setShowMentions(false)
      onSent()
    } catch {
      setError(
        'Your message was not confirmed as sent. Retry to check or send it safely.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="chat-composer"
      onSubmit={(e) => {
        void send(e)
      }}
    >
      {reply && (
        <div className="chat-composer-reply">
          <div>
            <strong>Replying to {reply.sender_name}</strong>
            <p>{reply.body.slice(0, 160)}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancelReply}
            aria-label="Cancel reply"
          >
            ×
          </button>
        </div>
      )}
      <label className="sr-only" htmlFor="chat-message-input">
        Message
      </label>
      <textarea
        id="chat-message-input"
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          if (/(^|\s)@$/.test(e.target.value)) setShowMentions(true)
        }}
        maxLength={4000}
        placeholder="Write a message…"
        rows={3}
        required
        disabled={busy}
      />
      {mentions.length > 0 && (
        <div className="chat-selected" aria-label="Mentioned teammates">
          {mentions.map((p) => (
            <button
              type="button"
              disabled={busy}
              key={p.id}
              onClick={() =>
                setMentions((old) => old.filter((s) => s.id !== p.id))
              }
              aria-label={`Remove mention ${p.full_name}`}
            >
              @{p.full_name} ×
            </button>
          ))}
        </div>
      )}
      {showMentions && (
        <fieldset className="chat-mention-picker" disabled={busy}>
          <legend>Mention a participant</legend>
          {members
            .filter((p) => p.id !== profile?.id && p.active !== false)
            .map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={mentions.some((s) => s.id === p.id)}
                  onChange={(e) =>
                    setMentions((old) =>
                      e.target.checked
                        ? [...old, p]
                        : old.filter((s) => s.id !== p.id),
                    )
                  }
                />
                {p.full_name}
              </label>
            ))}
          {members.filter((p) => p.id !== profile?.id && p.active !== false)
            .length === 0 && <p>No other active participants.</p>}
        </fieldset>
      )}
      {showLink && (
        <label className="chat-label">
          Record link
          <input
            type="text"
            placeholder="Paste a Vimbre record URL"
            value={link}
            maxLength={700}
            onChange={(e) => setLink(e.target.value)}
            disabled={busy}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="chat-composer-actions">
        <button
          type="button"
          className="button button-secondary"
          aria-expanded={showMentions}
          disabled={busy}
          onClick={() => setShowMentions((v) => !v)}
        >
          @ Mention
        </button>
        <button
          type="button"
          className="button button-secondary"
          aria-expanded={showLink}
          disabled={busy}
          onClick={() => setShowLink((v) => !v)}
        >
          Link record
        </button>
        <span className="chat-char-count">{body.length}/4000</span>
        <button
          className="button button-primary"
          disabled={busy || !body.trim()}
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  )
}
