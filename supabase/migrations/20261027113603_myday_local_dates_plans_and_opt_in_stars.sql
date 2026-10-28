CREATE OR REPLACE FUNCTION private.myday_counts(p_query text, p_for text, p_source text, p_priority text, p_task uuid, p_decision uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare tz text; today date; result jsonb;begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');today:=(now() at time zone tz)::date;
 with base as materialized(select a.*,(a.due_at at time zone tz)::date as due_day from public.actions a where a.owner_id=auth.uid() and a.purged_at is null
 and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_source='' or a.source_kind=p_source) and (p_priority='' or a.priority=p_priority))
 select jsonb_build_object(
 'tab_counts',jsonb_build_object('today',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and (due_day>=today or due_at is null) and (due_day=today or pinned_at is not null)),
 'week',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_day between today and today+6),'overdue',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_day<today),'done',count(*) filter(where deleted_at is null and status='done'),'all',count(*) filter(where deleted_at is null),'archived',count(*) filter(where deleted_at is not null)),
 'counts',jsonb_build_object('today',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and (due_day>=today or due_at is null) and (due_day=today or pinned_at is not null)),
 'todo',count(*) filter(where deleted_at is null and status='open' and missed_at is null and (due_day<today or due_day=today or pinned_at is not null)),
 'progress',count(*) filter(where deleted_at is null and status='in_progress' and missed_at is null and (due_day<today or due_day=today or pinned_at is not null)),
 'overdue',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_day<today),'done',count(*) filter(where deleted_at is null and status='done' and (completed_at at time zone tz)::date=today))) into result from base;
 return result;
end $function$

;
CREATE OR REPLACE FUNCTION public.myday_tasks(p_filter text, p_query text, p_for text, p_page integer, p_task uuid DEFAULT NULL::uuid, p_decision uuid DEFAULT NULL::uuid, p_source text DEFAULT ''::text, p_priority text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();tz text;today date;result jsonb;totals jsonb;begin
 if u is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_filter is null or p_filter not in ('today','week','overdue','all','archived','done') or p_page is null or p_page<0 or p_page>100000 or p_query is null or char_length(p_query)>100 or p_for is null or char_length(p_for)>80 or p_source is null or p_source not in ('','manual','email','notes','ai','recurring_deadline','role','meeting','handover','cover') or p_priority is null or p_priority not in ('','high','normal','low') then raise exception 'Invalid task filter' using errcode='22023';end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 totals:=private.myday_counts(p_query,p_for,p_source,p_priority,p_task,p_decision);
 with base as materialized(
 select a.*,private.myday_source_connected(cp.title) as source_connected,case when split_part(cp.title,':',1) in ('Gmail','Google Drive','Outlook','Microsoft Teams','Slack','Trello') then split_part(cp.title,':',1) else null end as source_name,cp.source_date,substring(cp.source_text from 'Source: (https?://[^[:space:]]+)') as source_origin_url,left(cp.source_text,500) as capture_excerpt,d.name as department_name,r.title as external_contact_name,ri.kind as source_role_kind,ri.role_id as source_role_profile_id,
 (a.due_at at time zone tz)::date as due_day,
 a.status<>'done' and ((a.due_at at time zone tz)::date<today or (a.due_at at time zone tz)::date=today or a.pinned_at is not null) as in_today
 from public.actions a left join public.captures cp on cp.id=a.capture_id and cp.owner_id=u left join public.departments d on d.id=a.department_id left join public.role_items r on r.id=a.external_contact_id
 left join public.role_items ri on ri.id=coalesce(a.source_role_id,a.stable_role_item_id,a.recurring_id)
 where a.owner_id=u and a.purged_at is null and (a.missed_at is null or p_filter in ('all','archived')) and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_source='' or a.source_kind=p_source) and (p_priority='' or a.priority=p_priority)
 ), filtered as materialized(select * from base where (deleted_at is not null)=(p_filter='archived')
 and (p_filter in ('all','archived') or p_filter='today' and in_today and (due_day>=today or due_at is null) or p_filter='done' and status='done' or p_filter='week' and status<>'done' and due_day between today and today+6 or p_filter='overdue' and status<>'done' and due_day<today)),
 ranked as(select *,row_number() over(order by case when metadata->>'plan_day'=today::text and metadata->>'plan_order' ~ '^[0-9]{1,3}$' then (metadata->>'plan_order')::int else 1000 end,(pinned_at is not null) desc,due_at,created_at,id) as rank from filtered),
 paged as(select * from ranked order by rank limit case when p_filter='today' then null else 60 end offset case when p_filter='today' then 0 else p_page*60 end)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by rank) from paged),'[]'::jsonb),'count',(select count(*) from filtered),'today',today,'timezone',tz,
 'tab_counts',totals->'tab_counts',
 'undated',coalesce((select jsonb_agg(to_jsonb(q) order by created_at,id) from base q where deleted_at is null and status<>'done' and due_date is null and missed_at is null),'[]'::jsonb),
 'overdue_rows',coalesce((select jsonb_agg(to_jsonb(q) order by (pinned_at is not null) desc,due_at,created_at,id) from base q where deleted_at is null and status<>'done' and due_day<today),'[]'::jsonb),
 'counts',totals->'counts',
 'has_work',exists(select 1 from public.actions where owner_id=u) or exists(select 1 from public.role_items where owner_id=u),
 'review_assignments',private.myday_incoming(),'context_waiting',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.actions where owner_id=u and status='done' and deleted_at is null and context_added_at is null order by completed_at desc limit 10)q),'[]'::jsonb),
 'done_today',coalesce((select jsonb_agg(to_jsonb(q) order by completed_at desc,id) from base q where deleted_at is null and status='done' and (completed_at at time zone tz)::date=today),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q) order by (pinned_at is not null) desc,due_at,created_at,id) from base q where deleted_at is null and status<>'done' and pinned_at is null and (due_day between today+1 and today+7 or due_day is null)),'[]'::jsonb),
 'review_drafts',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'capture_id',i.capture_id,'kind',i.kind,'version',i.version,'payload',i.payload,'duplicate',(i.kind='action' and exists(select 1 from public.actions a where a.owner_id=u and a.deleted_at is null and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))) or i.kind='decision' and exists(select 1 from public.decisions a where a.owner_id=u and a.deleted_at is null and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))) or i.kind='summary' and exists(select 1 from public.capture_summaries a where a.owner_id=u and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))))) order by i.created_at,i.id) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.status='pending' and c.deleted_at is null and strpos(lower(i.payload->>'title'),lower(p_query))>0),'[]'::jsonb),
 'drafts_waiting',(select count(*) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.status='pending' and c.deleted_at is null and strpos(lower(i.payload->>'title'),lower(p_query))>0),
 'decisions_waiting',0,
 'handovers_waiting',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title)) from public.work_handovers h where reviewer_id=u and status='pending'),'[]'::jsonb),
 'covering',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'owner_name',p.full_name,'owner_id',p.id)) from public.work_handovers h join public.profiles p on p.id=h.owner_id and p.active where h.cover_id=u and h.status='approved' and today between h.starts_on and h.ends_on),'[]'::jsonb),
 'cover_tasks',private.myday_cover_tasks(),
 'checklist',jsonb_build_object('capture',exists(select 1 from public.captures where owner_id=u),'role',exists(select 1 from public.role_items where owner_id=u and deleted_at is null) or exists(select 1 from public.decisions where owner_id=u and deleted_at is null),'reminder',exists(select 1 from public.actions where owner_id=u and deleted_at is null and remind_at is not null),'cover',exists(select 1 from public.work_handovers where owner_id=u and status<>'cancelled'))
 ) into result;return result;
