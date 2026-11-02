-- Expire operational counters and already-expired capabilities; support messages remain intact.
create index website_support_limits_bucket_idx on private.website_support_limits(bucket);
create index website_support_sessions_expiry_idx on private.website_support_sessions(expires_at);
create function private.website_support_cleanup()returns void language plpgsql security definer set search_path=''as $$
begin
 delete from private.website_support_limits where bucket<now()-interval '48 hours';
 delete from private.website_support_sessions where expires_at<now()-interval '7 days';
end $$;
revoke all on function private.website_support_cleanup()from public,anon,authenticated,service_role,console_backend;
select cron.schedule('vimbre-website-support-retention','15 2 * * *','select private.website_support_cleanup()');
