-- Run after team-fixtures.sql and 20261028100000_cover_duties_lifecycle.sql.
-- The suite is designed for an isolated test database; all fixture data is rolled back.
begin;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$
declare
  role_id uuid;
  handover_id uuid:=gen_random_uuid();
  task_one uuid:=gen_random_uuid();
  task_two uuid:=gen_random_uuid();
  payload jsonb;
begin
  role_id:=(public.role_workspace('get')->'role'->>'id')::uuid;
  perform set_config('test.cover_handover',handover_id::text,true);
  perform set_config('test.cover_role',role_id::text,true);
  perform set_config('test.cover_task_one',task_one::text,true);
  perform set_config('test.cover_task_two',task_two::text,true);

  perform public.myday_action(task_one,'create',jsonb_build_object('title','Reply to the client','details','Approved task shared for cover','due_date',current_date));
  perform public.myday_action(task_two,'create',jsonb_build_object('title','Update the agenda','details','Second task shared for cover','due_date',current_date+1));
  perform public.handover_workspace('save',handover_id,jsonb_build_object(
    'title','Cover duties lifecycle test','owner_id',auth.uid(),'role_id',role_id,
    'handover_type','leave','starts_on',current_date,'ends_on',current_date+2,
    'cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),
    'sections',jsonb_build_object('priorities','1. Reply to the client'||E'\n'||'2. Update the agenda','contacts','Client contact: test only'),
    'note_for_manager','STRICTLY FOR THE MANAGER',
    'inclusions','["contacts","decisions"]'::jsonb,
    'items',jsonb_build_array(jsonb_build_object('id',task_one,'kind','task'),jsonb_build_object('id',task_two,'kind','task'))
  ));
  perform public.handover_workspace('submit',handover_id);
end$$;

-- Manager approval creates the request/approval state; no private manager note reaches the cover.
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
select public.handover_workspace('approve',current_setting('test.cover_handover')::uuid);

select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$
declare
  h uuid:=current_setting('test.cover_handover')::uuid;
  j jsonb;
begin
  j:=public.cover_duties_action('get',h,'{}'::jsonb);
  if j->>'full_access'<>'true' then raise exception 'Approved cover did not receive the configured briefing'; end if;
  if j::text like '%STRICTLY FOR THE MANAGER%' then raise exception 'Manager-only note leaked to the cover'; end if;
  if jsonb_array_length(j->'tasks')<>2 then raise exception 'Briefing did not include the two selected tasks'; end if;
  if j->'handover'->>'task_count'<>'2' then raise exception 'Task count does not match selected shared tasks'; end if;

  j:=public.cover_duties_action('accept',h,'{}'::jsonb);
  if j->'handover'->>'cover_response'<>'accepted' then raise exception 'Cover acceptance did not persist'; end if;
  if (select count(*) from public.actions where id in(current_setting('test.cover_task_one')::uuid,current_setting('test.cover_task_two')::uuid) and owner_id=current_setting('test.employee')::uuid)<>2 then
    raise exception 'Cover created duplicate tasks or changed ownership';
  end if;

  perform public.cover_duties_action('task_done',h,jsonb_build_object('task_id',current_setting('test.cover_task_one'),'outcome_note','Client replied; next step confirmed'));
  if (select status from public.actions where id=current_setting('test.cover_task_one')::uuid)<>'done' then raise exception 'Cover task completion did not update the shared task row'; end if;
  if (select owner_id from public.actions where id=current_setting('test.cover_task_one')::uuid)<>current_setting('test.employee')::uuid then
    raise exception 'Task ownership changed when the cover completed it';
  end if;
  begin
    perform public.myday_action(current_setting('test.cover_task_two')::uuid,'delete','{}'::jsonb);
    raise exception 'Cover was able to delete an owner task';
  exception when insufficient_privilege then null;
  end;
  if (select completed_by from private.handover_items where handover_id=h and record_id=current_setting('test.cover_task_one')::uuid)<>auth.uid() then
    raise exception 'Cover completion audit actor was not recorded';
  end if;

  perform public.cover_duties_action('hand_back',h,jsonb_build_object('task_id',current_setting('test.cover_task_two'),'reason','The client needs an owner-level decision.'));
  if not exists(select 1 from private.handover_task_handbacks where handover_id=h and task_id=current_setting('test.cover_task_two')::uuid and status='pending' and cover_id=auth.uid()) then
    raise exception 'Hand-back reason and actor were not recorded';
  end if;
  if exists(select 1 from jsonb_array_elements(private.myday_cover_tasks()) task where task->>'id'=current_setting('test.cover_task_two')) then
    raise exception 'Task awaiting a hand-back decision still appears in Covering for';
  end if;
  if exists(select 1 from public.activity_log where record_type='task' and record_id=current_setting('test.cover_task_two')::uuid and action in('deleted','delete')) then
    raise exception 'Cover was able to delete the handed-back task';
  end if;
