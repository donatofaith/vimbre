alter table private.task_delivery_config add column if not exists push_enabled boolean not null default false;
alter table private.myday_notifications add column if not exists source_chat_message uuid, add column if not exists push_path text;
alter table private.myday_notifications add constraint myday_push_path_safe check (push_path is null or push_path ~ '^/app/chat\\?conversation=[a-f0-9-]{36}$');
CREATE OR REPLACE FUNCTION public.myday_delivery(p_action text, p_id uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare j private.myday_delivery_jobs;p public.profiles;o private.myday_personal_options;result jsonb:='[]';v jsonb;key_id uuid;zone text;begin
 if p_action='files_cleanup' then
  return coalesce((select jsonb_agg(f.path) from (select f.path from private.myday_files f join public.actions a on a.id=f.task_id and a.owner_id=f.owner_id and a.company_id=f.company_id where a.purged_at is not null order by f.created_at limit 100)f),'[]'::jsonb);
 elsif p_action='files_cleaned' then
  delete from private.myday_files f using public.actions a where a.id=f.task_id and a.owner_id=f.owner_id and a.company_id=f.company_id and a.purged_at is not null and f.path in(select jsonb_array_elements_text(p_data->'paths'));return '{}';
 elsif p_action='vapid_init' then
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
 elsif p_action in ('claim','claim_push') then
  update private.myday_delivery_jobs set state='uncertain' where state='claimed' and claimed_at<now()-interval '5 minutes';
  update private.myday_delivery_jobs j set state='cancelled' where j.state='pending' and (p_action='claim' or j.kind='push') and not exists(select 1 from public.profiles p join private.myday_personal_options o on o.owner_id=p.id and o.company_id=p.company_id where p.id=j.owner_id and p.company_id=j.company_id and p.active and (j.kind='push' and j.created_at>now()-interval '1 day' or j.kind<>'push' and j.day=(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=p.id),'Europe/London'))::date) and (j.kind='briefing' and coalesce((o.settings->>'briefing')::boolean,false) and private.myday_enabled(p.company_id,'ai') or j.kind='digest' and coalesce((o.settings->>'digest')::boolean,false) and private.myday_enabled(p.company_id,'email') or j.kind='push' and coalesce((o.settings->>'push')::boolean,false) and private.myday_enabled(p.company_id,'push')));
  for j in select q.* from private.myday_delivery_jobs q where q.state='pending' and (p_action='claim' or q.kind='push') and not private.myday_quiet(q.owner_id,now()) order by q.created_at,q.id for update skip locked limit 5 loop
   update private.myday_delivery_jobs set state='claimed',claimed_at=now() where id=j.id;
   result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'kind',j.kind));
  end loop;return result;
 end if;
 select * into j from private.myday_delivery_jobs where id=p_id and state='claimed' for update;if not found then raise insufficient_privilege;end if;
 select * into p from public.profiles where id=j.owner_id and company_id=j.company_id and active;if not found then update private.myday_delivery_jobs set state='cancelled' where id=j.id;return null;end if;
 select * into o from private.myday_personal_options where owner_id=p.id;zone:=coalesce((select timezone from public.work_preferences where owner_id=p.id),'Europe/London');
 if p_action='source' then
  if j.kind='push' then
   if exists(select 1 from private.myday_notifications n where n.id=j.notification_id and n.source_chat_message is not null and not exists(select 1 from public.chat_messages m join public.chat_members cm on cm.conversation_id=m.conversation_id and cm.company_id=m.company_id and cm.user_id=p.id where m.id=n.source_chat_message and m.company_id=p.company_id and m.seq>cm.last_read_seq)) then return null;end if;
   if not exists(select 1 from private.myday_push where owner_id=p.id and company_id=p.company_id) then return null;end if;
   if exists(select 1 from private.myday_notifications n join public.task_alerts alert on alert.id=n.source_alert_id join public.actions a on a.id=alert.task_id where n.id=j.notification_id and (a.status='done' or a.deleted_at is not null or a.purged_at is not null or a.missed_at is not null or a.reminder_cycle<>alert.cycle or alert.read_at is not null)) then return null;end if;
   return jsonb_build_object('kind',j.kind,'owner_id',p.id,'notice',(select jsonb_build_object('id',n.id,'owner_id',p.id,'title',n.title,'body',n.body,'path',coalesce(n.push_path,case when n.source_alert_id is not null then '/app?task='||n.task_id::text||'&task_action=remind' when n.task_id is not null then '/app?comment_task='||n.task_id::text else '/app' end)) from private.myday_notifications n where n.id=j.notification_id and n.owner_id=p.id),'subscriptions',coalesce((select jsonb_agg(subscription) from private.myday_push where owner_id=p.id and company_id=p.company_id),'[]'::jsonb));
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
end$function$
;
create or replace function private.chat_device_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare n uuid;begin
 if not exists(select 1 from public.chat_messages m join public.chat_members cm on cm.conversation_id=m.conversation_id and cm.company_id=m.company_id and cm.user_id=new.recipient_id join public.profiles p on p.id=cm.user_id and p.company_id=cm.company_id and p.active where m.id=new.message_id and m.company_id=new.company_id and m.sender_id<>new.recipient_id and m.seq>cm.last_read_seq) then return new;end if;
 if not private.myday_enabled(new.company_id,'push') or not coalesce((select (settings->>'push')::boolean from private.myday_personal_options where owner_id=new.recipient_id and company_id=new.company_id),false) or not exists(select 1 from private.myday_push where owner_id=new.recipient_id and company_id=new.company_id) then return new;end if;
 insert into private.myday_notifications(owner_id,company_id,title,body,source_chat_message,push_path) values(new.recipient_id,new.company_id,'New chat message','Open Vimbre to read your message.',new.message_id,'/app/chat?conversation='||new.conversation_id::text) returning id into n;
 insert into private.myday_delivery_jobs(owner_id,company_id,kind,day,notification_id,unique_key) values(new.recipient_id,new.company_id,'push',current_date,n,'chat:'||new.message_id::text||':'||new.recipient_id::text) on conflict do nothing;
 return new;
end$$;
revoke all on function private.chat_device_notice() from public,anon,authenticated;
create trigger chat_device_notice after insert on public.chat_notifications for each row execute function private.chat_device_notice();
create or replace function public.myday_push_claim(p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role' is distinct from 'service_role' or not exists(select 1 from private.task_delivery_config where singleton and push_enabled and token_hash=p_token_hash) then raise insufficient_privilege;end if;
 return public.myday_delivery('claim_push');
end$$;
revoke all on function public.myday_push_claim(text) from public,anon,authenticated;
grant execute on function public.myday_push_claim(text) to service_role;
create or replace function private.dispatch_device_push() returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.task_delivery_config where singleton and push_enabled) and exists(select 1 from private.myday_delivery_jobs where kind='push' and state='pending') and exists(select 1 from vault.secrets where name='myday_dispatch_token') then
 perform net.http_post(url:='https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/myday-push',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myday_dispatch_token')),body:='{}'::jsonb,timeout_milliseconds:=10000);
 end if;
end$$;
revoke all on function private.dispatch_device_push() from public,anon,authenticated;
select cron.schedule('vimbre-device-push-minute','* * * * *','select private.dispatch_device_push()');

