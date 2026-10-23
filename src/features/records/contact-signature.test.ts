import { describe, expect, it } from 'vitest'
import { parseContactSignature } from './contact-signature'
describe('contact signature review', () => {
  it('extracts a name, email and international phone without using the signoff', () => {
    expect(parseContactSignature('Kind regards,\nAda Okafor\nOperations\nEmail: ada@acme.co.uk\nTel: +44 (0)20 1234 5678')).toEqual({name: 'Ada Okafor', contact: 'ada@acme.co.uk · +44 (0)20 1234 5678'})
  })
  it('keeps a single available contact method and never invents a name', () => {
    expect(parseContactSignature('Email: support@example.com')).toEqual({name: '', contact: 'support@example.com'})
  })
  it('ignores URLs and short reference numbers as contact details', () => {
    expect(parseContactSignature('https://example.com\nRef 1234')).toEqual({name: '', contact: ''})
  })
})
