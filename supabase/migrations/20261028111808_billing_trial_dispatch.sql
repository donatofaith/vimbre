-- Independent of task delivery's disabled preference; billing mail is transactional.
create function private.billing_trial_authorize(p_hash text) returns boolean language sql stable security definer set search_path='' as $$
 select p_hash~'^[a-f0-9]{64}$' and exists(select 1 from vault.decrypted_secrets where name='myday_dispatch_token' and encode(extensions.digest(decrypted_secret,'sha256'),'hex')=p_hash)
$$;
create function public.billing_trial_authorize(p_hash text) returns boolean language sql security invoker set search_path='' as $$select private.billing_trial_authorize(p_hash)$$;
revoke all on function private.billing_trial_authorize(text),public.billing_trial_authorize(text) from public,anon,authenticated;
grant execute on function private.billing_trial_authorize(text),public.billing_trial_authorize(text) to service_role;
create function private.dispatch_billing_trial_mail(p_force boolean default false) returns bigint language plpgsql security definer set search_path='' as $$declare request_id bigint;begin
 if exists(select 1 from vault.secrets where name='myday_dispatch_token') and (p_force or exists(
 select 1 from private.billing_live_accounts a where a.status='trialing' and a.trial_ends_at>now() and not a.cancel_at_period_end and (
 not exists(select 1 from private.billing_trial_mail m where m.subscription_id=a.subscription_id and m.trial_ends_at=a.trial_ends_at and m.kind='started')
 or a.trial_ends_at<=now()+interval '24 hours' and not exists(select 1 from private.billing_trial_mail m where m.subscription_id=a.subscription_id and m.trial_ends_at=a.trial_ends_at and m.kind='ending')
 or exists(select 1 from private.billing_trial_mail m where m.subscription_id=a.subscription_id and m.state in('queued','failed') and m.attempts<3 and m.due_at<=now())
 ))) then
 select net.http_post(url:='https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/billing-mail',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myday_dispatch_token')),body:='{}'::jsonb,timeout_milliseconds:=10000) into request_id;
 end if;return request_id;
end$$;
revoke all on function private.dispatch_billing_trial_mail(boolean) from public,anon,authenticated,service_role;
select cron.schedule('vimbre-billing-trial-reminders','* * * * *','select private.dispatch_billing_trial_mail();');
