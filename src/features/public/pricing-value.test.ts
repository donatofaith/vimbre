import {it,expect} from 'vitest'
import {handoverTimeCost} from './pricing-value'
it('compares only visitor inputs, including fractional hours and zero losses',()=>{expect(handoverTimeCost('20','1.5','40')).toBe(1200);expect(handoverTimeCost('0','2','40')).toBe(0)})
it('does not display fabricated results for incomplete, negative or overflowing inputs',()=>{for(const values of [['','2','40'],['2','-1','40'],['2','no','40'],['1e308','1e308','1']])expect(handoverTimeCost(...values as [string,string,string])).toBeNull()})
