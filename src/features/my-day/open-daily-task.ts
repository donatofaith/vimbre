import {supabase} from '../../lib/supabase'
import {parseDay} from './types'
import type {Task} from './types'
/** Fetch the owner-checked task without changing the active view or route. */
export async function loadDailyTask(id:string):Promise<Task>{
 const {data,error}=await supabase.rpc('myday_tasks',{p_filter:'all',p_query:'',p_for:'',p_source:'',p_priority:'',p_page:0,p_task:id,p_decision:null})
 if(error)throw Error('This task could not be opened. Try again.')
 const value=parseDay(data)
 const task=[...(value?.rows??[]),...(value?.overdue_rows??[]),...(value?.done_today??[]),...(value?.upcoming??[]),...(value?.undated??[])].find(t=>t.id===id)
 if(!task)throw Error('This task is no longer available. Refresh and try again.')
 return task
}
