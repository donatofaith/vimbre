import { describe, expect, it } from 'vitest'
import { shouldFollowMessages } from './chat-scroll'
describe('chat scroll while reading and copying', () => {
  it('opens at the latest messages', () => expect(shouldFollowMessages(true, false, false, 0, 8)).toBe(true))
  it('leaves the viewport in place for a receipt-only refresh', () => expect(shouldFollowMessages(false, true, false, 8, 8)).toBe(false))
  it('follows a new message when the reader is at the bottom', () => expect(shouldFollowMessages(false, true, false, 8, 9)).toBe(true))
  it('does not jump away from older messages', () => expect(shouldFollowMessages(false, false, false, 8, 9)).toBe(false))
  it('preserves text selection even when new messages arrive', () => expect(shouldFollowMessages(false, true, true, 8, 9)).toBe(false))
})
