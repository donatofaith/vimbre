-- Run after team fixtures and suite tests in the same rollback-only transaction.
reset role;
do $$begin
 if has_function_privilege('authenticated','public.myday_delivery(text,uuid,jsonb)','execute') or has_function_privilege('anon','public.myday_delivery(text,uuid,jsonb)','execute') or has_function_privilege('authenticated','public.myday_source_service(uuid,text,jsonb)','execute') then raise exception 'Privileged service endpoint exposed';end if;
 if has_table_privilege('authenticated','private.myday_push','select') or has_table_privilege('anon','private.myday_source_references','select') then raise exception 'Private service table exposed';end if;
 if private.myday_next_date('2026-01-31','monthly',1,'month','2026-01-31')<>'2026-02-28'::date then raise exception 'Month end drift';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare token text;v jsonb;begin
 v:=public.myday_suite('calendar');token:=v->>'token';perform set_config('suite.calendar_token',token,true);
 begin perform public.myday_suite('push_register',null,'{"endpoint":"https://attacker.invalid/push","keys":{"auth":"a","p256dh":"b"}}');raise exception 'Arbitrary push endpoint accepted';exception when invalid_parameter_value then null;end;
end$$;
set local role anon;
do $$declare v jsonb;begin
 v:=public.myday_calendar_feed(current_setting('suite.calendar_token'));if jsonb_typeof(v->'tasks')<>'array' then raise exception 'Valid calendar rejected';end if;
 if v::text like '%PRIVATE owner details%' then raise exception 'Calendar leaked details';end if;
 if public.myday_calendar_feed('wrong') is not null then raise exception 'Invalid calendar token accepted';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select public.myday_suite('calendar',null,'{"revoke":true}');
set local role anon;
do $$begin if public.myday_calendar_feed(current_setting('suite.calendar_token')) is not null then raise exception 'Revoked calendar readable';end if;end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare capture uuid:=gen_random_uuid();draft uuid:=gen_random_uuid();assignment uuid;v jsonb;begin
 perform public.capture_change('create',capture,null,'{"title":"Private manager source","source_text":"PRIVATE source evidence","source_type":"note"}');
 perform public.capture_change('add',draft,capture,jsonb_build_object('kind','action','title','Recipient reviews this task','details','Explicit shared instructions','owner_id',current_setting('test.employee')));
 perform public.capture_change('confirm',draft,capture,'{"version":1}');
 select assignment_id into assignment from public.capture_items where id=draft;
 if assignment is null then raise exception 'Capture bypassed assignment review';end if;
 if exists(select 1 from public.actions where title='Recipient reviews this task') then raise exception 'Capture created an unaccepted task';end if;
 perform public.capture_change('confirm',draft,capture,'{"version":1}');
end$$;
reset role;
