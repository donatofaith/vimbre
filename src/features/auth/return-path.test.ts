import {it,expect} from 'vitest'
import {myDayReturnPath} from './return-path'
const id='11111111-1111-4111-8111-111111111111'
it('preserves the task and review operation after login',()=>{expect(myDayReturnPath(`?task=${id}&task_action=reschedule`)).toBe(`/app?task=${id}&task_action=reschedule`)})
it('cannot redirect to an external URL or carry arbitrary parameters',()=>{expect(myDayReturnPath('https://example.invalid')).toBe('/app');expect(myDayReturnPath(`?task=${id}&next=https://example.invalid&task_action=delete`)).toBe(`/app?task=${id}`)})
it('rejects malformed task identities and nonstring state',()=>{for(const v of [null,{},123,'?task=another-person'])expect(myDayReturnPath(v)).toBe('/app')})
