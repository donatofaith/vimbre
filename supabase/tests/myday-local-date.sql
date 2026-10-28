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
-- Insert proposed function definitions here when testing before migration.

reset role;
insert into public.work_preferences(owner_id,company_id,timezone) values(current_setting('test.admin')::uuid,current_setting('test.company')::uuid,'Pacific/Auckland') on conflict(owner_id) do update set timezone=excluded.timezone;
insert into public.actions(company_id,owner_id,title,due_date,due_at,due_time,status)
select current_setting('test.company')::uuid,current_setting('test.admin')::uuid,'Date rule '||v.name,(now() at time zone 'Pacific/Auckland')::date+v.delta,(((now() at time zone 'Pacific/Auckland')::date+v.delta)+time '00:01') at time zone 'Pacific/Auckland',time '00:01',v.status from (values('earlier',0,'open'),('yesterday',-1,'open'),('finished',-1,'done'))v(name,delta,status);
set local role authenticated;
do $$declare j jsonb;begin
j:=public.myday_tasks('today','Date rule','',0);
if not exists(select 1 from jsonb_array_elements(j->'rows')t where t->>'title'='Date rule earlier') then raise exception 'Earlier task missing from Today';end if;
if jsonb_array_length(j->'overdue_rows')<>1 then raise exception 'Overdue must exclude today and done';end if;
if (j->'tab_counts'->>'overdue')::int<>1 then raise exception 'Overdue count wrong';end if;
end$$;
rollback;
