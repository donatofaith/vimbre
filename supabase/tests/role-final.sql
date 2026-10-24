-- Prepend team-fixtures.sql; rollback only.
do $$declare rid uuid; d uuid; replacement uuid; i uuid; contact uuid; j jsonb;begin
 j:=public.role_workspace('get');rid:=(j->'role'->>'id')::uuid;perform set_config('test.role',rid::text,true);
 if (j->>'own')::boolean is not true then raise exception 'Holder not recognised';end if;
 -- Capture is bound before drafting, and confirmed decisions retain the selected role.
 perform set_config('test.role_capture',gen_random_uuid()::text,true);
 perform set_config('test.role_capture_item',gen_random_uuid()::text,true);
 perform public.capture_change('create',current_setting('test.role_capture')::uuid,null,'{"source_text":"Use quarterly reviews","source_type":"note","source_date":"2026-10-23"}');
 perform public.role_workspace('bind_capture',rid,jsonb_build_object('capture',current_setting('test.role_capture')));
 perform public.capture_change('add',current_setting('test.role_capture_item')::uuid,current_setting('test.role_capture')::uuid,'{"kind":"decision","title":"Capture decision","reason":"Test","decided_by":"Owner","decided_on":"2026-10-23"}');
 perform public.capture_change('confirm',current_setting('test.role_capture_item')::uuid,current_setting('test.role_capture')::uuid,'{"version":1}');
 if not exists(select 1 from public.decisions where capture_id=current_setting('test.role_capture')::uuid and role_id=rid) then raise exception 'Capture lost role';end if;
 begin perform public.role_workspace('bind_capture',rid,jsonb_build_object('capture',current_setting('test.role_capture')));raise exception 'Confirmed capture rebound';exception when insufficient_privilege then null;end;

 j:=public.role_workspace('save',rid,'{"kind":"responsibility","title":"Monthly supplier review","fields":{"details":"Prepare report","recurrence":"Monthly","tools":"Portal","steps":"Check, then report"}}');i:=(j->>'id')::uuid;perform set_config('test.item',i::text,true);
 j:=public.role_workspace('save',rid,'{"kind":"decision","title":"Monthly reviews","fields":{"reason":"Reduce meeting load","decided_by":"Owner","decided_on":"2026-10-23","applies_to":"Whole role"}}');d:=(j->>'id')::uuid;perform set_config('test.decision',d::text,true);
 j:=public.role_workspace('replace',rid,jsonb_build_object('id',d,'kind','decision','title','Quarterly reviews','fields',jsonb_build_object('reason','Stable supplier','decided_by','Owner','decided_on','2026-10-23')));replacement:=(j->>'id')::uuid;
 if not exists(select 1 from public.decisions where id=d and status='replaced' and replaced_by_id=replacement) or not exists(select 1 from public.decisions where id=replacement and replaces_id=d) then raise exception 'Broken replacement chain';end if;
 begin perform public.role_workspace('replace',rid,jsonb_build_object('id',d,'kind','decision','title','Duplicate','fields','{}'::jsonb));raise exception 'Double replacement accepted';exception when check_violation then null;end;
 perform public.role_workspace('notes',rid,'{"body":"Private holder notes"}');
 j:=public.role_workspace('save',rid,'{"kind":"external_contact","title":"Supplier","fields":{"contact_details":"supplier@example.invalid","contact_context":"Fast delivery","last_contacted":"2026-10-23"}}');contact:=(j->>'id')::uuid;perform set_config('test.contact',contact::text,true);
 j:=public.role_workspace('save',rid,'{"kind":"recurring_deadline","title":"One off filing","fields":{"due_date":"2026-10-25","recurrence":"Once","details":"Submit report"}}');perform set_config('test.deadline',j->>'id',true);
 j:=public.role_workspace('handover',rid);if j->>'body' not like '%Private holder notes%' or j->>'body' not like '%supplier@example.invalid%' then raise exception 'Handover omitted context';end if;
 begin perform public.role_workspace('reassign',rid,jsonb_build_object('holder',current_setting('test.employee')));raise exception 'Disabled reassignment accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.role_profiles set department_id=current_setting('test.department')::uuid,manager_id=current_setting('test.manager')::uuid where id=current_setting('test.role')::uuid;
