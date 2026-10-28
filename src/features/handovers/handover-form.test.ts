import {describe,it,expect,vi} from 'vitest'
vi.mock('../../lib/supabase',()=>({supabase:{}}))
import {nextWorkingDay,workingDays,dateErrors,dueDuring,handoverTitle} from './handover-form'
describe('handover date and title rules',()=>{
 it('defaults to the next working day across weekends and month ends',()=>{expect(nextWorkingDay('2026-10-30')).toBe('2026-11-02');expect(nextWorkingDay('2026-10-31')).toBe('2026-11-02');expect(nextWorkingDay('2026-12-31')).toBe('2027-01-01')})
 it('requires an explicit return date or the unknown choice and rejects reversed ranges',()=>{expect(dateErrors('2026-11-09','',false).ends_on).toBeTruthy();expect(dateErrors('2026-11-09','',true)).toEqual({});expect(dateErrors('2026-11-09','2026-11-08',false).ends_on).toBeTruthy()})
 it('selects only tasks due during the absence, including an unknown return',()=>{expect(dueDuring('2026-11-12','2026-11-09','2026-11-16',false)).toBe(true);expect(dueDuring(null,'2026-11-09','2026-11-16',false)).toBe(false);expect(dueDuring('2026-11-20','2026-11-09','',true)).toBe(true);expect(dueDuring('2026-11-08','2026-11-09','',true)).toBe(false)})
 it('counts working days and uses readable automatic titles',()=>{expect(workingDays('2026-10-26','2026-11-02')).toBe(5);expect(handoverTitle('leave','2026-10-26','2026-11-02')).toBe('Going on leave, 26 Oct to 2 Nov')})
})
