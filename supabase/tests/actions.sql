-- Prepend team-fixtures.sql. Entire test is rolled back.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare d uuid;a uuid;t timestamptz;begin
 insert into public.decisions(company_id,owner_id,title,reason,decided_by,decided_on) values(current_setting('test.company')::uuid,auth.uid(),'Weekly report','Keep context','Team',current_date) returning id into d;
 insert into public.actions(company_id,owner_id,decision_id,title,due_date,source_url,created_at,completed_at)
 values(current_setting('test.company')::uuid,auth.uid(),d,'Send the report',current_date,'https://example.invalid/source','2000-01-01','2000-01-01') returning id into a;
 if not exists(select 1 from public.actions where id=a and status='open' and completed_at is null and created_at=now()) then raise exception 'Initial server timestamps';end if;
 perform set_config('test.action',a::text,true);perform set_config('test.decision',d::text,true);
 insert into public.actions(company_id,owner_id,title,due_date) values(current_setting('test.company')::uuid,auth.uid(),'Overdue task',current_date-1),(current_setting('test.company')::uuid,auth.uid(),'Future task',current_date+7);
 if (select count(*) from public.actions where due_date=current_date)<>1 or (select count(*) from public.actions where due_date<current_date and status<>'done')<>1 then raise exception 'Due scopes';end if;
 update public.actions set status='in_progress' where id=a;
 update public.actions set status='done',completion_note='Sent to Finance; reply expected Monday.' where id=a;
 select completed_at into t from public.actions where id=a;
 if t is null then raise exception 'Completion timestamp missing';end if;
 update public.actions set details='Checked the figures' where id=a;
 if not exists(select 1 from public.actions where id=a and completed_at=t and completion_note<>'') then raise exception 'Completion context lost';end if;
 begin update public.actions set completed_at='2000-01-01' where id=a;raise exception 'Timestamp forgery';exception when insufficient_privilege then null;end;
 begin update public.actions set owner_id=current_setting('test.manager')::uuid where id=a;raise exception 'Owner mutation';exception when insufficient_privilege then null;end;
 begin update public.actions set source_url='javascript:alert(1)' where id=a;raise exception 'Unsafe link';exception when check_violation then null;end;
 begin update public.actions set source_url='https://name:secret@example.invalid' where id=a;raise exception 'Credential link';exception when check_violation then null;end;
 begin insert into public.actions(company_id,owner_id,title,due_date) values(current_setting('test.company')::uuid,auth.uid(),'Missing date',null);raise exception 'Missing due date';exception when not_null_violation then null;end;
 begin insert into public.actions(company_id,owner_id,title,due_date) values(current_setting('test.company')::uuid,current_setting('test.manager')::uuid,'Forged owner',current_date);raise exception 'Other owner insert';exception when insufficient_privilege then null;end;
 begin delete from public.actions where id=a;raise exception 'Hard delete';exception when insufficient_privilege then null;end;
 update public.actions set deleted_at=now() where id=a;
 update public.actions set deleted_at=null where id=a;
 if not exists(select 1 from public.actions where id=a and status='done' and completed_at=t) then raise exception 'Archive restore changed completion';end if;
 update public.decisions set deleted_at=now() where id=d;
 update public.actions set details='Retained archived decision link' where id=a;
 begin insert into public.actions(company_id,owner_id,decision_id,title,due_date) values(current_setting('test.company')::uuid,auth.uid(),d,'New on archived decision',current_date);raise exception 'Archived decision link';exception when check_violation then null;end;
 perform public.log_action_view(auth.uid());
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare n int;begin
 if (select count(*) from public.actions)<>3 or not exists(select 1 from public.actions where status='done' and completion_note<>'') then raise exception 'Manager completed read';end if;
 update public.actions set title='Overwrite' where id=current_setting('test.action')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Manager write';end if;
 perform public.log_action_view(current_setting('test.employee')::uuid);
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare n int;begin
 if (select count(*) from public.actions)<>3 then raise exception 'HR read';end if;
 update public.actions set status='open' where id=current_setting('test.action')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'HR write';end if;
 if not exists(select 1 from public.activity_log where record_type='actions' and action='update') or not exists(select 1 from public.activity_log where record_type='action_list' and action='view') then raise exception 'Action audit missing';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$declare c uuid;begin
 select company_id into c from public.profiles where id=auth.uid();
 if exists(select 1 from public.actions) then raise exception 'Cross tenant leak';end if;
 begin perform public.log_action_view(current_setting('test.employee')::uuid);raise exception 'Cross tenant view audit';exception when insufficient_privilege then null;end;
 begin insert into public.actions(company_id,owner_id,decision_id,title,due_date) values(c,auth.uid(),current_setting('test.decision')::uuid,'Foreign decision',current_date);raise exception 'Cross tenant decision';exception when check_violation or foreign_key_violation then null;end;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
update public.actions set status='open' where id=current_setting('test.action')::uuid;
do $$begin if not exists(select 1 from public.actions where id=current_setting('test.action')::uuid and completed_at is null and completion_note<>'') then raise exception 'Reopen lost history';end if;end;$$;
reset role;
update public.profiles set department_id=null where id=current_setting('test.manager')::uuid;
insert into public.actions(company_id,owner_id,title,due_date) values(current_setting('test.company')::uuid,current_setting('test.manager')::uuid,'Manager own task',current_date);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin if exists(select 1 from public.actions where owner_id<>auth.uid()) then raise exception 'Colleague leak';end if;end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin if exists(select 1 from public.actions where owner_id<>auth.uid()) then raise exception 'Manager outside department';end if;end;$$;
reset role;
update public.profiles set active=false where id=current_setting('test.employee')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin
 if exists(select 1 from public.actions) then raise exception 'Inactive read';end if;
 begin insert into public.actions(company_id,owner_id,title,due_date) values(current_setting('test.company')::uuid,auth.uid(),'Inactive write',current_date);raise exception 'Inactive insert';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role anon;
do $$begin begin perform 1 from public.actions;raise exception 'Anonymous read';exception when insufficient_privilege then null;end;end;$$;
reset role;
rollback;
select 'Actions passed: due scopes, statuses, server completion times, notes, links, archive/restore, immutable ownership, two companies, department/role isolation, audit and inactive/anonymous restrictions' result;
