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
select public.myday_competition_settings('company',false);
reset role;
insert into public.actions(company_id,owner_id,title,due_date,created_at) values(current_setting('test.company')::uuid,current_setting('test.admin')::uuid,'Eligible star task',current_date,now()-interval '11 minutes'),(current_setting('test.company')::uuid,current_setting('test.admin')::uuid,'Too new task',current_date,now());
update public.actions set created_at=now()-interval '11 minutes' where owner_id=current_setting('test.admin')::uuid and title='Eligible star task';
set local role authenticated;
select public.myday_action(id,'status','{"status":"done"}') from public.actions where owner_id=auth.uid();
do $$declare j jsonb;begin j:=public.myday_stars();if (j->>'today')::int<>1 then raise exception 'Expected one eligible award: %',j;end if;if jsonb_array_length(j->'ranking')<>0 then raise exception 'Hidden member leaked';end if;end$$;
select public.myday_action(id,'status','{"status":"open"}') from public.actions where owner_id=auth.uid() and title='Eligible star task';
do $$begin if (public.myday_stars()->>'today')::int<>0 then raise exception 'Undo did not revoke award';end if;end$$;
select public.myday_action(id,'status','{"status":"done"}') from public.actions where owner_id=auth.uid() and title='Eligible star task';
do $$begin if (public.myday_stars()->>'today')::int<>0 then raise exception 'Repeated completion earned again';end if;end$$;
rollback;
