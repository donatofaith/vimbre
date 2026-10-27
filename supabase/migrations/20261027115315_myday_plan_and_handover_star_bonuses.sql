create function private.myday_bonus(p_owner uuid,p_company uuid,p_day date,p_points integer,p_key text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare earned integer;begin
 if coalesce((select mode from private.myday_competition where company_id=p_company),'off')='off' then return;end if;
 perform 1 from public.profiles where id=p_owner and company_id=p_company and active for update;if not found then return;end if;
 select coalesce(sum(points),0) into earned from private.myday_star_awards where owner_id=p_owner and day=p_day and not voided;
 insert into private.myday_star_awards(company_id,owner_id,day,points,reason,source_key) values(p_company,p_owner,p_day,greatest(0,least(15-earned,p_points)),p_reason,p_key) on conflict(owner_id,source_key) do nothing;
end$$;
revoke all on function private.myday_bonus(uuid,uuid,date,integer,text,text) from public,anon,authenticated,service_role;
create function private.myday_handover_stars() returns trigger language plpgsql security definer set search_path='' as $$
declare tz text;begin
 if new.status='cancelled' then update private.myday_star_awards set voided=true where source_key='handover:'||new.id::text;return new;end if;
 if new.status='pending' and old.status is distinct from 'pending' and auth.uid()=new.owner_id and (length(btrim(coalesce(new.body,'')))>0 or length(coalesce(new.sections,'{}')::text)>2) then
  tz:=coalesce((select timezone from public.work_preferences where owner_id=new.owner_id),'Europe/London');
  perform private.myday_bonus(new.owner_id,new.company_id,(now() at time zone tz)::date,5,'handover:'||new.id::text,'Prepared and submitted a handover');
 end if;return new;
end$$;
revoke all on function private.myday_handover_stars() from public,anon,authenticated,service_role;
create trigger myday_handover_stars after update of status on public.work_handovers for each row execute function private.myday_handover_stars();
create or replace function private.myday_award_task() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();tz text;v_day date;earned int;points int;weight numeric;is_cover boolean;fingerprint text;begin
 if new.status<>'done' or new.deleted_at is not null or new.purged_at is not null then
  update private.myday_star_awards set voided=true where task_id=new.id or exists(select 1 from private.myday_plans p where p.owner_id=myday_star_awards.owner_id and myday_star_awards.source_key='plan:'||p.day::text and exists(select 1 from jsonb_array_elements(p.items)i where i->>'id'=new.id::text));
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
 if exists(select 1 from private.myday_plans p where p.owner_id=actor and p.day=v_day and jsonb_array_length(p.items)>0 and not exists(select 1 from jsonb_array_elements(p.items)i left join public.actions a on a.id=(i->>'id')::uuid and a.owner_id=actor where a.id is null or a.status<>'done' or a.deleted_at is not null)) then perform private.myday_bonus(actor,new.company_id,v_day,3,'plan:'||v_day::text,'Completed today’s whole plan');end if;
 return new;
end$$;

