import {beforeEach,expect,it,vi} from 'vitest'
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../../lib/supabase',()=>({supabase:{rpc}}))
import {reviewCaptureDraft} from './capture-review'
beforeEach(()=>rpc.mockReset())
function respond(version=8,capture='source'){rpc.mockResolvedValueOnce({data:'draft',error:null}).mockResolvedValueOnce({data:{source:{id:capture},items:[{id:'draft',status:'pending',version,payload:{title:'Server-normalised title'}}]},error:null}).mockResolvedValueOnce({data:['draft'],error:null})}
it('refreshes only the reviewed capture and duplicates, retaining the canonical item version',async()=>{respond();const result=await reviewCaptureDraft('source','draft',{kind:'action',title:' title '},7,true);expect(result.version).toBe(8);expect(result.detail.items[0].payload.title).toBe('Server-normalised title');expect(result.duplicates).toEqual(['draft']);expect(rpc.mock.calls.map(([name,args])=>[name,args.p_operation||args.p_action])).toEqual([['capture_change','edit'],['capture_workspace','detail'],['capture_pipeline','duplicates']])})
it('does not accept a version changed by another session after the edit',async()=>{respond(9);await expect(reviewCaptureDraft('source','draft',{},7,true)).rejects.toMatchObject({code:'40001'})})
it('does not use a detail response for another capture',async()=>{respond(8,'other');await expect(reviewCaptureDraft('source','draft',{},7,true)).rejects.toMatchObject({code:'40001'})})
it('preserves a rejected edit and avoids follow-up reads',async()=>{rpc.mockResolvedValueOnce({error:{code:'40001'}});await expect(reviewCaptureDraft('source','draft',{},7,true)).rejects.toMatchObject({code:'40001'});expect(rpc).toHaveBeenCalledTimes(1)})
