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
update public.ai_company_limits set plan=null,daily_request_limit=23 where company_id=current_setting('test.company')::uuid;
update public.ai_company_limits set plan=null,daily_request_limit=37 where company_id=(select company_id from public.profiles where id=current_setting('test.other_admin')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare s jsonb;begin s:=public.ai_allowance_summary();if s->>'enabled'<>'true' or s->>'daily_request_limit'<>'23' or s ?| array['plan','daily_cost','monthly_cost','daily_cost_limit','monthly_cost_limit'] then raise exception 'Invalid employee projection';end if;end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin if public.ai_allowance_summary()->>'daily_request_limit'<>'23' or public.ai_allowance_summary() ? 'daily_cost' then raise exception 'Invalid manager projection';end if;end$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$begin if not(public.ai_allowance_summary() ? 'daily_cost') then raise exception 'Admin lost financial summary';end if;end$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin if public.ai_allowance_summary()->>'daily_request_limit'<>'37' then raise exception 'Cross-company projection';end if;end$$;
reset role;
update public.profiles set active=false where id=current_setting('test.employee')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin if public.ai_allowance_summary() is not null then raise exception 'Inactive member read allowance';end if;end$$;
reset role;
select 'Member allowance projection, financial privacy, tenant isolation and inactive denial passed' result;
rollback;
