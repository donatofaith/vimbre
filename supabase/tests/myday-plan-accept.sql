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

-- Install proposal definitions after RESET ROLE when testing before migration.
reset role;

set local role authenticated;
do $$declare t uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();j jsonb;slots jsonb;start_at timestamptz;begin
insert into public.actions(id,company_id,owner_id,title,due_date) values(t,current_setting('test.company')::uuid,auth.uid(),'Plan fixture',current_date);
start_at:=(public.myday_plan('get')->>'start')::timestamptz+interval '1 minute';
slots:=jsonb_build_array(jsonb_build_object('id',t,'start',start_at,'minutes',30,'reason','Due today.'));
perform public.myday_plan('accept',jsonb_build_object('items',slots));
j:=public.myday_plan('get');if jsonb_array_length(j->'plan'->'items')<>1 then raise exception 'Accepted plan missing';end if;
begin perform public.myday_plan('accept',jsonb_build_object('items',slots||slots));raise exception 'Duplicate task accepted';exception when insufficient_privilege then null;end;
begin perform public.myday_plan('accept',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',foreign_id,'start',start_at,'minutes',30))));raise exception 'Unknown task accepted';exception when insufficient_privilege then null;end;
perform public.myday_plan('accept',jsonb_build_object('items',slots));
perform public.myday_plan('accept',jsonb_build_object('items',slots));
perform public.myday_plan('accept',jsonb_build_object('items',slots));
begin perform public.myday_plan('accept',jsonb_build_object('items',slots));raise exception 'Fourth replan accepted';exception when invalid_parameter_value then null;end;
end$$;
rollback;
