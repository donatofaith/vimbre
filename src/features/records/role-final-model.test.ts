import {describe,it,expect} from 'vitest'
import {areaReady,rowFields,rowsFor,roleTabs} from './role-final-model'
import type {RoleRow} from './role-final-model'
const now=Date.parse('2026-10-23T12:00:00Z')
const row:RoleRow={id:'x',title:'Current record',deleted_at:null,reviewed_at:'2026-10-20',role_fields:{due_date:'2026-09-01'},due_date:'2026-10-25'}
describe('final role readiness and fields',()=>{
 it('requires a current reviewed item, excludes replaced or archived history',()=>{expect(areaReady([row],undefined,now)).toBe(true);expect(areaReady([{...row,status:'replaced'}],undefined,now)).toBe(false);expect(areaReady([{...row,deleted_at:'2026-10-22'}],undefined,now)).toBe(false);expect(areaReady([{...row,reviewed_at:'2026-01-01'}],undefined,now)).toBe(false)})
 it('accepts a recent explicitly empty area, but not an expired declaration',()=>{expect(areaReady([],{nothing_to_add:true,reviewed_at:'2026-10-23'},now)).toBe(true);expect(areaReady([],{nothing_to_add:true,reviewed_at:'2026-01-01'},now)).toBe(false)})
 it('uses the current scheduled due date over saved form metadata',()=>expect(rowFields(row).due_date).toBe('2026-10-25'))
 it('keeps projects and responsibilities together, in the client tab order',()=>{expect(roleTabs.map(t=>t[0])).toEqual(['handled','decision','external_contact','document','recurring_deadline']);expect(rowsFor('handled',[{...row,kind:'responsibility'},{...row,id:'y',kind:'workstream'},{...row,id:'z',kind:'document'}],[])).toHaveLength(2)})
})
