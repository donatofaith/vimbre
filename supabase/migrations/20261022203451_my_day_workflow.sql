-- Additive workflow. Existing actions, statuses and role policies remain in place.
create table public.work_preferences (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 company_id uuid not null references public.companies(id),
 timezone text not null default 'Europe/London',
 reminder_time time not null default '09:00',
 email_enabled boolean not null default true,
 foreign key(owner_id,company_id) references public.profiles(id,company_id)
);
alter table public.work_preferences enable row level security;
revoke all on public.work_preferences from public,anon,authenticated;
grant select,insert,update on public.work_preferences to authenticated;
create policy work_preferences_own on public.work_preferences for all to authenticated
 using(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()))
 with check(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()));
create index work_preferences_company_idx on public.work_preferences(company_id);
create function private.validate_work_preferences() returns trigger language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Choose a valid time zone' using errcode='22023'; end if;
 return new;
end $$;
revoke all on function private.validate_work_preferences() from public,anon,authenticated;
create trigger validate_work_preferences before insert or update on public.work_preferences for each row execute function private.validate_work_preferences();

alter table public.actions add column department_id uuid, add column external_contact_id uuid,
 add column source_kind text not null default 'manual' check(source_kind in ('manual','email','notes','ai','recurring_deadline')),
 add column due_time time, add column due_at timestamptz, add column remind_at timestamptz,
 add column reminder_option text not null default 'at_time' check(reminder_option in ('at_time','30_minutes','1_hour','day_before')),
 add column reminder_sent_at timestamptz, add column check_in_sent_at timestamptz,
 add column overdue boolean not null default false, add column reminder_cycle integer not null default 0,
 add column recurring_id uuid, add column recurring_date date,
 add column context_kind text check(context_kind in ('decision','workstream','note')),
 add column context_record_id uuid, add column context_added_at timestamptz,
 add constraint action_for_one check(num_nonnulls(department_id,external_contact_id)<=1),
 add constraint action_department_company foreign key(department_id,company_id) references public.departments(id,company_id),
 add constraint action_contact_owner foreign key(external_contact_id,owner_id,company_id) references public.role_items(id,owner_id,company_id),
 add constraint action_recurring_owner foreign key(recurring_id,owner_id,company_id) references public.role_items(id,owner_id,company_id),
 add constraint action_cycle_pair check((recurring_id is null)=(recurring_date is null));
create unique index actions_recurring_cycle_idx on public.actions(recurring_id,recurring_date) where recurring_id is not null;
create index actions_department_idx on public.actions(department_id,company_id);
create index actions_contact_idx on public.actions(external_contact_id,owner_id,company_id);
create index actions_due_worker_idx on public.actions(remind_at) where status<>'done' and deleted_at is null;
revoke insert on public.actions from authenticated;
grant insert(id,company_id,owner_id,decision_id,title,details,due_date,status,source_url,completion_note,department_id,external_contact_id,source_kind,due_time,reminder_option) on public.actions to authenticated;
grant update(department_id,external_contact_id,due_time,reminder_option) on public.actions to authenticated;

create table public.task_alerts (
 id uuid primary key default gen_random_uuid(), task_id uuid not null,
 owner_id uuid not null, company_id uuid not null,
 cycle integer not null, phase text not null check(phase in ('due','check_in')),
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(task_id,cycle,phase),
 foreign key(task_id,owner_id,company_id) references public.actions(id,owner_id,company_id) on delete cascade
);
alter table public.task_alerts enable row level security;
revoke all on public.task_alerts from public,anon,authenticated;
grant select on public.task_alerts to authenticated;
grant update(read_at) on public.task_alerts to authenticated;
create policy task_alerts_owner on public.task_alerts for select to authenticated using(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()));
create policy task_alerts_read on public.task_alerts for update to authenticated using(owner_id=(select auth.uid()) and company_id=(select private.current_company_id())) with check(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()));
create index task_alerts_owner_idx on public.task_alerts(owner_id,created_at desc);
create index task_alerts_company_idx on public.task_alerts(company_id);

