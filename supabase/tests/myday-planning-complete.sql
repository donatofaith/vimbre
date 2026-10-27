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
do $$
declare u uuid:=current_setting('test.admin')::uuid;c uuid:=current_setting('test.company')::uuid;e uuid:=current_setting('test.employee')::uuid;own_task uuid:=gen_random_uuid();overflow_task uuid:=gen_random_uuid();cover_task uuid:=gen_random_uuid();hidden_task uuid:=gen_random_uuid();decision uuid:=gen_random_uuid();h uuid:=gen_random_uuid();source jsonb;slots jsonb;at timestamptz;result jsonb;
begin
 insert into private.myday_personal_options(owner_id,company_id,settings) values(u,c,'{"work_start":"00:00","work_end":"23:59"}') on conflict(owner_id) do update set settings=excluded.settings;
 insert into public.decisions(id,company_id,owner_id,title,reason,decided_by,decided_on) values(decision,c,u,'Supplier decision','Initial supplier reason.','Fixture owner',current_date);
 insert into public.actions(id,company_id,owner_id,title,due_date,decision_id) values(own_task,c,u,'Decision task',current_date,decision);
 insert into public.actions(id,company_id,owner_id,title,due_date) values(overflow_task,c,u,'Due today overflow',current_date),(cover_task,c,e,'Approved cover task',current_date),(hidden_task,c,e,'Unselected private task',current_date);
 insert into public.work_handovers(id,company_id,owner_id,cover_id,reviewer_id,title,starts_on,ends_on,status,structured) values(h,c,e,u,current_setting('test.manager')::uuid,'Selected cover',current_date,current_date+1,'approved',true);
 insert into private.handover_items(handover_id,kind,record_id,approved) values(h,'task',cover_task,true);
 source:=public.myday_plan('get');
 if not source->'tasks' @> jsonb_build_array(jsonb_build_object('id',cover_task,'covering',true)) then raise exception 'Approved cover task missing';end if;
 if source->'tasks' @> jsonb_build_array(jsonb_build_object('id',hidden_task)) then raise exception 'Unselected task exposed';end if;
 if not source->'tasks' @> jsonb_build_array(jsonb_build_object('id',own_task,'decision_id',decision,'needs_reason',true)) then raise exception 'Decision reason input missing';end if;
 at:=(source->>'start')::timestamptz+interval '1 minute';
 slots:=jsonb_build_array(jsonb_build_object('id',own_task,'start',at,'minutes',15,'reason','Due today.','decision_reason','Supplier agreed to Friday.'),jsonb_build_object('id',cover_task,'start',at+interval '25 minutes','minutes',15,'reason','Covering approved work.'));
 begin perform public.myday_plan('accept',jsonb_build_object('items',slots));raise exception 'Unreviewed overflow accepted';exception when invalid_parameter_value then null;end;
 perform public.myday_plan('accept',jsonb_build_object('items',slots,'acknowledged_unscheduled',jsonb_build_array(overflow_task)));
 perform public.myday_plan('accept',jsonb_build_object('items',slots,'acknowledged_unscheduled',jsonb_build_array(overflow_task)));
 if (public.myday_plan('get')->'plan'->>'replans')::int<>0 then raise exception 'Retry consumed replan';end if;
 if (select reason from public.decisions where id=decision)<>'Supplier agreed to Friday.' then raise exception 'Reviewed decision reason not saved';end if;
 perform public.myday_defer_plan_task(cover_task,current_date+1);
 if (select due_date from public.actions where id=cover_task)<>current_date or public.myday_plan('get')->'tasks' @> jsonb_build_array(jsonb_build_object('id',cover_task)) then raise exception 'Cover deferral changed owner date or stayed in today plan';end if;
 delete from private.myday_plan_deferrals where task_id=cover_task;
 perform public.myday_plan('accept',jsonb_build_object('items',slots,'acknowledged_unscheduled',jsonb_build_array(overflow_task)));
 perform public.myday_plan_action(cover_task,'start');perform public.myday_plan_action(cover_task,'done');
 if (select due_date from public.actions where id=cover_task)<>current_date then raise exception 'Completion changed due date';end if;
 begin perform public.myday_plan_action(hidden_task,'done');raise exception 'Unselected task mutation permitted';exception when insufficient_privilege then null;end;
 perform public.myday_plan_action(own_task,'done','Confirmed by the supplier.');
 if (select reason from public.decisions where id=decision)<>'Confirmed by the supplier.' then raise exception 'Completion reason not saved';end if;
 source:=public.myday_plan('get');if jsonb_array_length(source->'completed')<>2 then raise exception 'Completed plan slots lost';end if;
 update public.work_handovers set status='cancelled' where id=h;
 if public.myday_plan('get')->'completed' @> jsonb_build_array(jsonb_build_object('id',cover_task)) then raise exception 'Revoked cover task remains readable';end if;
 if has_function_privilege('anon','public.myday_plan_action(uuid,text,text)','execute') or has_function_privilege('authenticated','public.myday_calendar_busy_service(uuid,text,jsonb)','execute') or has_table_privilege('authenticated','private.myday_calendar_busy','select') then raise exception 'Unexpected direct grants';end if;
end$$;
rollback;
