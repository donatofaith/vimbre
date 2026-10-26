-- My Day extension: additive schema only; apply after reviewing app RPC compatibility.
alter table public.actions
  add column if not exists repeat_rule jsonb,
  add column if not exists time_needed_minutes integer,
  add column if not exists steps jsonb not null default '[]'::jsonb,
  add column if not exists links jsonb not null default '[]'::jsonb,
  add column if not exists label text,
  add column if not exists created_by_ai boolean not null default false,
  add column if not exists deleted_by uuid,
  add column if not exists source_excerpt text,
  add column if not exists source_disconnected boolean not null default false,
  add column if not exists metadata jsonb not null default '{"schema_version":1}'::jsonb;
alter table public.actions
  add constraint actions_time_needed_positive check (time_needed_minutes is null or time_needed_minutes between 1 and 1440);

-- Stars replace priority and the old three-pin limit. No stored task data is removed.
CREATE OR REPLACE FUNCTION private.guard_task_pin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
begin
 if new.pinned_at is not null and (new.deleted_at is not null or new.status='done') then new.pinned_at:=null;end if;
 if new.pinned_at is not null and (tg_op='INSERT' or old.pinned_at is null) then new.pinned_at:=clock_timestamp();end if;
 return new;
end $$;
revoke all on function private.guard_task_pin() from public,anon,authenticated;
create table private.myday_undo (
 owner_id uuid not null, task_id uuid primary key references public.actions(id) on delete cascade,
 status text not null, deleted_at timestamptz, pinned_at timestamptz, completed_at timestamptz,
 expected_updated_at timestamptz not null, expires_at timestamptz not null
);
revoke all on private.myday_undo from public,anon,authenticated;
alter table private.myday_undo enable row level security;
CREATE OR REPLACE FUNCTION private.myday_action_legacy(p_id uuid, p_operation text, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$

;
revoke all on function private.myday_action_legacy(uuid,text,jsonb) from public,anon,authenticated;

create or replace function private.myday_action(p_id uuid,p_operation text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.actions; before_task public.actions; saved private.myday_undo; result uuid; tz text; target date;
begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>22000 then raise exception 'Invalid task data' using errcode='22023';end if;
 if p_operation<>'create' then
  select * into a from public.actions where id=p_id and owner_id=auth.uid() and company_id=private.current_company_id() for update;
  if not found then raise insufficient_privilege;end if;
  before_task:=a;
 end if;
 if p_operation='undo' then
  select * into saved from private.myday_undo where task_id=p_id and owner_id=auth.uid() and expires_at>=clock_timestamp() for update;
  if not found or a.updated_at<>saved.expected_updated_at then raise exception 'Undo expired or the task changed' using errcode='22023';end if;
  update public.actions set status=saved.status,deleted_at=saved.deleted_at,pinned_at=saved.pinned_at,completed_at=saved.completed_at where id=p_id;
  delete from private.myday_undo where task_id=p_id;return p_id;
 elsif p_operation='tomorrow' then
  if a.deleted_at is not null or a.status='done' then raise exception 'Task is not open' using errcode='22023';end if;
  tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');
  target:=coalesce(nullif(p_data->>'date','')::date,(now() at time zone tz)::date+1);
  if target<(now() at time zone tz)::date then raise exception 'Choose today or later' using errcode='22023';end if;
  update public.actions set due_date=target,reminder_sent_at=null,check_in_sent_at=null,reminder_cycle=reminder_cycle+1,overdue=false where id=p_id;return p_id;
 end if;
 result:=private.myday_action_legacy(p_id,p_operation,p_data);
 if p_operation='create' and nullif(p_data->>'reminder_date','') is not null then
  tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');
  update public.actions set remind_at=((p_data->>'reminder_date')::date+time '09:00') at time zone tz where id=p_id;
 end if;
 if p_operation='archive' or p_operation='edit' and p_data->>'status'='archived' then update public.actions set deleted_by=auth.uid() where id=p_id;end if;
 if p_operation='restore' then
  if a.deleted_at<now()-interval '30 days' then raise exception 'Restore period has ended' using errcode='22023';end if;
  update public.actions set deleted_by=null where id=p_id;
 end if;
 if p_operation='archive' or p_operation='status' and p_data->>'status'='done' then
  insert into private.myday_undo(owner_id,task_id,status,deleted_at,pinned_at,completed_at,expected_updated_at,expires_at)
  select auth.uid(),p_id,before_task.status,before_task.deleted_at,before_task.pinned_at,before_task.completed_at,updated_at,clock_timestamp()+interval '10 seconds' from public.actions where id=p_id
  on conflict(task_id) do update set status=excluded.status,deleted_at=excluded.deleted_at,pinned_at=excluded.pinned_at,completed_at=excluded.completed_at,expected_updated_at=excluded.expected_updated_at,expires_at=excluded.expires_at;
 end if;
 return result;
end $$;
revoke all on function private.myday_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.myday_action(uuid,text,jsonb) to authenticated;
CREATE OR REPLACE FUNCTION public.myday_tasks(p_filter text, p_query text, p_for text, p_page integer, p_task uuid DEFAULT NULL::uuid, p_decision uuid DEFAULT NULL::uuid, p_source text DEFAULT ''::text, p_priority text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();tz text;today date;result jsonb;begin
 if u is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_filter is null or p_filter not in ('today','week','overdue','all','archived','done') or p_page is null or p_page<0 or p_page>100000 or p_query is null or char_length(p_query)>100 or p_for is null or char_length(p_for)>80 or p_source is null or p_source not in ('','manual','email','notes','ai','recurring_deadline','role','meeting','handover','cover') or p_priority is null or p_priority not in ('','high','normal','low') then raise exception 'Invalid task filter' using errcode='22023';end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 with base as materialized(
 select a.*,d.name as department_name,r.title as external_contact_name,ri.kind as source_role_kind,ri.role_id as source_role_profile_id,
 (a.due_at at time zone tz)::date as due_day,
 a.status<>'done' and (a.due_at<now() or (a.due_at at time zone tz)::date=today or a.pinned_at is not null) as in_today
 from public.actions a left join public.departments d on d.id=a.department_id left join public.role_items r on r.id=a.external_contact_id
 left join public.role_items ri on ri.id=coalesce(a.source_role_id,a.stable_role_item_id,a.recurring_id)
 where a.owner_id=u and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_source='' or a.source_kind=p_source) and (p_priority='' or a.priority=p_priority)
 ), filtered as materialized(select * from base where (deleted_at is not null)=(p_filter='archived')
 and (p_filter in ('all','archived') or p_filter='today' and in_today and due_at>=now() or p_filter='done' and status='done' or p_filter='week' and status<>'done' and due_day between today and today+6 or p_filter='overdue' and status<>'done' and due_at<now())),
 ranked as(select *,row_number() over(order by (pinned_at is not null) desc,due_at,created_at,id) as rank from filtered),
 paged as(select * from ranked order by rank limit case when p_filter='today' then null else 60 end offset case when p_filter='today' then 0 else p_page*60 end)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by rank) from paged),'[]'::jsonb),'count',(select count(*) from filtered),'today',today,'timezone',tz,
 'tab_counts',(select jsonb_build_object('today',count(*) filter(where deleted_at is null and status<>'done' and due_at>=now() and (due_day=today or pinned_at is not null)),'week',count(*) filter(where deleted_at is null and status<>'done' and due_day between today and today+6),'overdue',count(*) filter(where deleted_at is null and status<>'done' and due_at<now()),'done',count(*) filter(where deleted_at is null and status='done'),'all',count(*) filter(where deleted_at is null),'archived',count(*) filter(where deleted_at is not null)) from base),
 'overdue_rows',coalesce((select jsonb_agg(to_jsonb(q) order by (pinned_at is not null) desc,due_at,created_at,id) from base q where deleted_at is null and status<>'done' and due_at<now()),'[]'::jsonb),
 'counts',(select jsonb_build_object('today',count(*) filter(where status<>'done' and due_at>=now() and (due_day=today or pinned_at is not null)),'todo',count(*) filter(where status='open' and in_today),'progress',count(*) filter(where status='in_progress' and in_today),'overdue',count(*) filter(where status<>'done' and due_at<now()),'done',count(*) filter(where status='done' and (completed_at at time zone tz)::date=today)) from base where deleted_at is null),
 'has_work',exists(select 1 from public.actions where owner_id=u) or exists(select 1 from public.role_items where owner_id=u),
 'context_waiting',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.actions where owner_id=u and status='done' and deleted_at is null and context_added_at is null order by completed_at desc limit 10)q),'[]'::jsonb),
 'done_today',coalesce((select jsonb_agg(to_jsonb(q) order by completed_at desc,id) from base q where deleted_at is null and status='done' and (completed_at at time zone tz)::date=today),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q) order by (pinned_at is not null) desc,due_at,created_at,id) from base q where deleted_at is null and status<>'done' and pinned_at is null and due_day between today+1 and today+7),'[]'::jsonb),
 'drafts_waiting',(select count(*) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.status='pending' and c.deleted_at is null),
 'decisions_waiting',0,
 'handovers_waiting',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title)) from public.work_handovers h where reviewer_id=u and status='pending'),'[]'::jsonb),
 'covering',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'owner_name',p.full_name,'owner_id',p.id)) from public.work_handovers h join public.profiles p on p.id=h.owner_id and p.active where h.cover_id=u and h.status='approved' and today between h.starts_on and h.ends_on),'[]'::jsonb),
 'cover_tasks',private.myday_cover_tasks(),
 'checklist',jsonb_build_object('capture',exists(select 1 from public.captures where owner_id=u),'role',exists(select 1 from public.role_items where owner_id=u and deleted_at is null) or exists(select 1 from public.decisions where owner_id=u and deleted_at is null),'reminder',exists(select 1 from public.actions where owner_id=u and deleted_at is null and remind_at is not null),'cover',exists(select 1 from public.work_handovers where owner_id=u and status<>'cancelled'))
 ) into result;return result;
end $function$

;
