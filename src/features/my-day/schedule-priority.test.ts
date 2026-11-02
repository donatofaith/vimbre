import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../../lib/supabase',()=>({supabase:{rpc}}))
import {schedulePriorityForToday} from './schedule-priority'
beforeEach(()=>{rpc.mockReset();vi.stubGlobal('window',new EventTarget())})
afterEach(()=>vi.unstubAllGlobals())
it('moves to the account-local date before accepting and refreshing Today',async()=>{rpc.mockResolvedValue({data:{},error:null});const changed=vi.fn();window.addEventListener('vimbre:work-changed',changed);try{await schedulePriorityForToday('task','2026-11-02');expect(rpc.mock.calls.map(([name,args])=>[name,args])).toEqual([['myday_action',{p_id:'task',p_operation:'tomorrow',p_data:{date:'2026-11-02'}}],['myday_daily',{p_action:'accept',p_task:'task'}]]);expect(changed).toHaveBeenCalledTimes(1)}finally{window.removeEventListener('vimbre:work-changed',changed)}})
it('does not mark a failed move as accepted',async()=>{rpc.mockResolvedValue({error:{code:'42501'}});await expect(schedulePriorityForToday('other','2026-11-02')).rejects.toMatchObject({code:'42501'});expect(rpc).toHaveBeenCalledTimes(1)})

it('keeps a successful move when saving the daily choice is interrupted',async()=>{rpc.mockResolvedValueOnce({data:'task',error:null}).mockRejectedValueOnce(Error('network'));await expect(schedulePriorityForToday('task','2026-11-02')).resolves.toEqual({choiceSaved:false})})
