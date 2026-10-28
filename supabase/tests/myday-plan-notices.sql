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
do $$declare t uuid:=gen_random_uuid();begin
insert into public.actions(id,company_id,owner_id,title,due_date) values(t,current_setting('test.company')::uuid,current_setting('test.admin')::uuid,'Plan reminder fixture',current_date);
insert into private.myday_plans(owner_id,company_id,day,items) values(current_setting('test.admin')::uuid,current_setting('test.company')::uuid,current_date,jsonb_build_array(jsonb_build_object('id',t,'start',now(),'minutes',30,'reason','Due today')));
perform private.process_myday_plan_notices(now(),current_setting('test.admin')::uuid);
perform private.process_myday_plan_notices(now(),current_setting('test.admin')::uuid);
if (select count(*) from private.myday_notifications where task_id=t)<>1 then raise exception 'Plan notification missing or duplicated';end if;
end$$;
rollback;
