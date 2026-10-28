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


set local role authenticated;select public.myday_streak_settings(array[1,2,3,4,5,6,7]);
reset role;
insert into private.myday_star_awards(company_id,owner_id,day,points,reason,source_key) values(current_setting('test.company')::uuid,current_setting('test.admin')::uuid,current_date-1,1,'Fixture','fixture-yesterday'),(current_setting('test.company')::uuid,current_setting('test.admin')::uuid,current_date-3,1,'Fixture','fixture-earlier');
set local role authenticated;
do $$begin if (public.myday_stars()->>'streak')::int<>1 then raise exception 'Working day streak wrong';end if;perform public.myday_streak_settings(null,current_date-2,current_date-2);if (public.myday_stars()->>'streak')::int<>2 then raise exception 'Absence broke streak';end if;begin perform public.myday_streak_settings(array[0]);raise exception 'Invalid weekdays accepted';exception when invalid_parameter_value then null;end;end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin if jsonb_array_length(public.myday_streak_settings()->'pauses')<>0 then raise exception 'Another person saw absence';end if;end$$;rollback;
