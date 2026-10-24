export type AIDocument = { media_type: 'application/pdf'; data: string }
import { supabase } from './supabase'
export type AITask = 'capture_extract' | 'tidy_text' | 'weekly_summary' | 'handover_draft' | 'handover_return' | 'role_responsibility' | 'role_workstream' | 'role_external_contact' | 'role_document' | 'role_recurring_deadline' | 'role_decision' | 'tasks_extract' | 'task_context'
export type AIResult = {ok:true; text:string; request_id:string} | {ok:false; message:string; can_continue_manually:true; code?:'limit_reached'}
// All AI features call this gateway. Provider credentials stay on the server.
export async function runAI(task: AITask,text: string,requestId: string=crypto.randomUUID(), document?: AIDocument, capture?:{id:string;redraft?:boolean}, handover?:{id:string;redraft?:boolean}): Promise<AIResult> {
  const fallback:AIResult={ok:false,message:'AI is unavailable right now. You can continue by hand.',can_continue_manually:true}
  try {
    const {data,error}=await supabase.functions.invoke('ai-run',{body:{task,text:capture?'Capture source':handover?'Saved handover':text,...(document?{document}:{}),...(capture?{capture_id:capture.id,redraft:capture.redraft===true}:{}),...(handover?{handover_id:handover.id,redraft:handover.redraft===true}:{})},headers:{'Idempotency-Key':requestId}})
    if(error) {
      if('context' in error && error.context instanceof Response) {
        try {const body=await error.context.json();if(body.ok===false&&typeof body.message==='string')return {...fallback,message:body.message,...(body.code==='limit_reached'?{code:'limit_reached' as const}:{})}} catch { /* Keep the safe manual fallback. */ }
      }
      return fallback
    }
    if(data?.ok===true&&typeof data.text==='string'&&typeof data.request_id==='string')return {ok:true,text:data.text,request_id:data.request_id}
    return data?.ok===false&&typeof data.message==='string'?{...fallback,message:data.message,...(data.code==='limit_reached'?{code:'limit_reached' as const}:{})}:fallback
  } catch {return fallback}
  finally {window.dispatchEvent(new Event('vimbre:ai-usage'))}
}

