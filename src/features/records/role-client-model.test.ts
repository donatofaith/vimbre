import {describe,it,expect} from 'vitest'
import {checkDue,howOften,isCurrent,obviousSecret,readinessFor} from './role-client-model'
import type {ClientRow} from './role-client-model'
const item:ClientRow={id:'x',title:'Review report',kind:'responsibility',recurrence:'Weekly',role_fields:{steps:'Check then send'},reviewed_at:new Date().toISOString(),deleted_at:null}
describe('27 October role brief',()=>{
 it('counts actual essentials and all overdue items, not filled sections',()=>{const role={title:'Operations',cover_id:'cover',manager_id:'manager'};expect(readinessFor(role,'Operations',[item],[]).left).toBe(0);const stale={...item,id:'y',reviewed_at:'2020-01-01'};expect(readinessFor(role,'Operations',[item,stale],[]).steps).toEqual(['Check 1 item']);expect(readinessFor({...role,cover_id:null},'Operations',[item],[]).steps).toEqual(['Add a cover person'])})
 it('keeps frequency visible and does not count removed/replaced items as current',()=>{expect(howOften(item)).toBe('Weekly');expect(howOften({...item,recurrence:undefined,kind:'document'})).toBe('As needed');expect(isCurrent({...item,status:'replaced'})).toBe(false);expect(isCurrent({...item,deleted_at:'2026-10-27'})).toBe(false);expect(checkDue({...item,reviewed_at:'2020-01-01'})).toBe(true)})
 it('blocks obvious credentials and card numbers without blocking access directions',()=>{expect(obviousSecret('password: secret')).toBe(true);expect(obviousSecret('1234 5678 9012 3456')).toBe(true);expect(obviousSecret('Ask IT for access through the company password manager.')).toBe(false)})
})