end $function$

;

-- Competition never becomes visible without both company and personal consent.
create table private.myday_competition(company_id uuid primary key references public.companies(id) on delete cascade,mode text not null default 'off' check(mode in('off','teams','company')),updated_at timestamptz not null default now());
create table private.myday_star_consent(owner_id uuid primary key references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,visible boolean not null default false,updated_at timestamptz not null default now());
alter table private.myday_competition enable row level security;
alter table private.myday_star_consent enable row level security;
revoke all on private.myday_competition,private.myday_star_consent from public,anon,authenticated,service_role;
create function private.myday_competition_settings(p_mode text default null,p_visible boolean default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;r text;d uuid;begin
 select company_id,role,department_id into c,r,d from public.profiles where id=u and active;
 if c is null then raise insufficient_privilege;end if;
 if p_mode is not null then
  if r<>'hr_admin' then raise insufficient_privilege;end if;
  if p_mode not in('off','teams','company') then raise invalid_parameter_value;end if;
  insert into private.myday_competition values(c,p_mode,now()) on conflict(company_id) do update set mode=excluded.mode,updated_at=now();
  insert into public.activity_log(company_id,actor_id,action,record_type,record_id) values(c,u,'competition_settings','company',c);
 end if;
 if p_visible is not null then
  insert into public.activity_log(company_id,actor_id,action,record_type,record_id) values(c,u,case when p_visible then 'stars_opt_in' else 'stars_opt_out' end,'profile',u);
  insert into private.myday_star_consent values(u,c,p_visible,now()) on conflict(owner_id) do update set company_id=excluded.company_id,visible=excluded.visible,updated_at=now();
 end if;
 return jsonb_build_object('mode',coalesce((select mode from private.myday_competition where company_id=c),'off'),'visible',coalesce((select visible from private.myday_star_consent where owner_id=u and company_id=c),false),'admin',r='hr_admin');
end$$;
revoke all on function private.myday_competition_settings(text,boolean) from public,anon,service_role;
grant execute on function private.myday_competition_settings(text,boolean) to authenticated;
create function public.myday_competition_settings(p_mode text default null,p_visible boolean default null) returns jsonb language sql security invoker set search_path='' as $$select private.myday_competition_settings(p_mode,p_visible)$$;
revoke all on function public.myday_competition_settings(text,boolean) from public,anon,service_role;
grant execute on function public.myday_competition_settings(text,boolean) to authenticated;

create table private.myday_plans(owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,day date not null,items jsonb not null default '[]',replans integer not null default 0,updated_at timestamptz not null default now(),primary key(owner_id,day));
alter table private.myday_plans enable row level security;
revoke all on private.myday_plans from public,anon,authenticated,service_role;
create function private.myday_plan(p_operation text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;tz text;v_day date;settings jsonb;v jsonb;task public.actions;begins timestamptz;ends timestamptz;last_end timestamptz;slot timestamptz;minutes integer;seen uuid[]:='{}';existing private.myday_plans;begin
 select company_id into c from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');v_day:=(now() at time zone tz)::date;
 settings:=coalesce((select o.settings from private.myday_personal_options o where owner_id=u),'{}');
 begins:=(v_day+coalesce(nullif(settings->>'work_start','')::time,time '09:00')) at time zone tz;
 ends:=(v_day+coalesce(nullif(settings->>'work_end','')::time,time '17:00')) at time zone tz;
 if p_operation='get' then
 return jsonb_build_object('today',v_day,'timezone',tz,'start',greatest(begins,now()),'end',ends,'ai',private.myday_enabled(c,'ai'),'plan',(select to_jsonb(p) from private.myday_plans p where owner_id=u and p.day=v_day),'tasks',coalesce((select jsonb_agg(to_jsonb(a)) from public.actions a where owner_id=u and company_id=c and status<>'done' and deleted_at is null and purged_at is null and missed_at is null),'[]'));
 elsif p_operation='accept' then
 perform 1 from public.profiles where id=u for update;
 select * into existing from private.myday_plans where owner_id=u and myday_plans.day=v_day for update;
 if existing.replans>=3 then raise exception 'You can replan up to three times a day' using errcode='22023';end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')>6 then raise invalid_parameter_value;end if;
 for v in select value from jsonb_array_elements(p_data->'items') loop
  select * into task from public.actions where id=(v->>'id')::uuid and owner_id=u and company_id=c and status<>'done' and deleted_at is null and purged_at is null and missed_at is null for update;
  if task.id is null or task.id=any(seen) then raise insufficient_privilege;end if;
  seen:=array_append(seen,task.id);slot:=(v->>'start')::timestamptz;minutes:=(v->>'minutes')::integer;
  if slot is null or minutes is null or minutes not between 10 and 480 or slot<begins or slot+make_interval(mins=>minutes)>ends or last_end is not null and slot<last_end+interval '10 minutes' or length(coalesce(v->>'reason',''))>300 then raise invalid_parameter_value;end if;
  last_end:=slot+make_interval(mins=>minutes);
 end loop;
 insert into private.myday_plans(owner_id,company_id,day,items,replans) values(u,c,v_day,p_data->'items',case when existing.owner_id is null then 0 else existing.replans+1 end) on conflict(owner_id,day) do update set items=excluded.items,replans=excluded.replans,updated_at=now();
 for v in select value||jsonb_build_object('position',ordinality) from jsonb_array_elements(p_data->'items') with ordinality loop
  update public.actions set metadata=metadata||jsonb_build_object('plan_day',v_day,'plan_order',(v->>'position')::int,'plan_reason',v->>'reason','plan_start',v->>'start','plan_minutes',(v->>'minutes')::int) where id=(v->>'id')::uuid and owner_id=u;
  insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status) select id,u,c,u,'plan_accepted',status from public.actions where id=(v->>'id')::uuid and owner_id=u;
 end loop;
 return jsonb_build_object('saved',true);
 else raise invalid_parameter_value;end if;
end$$;
revoke all on function private.myday_plan(text,jsonb) from public,anon,service_role;
grant execute on function private.myday_plan(text,jsonb) to authenticated;
create function public.myday_plan(p_operation text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.myday_plan(p_operation,p_data)$$;
revoke all on function public.myday_plan(text,jsonb) from public,anon,service_role;
grant execute on function public.myday_plan(text,jsonb) to authenticated;

create table private.myday_star_awards(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,owner_id uuid not null references public.profiles(id) on delete cascade,task_id uuid references public.actions(id) on delete cascade,day date not null,points integer not null check(points between 0 and 15),reason text not null,source_key text not null,voided boolean not null default false,created_at timestamptz not null default now(),unique(owner_id,source_key));
alter table private.myday_star_awards enable row level security;
revoke all on private.myday_star_awards from public,anon,authenticated,service_role;
create index myday_star_awards_week on private.myday_star_awards(company_id,day,owner_id);
create function private.myday_award_task() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();tz text;v_day date;earned int;points int;weight numeric;is_cover boolean;fingerprint text;begin
 if new.status<>'done' or new.deleted_at is not null or new.purged_at is not null then
  update private.myday_star_awards set voided=true where task_id=new.id;
  return new;
 end if;
 if old.status='done' or new.due_date is null or new.created_at>now()-interval '10 minutes' or actor is null or new.missed_at is not null then return new;end if;
 if coalesce((select mode from private.myday_competition where company_id=new.company_id),'off')='off' then return new;end if;
 if not exists(select 1 from public.profiles where id=actor and company_id=new.company_id and active) then return new;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=actor),'Europe/London');v_day:=(now() at time zone tz)::date;
 is_cover:=actor<>new.owner_id and exists(select 1 from public.work_handovers h where h.owner_id=new.owner_id and h.company_id=new.company_id and h.cover_id=actor and h.status='approved' and v_day between h.starts_on and h.ends_on and (not h.structured or exists(select 1 from private.handover_items hi where hi.handover_id=h.id and hi.record_id=new.id and hi.kind='task' and hi.approved)));
 if actor<>new.owner_id and not is_cover then return new;end if;
 perform 1 from public.profiles where id=actor for update;
 fingerprint:='task:'||new.id::text;
 if exists(select 1 from private.myday_star_awards where owner_id=actor and source_key=fingerprint) then return new;end if;
 -- Duplicate titles do not earn repeated credit, even when tasks are recreated.
 if exists(select 1 from private.myday_star_awards s join public.actions a on a.id=s.task_id where s.owner_id=actor and s.day=v_day and lower(btrim(a.title))=lower(btrim(new.title))) then return new;end if;
 select coalesce(sum(a.points),0) into earned from private.myday_star_awards a where owner_id=actor and day=v_day and not voided;
 weight:=case new.priority when 'high' then 1.5 when 'low' then .5 else 1 end*least(2::numeric,greatest(.5::numeric,coalesce(new.time_needed_minutes,30)::numeric/30));
 points:=round((1+case when new.metadata->>'plan_day'=v_day::text and new.metadata->>'plan_order'='1' then 1 else 0 end+case when new.metadata->>'plan_start' is not null and now()<(new.metadata->>'plan_start')::timestamptz+make_interval(mins=>coalesce((new.metadata->>'plan_minutes')::int,30)) then 1 else 0 end+case when new.decision_id is not null and btrim(new.completion_note)<>'' then 1 else 0 end)*weight*case when is_cover then 2 else 1 end);
 points:=greatest(0,least(15-earned,points));
 insert into private.myday_star_awards(company_id,owner_id,task_id,day,points,reason,source_key) values(new.company_id,actor,new.id,v_day,points,case when is_cover then 'Completed approved cover task · double credit' else 'Completed task · weighted by priority and estimated time' end,fingerprint) on conflict(owner_id,source_key) do nothing;
 return new;
