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
do $$declare member uuid:=current_setting('test.manager')::uuid;company uuid;capture uuid;task uuid;request uuid:=gen_random_uuid();v jsonb;payload jsonb;begin
 select company_id into company from public.profiles where id=member;
 select id into capture from public.captures where owner_id=member and title='Private manager source';
 perform public.myday_source_service(member,'remember','{"provider":"slack","source":"123.456","container":"C_PRIVATE","text":"PRIVATE source evidence"}');
 insert into public.actions(owner_id,company_id,title,details,due_date,status,capture_id) values(member,company,'Source update fixture','PRIVATE details',current_date,'done',capture) returning id into task;
 begin perform public.myday_source_service(member,'context',jsonb_build_object('task',task));raise exception 'Disabled provider write permitted';exception when raise_exception then if sqlerrm<>'write_disabled' then raise;end if;end;
 insert into private.myday_company_options(company_id,flags) values(company,'{"write_slack":true}') on conflict(company_id) do update set flags=private.myday_company_options.flags||'{"write_slack":true}';
 v:=public.myday_source_service(member,'context',jsonb_build_object('task',task));if v->>'container'<>'C_PRIVATE' then raise exception 'Source reference lost';end if;
 begin perform public.myday_source_service(current_setting('test.employee')::uuid,'context',jsonb_build_object('task',task));raise exception 'Another user could write the source';exception when insufficient_privilege then null;end;
 perform set_config('suite.foreign_task',task::text,true);
 payload:=jsonb_build_object('task',task,'request_id',request,'body','Explicit update','operation','reply','list_id','');
 v:=public.myday_source_service(member,'claim',payload);if v->>'state'<>'new' then raise exception 'First source claim rejected';end if;
 v:=public.myday_source_service(member,'claim',payload);if v->>'state'<>'uncertain' then raise exception 'Repeated pending write could send twice';end if;
 perform public.myday_source_service(member,'finish',payload||'{"state":"sent"}');v:=public.myday_source_service(member,'claim',payload);if v->>'state'<>'sent' then raise exception 'Completed write not reused';end if;
 if(select count(*) from public.task_events where task_id=task and event like 'source_update_%')<>2 then raise exception 'Source update audit missing';end if;
end$$;
do $$declare owner uuid:=current_setting('test.employee')::uuid;company uuid;task uuid;cycle integer;alert uuid;job uuid;claimed jsonb;begin
 select company_id into company from public.profiles where id=owner;
 update private.myday_personal_options set settings=settings||'{"push":true,"quiet_start":"00:00","quiet_end":"23:59"}' where owner_id=owner;
 insert into public.actions(owner_id,company_id,title,due_date) values(owner,company,'Push reminder fixture',current_date) returning id,reminder_cycle into task,cycle;
 insert into public.task_alerts(task_id,owner_id,company_id,cycle,phase) values(task,owner,company,cycle,'due') returning id into alert;
 select j.id into job from private.myday_delivery_jobs j join private.myday_notifications n on n.id=j.notification_id where n.source_alert_id=alert;
 if job is null then raise exception 'Reminder push not queued';end if;
 update private.myday_delivery_jobs set day=current_date-1 where id=job;
 claimed:=public.myday_delivery('claim');if exists(select 1 from jsonb_array_elements(claimed) j where j->>'id'=job::text) then raise exception 'Push ignored quiet hours';end if;
 update private.myday_personal_options set settings=settings||'{"quiet_start":"00:00","quiet_end":"00:00"}' where owner_id=owner;
 claimed:=public.myday_delivery('claim');if not exists(select 1 from jsonb_array_elements(claimed) j where j->>'id'=job::text) then raise exception 'Ready push not claimed';end if;
 if public.myday_delivery('source',job)->'notice'->>'owner_id'<>owner::text then raise exception 'Push owner binding lost';end if;
 update public.actions set status='done' where id=task;
 if public.myday_delivery('source',job) is not null then raise exception 'Completed task push still deliverable';end if;
end$$;
do $$declare owner uuid:=current_setting('test.employee')::uuid;company uuid;task uuid:=gen_random_uuid();v jsonb;begin
 select company_id into company from public.profiles where id=owner;
 insert into public.actions(id,owner_id,company_id,title,details,due_date,deleted_at) values(task,owner,company,'Expired deleted task','PRIVATE deleted body',current_date,now()-interval '31 days');
 insert into private.myday_comments(id,task_id,company_id,author_id,body,private_note) values(gen_random_uuid(),task,company,owner,'PRIVATE old comment',true);
 insert into private.myday_repeats(id,owner_id,company_id,task_id,current_task,frequency,anchor,next_date,active,template) values(gen_random_uuid(),owner,company,task,task,'monthly',current_date,current_date+1,false,'{"title":"PRIVATE deleted template"}');
 perform private.myday_tick(now(),owner);
 if exists(select 1 from public.actions where id=task and (purged_at is null or details<>'' or title<>'Deleted task')) then raise exception 'Deleted body retained after retention';end if;
 if exists(select 1 from private.myday_comments where task_id=task) then raise exception 'Deleted private comment retained';end if;
 if exists(select 1 from private.myday_repeats where current_task=task and template<>'{}'::jsonb) then raise exception 'Stopped repeat retained deleted body';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin
 begin perform public.myday_suite('template_save',gen_random_uuid(),'{"title":"Malformed steps","data":{"steps":[{"body":"invalid"}]}}');raise exception 'Malformed template accepted';exception when invalid_parameter_value then null;end;
 begin perform public.myday_suite('rule_save',gen_random_uuid(),'{"title":"Malformed rule","trigger_event":"done","effects":[null]}');raise exception 'Malformed shared rule accepted';exception when invalid_parameter_value then null;end;
end$$;
reset role;
do $$declare company uuid;begin
 select company_id into company from public.profiles where id=current_setting('test.employee')::uuid;
 insert into private.myday_rules(owner_id,company_id,shared,title,trigger_event,effects) values(current_setting('test.admin')::uuid,company,true,'Company owner suggestion','capture_draft',jsonb_build_array(jsonb_build_object('kind','owner','value',current_setting('test.manager'))));
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare capture uuid:=gen_random_uuid();draft uuid:=gen_random_uuid();begin
 perform public.capture_change('create',capture,null,'{"title":"Employee rule fixture","source_text":"Private note","source_type":"note"}');
 perform public.capture_change('add',draft,capture,'{"kind":"action","title":"Employee-owned rule task"}');
 if (select payload->>'owner_id' from public.capture_items where id=draft)<>auth.uid()::text then raise exception 'Company rule suggested an owner the employee cannot assign';end if;
end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare task uuid:=gen_random_uuid();begin
 perform public.myday_action(task,'create','{"title":"Plan scope fixture"}');
 perform public.myday_suite('plan_accept',null,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',task,'reason','Due today'))));
 if not exists(select 1 from public.actions where id=task and metadata->>'plan_order'='1') then raise exception 'Accepted plan order not saved';end if;
 begin perform public.myday_suite('plan_accept',null,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',current_setting('suite.foreign_task'),'reason','Forbidden'))));raise exception 'Plan changed another owner task';exception when insufficient_privilege then null;end;
end$$;
reset role;
