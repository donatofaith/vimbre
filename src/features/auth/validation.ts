export function passwordProblem(password: string, confirmation: string) {
  if (password.length < 12 || password.length > 128) return 'Use a password between 12 and 128 characters.'
  if (password !== confirmation) return 'Your passwords do not match.'
  return ''
}
export function isSignupDuplicate(code?: string) {
  return code === 'user_already_exists' || code === 'email_exists'
}

export function authMessage(code?: string) {
  if (code === 'captcha_failed') return 'Complete the security check and try again.'
  if (code === 'invalid_credentials') return 'The email or password is incorrect.'
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in.'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Too many attempts. Please wait a few minutes and try again.'
  return 'We could not complete that request. Check your details and connection, then try again.'
}
