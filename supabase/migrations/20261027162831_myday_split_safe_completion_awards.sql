do $$begin if exists(select 1 from private.myday_competition where mode<>'off') then raise exception 'Competition must remain off during scoring upgrade';end if;end$$;
create or replace function private.myday_award_task() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();tz text;v_day date;earned int;points int;weight numeric;units integer;is_cover boolean;fingerprint text;begin
 if new.status<>'done' or new.deleted_at is not null or new.purged_at is not null then
  perform private.myday_void_task_stars(new.id);
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
 units:=((1+case when new.metadata->>'plan_day'=v_day::text and new.metadata->>'plan_order'='1' then 1 else 0 end+case when new.metadata->>'plan_start' is not null and now()<(new.metadata->>'plan_start')::timestamptz+make_interval(mins=>coalesce((new.metadata->>'plan_minutes')::int,30)) then 1 else 0 end+case when new.decision_id is not null and new.owner_id=actor and exists(select 1 from public.decisions d where d.id=new.decision_id and d.owner_id=actor and d.company_id=new.company_id and btrim(d.reason)<>'') then 1 else 0 end)*greatest(10,least(480,coalesce(new.time_needed_minutes,30)))*case new.priority when 'high' then 3 when 'low' then 1 else 2 end*case when is_cover then 2 else 1 end);
 insert into private.myday_star_awards(company_id,owner_id,task_id,day,points,reason,source_key,credit_units) values(new.company_id,actor,new.id,v_day,0,case when is_cover then 'Completed approved cover task · double credit' else 'Completed task · weighted by priority and estimated time' end,fingerprint,units) on conflict(owner_id,source_key) do nothing;
 perform private.myday_rebalance_stars(actor,v_day);
 if exists(select 1 from private.myday_plans p where p.owner_id=actor and p.day=v_day and jsonb_array_length(p.items)>0 and not exists(select 1 from jsonb_array_elements(p.items)i left join public.actions a on a.id=(i->>'id')::uuid and a.owner_id=actor where a.id is null or a.status<>'done' or a.deleted_at is not null)) then perform private.myday_bonus(actor,new.company_id,v_day,3,'plan:'||v_day::text,'Completed today’s whole plan');end if;
 return new;
end$$;
