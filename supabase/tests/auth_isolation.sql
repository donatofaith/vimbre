-- Transaction-only fixtures. No test accounts or records remain after this check.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); ca uuid; cb uuid; dx uuid; dy uuid;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (a,'admin-a@example.invalid','{"company_name":"Isolation A","full_name":"Admin A"}'),
 (b,'admin-b@example.invalid','{"company_name":"Isolation B","full_name":"Admin B"}'),
 (m,'manager@example.invalid','{"company_name":"Temporary manager","full_name":"Manager"}'),
 (e,'employee@example.invalid','{"company_name":"Temporary employee","full_name":"Employee"}'),
 (o,'other@example.invalid','{"company_name":"Temporary other","full_name":"Other"}');
 select company_id into ca from public.profiles where id=a;
 select company_id into cb from public.profiles where id=b;
 insert into public.departments(company_id,name) values(ca,'Department X') returning id into dx;
 insert into public.departments(company_id,name) values(ca,'Department Y') returning id into dy;
 update public.profiles set company_id=ca,department_id=dx,role='manager' where id=m;
 update public.profiles set company_id=ca,department_id=dx,role='employee' where id=e;
 update public.profiles set company_id=ca,department_id=dy,role='employee' where id=o;
 update public.departments set manager_id=m where id=dx;
 perform set_config('test.admin',a::text,true);perform set_config('test.manager',m::text,true);perform set_config('test.employee',e::text,true);perform set_config('test.company_b',cb::text,true);
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$ declare changed integer; begin
 if (select count(*) from public.companies)<>1 then raise exception 'Company isolation failed';end if;
 if (select count(*) from public.profiles)<>4 then raise exception 'Admin scope failed';end if;
 update public.companies set name='Must not change' where id=current_setting('test.company_b')::uuid;
 get diagnostics changed=row_count;if changed<>0 then raise exception 'Cross company write allowed';end if;
 update public.companies set name='Allowed own update' where id=private.current_company_id();
 get diagnostics changed=row_count;if changed<>1 then raise exception 'Own company update failed';end if;
 begin update public.profiles set role='manager' where id=auth.uid();raise exception 'Role escalation allowed';exception when insufficient_privilege then null;end;
 begin insert into public.activity_log(company_id,record_type,record_id,action) values(private.current_company_id(),'test',auth.uid(),'forged');raise exception 'Forged audit allowed';exception when insufficient_privilege then null;end;
end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$ begin
 if (select count(*) from public.profiles)<>2 then raise exception 'Manager department scope failed';end if;
 if (select count(*) from public.departments)<>1 then raise exception 'Manager department visibility failed';end if;
 if exists(select 1 from public.companies where name='Isolation B') then raise exception 'Manager cross company read';end if;
end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$ declare changed integer;begin
 if (select count(*) from public.profiles)<>1 then raise exception 'Employee scope failed';end if;
 update public.profiles set full_name='Updated own name' where id=auth.uid();get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Own profile update failed';end if;
 update public.companies set name='Not allowed';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Employee company update allowed';end if;
 begin update public.profiles set company_id=current_setting('test.company_b')::uuid where id=auth.uid();raise exception 'Company reassignment allowed';exception when insufficient_privilege then null;end;
end; $$;
reset role;
update public.profiles set active=false where id=current_setting('test.employee')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin if exists(select 1 from public.profiles) or exists(select 1 from public.companies) then raise exception 'Inactive member access allowed';end if;end;$$;
reset role;
set local role anon;
do $$begin begin perform count(*) from public.companies;raise exception 'Anonymous access allowed';exception when insufficient_privilege then null;end;end;$$;
reset role;
rollback;
select 'passed: bootstrap, admin, manager, employee, company isolation, escalation, audit, inactive and anonymous checks' as result;
