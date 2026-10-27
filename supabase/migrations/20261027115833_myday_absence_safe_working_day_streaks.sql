create table private.myday_streak_settings(owner_id uuid primary key references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,days integer[] not null default array[1,2,3,4,5]);
create table private.myday_streak_pauses(owner_id uuid not null references public.profiles(id) on delete cascade,starts_on date not null,ends_on date not null,primary key(owner_id,starts_on),check(ends_on>=starts_on));
alter table private.myday_streak_settings enable row level security;
alter table private.myday_streak_pauses enable row level security;
revoke all on private.myday_streak_settings,private.myday_streak_pauses from public,anon,authenticated,service_role;
create function private.myday_streak_settings(p_days integer[] default null,p_from date default null,p_until date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;begin
 select company_id into c from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 if p_days is not null then
  if cardinality(p_days) not between 1 and 7 or exists(select 1 from unnest(p_days)d where d is null or d not between 1 and 7) then raise invalid_parameter_value;end if;
  insert into private.myday_streak_settings values(u,c,array(select distinct d from unnest(p_days)d order by d)) on conflict(owner_id) do update set company_id=excluded.company_id,days=excluded.days;
 end if;
 if p_from is not null or p_until is not null then
  if p_from is null or p_until is null or p_from<current_date-31 or p_until>current_date+366 or p_until<p_from then raise invalid_parameter_value;end if;
  insert into private.myday_streak_pauses values(u,p_from,p_until) on conflict(owner_id,starts_on) do update set ends_on=excluded.ends_on;
 end if;
 if p_days is not null or p_from is not null then insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'profile',u,'streak_settings');end if;
 return jsonb_build_object('days',coalesce((select to_jsonb(days) from private.myday_streak_settings where owner_id=u),to_jsonb(array[1,2,3,4,5])),'pauses',coalesce((select jsonb_agg(jsonb_build_object('from',starts_on,'until',ends_on) order by starts_on) from private.myday_streak_pauses where owner_id=u and ends_on>=current_date-31),'[]'));
end$$;
revoke all on function private.myday_streak_settings(integer[],date,date) from public,anon,service_role;
grant execute on function private.myday_streak_settings(integer[],date,date) to authenticated;
create function public.myday_streak_settings(p_days integer[] default null,p_from date default null,p_until date default null) returns jsonb language sql security invoker set search_path='' as $$select private.myday_streak_settings(p_days,p_from,p_until)$$;
revoke all on function public.myday_streak_settings(integer[],date,date) from public,anon,service_role;
grant execute on function public.myday_streak_settings(integer[],date,date) to authenticated;
create function private.myday_streak(p_owner uuid) returns integer language plpgsql stable security definer set search_path='' as $$
declare tz text;today date;d date;days integer[];streak integer:=0;begin
 tz:=coalesce((select timezone from public.work_preferences where owner_id=p_owner),'Europe/London');today:=(now() at time zone tz)::date;
 days:=coalesce((select s.days from private.myday_streak_settings s where owner_id=p_owner),array[1,2,3,4,5]);
 for n in 0..366 loop
  d:=today-n;
  if not extract(isodow from d)::int=any(days) then continue;end if;
  if exists(select 1 from private.myday_streak_pauses where owner_id=p_owner and d between starts_on and ends_on) or exists(select 1 from public.work_handovers where owner_id=p_owner and status in('approved','completed') and d between starts_on and ends_on) then continue;end if;
  if exists(select 1 from private.myday_star_awards where owner_id=p_owner and day=d and points>0 and not voided) then streak:=streak+1;elsif d<>today then exit;end if;
 end loop;return streak;
end$$;
revoke all on function private.myday_streak(uuid) from public,anon,authenticated,service_role;
create or replace function private.myday_stars() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;department uuid;tz text;v_day date;mode text;week_start date;visible boolean;begin
 select company_id,department_id into c,department from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');v_day:=(now() at time zone tz)::date;week_start:=date_trunc('week',v_day)::date;
 mode:=coalesce((select x.mode from private.myday_competition x where company_id=c),'off');visible:=coalesce((select s.visible from private.myday_star_consent s where owner_id=u and company_id=c),false);
 return jsonb_build_object('mode',mode,'streak',private.myday_streak(u),'visible',visible,'today',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day=v_day and not voided),0),'week',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day>=week_start and not voided),0),'history',coalesce((select jsonb_agg(to_jsonb(q)) from (select points,reason,created_at from private.myday_star_awards where owner_id=u and not voided order by created_at desc limit 30)q),'[]'),'teams',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(team)) from(select coalesce(d.name,'Company team') as name,round(avg(member.points),2) as average,count(*) as members from(select p.department_id,coalesce(sum(s.points),0) as points from public.profiles p join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join private.myday_star_awards s on s.owner_id=p.id and s.company_id=c and s.day>=week_start and not s.voided where p.company_id=c and p.active group by p.id,p.department_id)member left join public.departments d on d.id=member.department_id and d.company_id=c group by d.name order by avg(member.points) desc,d.name)team),'[]') end,
 'own_rank',case when mode='off' or not visible then null else (select place from(select p.id,rank() over(order by coalesce(sum(s.points),0) desc) as place from public.profiles p join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join private.myday_star_awards s on s.owner_id=p.id and s.company_id=c and s.day>=week_start and not s.voided where p.company_id=c and p.active and p.department_id is not distinct from department group by p.id)ranked where id=u) end,
 'ranking',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(q)) from(select p.id,p.full_name,sum(s.points) as stars from private.myday_star_awards s join public.profiles p on p.id=s.owner_id and p.active and p.company_id=c join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible where s.company_id=c and s.day>=week_start and not s.voided and p.department_id is not distinct from department group by p.id,p.full_name order by sum(s.points) desc,p.id limit 3)q),'[]') end);
end$$;

