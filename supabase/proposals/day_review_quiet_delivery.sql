-- Capture the working-day result at closing time, then deliver after quiet hours.
create or replace function private.myday_day_review_tick(p_now timestamptz default now(),p_owner uuid default null)returns integer language plpgsql security definer set search_path=''as $$
declare p record;d date;review private.myday_day_reviews;done_tasks uuid[];waiting_tasks uuid[];notice uuid;n int:=0;
begin
 for p in select member.id,member.company_id,member.created_at,coalesce(w.timezone,'Europe/London')zone,coalesce(o.settings,'{}')settings from public.profiles member left join public.work_preferences w on w.owner_id=member.id left join private.myday_personal_options o on o.owner_id=member.id and o.company_id=member.company_id where member.active and(p_owner is null or member.id=p_owner)and coalesce((select enabled from private.myday_daily_preferences pref where pref.owner_id=member.id and pref.company_id=member.company_id),true)loop
  d:=(p_now at time zone p.zone)::date;
  if extract(isodow from d)::int=any(coalesce((select days from private.myday_streak_settings where owner_id=p.id and company_id=p.company_id),array[1,2,3,4,5]))and not exists(select 1 from private.myday_streak_pauses where owner_id=p.id and d between starts_on and ends_on)and(p_now at time zone p.zone)::time>=coalesce((p.settings->>'work_end')::time,time '17:00')and not exists(select 1 from private.myday_day_reviews where owner_id=p.id and day=d)then
   select coalesce(array_agg(a.id)filter(where a.status='done'and(a.completed_at at time zone p.zone)::date=d),'{}'),coalesce(array_agg(a.id)filter(where a.status<>'done'and a.missed_at is null and(a.due_date<=d or a.status='in_progress'or a.metadata->>'plan_day'=d::text or exists(select 1 from private.myday_daily_choices x where x.owner_id=p.id and x.company_id=p.company_id and x.day=d and x.task_id=a.id))),'{}')into done_tasks,waiting_tasks from public.actions a where a.owner_id=p.id and a.company_id=p.company_id and a.deleted_at is null and a.purged_at is null;
   insert into private.myday_day_reviews(owner_id,company_id,day,done_ids,pending_ids,created_at)values(p.id,p.company_id,d,done_tasks,waiting_tasks,p_now)on conflict do nothing;
  end if;
  if private.myday_quiet(p.id,p_now)then continue;end if;
  select * into review from private.myday_day_reviews where owner_id=p.id and company_id=p.company_id and notification_id is null and day between d-7 and d order by day desc limit 1 for update skip locked;
  if review.owner_id is null then continue;end if;
  insert into private.myday_notifications(owner_id,company_id,title,body,created_at)values(p.id,p.company_id,'Your day in review',review.day::text||' · '||cardinality(review.done_ids)||' completed. '||cardinality(review.pending_ids)||' still waiting. Review your day and choose new dates.',p_now)returning id into notice;
  update private.myday_day_reviews set notification_id=notice where owner_id=p.id and day=review.day;n:=n+1;
 end loop;
 return n;
end $$;
