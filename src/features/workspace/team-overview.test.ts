import { describe, it, expect } from 'vitest'
import { parseTeamOverview } from './useTeamOverview'
const base={rows:[{id:'member',full_name:'Ada',tasks_done:2,tasks_overdue:1,drafts_waiting:3,handover_status:null,no_role_record:false}],count:1,total_active_count:5,scope:'company',today:'2026-10-19',week_start:'2026-10-19',flags:{overdue_tasks:1,handovers_not_started:null,people_without_role_record:0},handovers_available:false}
describe('team overview response',()=>{
 it('accepts real metrics and unavailable handover fields',()=>expect(parseTeamOverview(base)).toEqual(base))
 it('rejects missing or malformed metrics instead of reporting zero',()=>{
  for(const value of [null,{}, {...base,rows:[null]}, {...base,rows:[{...base.rows[0],drafts_waiting:-1}]}, {...base,flags:null},{...base,total_active_count:'5'},{...base,scope:'all'}])expect(parseTeamOverview(value)).toBeNull()
 })
})
