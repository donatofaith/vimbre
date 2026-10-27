create or replace function private.myday_plan(p_operation text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;tz text;v_day date;settings jsonb;v jsonb;task public.actions;begins timestamptz;ends timestamptz;last_end timestamptz;slot timestamptz;minutes integer;seen uuid[]:='{}';existing private.myday_plans;completed jsonb;final_items jsonb;begin
 select company_id into c from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');v_day:=(now() at time zone tz)::date;
 settings:=coalesce((select o.settings from private.myday_personal_options o where owner_id=u),'{}');
 begins:=(v_day+coalesce(nullif(settings->>'work_start','')::time,time '09:00')) at time zone tz;
 ends:=(v_day+coalesce(nullif(settings->>'work_end','')::time,time '17:00')) at time zone tz;
 if p_operation='get' then
 return jsonb_build_object('today',v_day,'timezone',tz,'start',greatest(begins,now()),'end',ends,'ai',private.myday_enabled(c,'ai'),'completed',coalesce((select jsonb_agg(i||jsonb_build_object('title',a.title)) from private.myday_plans p cross join lateral jsonb_array_elements(p.items)i join public.actions a on a.id=(i->>'id')::uuid and a.owner_id=u and a.status='done' and a.deleted_at is null where p.owner_id=u and p.day=v_day),'[]'),'plan',(select to_jsonb(p) from private.myday_plans p where owner_id=u and p.day=v_day),'tasks',coalesce((select jsonb_agg(to_jsonb(a)) from public.actions a where owner_id=u and company_id=c and status<>'done' and deleted_at is null and purged_at is null and missed_at is null),'[]'));
 elsif p_operation='accept' then
 perform 1 from public.profiles where id=u for update;
 select * into existing from private.myday_plans where owner_id=u and myday_plans.day=v_day for update;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')>6 then raise invalid_parameter_value;end if;
 select coalesce(jsonb_agg(i),'[]') into completed from jsonb_array_elements(coalesce(existing.items,'[]'))i join public.actions a on a.id=(i->>'id')::uuid and a.owner_id=u and a.status='done' and a.deleted_at is null;
 final_items:=completed||coalesce(p_data->'items','[]');
 if existing.items=final_items then return jsonb_build_object('saved',true);end if;
 if jsonb_array_length(final_items)>6 then raise invalid_parameter_value;end if;
 if existing.replans>=3 then raise exception 'You can replan up to three times a day' using errcode='22023';end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')>6 then raise invalid_parameter_value;end if;
 for v in select value from jsonb_array_elements(p_data->'items') loop
  select * into task from public.actions where id=(v->>'id')::uuid and owner_id=u and company_id=c and status<>'done' and deleted_at is null and purged_at is null and missed_at is null for update;
  if task.id is null or task.id=any(seen) then raise insufficient_privilege;end if;
  seen:=array_append(seen,task.id);slot:=(v->>'start')::timestamptz;minutes:=(v->>'minutes')::integer;
  if slot is null or minutes is null or minutes not between 10 and 480 or slot<begins or slot+make_interval(mins=>minutes)>ends or last_end is not null and slot<last_end+interval '10 minutes' or length(coalesce(v->>'reason',''))>300 then raise invalid_parameter_value;end if;
  last_end:=slot+make_interval(mins=>minutes);
 end loop;
 insert into private.myday_plans(owner_id,company_id,day,items,replans) values(u,c,v_day,final_items,case when existing.owner_id is null then 0 else existing.replans+1 end) on conflict(owner_id,day) do update set items=excluded.items,replans=excluded.replans,updated_at=now();
 for v in select value||jsonb_build_object('position',ordinality) from jsonb_array_elements(p_data->'items') with ordinality loop
  update public.actions set metadata=metadata||jsonb_build_object('plan_day',v_day,'plan_order',(v->>'position')::int,'plan_reason',v->>'reason','plan_start',v->>'start','plan_minutes',(v->>'minutes')::int) where id=(v->>'id')::uuid and owner_id=u;
  insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status) select id,u,c,u,'plan_accepted',status from public.actions where id=(v->>'id')::uuid and owner_id=u;
 end loop;
 return jsonb_build_object('saved',true);
 else raise invalid_parameter_value;end if;
end$$;

