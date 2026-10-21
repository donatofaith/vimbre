export const itemKinds = [
  ['responsibility', 'Responsibilities'], ['workstream', 'Open work'], ['external_contact', 'External contacts'],
  ['document', 'Documents'], ['recurring_deadline', 'Recurring deadlines'],
] as const
export type ItemKind = typeof itemKinds[number][0]
export function safeRecordUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
export function recordError(reason: unknown) {
  const code = (reason as { code?: string })?.code
  if (code === '42501') return 'You do not have access to change this record. Reload if your role has changed.'
  if (code === '23503') return 'That linked record or backup person is no longer available. Reload and choose again.'
  if (code === '23514' || code === '22023') return 'Check the required fields, dates and links, then try again.'
  return 'Could not save this change. Your draft is still here. Please try again.'
}
export function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}


export function formatRecordDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(date)
}

export const addLabels = { responsibility: 'Add responsibility', workstream: 'Add open work', external_contact: 'Add external contact', document: 'Add document', recurring_deadline: 'Add deadline', decision: 'Log a decision' }
