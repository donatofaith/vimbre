import {clearDevicePush} from '../my-day/device-push'
import {setOfflineOwner,clearOfflineAccount,offlineOwner} from '../my-day/offline'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { Button } from '../../components/ui/Button'
type Profile = Database['public']['Tables']['profiles']['Row']
type Company = Database['public']['Tables']['companies']['Row']
export type InvitationDetails = Database['public']['Functions']['my_invitation']['Returns'][number]
type Account = { session: Session | null; invitation: InvitationDetails | null; profile: Profile | null; company: Company | null; loading: boolean; error: string; recovery: boolean; finishRecovery: () => void; refresh: () => void }
const Context = createContext<Account | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [result, setResult] = useState<{ profile: Profile | null; company: Company | null; invitation: InvitationDetails | null; error: string; userId: string; revision: number } | null>(null)
  const [recovery, setRecovery] = useState(false)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(n => n + 1), [])
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, value) => {
      setSession(value); setInitializing(false)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if(value?.user.id)setOfflineOwner(value.user.id)
      if (event === 'SIGNED_OUT') { void clearDevicePush(); clearOfflineAccount(offlineOwner()); setRecovery(false); setResult(null) }
    })
    return () => subscription.unsubscribe()
  }, [])
  const userId=session?.user.id
  useEffect(() => {
    let cancelled = false
    if (!userId) return
    const accountId=userId
    async function load() {
      try {
        if(!navigator.onLine){const cached=JSON.parse(localStorage.getItem('vimbre:offline:identity:'+accountId)??'null');if(cached?.profile?.id===accountId&&cached.profile.active&&cached.company?.id===cached.profile.company_id&&Date.now()-cached.at<72*3600000){if(!cancelled)setResult({profile:cached.profile,company:cached.company,invitation:null,error:'',userId:accountId,revision});return}throw Error('Open your workspace while connected before using it offline.')}
        const { data: user, error: userError } = await supabase.auth.getUser()
        if (userError || !user.user?.email_confirmed_at || user.user.id !== accountId) throw new Error('Please confirm your email and sign in again.')
        // These checks are independent; avoid an extra network round trip at entry.
        const [invitationResult, memberResult] = await Promise.all([
          supabase.rpc('my_invitation'),
          supabase.from('profiles').select('*').eq('id', user.user.id).single(),
        ])
        const { data: invites, error: invitationError } = invitationResult
        if (invitationError) throw new Error('Your invitation could not be checked. Please retry.')
        if (Array.isArray(invites) && invites[0]) {
          if (!cancelled) setResult({ profile: null, company: null, invitation: invites[0], error: '', userId: accountId, revision })
          return
        }
        const { data: member, error: memberError } = memberResult
        if (memberError || !member?.active) throw new Error('Your workspace could not be loaded. Please retry or contact your company administrator.')
        const { data: workspace, error: companyError } = await supabase.from('companies').select('*').eq('id', member.company_id).single()
        if (companyError || !workspace) throw new Error('Your company could not be loaded. Please retry.')
        try{localStorage.setItem('vimbre:offline:identity:'+accountId,JSON.stringify({profile:member,company:workspace,at:Date.now()}))}catch{}
        if (!cancelled) setResult({ profile: member, company: workspace, invitation: null, error: '', userId: accountId, revision })
      } catch (reason) { if (!cancelled) setResult({ profile: null, company: null, invitation: null, error: reason instanceof Error ? reason.message : 'Could not load your workspace.', userId: accountId, revision }) }
    }
    void load()
    return () => { cancelled = true }
  // Token refresh changes the Session object without changing the account.
  // Server operations still verify membership; do not reload identity on every refresh.
  }, [userId, revision])
  const current = session && result?.userId === session.user.id ? result : null
  return <Context.Provider value={{ session, invitation: current?.invitation ?? null, profile: current?.profile ?? null, company: current?.company ?? null, loading: initializing || Boolean(session && !current), error: current?.error ?? '', recovery, finishRecovery: () => setRecovery(false), refresh }}>{children}</Context.Provider>
}
// oxlint-disable-next-line react/only-export-components -- This hook reads the provider context.
export function useAuth() {
  const value = useContext(Context)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
export function RequireAuth() {
  const account = useAuth()
  const location = useLocation()
  if (account.loading) return <main className="standalone" role="status">Loading your workspace…</main>
  if (!account.session) return <Navigate to="/login" replace state={{myDayTask:location.pathname==='/app'?location.search:undefined}} />
  if(!navigator.onLine&&location.pathname!=='/app')return <Navigate to="/app" replace/>
  if (account.invitation) return <Navigate to="/join" replace />
  if (account.recovery) return <Navigate to="/reset-password" replace />
  if (account.error || !account.profile) return <main className="standalone"><h1 tabIndex={-1}>Workspace unavailable</h1><p role="alert">{account.error}</p><Button onClick={account.refresh}>Retry</Button> <Button variant="secondary" onClick={() => { void supabase.auth.signOut() }}>Sign out</Button></main>
  return <Outlet />
}

