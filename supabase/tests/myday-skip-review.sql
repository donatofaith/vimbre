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
insert into public.work_preferences(owner_id,company_id,timezone) values(current_setting('test.admin')::uuid,current_setting('test.company')::uuid,'UTC') on conflict(owner_id) do update set timezone='UTC';
insert into public.actions(company_id,owner_id,title,due_date) values(current_setting('test.company')::uuid,current_setting('test.admin')::uuid,'Skip review fixture',current_date);
select set_config('test.task',(select id::text from public.actions where owner_id=current_setting('test.admin')::uuid),true);
insert into private.myday_plan_skips(owner_id,company_id,task_id,day) select current_setting('test.admin')::uuid,current_setting('test.company')::uuid,current_setting('test.task')::uuid,current_date-n from generate_series(1,2)n;
set local role authenticated;
do $$begin if jsonb_array_length(public.myday_skip_review()->'tasks')<>0 then raise exception 'Two days triggered prompt';end if;end$$;
select public.myday_skip_review('skip',current_setting('test.task')::uuid,current_date+1);
select public.myday_skip_review('skip',current_setting('test.task')::uuid,current_date+1);
do $$begin if jsonb_array_length(public.myday_skip_review()->'tasks')<>1 then raise exception 'Three days did not trigger';end if;
begin perform public.myday_skip_review('skip',current_setting('test.task')::uuid,current_date);raise exception 'Past skip accepted';exception when invalid_parameter_value then null;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin
if jsonb_array_length(public.myday_skip_review()->'tasks')<>0 then raise exception 'Another owner saw prompt';end if;
begin perform public.myday_skip_review('keep',current_setting('test.task')::uuid);raise exception 'Another owner dismissed prompt';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
select public.myday_skip_review('keep',current_setting('test.task')::uuid);
do $$begin if jsonb_array_length(public.myday_skip_review()->'tasks')<>0 then raise exception 'Keep did not dismiss';end if;end$$;
reset role;
do $$begin if (select count(*) from private.myday_plan_skips where task_id=current_setting('test.task')::uuid)<>3 then raise exception 'Same-day skip not idempotent';end if;if has_function_privilege('anon','public.myday_skip_review(text,uuid,date)','execute') or has_table_privilege('authenticated','private.myday_plan_skips','select') then raise exception 'Skip data exposed';end if;end$$;
rollback;
