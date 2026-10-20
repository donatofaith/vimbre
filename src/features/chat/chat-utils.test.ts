import { describe, it, expect } from 'vitest'
import { mergeMessages, recordPath } from './chat-types'
import type { Message } from './chat-types'
describe('chat record links', () => {
  it('accepts supported internal records and known deployment origins', () => {
    expect(recordPath('/app/role-record?section=decision')).toBe(
      '/app/role-record?section=decision',
    )
    expect(recordPath('https://vimbre.com/app/team-activity?member=abc')).toBe(
      '/app/team-activity?member=abc',
    )
    expect(recordPath('https://vimbre.vercel.app/app/handovers')).toBe(
      '/app/handovers',
    )
  })
  it('rejects external, source, auth and script links', () => {
    for (const link of [
      'https://evil.invalid/app/role-record',
      'javascript:alert(1)',
      '//evil.invalid/app/role-record',
      '/app/capture',
      '/auth/callback?access_token=test',
      '/app/role-record/../../capture',
      '/app/role-record-evil',
      '/login',
      'https://vimbre.com.evil.invalid/app/role-record',
    ])
      expect(recordPath(link)).toBeNull()
  })
})
describe('message pagination', () => {
  it('deduplicates refreshes and orders older pages by server sequence', () => {
    const a = { id: 'a', seq: 10, body: 'Original' } as Message,
      b = { id: 'b', seq: 11 } as Message
    expect(mergeMessages([b], [a, b])).toEqual([a, b])
    expect(mergeMessages([a], [{ ...a, body: 'Updated' }])[0].body).toBe(
      'Updated',
    )
  })
})
