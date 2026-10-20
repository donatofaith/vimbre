import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from './AuthProvider'
import { authMessage, passwordProblem } from './validation'
import { BrandLogo } from '../../components/ui/BrandLogo'
import './account.css'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'

const titles: Record<Mode, string> = {
  login: 'Welcome back',
  signup: 'Create your company',
  forgot: 'Forgot your password?',
  reset: 'Choose a new password',
}

function AccountLayout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className="v-auth">
      <header className="v-auth-header">
        <Link
          className="v-auth-brand"
          to="/"
          aria-label="Vimbre home"
        >
          <BrandLogo />
        </Link>

        <Link to="/">← Back to website</Link>
      </header>

      <div className="v-auth-grid">
        <aside className="v-auth-story" aria-label="About Vimbre">
          <span className="v-auth-eyebrow">
            The record your other tools miss
          </span>

          <h2>
            Good work leaves
            <br />
            a clear <span>record.</span>
          </h2>

          <p>
            Keep decisions, role knowledge and handovers in one place.
          </p>

          <div className="v-auth-record">
            <small>THE CONTEXT BEHIND THE WORK</small>
            <strong>A clear starting point.</strong>

            {[
              'What was decided',
              'Why it matters',
              'What comes next',
            ].map((text, index) => (
              <div key={text}>
                <span>0{index + 1}</span>
                <p>{text}</p>
                <span aria-hidden="true">↗</span>
              </div>
            ))}
          </div>

          <p className="v-auth-caption">
            Works next to the tools you already use.
          </p>
        </aside>

        <section
          className="v-auth-panel auth-card"
          aria-labelledby="v-auth-title"
        >
          <span className="v-auth-eyebrow">
            Your company workspace
          </span>

          <h1 id="v-auth-title" tabIndex={-1}>
            {title}
          </h1>

          {children}
        </section>
      </div>

      <footer className="v-auth-footer">© 2026 Vimbre.</footer>
    </main>
  )
}

