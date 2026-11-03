import {expect,it} from 'vitest'
import {reportPeriod,movePeriod} from './report-period'
it('uses Monday to Sunday including year boundaries',()=>{expect(reportPeriod('2026-01-01','week')).toEqual({start:'2025-12-29',end:'2026-01-04'})})
it('handles full months and leap years',()=>{expect(reportPeriod('2024-02-29','month')).toEqual({start:'2024-02-01',end:'2024-02-29'});expect(reportPeriod('2026-02-12','month').end).toBe('2026-02-28')})
it('moves from a month boundary rather than overflowing the selected day',()=>{expect(movePeriod('2026-01-31','month',1)).toBe('2026-02-01');expect(movePeriod('2026-12-12','month',1)).toBe('2027-01-01');expect(movePeriod('2026-11-03','week',-1)).toBe('2026-10-26')})
