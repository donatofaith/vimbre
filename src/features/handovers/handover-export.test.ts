import {afterEach,expect,it,vi}from 'vitest'
import {printHandover}from './handover-export'
import {emptySections}from './model'
afterEach(()=>vi.unstubAllGlobals())
it('exports visible sections with escaped text and omits the manager-only note',()=>{const write=vi.fn(),print=vi.fn();vi.stubGlobal('window',{open:()=>({opener:{},document:{write,close:vi.fn()},print})});printHandover({title:'<script>bad</script>',owner_name:'Alex',starts_on:'2026-11-03',ends_on:'2026-11-10',sections:{...emptySections(),summary:'Supplier review & delivery',note_for_manager:'PRIVATE MANAGER NOTE'} as ReturnType<typeof emptySections>});expect(write.mock.calls[0][0]).toContain('&lt;script&gt;bad&lt;/script&gt;');expect(write.mock.calls[0][0]).not.toContain('PRIVATE MANAGER NOTE');expect(print).toHaveBeenCalledOnce()})
