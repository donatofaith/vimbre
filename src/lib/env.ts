export type PublicConfig = { url: string; key: string }
export type ConfigResult = { ok: true; value: PublicConfig } | { ok: false; error: string }

/** Public keys are identifiers. This catches accidental privileged keys before client creation. */
export function validatePublicConfig(url: string | undefined, key: string | undefined): ConfigResult {
  if (!url || !key) return { ok: false, error: 'Supabase is not configured.' }
  let parsed: URL
  try { parsed = new URL(url) } catch { return { ok: false, error: 'The Supabase URL is invalid.' } }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '') || (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))) {
    return { ok: false, error: 'Use a secure Supabase project URL.' }
  }
  if (key.startsWith('sb_publishable_')) return { ok: true, value: { url: parsed.origin, key } }
  // Accept legacy anon keys only. Privileged keys must never enter a frontend environment.
  try {
    const segment = key.split('.')[1]
    const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }
    if (payload.role === 'anon') return { ok: true, value: { url: parsed.origin, key } }
  } catch { /* Return a safe message without including the supplied value. */ }
  return { ok: false, error: 'Use a Supabase public client key. Secret and service role keys are forbidden.' }
}
