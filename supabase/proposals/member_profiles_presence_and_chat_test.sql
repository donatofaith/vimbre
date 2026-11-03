-- Fixtures are discarded; never persist test users in production.
BEGIN;
-- Run inside one rollback-only transaction after the proposal, or against the installed migration.
do $$declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();c uuid;room uuid;other_room uuid;j jsonb;roleid uuid;begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values(a,'people-admin@example.invalid',now(),'{"full_name":"Admin original","company_name":"People test"}'),(b,'people-b@example.invalid',now(),'{"full_name":"B original","company_name":"Temporary B"}'),(employee,'people-employee@example.invalid',now(),'{"full_name":"Employee original","company_name":"Temporary Employee"}'),(outsider,'people-outsider@example.invalid',now(),'{"full_name":"Outsider","company_name":"Other tenant"}');
 select company_id into c from public.profiles where id=a;update public.profiles set company_id=c,role='employee'where id in(b,employee);
 perform set_config('request.jwt.claim.sub',a::text,true);j:=private.member_profile('{"display_name":"Alex","job_title":"Product lead","availability":"active"}');if j->>'full_name'<>'Alex'or(select full_name from public.profiles where id=a)<>'Admin original'then raise exception 'Display name overwrote administrative identity';end if;
 begin perform private.member_profile('{"role":"hr_admin"}');raise exception 'Forged profile role allowed';exception when invalid_parameter_value then null;end;
 begin perform private.member_profile('{"avatar_path":"other/user/photo.webp"}');raise exception 'Unowned photo allowed';exception when check_violation then null;end;
 j:=private.member_heartbeat(true);if j->>'presence'<>'active'then raise exception 'Active status missing: %',j;end if;
 update private.member_presence set seen_at=now()-interval '45 seconds',meter_at=now()-interval '45 seconds',meter_active=true where user_id=a;j:=private.member_heartbeat(true);
 if(select seconds from private.member_active_days where user_id=a and day=(now()at time zone 'Europe/London')::date)<>45 then raise exception 'Foreground time not metered';end if;
 j:=private.member_heartbeat(true);if(select seconds from private.member_active_days where user_id=a and day=(now()at time zone 'Europe/London')::date)<>45 then raise exception 'Duplicate tab heartbeat double-counted';end if;
 perform private.member_profile('{"availability":"away"}');if private.member_public(a)->>'presence'<>'away'then raise exception 'Away override failed';end if;
 perform private.member_profile('{"availability":"offline"}');j:=private.member_public(a);if j->>'presence'<>'offline'or j->>'last_active'is not null then raise exception 'Offline visibility failed';end if;
 room:=private.chat_group_create('Launch team',array[b,employee]);perform private.chat_rename(room,'Launch operations');j:=private.chat_detail(room,null,null);if j->>'title'<>'Launch operations'or not j::text like '%Product lead%'or not j::text like '%Alex%'then raise exception 'Chat profile or title missing: %',j;end if;
 insert into public.actions(company_id,owner_id,title,details,status)values(c,b,'Prepare launch','NEVER SHARE TASK DETAILS','in_progress');
 j:=private.team_activity_overview('',0,'Europe/London',b);if not j::text like '%Prepare launch%'or j::text like '%NEVER SHARE TASK DETAILS%'then raise exception 'Work projection privacy failed: %',j;end if;
 perform set_config('test.people_admin',a::text,true);perform set_config('test.people_group',room::text,true);
 perform set_config('request.jwt.claim.sub',employee::text,true);begin perform private.team_activity_overview('',0,'UTC',null);raise exception 'Employee activity access allowed';exception when insufficient_privilege then null;end;perform private.chat_rename(room,'Member named chat');
 perform set_config('request.jwt.claim.sub',outsider::text,true);if private.member_public(a)is not null then raise exception 'Cross tenant profile leak';end if;begin perform private.chat_rename(room,'Cross tenant rename');raise exception 'Cross tenant rename allowed';exception when insufficient_privilege then null;end;
 begin perform private.chat_group_create('Forged group',array[a]);raise exception 'Cross tenant group allowed';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.people_admin'),true);
do $$begin if public.member_profile()->>'full_name'<>'Alex'then raise exception 'Profile wrapper failed';end if;perform public.member_heartbeat();perform public.chat_rename(current_setting('test.people_group')::uuid,'Wrapper name');end$$;
set local role anon;
do $$begin begin perform public.member_profile();raise exception 'Anonymous profile allowed';exception when insufficient_privilege then null;end;begin perform public.member_heartbeat();raise exception 'Anonymous heartbeat allowed';exception when insufficient_privilege then null;end;end$$;
reset role;
select 'Profiles, group names, presence, time caps and privacy passed' as result;

ROLLBACK;
