-- Client My day review. Additive fields; no existing task or record is deleted.
alter table public.actions add column priority text not null default 'normal' check(priority in ('high','normal','low')),
 add column pinned_at timestamptz,
 add column source_role_id uuid,
 add constraint actions_source_role_owner_fk foreign key(source_role_id,owner_id,company_id) references public.role_items(id,owner_id,company_id);
create index actions_source_role_idx on public.actions(source_role_id,owner_id,company_id);
create unique index actions_role_cycle_idx on public.actions(source_role_id,due_date) where source_role_id is not null;
alter table public.actions drop constraint actions_source_kind_check;
alter table public.actions add constraint actions_source_kind_check check(source_kind in ('manual','email','notes','ai','recurring_deadline','role','meeting','handover','cover'));
grant update(priority) on public.actions to authenticated;

-- Full task content stays with its owner. Leaders use the narrow projection below.
alter policy actions_read on public.actions using(company_id=(select private.current_company_id()) and owner_id=(select auth.uid()));

create table public.task_status_history (
 id bigint generated always as identity primary key, task_id uuid not null references public.actions(id),
 owner_id uuid not null, company_id uuid not null, actor_id uuid references public.profiles(id),
 previous_status text, status text not null check(status in ('open','in_progress','done','archived')),
 created_at timestamptz not null default now(),
 foreign key(owner_id,company_id) references public.profiles(id,company_id)
);
create index task_history_owner_idx on public.task_status_history(owner_id,company_id,task_id,id);
alter table public.task_status_history enable row level security;
revoke all on public.task_status_history from public,anon,authenticated;
grant select on public.task_status_history to authenticated;
create policy task_history_owner on public.task_status_history for select to authenticated using(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()));
create function private.log_task_status() returns trigger language plpgsql security definer set search_path='' as $$
declare before_status text; after_status text;begin
 after_status:=case when new.deleted_at is not null then 'archived' else new.status end;
 if tg_op='UPDATE' then before_status:=case when old.deleted_at is not null then 'archived' else old.status end;end if;
 if after_status is distinct from before_status then
  insert into public.task_status_history(task_id,owner_id,company_id,actor_id,previous_status,status) values(new.id,new.owner_id,new.company_id,auth.uid(),before_status,after_status);
 end if;return new;
end $$;
revoke all on function private.log_task_status() from public,anon,authenticated;
create trigger task_status_log after insert or update on public.actions for each row execute function private.log_task_status();
-- Existing states are baselined as of migration, never invented historic transitions.
insert into public.task_status_history(task_id,owner_id,company_id,previous_status,status)
select id,owner_id,company_id,null,case when deleted_at is not null then 'archived' else status end from public.actions;

create function private.guard_task_pin() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.pinned_at is not null and (new.deleted_at is not null or new.status='done') then new.pinned_at:=null;end if;
 if new.pinned_at is not null and (tg_op='INSERT' or old.pinned_at is null) then
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,319));
  if (select count(*) from public.actions where owner_id=new.owner_id and pinned_at is not null and deleted_at is null and status<>'done' and id<>new.id)>=3 then raise exception 'You can pin up to three tasks.' using errcode='22023';end if;
  new.pinned_at:=clock_timestamp();
 end if;return new;
end $$;
revoke all on function private.guard_task_pin() from public,anon,authenticated;
create trigger action_pin_guard before insert or update on public.actions for each row execute function private.guard_task_pin();

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
  source_url=nullif(p_data->>'source_url',''),completion_note=coalesce(p_data->>'completion_note',''),department_id=nullif(p_data->>'department_id','')::uuid,external_contact_id=nullif(p_data->>'external_contact_id','')::uuid,reminder_option=coalesce(p_data->>'reminder_option','at_time'),status=coalesce(p_data->>'status',status),priority=coalesce(p_data->>'priority',priority) where id=a.id;
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
  if char_length(outcome_title)>200 or char_length(body)>5000 or body='' then raise exception 'Add an outcome before saving' using errcode='22023';end if;
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
  update public.actions set context_kind=p_data->>'kind',context_record_id=target,context_added_at=now() where id=a.id;
 else raise exception 'Unknown task operation' using errcode='22023';end if;
 if p_operation='context' then return target;end if;
 return a.id;
