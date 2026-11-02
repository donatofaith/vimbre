-- Daily AI suggestions are private, explicit and never change the underlying tasks.
create table if not exists private.myday_priority_reviews (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 day date not null, items jsonb not null default '[]', rejected uuid[] not null default '{}',
 reviewed_at timestamptz, primary key(owner_id,day)
);
alter table private.myday_priority_reviews enable row level security;
revoke all on private.myday_priority_reviews from public,anon,authenticated,service_role,console_backend;
create or replace function private.myday_priority_review(p_action text default 'get',p_task uuid default null,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();tz text;today date;r private.myday_priority_reviews;result jsonb;
begin
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and company_id=c and active) then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 if p_action in ('save','reject') then
  if p_data->>'day' is distinct from today::text then raise exception 'The day changed. Review priorities again.' using errcode='40001';end if;
  insert into private.myday_priority_reviews(owner_id,company_id,day)values(u,c,today)on conflict do nothing;
  select * into r from private.myday_priority_reviews where owner_id=u and company_id=c and day=today for update;
  if p_action='save' then
   if jsonb_typeof(p_data->'items') is distinct from 'array' then raise invalid_parameter_value;end if;
   if jsonb_array_length(p_data->'items')>3 then raise invalid_parameter_value;end if;
   if exists(select 1 from jsonb_array_elements(p_data->'items') x where jsonb_typeof(x->'reason') is distinct from 'string' or length(btrim(x->>'reason')) not between 1 and 300 or not exists(select 1 from public.actions a where a.id::text=x->>'id' and a.owner_id=u and a.company_id=c and a.status<>'done' and a.deleted_at is null and a.purged_at is null and a.missed_at is null)) or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(p_data->'items')x)then raise invalid_parameter_value;end if;
   update private.myday_priority_reviews set items=coalesce((select jsonb_agg(jsonb_build_object('id',x->>'id','reason',x->>'reason'))from jsonb_array_elements(p_data->'items')x where not (x->>'id')::uuid=any(r.rejected)),'[]'),reviewed_at=now()where owner_id=u and company_id=c and day=today;
  else
   if not exists(select 1 from jsonb_array_elements(r.items)x where x->>'id'=p_task::text)then raise invalid_parameter_value;end if;
   update private.myday_priority_reviews set rejected=array(select distinct unnest(rejected||array[p_task])),items=coalesce((select jsonb_agg(x)from jsonb_array_elements(r.items)x where x->>'id'<>p_task::text),'[]') where owner_id=u and company_id=c and day=today;
  end if;
 elsif p_action not in ('get','source')then raise invalid_parameter_value;end if;
 select * into r from private.myday_priority_reviews where owner_id=u and company_id=c and day=today;
 result:=jsonb_build_object('today',today,'timezone',tz,'reviewed_at',r.reviewed_at,'items',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'due_date',a.due_date,'priority',a.priority,'reason',x->>'reason','accepted',exists(select 1 from private.myday_daily_choices ch where ch.owner_id=u and ch.company_id=c and ch.day=today and ch.task_id=a.id))order by ord)from jsonb_array_elements(coalesce(r.items,'[]'))with ordinality as rows(x,ord)join public.actions a on a.id::text=x->>'id' where a.owner_id=u and a.company_id=c and a.status<>'done'and a.deleted_at is null and a.purged_at is null and a.missed_at is null),'[]'));
 if p_action='source'then
  result:=result||jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(t))from(select a.id,a.title,left(a.details,1200)details,a.due_date,a.due_time,a.priority,a.time_needed_minutes,(a.source_role_id is not null or a.stable_role_item_id is not null)role_linked,a.source_kind from public.actions a where a.owner_id=u and a.company_id=c and a.status<>'done'and a.deleted_at is null and a.purged_at is null and a.missed_at is null and not(a.id=any(coalesce(r.rejected,'{}')))order by(a.due_date<today)desc nulls last,(a.priority='high')desc,a.due_date nulls last,a.created_at,a.id limit 100)t),'[]'));
 end if;
 return result;
end $$;
revoke all on function private.myday_priority_review(text,uuid,jsonb)from public,anon,authenticated,service_role,console_backend;
grant execute on function private.myday_priority_review(text,uuid,jsonb)to authenticated;
create or replace function public.myday_priority_review(p_action text default 'get',p_task uuid default null,p_data jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.myday_priority_review(p_action,p_task,p_data)$$;
revoke all on function public.myday_priority_review(text,uuid,jsonb)from public,anon,authenticated,service_role,console_backend;
grant execute on function public.myday_priority_review(text,uuid,jsonb)to authenticated;
