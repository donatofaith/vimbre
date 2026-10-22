create or replace function private.process_myday(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare r record;a public.actions; alert uuid; processed integer:=0;next_date date;
begin
 -- Skip overlapping minute jobs. Each create also has a unique cycle key.
 if not pg_try_advisory_xact_lock(627451903) then return 0;end if;
 for r in select ri.*,coalesce(w.timezone,'Europe/London') as tz from public.role_items ri
 join public.profiles p on p.id=ri.owner_id and p.company_id=ri.company_id and p.active
 left join public.work_preferences w on w.owner_id=p.id
 where ri.kind='recurring_deadline' and ri.deleted_at is null and ri.due_date=(p_now at time zone coalesce(w.timezone,'Europe/London'))::date
 order by ri.id for update of ri skip locked limit 2000 loop
  insert into public.actions(owner_id,company_id,title,details,due_date,due_time,source_kind,recurring_id,recurring_date)
  values(r.owner_id,r.company_id,r.title,r.details,r.due_date,time '09:00','recurring_deadline',r.id,r.due_date) on conflict do nothing;
  next_date:=private.next_work_date(r.due_date,r.recurrence);
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
   if coalesce((select email_enabled from public.work_preferences where owner_id=a.owner_id),true) then insert into private.task_mail_queue(alert_id,owner_id) values(alert,a.owner_id) on conflict do nothing;end if;
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