end$$;
revoke all on function private.myday_award_task() from public,anon,authenticated,service_role;
create trigger myday_task_stars after update of status,deleted_at,purged_at on public.actions for each row execute function private.myday_award_task();
create function private.myday_stars() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;department uuid;tz text;v_day date;mode text;week_start date;visible boolean;begin
 select company_id,department_id into c,department from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');v_day:=(now() at time zone tz)::date;week_start:=date_trunc('week',v_day)::date;
 mode:=coalesce((select x.mode from private.myday_competition x where company_id=c),'off');visible:=coalesce((select s.visible from private.myday_star_consent s where owner_id=u and company_id=c),false);
 return jsonb_build_object('mode',mode,'visible',visible,'today',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day=v_day and not voided),0),'week',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day>=week_start and not voided),0),'history',coalesce((select jsonb_agg(to_jsonb(q)) from (select points,reason,created_at from private.myday_star_awards where owner_id=u and not voided order by created_at desc limit 30)q),'[]'),'ranking',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(q)) from(select p.id,p.full_name,sum(s.points) as stars from private.myday_star_awards s join public.profiles p on p.id=s.owner_id and p.active and p.company_id=c join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible where s.company_id=c and s.day>=week_start and not s.voided and p.department_id is not distinct from department group by p.id,p.full_name order by sum(s.points) desc,p.id limit 3)q),'[]') end);
end$$;
revoke all on function private.myday_stars() from public,anon,service_role;
grant execute on function private.myday_stars() to authenticated;
create function public.myday_stars() returns jsonb language sql security invoker set search_path='' as $$select private.myday_stars()$$;
revoke all on function public.myday_stars() from public,anon,service_role;
grant execute on function public.myday_stars() to authenticated;

