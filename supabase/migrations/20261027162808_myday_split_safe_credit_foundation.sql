do $$begin if exists(select 1 from private.myday_competition where mode<>'off') then raise exception 'Competition must remain off during scoring upgrade';end if;end$$;
-- Integer credit units avoid rounding rewards from splitting the same estimated work.
alter table private.myday_star_awards add column credit_units integer not null default 0 check(credit_units>=0);
update private.myday_star_awards set credit_units=points*60;
create function private.myday_rebalance_stars(p_owner uuid,p_day date) returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.profiles where id=p_owner for update;
 with running as(select id,sum(credit_units) over(order by created_at,id rows unbounded preceding) as total,coalesce(sum(credit_units) over(order by created_at,id rows between unbounded preceding and 1 preceding),0) as previous from private.myday_star_awards where owner_id=p_owner and day=p_day and not voided),scores as(select id,(least(15,floor(total/60.0))-least(15,floor(previous/60.0)))::integer as points from running)
 update private.myday_star_awards a set points=s.points from scores s where a.id=s.id;
 update private.myday_star_awards set points=0 where owner_id=p_owner and day=p_day and voided;
end$$;
revoke all on function private.myday_rebalance_stars(uuid,date) from public,anon,authenticated,service_role;
create or replace function private.myday_bonus(p_owner uuid,p_company uuid,p_day date,p_points integer,p_key text,p_reason text) returns void language plpgsql security definer set search_path='' as $$begin
 if coalesce((select mode from private.myday_competition where company_id=p_company),'off')='off' then return;end if;
 perform 1 from public.profiles where id=p_owner and company_id=p_company and active for update;if not found then return;end if;
 insert into private.myday_star_awards(company_id,owner_id,day,points,reason,source_key,credit_units) values(p_company,p_owner,p_day,0,p_reason,p_key,greatest(0,least(15,p_points))*60) on conflict(owner_id,source_key) do nothing;
 perform private.myday_rebalance_stars(p_owner,p_day);
end$$;
create function private.myday_void_task_stars(p_task uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record;begin
 perform 1 from public.profiles where id in(select a.owner_id from private.myday_star_awards a where a.task_id=p_task or exists(select 1 from private.myday_plans p where p.owner_id=a.owner_id and a.source_key='plan:'||p.day::text and exists(select 1 from jsonb_array_elements(p.items)i where i->>'id'=p_task::text))) order by id for update;
 update private.myday_star_awards a set voided=true where a.task_id=p_task or exists(select 1 from private.myday_plans p where p.owner_id=a.owner_id and a.source_key='plan:'||p.day::text and exists(select 1 from jsonb_array_elements(p.items)i where i->>'id'=p_task::text));
 for r in select distinct a.owner_id,a.day from private.myday_star_awards a where a.task_id=p_task or exists(select 1 from private.myday_plans p where p.owner_id=a.owner_id and a.source_key='plan:'||p.day::text and exists(select 1 from jsonb_array_elements(p.items)i where i->>'id'=p_task::text)) loop perform private.myday_rebalance_stars(r.owner_id,r.day);end loop;
end$$;
revoke all on function private.myday_void_task_stars(uuid) from public,anon,authenticated,service_role;