end$$;

select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$
declare h uuid:=current_setting('test.cover_handover')::uuid; handback uuid;
begin
  select id into handback from private.handover_task_handbacks where handover_id=h and task_id=current_setting('test.cover_task_two')::uuid and status='pending';
  perform public.cover_duties_action('resolve_handback',h,jsonb_build_object('handback_id',handback,'decision','return'));
  if not exists(select 1 from private.handover_task_handbacks where id=handback and status='returned' and resolved_by=auth.uid()) then
    raise exception 'Owner could not resolve and audit a hand-back';
  end if;
  if exists(select 1 from jsonb_array_elements(private.myday_cover_tasks()) task where task->>'id'=current_setting('test.cover_task_two')) then
    raise exception 'Returned task still appears in Covering for';
  end if;
end$$;

-- Declining requires a reason and notifies both the owner and manager.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$
declare
  h uuid:=gen_random_uuid();
  t uuid:=gen_random_uuid();
  role_id uuid:=(public.role_workspace('get')->'role'->>'id')::uuid;
begin
  perform public.myday_action(t,'create',jsonb_build_object('title','Decline-request task','due_date',current_date));
  perform public.handover_workspace('save',h,jsonb_build_object(
    'title','Decline request test','owner_id',auth.uid(),'role_id',role_id,
    'handover_type','leave','starts_on',current_date+1,'ends_on',current_date+2,
    'cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),
    'sections',jsonb_build_object('priorities','Review the schedule'),
    'items',jsonb_build_array(jsonb_build_object('id',t,'kind','task'))
  ));
  perform public.handover_workspace('submit',h);
  perform set_config('test.cover_decline_handover',h::text,true);
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
select public.handover_workspace('approve',current_setting('test.cover_decline_handover')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$
declare h uuid:=current_setting('test.cover_decline_handover')::uuid;j jsonb;
begin
  begin
    perform public.cover_duties_action('decline',h,jsonb_build_object('reason',''));
    raise exception 'Cover request accepted a blank decline reason';
  exception when check_violation then null;
  end;
  j:=public.cover_duties_action('decline',h,jsonb_build_object('reason','Already covering another project','suggested_person_id',current_setting('test.manager')));
  if j->'handover'->>'cover_response'<>'declined' or j->'handover'->>'state'<>'cancelled' then raise exception 'Decline state was not recorded'; end if;
  if not exists(select 1 from private.handover_notifications where handover_id=h and owner_id=current_setting('test.employee')::uuid and message like '%declined the cover request%') then raise exception 'Owner was not notified of the decline'; end if;
  if not exists(select 1 from private.handover_notifications where handover_id=h and owner_id=current_setting('test.manager')::uuid and message like '%declined the cover request%') then raise exception 'Manager was not notified of the decline'; end if;
  if not exists(select 1 from private.handover_history where handover_id=h and operation='cover_declined' and actor_id=auth.uid()) then raise exception 'Decline audit event was not recorded'; end if;
end$$;

-- User availability is stored in one place, validated, and can be removed.
do $$
declare result jsonb; availability_id uuid;
begin
  result:=public.cover_duties_action('availability_save',null,jsonb_build_object('starts_on',current_date+5,'ends_on',current_date+8,'note','Available next week'));
  select id into availability_id from private.handover_cover_availability where person_id=auth.uid() and starts_on=current_date+5 and ends_on=current_date+8;
  if availability_id is null then raise exception 'Availability was not stored'; end if;
  begin
    perform public.cover_duties_action('availability_save',null,jsonb_build_object('starts_on',current_date+8,'ends_on',current_date+5));
    raise exception 'Invalid availability dates were accepted';
  exception when check_violation then null;
  end;
  perform public.cover_duties_action('availability_delete',availability_id,'{}'::jsonb);
  if exists(select 1 from private.handover_cover_availability where id=availability_id) then raise exception 'Availability could not be removed'; end if;
end$$;

rollback;
