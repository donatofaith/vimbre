// Fixed-purpose OAuth relay. No credentials, provider calls, cookies or query logging.
const upstream = 'https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/capture-connect/callback'
const failure = 'https://vimbre.com/app/capture?connection=failed'
const origins = new Set(['https://vimbre.com', 'https://www.vimbre.com', 'https://vimbre.vercel.app', 'https://vimbre.co.uk', 'https://www.vimbre.co.uk'])
const fields = ['state', 'code', 'oauth_token', 'oauth_verifier', 'error', 'denied']
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.statusCode = 405
    return res.end()
  }
  let destination = failure
  try {
    if ((req.url || '').length > 12000) throw new Error('invalid')
    const input = new URL(req.url, 'https://vimbre.com')
    const state = input.searchParams.get('state') || ''
    if (!/^[a-f0-9]{64}$/.test(state)) throw new Error('invalid')
    const target = new URL(upstream)
    for (const field of fields) {
      const values = input.searchParams.getAll(field)
      if (values.length > 1 || (values[0] || '').length > 4096) throw new Error('invalid')
      if (values.length) target.searchParams.set(field, values[0])
    }
    const response = await fetch(target, {redirect: 'manual', signal: AbortSignal.timeout(10000)})
    const location = response.headers.get('location')
    if (response.status !== 303 || !location) throw new Error('invalid')
    const next = new URL(location)
    if (!origins.has(next.origin) || next.pathname !== '/app/capture' || next.username || next.password) throw new Error('invalid')
    if (next.hash) {
      const fragment = new URLSearchParams(next.hash.slice(1))
      if (next.search || fragment.get('tool_connect') !== '1' || fragment.get('state') !== state || [...fragment.keys()].some(k => !['tool_connect', ...fields].includes(k))) throw new Error('invalid')
    } else if (next.href !== failure) throw new Error('invalid')
    destination = next.href
  } catch { /* Fail closed without logging authorization parameters. */ }
  res.statusCode = 303
  res.setHeader('Location', destination)
  return res.end()
}
