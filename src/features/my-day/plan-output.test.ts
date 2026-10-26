import {it,expect} from 'vitest'
import {parsePlan} from './plan-output'
it('accepts only proposals for the supplied tasks and keeps reasons short',()=>{expect(parsePlan('```json\n{"items":[{"id":"a","reason":"Due today"}]}\n```',new Set(['a']))).toEqual([{id:'a',reason:'Due today'}])})
it('rejects unreadable, invented and duplicate task proposals with a manual fallback',()=>{for(const output of ['not json','null','{"items":[null]}','{"items":[{"id":"b","reason":"Other task"}]}','{"items":[{"id":"a","reason":"One"},{"id":"a","reason":"Two"}]}'])expect(()=>parsePlan(output,new Set(['a']))).toThrow('Your task order is unchanged')})
