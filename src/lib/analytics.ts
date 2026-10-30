/** Analytics receives categories only. IDs are local deduplication keys, never payload fields. */
export const GA4_ID = 'G-E599PM5PBE'
export const GTM_ID = 'GTM-KTXM87CG'
export type AnalyticsConsent = 'accepted' | 'declined' | null
export type SourceType = 'manual' | 'ai' | 'capture' | 'role' | 'template' | 'assignment' | 'import' | 'cover' | 'plan' | 'offline_sync' | 'text' | 'document' | 'tasks' | 'handover' | 'gmail' | 'drive' | 'outlook' | 'teams' | 'slack' | 'trello'
export type ContextType = 'role_summary' | 'day_plan' | 'day_briefing' | 'conversation_summary' | 'capture_extract' | 'tidy_text' | 'weekly_summary' | 'handover_draft' | 'handover_return' | 'role_responsibility' | 'role_workstream' | 'role_external_contact' | 'role_document' | 'role_recurring_deadline' | 'role_decision' | 'tasks_extract' | 'task_context'
type Events = {
  sign_up: {method: 'password'}
  login: {method: 'password'}
  integration_connected: {source_type: Extract<SourceType, 'gmail' | 'drive' | 'outlook' | 'teams' | 'slack' | 'trello'>}
  context_generated: {source_type: SourceType; context_type: ContextType}
  action_created: {source_type: SourceType; action_type: 'task'; action_count: number}
  action_completed: {source_type: SourceType; action_type: 'task'}
  handover_created: {source_type: 'manual'; context_type: 'leave' | 'exit' | 'sudden'}
}
declare global {
  interface Window {
    dataLayer?: unknown[]
    vimbreAnalytics?: {readonly consent: AnalyticsConsent; choose: (choice: Exclude<AnalyticsConsent, null>) => void}
  }
}
const sources = new Set<unknown>(['manual','ai','capture','role','template','assignment','import','cover','plan','offline_sync','text','document','tasks','handover','gmail','drive','outlook','teams','slack','trello'])
const contexts = new Set<unknown>(['role_summary','day_plan','day_briefing','conversation_summary','capture_extract','tidy_text','weekly_summary','handover_draft','handover_return','role_responsibility','role_workstream','role_external_contact','role_document','role_recurring_deadline','role_decision','tasks_extract','task_context'])
const tools = new Set<unknown>(['gmail','drive','outlook','teams','slack','trello'])
const seen = new Set<string>()
const dedupeStorage = 'vimbre:analytics-seen:v1'
export function analyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null
  try {
    if (window.vimbreAnalytics) return window.vimbreAnalytics.consent
    const value = window.localStorage.getItem('vimbre:analytics-consent:v1')
    return value === 'accepted' || value === 'declined' ? value : null
  } catch { return null }
}
function push(payload: Record<string, unknown>): boolean {
  if (typeof window === 'undefined' || analyticsConsent() !== 'accepted') return false
  try { (window.dataLayer ??= []).push(payload); return true } catch { return false }
}
function alreadySent(key: string): boolean {
  if (seen.has(key)) return true
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(dedupeStorage) ?? '[]')
    if (Array.isArray(stored) && stored.includes(key)) return true
  } catch { /* In-memory deduplication still works when storage is blocked. */ }
  return false
}
function remember(key: string) {
  seen.add(key)
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(dedupeStorage) ?? '[]')
    const keys = Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : []
    window.sessionStorage.setItem(dedupeStorage, JSON.stringify([...keys, key].slice(-2000)))
  } catch { /* Tracking never blocks product functionality. */ }
}
/** Call at a successful operation boundary, with a stable local key for retries. */
export function trackEvent<E extends keyof Events>(event: E, params: Events[E], dedupeKey: string): boolean {
  if (typeof window === 'undefined' || analyticsConsent() !== 'accepted' || typeof dedupeKey !== 'string' || !dedupeKey) return false
  const p = params as Record<string, unknown>
  const payload: Record<string, unknown> = {event, success: true}
  // Rebuild from an allowlist even if an untyped caller passes extra fields.
  if (event === 'sign_up' || event === 'login') {
    if (p.method !== 'password') return false
    payload.method = 'password'
  } else if (event === 'integration_connected') {
    if (!tools.has(p.source_type)) return false
    payload.source_type = p.source_type
  } else if (event === 'context_generated') {
    if (!contexts.has(p.context_type) || !sources.has(p.source_type)) return false
    payload.context_type = p.context_type; payload.source_type = p.source_type
  } else if (event === 'action_created' || event === 'action_completed') {
    if (!sources.has(p.source_type) || p.action_type !== 'task') return false
    payload.source_type = p.source_type; payload.action_type = 'task'
    if (event === 'action_created') {
      if (!Number.isInteger(p.action_count) || Number(p.action_count) < 1 || Number(p.action_count) > 10000) return false
      payload.action_count = p.action_count
    }
  } else if (event === 'handover_created') {
    if (p.source_type !== 'manual' || typeof p.context_type !== 'string' || !['leave','exit','sudden'].includes(p.context_type)) return false
    payload.source_type = 'manual'; payload.context_type = p.context_type
  } else return false
  const key = `${event}:${dedupeKey}`
  if (alreadySent(key) || !push(payload)) return false
  remember(key)
  return true
}
export function trackTaskCreated(id: unknown, source_type: SourceType) {
  if (typeof id === 'string' && id) trackEvent('action_created', {source_type, action_type: 'task', action_count: 1}, id)
}
export function trackAccountCreated(user: {id: string; identities?: unknown[]} | null) {
  // Existing-email signup responses can be deliberately obfuscated by Supabase.
  if (user?.identities?.length) trackEvent('sign_up', {method: 'password'}, user.id)
}
export function trackLogin(session: {user: {id: string}; expires_at?: number} | null) {
  if (session) trackEvent('login', {method: 'password'}, `${session.user.id}:${session.expires_at ?? 'current'}`)
}
export function trackTaskCompleted(id: unknown, source_type: SourceType) {
  if (typeof id === 'string' && id) trackEvent('action_completed', {source_type, action_type: 'task'}, id)
}
export function trackContextGenerated(context_type: ContextType, requestId: string, source_type: SourceType) {
  trackEvent('context_generated', {context_type, source_type}, requestId)
}
export function integrationProvider(value: unknown): Events['integration_connected']['source_type'] | null {
  return tools.has(value) ? value as Events['integration_connected']['source_type'] : null
}
export function rememberIntegrationStart(state: unknown, provider: unknown) {
  if (typeof window === 'undefined' || analyticsConsent() !== 'accepted' || typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) || !integrationProvider(provider)) return
  try { window.sessionStorage.setItem('vimbre:tool-connect-analytics', JSON.stringify({state, provider})) } catch { /* OAuth works even when analytics storage is blocked. */ }
}
export function trackConnectedIntegration(state: string) {
  if (typeof window === 'undefined') return
  try {
    const remembered = JSON.parse(window.sessionStorage.getItem('vimbre:tool-connect-analytics') ?? 'null')
    window.sessionStorage.removeItem('vimbre:tool-connect-analytics')
    const provider = integrationProvider(remembered?.provider)
    if (remembered?.state === state && provider) trackEvent('integration_connected', {source_type: provider}, state)
  } catch { /* Connection success must never depend on telemetry. */ }
}
const routes = new Set(['/', '/login','/signup','/forgot','/reset-password','/auth/callback','/join','/privacy','/terms','/competition-terms','/blog','/app','/app/capture','/app/chat','/app/role-record','/app/team-activity','/app/team','/app/departments','/app/settings','/app/billing','/app/help','/app/weekly-summary','/role-guide','/handover-share'])
export function analyticsPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
  if (routes.has(path)) return path
  if (path.startsWith('/app/handovers')) return '/app/handovers'
  if (path.startsWith('/app/my-cover-duties')) return '/app/my-cover-duties'
  if (path.startsWith('/blog/')) return '/blog/article'
  return '/other'
}
let lastPage = ''
export function resetAnalyticsPage() { lastPage = '' }
export function trackPageView(pathname: string) {
  const path = analyticsPath(pathname)
  if (path === lastPage || !push({event: 'page_view', page_path: path, page_location: `https://vimbre.com${path}`, page_title: path === '/' ? 'Vimbre' : `Vimbre ${path}`, page_referrer: ''})) return
  lastPage = path
}
