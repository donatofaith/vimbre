export type ChatPerson = {
  id: string
  full_name: string
  role?: string
  active?: boolean
  last_read_seq?: number
  joined_at?: string
}
export type Conversation = {
  id: string
  kind: 'direct' | 'group'
  title: string
  preview: string | null
  updated_at: string
  unread: number
}
export type Message = {
  id: string
  seq: number
  sender_id: string
  sender_name: string
  body: string
  reply_to: string | null
  reply: { id: string; body: string; sender_name: string } | null
  mentions: string[]
  mention_names: { id: string; name: string }[]
  record_path: string | null
  created_at: string
}
export type ChatDetail = {
  messages: Message[]
  members: ChatPerson[]
  kind: 'direct' | 'group'
  title: string
}
export type ChatNotification = {
  id: number
  conversation_id: string
  message_id: string
  mentioned: boolean
  created_at: string
  sender_name: string
  preview: string
  title: string
}
export type ChatInbox = {
  unread: number
  mentions: number
  items: ChatNotification[]
}
export const emptyInbox: ChatInbox = { unread: 0, mentions: 0, items: [] }
export function recordPath(value: string): string | null {
  try {
    const url = new URL(value, 'https://vimbre.com')
    if (
      url.origin !== 'https://vimbre.com' &&
      url.origin !== 'https://vimbre.co.uk' &&
      url.origin !== 'https://vimbre.vercel.app' &&
      (typeof location === 'undefined' || url.origin !== location.origin)
    )
      return null
    const path = url.pathname + url.search
    return /^\/app\/(role-record|team-activity|handovers|my-cover-duties)(\?|$)/.test(
      path,
    ) && path.length <= 500
      ? path
      : null
  } catch {
    return null
  }
}
export function mergeMessages(older: Message[], newer: Message[]): Message[] {
  return [...new Map([...older, ...newer].map((m) => [m.id, m])).values()].sort(
    (a, b) => a.seq - b.seq,
  )
}
export function chatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function messageReceipt(message:Message,members:ChatPerson[]):string{
 const peers=members.filter(p=>p.id!==message.sender_id&&p.active!==false&&(!p.joined_at||Date.parse(p.joined_at)<=Date.parse(message.created_at)))
 if(!peers.length||peers.some(p=>typeof p.last_read_seq!=='number'))return 'Sent'
 const read=peers.filter(p=>p.last_read_seq!>=message.seq).length
 return read===peers.length?'Read':read>0?`Read by ${read} of ${peers.length}`:'Sent · Unread'
}
