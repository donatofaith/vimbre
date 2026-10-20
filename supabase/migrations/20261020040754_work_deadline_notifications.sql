-- Responsibilities can carry a date; arbitrary recurrence text is never interpreted as a schedule.
alter table public.role_items drop constraint role_items_check3;
alter table public.role_items add constraint role_items_deadline_kind_check check (
 (kind='recurring_deadline') or (kind='responsibility' and recurrence is null) or (due_date is null and recurrence is null)
);
create index role_items_owner_due_idx on public.role_items(owner_id,due_date,id) where deleted_at is null and due_date is not null;
create index actions_owner_due_pending_idx on public.actions(owner_id,due_date,id) where deleted_at is null and status<>'done';
create table public.work_notification_reads (
 user_id uuid not null references public.profiles(id) on delete cascade,
 notification_key text not null check(char_length(notification_key) between 1 and 200),
 read_at timestamptz not null default now(), primary key(user_id,notification_key)
);
alter table public.work_notification_reads enable row level security;
revoke all on public.work_notification_reads from anon,authenticated;
grant select on public.work_notification_reads to authenticated;
create policy work_notification_read_own on public.work_notification_reads for select to authenticated
using(user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));

create function private.work_reminder_rows(p_timezone text)
returns table(notification_key text,source_kind text,source_id uuid,title text,due_date date,stage text,section text)
language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles; today date;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Notifications are not available'; end if;
 if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 today:=(now() at time zone p_timezone)::date;
 return query with candidates as (
  select 'task'::text as kind,a.id,a.title,a.due_date,null::text as section from public.actions a
  where a.owner_id=viewer.id and a.company_id=viewer.company_id and a.status<>'done' and a.deleted_at is null and a.due_date<=today+3
  union all
  select 'role_item'::text,r.id,r.title,r.due_date,r.kind from public.role_items r
  where r.owner_id=viewer.id and r.company_id=viewer.company_id and r.kind in ('responsibility','recurring_deadline') and r.deleted_at is null and r.due_date<=today+3
 ), classified as (
  select c.*,case when c.due_date<today then 'overdue' when c.due_date=today then 'today' else 'approaching' end as phase from candidates c
 ) select c.kind||':'||c.id::text||':'||c.due_date::text||':'||c.phase,c.kind,c.id,c.title,c.due_date,c.phase,c.section from classified c;
end $$;
revoke all on function private.work_reminder_rows(text) from public,anon,authenticated;
-- Only checked notification entry points invoke this internal helper.
create function private.work_notification_inbox(p_timezone text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid notification page' using errcode='22023'; end if;
 with reminders as materialized (
  select c.*,r.read_at from private.work_reminder_rows(p_timezone) c left join public.work_notification_reads r
   on r.user_id=auth.uid() and r.notification_key=c.notification_key
 ), paged as (
  select * from reminders order by case stage when 'overdue' then 0 when 'today' then 1 else 2 end,due_date,notification_key limit 50 offset p_page*50
 ) select jsonb_build_object('unread',(select count(*) from reminders where read_at is null),'count',(select count(*) from reminders),
 'items',coalesce((select jsonb_agg(to_jsonb(paged) order by case stage when 'overdue' then 0 when 'today' then 1 else 2 end,due_date,notification_key) from paged),'[]'::jsonb)) into result;
 return result;
end $$;
create function private.work_notification_read(p_key text,p_timezone text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_key is null or char_length(p_key)>200 then raise exception 'Invalid notification' using errcode='22023'; end if;
 -- Do not accept another person's ID, date or reminder stage from the client.
 if not exists(select 1 from private.work_reminder_rows(p_timezone) r where r.notification_key=p_key) then return false; end if;
 insert into public.work_notification_reads(user_id,notification_key) values(auth.uid(),p_key) on conflict do nothing;
 return true;
end $$;
create function public.work_notification_inbox(p_timezone text default 'UTC',p_page integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select private.work_notification_inbox(p_timezone,p_page)$$;
create function public.work_notification_read(p_key text,p_timezone text default 'UTC') returns boolean language sql security invoker set search_path='' as $$select private.work_notification_read(p_key,p_timezone)$$;
revoke all on function private.work_notification_inbox(text,integer),private.work_notification_read(text,text),public.work_notification_inbox(text,integer),public.work_notification_read(text,text) from public,anon,authenticated;
grant execute on function private.work_notification_inbox(text,integer),private.work_notification_read(text,text),public.work_notification_inbox(text,integer),public.work_notification_read(text,text) to authenticated;
