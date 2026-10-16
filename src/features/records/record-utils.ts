export const itemKinds = [
  ['responsibility', 'Responsibilities'], ['workstream', 'Workstreams'], ['external_contact', 'External contacts'],
  ['document', 'Documents'], ['recurring_deadline', 'Recurring deadlines'],
] as const
export type ItemKind = typeof itemKinds[number][0]
export function safeRecordUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
export function recordError(reason: unknown) {
  const code = (reason as { code?: string })?.code
  if (code === '42501') return 'You can only change your own role record. Please sign in again if your access has changed.'
  if (code === '23503') return 'That workstream is no longer available for this role. Reload and choose again.'
  if (code === '23514' || code === '22023') return 'Check the required fields and links. Only web links without login details are allowed. Choose an active workstream.'
  return 'Could not save this change. Your draft is still here. Please try again.'
}
export function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
