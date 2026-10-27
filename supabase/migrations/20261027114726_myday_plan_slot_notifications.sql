create table private.myday_plan_notices(owner_id uuid not null references public.profiles(id) on delete cascade,day date not null,task_id uuid not null references public.actions(id) on delete cascade,event text not null,primary key(owner_id,day,task_id,event));
alter table private.myday_plan_notices enable row level security;
revoke all on private.myday_plan_notices from public,anon,authenticated,service_role;
create function private.process_myday_plan_notices(p_now timestamptz default now(),p_owner uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare count integer;row record;kind text;begin
 count:=0;
 for row in select p.owner_id,p.company_id,p.day,item,a.title,a.decision_id,a.completion_note from private.myday_plans p join public.profiles holder on holder.id=p.owner_id and holder.active and holder.company_id=p.company_id cross join lateral jsonb_array_elements(p.items)item join public.actions a on a.id=(item->>'id')::uuid and a.owner_id=p.owner_id and a.company_id=p.company_id and a.status<>'done' and a.deleted_at is null and a.purged_at is null where (p_owner is null or p.owner_id=p_owner) and (item->>'start')::timestamptz between p_now-interval '15 minutes' and p_now+interval '10 minutes' loop
  kind:=case when (row.item->>'start')::timestamptz<=p_now then 'start' when row.decision_id is not null and btrim(coalesce(row.completion_note,''))='' then 'reason' else null end;
  if kind is null then continue;end if;
  insert into private.myday_plan_notices values(row.owner_id,row.day,(row.item->>'id')::uuid,kind) on conflict do nothing;
  if found then
   insert into private.myday_notifications(owner_id,company_id,task_id,title,body) values(row.owner_id,row.company_id,(row.item->>'id')::uuid,case when kind='start' then 'Next: '||row.title else 'Add your reason: '||row.title end,case when kind='start' then 'Your planned task is ready to start.' else 'Why did you decide this? Add one line to the task before its planned start.' end);
   count:=count+1;
  end if;
 end loop;
 return count;
end$$;
revoke all on function private.process_myday_plan_notices(timestamptz,uuid) from public,anon,authenticated,service_role;
alter function private.process_myday(timestamptz) rename to process_myday_before_plan;
revoke all on function private.process_myday_before_plan(timestamptz) from public,anon,authenticated,service_role;
create function private.process_myday(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$begin return private.process_myday_before_plan(p_now)+private.process_myday_plan_notices(p_now);end$$;
revoke all on function private.process_myday(timestamptz) from public,anon,authenticated,service_role;

