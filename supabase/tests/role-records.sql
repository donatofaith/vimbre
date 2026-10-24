-- Prepend team-fixtures.sql. Every fixture and audit row is rolled back.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$
declare w uuid; r uuid; d uuid;
begin
 insert into public.role_items(company_id,owner_id,kind,title) values(current_setting('test.company')::uuid,auth.uid(),'workstream','Service reviews') returning id into w;
 insert into public.role_items(company_id,owner_id,kind,title,details) values(current_setting('test.company')::uuid,auth.uid(),'responsibility','Own the reviews','Keep context') returning id into r;
 insert into public.role_items(company_id,owner_id,kind,title,contact_email) values(current_setting('test.company')::uuid,auth.uid(),'external_contact','External reviewer','reviewer@example.invalid');
 insert into public.role_items(company_id,owner_id,kind,title,url) values(current_setting('test.company')::uuid,auth.uid(),'document','Review guide','https://example.invalid/guide');
 insert into public.role_items(company_id,owner_id,kind,title,due_date,recurrence) values(current_setting('test.company')::uuid,auth.uid(),'recurring_deadline','Send review',current_date,'Every Friday');
 insert into public.decisions(company_id,owner_id,workstream_id,title,reason,decided_by,decided_on,source_url,related_task_url)
 values(current_setting('test.company')::uuid,auth.uid(),w,'Keep weekly reviews','Keep work visible','Team lead',current_date,'https://example.invalid/source','https://example.invalid/task') returning id into d;
 perform set_config('test.stream',w::text,true); perform set_config('test.item',r::text,true); perform set_config('test.decision',d::text,true);
 update public.decisions set status='replaced' where id=d;
 update public.decisions set status='reversed' where id=d;
 update public.role_items set deleted_at=now() where id=r;
 if not exists(select 1 from public.role_items where id=r and deleted_at is not null) then raise exception 'Archive failed'; end if;
 update public.role_items set deleted_at=null where id=r;
 -- Cannot change identity, even to another owner in the same company.
 begin update public.role_items set owner_id=current_setting('test.manager')::uuid where id=r;raise exception 'Owner reassignment allowed';exception when insufficient_privilege then null;end;
 begin update public.role_items set kind='workstream' where id=r;raise exception 'Kind mutation allowed';exception when insufficient_privilege then null;end;
 begin insert into public.role_items(company_id,owner_id,kind,title) values(current_setting('test.company')::uuid,current_setting('test.manager')::uuid,'workstream','Forged');raise exception 'Other owner insertion';exception when insufficient_privilege then null;end;
 begin update public.decisions set workstream_id=r where id=d;raise exception 'Non workstream link allowed';exception when check_violation then null;end;
 begin update public.decisions set source_url='javascript:alert(1)' where id=d;raise exception 'Unsafe URL allowed';exception when check_violation then null;end;
 begin update public.decisions set source_url='https://name:password@example.invalid' where id=d;raise exception 'Credentials allowed';exception when check_violation then null;end;
 begin insert into public.role_items(company_id,owner_id,kind,title) values(current_setting('test.company')::uuid,auth.uid(),'recurring_deadline','Missing recurrence');raise exception 'Incomplete deadline';exception when check_violation then null;end;
 begin delete from public.decisions where id=d;raise exception 'Hard delete allowed';exception when insufficient_privilege then null;end;
 perform public.log_role_view(auth.uid());
 -- Archiving a workstream retains old links but prevents new ones.
 update public.role_items set deleted_at=now() where id=w;
 update public.decisions set reason='Updated reason' where id=d;
 begin insert into public.decisions(company_id,owner_id,workstream_id,title,reason,decided_by,decided_on) values(current_setting('test.company')::uuid,auth.uid(),w,'New','Reason','Owner',current_date);raise exception 'Archived stream accepted';exception when check_violation then null;end;
 update public.role_items set deleted_at=null where id=w;
end; $$;
-- A manager reads the department, but cannot edit someone else's records.
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare n integer; begin
 if (select count(*) from public.role_items)<>5 or (select count(*) from public.decisions)<>1 then raise exception 'Manager scope missing';end if;
 update public.decisions set title='Manager overwrite' where id=current_setting('test.decision')::uuid;get diagnostics n=row_count;
 if n<>0 then raise exception 'Manager edit allowed';end if;
 perform public.log_role_view(current_setting('test.employee')::uuid);
end;$$;
-- HR reads all company records, without impersonating their owner.
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare n integer;begin
 if (select count(*) from public.decisions)<>1 then raise exception 'HR scope missing';end if;
 update public.role_items set title='HR overwrite' where id=current_setting('test.item')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'HR edit allowed';end if;
 if not exists(select 1 from public.activity_log where record_type='role_record' and action='view') then raise exception 'View audit missing';end if;
 if not exists(select 1 from public.activity_log where record_type='decisions' and action='update') then raise exception 'Change audit missing';end if;
end;$$;
-- Another company cannot read, edit, link to, or log a view of these records.
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$declare c uuid;n integer;begin
 select company_id into c from public.profiles where id=auth.uid();
 if exists(select 1 from public.role_items) or exists(select 1 from public.decisions) then raise exception 'Tenant leak';end if;
 update public.decisions set title='Cross tenant' where id=current_setting('test.decision')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Cross tenant edit';end if;
 begin perform public.log_role_view(current_setting('test.employee')::uuid);raise exception 'Cross tenant view audit allowed';exception when insufficient_privilege then null;end;
 begin insert into public.decisions(company_id,owner_id,workstream_id,title,reason,decided_by,decided_on) values(c,auth.uid(),current_setting('test.stream')::uuid,'Cross link','Reason','Owner',current_date);raise exception 'Cross tenant stream linked';exception when check_violation or foreign_key_violation then null;end;
end;$$;
-- Move manager out of department: access changes immediately without JWT refresh.
reset role;
update public.profiles set department_id=null where id=current_setting('test.manager')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin if exists(select 1 from public.role_items) or exists(select 1 from public.decisions) then raise exception 'Out of department leak';end if;end;$$;
-- Employee cannot read a colleague's records, even in their department.
reset role;
insert into public.role_items(company_id,owner_id,kind,title) values(current_setting('test.company')::uuid,current_setting('test.manager')::uuid,'workstream','Manager record');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin if exists(select 1 from public.role_items where owner_id<>auth.uid()) then raise exception 'Colleague leak';end if;end;$$;
reset role;
update public.profiles set active=false where id=current_setting('test.employee')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin
 if exists(select 1 from public.role_items) or exists(select 1 from public.decisions) then raise exception 'Inactive access';end if;
 begin insert into public.role_items(company_id,owner_id,kind,title) values(current_setting('test.company')::uuid,auth.uid(),'responsibility','Inactive write');raise exception 'Inactive insertion';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role anon;
do $$begin begin perform 1 from public.role_items;raise exception 'Anonymous access';exception when insufficient_privilege then null;end;end;$$;
reset role;
rollback;
select 'Role records: five categories, decisions, archive/restore, ownership, audit, department/company isolation, inactive and anonymous restrictions passed' result;