end $$;

-- Personal record to task conversion is explicit and idempotent per date.
create function private.myday_role_task(p_record uuid,p_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();r public.role_items;t uuid;begin
 if u is null or c is null or p_date is null then raise insufficient_privilege;end if;
 select * into r from public.role_items where id=p_record and owner_id=u and company_id=c and deleted_at is null and kind in ('responsibility','workstream','recurring_deadline');
 if not found then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_record::text||p_date::text,77));
 if r.kind='recurring_deadline' then select id into t from public.actions where recurring_id=r.id and recurring_date=p_date;else select id into t from public.actions where source_role_id=r.id and due_date=p_date;end if;
 if t is not null then return t;end if;
 insert into public.actions(owner_id,company_id,title,details,due_date,source_kind,source_role_id,recurring_id,recurring_date,department_id)
 values(u,c,r.title,r.details,p_date,case when r.kind='recurring_deadline' then 'recurring_deadline' else 'role' end,r.id,case when r.kind='recurring_deadline' then r.id end,case when r.kind='recurring_deadline' then p_date end,(select department_id from public.profiles where id=u)) returning id into t;
 return t;
end $$;
revoke all on function private.myday_role_task(uuid,date) from public,anon,authenticated;grant execute on function private.myday_role_task(uuid,date) to authenticated;
create function public.myday_role_task(p_record uuid,p_date date) returns uuid language sql security invoker set search_path='' as $$select private.myday_role_task(p_record,p_date)$$;
revoke all on function public.myday_role_task(uuid,date) from public,anon,authenticated;grant execute on function public.myday_role_task(uuid,date) to authenticated;

-- Leaders see only confirmed task metadata. No source, notes, priority or private draft.
create function private.team_member_tasks(p_owner uuid,p_view text,p_query text,p_page integer,p_decision uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles;tz text;today date;result jsonb;begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found or viewer.role not in ('manager','hr_admin') or not private.can_read_role(p_owner) then raise insufficient_privilege;end if;
 if p_view is null or p_view not in ('open','today','overdue','done','archived') or p_query is null or char_length(p_query)>100 or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid filter' using errcode='22023';end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=viewer.id),'Europe/London');today:=(now() at time zone tz)::date;
 with rows as materialized(select a.id,a.title,a.status,a.due_date,a.due_time,a.due_at,a.completed_at,a.deleted_at,d.name as department_name
 from public.actions a left join public.departments d on d.id=a.department_id
 where a.owner_id=p_owner and a.company_id=viewer.company_id and (a.deleted_at is not null)=(p_view='archived') and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_view='archived' or p_view='done' and a.status='done' or p_view in ('today','overdue','open') and a.status<>'done')
 and (p_view<>'today' or (a.due_at at time zone tz)::date=today) and (p_view<>'overdue' or a.due_at<now())),
 paged as(select * from rows order by due_at,id limit 20 offset p_page*20)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by due_at,id) from paged),'[]'::jsonb),'count',(select count(*) from rows)) into result;return result;
