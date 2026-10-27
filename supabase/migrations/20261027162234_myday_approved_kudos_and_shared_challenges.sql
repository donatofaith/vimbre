create table private.myday_kudos(sender_id uuid not null references public.profiles(id) on delete cascade,recipient_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,day date not null,body text not null default '' check(length(body)<=500),created_at timestamptz not null default now(),primary key(sender_id,day),check(sender_id<>recipient_id));
create table private.myday_challenges(company_id uuid not null references public.companies(id) on delete cascade,team_key text not null,week date not null,baseline integer not null,primary key(company_id,team_key,week));
alter table private.myday_kudos enable row level security;
alter table private.myday_challenges enable row level security;
revoke all on private.myday_kudos,private.myday_challenges from public,anon,authenticated,service_role;
create function private.myday_social(p_operation text default 'get',p_recipient uuid default null,p_body text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;dept uuid;tz text;today date;week_start date;remaining integer;baseline integer;team text;mode text;begin
 select company_id,department_id into c,dept from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;week_start:=date_trunc('week',today)::date;team:=coalesce(dept::text,'company');
 mode:=coalesce((select x.mode from private.myday_competition x where company_id=c),'off');
 if p_operation not in('get','kudos') then raise invalid_parameter_value;end if;
 if p_operation='kudos' then
  if mode='off' or p_recipient is null or p_recipient=u or not exists(select 1 from public.profiles where id=p_recipient and company_id=c and active) then raise insufficient_privilege;end if;
  if p_body is null or length(p_body)>500 then raise invalid_parameter_value;end if;
  perform 1 from public.profiles where id in(u,p_recipient) order by id for update;
  if exists(select 1 from private.myday_kudos where sender_id=u and day=today and recipient_id<>p_recipient) then raise exception 'You can send one kudos star each day' using errcode='22023';end if;
  insert into private.myday_kudos values(u,p_recipient,c,today,btrim(p_body),now()) on conflict(sender_id,day) do nothing;
  if found then perform private.myday_bonus(p_recipient,c,(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=p_recipient),'Europe/London'))::date,1,'kudos:'||u::text||':'||today::text,'Kudos from a colleague');end if;
 end if;
 select count(*) into remaining from public.actions a join public.profiles p on p.id=a.owner_id and p.company_id=c and p.active and p.department_id is not distinct from dept join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join public.work_preferences pref on pref.owner_id=p.id where a.company_id=c and a.deleted_at is null and a.purged_at is null and a.missed_at is null and a.status<>'done' and (a.due_at at time zone coalesce(pref.timezone,'Europe/London'))::date<(now() at time zone coalesce(pref.timezone,'Europe/London'))::date;
 if mode<>'off' then insert into private.myday_challenges values(c,team,week_start,remaining) on conflict do nothing;end if;
 select ch.baseline into baseline from private.myday_challenges ch where company_id=c and team_key=team and week=week_start;
 return jsonb_build_object('enabled',mode<>'off','sent',exists(select 1 from private.myday_kudos where sender_id=u and day=today),'challenge',case when mode='off' or not coalesce((select visible from private.myday_star_consent where owner_id=u and company_id=c),false) then null else jsonb_build_object('title','Clear every overdue task this week','remaining',remaining,'baseline',coalesce(baseline,remaining),'done',greatest(0,coalesce(baseline,remaining)-remaining)) end,'received',coalesce((select jsonb_agg(to_jsonb(q)) from(select p.full_name as name,k.body,k.created_at from private.myday_kudos k join public.profiles p on p.id=k.sender_id and p.company_id=c where k.recipient_id=u and k.company_id=c order by k.created_at desc limit 10)q),'[]'));
end$$;
revoke all on function private.myday_social(text,uuid,text) from public,anon,service_role;
grant execute on function private.myday_social(text,uuid,text) to authenticated;
create function public.myday_social(p_operation text default 'get',p_recipient uuid default null,p_body text default '') returns jsonb language sql security invoker set search_path='' as $$select private.myday_social(p_operation,p_recipient,p_body)$$;
revoke all on function public.myday_social(text,uuid,text) from public,anon,service_role;
grant execute on function public.myday_social(text,uuid,text) to authenticated;
