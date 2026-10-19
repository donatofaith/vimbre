import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { emptyInbox, chatTime } from './chat-types'
import type { ChatInbox } from './chat-types'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import './chat.css'
import { ChatContext, useChat } from './chat-context'
export function ChatProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const owner = profile?.id
  const [state, setState] = useState<{
    owner: string
    inbox: ChatInbox
    revision: number
    error: boolean
  }>({ owner: '', inbox: emptyInbox, revision: 0, error: false })
  const refreshRef = useRef<() => void>(() => {})
  const refresh = useCallback(() => refreshRef.current(), [])
  useEffect(() => {
    if (!owner) return
    let alive = true,
      busy = false,
      queued = false
    const load = async () => {
      if (busy) {
        queued = true
        return
      }
      busy = true
      try {
        const { data, error } = await supabase.rpc('chat_inbox')
        if (alive) {
          const valid =
            !error &&
            data &&
            typeof data === 'object' &&
            'items' in data &&
            Array.isArray(data.items) &&
            'unread' in data &&
            typeof data.unread === 'number'
          setState((old) => ({
            owner,
            inbox: valid
              ? (data as unknown as ChatInbox)
              : old.owner === owner
                ? old.inbox
                : emptyInbox,
            revision: old.revision + 1,
            error: !valid,
          }))
        }
      } catch {
        if (alive) setState((old) => ({ ...old, error: true }))
      } finally {
        busy = false
        if (alive && queued) {
          queued = false
          void load()
        }
      }
    }
    const onReturn = () => {
      if (!document.hidden) void load()
    }
    refreshRef.current = () => {
      void load()
    }
    const channel = supabase
      .channel(`chat-inbox:${owner}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_notifications',
          filter: `recipient_id=eq.${owner}`,
        },
        () => {
          void load()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void load()
      })
    void load()
    const timer = setInterval(onReturn, 20000)
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      alive = false
      refreshRef.current = () => {}
      clearInterval(timer)
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
      void supabase.removeChannel(channel)
    }
  }, [owner])
  const current =
    state.owner === owner
      ? state
      : { inbox: emptyInbox, revision: 0, error: false }
  return (
    <ChatContext.Provider value={{ ...current, refresh }}>
      {children}
    </ChatContext.Provider>
  )
}
export function ChatNotifications() {
  const { inbox, error, refresh } = useChat()
  const dialog = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button
        className="chat-bell"
        type="button"
        aria-label={`Notifications${inbox.unread ? `, ${inbox.unread} unread` : ''}`}
        onClick={() => {
          refresh()
          dialog.current?.showModal()
        }}
      >
        <WorkspaceIcon name="bell" />
        {inbox.unread > 0 && (
          <span className="chat-count">
            {inbox.unread > 99 ? '99+' : inbox.unread}
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        className="vw-dialog chat-notifications"
        aria-labelledby="chat-notifications-title"
      >
        <div className="chat-dialog-heading">
          <h2 id="chat-notifications-title">Notifications</h2>
          <button
            className="button button-secondary"
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
        {error && (
          <p role="alert" className="field-error">
            Notifications could not be refreshed.{' '}
            <button type="button" onClick={refresh}>
              Retry
            </button>
          </p>
        )}
        {!error && inbox.items.length === 0 && <p>You’re all caught up.</p>}
        <ul>
          {inbox.items.map((n) => (
            <li key={n.id}>
              <Link
                to={`/app/chat?conversation=${n.conversation_id}&message=${n.message_id}`}
                onClick={() => dialog.current?.close()}
              >
                <strong>
                  {n.sender_name}
                  {n.mentioned ? ' mentioned you' : ''}
                </strong>
                <span>{n.title}</span>
                <p>{n.preview}</p>
                <small>{chatTime(n.created_at)}</small>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/app/chat" onClick={() => dialog.current?.close()}>
          Open chat
        </Link>
      </dialog>
    </>
  )
}
