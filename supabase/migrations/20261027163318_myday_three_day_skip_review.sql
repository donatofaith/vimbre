-- Explicit Not today choices; no inference from slow or unfinished work.
create table private.myday_plan_skips(owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,task_id uuid not null references public.actions(id) on delete cascade,day date not null,reviewed_at timestamptz,primary key(task_id,day));
alter table private.myday_plan_skips enable row level security;
revoke all on private.myday_plan_skips from public,anon,authenticated,service_role;
create function private.myday_skip_review(p_operation text default 'get',p_task uuid default null,p_date date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;tz text;today date;t public.actions;begin
select company_id into c from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
if p_operation is null or p_operation not in('get','skip','keep') then raise invalid_parameter_value;end if;
if p_operation<>'get' then
 select * into t from public.actions where id=p_task and owner_id=u and company_id=c and status<>'done' and deleted_at is null and purged_at is null for update;if t.id is null then raise insufficient_privilege;end if;
 if p_operation='skip' then
  if p_date is null or p_date<=today then raise invalid_parameter_value;end if;
  perform private.myday_action(p_task,'reschedule',jsonb_build_object('due_date',p_date,'due_time',null));
  insert into private.myday_plan_skips(owner_id,company_id,task_id,day) values(u,c,p_task,today) on conflict(task_id,day) do nothing;
 else
  update private.myday_plan_skips set reviewed_at=now() where task_id=p_task and owner_id=u and company_id=c and reviewed_at is null;
 end if;
end if;
return jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(a)) from public.actions a where a.owner_id=u and a.company_id=c and a.status<>'done' and a.deleted_at is null and a.purged_at is null and a.missed_at is null and (select count(*) from private.myday_plan_skips s where s.task_id=a.id and s.owner_id=u and s.company_id=c and s.reviewed_at is null and s.day between today-2 and today)=3),'[]'));
end$$;
revoke all on function private.myday_skip_review(text,uuid,date) from public,anon,service_role;
grant execute on function private.myday_skip_review(text,uuid,date) to authenticated;
create function public.myday_skip_review(p_operation text default 'get',p_task uuid default null,p_date date default null) returns jsonb language sql security invoker set search_path='' as $$select private.myday_skip_review(p_operation,p_task,p_date)$$;
revoke all on function public.myday_skip_review(text,uuid,date) from public,anon,service_role;
grant execute on function public.myday_skip_review(text,uuid,date) to authenticated;
