export const roles = ['hr_admin', 'manager', 'employee'] as const
export type Role = typeof roles[number]
export function roleLabel(role: string) {
  return role === 'hr_admin' ? 'HR Admin' : role === 'manager' ? 'Manager' : 'Employee'
}
export function safeSearch(value: string) { return value.trim().replace(/[%_\\]/g, '').slice(0, 120) }
export function invitationStatus(status: string, expiresAt: string) {
  return status === 'pending' && Date.parse(expiresAt) <= Date.now() ? 'expired' : status
}
export function teamError(message?: string) {
  const known = [
    'Keep at least one active HR Admin', 'Choose a department for this member',
    'Move members and cancel pending invitations before archiving this department',
    'Choose an active manager in this department or an HR Admin', 'This person must accept their invitation first',
  ]
  if (message && known.includes(message)) return message
  if (message?.includes('duplicate key')) return 'That name is already in use. Choose another name.'
  return 'Could not save this change. Check your details and access, then retry.'
}
