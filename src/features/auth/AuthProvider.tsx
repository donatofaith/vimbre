import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Outlet } from 'react-router-dom'
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
      if (event === 'SIGNED_OUT') { setRecovery(false); setResult(null) }
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    let cancelled = false
    if (!session) return
    async function load() {
      try {
        const { data: user, error: userError } = await supabase.auth.getUser()
        if (userError || !user.user?.email_confirmed_at || user.user.id !== session!.user.id) throw new Error('Please confirm your email and sign in again.')
        const { data: invites, error: invitationError } = await supabase.rpc('my_invitation')
        if (invitationError) throw new Error('Your invitation could not be checked. Please retry.')
        if (Array.isArray(invites) && invites[0]) {
          if (!cancelled) setResult({ profile: null, company: null, invitation: invites[0], error: '', userId: session!.user.id, revision })
          return
        }
        const { data: member, error: memberError } = await supabase.from('profiles').select('*').eq('id', user.user.id).single()
        if (memberError || !member?.active) throw new Error('Your workspace could not be loaded. Please retry or contact your company administrator.')
        const { data: workspace, error: companyError } = await supabase.from('companies').select('*').eq('id', member.company_id).single()
        if (companyError || !workspace) throw new Error('Your company could not be loaded. Please retry.')
        if (!cancelled) setResult({ profile: member, company: workspace, invitation: null, error: '', userId: session!.user.id, revision })
      } catch (reason) { if (!cancelled) setResult({ profile: null, company: null, invitation: null, error: reason instanceof Error ? reason.message : 'Could not load your workspace.', userId: session!.user.id, revision }) }
    }
    void load()
    return () => { cancelled = true }
  }, [session, revision])
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
  if (account.loading) return <main className="standalone" role="status">Loading your workspace…</main>
  if (!account.session) return <Navigate to="/login" replace />
  if (account.invitation) return <Navigate to="/join" replace />
  if (account.recovery) return <Navigate to="/reset-password" replace />
  if (account.error || !account.profile) return <main className="standalone"><h1 tabIndex={-1}>Workspace unavailable</h1><p role="alert">{account.error}</p><Button onClick={account.refresh}>Retry</Button> <Button variant="secondary" onClick={() => { void supabase.auth.signOut() }}>Sign out</Button></main>
  return <Outlet />
}
