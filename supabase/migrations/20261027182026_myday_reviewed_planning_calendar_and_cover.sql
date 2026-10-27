-- Complete personal planning without widening task/decision access.
create function private.myday_can_plan(p_task uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.actions a join public.profiles me on me.id=auth.uid() and me.active and me.company_id=a.company_id join public.profiles holder on holder.id=a.owner_id and holder.active and holder.company_id=a.company_id where a.id=p_task and a.deleted_at is null and a.purged_at is null and a.missed_at is null and (a.owner_id=me.id or exists(select 1 from public.work_handovers h where h.company_id=a.company_id and h.owner_id=a.owner_id and h.cover_id=me.id and h.status='approved' and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=me.id),'Europe/London'))::date between h.starts_on and h.ends_on and exists(select 1 from private.handover_items i where i.handover_id=h.id and i.kind='task' and i.record_id=a.id and i.approved))))
$$;
revoke all on function private.myday_can_plan(uuid) from public,anon,authenticated,service_role;

create table private.myday_calendar_busy(owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,provider text not null check(provider in('gmail','outlook')),starts_at timestamptz not null,ends_at timestamptz not null,expires_at timestamptz not null,check(ends_at>starts_at),primary key(owner_id,provider,starts_at,ends_at));
alter table private.myday_calendar_busy enable row level security;
revoke all on private.myday_calendar_busy from public,anon,authenticated,service_role;

create function private.myday_calendar_busy_service(p_user uuid,p_provider text,p_slots jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c uuid; v jsonb;begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege;end if;
 select company_id into c from public.profiles where id=p_user and active;if c is null then raise insufficient_privilege;end if;
 if p_provider not in('gmail','outlook') or p_provider is null or jsonb_typeof(p_slots) is distinct from 'array' or jsonb_array_length(p_slots)>300 then raise invalid_parameter_value;end if;
 delete from private.myday_calendar_busy where owner_id=p_user and provider=p_provider;
 for v in select value from jsonb_array_elements(p_slots) loop
  if (v->>'end')::timestamptz<=(v->>'start')::timestamptz or (v->>'start')::timestamptz<now()-interval '2 days' or (v->>'end')::timestamptz>now()+interval '3 days' then raise invalid_parameter_value;end if;
  insert into private.myday_calendar_busy values(p_user,c,p_provider,(v->>'start')::timestamptz,(v->>'end')::timestamptz,now()+interval '5 minutes') on conflict do nothing;
 end loop;
end$$;
revoke all on function private.myday_calendar_busy_service(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.myday_calendar_busy_service(uuid,text,jsonb) to service_role;
create function public.myday_calendar_busy_service(p_user uuid,p_provider text,p_slots jsonb) returns void language sql security invoker set search_path='' as $$select private.myday_calendar_busy_service(p_user,p_provider,p_slots)$$;
revoke all on function public.myday_calendar_busy_service(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.myday_calendar_busy_service(uuid,text,jsonb) to service_role;

create function private.myday_plan_tasks() returns jsonb language sql stable security definer set search_path='' as $$
 with usual as(select percentile_cont(0.5) within group(order by minutes) minutes from (select extract(epoch from(a.completed_at-max(e.created_at)))/60 minutes from public.actions a join public.task_events e on e.task_id=a.id and e.actor_id=auth.uid() and e.status='in_progress' where a.owner_id=auth.uid() and a.company_id=private.current_company_id() and a.status='done' and a.deleted_at is null and a.completed_at>now()-interval '90 days' and e.created_at<a.completed_at group by a.id order by a.completed_at desc limit 30)x where minutes between 1 and 480)
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'due_date',a.due_date,'due_time',a.due_time,'due_at',a.due_at,'priority',a.priority,'created_at',a.created_at,'time_needed_minutes',coalesce(a.time_needed_minutes,round(usual.minutes)::int,30),'duration_source',case when a.time_needed_minutes is not null then 'estimate' when usual.minutes is not null then 'history' else 'default' end,'covering',a.owner_id<>auth.uid(),'owner_id',a.owner_id,'owner_name',p.full_name,'decision_id',case when a.owner_id=auth.uid() then a.decision_id end,'decision_reason',case when a.owner_id=auth.uid() then d.reason end,'needs_reason',a.owner_id=auth.uid() and a.decision_id is not null and btrim(coalesce(d.reason,''))='') order by a.due_at nulls last,a.created_at,a.id),'[]') from public.actions a cross join usual join public.profiles p on p.id=a.owner_id left join public.decisions d on d.id=a.decision_id and d.owner_id=auth.uid() and d.company_id=private.current_company_id() and d.deleted_at is null where a.status<>'done' and private.myday_can_plan(a.id)
$$;
revoke all on function private.myday_plan_tasks() from public,anon,service_role;
grant execute on function private.myday_plan_tasks() to authenticated;

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
  final_items:=completed||(p_data->'items');if existing.items=final_items then return jsonb_build_object('saved',true);end if;
  if jsonb_array_length(final_items)>6 then raise invalid_parameter_value;end if;if existing.replans>=3 then raise exception 'You can replan up to three times a day' using errcode='22023';end if;
  for v in select value from jsonb_array_elements(p_data->'items') loop
   select * into a from public.actions where id=(v->>'id')::uuid and company_id=c and status<>'done' and private.myday_can_plan(id) for update;
   if a.id is null or a.id=any(seen) then raise insufficient_privilege;end if;
   seen:=array_append(seen,a.id);slot:=(v->>'start')::timestamptz;minutes:=(v->>'minutes')::int;
   if slot is null or minutes is null or minutes not between 10 and 480 or slot<begins or slot+make_interval(mins=>minutes)>ends or last_end is not null and slot<last_end+interval '10 minutes' or length(coalesce(v->>'reason',''))>300 or exists(select 1 from private.myday_calendar_busy where owner_id=u and company_id=c and expires_at>now() and starts_at<slot+make_interval(mins=>minutes) and ends_at+interval '10 minutes'>slot) then raise invalid_parameter_value;end if;
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

