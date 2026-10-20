export function actionError(reason: unknown) {
  const code = (reason as { code?: string })?.code
  if (code === '42501') return 'You can only change your own tasks. Your access may have changed; sign in again to check.'
  if (code === '23503' || code === '23514') return 'Check the required fields and web link. Choose an active decision from your own role.'
  return 'Could not save this change. Your draft is still here. Please try again.'
}

