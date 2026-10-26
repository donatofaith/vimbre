-- Narrow service operations for delivery, provider updates and revocable calendar capabilities.
create table private.myday_vapid(singleton boolean primary key default true check(singleton),public_key text not null,secret_id uuid not null);
alter table private.myday_vapid enable row level security;
revoke all on private.myday_vapid from public,anon,authenticated,service_role;
alter table private.myday_delivery_jobs add column ready_at timestamptz;
create function private.myday_calendar_feed(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member public.profiles;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then return null;end if;
 select p.* into member from private.myday_personal_options o join public.profiles p on p.id=o.owner_id and p.company_id=o.company_id and p.active where o.calendar_hash=encode(extensions.digest(p_token,'sha256'),'hex') and o.calendar_enabled;
 if not found or not private.myday_enabled(member.company_id,'calendar') then return null;end if;
 return jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(q)) from(select id,title,due_date,due_time,due_at,time_needed_minutes,updated_at from public.actions where owner_id=member.id and company_id=member.company_id and deleted_at is null and purged_at is null and missed_at is null and status<>'done' order by due_at nulls last,id limit 2000)q),'[]'::jsonb));
end$$;
revoke all on function private.myday_calendar_feed(text) from public,anon,authenticated,service_role;
grant execute on function private.myday_calendar_feed(text) to anon,authenticated;
create function public.myday_calendar_feed(p_token text) returns jsonb language sql stable security invoker set search_path='' as $$select private.myday_calendar_feed(p_token)$$;
revoke all on function public.myday_calendar_feed(text) from public,anon,authenticated,service_role;
grant execute on function public.myday_calendar_feed(text) to anon,authenticated;
create function public.myday_delivery(p_action text,p_id uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare j private.myday_delivery_jobs;p public.profiles;o private.myday_personal_options;result jsonb:='[]';v jsonb;key_id uuid;zone text;begin
 if p_action='vapid_init' then
  perform pg_advisory_xact_lock(727454132);
  if not exists(select 1 from private.myday_vapid) then
   if length(p_data->>'public_key') not between 80 and 100 or p_data->'private_jwk'->>'kty'<>'EC' or p_data->'private_jwk'->>'crv'<>'P-256' then raise invalid_parameter_value;end if;
   key_id:=vault.create_secret((p_data->'private_jwk')::text,'vimbre_task_push_key');insert into private.myday_vapid(public_key,secret_id) values(p_data->>'public_key',key_id);
  end if;return (select jsonb_build_object('public_key',public_key) from private.myday_vapid);
 elsif p_action='vapid_public' then
  select * into p from public.profiles where id=(p_data->>'user')::uuid and active;
  if not found or not private.myday_enabled(p.company_id,'push') then raise insufficient_privilege;end if;
  return(select jsonb_build_object('public_key',public_key) from private.myday_vapid);
 elsif p_action='vapid_private' then
  return(select jsonb_build_object('public_key',v.public_key,'private_jwk',d.decrypted_secret::jsonb) from private.myday_vapid v join vault.decrypted_secrets d on d.id=v.secret_id);
 elsif p_action='claim' then
  update private.myday_delivery_jobs set state='uncertain' where state='claimed' and claimed_at<now()-interval '5 minutes';
  update private.myday_delivery_jobs j set state='cancelled' where j.state='pending' and not exists(select 1 from public.profiles p join private.myday_personal_options o on o.owner_id=p.id and o.company_id=p.company_id where p.id=j.owner_id and p.company_id=j.company_id and p.active and j.day=(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=p.id),'Europe/London'))::date and (j.kind='briefing' and coalesce((o.settings->>'briefing')::boolean,false) and private.myday_enabled(p.company_id,'ai') or j.kind='digest' and coalesce((o.settings->>'digest')::boolean,false) and private.myday_enabled(p.company_id,'email') or j.kind='push' and coalesce((o.settings->>'push')::boolean,false) and private.myday_enabled(p.company_id,'push')));
  for j in select q.* from private.myday_delivery_jobs q where q.state='pending' and not private.myday_quiet(q.owner_id,now()) order by q.created_at,q.id for update skip locked limit 20 loop
   update private.myday_delivery_jobs set state='claimed',claimed_at=now() where id=j.id;
   result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'kind',j.kind));
  end loop;return result;
 end if;
 select * into j from private.myday_delivery_jobs where id=p_id and state='claimed' for update;if not found then raise insufficient_privilege;end if;
 select * into p from public.profiles where id=j.owner_id and company_id=j.company_id and active;if not found then update private.myday_delivery_jobs set state='cancelled' where id=j.id;return null;end if;
 select * into o from private.myday_personal_options where owner_id=p.id;zone:=coalesce((select timezone from public.work_preferences where owner_id=p.id),'Europe/London');
 if p_action='source' then
  if j.kind='push' then
   return jsonb_build_object('kind',j.kind,'owner_id',p.id,'notice',(select jsonb_build_object('id',n.id,'owner_id',p.id,'title',n.title,'body',n.body,'path',case when n.task_id is not null then '/app?comment_task='||n.task_id::text else '/app' end) from private.myday_notifications n where n.id=j.notification_id and n.owner_id=p.id),'subscriptions',coalesce((select jsonb_agg(subscription) from private.myday_push where owner_id=p.id and company_id=p.company_id),'[]'::jsonb));
  end if;
  v:=jsonb_build_object('today',j.day,'timezone',zone,'working_hours',o.settings,'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',left(title,160),'status',status,'due_date',due_date,'due_time',due_time,'starred',pinned_at is not null,'time_needed_minutes',time_needed_minutes)) from(select * from public.actions where owner_id=p.id and company_id=p.company_id and deleted_at is null and purged_at is null and missed_at is null and (status<>'done' or (completed_at at time zone zone)::date=j.day) order by (pinned_at is not null) desc,due_at nulls last,created_at,id limit 40)q),'[]'::jsonb));
  return jsonb_build_object('kind',j.kind,'day',j.day,'owner_id',p.id,'company_id',p.company_id,'email',p.email,'name',p.full_name,'email_enabled',private.myday_enabled(p.company_id,'email') and coalesce((select email_enabled from public.work_preferences where owner_id=p.id),true),'source',v,'cached',(select output from private.myday_ai_cache where owner_id=p.id and kind='day_briefing' and fingerprint=encode(extensions.digest(v::text,'sha256'),'hex')),'fingerprint',encode(extensions.digest(v::text,'sha256'),'hex'));
 elsif p_action='briefing_ready' then
  if j.kind<>'briefing' or not private.myday_enabled(p.company_id,'ai') or length(p_data->>'output')>16000 then raise invalid_parameter_value;end if;
  insert into private.myday_ai_cache(owner_id,kind,fingerprint,output) values(p.id,'day_briefing',p_data->>'fingerprint',p_data->>'output') on conflict(owner_id,kind,fingerprint) do nothing;
  if j.ready_at is null then perform private.myday_notify(p.id,p.company_id,null,null,'Daily briefing',p_data->>'output');update private.myday_delivery_jobs set ready_at=now() where id=j.id;end if;return '{}'::jsonb;
 elsif p_action='push_remove' then
  delete from private.myday_push where owner_id=p.id and company_id=p.company_id and endpoint=p_data->>'endpoint';return '{}'::jsonb;
 elsif p_action='finish' then
  if p_data->>'state' not in('sent','failed','uncertain','cancelled') then raise invalid_parameter_value;end if;
  update private.myday_delivery_jobs set state=p_data->>'state' where id=j.id;return '{}'::jsonb;
 end if;raise invalid_parameter_value;
end$$;
revoke all on function public.myday_delivery(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.myday_delivery(text,uuid,jsonb) to service_role;
