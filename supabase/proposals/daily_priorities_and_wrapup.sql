create table private.myday_daily_choices(owner_id uuid not null references public.profiles(id)on delete cascade,company_id uuid not null references public.companies(id)on delete cascade,day date not null,task_id uuid not null references public.actions(id)on delete cascade,primary key(owner_id,day,task_id));
create table private.myday_day_reviews(owner_id uuid not null references public.profiles(id)on delete cascade,company_id uuid not null references public.companies(id)on delete cascade,day date not null,done_ids uuid[]not null,pending_ids uuid[]not null,created_at timestamptz not null default now(),notification_id uuid,primary key(owner_id,day));
create table private.myday_daily_preferences(owner_id uuid primary key references public.profiles(id)on delete cascade,company_id uuid not null references public.companies(id)on delete cascade,enabled boolean not null default true);
alter table private.myday_daily_choices enable row level security;alter table private.myday_day_reviews enable row level security;alter table private.myday_daily_preferences enable row level security;
revoke all on private.myday_daily_choices,private.myday_day_reviews,private.myday_daily_preferences from public,anon,authenticated,service_role,console_backend;
create function private.myday_daily(p_action text default 'get',p_task uuid default null,p_day date default null,p_data jsonb default '{}')returns jsonb
language plpgsql security definer set search_path=''as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();tz text;today date;chosen date;review private.myday_day_reviews;settings jsonb;
begin
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and company_id=c and active)then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now()at time zone tz)::date;chosen:=coalesce(p_day,today);
 if chosen>today or chosen<today-interval '5 years'then raise invalid_parameter_value;end if;
 if p_action='settings'then return jsonb_build_object('enabled',coalesce((select enabled from private.myday_daily_preferences where owner_id=u and company_id=c),true),'timezone',tz,'work_end',coalesce((select settings->>'work_end'from private.myday_personal_options where owner_id=u and company_id=c),'17:00'));end if;
 if p_action='preferences'then
  if jsonb_typeof(p_data->'enabled')is distinct from 'boolean'then raise invalid_parameter_value;end if;
  insert into private.myday_daily_preferences values(u,c,(p_data->>'enabled')::boolean)on conflict(owner_id)do update set enabled=excluded.enabled;
 elsif p_action='accept'then
  if not exists(select 1 from public.actions where id=p_task and owner_id=u and company_id=c and deleted_at is null and purged_at is null and missed_at is null and status<>'done')then raise insufficient_privilege;end if;
  insert into private.myday_daily_choices values(u,c,today,p_task)on conflict do nothing;
 elsif p_action<>'get'then raise invalid_parameter_value;end if;
 select * into review from private.myday_day_reviews where owner_id=u and company_id=c and day=chosen;
 settings:=coalesce((select o.settings from private.myday_personal_options o where owner_id=u),'{}');
 return jsonb_build_object('today',today,'day',chosen,'timezone',tz,'wrapup_enabled',coalesce((select enabled from private.myday_daily_preferences where owner_id=u and company_id=c),true),'show_review',p_day is not null or review.owner_id is not null or(now()at time zone tz)::time>=coalesce((settings->>'work_end')::time,time '17:00'),
 'priorities',coalesce((select jsonb_agg(to_jsonb(t))from(select a.id,a.title,a.due_date,a.priority,a.source_kind,(a.source_role_id is not null or a.stable_role_item_id is not null)as role_linked,exists(select 1 from private.myday_daily_choices x where x.owner_id=u and x.company_id=c and x.day=today and x.task_id=a.id)accepted,
 case when a.due_date<today then 'Overdue'when a.priority='high'then 'Marked high priority'when a.due_date=today then 'Due today'when a.source_role_id is not null or a.stable_role_item_id is not null then 'From your role'when a.capture_id is not null then 'Extracted task to schedule'else 'Open task to schedule'end as why
 from public.actions a where a.owner_id=u and a.company_id=c and a.status<>'done'and a.deleted_at is null and a.purged_at is null and a.missed_at is null and(a.due_date<=today or a.due_date is null or a.priority='high'or a.pinned_at is not null)
 order by accepted desc,(a.due_date<today)desc nulls last,(a.priority='high')desc,(a.due_date=today)desc nulls last,(a.source_role_id is not null or a.stable_role_item_id is not null)desc,a.due_at nulls last,a.created_at,a.id limit 6)t),'[]'),
 'decisions',coalesce((select jsonb_agg(to_jsonb(t))from(select i.id,i.capture_id,i.kind,i.version,i.payload,false duplicate from public.capture_items i join public.captures cap on cap.id=i.capture_id and cap.owner_id=u and cap.company_id=c and cap.deleted_at is null where i.owner_id=u and i.company_id=c and i.kind='decision'and i.status='pending'order by (i.payload->>'priority'in('high','critical'))desc nulls last,i.created_at,i.id limit 5)t),'[]'),
 'done',coalesce((select jsonb_agg(to_jsonb(t))from(select a.id,a.title,a.status,a.due_date from public.actions a where a.owner_id=u and a.company_id=c and a.deleted_at is null and a.purged_at is null and(case when review.owner_id is not null then a.id=any(review.done_ids)else a.status='done'and(a.completed_at at time zone tz)::date=chosen end)order by a.completed_at desc,a.id limit 100)t),'[]'),
 'waiting',coalesce((select jsonb_agg(to_jsonb(t))from(select a.id,a.title,a.status,a.due_date from public.actions a where a.owner_id=u and a.company_id=c and a.deleted_at is null and a.purged_at is null and a.missed_at is null and(case when review.owner_id is not null then a.id=any(review.pending_ids)else a.status<>'done'and(a.due_date<=chosen or exists(select 1 from private.myday_daily_choices x where x.owner_id=u and x.day=chosen and x.task_id=a.id))end)order by a.due_at nulls last,a.id limit 100)t),'[]'),'recorded_at',review.created_at);
