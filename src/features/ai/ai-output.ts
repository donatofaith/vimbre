export type ExtractedDraft = { kind: 'decision' | 'action' | 'contact'; payload: Record<string, string> }
const invalid = () => new Error('The draft could not be read. Try again or add it manually.')
function text(value: unknown, max = 5000): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string' || value.length > max) throw invalid()
  return value.trim()
}
function date(value: unknown): string {
  const result = text(value, 40)
  if (!result) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return ''
  const parsed = new Date(`${result}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : ''
}
/** Never evaluate model output or render it as HTML. Missing dates stay blank for review. */
export function parseExtraction(raw: string): ExtractedDraft[] {
  if (raw.length > 60000) throw invalid()
  const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '')
  let data: unknown
  try { data = JSON.parse(cleaned) } catch { throw invalid() }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw invalid()
  const record = data as Record<string, unknown>
  const result: ExtractedDraft[] = []
  for (const key of ['decisions', 'tasks', 'external_contacts'] as const) {
    const rows = record[key]
    if (!Array.isArray(rows) || rows.length > 30) throw invalid()
    for (const value of rows) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
      const row = value as Record<string, unknown>
      if (key === 'decisions') result.push({ kind: 'decision', payload: { title: text(row.decision, 200), reason: text(row.why), decided_by: text(row.owner, 200), decided_on: date(row.date), next_step: text(row.next_step) } })
      if (key === 'tasks') result.push({ kind: 'action', payload: { title: text(row.title, 200), details: text(row.owner, 200) ? `Owner: ${text(row.owner, 200)}` : '', due_date: date(row.due_date) } })
      if (key === 'external_contacts') result.push({ kind: 'contact', payload: { title: text(row.name, 200), details: [text(row.organisation, 200), text(row.contact_details, 400), text(row.context)].filter(Boolean).join('\n') } })
    }
  }
  if (result.length > 60 || result.some(row => !row.payload.title)) throw invalid()
  return result
}
export function validateAIInput(value: string): string | null {
  if (!value.trim()) return 'Add some text first.'
  return new TextEncoder().encode(value).byteLength > 16000 ? 'Use a shorter selection of notes, up to 16 KB.' : null
}
