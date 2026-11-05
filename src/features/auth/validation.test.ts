import { describe, expect, it } from 'vitest'
import { passwordProblem, authMessage, isSignupDuplicate } from './validation'
describe('account validation', () => {
  it('requires a sufficiently long, matching password', () => {
    expect(passwordProblem('short', 'short')).toContain('12')
    expect(passwordProblem('long-enough-password', 'different')).toContain('match')
    expect(passwordProblem('long-enough-password', 'long-enough-password')).toBe('')
    expect(passwordProblem('x'.repeat(129), 'x'.repeat(129))).toContain('128')
  })
  it('identifies duplicate signup responses without swallowing rate limits', () => {
    expect(isSignupDuplicate('user_already_exists')).toBe(true)
    expect(isSignupDuplicate('email_exists')).toBe(true)
    expect(isSignupDuplicate('over_request_rate_limit')).toBe(false)
    expect(authMessage('user_already_exists')).not.toContain('already exists')
  })
  it('uses safe messages for credentials, limits and unknown server failures', () => {
    expect(authMessage('captcha_failed')).toContain('security check')
    expect(authMessage('invalid_credentials')).toBe('The email or password is incorrect.')
    expect(authMessage('over_email_send_rate_limit')).toContain('wait')
    expect(authMessage('internal database details')).not.toContain('database')
  })
})
