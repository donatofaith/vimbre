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


set local role authenticated;select public.myday_competition_settings('teams',true);
reset role;
insert into public.actions(company_id,owner_id,title,due_date,priority,time_needed_minutes) select current_setting('test.company')::uuid,current_setting('test.admin')::uuid,'Cap fixture '||n,current_date,'high',60 from generate_series(1,10)n;
update public.actions set created_at=now()-interval '11 minutes' where owner_id=current_setting('test.admin')::uuid;
set local role authenticated;
select public.myday_action(id,'status','{"status":"done"}') from public.actions where owner_id=auth.uid();
do $$declare j jsonb;begin j:=public.myday_stars();if (j->>'today')::int<>15 then raise exception 'Daily cap failed: %',j;end if;if jsonb_array_length(j->'ranking')<>1 then raise exception 'Opted-in member absent';end if;end$$;
select public.myday_competition_settings(null,false);
do $$begin if jsonb_array_length(public.myday_stars()->'ranking')<>0 then raise exception 'Opt out did not hide member';end if;if has_function_privilege('anon','public.myday_stars()','EXECUTE') then raise exception 'Anonymous access granted';end if;end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin if (public.myday_stars()->>'today')::int<>0 then raise exception 'Other member read private stars';end if;end$$;
rollback;
