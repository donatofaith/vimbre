import { uploadTarget, validatedMime } from './validation.ts'

const origins = new Set(['https://vimbre.com', 'https://www.vimbre.com', 'https://vimbre.vercel.app', 'https://vimbre.co.uk', 'https://www.vimbre.co.uk'])

Deno.serve(async req => {
  const origin = req.headers.get('origin') ?? ''
  const headers = { 'Cache-Control': 'no-store', Vary: 'Origin',
    ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-upload-bucket, x-upload-path, x-upload-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) }
  const reply = (status: number, code: string) => Response.json({ code }, { status, headers })
  if (origin && !origins.has(origin)) return reply(403, 'access_denied')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply(405, 'method_not_allowed')
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return reply(401, 'sign_in_required')
  if (!url || !anon || !service) return reply(503, 'upload_unavailable')
  const path = req.headers.get('x-upload-path') ?? ''
  const target = uploadTarget(req.headers.get('x-upload-bucket') ?? '', path, req.headers.get('x-upload-type') ?? '')
  if (!target) return reply(415, 'unsupported_file')
  if (Number(req.headers.get('content-length')) > target.rule.bytes) return reply(413, 'file_too_large')
  const reader = req.body?.getReader()
  if (!reader) return reply(400, 'empty_file')
  try {
    const identity = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, authorization }, signal: AbortSignal.timeout(8000) })
    if (!identity.ok) return reply(identity.status >= 500 ? 503 : 401, 'sign_in_required')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const result = await reader.read()
        if (result.done) break
        size += result.value.byteLength
        if (size > target.rule.bytes) { await reader.cancel(); return reply(413, 'file_too_large') }
        chunks.push(result.value)
      }
    } finally { reader.releaseLock() }
    if (!size) return reply(400, 'empty_file')
    const allowed = await fetch(url + '/rest/v1/rpc/authorize_validated_upload', { method: 'POST',
      headers: { apikey: anon, authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_bucket: target.bucket, p_path: path, p_size: size }), signal: AbortSignal.timeout(8000) })
    if (!allowed.ok) return reply(503, 'upload_unavailable')
    if (await allowed.json() !== true) return reply(403, 'access_denied')
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const contentType = validatedMime(bytes, target.extension)
    if (!contentType) return reply(415, 'unsupported_file')
    const object = await fetch(url + '/storage/v1/object/' + target.bucket + '/' + path.split('/').map(encodeURIComponent).join('/'), {
      method: 'POST', headers: { apikey: service, authorization: 'Bearer ' + service,
        'Content-Type': contentType, 'x-upsert': 'false' }, body: bytes, signal: AbortSignal.timeout(25000),
    })
    if (object.ok) return reply(200, 'uploaded')
    const failure = await object.json().catch(() => null)
    if (object.status === 409 || String(failure?.statusCode) === '409' || failure?.error === 'Duplicate') return reply(409, 'already_uploaded')
    return reply(503, 'upload_unavailable')
  } catch { return reply(503, 'upload_unavailable') }
})
