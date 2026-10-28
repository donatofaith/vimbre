import {describe,it,expect,vi} from 'vitest'
vi.mock('../../lib/supabase',()=>({supabase:{}}))
import {parseHandoverDraft,sectionLabels} from './model'
describe('structured handover draft',()=>{
 it('keeps reviewed sections and ignores unknown provider fields',()=>{const v=parseHandoverDraft('{"summary":"Shared report","priorities":"Send report","private_source":"ignore"}');expect(v.summary).toBe('Shared report');expect(v.priorities).toBe('Send report');expect('private_source' in v).toBe(false);expect(v.notes).toBe('')})
 it('rejects invalid or empty outputs without replacing user input',()=>{for(const text of ['not JSON','[]','{}','{"summary":42}'])expect(()=>parseHandoverDraft(text)).toThrow()})
 it('keeps the client section order',()=>expect(sectionLabels.map(s=>s[1])).toEqual(['Summary','What comes first','My work','Open tasks','Decisions to keep','Contacts','Documents','Deadlines while away','Watch outs','Notes']))
})
