import { describe, expect, it } from 'vitest'
import { assertClientModule, assertPublicEnvironment } from './public-env'

describe('frontend credential boundary', () => {
  it('accepts public configuration and ignores unprefixed server secrets', () => {
    for (const env of [{}, { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' }, { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_configuration_test', ANTHROPIC_API_KEY: 'server-only' }]) {
      expect(() => assertPublicEnvironment(env)).not.toThrow()
    }
  })
  it('rejects private and invalid keys before bundling without echoing them', () => {
    const service = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`
    for (const key of ['sb_' + 'secret_' + 'private_fixture', service, 'invalid-key']) {
      expect(() => assertPublicEnvironment({ VITE_SUPABASE_PUBLISHABLE_KEY: key })).toThrow('cannot be bundled')
      try { assertPublicEnvironment({ VITE_SUPABASE_PUBLISHABLE_KEY: key }) }
      catch (error) { expect((error as Error).message).not.toContain(key) }
    }
  })
  it('rejects unapproved public variables including innocuous names', () => {
    for (const name of ['VITE_ANTHROPIC_API_KEY', 'VITE_STRIPE_SECRET_KEY', 'VITE_OTHER']) {
      expect(() => assertPublicEnvironment({ [name]: 'private_fixture' })).toThrow('Unapproved VITE_')
    }
  })
  it('rejects credential-bearing public URLs', () => {
    for (const url of ['https://user:password@project.supabase.co', 'https://project.supabase.co?token=private', 'https://project.supabase.co#private']) {
      expect(() => assertPublicEnvironment({ VITE_SUPABASE_URL: url })).toThrow('Invalid public Supabase URL')
    }
  })
  it('blocks backend imports while permitting public SDK modules', () => {
    for (const path of ['supabase/functions/ai-run/runtime.ts', 'api/calendar.mjs?import', 'email-worker/src/index.ts', 'scripts/worker.ts', 'src/credentials.server.ts']) {
      expect(() => assertClientModule('/project/' + path, '/project')).toThrow('Server code')
    }
    for (const path of ['src/lib/ai-gateway.ts', 'node_modules/provider/api/index.js']) {
      expect(() => assertClientModule('/project/' + path, '/project')).not.toThrow()
    }
  })
})
