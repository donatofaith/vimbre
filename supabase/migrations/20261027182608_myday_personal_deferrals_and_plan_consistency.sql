create table private.myday_plan_deferrals(owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,task_id uuid not null references public.actions(id) on delete cascade,until_date date not null,primary key(owner_id,task_id));
alter table private.myday_plan_deferrals enable row level security;
revoke all on private.myday_plan_deferrals from public,anon,authenticated,service_role;
create or replace function private.myday_plan_tasks() returns jsonb language sql stable security definer set search_path='' as $$
 with usual as(select percentile_cont(0.5) within group(order by minutes) minutes from (select extract(epoch from(a.completed_at-max(e.created_at)))/60 minutes from public.actions a join public.task_events e on e.task_id=a.id and e.actor_id=auth.uid() and e.status='in_progress' where a.owner_id=auth.uid() and a.company_id=private.current_company_id() and a.status='done' and a.deleted_at is null and a.completed_at>now()-interval '90 days' and e.created_at<a.completed_at group by a.id order by a.completed_at desc limit 30)x where minutes between 1 and 480)
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'due_date',a.due_date,'due_time',a.due_time,'due_at',a.due_at,'priority',a.priority,'created_at',a.created_at,'time_needed_minutes',coalesce(a.time_needed_minutes,round(usual.minutes)::int,30),'duration_source',case when a.time_needed_minutes is not null then 'estimate' when usual.minutes is not null then 'history' else 'default' end,'covering',a.owner_id<>auth.uid(),'owner_id',a.owner_id,'owner_name',p.full_name,'decision_id',case when a.owner_id=auth.uid() then a.decision_id end,'decision_reason',case when a.owner_id=auth.uid() then d.reason end,'needs_reason',a.owner_id=auth.uid() and a.decision_id is not null and (a.context_added_at is null or btrim(coalesce(d.reason,''))='')) order by a.due_at nulls last,a.created_at,a.id),'[]') from public.actions a cross join usual join public.profiles p on p.id=a.owner_id left join public.decisions d on d.id=a.decision_id and d.owner_id=auth.uid() and d.company_id=private.current_company_id() and d.deleted_at is null where a.status<>'done' and private.myday_can_plan(a.id) and not exists(select 1 from private.myday_plan_deferrals f where f.owner_id=auth.uid() and f.task_id=a.id and f.until_date>(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date)
$$;

create or replace function private.myday_plan(p_operation text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;tz text;today date;settings jsonb;v jsonb;a public.actions;begins timestamptz;ends timestamptz;last_end timestamptz;slot timestamptz;minutes int;seen uuid[]:='{}';existing private.myday_plans;completed jsonb;final_items jsonb;tasks jsonb;begin
 select company_id into c from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 settings:=coalesce((select o.settings from private.myday_personal_options o where owner_id=u),'{}');
 begins:=(today+coalesce(nullif(settings->>'work_start','')::time,time '09:00')) at time zone tz;ends:=(today+coalesce(nullif(settings->>'work_end','')::time,time '17:00')) at time zone tz;
 select * into existing from private.myday_plans where owner_id=u and day=today;
 select coalesce(jsonb_agg(i||jsonb_build_object('title',t.title)),'[]') into completed from jsonb_array_elements(coalesce(existing.items,'[]'))i join public.actions t on t.id=(i->>'id')::uuid and t.status='done' where private.myday_can_plan(t.id);
 if p_operation='get' then
  tasks:=private.myday_plan_tasks();
  return jsonb_build_object('today',today,'timezone',tz,'start',greatest(begins,now()),'end',ends,'ai',private.myday_enabled(c,'ai'),'tasks',tasks,'completed',completed,'plan',case when existing.owner_id is not null then to_jsonb(existing) end,'busy',coalesce((select jsonb_agg(jsonb_build_object('start',starts_at,'end',ends_at)) from private.myday_calendar_busy where owner_id=u and company_id=c and expires_at>now() and ends_at>begins and starts_at<ends),'[]'));
 elsif p_operation='accept' then
  perform 1 from public.profiles where id=u for update;
  select * into existing from private.myday_plans where owner_id=u and day=today for update;
  if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')>6 then raise invalid_parameter_value;end if;
  select coalesce(jsonb_agg(i),'[]') into completed from jsonb_array_elements(coalesce(existing.items,'[]'))i join public.actions t on t.id=(i->>'id')::uuid and t.status='done' where private.myday_can_plan(t.id);
  final_items:=completed||(p_data->'items');if existing.items=final_items then return jsonb_build_object('saved',true);end if;
  if jsonb_array_length(final_items)>6 then raise invalid_parameter_value;end if;if existing.replans>=3 then raise exception 'You can replan up to three times a day' using errcode='22023';end if;
  for v in select value from jsonb_array_elements(p_data->'items') loop
   select * into a from public.actions where id=(v->>'id')::uuid and company_id=c and status<>'done' and private.myday_can_plan(id) for update;
   if a.id is null or a.id=any(seen) then raise insufficient_privilege;end if;
   seen:=array_append(seen,a.id);slot:=(v->>'start')::timestamptz;minutes:=(v->>'minutes')::int;
   if slot is null or minutes is null or minutes not between 10 and 480 or slot<begins or slot+make_interval(mins=>minutes)>ends or last_end is not null and slot<last_end+interval '10 minutes' or length(coalesce(v->>'reason',''))>300 or exists(select 1 from private.myday_calendar_busy where owner_id=u and company_id=c and expires_at>now() and starts_at<slot+make_interval(mins=>minutes)+interval '10 minutes' and ends_at+interval '10 minutes'>slot) then raise invalid_parameter_value;end if;
   last_end:=slot+make_interval(mins=>minutes);
   if a.owner_id=u and nullif(btrim(v->>'decision_reason'),'') is not null then
    if length(v->>'decision_reason')>5000 then raise invalid_parameter_value;end if;
    update public.decisions set reason=v->>'decision_reason',updated_at=now() where id=a.decision_id and owner_id=u and company_id=c and deleted_at is null;
   end if;
  end loop;
  -- Due-today overflow stays visible and requires explicit acknowledgement.
  if exists(select 1 from jsonb_array_elements(private.myday_plan_tasks()) t where t->>'due_date'=today::text and not (t->>'id')::uuid=any(seen) and not coalesce(p_data->'acknowledged_unscheduled','[]') @> jsonb_build_array(t->>'id')) then raise exception 'Review tasks due today that do not fit' using errcode='22023';end if;
  insert into private.myday_plans(owner_id,company_id,day,items,replans) values(u,c,today,final_items,case when existing.owner_id is null then 0 else existing.replans+1 end) on conflict(owner_id,day) do update set items=excluded.items,replans=excluded.replans,updated_at=now();
  for v in select value||jsonb_build_object('position',ordinality) from jsonb_array_elements(p_data->'items') with ordinality loop
   update public.actions set metadata=metadata||jsonb_build_object('plan_day',today,'plan_order',(v->>'position')::int,'plan_reason',v->>'reason','plan_start',v->>'start','plan_minutes',(v->>'minutes')::int) where id=(v->>'id')::uuid and owner_id=u;
   insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status) select id,owner_id,c,u,'plan_accepted',status from public.actions where id=(v->>'id')::uuid;
  end loop;
  return jsonb_build_object('saved',true);
 else raise invalid_parameter_value;end if;
end$$;

create function private.myday_defer_plan_task(p_task uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();today date;holder uuid;begin
 if u is null or c is null or not private.myday_can_plan(p_task) then raise insufficient_privilege;end if;
 today:=(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date;
 if p_date is null or p_date<=today then raise invalid_parameter_value;end if;
 select owner_id into holder from public.actions where id=p_task and status<>'done' for update;if holder is null then raise invalid_parameter_value;end if;
 if holder=u then perform private.myday_skip_review('skip',p_task,p_date);end if;
 insert into private.myday_plan_deferrals values(u,c,p_task,p_date) on conflict(owner_id,task_id) do update set until_date=excluded.until_date;
 update private.myday_plans p set items=coalesce((select jsonb_agg(i) from jsonb_array_elements(p.items)i where i->>'id'<>p_task::text),'[]'),updated_at=now() where p.owner_id=u and p.company_id=c and p.day=today;
end$$;
revoke all on function private.myday_defer_plan_task(uuid,date) from public,anon,service_role;
grant execute on function private.myday_defer_plan_task(uuid,date) to authenticated;
create function public.myday_defer_plan_task(p_task uuid,p_date date) returns void language sql security invoker set search_path='' as $$select private.myday_defer_plan_task(p_task,p_date)$$;
revoke all on function public.myday_defer_plan_task(uuid,date) from public,anon,service_role;
grant execute on function public.myday_defer_plan_task(uuid,date) to authenticated;
revoke all on function private.myday_plan(text,jsonb) from public,anon,service_role;
grant execute on function private.myday_plan(text,jsonb) to authenticated;
revoke all on function private.myday_plan_tasks() from public,anon,service_role;
grant execute on function private.myday_plan_tasks() to authenticated;
