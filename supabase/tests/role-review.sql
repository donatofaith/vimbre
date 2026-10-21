-- Prepend team-fixtures.sql. Entire transaction rolls back, no emails sent.
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare v uuid; begin
 if not has_column_privilege('authenticated','public.companies','name','UPDATE') or has_column_privilege('authenticated','public.companies','contact_email','UPDATE') or has_column_privilege('authenticated','public.companies','team_mode','UPDATE') then raise exception 'Settings grants failed'; end if;
 update public.companies set name='Renamed test company' where id=current_setting('test.company')::uuid;
 begin update public.companies set team_mode='departments' where id=current_setting('test.company')::uuid; raise exception 'Structure write allowed'; exception when insufficient_privilege then null; end;
 begin update public.companies set contact_email='changed@example.invalid' where id=current_setting('test.company')::uuid; raise exception 'Email write allowed'; exception when insufficient_privilege then null; end;
 insert into public.role_items(company_id,owner_id,kind,title,details,recurrence) values(current_setting('test.company')::uuid,current_setting('test.employee')::uuid,'responsibility','Supplier review','Original description','Weekly') returning id into v;
 perform set_config('test.item',v::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$ declare n integer; begin
 update public.role_items set details='Employee edit' where id=current_setting('test.item')::uuid;
 get diagnostics n=row_count; if n<>0 then raise exception 'Employee edited responsibility'; end if;
 begin insert into public.role_items(company_id,owner_id,kind,title) values(current_setting('test.company')::uuid,auth.uid(),'responsibility','Not allowed'); raise exception 'Employee created responsibility'; exception when insufficient_privilege then null; end;
 insert into public.role_items(company_id,owner_id,kind,title,next_step,work_status) values(current_setting('test.company')::uuid,auth.uid(),'workstream','Open work','Share notes','waiting');
 insert into public.decisions(company_id,owner_id,title,reason,decided_by,decided_on,next_step) values(current_setting('test.company')::uuid,auth.uid(),'Monthly reviews','Less meeting time','Employee',current_date,'Share notes');
 insert into public.role_items(company_id,owner_id,kind,title,file_path) values(current_setting('test.company')::uuid,auth.uid(),'document','Guide',auth.uid()::text||'/test.pdf');
 begin insert into public.role_items(company_id,owner_id,kind,title,file_path) values(current_setting('test.company')::uuid,auth.uid(),'document','Bad file',current_setting('test.other_admin')||'/test.pdf'); raise exception 'Foreign file path allowed'; exception when check_violation then null; end;
 insert into public.responsibility_notes(item_id,body) values(current_setting('test.item')::uuid,'Private note');
 perform set_config('test.suggestion',public.suggest_responsibility(current_setting('test.item')::uuid,'Suggested description')::text,true);
 begin perform public.review_responsibility(current_setting('test.suggestion')::uuid,true); raise exception 'Employee approved suggestion'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$ declare n integer; begin
 if exists(select 1 from public.responsibility_notes) then raise exception 'Manager read private notes'; end if;
 update public.role_items set title='Managed supplier review' where id=current_setting('test.item')::uuid;
 get diagnostics n=row_count; if n<>1 then raise exception 'Manager cannot edit team'; end if;
 perform public.review_responsibility(current_setting('test.suggestion')::uuid,true);
 if (select details from public.role_items where id=current_setting('test.item')::uuid)<>'Suggested description' then raise exception 'Approval failed'; end if;
 begin perform public.review_responsibility(current_setting('test.suggestion')::uuid,true); raise exception 'Suggestion reviewed twice'; exception when invalid_parameter_value then null; end;
 begin perform public.manage_member_context(current_setting('test.employee')::uuid,'Not allowed','employee',current_setting('test.department')::uuid,true,'No',current_date);
 raise exception 'Manager changed protected role context';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$ begin
 if exists(select 1 from public.responsibility_notes) then raise exception 'HR read private notes'; end if;
 perform public.manage_member_context(current_setting('test.employee')::uuid,'Employee','employee',current_setting('test.department')::uuid,true,'Supplier reviews',date '2026-10-01');
 if not exists(select 1 from public.profiles where id=current_setting('test.employee')::uuid and role_description='Supplier reviews' and role_start_date=date '2026-10-01') then raise exception 'Role context missing'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$ declare n integer; begin
 if exists(select 1 from public.role_items where id=current_setting('test.item')::uuid) then raise exception 'Cross company read'; end if;
 update public.role_items set details='Foreign edit' where id=current_setting('test.item')::uuid; get diagnostics n=row_count; if n<>0 then raise exception 'Cross company edit'; end if;
 if exists(select 1 from public.responsibility_suggestions) then raise exception 'Cross company suggestions'; end if;
 begin perform public.review_responsibility(current_setting('test.suggestion')::uuid,false); raise exception 'Foreign approval allowed'; exception when insufficient_privilege then null; end;
 if private.can_read_role(private.document_owner(current_setting('test.employee')||'/test.pdf')) then raise exception 'Foreign storage access'; end if;
end $$;
-- A direct grant is insufficient to bypass the settings protection trigger.
reset role;
grant update(team_mode) on public.companies to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$ begin
 begin update public.companies set team_mode='departments' where id=current_setting('test.company')::uuid; raise exception 'Settings trigger bypassed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'role review and settings boundaries passed' as result;
rollback;
