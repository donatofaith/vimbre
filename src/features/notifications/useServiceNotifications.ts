import {subscribeWorkspaceRefresh} from '../workspace/workspace-refresh'
import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../auth/AuthProvider'

type Notice = {id:string;title:string;body:string;link:string;kind:string;read_at:string|null}
const serviceNoticesChanged = 'vimbre:service-notices-changed'

async function listNotices() {
  const {data,error} = await supabase.rpc('console_customer_notices',{p_action:'list'})
  const result = data as unknown as {ok?:boolean;data?:{items:Notice[];unread:number}}
  if (error || !result?.ok || !Array.isArray(result.data?.items)) throw new Error('Updates could not be loaded.')
  return result.data
}

async function readNotice(id: string) {
  const {data,error} = await supabase.rpc('console_customer_notices',{p_action:'read',p_id:id})
  return !error && Boolean((data as unknown as {ok?:boolean})?.ok)
}

// Snapshot unread IDs before fetching the ticket so a reply arriving later stays unread.
export async function pendingSupportNoticeIds(ticket: string) {
  try {
    const {items} = await listNotices()
    return items.filter(notice => !notice.read_at && notice.kind === 'support' &&
      notice.link === '/app/help?ticket=' + ticket).map(notice => notice.id)
  } catch {
    return []
  }
}

export async function readSupportNotices(ids: string[]) {
  if (!ids.length) return
  const results = await Promise.allSettled(ids.map(readNotice))
  if (results.some(result => result.status === 'fulfilled' && result.value)) {
    window.dispatchEvent(new Event(serviceNoticesChanged))
  }
}

export function useServiceNotifications() {
  const {profile} = useAuth()
  const [rows,setRows] = useState<Notice[]>([])
  const [unread,setUnread] = useState(0)
  const [error,setError] = useState(false)
  const [revision,setRevision] = useState(0)

  useEffect(() => {
    let live = true
    let request = 0
    async function load() {
      if (document.hidden || !profile?.id) return
      const current = ++request
      try {
        const data = await listNotices()
        if (!live || current !== request) return
        setRows(data.items.filter(notice => !notice.read_at && typeof notice.link === 'string' &&
          notice.link.startsWith('/app/') && !notice.link.includes('\\')))
        setUnread(data.unread || 0)
        setError(false)
      } catch {
        if (live && current === request) setError(true)
      }
    }
    void load()
    const unsubscribe = subscribeWorkspaceRefresh(load)
    window.addEventListener(serviceNoticesChanged,load)
    return () => { live=false; unsubscribe(); window.removeEventListener(serviceNoticesChanged,load) }
  },[profile?.id,revision])

  async function read(id: string) {
    if (await readNotice(id).catch(() => false)) {
      setRows(current => current.filter(notice => notice.id !== id))
      setRevision(current => current + 1)
    } else setError(true)
  }
  return {rows,unread,error,read,refresh:()=>setRevision(current=>current+1)}
}