end $$;
revoke all on function private.team_member_tasks(uuid,text,text,integer,uuid) from public,anon,authenticated;grant execute on function private.team_member_tasks(uuid,text,text,integer,uuid) to authenticated;
create function public.team_member_tasks(p_owner uuid,p_view text,p_query text,p_page integer,p_decision uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.team_member_tasks(p_owner,p_view,p_query,p_page,p_decision)$$;
revoke all on function public.team_member_tasks(uuid,text,text,integer,uuid) from public,anon,authenticated;grant execute on function public.team_member_tasks(uuid,text,text,integer,uuid) to authenticated;
-- A handover is submitted explicitly and cover starts only after scoped approval.
create table public.work_handovers (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 owner_id uuid not null,cover_id uuid not null,reviewer_id uuid not null,
 title text not null check(char_length(btrim(title)) between 1 and 200),
 body text not null default '' check(char_length(body)<=16000),
 starts_on date not null,ends_on date not null check(ends_on>=starts_on),
 status text not null default 'draft' check(status in ('draft','pending','approved','declined','cancelled')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(owner_id<>cover_id and owner_id<>reviewer_id),
 foreign key(owner_id,company_id) references public.profiles(id,company_id),
 foreign key(cover_id,company_id) references public.profiles(id,company_id),
 foreign key(reviewer_id,company_id) references public.profiles(id,company_id)
);
create index work_handovers_owner_idx on public.work_handovers(owner_id,company_id);
create index work_handovers_cover_idx on public.work_handovers(cover_id,company_id,status,starts_on,ends_on);
create index work_handovers_reviewer_idx on public.work_handovers(reviewer_id,company_id,status);
alter table public.work_handovers enable row level security;
revoke all on public.work_handovers from public,anon,authenticated;
grant select on public.work_handovers to authenticated;
create policy handover_participants on public.work_handovers for select to authenticated using(
 company_id=(select private.current_company_id()) and (owner_id=(select auth.uid())
 or status<>'draft' and reviewer_id=(select auth.uid()) and private.can_read_role(owner_id)
 or status='approved' and cover_id=(select auth.uid())));

create function private.myday_handover(p_id uuid,p_operation text,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();h public.work_handovers;r public.profiles;begin
 if u is null or c is null then raise insufficient_privilege;end if;
 if p_operation is null or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>22000 then raise exception 'Invalid handover' using errcode='22023';end if;
 if p_operation='save' then
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,15));
  select * into h from public.work_handovers where id=p_id for update;
  if found and (h.owner_id<>u or h.company_id<>c or h.status not in ('draft','declined')) then raise insufficient_privilege;end if;
  if not exists(select 1 from public.profiles where id=(p_data->>'cover_id')::uuid and company_id=c and active and id<>u) then raise exception 'Choose an active cover person' using errcode='22023';end if;
  select * into r from public.profiles where id=(p_data->>'reviewer_id')::uuid and company_id=c and active and id<>u and role in ('hr_admin','manager');
  if not found or r.role='manager' and (r.department_id is null or r.department_id is distinct from (select department_id from public.profiles where id=u)) then raise exception 'Choose a reviewer for your department' using errcode='22023';end if;
  insert into public.work_handovers(id,company_id,owner_id,cover_id,reviewer_id,title,body,starts_on,ends_on)
  values(p_id,c,u,(p_data->>'cover_id')::uuid,r.id,p_data->>'title',coalesce(p_data->>'body',''),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date)
  on conflict(id) do update set cover_id=excluded.cover_id,reviewer_id=excluded.reviewer_id,title=excluded.title,body=excluded.body,starts_on=excluded.starts_on,ends_on=excluded.ends_on,status='draft',updated_at=now();
 else
  select * into h from public.work_handovers where id=p_id and company_id=c for update;
  if not found then raise insufficient_privilege;end if;
  if p_operation='submit' and h.owner_id=u and h.status='draft' then
   if btrim(h.body)='' then raise exception 'Add the handover notes before sending' using errcode='22023';end if;
   update public.work_handovers set status='pending',updated_at=now() where id=h.id;
  elsif p_operation='cancel' and h.owner_id=u and h.status<>'cancelled' then update public.work_handovers set status='cancelled',updated_at=now() where id=h.id;
  elsif p_operation in ('approve','decline') and h.reviewer_id=u and h.status='pending' and private.can_read_role(h.owner_id)
   and exists(select 1 from public.profiles where id=u and active and role in ('hr_admin','manager')) then
   if not exists(select 1 from public.profiles where id=h.cover_id and active and company_id=c) then raise exception 'The cover person is no longer active' using errcode='22023';end if;
   update public.work_handovers set status=case when p_operation='approve' then 'approved' else 'declined' end,updated_at=now() where id=h.id;
  else raise insufficient_privilege;end if;
 end if;
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'handover',p_id,p_operation);
 return p_id;