end $$;
revoke all on function private.myday_daily(text,uuid,date,jsonb)from public,anon,service_role,console_backend;grant execute on function private.myday_daily(text,uuid,date,jsonb)to authenticated;
create function public.myday_daily(p_action text default 'get',p_task uuid default null,p_day date default null,p_data jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.myday_daily(p_action,p_task,p_day,p_data)$$;
revoke all on function public.myday_daily(text,uuid,date,jsonb)from public,anon,service_role;grant execute on function public.myday_daily(text,uuid,date,jsonb)to authenticated;
create function private.myday_day_review_tick(p_now timestamptz default now(),p_owner uuid default null)returns integer language plpgsql security definer set search_path=''as $$
declare p record;d date;done_tasks uuid[];waiting_tasks uuid[];notice uuid;n int:=0;inserted int;
begin
 for p in select member.id,member.company_id,coalesce(w.timezone,'Europe/London')zone,coalesce(o.settings,'{}')settings from public.profiles member left join public.work_preferences w on w.owner_id=member.id left join private.myday_personal_options o on o.owner_id=member.id and o.company_id=member.company_id where member.active and(p_owner is null or member.id=p_owner)and coalesce((select enabled from private.myday_daily_preferences pref where pref.owner_id=member.id and pref.company_id=member.company_id),true)loop
  d:=(p_now at time zone p.zone)::date;
  if extract(isodow from d)::int<>all(coalesce((select days from private.myday_streak_settings where owner_id=p.id and company_id=p.company_id),array[1,2,3,4,5]))or exists(select 1 from private.myday_streak_pauses where owner_id=p.id and d between starts_on and ends_on)or(p_now at time zone p.zone)::time<coalesce((p.settings->>'work_end')::time,time '17:00')or private.myday_quiet(p.id,p_now)then continue;end if;
  if exists(select 1 from private.myday_day_reviews where owner_id=p.id and day=d)then continue;end if;
  select coalesce(array_agg(a.id)filter(where a.status='done'and(a.completed_at at time zone p.zone)::date=d),'{}'),coalesce(array_agg(a.id)filter(where a.status<>'done'and a.missed_at is null and(a.due_date<=d or exists(select 1 from private.myday_daily_choices x where x.owner_id=p.id and x.company_id=p.company_id and x.day=d and x.task_id=a.id))),'{}')into done_tasks,waiting_tasks from public.actions a where a.owner_id=p.id and a.company_id=p.company_id and a.deleted_at is null and a.purged_at is null;
  insert into private.myday_day_reviews(owner_id,company_id,day,done_ids,pending_ids,created_at)values(p.id,p.company_id,d,done_tasks,waiting_tasks,p_now)on conflict do nothing;get diagnostics inserted=row_count;if inserted=0 then continue;end if;
  insert into private.myday_notifications(owner_id,company_id,title,body,created_at,push_path)values(p.id,p.company_id,'Your day in review',d::text||' · '||cardinality(done_tasks)||' completed. '||cardinality(waiting_tasks)||' still waiting. Review your day and choose new dates.',p_now,null)returning id into notice;
  update private.myday_day_reviews set notification_id=notice where owner_id=p.id and day=d;n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function private.myday_day_review_tick(timestamptz,uuid)from public,anon,authenticated,service_role,console_backend;

-- Independent, metadata-only scheduler for the requested private end-of-day notices.
select cron.schedule('vimbre-day-review-minute','* * * * *','select private.myday_day_review_tick()');
