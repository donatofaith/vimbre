import {describe,it,expect} from 'vitest'
import {reminderDate,reminderLabel,reminderPath,parseWorkInbox} from './notification-utils'
import type {WorkReminder} from './notification-utils'
const reminder:WorkReminder={notification_key:'test',source_kind:'task',source_id:'123',title:'Send report',due_date:'2026-10-20',stage:'today',section:null,read_at:null}
describe('work notifications',()=>{
 it('labels each deadline phase',()=>{expect(reminderLabel(reminder)).toBe('Due today');expect(reminderLabel({...reminder,stage:'approaching'})).toBe('Due soon');expect(reminderLabel({...reminder,stage:'overdue'})).toBe('Overdue')})
 it('opens the actual source',()=>{expect(reminderPath(reminder)).toBe('/app?task=123');expect(reminderPath({...reminder,source_kind:'role_item',section:'responsibility'})).toBe('/app/role-record?section=responsibility&record=123')})
 it('rejects malformed inbox responses',()=>{expect(parseWorkInbox({})).toBeNull();expect(parseWorkInbox({unread:0,count:0,items:[]})).not.toBeNull();expect(parseWorkInbox({unread:1,count:1,items:[{...reminder,due_date:'20 Oct'}]})).toBeNull()})
 it('formats stored calendar dates without a UTC shift',()=>{expect(reminderDate('2026-10-20')).toContain('20');expect(reminderDate('2026-10-20')).toContain('2026')})
})