end $$;
revoke all on function private.myday_handover(uuid,text,jsonb) from public,anon,authenticated;grant execute on function private.myday_handover(uuid,text,jsonb) to authenticated;
create function public.myday_handover(p_id uuid,p_operation text,p_data jsonb default '{}') returns uuid language sql security invoker set search_path='' as $$select private.myday_handover(p_id,p_operation,p_data)$$;
revoke all on function public.myday_handover(uuid,text,jsonb) from public,anon,authenticated;grant execute on function public.myday_handover(uuid,text,jsonb) to authenticated;

-- Only approved cover in its active date range can project another person's tasks.
create function private.myday_cover_tasks() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select a.id,a.title,a.status,a.due_date,a.due_at,d.name as department_name,p.full_name as owner_name,p.id as owner_id
 from public.actions a join public.profiles p on p.id=a.owner_id and p.active left join public.departments d on d.id=a.department_id
 where a.company_id=private.current_company_id() and a.deleted_at is null and a.status<>'done'
 and exists(select 1 from public.work_handovers h where h.owner_id=a.owner_id and h.company_id=a.company_id and h.cover_id=auth.uid() and h.status='approved'
 and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date between h.starts_on and h.ends_on)
 order by a.due_at,a.id limit 60)x
$$;
revoke all on function private.myday_cover_tasks() from public,anon,authenticated;grant execute on function private.myday_cover_tasks() to authenticated;

create function public.myday_handovers() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(h) order by h.updated_at desc) from (
 select w.*,p.full_name as owner_name,c.full_name as cover_name,r.full_name as reviewer_name from public.work_handovers w
 join public.profiles p on p.id=w.owner_id join public.profiles c on c.id=w.cover_id join public.profiles r on r.id=w.reviewer_id
 order by w.updated_at desc limit 100)h),'[]'::jsonb))
$$;
revoke all on function public.myday_handovers() from public,anon,authenticated;grant execute on function public.myday_handovers() to authenticated;

