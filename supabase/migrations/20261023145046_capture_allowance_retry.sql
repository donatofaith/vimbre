-- An allowance rejection consumes no redraft; no provider request was made.
create function private.capture_ai_cancel(p_user uuid,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare j private.capture_ai_jobs;begin
 select * into j from private.capture_ai_jobs where request_id=p_request and owner_id=p_user and state='pending' for update;
 if not found then return;end if;
 if j.task='capture_extract' then update public.captures set draft_attempts=greatest(0,draft_attempts-1) where id=j.capture_id;end if;
 delete from private.capture_ai_jobs where request_id=j.request_id;
end$$;
revoke all on function private.capture_ai_cancel(uuid,uuid) from public,anon,authenticated;
grant execute on function private.capture_ai_cancel(uuid,uuid) to service_role;
create function public.capture_ai_cancel(p_user uuid,p_request uuid) returns void language sql security invoker set search_path='' as $$select private.capture_ai_cancel(p_user,p_request)$$;
revoke all on function public.capture_ai_cancel(uuid,uuid) from public,anon,authenticated;
grant execute on function public.capture_ai_cancel(uuid,uuid) to service_role;
-- Reconfirm source ownership and do not accept arbitrary JSON result objects.
-- Individual confirmed task/decision/summary IDs are written only in the guarded function.
