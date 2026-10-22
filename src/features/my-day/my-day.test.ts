import { describe,it,expect } from 'vitest'
import { dateInZone,addDays,parseDay } from './types'
import { morningTomorrow } from './reminder-time'
describe('personal task dates',()=>{
 it('uses the selected timezone across midnight',()=>{const now=new Date('2026-10-22T23:30:00Z');expect(dateInZone('Africa/Lagos',now)).toBe('2026-10-23');expect(dateInZone('America/New_York',now)).toBe('2026-10-22')})
 it('keeps date chips as local calendar dates',()=>{expect(addDays('2026-10-25',1)).toBe('2026-10-26');expect(addDays('2026-12-31',7)).toBe('2027-01-07')})
 it('snoozes to 9am after the London clock change',()=>{expect(morningTomorrow('Europe/London',new Date('2026-10-24T20:00:00Z'))).toBe('2026-10-25T09:00:00.000Z');expect(morningTomorrow('Europe/London',new Date('2027-03-27T20:00:00Z'))).toBe('2027-03-28T08:00:00.000Z');expect(morningTomorrow('Africa/Lagos',new Date('2026-10-22T20:00:00Z'))).toBe('2026-10-23T08:00:00.000Z')})
 it('rejects malformed task data instead of displaying made up totals',()=>{expect(parseDay({})).toBeNull();expect(parseDay({rows:[],context_waiting:[],count:NaN,timezone:'Europe/London',today:'2026-10-22',counts:{todo:0,progress:0,overdue:0}})).toBeNull()})
})
