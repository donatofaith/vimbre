import { supabase } from "../../lib/supabase";
import type { Json } from "../../lib/database.types";
export async function changeTask(
  id: string,
  operation: string,
  data: Record<string, unknown> = {},
) {
  const result = await supabase.rpc("myday_action", {
    p_id: id,
    p_operation: operation,
    p_data: data as Json,
  });
  if (result.error) throw result.error;
  window.dispatchEvent(new Event("vimbre:work-changed"));
  return result.data;
}
export function taskError(reason: unknown) {
  const code = (reason as { code?: string })?.code;
  return code === "42501"
    ? "This task is unavailable. Refresh the page and try again."
    : code === "22023" ||
        code === "23514" ||
        code === "23503" ||
        code === "23502"
      ? "Check the title, date, department or external contact and try again."
      : "Your change could not be saved. Your draft is still here. Please try again.";
}
