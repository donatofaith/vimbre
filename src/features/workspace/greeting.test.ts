import { describe, expect, it } from 'vitest'
import { localGreeting } from './greeting'
describe('local greeting', () => {
  it('changes at local noon and 4 pm', () => {
    for (const [hour, minute, expected] of [[0,0,'Good morning'],[11,59,'Good morning'],[12,0,'Good afternoon'],[15,59,'Good afternoon'],[16,0,'Good evening'],[23,59,'Good evening']] as const) {
      expect(localGreeting(new Date(2026, 9, 19, hour, minute))).toBe(expected)
    }
  })
})
