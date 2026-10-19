import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { passwordProblem } from './validation'
import { supabase } from '../../lib/supabase'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { roleLabel } from '../team/team-utils'
export function JoinPage() {
  const account = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (accepted && account.profile && !account.invitation) navigate('/app', { replace: true }) }, [accepted, account.profile, account.invitation, navigate])
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    const problem = passwordProblem(password, String(form.get('confirm')))
    if (problem) { setError(problem); return }
    if (!account.invitation) return
    setBusy(true)
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password })
      if (passwordError) throw passwordError
      const { error: acceptanceError } = await supabase.rpc('accept_invitation', { p_id: account.invitation.invitation_id })
      if (acceptanceError) throw acceptanceError
      setAccepted(true); account.refresh()
    } catch { setError('Could not accept this invitation. It may have expired or been cancelled. Ask your HR Admin to resend it, then retry.') }
    finally { setBusy(false) }
  }
  return <main className="public-page auth-page"><Link className="wordmark" to="/">vimbre</Link><section className="auth-card glass-surface"><h1 tabIndex={-1}>{account.invitation ? `Join ${account.invitation.company_name}` : 'Your invitation'}</h1>
    {accepted && account.error ? <><p role="alert">Your invitation was accepted, but the workspace could not be loaded.</p><Button onClick={account.refresh}>Retry loading workspace</Button></> : account.loading || accepted ? <p role="status">Loading your workspace…</p> : !account.session ? <p>Open the email sign in link sent by your HR Admin. If it has expired, ask them to resend your invitation. <Link to="/login">Already joined? Log in</Link>.</p> : account.invitation ? <><p>{account.invitation.full_name}, you’re invited as {roleLabel(account.invitation.role)}{account.invitation.department_name ? ` in ${account.invitation.department_name}` : ''}.</p><p className="muted">Set your password to accept. This invitation expires {new Date(account.invitation.expires_at).toLocaleDateString()}.</p><form className="auth-form" onSubmit={accept}>
      <Input label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /><Input label="Confirm password" name="confirm" type="password" autoComplete="new-password" required maxLength={128} />
      {error && <p className="field-error" role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy ? 'Joining…' : 'Accept invitation'}</Button>
    </form></> : <p>No active invitation is available for this account. It may have expired or been cancelled. Contact your HR Admin, or <Link to="/app">open your workspace</Link>.</p>}
  </section></main>
}
