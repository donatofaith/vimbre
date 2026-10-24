import { describe, expect, it } from 'vitest'
import { passwordProblem, authMessage } from './validation'
describe('account validation', () => {
  it('requires a sufficiently long, matching password', () => {
    expect(passwordProblem('short', 'short')).toContain('12')
    expect(passwordProblem('long-enough-password', 'different')).toContain('match')
    expect(passwordProblem('long-enough-password', 'long-enough-password')).toBe('')
    expect(passwordProblem('x'.repeat(129), 'x'.repeat(129))).toContain('128')
  })
  it('uses safe messages for credentials, limits and unknown server failures', () => {
    expect(authMessage('user_already_exists')).toContain('already exists');
    expect(authMessage('email_exists')).toContain('Log in');
    expect(authMessage('invalid_credentials')).toBe('The email or password is incorrect.')
    expect(authMessage('over_email_send_rate_limit')).toContain('wait')
    expect(authMessage('internal database details')).not.toContain('database')
  })
})