export function AuthPage({ mode }: { mode: Mode }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [clock, setClock] = useState(Date.now)

  const account = useAuth()
  const navigate = useNavigate()

  const resendSeconds = Math.max(
    0,
    Math.ceil((resendAt - clock) / 1000),
  )

  useEffect(() => {
    if (!resendAt) return

    const tick = () => {
      const now = Date.now()
      setClock(now)

      if (now >= resendAt) {
        window.clearInterval(timer)
      }
    }

    const timer = window.setInterval(tick, 1000)

    document.addEventListener('visibilitychange', tick)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [resendAt])

  function startCooldown() {
    const now = Date.now()
    setClock(now)
    setResendAt(now + 60000)
  }

  async function resend() {
    if (busy || resendSeconds > 0) return

    setBusy(true)
    setError('')
    startCooldown()

    try {
      const { error: failure } = await supabase.auth.resend({
        type: 'signup',
        email: signupEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (failure) throw failure

      setMessage(
        'If your email still needs confirmation, a new link has been requested. Check your inbox and spam folder. If you already opened a confirmation link, your email may be confirmed—try logging in.',
      )
    } catch (reason) {
      setError(authMessage((reason as { code?: string }).code))
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (mode === 'signup' || mode === 'reset') {
      const problem = passwordProblem(
        password,
        String(form.get('confirm')),
      )

      if (problem) {
        setError(problem)
        return
      }
    }

    setBusy(true)

    try {
      if (mode === 'signup') {
        const company = String(form.get('company')).trim()
        const name = String(form.get('name')).trim()

        if (!company || !name) {
          setError('Enter your name and company name.')
          return
        }

        const result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              company_name: company,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (result.error) throw result.error

        setSignupEmail(email)
        startCooldown()

        setMessage(
          'Check your inbox for a confirmation link. After confirming your email, you can access your company. If you already have an account, try signing in or resetting your password.',
        )
      } else if (mode === 'login') {
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (result.error) throw result.error

        navigate('/app', { replace: true })
      } else if (mode === 'forgot') {
        const result = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/auth/callback?flow=recovery`,
          },
        )

        if (result.error) throw result.error

        setMessage(
          'If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder, then open the link in this browser.',
        )
      } else {
        const { data, error: userError } =
          await supabase.auth.getUser()

        if (userError || !data.user) {
          setError('This reset link has expired. Request a new one.')
          return
        }

        const result = await supabase.auth.updateUser({ password })

        if (result.error) throw result.error

        account.finishRecovery()
        await supabase.auth.signOut()

        setMessage(
          'Password updated. Sign in with your new password.',
        )
      }
    } catch (reason) {
      setError(authMessage((reason as { code?: string }).code))
    } finally {
      setBusy(false)
    }
  }

  const needsSession = mode === 'reset' && !account.session

  return (
    <AccountLayout title={titles[mode]}>
      {!message && (
        <p className="v-auth-description">
          {mode === 'signup'
            ? 'Create your account and company workspace. You’ll be its HR Admin.'
            : mode === 'login'
              ? 'Sign in to your company workspace.'
              : mode === 'forgot'
                ? 'Enter your work email to request a password reset link.'
                : 'Choose a unique password for your account.'}
        </p>
      )}

      {mode === 'reset' && account.loading ? (
        <p role="status">Checking your reset link…</p>
      ) : needsSession && !message ? (
        <div className="v-auth-notice">
          <p>This link is missing or expired.</p>
          <Link to="/forgot">Request a new reset link</Link>
        </div>
      ) : message ? (
        <div className="v-auth-result">
          <span
            className="v-auth-result-icon"
            aria-hidden="true"
          >
            ✓
          </span>

          <h2>
            {mode === 'reset'
              ? 'Password updated'
              : 'Check your inbox'}
          </h2>

          <p role="status">{message}</p>

          {mode === 'signup' && (
            <>
              <p className="v-auth-recipient">
                Requested for <strong>{signupEmail}</strong>
              </p>

              <Button
                variant="secondary"
                disabled={busy || resendSeconds > 0}
                onClick={() => {
                  void resend()
                }}
              >
                {busy
                  ? 'Requesting confirmation…'
                  : resendSeconds > 0
                    ? `Resend in ${Math.floor(resendSeconds / 60)}:${String(
                        resendSeconds % 60,
                      ).padStart(2, '0')}`
                    : 'Resend confirmation'}
              </Button>
            </>
          )}

          <Link to="/login">Go to login →</Link>

          {error && (
            <p className="v-auth-error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="v-auth-form"
          aria-busy={busy}
        >
          <fieldset disabled={busy} className="v-auth-fields">
            {mode === 'signup' && (
              <>
                <Input
                  label="Full name"
                  name="name"
                  autoComplete="name"
                  placeholder="e.g. Jordan Smith"
                  required
                  maxLength={100}
                />

                <Input
                  label="Company name"
                  name="company"
                  autoComplete="organization"
                  placeholder="e.g. Acme Operations"
                  required
                  maxLength={120}
                />
              </>
            )}

            {mode !== 'reset' && (
              <Input
                label="Work email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
                maxLength={320}
              />
            )}

            {mode !== 'forgot' && (
              <Input
                label={
                  mode === 'reset' ? 'New password' : 'Password'
                }
                name="password"
                type="password"
                autoComplete={
                  mode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
                required
                minLength={mode === 'login' ? 1 : 12}
                maxLength={128}
              />
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <>
                <p className="v-auth-help">
                  Use 12 to 128 characters. Choose a unique password.
                </p>

                <Input
                  label="Confirm password"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                />
              </>
            )}
          </fieldset>

          {mode === 'login' && (
            <Link className="v-auth-forgot" to="/forgot">
              Forgot password?
            </Link>
          )}

          {mode === 'signup' && (
            <p className="v-auth-help">
              Joining an existing team? Use the invitation from
              your company administrator.
            </p>
          )}

          {error && (
            <p className="v-auth-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create company'
                : mode === 'login'
                  ? 'Log in'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Update password'}
          </Button>
        </form>
      )}

      <nav className="v-auth-links" aria-label="Account help">
        {mode === 'login' ? (
          <>
            <span>New to Vimbre?</span>
            <Link to="/signup">Create a company</Link>
          </>
        ) : (
          <Link to="/login">Back to login</Link>
        )}
      </nav>
    </AccountLayout>
  )
}

export function AuthCallback() {
  const account = useAuth()
  const navigate = useNavigate()
  const [expired, setExpired] = useState(false)

  const recovery =
    new URLSearchParams(window.location.search).get('flow') ===
    'recovery'

  const linkError =
    new URLSearchParams(window.location.hash.slice(1)).has(
      'error',
    ) ||
    new URLSearchParams(window.location.search).has('error')

  useEffect(() => {
    if (linkError) return

    if (account.session) {
      navigate(
        recovery || account.recovery
          ? '/reset-password'
          : '/app',
        { replace: true },
      )
    }

    const timer = window.setTimeout(
      () => setExpired(true),
      12000,
    )

    return () => window.clearTimeout(timer)
  }, [
    account.session,
    account.recovery,
    navigate,
    recovery,
    linkError,
  ])

  return (
    <AccountLayout
      title={
        linkError || expired
          ? 'Link unavailable'
          : 'Confirming your account…'
      }
    >
      {linkError || expired ? (
        <div className="v-auth-notice">
          <p>
            The link may have expired, already been used or been
            opened in a different browser.
          </p>

          <Link to={recovery ? '/forgot' : '/login'}>
            Try again
          </Link>
        </div>
      ) : (
        <p role="status">
          Please wait while we verify your link.
        </p>
      )}
    </AccountLayout>
  )
}