import {it,expect} from 'vitest'
import {localReminder,morningTomorrow} from './reminder-time'
it('snoozes in the user timezone across daylight saving changes',()=>{expect(morningTomorrow('Europe/London',new Date('2026-03-28T12:00:00Z'))).toBe('2026-03-29T08:00:00.000Z');expect(localReminder('2026-10-26','09:00','Africa/Lagos')).toBe('2026-10-26T08:00:00.000Z')})
it('does not silently move a nonexistent clock-change time',()=>{expect(()=>localReminder('2026-03-29','01:30','Europe/London')).toThrow('clocks change')})
