-- Keep the PL/pgSQL task row separate from SQL task aliases.
CREATE OR REPLACE FUNCTION private.myday_action(p_id uuid, p_operation text, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 state jsonb;
 result uuid;
 task_row public.actions;
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
   select * into task_row
   from public.actions
   where id=p_id and company_id=private.current_company_id()
     and (owner_id=auth.uid() or exists(
       select 1 from public.work_handovers h
       join private.handover_items hi on hi.handover_id=h.id and hi.kind='task' and hi.record_id=p_id and hi.approved
       where h.owner_id=public.actions.owner_id and h.company_id=public.actions.company_id and h.cover_id=auth.uid()
        and h.status='approved' and h.cover_response='accepted' and h.deleted_at is null
        and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date between h.starts_on and coalesce(h.ends_on,'infinity'::date)
        and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=p_id and hb.status in('pending','returned'))
     ))
   for update;
   if not found then raise insufficient_privilege; end if;
   if task_row.deleted_at is not null or task_row.status='done' then
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


 if p_operation in ('edit','status','tomorrow') and exists(
   select 1 from public.actions task_source join public.work_handovers h on h.owner_id=task_source.owner_id and h.company_id=task_source.company_id and h.cover_id=auth.uid()
   join private.handover_items hi on hi.handover_id=h.id and hi.record_id=task_source.id and hi.kind='task' and hi.approved
   where task_source.id=p_id and task_source.company_id=private.current_company_id() and task_source.owner_id<>auth.uid() and task_source.deleted_at is null and task_source.purged_at is null
     and h.status='approved' and h.cover_response='accepted' and h.deleted_at is null
     and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date between h.starts_on and coalesce(h.ends_on,'infinity'::date)
     and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=task_source.id and hb.status in ('pending','returned'))
 ) then
   select z.* into task_row from public.actions z where z.id=p_id and z.company_id=private.current_company_id() for update;
   if p_operation='status' and p_data->>'status'='done' then
     update public.actions set status='done',completed_at=now(),completion_note=case when p_data ? 'completion_note' then left(coalesce(p_data->>'completion_note',''),1000) else completion_note end,updated_at=now()
       where id=p_id and owner_id=task_row.owner_id and company_id=task_row.company_id and deleted_at is null;
     update private.handover_items set completed_by=auth.uid(),completed_at=coalesce(completed_at,now()) where record_id=p_id and kind='task' and handover_id in(select id from public.work_handovers where owner_id=task_row.owner_id and cover_id=auth.uid() and status='approved' and cover_response='accepted');
   elsif p_operation='tomorrow' then
     if nullif(p_data->>'date','') is null or (p_data->>'date')::date<(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date then
       raise check_violation using message='Choose today or a later date.';
     end if;
     update public.actions set due_date=(p_data->>'date')::date,reminder_sent_at=null,check_in_sent_at=null,overdue=false,updated_at=now() where id=p_id and owner_id=task_row.owner_id and company_id=task_row.company_id;
   else
     if p_data ? 'title' and length(btrim(coalesce(p_data->>'title','')))<1 then raise check_violation using message='Enter a task title.'; end if;
     update public.actions set
       title=case when p_data?'title' then btrim(p_data->>'title') else title end,
       details=case when p_data?'details' then left(p_data->>'details',6000) else details end,
       due_date=case when p_data?'due_date' then nullif(p_data->>'due_date','')::date else due_date end,
       due_time=case when p_data?'due_time' then nullif(p_data->>'due_time','')::time else due_time end,
       priority=case when p_data?'priority' and p_data->>'priority'=any(array['low','normal','high','urgent']) then p_data->>'priority' else priority end,
       steps=case when p_data?'steps' and jsonb_typeof(p_data->'steps')='array' then p_data->'steps' else steps end,
       links=case when p_data?'links' and jsonb_typeof(p_data->'links')='array' then p_data->'links' else links end,
       label=case when p_data?'label' then nullif(left(btrim(p_data->>'label'),80),'') else label end,
       time_needed_minutes=case when p_data?'time_needed_minutes' then greatest(1,least(1440,(p_data->>'time_needed_minutes')::integer)) else time_needed_minutes end,
       reminder_sent_at=null,check_in_sent_at=null,overdue=false,updated_at=now()
     where id=p_id and owner_id=task_row.owner_id and company_id=task_row.company_id;
   end if;
   insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(task_row.company_id,auth.uid(),'task',p_id,'cover_task_'||p_operation);
   return p_id;
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

-- My Day's invoker projection calls this guarded helper for review rows.
grant execute on function private.handover_authorized(public.work_handovers,boolean) to authenticated;
