import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const {rpc,getUser}=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{rpc,auth:{getUser}}}))
function storage(){const map=new Map<string,string>();return{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)}}
let browser:{dataLayer:unknown[];localStorage:ReturnType<typeof storage>;sessionStorage:ReturnType<typeof storage>;dispatchEvent:ReturnType<typeof vi.fn>}
function reply(data:unknown,error:unknown=null){const promise=Promise.resolve({data,error});return Object.assign(promise,{abortSignal:()=>promise})}
beforeEach(()=>{
 vi.resetModules();rpc.mockReset();getUser.mockReset()
 browser={dataLayer:[],localStorage:storage(),sessionStorage:storage(),dispatchEvent:vi.fn()}
 browser.localStorage.setItem('vimbre:analytics-consent:v1','accepted')
 vi.stubGlobal('window',browser);vi.stubGlobal('localStorage',browser.localStorage);vi.stubGlobal('navigator',{onLine:true})
})
afterEach(()=>vi.unstubAllGlobals())
it('waits for server acknowledgement and emits no content or IDs',async()=>{
 const {changeTask}=await import('../features/my-day/api')
 let finish!:(r:unknown)=>void;rpc.mockReturnValue(new Promise(resolve=>{finish=resolve}))
 const saving=changeTask('task-id','create',{title:'Secret client work',source_kind:'ai'})
 expect(browser.dataLayer).toEqual([])
 finish({data:'task-id',error:null});await saving
 expect(browser.dataLayer).toEqual([{event:'action_created',success:true,source_type:'ai',action_type:'task',action_count:1}])
})
it('does not report failed task mutations',async()=>{
 const {changeTask}=await import('../features/my-day/api');rpc.mockReturnValue(reply(null,{message:'failed'}))
 await expect(changeTask('task-id','create',{title:'Draft'})).rejects.toBeTruthy()
 await expect(changeTask('task-id','status',{status:'done'})).rejects.toBeTruthy()
 expect(browser.dataLayer).toEqual([])
})
it('does not report queued offline work until it successfully syncs',async()=>{
 const {changeTask}=await import('../features/my-day/api');const {setOfflineOwner,syncOffline}=await import('../features/my-day/offline')
 setOfflineOwner('owner');vi.stubGlobal('navigator',{onLine:false})
 await changeTask('task-id','create',{title:'Private offline draft'})
 expect(rpc).not.toHaveBeenCalled();expect(browser.dataLayer).toEqual([])
 vi.stubGlobal('navigator',{onLine:true});getUser.mockResolvedValue({data:{user:{id:'owner'}}});rpc.mockReturnValue(reply('task-id'))
 await syncOffline();await syncOffline()
 expect(browser.dataLayer).toEqual([{event:'action_created',success:true,source_type:'manual',action_type:'task',action_count:1}])
})
it('does not report a conflicted offline edit as completed',async()=>{
 const {queueTask,setOfflineOwner,syncOffline}=await import('../features/my-day/offline');setOfflineOwner('owner')
 queueTask('task-id','edit',{status:'done'},{completed:true})
 getUser.mockResolvedValue({data:{user:{id:'owner'}}});rpc.mockReturnValue(reply({conflict:true}))
 await syncOffline();expect(browser.dataLayer).toEqual([])
})
it('deduplicates completion reported through the ordinary and scheduled-plan surfaces',async()=>{
 const {changeTask}=await import('../features/my-day/api');const {planTaskAction}=await import('../features/my-day/plan-api');rpc.mockReturnValue(reply('task-id'))
 await changeTask('task-id','status',{status:'done'});await planTaskAction('task-id','done')
 expect(browser.dataLayer).toEqual([{event:'action_completed',success:true,source_type:'manual',action_type:'task'}])
})
it('reports only newly confirmed Capture tasks, excluding old confirmations and pending assignments',async()=>{
 const {confirmCapture}=await import('../features/capture/capture-api')
 rpc.mockReturnValue(reply({items:[
  {id:'chosen',kind:'action',status:'confirmed',action_id:'new-task',payload:{title:'Confidential'}},
  {id:'old',kind:'action',status:'confirmed',action_id:'old-task'},
  {id:'assigned',kind:'action',status:'confirmed',assignment_id:'assignment'},
  {id:'decision',kind:'decision',status:'confirmed',decision_id:'private-decision'},
 ]}))
 await confirmCapture('capture',[{id:'chosen',version:1},{id:'assigned',version:1},{id:'decision',version:1}])
 await confirmCapture('capture',[{id:'chosen',version:1}])
 expect(browser.dataLayer).toEqual([{event:'action_created',success:true,source_type:'capture',action_type:'task',action_count:1}])
})
it('reports new imports by confirmed count and ignores all-duplicate imports',async()=>{
 const {daySuite}=await import('../features/my-day/suite-api')
 rpc.mockReturnValueOnce(reply({added:3,duplicates:1})).mockReturnValueOnce(reply({added:0,duplicates:4}))
 await daySuite('import',null,{fingerprint:'local-fingerprint',rows:[]});await daySuite('import',null,{fingerprint:'same-file',rows:[]})
 expect(browser.dataLayer).toEqual([{event:'action_created',success:true,source_type:'import',action_type:'task',action_count:3}])
})
it('reports a handover first save once and excludes autosaves and failures',async()=>{
 const {handoverRpc}=await import('../features/handovers/model')
 rpc.mockReturnValueOnce(reply({id:'handover',version:1,handover_type:'leave',title:'Private'})).mockReturnValueOnce(reply({id:'handover',version:2,handover_type:'leave'})).mockReturnValueOnce(reply(null,{message:'failed'}))
 await handoverRpc('save','handover',{});await handoverRpc('save','handover',{})
 await expect(handoverRpc('save','failed',{})).rejects.toThrow('failed')
 expect(browser.dataLayer).toEqual([{event:'handover_created',success:true,source_type:'manual',context_type:'leave'}])
})
