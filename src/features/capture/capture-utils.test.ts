import { describe, expect, it } from 'vitest'
import { captureDate } from './capture-utils'
describe('Capture dates', () => {
  it('formats the requested date without an ISO label', () => expect(captureDate('2026-10-16')).toBe('16 Oct 2026'))
  it('rejects invalid, missing and rolled-over dates', () => {
    for (const value of [undefined, null, '', '2026-02-30', 'not a date']) expect(captureDate(value)).toBe('Date needed')
  })
})
