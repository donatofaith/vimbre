import { createContext,createElement,useContext,useEffect,useState } from 'react'
import type {ReactNode} from 'react'
import { supabase } from '../../lib/supabase'
export type MyDaySummary = { task_counts?: {today:number;overdue:number}; pending_drafts: number; completed_sections: string[]; forwarding_address: string | null }
export function parseMyDaySummary(value: unknown): MyDaySummary | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<MyDaySummary>
  if (!Number.isSafeInteger(row.pending_drafts) || row.pending_drafts! < 0 ||
    !Array.isArray(row.completed_sections) || !row.completed_sections.every(kind => typeof kind === 'string') ||
    !(row.forwarding_address === null || typeof row.forwarding_address === 'string' && /^[^\s@]+@[^\s@]+$/.test(row.forwarding_address))) return null
  if(row.task_counts&&(!Number.isSafeInteger(row.task_counts.today)||row.task_counts.today<0||!Number.isSafeInteger(row.task_counts.overdue)||row.task_counts.overdue<0))return null
  return row as MyDaySummary
}
type SummaryState={data:MyDaySummary|null;error:boolean;retry:()=>void}
const SummaryContext=createContext<(SummaryState&{owner:string})|null>(null)
export function MyDaySummaryProvider({owner,children}:{owner:string;children:ReactNode}){
 const state=useMyDaySummary(owner,0,Boolean(owner))
 return createElement(SummaryContext.Provider,{value:{...state,owner}},children)
}
export function useMyDaySummary(owner: string, revision: number, enabled: boolean):SummaryState {
  const inherited=useContext(SummaryContext)
  const shared=inherited?.owner===owner?inherited:null
  const hasShared=shared!==null
  const [result, setResult] = useState<{ owner: string; data: MyDaySummary | null; error: boolean } | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!enabled||hasShared) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('my_day_summary')
      const parsed = error ? null : parseMyDaySummary(data)
      if (!cancelled) setResult({ owner, data: parsed, error: Boolean(error) || !parsed })
    }
    void load()
    const onReturn = () => { if (!document.hidden) void load() }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('vimbre:work-changed',onReturn)
    const interval = setInterval(onReturn, 60000)
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onReturn); window.removeEventListener('vimbre:work-changed',onReturn) }
  }, [owner, revision, refresh, enabled, hasShared])
  if(shared)return shared
  return { data: result?.owner === owner ? result.data : null, error: result?.owner === owner && result.error, retry: () => setRefresh(value => value + 1) }
}

