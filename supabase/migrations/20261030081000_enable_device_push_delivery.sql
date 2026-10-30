create or replace function private.dispatch_device_push() returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.task_delivery_config where singleton and push_enabled) and exists(select 1 from private.myday_delivery_jobs where kind='push' and state='pending' and (created_at<now()-interval '1 day' or not private.myday_quiet(owner_id,now()))) and exists(select 1 from vault.secrets where name='myday_dispatch_token') then
 perform net.http_post(url:='https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/myday-push',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myday_dispatch_token')),body:='{}'::jsonb,timeout_milliseconds:=10000);
 end if;
end$$;
revoke all on function private.dispatch_device_push() from public,anon,authenticated;
update private.task_delivery_config set push_enabled=true where singleton;
