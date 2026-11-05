import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { emptyInbox } from './chat-types'
import type { ChatInbox, ChatNotification } from './chat-types'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import './chat.css'
import { ChatContext, useChat } from './chat-context'
export function ChatProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const owner = profile?.id
  const location = useLocation()
  const [arrival, setArrival] = useState<{ owner: string; notice: ChatNotification } | null>(null)
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
    let latestId: number | undefined
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
          if (valid) {
            const items = (data as unknown as ChatInbox).items
            const newest = items.reduce<ChatNotification | undefined>((latest, item) =>
              !latest || item.id > latest.id ? item : latest, undefined)
            if (newest && latestId !== undefined && newest.id > latestId && !document.hidden) {
              setArrival({ owner, notice: newest })
            }
            latestId = Math.max(latestId ?? 0, newest?.id ?? 0)
          }
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
  useEffect(() => {
    if (!arrival) return
    const timeout = setTimeout(() => setArrival(null), 10000)
    return () => clearTimeout(timeout)
  }, [arrival])

  const activeConversation = location.pathname === '/app/chat'
    ? new URLSearchParams(location.search).get('conversation') : null
  const notice = arrival && arrival.owner === owner && arrival.notice.conversation_id !== activeConversation ? arrival.notice : null
  const current =
    state.owner === owner
      ? state
      : { inbox: emptyInbox, revision: 0, error: false }
  return (
    <ChatContext.Provider value={{ ...current, refresh }}>
      {children}
      {notice && <div className="chat-arrival">
        <Link to={`/app/chat?conversation=${notice.conversation_id}&message=${notice.message_id}`} onClick={() => setArrival(null)}>
          <span role="status">{notice.mentioned ? `${notice.sender_name} mentioned you` : `New message from ${notice.sender_name}`}</span>
          <small>Open chat</small>
        </Link>
        <button type="button" className="button button-secondary" aria-label="Dismiss message notification" onClick={() => setArrival(null)}>Dismiss</button>
      </div>}
    </ChatContext.Provider>
  )
}
export function ChatLauncher() {
  const { inbox } = useChat()
  return <NavLink to="/app/chat" className="chat-launcher" title="Chat" aria-label={`Chat${inbox.unread ? `, ${inbox.unread} unread` : ''}`}>
    <WorkspaceIcon name="chat" />
    {inbox.unread > 0 && <span className="chat-count" aria-hidden="true">{inbox.unread > 99 ? '99+' : inbox.unread}</span>}
  </NavLink>
}
