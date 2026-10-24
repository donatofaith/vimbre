import { describe, it, expect } from 'vitest'
import { parseStructured } from './structured-output'
describe('Structured AI review data',()=>{
 it('maps every tab to its own fields, ignoring invented identifiers and permissions',()=>{
  const row={title:'Supplier review',details:'Check the notes.',recurrence:'Monthly',work_status:'waiting',next_step:'Send notes',organisation:'Acme',contact_details:'ada@example.invalid',contact_context:'Ask about invoices',url:'https://example.invalid/guide',due_date:'2026-11-06',reason:'Reduce meetings',decided_on:'2026-10-22',decided_by:'Operations',source_url:'https://example.invalid/notes',id:'forged',owner_id:'forged',status:'confirmed'}
  for(const kind of ['responsibility','workstream','external_contact','document','recurring_deadline','decision','task'] as const){const [draft]=parseStructured(JSON.stringify({items:[row]}),kind);expect(draft.title).toBe('Supplier review');for(const field of ['id','owner_id','status'])expect(draft).not.toHaveProperty(field)}
 })
 it('rejects malformed, excessive and non-string fields before any save',()=>{
  for(const raw of ['{}','[]','not JSON',JSON.stringify({items:Array(13).fill({title:'a'})}),JSON.stringify({items:[{title:5}]}),JSON.stringify({items:[{title:'a'.repeat(301)}]}),JSON.stringify({items:[null]})])expect(()=>parseStructured(raw,'task')).toThrow()
 })
 it('leaves ambiguous or impossible dates blank and rejects unsafe links',()=>{
  for(const date of ['tomorrow','2026-02-30','2026-10-99'])expect(parseStructured(JSON.stringify({items:[{title:'Send report',due_date:date}]}),'task')[0].due_date).toBe('')
  expect(parseStructured(JSON.stringify({items:[{title:'Guide',url:'javascript:alert(1)'}]}),'document')[0].url).toBe('')
 })
 it('preserves plain text without HTML execution and accepts empty results',()=>{
  expect(parseStructured('{"items":[]}','responsibility')).toEqual([])
  expect(parseStructured('```json\n{"items":[{"title":"<img onerror=alert(1)>"}]}\n```','responsibility')[0].title).toContain('<img')
 })
})
