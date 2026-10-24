-- Keep context explicitly confirmed and support Archived in the task editor.
create or replace function private.myday_action(p_id uuid,p_operation text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c uuid:=private.current_company_id(); a public.actions; target uuid; tz text; outcome_title text; body text;
begin
 if u is null or c is null then raise insufficient_privilege;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>22000 then raise exception 'Invalid task data' using errcode='22023';end if;
 if p_operation='create' then
  insert into public.actions(id,owner_id,company_id,title,details,due_date,due_time,status,source_url,completion_note,department_id,external_contact_id,source_kind,reminder_option,priority)
  values(p_id,u,c,p_data->>'title',coalesce(p_data->>'details',''),(p_data->>'due_date')::date,nullif(p_data->>'due_time','')::time,'open',nullif(p_data->>'source_url',''),coalesce(p_data->>'completion_note',''),nullif(p_data->>'department_id','')::uuid,nullif(p_data->>'external_contact_id','')::uuid,coalesce(p_data->>'source_kind','manual'),coalesce(p_data->>'reminder_option','at_time'),coalesce(p_data->>'priority','normal')) on conflict(id) do nothing;
  if not exists(select 1 from public.actions where id=p_id and owner_id=u and company_id=c) then raise insufficient_privilege;end if;
  return p_id;
 end if;
 select * into a from public.actions where id=p_id and owner_id=u and company_id=c for update;
 if not found then raise insufficient_privilege;end if;
 if p_operation='edit' then
  if a.deleted_at is not null then raise exception 'Restore this task first' using errcode='22023';end if;
  update public.actions set title=p_data->>'title',details=coalesce(p_data->>'details',''),due_date=(p_data->>'due_date')::date,due_time=nullif(p_data->>'due_time','')::time,
  source_url=nullif(p_data->>'source_url',''),completion_note=coalesce(p_data->>'completion_note',''),department_id=nullif(p_data->>'department_id','')::uuid,external_contact_id=nullif(p_data->>'external_contact_id','')::uuid,reminder_option=coalesce(p_data->>'reminder_option','at_time'),deleted_at=case when p_data->>'status'='archived' then now() else deleted_at end,status=case when p_data->>'status'='archived' then status else coalesce(p_data->>'status',status) end,priority=coalesce(p_data->>'priority',priority) where id=a.id;
 elsif p_operation='pin' then
  if a.deleted_at is not null or a.status='done' then raise exception 'Only unfinished tasks can be pinned.' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,319));
  update public.actions set pinned_at=case when coalesce((p_data->>'pinned')::boolean,false) then now() else null end where id=a.id;
 elsif p_operation='status' then
  if a.deleted_at is not null then raise exception 'Restore this task first' using errcode='22023';end if;
  update public.actions set status=p_data->>'status' where id=a.id;
 elsif p_operation in ('snooze','reschedule') then
  if a.status='done' or a.deleted_at is not null then raise exception 'This task is no longer open' using errcode='22023';end if;
  select coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London') into tz;
  if p_operation='reschedule' then
   if (((p_data->>'due_date')::date+coalesce(nullif(p_data->>'due_time','')::time,(select reminder_time from public.work_preferences where owner_id=u),time '09:00')) at time zone tz)<=now() then raise exception 'Choose a future date and time' using errcode='22023';end if;
   update public.actions set due_date=(p_data->>'due_date')::date,due_time=nullif(p_data->>'due_time','')::time,status='open',reminder_cycle=reminder_cycle+1,reminder_sent_at=null,check_in_sent_at=null,overdue=false where id=a.id;
  else
   if nullif(p_data->>'until','') is null or (p_data->>'until')::timestamptz<=now() or (p_data->>'until')::timestamptz>now()+interval '32 days' then raise exception 'Choose a future reminder time' using errcode='22023';end if;
   update public.actions set remind_at=(p_data->>'until')::timestamptz,reminder_sent_at=null,check_in_sent_at=null,reminder_cycle=reminder_cycle+1,overdue=false where id=a.id;
  end if;
  update public.task_alerts set read_at=coalesce(read_at,now()) where task_id=a.id;
 elsif p_operation in ('archive','restore') then update public.actions set deleted_at=case when p_operation='archive' then now() else null end where id=a.id;
 elsif p_operation='context' then
  if a.status<>'done' or a.deleted_at is not null then raise exception 'Complete the task before adding context' using errcode='22023';end if;
  if a.context_added_at is not null then return a.context_record_id;end if;
  outcome_title:=coalesce(nullif(btrim(p_data->>'title'),''),a.title);body:=btrim(coalesce(p_data->>'details',''));
  if char_length(outcome_title)>300 or char_length(body)>5000 or body='' then raise exception 'Add an outcome before saving' using errcode='22023';end if;
  if p_data->>'kind'='decision' then
   if coalesce(btrim(p_data->>'reason'),'')='' then raise exception 'Add the reason for the decision' using errcode='22023';end if;
   insert into public.decisions(company_id,owner_id,title,reason,decided_on,decided_by,next_step) values(c,u,outcome_title,p_data->>'reason',(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date,(select full_name from public.profiles where id=u),coalesce(nullif(btrim(p_data->>'next_step'),''),body)) returning id into target;
  elsif p_data->>'kind'='workstream' then
   if nullif(p_data->>'record_id','') is null then raise exception 'Choose the open work to update' using errcode='22023';end if;
   update public.role_items set details=concat_ws(E'\n\n',nullif(details,''),outcome_title||E'\n'||body),next_step=coalesce(nullif(btrim(p_data->>'next_step'),''),next_step) where id=(p_data->>'record_id')::uuid and owner_id=u and company_id=c and kind='workstream' and deleted_at is null returning id into target;
   if target is null then raise insufficient_privilege;end if;
  elsif p_data->>'kind'='note' then
   insert into public.role_work_notes(owner_id,company_id,task_id,title,details) values(u,c,a.id,outcome_title,body) returning id into target;
  else raise exception 'Choose where to save the context' using errcode='22023';end if;
  update public.actions set completion_note=body,context_kind=p_data->>'kind',context_record_id=target,context_added_at=now() where id=a.id;
 else raise exception 'Unknown task operation' using errcode='22023';end if;
 if p_operation='context' then return target;end if;
 return a.id;
end $$;
