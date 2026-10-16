import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from './AuthProvider'
import { authMessage, passwordProblem } from './validation'
type Mode = 'login' | 'signup' | 'forgot' | 'reset'
const titles: Record<Mode, string> = { login: 'Welcome back', signup: 'Create your company', forgot: 'Forgot your password?', reset: 'Choose a new password' }
export function AuthPage({ mode }: { mode: Mode }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [clock, setClock] = useState(Date.now)
  const resendSeconds = Math.max(0, Math.ceil((resendAt - clock) / 1000))
  const account = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!resendAt) return
    const tick = () => {
      const now = Date.now()
      setClock(now)
      if (now >= resendAt) window.clearInterval(timer)
    }
    const timer = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [resendAt])
  function startCooldown() {
    const now = Date.now()
    setClock(now); setResendAt(now + 60000)
  }
  async function resend() {
    if (busy || resendSeconds > 0) return
    setBusy(true); setError(''); startCooldown()
    try {
      const { error: failure } = await supabase.auth.resend({ type: 'signup', email: signupEmail, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (failure) throw failure
      setMessage('If your email still needs confirmation, a new link has been requested. Check your inbox and spam folder. If you already opened a confirmation link, your email may be confirmed—try logging in.')
    } catch (reason) { setError(authMessage((reason as { code?: string }).code)) }
    finally { setBusy(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    if (mode === 'signup' || mode === 'reset') {
      const problem = passwordProblem(password, String(form.get('confirm')))
      if (problem) { setError(problem); return }
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const company = String(form.get('company')).trim(), name = String(form.get('name')).trim()
        if (!company || !name) { setError('Enter your name and company name.'); return }
        const result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, company_name: company }, emailRedirectTo: `${window.location.origin}/auth/callback` } })
        if (result.error) throw result.error
        setSignupEmail(email); startCooldown()
        setMessage('Check your inbox for a confirmation link. After confirming your email, you can access your company. If you already have an account, try signing in or resetting your password.')
      } else if (mode === 'login') {
        const result = await supabase.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        navigate('/app', { replace: true })
      } else if (mode === 'forgot') {
        const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?flow=recovery` })
        if (result.error) throw result.error
        setMessage('If an account exists for this email, you will receive a password reset link. Open it in this browser.')
      } else {
        const { data, error: userError } = await supabase.auth.getUser()
        if (userError || !data.user) { setError('This reset link has expired. Request a new one.'); return }
        const result = await supabase.auth.updateUser({ password })
        if (result.error) throw result.error
        account.finishRecovery()
        await supabase.auth.signOut()
        setMessage('Password updated. Sign in with your new password.')
      }
    } catch (reason) { setError(authMessage((reason as { code?: string }).code)) }
    finally { setBusy(false) }
  }
  const needsSession = mode === 'reset' && !account.session
  return <main className="public-page auth-page"><div className="ambient ambient-one" aria-hidden="true" /><Link className="wordmark" to="/">vimbre</Link><section className="auth-card glass-surface"><span className="eyebrow">Your team’s shared memory</span><h1 tabIndex={-1}>{titles[mode]}</h1>{mode === 'signup' && <p>Start a company workspace. You’ll be its HR Admin.</p>}{mode === 'reset' && account.loading ? <p role="status">Checking your reset link…</p> : needsSession && !message ? <p>This link is missing or expired. <Link to="/forgot">Request a new reset link</Link>.</p> : message ? <div><p role="status">{message}</p><Link to="/login">Go to login</Link>{mode === 'signup' && <><p className="muted">Already clicked a confirmation link? Try logging in, even if its redirect failed.</p><Button variant="secondary" disabled={busy || resendSeconds > 0} onClick={() => { void resend() }}>{busy ? 'Requesting confirmation…' : resendSeconds > 0 ? `Resend in ${Math.floor(resendSeconds / 60)}:${String(resendSeconds % 60).padStart(2, '0')}` : 'Resend confirmation'}</Button>{error && <p role="alert" className="field-error">{error}</p>}</>}</div> : <form onSubmit={submit} className="auth-form">
      {mode === 'signup' && <><Input label="Full name" name="name" autoComplete="name" required maxLength={100} /><Input label="Company name" name="company" autoComplete="organization" required maxLength={120} /></>}
      {mode !== 'reset' && <Input label="Work email" name="email" type="email" autoComplete="email" required maxLength={320} />}
      {mode !== 'forgot' && <Input label={mode === 'reset' ? 'New password' : 'Password'} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 12} maxLength={128} />}
      {(mode === 'signup' || mode === 'reset') && <><p className="muted">Use at least 12 characters.</p><Input label="Confirm password" name="confirm" type="password" autoComplete="new-password" required maxLength={128} /></>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create company' : mode === 'login' ? 'Log in' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</Button>
    </form>}
    <nav className="auth-links" aria-label="Account help">{mode === 'login' ? <><Link to="/forgot">Forgot password?</Link><Link to="/signup">Create a company</Link></> : <Link to="/login">Back to login</Link>}</nav></section></main>
}
export function AuthCallback() {
  const account = useAuth()
  const navigate = useNavigate()
  const [expired, setExpired] = useState(false)
  const recovery = new URLSearchParams(window.location.search).get('flow') === 'recovery'
  const linkError = new URLSearchParams(window.location.hash.slice(1)).has('error') || new URLSearchParams(window.location.search).has('error')
  useEffect(() => {
    if (account.session) navigate(recovery || account.recovery ? '/reset-password' : '/app', { replace: true })
    const timer = window.setTimeout(() => setExpired(true), 12000)
    return () => window.clearTimeout(timer)
  }, [account.session, account.recovery, navigate, recovery])
  return <main className="standalone"><h1 tabIndex={-1}>{linkError || expired ? 'Link unavailable' : 'Confirming your account…'}</h1>{linkError || expired ? <p>The link may have expired or been opened in a different browser. <Link to={recovery ? '/forgot' : '/login'}>Try again</Link>.</p> : <p role="status">Please wait while we check your link.</p>}</main>
}