insert into private.role_features(company_id,manager_review,reassignment,readiness,recurring) values(current_setting('test.company')::uuid,true,true,true,true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare r uuid:=current_setting('test.role')::uuid;j jsonb;begin
 j:=public.role_workspace('get',r);if (j->>'own')::boolean then raise exception 'Manager is holder';end if;
 if j->>'notes'<>'' then raise exception 'Private notes exposed';end if;
 begin perform public.role_workspace('save',r,'{"kind":"responsibility","title":"Unauthorised write","fields":{}}');raise exception 'Manager wrote directly';exception when insufficient_privilege then null;end;
 j:=public.role_workspace('suggest',r,jsonb_build_object('target_id',current_setting('test.item'),'target_kind','responsibility','body','Suggested report details'));perform set_config('test.proposal',j->>'id',true);
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare j jsonb;r uuid:=current_setting('test.role')::uuid;begin
 perform public.role_workspace('resolve',r,jsonb_build_object('id',current_setting('test.proposal'),'status','accepted'));
 if not exists(select 1 from public.role_items where id=current_setting('test.item')::uuid and details='Suggested report details') then raise exception 'Acceptance did not apply suggestion';end if;
 perform public.role_workspace('review_area',r,'{"area":"document","empty":true}');
 perform public.role_workspace('recurring',r,jsonb_build_object('id',current_setting('test.item'),'fields',jsonb_build_object('due_date','2026-10-25','recurrence','Monthly')));
 perform public.role_workspace('reassign',r,jsonb_build_object('holder',current_setting('test.employee')));
 if exists(select 1 from public.role_items where id=current_setting('test.contact')::uuid) then raise exception 'Prior holder still reads external contact';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare j jsonb;r uuid:=current_setting('test.role')::uuid;begin
 j:=public.role_workspace('get',r);if not (j->>'own')::boolean or jsonb_array_length(j->'decisions')<>3 then raise exception 'Role inheritance lost knowledge';end if;
 if j->>'notes'<>'' then raise exception 'Notes moved to new holder';end if;
 j:=public.role_workspace('own_records');if jsonb_array_length(j->'items')<3 then raise exception 'Inherited confirmed context missing';end if;
 perform public.myday_role_task(current_setting('test.item')::uuid,'2026-10-25');
 j:=public.role_workspace('handover',r);if j->>'body' like '%Private holder notes%' then raise exception 'Prior holder notes entered new handover';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin begin perform public.role_workspace('get',current_setting('test.role')::uuid);raise exception 'Cross company role exposed';exception when insufficient_privilege then null;end;end$$;
reset role;
select private.process_role_schedules('2026-10-25T12:00:00Z');
do $$begin
 if not exists(select 1 from public.actions where stable_role_item_id=current_setting('test.item')::uuid and owner_id=current_setting('test.employee')::uuid) then raise exception 'Schedule not assigned to current holder';end if;
 if exists(select 1 from public.actions where stable_role_item_id=current_setting('test.item')::uuid and owner_id=current_setting('test.admin')::uuid) then raise exception 'Schedule assigned to former holder';end if;
end$$;
select private.process_role_schedules('2026-10-25T12:00:00Z');
do $$begin if (select count(*) from public.actions where stable_role_item_id=current_setting('test.item')::uuid and owner_id=current_setting('test.employee')::uuid and due_date='2026-10-25')<>1 then raise exception 'Duplicate manual/scheduled task';end if;end$$;
select 'Role identity, replacements, privacy, suggestions, schedules and flag checks passed' result;
rollback;
