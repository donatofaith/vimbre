import {queueTask} from './offline'
import {trackTaskCreated, trackTaskCompleted} from '../../lib/analytics'
import { supabase } from "../../lib/supabase";
import type { Json } from "../../lib/database.types";
export async function changeTask(
  id: string,
  operation: string,
  data: Record<string, unknown> = {},
  analytics?: {completed?: boolean},
) {
  if(!navigator.onLine)return queueTask(id,operation,data,analytics);
  const result = await supabase.rpc("myday_action", {
    p_id: id,
    p_operation: operation,
    p_data: data as Json,
  });
  if (result.error) throw result.error;
  if (operation === 'create') {
    trackTaskCreated(result.data, data.source_kind === 'ai' ? 'ai' : 'manual');
    if (data.status === 'done') trackTaskCompleted(result.data, 'manual');
  }
  if (operation === 'status' && data.status === 'done') trackTaskCompleted(id, 'manual');
  window.dispatchEvent(new Event("vimbre:work-changed"));
  return result.data;
}
export function taskError(reason: unknown) {
  const message=(reason as {message?:string})?.message??'';
  if(message.includes('matching item already exists'))return 'A matching item already exists. Review or dismiss this draft.';
  if(message.includes('Undo expired'))return 'Undo has expired or this task changed. Refresh the task.';
  const code = (reason as { code?: string })?.code;
  if(code === "40001")return "This task changed in another session. Close it and reload before saving.";
  return code === "42501"
    ? "This task is unavailable. Refresh the page and try again."
    : code === "22023" ||
        code === "23514" ||
        code === "23503" ||
        code === "23502"
      ? "Check the title, date, department or external contact and try again."
      : "Your change could not be saved. Your draft is still here. Please try again.";
}
