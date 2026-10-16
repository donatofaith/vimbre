import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'

function server({ authorized = true, mailFails = false }: { authorized?: boolean; mailFails?: boolean } = {}) {
  const sent: Record<string, unknown>[] = []
  const logs: Record<string, unknown>[] = []
  let handler: (request: Request) => Promise<Response>
  const client = (_url: string, key: string) => ({
    auth: {
      getUser: async (token: string) => ({ data: { user: token === 'valid-token' ? { id: 'verified-user', email_confirmed_at: '2026-10-16' } : null }, error: null }),
      signInWithOtp: async (payload: Record<string, unknown>) => { sent.push(payload); return { error: mailFails ? { code: 'unexpected_failure', status: 500 } : null } },
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (key === 'service-test') { logs.push({ name, ...args }); return { error: null } }
      return authorized ? { data: [{ invitation_id: 'invite-id', email_log_id: 'log-id', email: 'recipient@example.invalid', full_name: 'Invited Person' }], error: null } : { data: null, error: { code: '42501', message: 'An active HR Admin account is required' } }
    },
  })
  const source = readFileSync(new URL('../supabase/functions/team-invitations/index.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
  vm.runInNewContext(code, { exports: {}, Request, Response, console: { error() {} }, require: () => ({ createClient: client }), Deno: { serve: (callback: typeof handler) => { handler = callback }, env: { get: (name: string) => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service-test' : name === 'SUPABASE_URL' ? 'https://example.invalid' : 'public-test' } } })
  const request = (body: unknown, token = 'valid-token', origin = 'https://vimbre.vercel.app') => handler(new Request('https://example.invalid/team-invitations', { method: 'POST', headers: { authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  return { request, sent, logs }
}
describe('invitation server boundary', () => {
  it('rejects an invalid session before preparing or sending mail', async () => {
    const app = server(); expect((await app.request({ action: 'create' }, 'invalid-token')).status).toBe(401); expect(app.sent).toHaveLength(0)
  })
  it('rejects callers without HR Admin database permission', async () => {
    const app = server({ authorized: false }); expect((await app.request({ action: 'create' })).status).toBe(403); expect(app.sent).toHaveLength(0)
  })
  it('uses database recipient details and a fixed callback rather than caller redirects', async () => {
    const app = server(); const response = await app.request({ action: 'create', email: 'untrusted@example.invalid', redirectTo: 'https://untrusted.invalid', role: 'hr_admin' })
    expect(response.status).toBe(200); expect(app.sent[0].email).toBe('recipient@example.invalid')
    expect(app.sent[0].options).toMatchObject({ emailRedirectTo: 'https://vimbre.vercel.app/auth/callback', data: { invitation_id: 'invite-id' } })
    expect(app.logs[0]).toMatchObject({ name: 'complete_invitation_delivery', p_status: 'accepted', p_id: 'log-id' })
  })
  it('records an SMTP failure and gives an actionable retry message', async () => {
    const app = server({ mailFails: true }); const response = await app.request({ action: 'resend', id: 'invite-id' }); expect(response.status).toBe(502)
    expect((await response.json()).error).toContain('Wait one minute'); expect(app.logs[0].p_status).toBe('failed')
  })
  it('rejects unsupported actions and unapproved web origins', async () => {
    const app = server(); expect((await app.request({ action: 'delete' })).status).toBe(400); expect((await app.request({ action: 'create' }, 'valid-token', 'https://untrusted.invalid')).status).toBe(403); expect(app.sent).toHaveLength(0)
  })
})
