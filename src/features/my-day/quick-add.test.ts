import {describe,it,expect} from 'vitest'
import {parseQuickTask} from './quick-add'
describe('quick task dates without AI',()=>{
 it('extracts weekday and afternoon time',()=>expect(parseQuickTask('Send quote Friday 3pm','2026-10-26')).toEqual({title:'Send quote',due_date:'2026-10-30',due_time:'15:00'}));
 it('rolls to next week when that weekday is today',()=>expect(parseQuickTask('Send report Monday','2026-10-26').due_date).toBe('2026-11-02'));
 it('parses the client reminder example',()=>expect(parseQuickTask('Send quote Friday 3pm remind me Thursday','2026-10-26')).toEqual({title:'Send quote',due_date:'2026-10-30',due_time:'15:00',reminder_date:'2026-10-29'}));
 it('keeps ordinary text and handles midnight',()=>{expect(parseQuickTask('Call the supplier','2026-10-26').title).toBe('Call the supplier');expect(parseQuickTask('Review tomorrow 12am','2026-10-26').due_time).toBe('00:00')});
});