create function private.myday_plan_action(p_task uuid,p_operation text,p_reason text default null) returns void language plpgsql security definer set search_path='' as $$
declare a public.actions;u uuid:=auth.uid();c uuid:=private.current_company_id();begin
 if u is null or c is null or not private.myday_can_plan(p_task) then raise insufficient_privilege;end if;
 if p_operation is null or p_operation not in('start','done') or length(coalesce(p_reason,''))>5000 then raise invalid_parameter_value;end if;
 select * into a from public.actions where id=p_task and company_id=c for update;
 if a.status='done' then return;end if;
 if a.owner_id=u and a.decision_id is not null and nullif(btrim(p_reason),'') is not null then update public.decisions set reason=p_reason,updated_at=now() where id=a.decision_id and owner_id=u and company_id=c and deleted_at is null;end if;
 if a.owner_id=u then perform private.myday_action(p_task,'status',jsonb_build_object('status',case when p_operation='done' then 'done' else 'in_progress' end));
 else
  update public.actions set status=case when p_operation='done' then 'done' else 'in_progress' end,completed_at=case when p_operation='done' then now() else null end,updated_at=now() where id=p_task;
  insert into public.task_events(task_id,owner_id,company_id,actor_id,event,previous_status,status) values(a.id,a.owner_id,c,u,'status_changed',a.status,case when p_operation='done' then 'done' else 'in_progress' end);
 end if;
end$$;
revoke all on function private.myday_plan_action(uuid,text,text) from public,anon,service_role;
grant execute on function private.myday_plan_action(uuid,text,text) to authenticated;
create function public.myday_plan_action(p_task uuid,p_operation text,p_reason text default null) returns void language sql security invoker set search_path='' as $$select private.myday_plan_action(p_task,p_operation,p_reason)$$;
revoke all on function public.myday_plan_action(uuid,text,text) from public,anon,service_role;
grant execute on function public.myday_plan_action(uuid,text,text) to authenticated;
