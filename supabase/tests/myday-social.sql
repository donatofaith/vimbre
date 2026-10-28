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

do $$declare r jsonb;begin
r:=public.myday_social();if (r->>'enabled')::boolean or r->'challenge'<>'null'::jsonb then raise exception 'Company off default failed';end if;
begin perform public.myday_social('kudos',current_setting('test.employee')::uuid,'Thanks');raise exception 'Off allowed kudos';exception when insufficient_privilege then null;end;
end$$;
select public.myday_competition_settings('teams',true);
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select public.myday_competition_settings(null,true);
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare r jsonb;begin
begin perform public.myday_social('kudos',auth.uid(),'Self');raise exception 'Self kudos allowed';exception when insufficient_privilege then null;end;
begin perform public.myday_social('kudos',current_setting('test.other_admin')::uuid,'Foreign');raise exception 'Foreign company kudos allowed';exception when insufficient_privilege then null;end;
r:=public.myday_social('kudos',current_setting('test.employee')::uuid,'Thanks for the cover');
if not (r->>'sent')::boolean then raise exception 'Send absent';end if;
perform public.myday_social('kudos',current_setting('test.employee')::uuid,'Retry');
begin perform public.myday_social('kudos',current_setting('test.manager')::uuid,'Second');raise exception 'Daily limit bypassed';exception when invalid_parameter_value then null;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare r jsonb;begin
r:=public.myday_social();if jsonb_array_length(r->'received')<>1 or r->'received'->0->>'body'<>'Thanks for the cover' then raise exception 'Kudos note or retry wrong';end if;
if (public.myday_stars()->>'today')::int<>1 then raise exception 'Kudos award duplicate';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin if jsonb_array_length(public.myday_social()->'received')<>0 then raise exception 'Other recipient note leaked';end if;end$$;
reset role;
insert into public.actions(company_id,owner_id,title,due_date) select current_setting('test.company')::uuid,current_setting('test.employee')::uuid,'Challenge overdue '||n,current_date-1 from generate_series(1,2)n;
insert into public.actions(company_id,owner_id,title,due_date) values(current_setting('test.company')::uuid,current_setting('test.manager')::uuid,'Hidden task',current_date-1);
delete from private.myday_challenges where company_id=current_setting('test.company')::uuid;
set local role authenticated;select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare r jsonb;begin r:=public.myday_social();if (r->'challenge'->>'baseline')::int<>2 then raise exception 'Challenge included hidden tasks';end if;end$$;
select public.myday_action(id,'status','{"status":"done"}') from public.actions where owner_id=auth.uid() and title='Challenge overdue 1';
do $$declare r jsonb;begin r:=public.myday_social();if (r->'challenge'->>'remaining')::int<>1 or (r->'challenge'->>'done')::int<>1 then raise exception 'Challenge progress incorrect';end if;end$$;
select public.myday_competition_settings(null,false);
do $$begin if public.myday_social()->'challenge'<>'null'::jsonb then raise exception 'Hidden viewer saw challenge';end if;end$$;
reset role;
do $$begin
if (select count(*) from private.myday_kudos where company_id=current_setting('test.company')::uuid)<>1 then raise exception 'Duplicate send row';end if;
if has_function_privilege('anon','public.myday_social(text,uuid,text)','execute') or has_table_privilege('authenticated','private.myday_kudos','select') then raise exception 'Direct or anonymous grant';end if;
end$$;
rollback;