create table public.role_work_notes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, company_id uuid not null,
 task_id uuid not null unique, title text not null check(char_length(title) between 1 and 300),
 details text not null check(char_length(details)<=5000), created_at timestamptz not null default now(),
 foreign key(owner_id,company_id) references public.profiles(id,company_id),
 foreign key(task_id,owner_id,company_id) references public.actions(id,owner_id,company_id)
);
alter table public.role_work_notes enable row level security;
revoke all on public.role_work_notes from public,anon,authenticated;
grant select on public.role_work_notes to authenticated;
create policy role_work_notes_owner on public.role_work_notes for select to authenticated using(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()));
create index role_work_notes_owner_idx on public.role_work_notes(owner_id,company_id);
create index role_work_notes_company_idx on public.role_work_notes(company_id);

create table private.task_mail_queue (
 id uuid primary key default gen_random_uuid(), alert_id uuid not null unique references public.task_alerts(id) on delete cascade,
 owner_id uuid not null references public.profiles(id),
 state text not null default 'pending' check(state in ('pending','claimed','sent','failed','cancelled','uncertain')),
 batch_id uuid, claimed_at timestamptz, sent_at timestamptz,
 created_at timestamptz not null default now()
);
alter table private.task_mail_queue enable row level security;
revoke all on private.task_mail_queue from public,anon,authenticated,service_role;
create index task_mail_queue_owner_idx on private.task_mail_queue(owner_id,state,created_at);
create table private.task_delivery_config (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 token_hash text not null
);
alter table private.task_delivery_config enable row level security;
revoke all on private.task_delivery_config from public,anon,authenticated,service_role;

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
  new.remind_at:=case new.reminder_option when '30_minutes' then new.due_at-interval '30 minutes' when '1_hour' then new.due_at-interval '1 hour' when 'day_before' then ((new.due_date-1)+default_time) at time zone tz else new.due_at end;
 end if;
 if new.decision_id is not null and (tg_op='INSERT' or new.decision_id is distinct from old.decision_id) and not exists(select 1 from public.decisions where id=new.decision_id and owner_id=new.owner_id and company_id=new.company_id and deleted_at is null) then raise exception 'Choose an active decision belonging to this role' using errcode='23514'; end if;
 if new.external_contact_id is not null and not exists(select 1 from public.role_items where id=new.external_contact_id and kind='external_contact' and owner_id=new.owner_id and company_id=new.company_id and deleted_at is null) then raise exception 'Choose an external contact from your role' using errcode='23514';end if;
 if new.department_id is not null and not exists(select 1 from public.departments where id=new.department_id and company_id=new.company_id and archived_at is null) then raise exception 'Choose an active department' using errcode='23514';end if;
 return new;
end $$;
-- Existing deadlines retain their calendar meaning; old overdue tasks do not produce historic reminder mail.
update public.actions a set due_at=(a.due_date+time '09:00') at time zone 'Europe/London', remind_at=(a.due_date+time '09:00') at time zone 'Europe/London',
 reminder_sent_at=case when a.due_date< (now() at time zone 'Europe/London')::date then now() end,
 check_in_sent_at=case when a.due_date< (now() at time zone 'Europe/London')::date then now() end,
 overdue=a.due_date<(now() at time zone 'Europe/London')::date;

create function private.capture_task_provenance() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='confirmed' and new.action_id is not null then
  update public.actions set source_kind=case when c.source_type='email' then 'email' else 'notes' end from public.captures c where public.actions.id=new.action_id and c.id=new.capture_id and c.owner_id=new.owner_id and c.company_id=new.company_id;
 end if;return new;
end $$;
revoke all on function private.capture_task_provenance() from public,anon,authenticated;
create trigger capture_task_provenance after insert or update on public.capture_items for each row execute function private.capture_task_provenance();

