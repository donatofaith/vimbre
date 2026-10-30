alter table private.myday_notifications drop constraint myday_push_path_safe;
alter table private.myday_notifications add constraint myday_push_path_safe check(push_path is null or push_path ~ '^/app/chat[?]conversation=[a-f0-9-]{36}$');
create or replace function private.dispatch_support_reply_mail() returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.console_mail_queue where status='pending') and exists(select 1 from vault.secrets where name='myday_dispatch_token') then
 perform net.http_post(url:='https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/console-support-mail',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myday_dispatch_token')),body:='{}'::jsonb,timeout_milliseconds:=10000);
 end if;
end$$;
revoke all on function private.dispatch_support_reply_mail() from public,anon,authenticated;
select cron.schedule('vimbre-support-reply-mail-minute','* * * * *','select private.dispatch_support_reply_mail()');
