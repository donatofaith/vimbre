import {expect,it}from 'vitest'
import {parsePriorities}from './priority-output'
const allowed=new Set(['a','b','c','d'])
it('accepts a selective list or no justified priorities',()=>{expect(parsePriorities('{"items":[{"id":"a","reason":"Due today"}]}',allowed)).toEqual([{id:'a',reason:'Due today'}]);expect(parsePriorities('{"items":[]}',allowed)).toEqual([])})
it('rejects a task dump, invented IDs, duplicate picks and empty reasons',()=>{for(const items of [[...allowed].map(id=>({id,reason:'Open'})),[{id:'foreign',reason:'Due'}],[{id:'a',reason:'Due'},{id:'a',reason:'Due'}],[{id:'b',reason:'  '}]])expect(()=>parsePriorities(JSON.stringify({items}),allowed)).toThrow()})
