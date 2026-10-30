import type {DayData} from './types'
/** Apply successful deletes immediately while the authoritative list refreshes. */
export function withoutDeletedTasks(day:DayData,deleted:ReadonlySet<string>):DayData{
 const keep=(task:{id:string})=>!deleted.has(task.id)
 const rows=day.rows.filter(keep)
 return {...day,rows,count:Math.max(0,day.count-(day.rows.length-rows.length)),overdue_rows:day.overdue_rows?.filter(keep),done_today:day.done_today?.filter(keep),upcoming:day.upcoming?.filter(keep),undated:day.undated?.filter(keep)}
}
