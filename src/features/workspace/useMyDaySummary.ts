import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
export type MyDaySummary = { pending_drafts: number; completed_sections: string[]; forwarding_address: string | null }
export function parseMyDaySummary(value: unknown): MyDaySummary | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<MyDaySummary>
  if (!Number.isSafeInteger(row.pending_drafts) || row.pending_drafts! < 0 ||
    !Array.isArray(row.completed_sections) || !row.completed_sections.every(kind => typeof kind === 'string') ||
    !(row.forwarding_address === null || typeof row.forwarding_address === 'string' && /^[^\s@]+@[^\s@]+$/.test(row.forwarding_address))) return null
  return row as MyDaySummary
}
export function useMyDaySummary(owner: string, revision: number, enabled: boolean) {
  const [result, setResult] = useState<{ owner: string; data: MyDaySummary | null; error: boolean } | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!enabled) return
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
    const interval = setInterval(onReturn, 60000)
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onReturn) }
  }, [owner, revision, refresh, enabled])
  return { data: result?.owner === owner ? result.data : null, error: result?.owner === owner && result.error, retry: () => setRefresh(value => value + 1) }
}
