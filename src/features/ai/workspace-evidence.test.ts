import {expect,it}from 'vitest'
import {readAnswer}from './workspace-evidence'
const source={ref:'decision:1',title:'Supplier review',path:'/app/role-record?record=1',kind:'decision'}
it('only displays citations returned with the authoritative evidence',()=>{const result=readAnswer(JSON.stringify({answer:'Alex made the decision.',citations:['decision:1','invented']}),[source]);expect(result.sources).toEqual([source])})
it('rejects malformed answers and unsafe source paths',()=>{expect(()=>readAnswer('broken',[])).toThrow();expect(readAnswer(JSON.stringify({answer:'Found it',citations:['decision:1']}),[{...source,path:'//evil.test'}]).sources).toEqual([])})
