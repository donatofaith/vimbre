import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import './ai.css'

type Allowance = { warning: boolean; blocked: boolean; period: 'day' | 'month'; daily_percent: number; monthly_percent: number; daily_reset_at: string; monthly_reset_at: string }
export function AIAllowanceNotice() {
  const { profile } = useAuth()
  const [notice, setNotice] = useState<Allowance | null>(null)
  useEffect(() => {
    setNotice(null)
    if (profile?.role !== 'hr_admin') return
    let disposed = false, pending = false
    async function refresh() {
      if (document.visibilityState === 'hidden' || pending) return
      pending = true
      try {
        const { data, error } = await supabase.rpc('ai_allowance_summary')
        if (disposed) return
        const value = data as unknown as Partial<Allowance> | null
        setNotice(!error && value?.warning === true && typeof value.blocked === 'boolean' && (value.period === 'day' || value.period === 'month') && typeof value.daily_percent === 'number' && typeof value.monthly_percent === 'number' && typeof value.daily_reset_at === 'string' && typeof value.monthly_reset_at === 'string' ? value as Allowance : null)
      } catch { if (!disposed) setNotice(null) }
      finally { pending = false }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60000)
    const onRefresh = () => { void refresh() }
    window.addEventListener('focus', onRefresh)
    window.addEventListener('vimbre:ai-usage', onRefresh)
    document.addEventListener('visibilitychange', onRefresh)
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', onRefresh); window.removeEventListener('vimbre:ai-usage', onRefresh); document.removeEventListener('visibilitychange', onRefresh) }
  }, [profile?.id, profile?.role, profile?.company_id])
  if (!notice || profile?.role !== 'hr_admin') return null
  const period = notice.period === 'day' ? 'daily' : 'monthly'
  const percent = Math.min(100, Math.floor(notice.period === 'day' ? notice.daily_percent : notice.monthly_percent))
  const reset = new Date(notice.period === 'day' ? notice.daily_reset_at : notice.monthly_reset_at)
  const resetText = Number.isFinite(reset.getTime()) ? new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(reset) + ' UTC' : 'the next allowance period'
  return <aside className="vai-allowance" aria-label="AI allowance" role="status">
    <div><strong>{notice.blocked ? 'Your company has reached its AI allowance.' : `Your company has used ${percent}% of its ${period} AI allowance.`}</strong><p>{notice.blocked ? `AI drafts are paused until ${resetText}. You can continue by hand.` : `The allowance resets ${resetText}.`}</p></div>
    <a className="button button-secondary" href="mailto:support@vimbre.com?subject=Vimbre%20AI%20allowance">Contact support</a>
  </aside>
}
