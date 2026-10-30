import {expect,it} from 'vitest'
import {withoutDeletedTasks} from './task-deletion'
import type {DayData,Task} from './types'
const task=(id:string)=>({id,title:id}) as Task
it('removes a successfully deleted task from every visible task group without mutating the snapshot',()=>{const deleted=task('deleted'),kept=task('kept');const day={rows:[deleted,kept],count:20,overdue_rows:[deleted],done_today:[deleted,kept],upcoming:[deleted],undated:[deleted]} as DayData;const next=withoutDeletedTasks(day,new Set(['deleted']));expect(next.rows).toEqual([kept]);expect(next.count).toBe(19);expect(next.overdue_rows).toEqual([]);expect(next.done_today).toEqual([kept]);expect(next.upcoming).toEqual([]);expect(next.undated).toEqual([]);expect(day.rows).toHaveLength(2)})
it('does not double-decrement totals for duplicate groups or later refreshes',()=>{const day={rows:[task('one')],count:1,overdue_rows:[task('one')]} as DayData;const once=withoutDeletedTasks(day,new Set(['one']));expect(once.count).toBe(0);expect(withoutDeletedTasks(once,new Set(['one'])).count).toBe(0)})
