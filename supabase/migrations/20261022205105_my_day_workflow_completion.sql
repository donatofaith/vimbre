drop function public.myday_tasks(text,text,text,integer);
create function public.myday_tasks(p_filter text,p_query text,p_for text,p_page integer,p_task uuid default null,p_decision uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();tz text;today date;result jsonb;
begin
 if u is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_filter not in ('today','week','overdue','all','archived') or p_page<0 or p_page>100000 or char_length(p_query)>100 or char_length(p_for)>80 then raise exception 'Invalid task filter' using errcode='22023';end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 with rows as materialized (
 select a.*,d.name as department_name,r.title as external_contact_name from public.actions a
 left join public.departments d on d.id=a.department_id left join public.role_items r on r.id=a.external_contact_id
 where a.owner_id=u and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision) and (a.deleted_at is not null)=(p_filter='archived') and a.title ilike '%'||replace(replace(p_query,'%','\%'),'_','\_')||'%'
 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_filter in ('all','archived') or p_filter='today' and a.due_date=today or p_filter='week' and a.due_date between today and today+6 or p_filter='overdue' and a.status<>'done' and a.due_at<now())
 and (a.status<>'done' or a.completed_at>=now()-interval '7 days' or p_filter='archived')
 ), paged as(select * from rows order by due_at,id limit 60 offset p_page*60)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by due_at,id) from paged),'[]'::jsonb),'count',(select count(*) from rows),'today',today,'timezone',tz,
 'counts',(select jsonb_build_object('todo',count(*) filter(where status='open' and due_date=today),'progress',count(*) filter(where status='in_progress' and due_date=today),'overdue',count(*) filter(where status<>'done' and due_at<now())) from public.actions where owner_id=u and deleted_at is null),
 'has_work',exists(select 1 from public.actions where owner_id=u) or exists(select 1 from public.role_items where owner_id=u),
 'context_waiting',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.actions where owner_id=u and status='done' and deleted_at is null and context_added_at is null order by completed_at desc limit 10) q),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.myday_tasks(text,text,text,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.myday_tasks(text,text,text,integer,uuid,uuid) to authenticated;


-- Preferences remain personal. Delivery readiness exposes no configuration or secrets.
create function private.myday_preferences(p_save jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();result jsonb;begin
 if u is null or c is null then raise insufficient_privilege;end if;
 if p_save is not null then
  if jsonb_typeof(p_save)<>'object' or octet_length(p_save::text)>500 then raise exception 'Invalid reminder preferences' using errcode='22023';end if;
  insert into public.work_preferences(owner_id,company_id,timezone,reminder_time,email_enabled)
  values(u,c,p_save->>'timezone',(p_save->>'reminder_time')::time,(p_save->>'email_enabled')::boolean)
  on conflict(owner_id) do update set timezone=excluded.timezone,reminder_time=excluded.reminder_time,email_enabled=excluded.email_enabled;
 end if;
 select jsonb_build_object('timezone',coalesce(w.timezone,'Europe/London'),'reminder_time',coalesce(w.reminder_time,time '09:00'),'email_enabled',coalesce(w.email_enabled,true),'email_delivery_ready',coalesce((select enabled from private.task_delivery_config where singleton),false)) into result from (select u as id) p left join public.work_preferences w on w.owner_id=p.id;
 return result;
end $$;
revoke all on function private.myday_preferences(jsonb) from public,anon,authenticated;grant execute on function private.myday_preferences(jsonb) to authenticated;
create function public.myday_preferences(p_save jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.myday_preferences(p_save)$$;
revoke all on function public.myday_preferences(jsonb) from public,anon,authenticated;grant execute on function public.myday_preferences(jsonb) to authenticated;

create function private.adjust_work_preferences() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' or new.timezone is distinct from old.timezone or new.reminder_time is distinct from old.reminder_time then
  update public.actions set
   due_at=(due_date+coalesce(due_time,new.reminder_time)) at time zone new.timezone,
   remind_at=case reminder_option when '30_minutes' then ((due_date+coalesce(due_time,new.reminder_time)) at time zone new.timezone)-interval '30 minutes' when '1_hour' then ((due_date+coalesce(due_time,new.reminder_time)) at time zone new.timezone)-interval '1 hour' when 'day_before' then ((due_date-1)+time '09:00') at time zone new.timezone else (due_date+coalesce(due_time,new.reminder_time)) at time zone new.timezone end,
   reminder_cycle=reminder_cycle+1,reminder_sent_at=null,check_in_sent_at=null,overdue=false
  where owner_id=new.owner_id and company_id=new.company_id and status<>'done' and deleted_at is null and due_at>now();
 end if;return new;
end $$;
revoke all on function private.adjust_work_preferences() from public,anon,authenticated;
create trigger adjust_work_preferences after insert or update on public.work_preferences for each row execute function private.adjust_work_preferences();

create function public.myday_notes(p_page integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid notes page' using errcode='22023';end if;
 return jsonb_build_object('count',(select count(*) from public.role_work_notes where owner_id=auth.uid()),'rows',coalesce((select jsonb_agg(to_jsonb(n)) from (select * from public.role_work_notes where owner_id=auth.uid() order by created_at desc,id limit 20 offset p_page*20)n),'[]'::jsonb));
end $$;
revoke all on function public.myday_notes(integer) from public,anon,authenticated;grant execute on function public.myday_notes(integer) to authenticated;

update public.actions a set source_kind=case when c.source_type='email' then 'email' else 'notes' end from public.capture_items i join public.captures c on c.id=i.capture_id where i.action_id=a.id and i.status='confirmed' and i.owner_id=a.owner_id and i.company_id=a.company_id;

insert into public.ai_task_routes(task,primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled)
select 'task_context',primary_model_id,fallback_model_id,1500,temperature,enabled from public.ai_task_routes where task='tidy_text' on conflict(task) do nothing;
create or replace function private.prepare_action() returns trigger language plpgsql set search_path='' as $$
declare tz text; default_time time;
begin
 select timezone,reminder_time into tz,default_time from public.work_preferences where owner_id=new.owner_id;
 tz:=coalesce(tz,'Europe/London'); default_time:=coalesce(default_time,'09:00');
 if tg_op='INSERT' then
  new.created_at:=now(); new.reminder_cycle:=0; new.reminder_sent_at:=null;new.check_in_sent_at:=null;new.overdue:=false;
  new.context_kind:=null;new.context_record_id:=null;new.context_added_at:=null;
 elsif new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time or new.reminder_option is distinct from old.reminder_option then
  new.reminder_cycle:=old.reminder_cycle+1;new.reminder_sent_at:=null;new.check_in_sent_at:=null;new.overdue:=false;
 end if;
 new.completed_at:=case when new.status='done' then case when tg_op='UPDATE' and old.status='done' then old.completed_at else now() end else null end;
 new.updated_at:=now();
 if tg_op='INSERT' or new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time or new.reminder_option is distinct from old.reminder_option then
  new.due_at:=(new.due_date+coalesce(new.due_time,default_time)) at time zone tz;
  new.remind_at:=case new.reminder_option when '30_minutes' then new.due_at-interval '30 minutes' when '1_hour' then new.due_at-interval '1 hour' when 'day_before' then ((new.due_date-1)+time '09:00') at time zone tz else new.due_at end;
 end if;
 if new.decision_id is not null and (tg_op='INSERT' or new.decision_id is distinct from old.decision_id) and not exists(select 1 from public.decisions where id=new.decision_id and owner_id=new.owner_id and company_id=new.company_id and deleted_at is null) then raise exception 'Choose an active decision belonging to this role' using errcode='23514'; end if;
 if new.external_contact_id is not null and not exists(select 1 from public.role_items where id=new.external_contact_id and kind='external_contact' and owner_id=new.owner_id and company_id=new.company_id and deleted_at is null) then raise exception 'Choose an external contact from your role' using errcode='23514';end if;
 if new.department_id is not null and not exists(select 1 from public.departments where id=new.department_id and company_id=new.company_id and archived_at is null) then raise exception 'Choose an active department' using errcode='23514';end if;
 return new;
end $$;
create or replace function private.myday_action(p_id uuid,p_operation text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c uuid:=private.current_company_id(); a public.actions; target uuid; tz text; title text; body text;
begin
 if u is null or c is null then raise insufficient_privilege;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>22000 then raise exception 'Invalid task data' using errcode='22023';end if;
 if p_operation='create' then
  insert into public.actions(id,owner_id,company_id,title,details,due_date,due_time,status,source_url,completion_note,department_id,external_contact_id,source_kind,reminder_option)
  values(p_id,u,c,p_data->>'title',coalesce(p_data->>'details',''),(p_data->>'due_date')::date,nullif(p_data->>'due_time','')::time,'open',nullif(p_data->>'source_url',''),coalesce(p_data->>'completion_note',''),nullif(p_data->>'department_id','')::uuid,nullif(p_data->>'external_contact_id','')::uuid,coalesce(p_data->>'source_kind','manual'),coalesce(p_data->>'reminder_option','at_time')) on conflict(id) do nothing;
  if not exists(select 1 from public.actions where id=p_id and owner_id=u and company_id=c) then raise insufficient_privilege;end if;
  return p_id;
 end if;
 select * into a from public.actions where id=p_id and owner_id=u and company_id=c for update;
 if not found then raise insufficient_privilege;end if;
 if p_operation='edit' then
  update public.actions set title=p_data->>'title',details=coalesce(p_data->>'details',''),due_date=(p_data->>'due_date')::date,due_time=nullif(p_data->>'due_time','')::time,
  source_url=nullif(p_data->>'source_url',''),completion_note=coalesce(p_data->>'completion_note',''),department_id=nullif(p_data->>'department_id','')::uuid,external_contact_id=nullif(p_data->>'external_contact_id','')::uuid,reminder_option=coalesce(p_data->>'reminder_option','at_time'),status=coalesce(p_data->>'status',status) where id=a.id;
 elsif p_operation='status' then
  if a.deleted_at is not null then raise exception 'Restore this task first' using errcode='22023';end if;
  update public.actions set status=p_data->>'status' where id=a.id;
 elsif p_operation in ('snooze','reschedule') then
  if a.status='done' or a.deleted_at is not null then raise exception 'This task is no longer open' using errcode='22023';end if;
  select coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London') into tz;
  if p_operation='reschedule' then
   update public.actions set due_date=(p_data->>'due_date')::date,due_time=nullif(p_data->>'due_time','')::time,status='open' where id=a.id;
  else
   if nullif(p_data->>'until','') is null or (p_data->>'until')::timestamptz<=now() or (p_data->>'until')::timestamptz>now()+interval '32 days' then raise exception 'Choose a future reminder time' using errcode='22023';end if;
   update public.actions set remind_at=(p_data->>'until')::timestamptz,reminder_sent_at=null,check_in_sent_at=null,reminder_cycle=reminder_cycle+1,overdue=false where id=a.id;
  end if;
  update public.task_alerts set read_at=coalesce(read_at,now()) where task_id=a.id;
 elsif p_operation in ('archive','restore') then update public.actions set deleted_at=case when p_operation='archive' then now() else null end where id=a.id;
 elsif p_operation='context' then
  if a.status<>'done' or a.deleted_at is not null then raise exception 'Complete the task before adding context' using errcode='22023';end if;
  if a.context_added_at is not null then return a.context_record_id;end if;
  title:=coalesce(nullif(btrim(p_data->>'title'),''),a.title);body:=coalesce(p_data->>'details','');
  if char_length(title)>200 or char_length(body)>5000 or body='' then raise exception 'Add an outcome before saving' using errcode='22023';end if;
  if p_data->>'kind'='decision' then
   if coalesce(btrim(p_data->>'reason'),'')='' then raise exception 'Add the reason for the decision' using errcode='22023';end if;
   insert into public.decisions(company_id,owner_id,title,reason,decided_on,decided_by,next_step) values(c,u,title,p_data->>'reason',(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date,(select full_name from public.profiles where id=u),coalesce(p_data->>'next_step',body)) returning id into target;
  elsif p_data->>'kind'='workstream' then
   if nullif(p_data->>'record_id','') is null then raise exception 'Choose the open work to update' using errcode='22023';end if;
   update public.role_items set details=body,next_step=coalesce(p_data->>'next_step','') where id=(p_data->>'record_id')::uuid and owner_id=u and company_id=c and kind='workstream' and deleted_at is null returning id into target;
   if target is null then raise insufficient_privilege;end if;
  elsif p_data->>'kind'='note' then
   insert into public.role_work_notes(owner_id,company_id,task_id,title,details) values(u,c,a.id,title,body) returning id into target;
  else raise exception 'Choose where to save the context' using errcode='22023';end if;
  update public.actions set context_kind=p_data->>'kind',context_record_id=target,context_added_at=now() where id=a.id;
 else raise exception 'Unknown task operation' using errcode='22023';end if;
 return a.id;
end $$;
