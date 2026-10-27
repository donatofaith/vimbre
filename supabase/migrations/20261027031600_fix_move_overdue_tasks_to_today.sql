-- Make “Move all to today” actually clear overdue status for tasks whose time has already passed.
-- Keep the special handling owner/company-scoped and preserve the existing action wrapper for all other operations.
CREATE OR REPLACE FUNCTION private.myday_action(p_id uuid, p_operation text, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 state jsonb;
 result uuid;
 a public.actions;
 tz text;
 target date;
 default_time time;
begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege; end if;

 if p_operation='undo' then
  select repeat_state into state
  from private.myday_undo
  where task_id=p_id and owner_id=auth.uid();
 end if;

 if p_operation='tomorrow' and p_data is not null and jsonb_typeof(p_data)='object'
    and nullif(p_data->>'date','') is not null then
  tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');
  target:=(p_data->>'date')::date;
  if target=(now() at time zone tz)::date then
   select * into a
   from public.actions
   where id=p_id and owner_id=auth.uid() and company_id=private.current_company_id()
   for update;
   if not found then raise insufficient_privilege; end if;
   if a.deleted_at is not null or a.status='done' then
    raise exception 'Task is not open' using errcode='22023';
   end if;

   select coalesce(reminder_time,time '09:00') into default_time
   from public.work_preferences where owner_id=auth.uid();
   default_time:=coalesce(default_time,time '09:00');

   update public.actions
   set due_date=target,
       due_time=case
         when coalesce(due_time,default_time)<=(now() at time zone tz)::time then time '23:59'
         else due_time
       end,
       reminder_sent_at=null,
       check_in_sent_at=null,
       overdue=false
   where id=p_id;
   return p_id;
  end if;
 end if;

 result:=private.myday_action_base(p_id,p_operation,p_data);
 if p_operation='undo' and state is not null then
  update private.myday_repeats
  set active=true
  where owner_id=auth.uid()
    and company_id=private.current_company_id()
    and id in (select (value#>>'{}')::uuid from jsonb_array_elements(state));
 end if;
 return result;
end
$function$;