drop function public.myday_tasks(text,text,text,integer,uuid,uuid);
create function public.myday_tasks(p_filter text,p_query text,p_for text,p_page integer,p_task uuid default null,p_decision uuid default null,p_source text default '',p_priority text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();tz text;today date;result jsonb;begin
 if u is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_filter is null or p_filter not in ('today','week','overdue','all','archived') or p_page is null or p_page<0 or p_page>100000 or p_query is null or char_length(p_query)>100 or p_for is null or char_length(p_for)>80 or p_source is null or p_source not in ('','manual','email','notes','ai','recurring_deadline','role','meeting','handover','cover') or p_priority is null or p_priority not in ('','high','normal','low') then raise exception 'Invalid task filter' using errcode='22023';end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 with base as materialized(
 select a.*,d.name as department_name,r.title as external_contact_name,ri.kind as source_role_kind,
 (a.due_at at time zone tz)::date as due_day,
 a.status<>'done' and ((a.due_at at time zone tz)::date=today or a.due_at<now() or a.status='in_progress' or a.pinned_at is not null) as in_today
 from public.actions a left join public.departments d on d.id=a.department_id left join public.role_items r on r.id=a.external_contact_id
 left join public.role_items ri on ri.id=coalesce(a.source_role_id,a.recurring_id)
 where a.owner_id=u and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_source='' or a.source_kind=p_source) and (p_priority='' or a.priority=p_priority)
 ), filtered as materialized(select * from base where (deleted_at is not null)=(p_filter='archived')
 and (p_filter in ('all','archived') or p_filter='today' and in_today or p_filter='week' and status<>'done' and due_day between today and today+6 or p_filter='overdue' and status<>'done' and due_at<now())),
 ranked as(select *,row_number() over(order by (pinned_at is not null) desc,pinned_at,
 (status<>'done' and due_at<now()) desc,(priority='high') desc,case when due_day=today then due_at end,created_at,id) as rank from filtered),
 paged as(select * from ranked order by rank limit 60 offset p_page*60)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by rank) from paged),'[]'::jsonb),'count',(select count(*) from filtered),'today',today,'timezone',tz,
 'tab_counts',(select jsonb_build_object('today',count(*) filter(where deleted_at is null and in_today),'week',count(*) filter(where deleted_at is null and status<>'done' and due_day between today and today+6),'overdue',count(*) filter(where deleted_at is null and status<>'done' and due_at<now()),'all',count(*) filter(where deleted_at is null),'archived',count(*) filter(where deleted_at is not null)) from base),
 'counts',(select jsonb_build_object('todo',count(*) filter(where status='open' and ((due_at at time zone tz)::date=today or due_at<now() or pinned_at is not null)),'progress',count(*) filter(where status='in_progress'),'overdue',count(*) filter(where status<>'done' and due_at<now()),'done',count(*) filter(where status='done' and (completed_at at time zone tz)::date=today)) from public.actions where owner_id=u and deleted_at is null),
 'has_work',exists(select 1 from public.actions where owner_id=u) or exists(select 1 from public.role_items where owner_id=u),
 'context_waiting',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.actions where owner_id=u and status='done' and deleted_at is null and context_added_at is null order by completed_at desc limit 10)q),'[]'::jsonb),
 'done_today',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.actions where owner_id=u and deleted_at is null and status='done' and (completed_at at time zone tz)::date=today order by completed_at desc limit 60)q),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q)) from (select a.* from public.actions a where owner_id=u and deleted_at is null and status<>'done' and (due_at at time zone tz)::date between today+1 and today+6 order by due_at,id limit 60)q),'[]'::jsonb),
 'drafts_waiting',(select count(*) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.status='pending' and c.deleted_at is null),
 'decisions_waiting',(select count(*) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.kind='decision' and i.status='pending' and c.deleted_at is null),
 'handovers_waiting',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title)) from public.work_handovers h where reviewer_id=u and status='pending'),'[]'::jsonb),
 'covering',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'owner_name',p.full_name,'owner_id',p.id)) from public.work_handovers h join public.profiles p on p.id=h.owner_id and p.active where h.cover_id=u and h.status='approved' and today between h.starts_on and h.ends_on),'[]'::jsonb),
 'cover_tasks',private.myday_cover_tasks(),
 'checklist',jsonb_build_object('capture',exists(select 1 from public.captures where owner_id=u),'role',exists(select 1 from public.role_items where owner_id=u and deleted_at is null) or exists(select 1 from public.decisions where owner_id=u and deleted_at is null),'reminder',exists(select 1 from public.actions where owner_id=u and deleted_at is null and remind_at is not null),'cover',exists(select 1 from public.work_handovers where owner_id=u and status<>'cancelled'))
 ) into result;return result;
end $$;
revoke all on function public.myday_tasks(text,text,text,integer,uuid,uuid,text,text) from public,anon,authenticated;grant execute on function public.myday_tasks(text,text,text,integer,uuid,uuid,text,text) to authenticated;

create function public.myday_task_history(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(h) order by h.id desc),'[]'::jsonb) from (select id,previous_status,status,created_at from public.task_status_history where task_id=p_id and owner_id=auth.uid() order by id desc limit 200)h
$$;
revoke all on function public.myday_task_history(uuid) from public,anon,authenticated;grant execute on function public.myday_task_history(uuid) to authenticated;
