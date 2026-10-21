import { supabase } from './supabase'
export type AITask = 'capture_extract' | 'tidy_text' | 'weekly_summary' | 'handover_draft'
export type AIResult = {ok:true; text:string; request_id:string} | {ok:false; message:string; can_continue_manually:true}
// All AI features call this gateway. Provider credentials stay on the server.
export async function runAI(task: AITask,text: string,requestId: string=crypto.randomUUID()): Promise<AIResult> {
  const fallback:AIResult={ok:false,message:'AI is unavailable right now. You can continue by hand.',can_continue_manually:true}
  try {
    const {data,error}=await supabase.functions.invoke('ai-run',{body:{task,text},headers:{'Idempotency-Key':requestId}})
    if(error) {
      if('context' in error && error.context instanceof Response) {
        try {const body=await error.context.json();if(body.ok===false&&typeof body.message==='string')return {...fallback,message:body.message}} catch { /* Keep the safe manual fallback. */ }
      }
      return fallback
    }
    if(data?.ok===true&&typeof data.text==='string'&&typeof data.request_id==='string')return {ok:true,text:data.text,request_id:data.request_id}
    return data?.ok===false&&typeof data.message==='string'?{...fallback,message:data.message}:fallback
  } catch {return fallback}
}
