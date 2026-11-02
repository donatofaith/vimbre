import {supabase} from '../../lib/supabase'
import type {CaptureDetail} from './capture-types'

/** Keep draft edits separate from publishing work to the workspace. */
export async function reviewCaptureDraft(capture:string,id:string,data:Record<string,string>,version:number,editing:boolean){
 const saved=await supabase.rpc('capture_change',{p_operation:editing?'edit':'add',p_id:id,p_capture:capture,p_data:{...data,version}})
 if(saved.error)throw saved.error
 const [result,duplicates]=await Promise.all([
  supabase.rpc('capture_workspace',{p_action:'detail',p_id:capture}),
  supabase.rpc('capture_pipeline',{p_operation:'duplicates',p_id:capture}),
 ])
 if(result.error||duplicates.error)throw {code:'40001'}
 const detail=result.data as unknown as CaptureDetail|null
 const reviewed=detail?.items?.find(item=>item.id===id)
 // A different session may have edited the item between our save and read.
 if(detail?.source.id!==capture||reviewed?.status!=='pending'||reviewed.version!==(editing?version+1:1))throw {code:'40001'}
 return {detail,version:reviewed.version,duplicates:Array.isArray(duplicates.data)?duplicates.data as string[]:[]}
}
