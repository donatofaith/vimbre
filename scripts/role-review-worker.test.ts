import {it,expect,vi} from 'vitest'
import {deliverRoleReviews} from '../supabase/functions/my-day-mail/role-worker'
it('sends a claimed reminder once and records an ambiguous send without retrying',async()=>{const rpc=vi.fn(async(op:string)=>op==='claim'?[{id:'one',email:'fixture@example.invalid',name:'Fixture',title:'Review your role',body:'Check your role'}]:{});const send=vi.fn(async()=>{throw Error('Network failed')});await deliverRoleReviews({rpc,send});expect(send).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenLastCalledWith('finish','one','failed')})