create function private.myday_action(p_id uuid,p_operation text,p_data jsonb) returns uuid
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
   if (p_data->>'until')::timestamptz<=now() or (p_data->>'until')::timestamptz>now()+interval '32 days' then raise exception 'Choose a future reminder time' using errcode='22023';end if;
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
revoke all on function private.myday_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.myday_action(uuid,text,jsonb) to authenticated;
create function public.myday_action(p_id uuid,p_operation text,p_data jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.myday_action(p_id,p_operation,p_data) $$;
revoke all on function public.myday_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.myday_action(uuid,text,jsonb) to authenticated;

create function public.myday_tasks(p_filter text,p_query text,p_for text,p_page integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();tz text;today date;result jsonb;
begin
 if u is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_filter not in ('today','week','overdue','all','archived') or p_page<0 or p_page>100000 or char_length(p_query)>100 or char_length(p_for)>80 then raise exception 'Invalid task filter' using errcode='22023';end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 with rows as materialized (
 select a.*,d.name as department_name,r.title as external_contact_name from public.actions a
 left join public.departments d on d.id=a.department_id left join public.role_items r on r.id=a.external_contact_id
 where a.owner_id=u and (a.deleted_at is not null)=(p_filter='archived') and a.title ilike '%'||replace(replace(p_query,'%','\%'),'_','\_')||'%'
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
revoke all on function public.myday_tasks(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.myday_tasks(text,text,text,integer) to authenticated;

-- Date calculation is deterministic and does not ask AI to schedule background work.
create function private.next_work_date(p_date date,p_rule text) returns date language plpgsql immutable set search_path='' as $$
declare rule text:=lower(btrim(p_rule)); count_days integer; target_month date; result date; dow integer; nth integer;
begin
 if rule in ('daily','every day') then return p_date+1;end if;
 if rule in ('weekly','every week') or rule ~ '^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$' then return p_date+7;end if;
 if rule ~ '^every [1-9][0-9]? (days?|weeks?)$' then count_days:=split_part(rule,' ',2)::integer;return p_date+count_days*case when rule like '%week%' then 7 else 1 end;end if;
 if rule in ('monthly','every month') then return (p_date+interval '1 month')::date;end if;
 if rule in ('quarterly','every quarter') then return (p_date+interval '3 months')::date;end if;
 if rule in ('yearly','annually','every year') then return (p_date+interval '1 year')::date;end if;
 if rule ~ '^(first|second|third|fourth|last) (monday|tuesday|wednesday|thursday|friday|saturday|sunday) (of )?(each|every|the) month$' then
  target_month:=(date_trunc('month',p_date)+interval '1 month')::date;
  dow:=array_position(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],split_part(rule,' ',2))-1;
  if split_part(rule,' ',1)='last' then result:=(target_month+interval '1 month -1 day')::date;return result-((extract(dow from result)::integer-dow+7)%7);end if;
  nth:=array_position(array['first','second','third','fourth'],split_part(rule,' ',1));
  return target_month+((dow-extract(dow from target_month)::integer+7)%7)+(nth-1)*7;
 end if;
 return null;
end $$;
revoke all on function private.next_work_date(date,text) from public,anon,authenticated;

create function private.process_myday(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare r record;a public.actions; alert uuid; processed integer:=0;next_date date;
begin
 -- Skip overlapping minute jobs. Each create also has a unique cycle key.
 if not pg_try_advisory_xact_lock(627451903) then return 0;end if;
 for r in select ri.*,coalesce(w.timezone,'Europe/London') as tz from public.role_items ri
 join public.profiles p on p.id=ri.owner_id and p.company_id=ri.company_id and p.active
 left join public.work_preferences w on w.owner_id=p.id
 where ri.kind='recurring_deadline' and ri.deleted_at is null and ri.due_date=(p_now at time zone coalesce(w.timezone,'Europe/London'))::date
 order by ri.id for update of ri skip locked limit 2000 loop
  insert into public.actions(owner_id,company_id,title,details,due_date,due_time,source_kind,recurring_id,recurring_date)
  values(r.owner_id,r.company_id,r.title,r.details,r.due_date,time '09:00','recurring_deadline',r.id,r.due_date) on conflict do nothing;
  next_date:=private.next_work_date(r.due_date,r.recurrence);
  if next_date is not null then update public.role_items set due_date=next_date where id=r.id;end if;
 end loop;
 for a in select act.* from public.actions act join public.profiles p on p.id=act.owner_id and p.company_id=act.company_id and p.active
 where act.deleted_at is null and act.status<>'done' and act.remind_at<=p_now
 and (act.reminder_sent_at is null or act.check_in_sent_at is null and greatest(act.due_at,act.remind_at)+interval '1 hour'<=p_now)
 order by act.remind_at,act.id for update of act skip locked limit 2000 loop
  alert:=null;
  if a.reminder_sent_at is null then
   insert into public.task_alerts(task_id,owner_id,company_id,cycle,phase) values(a.id,a.owner_id,a.company_id,a.reminder_cycle,'due') on conflict do nothing returning id into alert;
   update public.actions set reminder_sent_at=p_now where id=a.id;
  elsif greatest(a.due_at,a.remind_at)+interval '1 hour'<=p_now and a.check_in_sent_at is null then
   insert into public.task_alerts(task_id,owner_id,company_id,cycle,phase) values(a.id,a.owner_id,a.company_id,a.reminder_cycle,'check_in') on conflict do nothing returning id into alert;
   update public.actions set check_in_sent_at=p_now,overdue=true where id=a.id;
  end if;
  if alert is not null then
   if coalesce((select email_enabled from public.work_preferences where owner_id=a.owner_id),true) then insert into private.task_mail_queue(alert_id,owner_id) values(alert,a.owner_id) on conflict do nothing;end if;
   processed:=processed+1;
  end if;
 end loop;
 -- A completed, archived, rescheduled or deactivated task must not send a stale queued email.
 update private.task_mail_queue q set state='cancelled' from public.task_alerts n,public.actions a,public.profiles p
 where q.alert_id=n.id and n.task_id=a.id and p.id=a.owner_id and q.state='pending'
 and (a.status='done' or a.deleted_at is not null or a.reminder_cycle<>n.cycle or not p.active or not coalesce((select email_enabled from public.work_preferences where owner_id=a.owner_id),true));
 return processed;
end $$;
revoke all on function private.process_myday(timestamptz) from public,anon,authenticated,service_role;

create function public.myday_alerts() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) from (
 select n.*,a.title,a.due_date,a.due_at,a.status from public.task_alerts n join public.actions a on a.id=n.task_id and a.owner_id=n.owner_id and a.company_id=n.company_id
 where n.owner_id=auth.uid() and n.read_at is null and a.status<>'done' and a.deleted_at is null and n.cycle=a.reminder_cycle order by n.created_at desc limit 50)q
$$;
revoke all on function public.myday_alerts() from public,anon,authenticated;
grant execute on function public.myday_alerts() to authenticated;

-- Keep delivery payloads service only and group all due alerts per recipient into one email.
create function private.task_mail_claim(p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid; batch uuid:=gen_random_uuid(); result jsonb;
begin
 if not exists(select 1 from private.task_delivery_config where singleton and enabled and token_hash=p_token_hash) then raise insufficient_privilege;end if;
 -- Ambiguous provider outcomes are not retried blindly after the worker disappears.
 update private.task_mail_queue set state='uncertain' where state='claimed' and claimed_at<now()-interval '5 minutes';
 select owner_id into owner from private.task_mail_queue where state='pending' order by created_at for update skip locked limit 1;
 if owner is null then return null;end if;
 perform 1 from public.profiles where id=owner and active for share;
 if not found then update private.task_mail_queue set state='cancelled' where owner_id=owner and state='pending';return null;end if;
 with chosen as (select q.id from private.task_mail_queue q join public.task_alerts n on n.id=q.alert_id join public.actions a on a.id=n.task_id
 where q.owner_id=owner and q.state='pending' and a.status<>'done' and a.deleted_at is null and a.reminder_cycle=n.cycle and coalesce((select email_enabled from public.work_preferences where owner_id=owner),true)
 order by q.created_at limit 50 for update of q skip locked)
 update private.task_mail_queue set state='claimed',batch_id=batch,claimed_at=now() where id in(select id from chosen);
 select jsonb_build_object('batch',batch,'email',p.email,'name',p.full_name,'items',coalesce((select jsonb_agg(jsonb_build_object('task_id',a.id,'title',a.title,'phase',n.phase,'due_at',a.due_at)) from private.task_mail_queue q join public.task_alerts n on n.id=q.alert_id join public.actions a on a.id=n.task_id where q.batch_id=batch),'[]'::jsonb)) into result from public.profiles p where p.id=owner;
 return result;
end $$;
revoke all on function private.task_mail_claim(text) from public,anon,authenticated;
grant execute on function private.task_mail_claim(text) to service_role;
create function public.task_mail_claim(p_token_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.task_mail_claim(p_token_hash)$$;
revoke all on function public.task_mail_claim(text) from public,anon,authenticated;grant execute on function public.task_mail_claim(text) to service_role;
create function private.task_mail_finish(p_batch uuid,p_state text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_state not in ('sent','failed','uncertain') then raise exception 'Invalid mail outcome';end if;
 update private.task_mail_queue set state=p_state,sent_at=case when p_state='sent' then now() else null end where batch_id=p_batch and state='claimed';
end $$;
revoke all on function private.task_mail_finish(uuid,text) from public,anon,authenticated;grant execute on function private.task_mail_finish(uuid,text) to service_role;
create function public.task_mail_finish(p_batch uuid,p_state text) returns void language sql security invoker set search_path='' as $$select private.task_mail_finish(p_batch,p_state)$$;
revoke all on function public.task_mail_finish(uuid,text) from public,anon,authenticated;grant execute on function public.task_mail_finish(uuid,text) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ declare token text:=encode(extensions.gen_random_bytes(32),'hex');begin
 perform vault.create_secret(token,'myday_dispatch_token');
 insert into private.task_delivery_config(singleton,token_hash) values(true,encode(extensions.digest(token,'sha256'),'hex'));
end $$;
create function private.dispatch_task_mail() returns void language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from private.task_delivery_config where enabled) and exists(select 1 from private.task_mail_queue where state='pending') then
  perform net.http_post(url:='https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/my-day-mail',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myday_dispatch_token')),body:='{}'::jsonb,timeout_milliseconds:=10000);
 end if;
end $$;
revoke all on function private.dispatch_task_mail() from public,anon,authenticated,service_role;
select cron.schedule('vimbre-myday-every-minute','* * * * *','select private.process_myday(); select private.dispatch_task_mail();');

-- Task reminders now use the two real delivery events. Retain legacy responsibility alerts.
create or replace function private.work_notification_inbox(p_timezone text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid notification page' using errcode='22023';end if;
 with reminders as materialized (
 select c.*,r.read_at from private.work_reminder_rows(p_timezone)c left join public.work_notification_reads r on r.user_id=auth.uid() and r.notification_key=c.notification_key
 where c.source_kind='role_item' and c.section='responsibility'
 ), paged as(select * from reminders order by due_date,notification_key limit 50 offset p_page*50)
 select jsonb_build_object('unread',(select count(*) from reminders where read_at is null),'count',(select count(*) from reminders),'items',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb)) into result;return result;
end $$;
