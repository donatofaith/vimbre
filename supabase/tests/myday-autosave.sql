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
do $$declare t uuid:=gen_random_uuid();v jsonb;j jsonb;begin
perform public.myday_action(t,'create','{"title":"Autosave fixture","due_date":"2026-10-28","details":"","status":"open","priority":"high","reminder_option":"at_time","source_kind":"manual"}');
v:=jsonb_build_object('title','Autosaved title','due_date',current_date+1,'details','Retain these notes','status','open','priority','high','reminder_option','at_time','source_kind','manual');
v:=v||jsonb_build_object('base_updated_at',(select updated_at from public.actions where id=t));j:=public.myday_edit(t,v);
if j->>'updated_at' is null or (select title from public.actions where id=t)<>'Autosaved title' then raise exception 'Autosave result missing';end if;
begin perform public.myday_edit(t,v||'{"base_updated_at":"2000-01-01T00:00:00Z"}');raise exception 'Stale save accepted';exception when serialization_failure then null;end;
perform set_config('test.autosave_task',t::text,true);
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin begin perform public.myday_edit(current_setting('test.autosave_task')::uuid,'{"title":"Forged"}');raise exception 'Other owner save accepted';exception when insufficient_privilege then null;end;end$$;
rollback;
