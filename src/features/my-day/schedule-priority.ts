import {supabase} from '../../lib/supabase'
/** Use the existing owner-checked date action, then record the daily choice. */
export async function schedulePriorityForToday(id:string,today:string){
 const moved=await supabase.rpc('myday_action',{p_id:id,p_operation:'tomorrow',p_data:{date:today}})
 if(moved.error)throw moved.error
 let choiceSaved=false
 try{const accepted=await supabase.rpc('myday_daily',{p_action:'accept',p_task:id});choiceSaved=!accepted.error}catch{/* The task date is already saved. */}
 window.dispatchEvent(new Event('vimbre:work-changed'))
 return {choiceSaved}
}
