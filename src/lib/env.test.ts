import { describe, expect, it } from 'vitest'
import { validatePublicConfig } from './env'
const publicKey = 'sb_publishable_configuration_test'
const token = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`
describe('public backend configuration', () => {
  it('allows a clean project URL and a publishable key', () => {
    expect(validatePublicConfig('https://project.supabase.co/', publicKey)).toEqual({ ok: true, value: { url: 'https://project.supabase.co', key: publicKey } })
  })
  it('supports a legacy anon key', () => { expect(validatePublicConfig('https://project.supabase.co', token('anon')).ok).toBe(true) })
  it('rejects privileged keys without echoing them', () => {
    for (const key of ['sb_secret_do_not_expose', token('service_role')]) {
      const result = validatePublicConfig('https://project.supabase.co', key)
      expect(result.ok).toBe(false)
      expect(JSON.stringify(result)).not.toContain(key)
    }
  })
  it('requires configuration and rejects insecure remote URLs', () => {
    expect(validatePublicConfig(undefined, undefined).ok).toBe(false)
    for (const url of ['http://remote.example', 'javascript:alert(1)', 'https://user:password@project.supabase.co', 'https://project.supabase.co/?token=private']) expect(validatePublicConfig(url, publicKey).ok).toBe(false)
    expect(validatePublicConfig('http://127.0.0.1:54321', publicKey).ok).toBe(true)
  })
})
