import {it,expect} from 'vitest'
import {basicPlan} from './day-planner'
import type {Task} from './types'
const task=(id:string,extra:Partial<Task>={})=>({id,title:id,status:'open',due_date:'2026-10-27',time_needed_minutes:30,...extra}) as Task
it('keeps meetings clear, leaves ten minutes and respects working hours',()=>{
 const plan=basicPlan([task('a'),task('b'),task('c')],{start:0,end:180*60000,today:'2026-10-27',busy:[{start:20*60000,end:60*60000}]})
 expect(plan.slots.map(s=>s.start/60000)).toEqual([70,110,150]);expect(plan.slots.at(-1)!.start+30*60000).toBe(180*60000)
})
it('prioritises overdue and due tasks, caps six and excludes done or deleted',()=>{
 const tasks=[...Array.from({length:8},(_,i)=>task(String(i))),task('late',{due_date:'2026-10-26'}),task('done',{status:'done'}),task('deleted',{deleted_at:'2026-10-27'})]
 const plan=basicPlan(tasks,{start:0,end:1000*60000,today:'2026-10-27'})
 expect(plan.slots).toHaveLength(6);expect(plan.slots[0].id).toBe('late');expect(plan.skipped).toHaveLength(3)
})
it('does not change source tasks or force work outside hours',()=>{const tasks=[task('a',{time_needed_minutes:60})];const before=JSON.stringify(tasks);expect(basicPlan(tasks,{start:0,end:30*60000,today:'2026-10-27'}).slots).toEqual([]);expect(JSON.stringify(tasks)).toBe(before)})
it('does not schedule invalid working hours or non-finite durations',()=>{expect(basicPlan([task('a')],{start:NaN,end:Infinity,today:'2026-10-27'}).slots).toEqual([])})
