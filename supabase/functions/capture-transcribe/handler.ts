import { audioFile, recordingBytes } from '../_shared/capture-audio.ts'

const origins = new Set(['https://vimbre.com', 'https://www.vimbre.com', 'https://vimbre.vercel.app'])

export async function transcribeRequest(req: Request, env: (name: string) => string | undefined, fetcher = fetch) {
  const origin = req.headers.get('origin') ?? ''
  const headers = {
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    ...(origins.has(origin) ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    } : {}),
  }
  const reply = (status: number, code: string) => Response.json({ code }, { status, headers })
  if (origin && !origins.has(origin)) return reply(403, 'access_denied')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'GET' && req.method !== 'POST') return reply(405, 'method_not_allowed')

  const url = env('SUPABASE_URL')
  const anon = env('SUPABASE_ANON_KEY')
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  const key = env('ELEVENLABS_API_KEY')
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return reply(401, 'sign_in_required')
  if (!url || !anon || !service || !key) return reply(503, 'recording_disabled')

  try {
    const userResponse = await fetcher(url + '/auth/v1/user', {
      headers: { apikey: anon, authorization }, signal: AbortSignal.timeout(8000),
    })
    if (!userResponse.ok) return reply(userResponse.status >= 500 ? 503 : 401, 'sign_in_required')
    const user = await userResponse.json()
    if (user.is_anonymous || typeof user.id !== 'string') return reply(403, 'access_denied')

    const allowance = async (consume: boolean) => {
      const response = await fetcher(url + '/rest/v1/rpc/capture_recording_allowance', {
        method: 'POST',
        headers: { apikey: service, authorization: 'Bearer ' + service, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_user: user.id, p_consume: consume }),
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) throw new Error('allowance_unavailable')
      return await response.json()
    }
    const availability = await allowance(false)
    if (req.method === 'GET') {
      return Response.json({ available: availability === 'allowed', code: availability }, { headers })
    }
    if (availability !== 'allowed') return reply(availability === 'recording_limit' ? 429 : 403, availability)

    const mime = req.headers.get('content-type') ?? ''
    if (!/^audio\/(webm|mp4|ogg)(?:;|$)/i.test(mime)) return reply(415, 'unsupported_audio')
    if (Number(req.headers.get('content-length')) > recordingBytes) return reply(413, 'audio_too_large')
    const reader = req.body?.getReader()
    if (!reader) return reply(400, 'empty_audio')
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let bytes = 0
    let finished = false
    let timedOut = false
    const uploadTimeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}) }, 30_000)
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) { finished = true; break }
        bytes += value.byteLength
        if (bytes > recordingBytes) return reply(413, 'audio_too_large')
        chunks.push(new Uint8Array(value))
      }
    } finally {
      clearTimeout(uploadTimeout)
      if (!finished) void reader.cancel().catch(() => {})
      reader.releaseLock()
    }
    if (timedOut) return reply(408, 'upload_timeout')
    if (bytes < 16) return reply(400, 'empty_audio')
    const blob = new Blob(chunks, { type: mime })
    const name = audioFile(mime, new Uint8Array(await blob.slice(0, 16).arrayBuffer()))
    if (!name) return reply(415, 'unsupported_audio')

    const status = await allowance(true)
    if (status !== 'allowed') return reply(status === 'recording_limit' ? 429 : 403, status)
    const form = new FormData()
    form.set('file', blob, name)
    form.set('model_id', 'scribe_v2')
    form.set('tag_audio_events', 'false')
    form.set('timestamps_granularity', 'none')
    const zeroRetention = env('ELEVENLABS_ZERO_RETENTION') === 'true'
    const response = await fetcher('https://api.elevenlabs.io/v1/speech-to-text' + (zeroRetention ? '?enable_logging=false' : ''), {
      method: 'POST', headers: { 'xi-api-key': key }, body: form,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(100_000)]),
    })
    if (!response.ok) return reply(502, 'transcription_failed')
    const result = await response.json()
    const transcript = typeof result.text === 'string' ? result.text.trim() : ''
    if (!transcript) return reply(422, 'no_speech')
    return Response.json({ transcript }, { headers })
  } catch {
    return reply(503, 'transcription_unavailable')
  }
}
