export type WorkReminder = { notification_key: string; source_kind: 'task' | 'role_item'; source_id: string; title: string; due_date: string; stage: 'approaching' | 'today' | 'overdue'; section: string | null; read_at: string | null }
export type WorkInbox = { unread: number; count: number; items: WorkReminder[] }
export const emptyWorkInbox: WorkInbox = { unread: 0, count: 0, items: [] }
export function reminderLabel(reminder: WorkReminder) {
 if (reminder.stage === 'today') return 'Due today'
 if (reminder.stage === 'overdue') return 'Overdue'
 return 'Due soon'
}
export function reminderDate(value: string) {
 const [year, month, day] = value.split('-').map(Number)
 return new Intl.DateTimeFormat(undefined, {day:'numeric',month:'short',year:'numeric'}).format(new Date(year,month-1,day))
}
export function reminderPath(reminder: WorkReminder) {
 return reminder.source_kind==='task' ? `/app?task=${encodeURIComponent(reminder.source_id)}` : `/app/role-record?section=${encodeURIComponent(reminder.section??'responsibility')}&record=${encodeURIComponent(reminder.source_id)}`
}
export function parseWorkInbox(value: unknown): WorkInbox | null {
 if (!value || typeof value!=='object') return null
 const v=value as WorkInbox
 if (!Number.isSafeInteger(v.unread)||v.unread<0||!Number.isSafeInteger(v.count)||v.count<0||!Array.isArray(v.items)||!v.items.every(r=>r&&typeof r.notification_key==='string'&&['task','role_item'].includes(r.source_kind)&&typeof r.source_id==='string'&&typeof r.title==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.due_date)&&['approaching','today','overdue'].includes(r.stage)&&(r.read_at===null||typeof r.read_at==='string'))) return null
 return v
}
