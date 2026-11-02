import {beforeEach,expect,it,vi}from 'vitest'
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../../lib/supabase',()=>({supabase:{rpc}}))
import {loadDailyTask}from './open-daily-task'
const task={id:'target',title:'Completed task',status:'done'}
const day={rows:[],today:'2026-11-02',timezone:'Africa/Lagos',counts:{},count:0,context_waiting:[],page:0,has_more:false,done_today:[task]}
beforeEach(()=>rpc.mockReset())
it('opens an owned completed task without changing the current view',async()=>{rpc.mockResolvedValue({data:day,error:null});expect(await loadDailyTask('target')).toEqual(task);expect(rpc).toHaveBeenCalledWith('myday_tasks',expect.objectContaining({p_filter:'all',p_task:'target',p_query:'',p_page:0}))})
it('does not fall back to another task or mask a failed lookup',async()=>{rpc.mockResolvedValue({data:{...day,rows:[{id:'other'}],done_today:[]},error:null});await expect(loadDailyTask('target')).rejects.toThrow('no longer available');rpc.mockResolvedValue({data:null,error:{message:'failed'}});await expect(loadDailyTask('target')).rejects.toThrow('could not be opened')})
