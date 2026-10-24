-- Keep month-end anchors and skip past cycles without creating historical tasks.
create function private.anchored_work_date(p_date date,p_rule text,p_anchor date) returns date language plpgsql immutable set search_path='' as $$
declare rule text:=lower(btrim(p_rule));n integer;target date;begin
 if rule in ('every weekday','weekdays','every working day') then
  target:=p_date+1;while extract(isodow from target)>5 loop target:=target+1;end loop;return target;
 end if;
 if rule in ('monthly','every month','quarterly','every quarter','yearly','annually','every year') then
  n:=case when rule in ('quarterly','every quarter') then 3 when rule in ('yearly','annually','every year') then 12 else 1 end;
  target:=(date_trunc('month',p_date)+make_interval(months=>n))::date;
  return target+least(extract(day from coalesce(p_anchor,p_date))::integer,extract(day from target+interval '1 month -1 day')::integer)-1;
 end if;
 return private.next_work_date(p_date,p_rule);
end $$;
revoke all on function private.anchored_work_date(date,text,date) from public,anon,authenticated,service_role;
-- Public helper validates supported cadence without exposing another user's records.
create function public.myday_valid_recurrence(p_date date,p_rule text) returns boolean language sql immutable security invoker set search_path='' as $$
select p_date is not null and (lower(btrim(p_rule)) in ('daily','every day','weekly','every week','monthly','every month','quarterly','every quarter','yearly','annually','every year','every weekday','weekdays','every working day') or lower(btrim(p_rule)) ~ '^every [1-9][0-9]? (days?|weeks?)$' or lower(btrim(p_rule)) ~ '^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$' or lower(btrim(p_rule)) ~ '^(first|second|third|fourth|last) (monday|tuesday|wednesday|thursday|friday|saturday|sunday) (of )?(each|every|the) month$');
$$;
revoke all on function public.myday_valid_recurrence(date,text) from public,anon,authenticated;grant execute on function public.myday_valid_recurrence(date,text) to authenticated;
create or replace function private.process_myday(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare r record;a public.actions; alert uuid; processed integer:=0;next_date date;anchor date;local_today date;steps integer;
begin
 -- Skip overlapping minute jobs. Each create also has a unique cycle key.
 if not pg_try_advisory_xact_lock(627451903) then return 0;end if;
 for r in select ri.*,coalesce(w.timezone,'Europe/London') as tz from public.role_items ri
 join public.profiles p on p.id=ri.owner_id and p.company_id=ri.company_id and p.active
 left join public.work_preferences w on w.owner_id=p.id
 where ri.kind='recurring_deadline' and ri.deleted_at is null and ri.due_date<=(p_now at time zone coalesce(w.timezone,'Europe/London'))::date
 order by ri.id for update of ri skip locked limit 2000 loop
  local_today:=(p_now at time zone r.tz)::date;
  select coalesce(min(recurring_date),r.due_date) into anchor from public.actions where recurring_id=r.id;
  steps:=0;
  while r.due_date<local_today and steps<500 loop
   next_date:=private.anchored_work_date(r.due_date,r.recurrence,anchor);
   exit when next_date is null or next_date<=r.due_date;
   r.due_date:=next_date;steps:=steps+1;
  end loop;
  if r.due_date<>local_today then
   if steps>0 then update public.role_items set due_date=r.due_date where id=r.id;end if;
   continue;
  end if;
  insert into public.actions(owner_id,company_id,title,details,due_date,due_time,source_kind,recurring_id,recurring_date)
  values(r.owner_id,r.company_id,r.title,r.details,r.due_date,time '09:00','recurring_deadline',r.id,r.due_date) on conflict do nothing;
  next_date:=private.anchored_work_date(r.due_date,r.recurrence,anchor);
  if next_date is not null then update public.role_items set due_date=next_date where id=r.id;end if;
 end loop;
 for a in select act.* from public.actions act join public.profiles p on p.id=act.owner_id and p.company_id=act.company_id and p.active
 where act.deleted_at is null and act.status<>'done' and act.remind_at<=p_now
 and (act.reminder_sent_at is null or act.check_in_sent_at is null and greatest(act.due_at,act.remind_at)+interval '1 hour'<=p_now)
 order by act.remind_at,act.id for update of act skip locked limit 2000 loop
  alert:=null;
  if a.reminder_sent_at is null then
   insert into public.task_alerts(task_id,owner_id,company_id,cycle,phase) values(a.id,a.owner_id,a.company_id,a.reminder_cycle,'due') on conflict do nothing returning id into alert;
   update public.actions set reminder_sent_at=p_now where id=a.id;
  elsif greatest(a.due_at,a.remind_at)+interval '1 hour'<=p_now and a.check_in_sent_at is null then
   insert into public.task_alerts(task_id,owner_id,company_id,cycle,phase) values(a.id,a.owner_id,a.company_id,a.reminder_cycle,'check_in') on conflict do nothing returning id into alert;
   update public.actions set check_in_sent_at=p_now,overdue=true where id=a.id;
  end if;
  if alert is not null then
   if exists(select 1 from private.task_delivery_config where enabled) and coalesce((select email_enabled from public.work_preferences where owner_id=a.owner_id),true) then insert into private.task_mail_queue(alert_id,owner_id) values(alert,a.owner_id) on conflict do nothing;end if;
   processed:=processed+1;
  end if;
 end loop;
 -- A completed, archived, rescheduled or deactivated task must not send a stale queued email.
 update private.task_mail_queue q set state='cancelled' from public.task_alerts n,public.actions stale,public.profiles p
 where q.alert_id=n.id and n.task_id=stale.id and p.id=stale.owner_id and q.state='pending'
 and (stale.status='done' or stale.deleted_at is not null or stale.reminder_cycle<>n.cycle or not p.active or not coalesce((select email_enabled from public.work_preferences where owner_id=stale.owner_id),true));
 return processed;
end $$;
revoke all on function private.process_myday(timestamptz) from public,anon,authenticated,service_role;


update private.task_mail_queue set state='cancelled' where state='pending' and not exists(select 1 from private.task_delivery_config where enabled);
