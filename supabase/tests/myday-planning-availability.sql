-- Include this setup inside each rollback-only test transaction.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); c uuid; d uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (a,'team-admin-a@example.invalid',now(),'{"company_name":"Team A","full_name":"Admin A"}'),
 (b,'team-admin-b@example.invalid',now(),'{"company_name":"Team B","full_name":"Admin B"}'),
 (m,'team-manager@example.invalid',now(),'{"company_name":"Temporary M","full_name":"Manager"}'),
 (e,'team-employee@example.invalid',now(),'{"company_name":"Temporary E","full_name":"Employee"}');
 select company_id into c from public.profiles where id=a;
 insert into public.departments(company_id,name) values(c,'Operations') returning id into d;
 update public.profiles set company_id=c,department_id=d,role='manager' where id=m;
 update public.profiles set company_id=c,department_id=d,role='employee' where id=e;
 perform set_config('test.admin',a::text,true);perform set_config('test.other_admin',b::text,true);
 perform set_config('test.manager',m::text,true);perform set_config('test.employee',e::text,true);
 perform set_config('test.company',c::text,true);perform set_config('test.department',d::text,true);
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);



reset role;
do $$declare u uuid:=current_setting('test.admin')::uuid;c uuid:=current_setting('test.company')::uuid;t uuid:=gen_random_uuid();old uuid:=gen_random_uuid();d uuid:=gen_random_uuid();source jsonb;at timestamptz;slots jsonb;begin
 insert into private.myday_personal_options(owner_id,company_id,settings) values(u,c,'{"work_start":"00:00","work_end":"23:59"}') on conflict(owner_id) do update set settings=excluded.settings;
 insert into public.actions(id,company_id,owner_id,title,due_date,time_needed_minutes) values(t,c,u,'Learned time task',current_date,null);
 insert into public.actions(id,company_id,owner_id,title,due_date,status,completed_at,created_at) values(old,c,u,'Historic timed work',current_date,'done',now()-interval '1 hour',now()-interval '3 hours');
 insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status,created_at) values(old,u,c,u,'status_changed','in_progress',now()-interval '42 minutes');
 source:=public.myday_plan('get');if not source->'tasks' @> jsonb_build_array(jsonb_build_object('id',t,'time_needed_minutes',42,'duration_source','history')) then raise exception 'Actual task duration not used';end if;
 at:=(source->>'start')::timestamptz+interval '2 minutes';
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.myday_calendar_busy_service(u,'gmail',jsonb_build_array(jsonb_build_object('start',at,'end',at+interval '30 minutes')));
 perform set_config('request.jwt.claims','{}',true);
 slots:=jsonb_build_array(jsonb_build_object('id',t,'start',at,'minutes',15,'reason','Due today.'));
 begin perform public.myday_plan('accept',jsonb_build_object('items',slots));raise exception 'Meeting overlap accepted';exception when invalid_parameter_value then null;end;
 slots:=jsonb_build_array(jsonb_build_object('id',t,'start',at+interval '40 minutes','minutes',15,'reason','After the meeting.'));
 perform public.myday_plan('accept',jsonb_build_object('items',slots));
 insert into public.decisions(id,company_id,owner_id,title,reason,decided_by,decided_on) values(d,c,u,'Decision reminder','Initial rationale','Fixture owner',current_date);
 update public.actions set decision_id=d where id=t;
 update private.myday_plans set items=jsonb_build_array(jsonb_build_object('id',t,'start',now()+interval '10 minutes','minutes',15,'reason','Add decision context.')) where owner_id=u and day=current_date;
 perform private.process_myday_plan_notices(now(),u);perform private.process_myday_plan_notices(now(),u);
 if (select count(*) from private.myday_notifications where task_id=t and title like 'Add your reason before %')<>1 then raise exception 'Advance decision reminder missing or duplicated';end if;
 perform private.process_myday_plan_notices(now()+interval '10 minutes',u);
 if (select count(*) from private.myday_notifications where task_id=t)<>2 then raise exception 'Start reminder missing';end if;
 if has_function_privilege('anon','private.process_myday_plan_notices(timestamptz,uuid)','execute') or has_function_privilege('authenticated','private.process_myday_plan_notices(timestamptz,uuid)','execute') then raise exception 'Notification processor exposed';end if;
end$$;rollback;
