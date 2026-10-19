-- Prepend team-fixtures.sql. All writes roll back, and no emails are sent.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare s uuid:=gen_random_uuid();d uuid:=gen_random_uuid();begin
 perform public.capture_change('create',s,null,jsonb_build_object('source_text','PRIVATE SOURCE SENTINEL','source_type','email','source_date',current_date));
 perform public.capture_change('add',d,s,'{"kind":"decision","title":"PRIVATE DRAFT SENTINEL"}');
 perform set_config('test.source',s::text,true);perform set_config('test.draft',d::text,true);
 insert into public.actions(company_id,owner_id,title,due_date,status) values
 (current_setting('test.company')::uuid,auth.uid(),'Confirmed overdue',current_date-14,'open'),
 (current_setting('test.company')::uuid,auth.uid(),'Completed this week',current_date,'done'),
 (current_setting('test.company')::uuid,auth.uid(),'Due today',current_date,'open');
 insert into public.role_items(company_id,owner_id,kind,title) values(current_setting('test.company')::uuid,auth.uid(),'responsibility','Confirmed role record');
 begin perform public.team_activity_overview();raise exception 'Employee overview access';exception when insufficient_privilege then null;end;
 begin perform public.company_active_member_count();raise exception 'Employee count access';exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare v jsonb;r jsonb;begin
 v:=public.team_activity_overview();
 if v->>'scope'<>'company' or v->>'total_active_count'<>'3' or v->>'count'<>'3' then raise exception 'HR scope/count incorrect: %',v;end if;
 select value into r from jsonb_array_elements(v->'rows') where value->>'id'=current_setting('test.employee');
 if r->>'tasks_done'<>'1' or r->>'tasks_overdue'<>'1' or r->>'drafts_waiting'<>'1' then raise exception 'Incorrect metrics %',r;end if;
 if v->'flags'->>'overdue_tasks'<>'1' or v->'flags'->>'people_without_role_record'<>'2' then raise exception 'Flags incorrect %',v;end if;
 if v->>'handovers_available'<>'false' or v->'flags'->>'handovers_not_started' is not null or r->>'handover_status' is not null then raise exception 'Invented handover status';end if;
 if v::text like '%PRIVATE%' or v::text like '%source_text%' or v::text like '%payload%' then raise exception 'Private content leaked';end if;
 if public.team_activity_overview('no matching name')->>'count'<>'0' then raise exception 'Search filtering';end if;
 if public.team_activity_overview('',1)->'rows'<>'[]'::jsonb then raise exception 'Pagination failed';end if;
 if public.team_activity_overview('',0,'Africa/Lagos')->>'today'<>(now() at time zone 'Africa/Lagos')::date::text then raise exception 'Timezone failed';end if;
 begin perform public.team_activity_overview('',-1);raise exception 'Invalid page accepted';exception when invalid_parameter_value then null;end;
 begin perform public.team_activity_overview('',0,'Bad/Timezone');raise exception 'Bad timezone accepted';exception when invalid_parameter_value then null;end;
 begin perform public.team_activity_overview('',0,'UTC',current_setting('test.other_admin')::uuid);raise exception 'Cross tenant member';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.captures where owner_id=current_setting('test.employee')::uuid) or exists(select 1 from public.capture_items where owner_id=current_setting('test.employee')::uuid) then raise exception 'HR private content access';end if;
 if public.capture_detail(current_setting('test.source')::uuid) is not null then raise exception 'HR source RPC access';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare v jsonb;begin
 v:=public.team_activity_overview();
 if v->>'scope'<>'department' or v->>'count'<>'2' or v->'flags'->>'people_without_role_record'<>'1' then raise exception 'Manager scope wrong %',v;end if;
 if exists(select 1 from jsonb_array_elements(v->'rows') r where r->>'id'=current_setting('test.admin')) then raise exception 'Manager outside department';end if;
 begin perform public.team_activity_overview('',0,'UTC',current_setting('test.admin')::uuid);raise exception 'Manager member bypass';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.capture_items where owner_id=current_setting('test.employee')::uuid) then raise exception 'Manager private drafts';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select public.capture_change('discard',current_setting('test.draft')::uuid,current_setting('test.source')::uuid,'{"version":1}');
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare r jsonb;begin
 select value into r from jsonb_array_elements(public.team_activity_overview()->'rows') where value->>'id'=current_setting('test.employee');
 if r->>'drafts_waiting'<>'0' then raise exception 'Discarded drafts counted';end if;
end;$$;
reset role;
update public.profiles set department_id=null where id=current_setting('test.manager')::uuid;
set local role authenticated;
do $$begin if public.team_activity_overview()->>'count'<>'0' then raise exception 'Unassigned manager scope';end if;end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin if public.team_activity_overview()->>'count'<>'1' then raise exception 'Other tenant scope';end if;end;$$;
reset role;
update public.profiles set active=false where id=current_setting('test.manager')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin begin perform public.team_activity_overview();raise exception 'Inactive access';exception when insufficient_privilege then null;end;end;$$;
set local role anon;
do $$begin begin perform public.team_activity_overview();raise exception 'Anonymous access';exception when insufficient_privilege then null;end;end;$$;
reset role;
select 'Team overview metrics, scope, timezone, navigation counts, and private source/draft isolation passed' as result;
rollback;
