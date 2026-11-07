import { describe, expect, it, vi } from 'vitest'
import { recordingBytes } from '../_shared/capture-audio.ts'
import { transcribeRequest } from './handler.ts'

const user = '383bcf33-3fbd-4ed6-9a01-85aef398786a'
const settings: Record<string, string> = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  ELEVENLABS_API_KEY: 'eleven-test',
  CAPTURE_RECORDING_PILOT_USERS: user,
}
const env = (key: string) => settings[key]
const audio = new Uint8Array(32)
audio.set([0x1a, 0x45, 0xdf, 0xa3])
function request(method = 'POST', extraHeaders = {}, body = audio) {
  return new Request('https://project.supabase.co/functions/v1/capture-transcribe', {
    method, ...(method === 'POST' ? { body } : {}),
    headers: { authorization: 'Bearer session', origin: 'https://vimbre.com', 'content-type': 'audio/webm', ...extraHeaders },
  })
}
function services({ quota = 'allowed', transcript = 'Amara will send the quote.', id = user } = {}) {
  return vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id })
    if (String(url).endsWith('/capture_recording_allowance')) return Response.json(quota)
    const payload = options?.body as FormData
    expect(options?.headers).toEqual({ 'xi-api-key': 'eleven-test' })
    expect(payload.get('model_id')).toBe('scribe_v2')
    expect((payload.get('file') as File).name).toBe('meeting.webm')
    return Response.json({ text: transcript })
  })
}

describe('Capture transcription', () => {
  it('keeps audio and provider calls behind the pilot gate', async () => {
    const fetcher = services({ id: 'different-user' })
    expect((await transcribeRequest(request(), env, fetcher)).status).toBe(403)
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockClear()
    expect((await transcribeRequest(request('POST', { origin: 'https://untrusted.example' }), env, fetcher)).status).toBe(403)
    expect((await transcribeRequest(request('POST', { authorization: '' }), env, fetcher)).status).toBe(401)
    expect((await transcribeRequest(request(), () => undefined, fetcher)).status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects mislabeled and oversized bodies before consuming a transcription', async () => {
    const fetcher = services()
    expect((await transcribeRequest(request('POST', {}, new Uint8Array(32)), env, fetcher)).status).toBe(415)
    expect((await transcribeRequest(request('POST', {}, new Uint8Array(recordingBytes + 1)), env, fetcher)).status).toBe(413)
    expect(fetcher.mock.calls.every(([url]) => String(url).endsWith('/auth/v1/user'))).toBe(true)
  })

  it('checks availability without consuming quota and never calls the provider above quota', async () => {
    const fetcher = services({ quota: 'recording_limit' })
    expect(await (await transcribeRequest(request('GET'), env, fetcher)).json()).toEqual({ available: false, code: 'recording_limit' })
    expect((await transcribeRequest(request(), env, fetcher)).status).toBe(429)
    const quotaCalls = fetcher.mock.calls.filter(([url]) => String(url).endsWith('/capture_recording_allowance'))
    expect(quotaCalls.map(([, options]) => JSON.parse(String(options?.body)).p_consume)).toEqual([false, true])
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('returns the complete transcript as plain text and disables response caching', async () => {
    const transcript = 'Meeting notes. '.repeat(1100).trim()
    const fetcher = services({ transcript })
    const response = await transcribeRequest(request(), env, fetcher)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ transcript })
  })
})
