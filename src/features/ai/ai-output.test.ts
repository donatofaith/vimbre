import { describe, expect, it } from 'vitest'
import { parseExtraction, validateAIInput } from './ai-output'
const base = { decisions: [], tasks: [], external_contacts: [] }
describe('AI draft validation', () => {
  it('maps the provider contract to pending review fields without inventing missing facts', () => {
    const rows = parseExtraction(JSON.stringify({ decisions: [{ decision: 'Review suppliers monthly', why: 'Reduce meetings', date: '2026-10-12', owner: 'Operations', next_step: 'Share the notes' }], tasks: [{title: 'Send notes', due_date: null, owner: null}], external_contacts: [{name: 'Ada', organisation: 'Acme', contact_details: 'ada@example.invalid', context: 'Supplier contact'}] }))
    expect(rows[0]).toEqual({kind:'decision', payload:{title:'Review suppliers monthly',reason:'Reduce meetings',decided_on:'2026-10-12',decided_by:'Operations',next_step:'Share the notes'}})
    expect(rows[1].payload).toEqual({title:'Send notes',details:'',due_date:''})
    expect(rows[2].payload.details).toBe('Acme\nada@example.invalid\nSupplier contact')
    expect(rows[0]).not.toHaveProperty('status')
  })
  it('leaves ambiguous, relative and impossible dates blank for the reviewer', () => {
    for (const date of ['tomorrow', '12 October', '2026-02-30', '2026-99-99']) expect(parseExtraction(JSON.stringify({...base, tasks:[{title:'Check report',due_date:date}]}))[0].payload.due_date).toBe('')
  })
  it('rejects invalid JSON, wrong shapes, non-string fields and excessive output before saving', () => {
    for (const value of ['not json', '{}', '[]', JSON.stringify({...base,tasks:[null]}), JSON.stringify({...base,tasks:[{title:12}]}), JSON.stringify({...base,tasks:[{title:'a'.repeat(201)}]}), JSON.stringify({...base,tasks:Array(31).fill({title:'Task'})})]) expect(() => parseExtraction(value)).toThrow()
  })
  it('accepts a JSON code fence and empty findings without fabricating drafts', () => {
    expect(parseExtraction('```json\n'+JSON.stringify(base)+'\n```')).toEqual([])
  })
  it('keeps markup as plain data, never evaluates it', () => {
    expect(parseExtraction(JSON.stringify({...base,tasks:[{title:'<script>alert(1)</script>'}]}))[0].payload.title).toBe('<script>alert(1)</script>')
  })
  it('checks UTF8 bytes before any gateway request', () => {
    expect(validateAIInput(' ')).toBeTruthy()
    expect(validateAIInput('a'.repeat(16000))).toBeNull()
    expect(validateAIInput('😀'.repeat(4001))).toBeTruthy()
  })
})
