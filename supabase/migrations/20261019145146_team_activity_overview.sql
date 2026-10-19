-- Counts only: private sources and draft payloads remain owner-readable only.
create function private.company_active_member_count() returns integer
language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found or viewer.role not in ('hr_admin','manager') then
  raise insufficient_privilege using message='Team activity is not available';
 end if;
 return (select count(*)::integer from public.profiles where company_id=viewer.company_id and active);
end; $$;
revoke all on function private.company_active_member_count() from public,anon,authenticated;
grant execute on function private.company_active_member_count() to authenticated;
create function public.company_active_member_count() returns integer language sql stable security invoker set search_path='' as $$
 select private.company_active_member_count()
$$;
revoke all on function public.company_active_member_count() from public,anon,authenticated;
grant execute on function public.company_active_member_count() to authenticated;

create function private.team_activity_overview(p_search text,p_page integer,p_timezone text,p_member uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles; work_today date; week_start date; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found or viewer.role not in ('hr_admin','manager') then
  raise insufficient_privilege using message='Team activity is not available';
 end if;
 if p_page is null or p_page<0 or p_page>100000 or p_search is null or char_length(p_search)>100 or
    p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
  raise exception 'Invalid overview request' using errcode='22023';
 end if;
 if p_member is not null and not exists(select 1 from public.profiles p where p.id=p_member and p.active
   and p.company_id=viewer.company_id and (viewer.role='hr_admin' or (viewer.department_id is not null and p.department_id=viewer.department_id))) then
  raise insufficient_privilege using message='Team member is not available';
 end if;
 work_today:=(now() at time zone p_timezone)::date;
 week_start:=date_trunc('week',now() at time zone p_timezone)::date;
 with members as materialized (
  select id,full_name from public.profiles p where p.company_id=viewer.company_id and p.active
  and (viewer.role='hr_admin' or (viewer.department_id is not null and p.department_id=viewer.department_id))
 ), task_counts as (
  select a.owner_id,
   count(*) filter(where a.status='done' and a.completed_at>=week_start::timestamp at time zone p_timezone and a.completed_at<=now())::integer as tasks_done,
   count(*) filter(where a.status<>'done' and a.due_date<work_today)::integer as tasks_overdue
  from public.actions a join members m on m.id=a.owner_id where a.company_id=viewer.company_id and a.deleted_at is null group by a.owner_id
 ), draft_counts as (
  select i.owner_id,count(*)::integer as drafts_waiting from public.capture_items i join members m on m.id=i.owner_id
  join public.captures c on c.id=i.capture_id and c.owner_id=i.owner_id and c.company_id=i.company_id
  where i.company_id=viewer.company_id and i.status='pending' and c.deleted_at is null group by i.owner_id
 ), metrics as materialized (
  select m.id,m.full_name,coalesce(t.tasks_done,0) as tasks_done,coalesce(t.tasks_overdue,0) as tasks_overdue,
   coalesce(d.drafts_waiting,0) as drafts_waiting,null::text as handover_status,
   not exists(select 1 from public.role_items r where r.company_id=viewer.company_id and r.owner_id=m.id and r.deleted_at is null)
   and not exists(select 1 from public.decisions r where r.company_id=viewer.company_id and r.owner_id=m.id and r.deleted_at is null) as no_role_record
  from members m left join task_counts t on t.owner_id=m.id left join draft_counts d on d.owner_id=m.id
 ), filtered as materialized (
  select * from metrics where (p_member is null or id=p_member) and strpos(lower(full_name),lower(btrim(p_search)))>0
 ), paged as (
  select * from filtered order by full_name,id limit 20 offset p_page*20
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(paged) order by full_name,id) from paged),'[]'::jsonb),
  'count',(select count(*) from filtered),
  'total_active_count',private.company_active_member_count(),
  'scope',case when viewer.role='hr_admin' then 'company' else 'department' end,
  'today',work_today,'week_start',week_start,
  'flags',jsonb_build_object('overdue_tasks',coalesce((select sum(tasks_overdue) from metrics),0),
    'handovers_not_started',null,'people_without_role_record',(select count(*) from metrics where no_role_record)),
  'handovers_available',false
 ) into result;
 return result;
end; $$;
revoke all on function private.team_activity_overview(text,integer,text,uuid) from public,anon,authenticated;
grant execute on function private.team_activity_overview(text,integer,text,uuid) to authenticated;
create function public.team_activity_overview(p_search text default '',p_page integer default 0,p_timezone text default 'UTC',p_member uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.team_activity_overview(p_search,p_page,p_timezone,p_member)
$$;
revoke all on function public.team_activity_overview(text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.team_activity_overview(text,integer,text,uuid) to authenticated;
