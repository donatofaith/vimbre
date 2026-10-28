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


set local role authenticated;
do $$declare t uuid:=gen_random_uuid();slots jsonb;source jsonb;begin
insert into public.actions(id,company_id,owner_id,title,due_date) values(t,current_setting('test.company')::uuid,auth.uid(),'Retry plan task',current_date);
perform public.myday_suite('preferences',null,'{"work_start":"00:00","work_end":"23:59"}');
source:=public.myday_plan('get');
slots:=jsonb_build_array(jsonb_build_object('id',t,'start',(source->>'start')::timestamptz+interval '1 minute','minutes',30,'reason','First task.'));
perform public.myday_plan('accept',jsonb_build_object('items',slots));
perform public.myday_plan('accept',jsonb_build_object('items',slots));
if (public.myday_plan('get')->'plan'->>'replans')::int<>0 then raise exception 'Retry used replan allowance';end if;
perform public.myday_action(t,'status','{"status":"done"}');
perform public.myday_plan('accept','{"items":[]}');
source:=public.myday_plan('get');
if jsonb_array_length(source->'completed')<>1 or jsonb_array_length(source->'plan'->'items')<>1 then raise exception 'Completed task lost during replan';end if;
end$$;
rollback;
