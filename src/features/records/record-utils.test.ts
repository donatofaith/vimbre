import { describe, expect, it } from 'vitest'
import { safeRecordUrl } from './record-utils'
describe('links rendered from stored role knowledge', () => {
  it('accepts normal web sources and normalizes protocol casing', () => {
    expect(safeRecordUrl('https://example.com/review?q=notes#reason')).toBe('https://example.com/review?q=notes#reason')
    expect(safeRecordUrl('HTTPS://example.com')).toBe('https://example.com/')
  })
  it('never renders executable, local, or credential bearing links', () => {
    for (const value of [null, '', 'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', '/app', 'ftp://example.com', 'https://person:secret@example.com', 'https://person@example.com']) expect(safeRecordUrl(value)).toBeNull()
  })
})
