import {expect,it}from 'vitest'
import {activeDuration,memberInitials,lastActive}from './member'
it('distinguishes unmeasured active time from recorded short sessions',()=>{expect(activeDuration(null)).toBe('—');expect(activeDuration(0)).toBe('<1 min');expect(activeDuration(45)).toBe('<1 min');expect(activeDuration(125)).toBe('2 min');expect(activeDuration(3660)).toBe('1h 1m')})
it('uses display-name initials and handles absent timestamps',()=>{expect(memberInitials('  Alex Reed  ')).toBe('AR');expect(memberInitials('')).toBe('?');expect(lastActive(null)).toBe('—');expect(lastActive('invalid')).toBe('—')})
