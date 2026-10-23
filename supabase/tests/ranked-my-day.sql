-- Prepend team-fixtures.sql. Everything rolls back. No real messages or provider calls.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select public.myday_preferences('{"timezone":"Africa/Lagos","reminder_time":"09:00","email_enabled":false}');
do $$declare d date:=(now() at time zone 'Africa/Lagos')::date;t uuid;v jsonb;role_id uuid;h uuid:=gen_random_uuid();begin
 perform public.myday_action(gen_random_uuid(),'create',jsonb_build_object('title','Yesterday','due_date',d-1,'details','PRIVATE task body','source_url','https://example.invalid/private'));
 perform public.myday_action(gen_random_uuid(),'create',jsonb_build_object('title','Today','due_date',d));
 t:=gen_random_uuid();perform public.myday_action(t,'create',jsonb_build_object('title','Progress next month','due_date',d+30));perform public.myday_action(t,'status','{"status":"in_progress"}');
 t:=gen_random_uuid();perform public.myday_action(t,'create',jsonb_build_object('title','Pinned next month','due_date',d+30));perform public.myday_action(t,'pin','{"pinned":true}');
 perform public.myday_action(gen_random_uuid(),'create',jsonb_build_object('title','Six days later','due_date',d+6));
 perform public.myday_action(gen_random_uuid(),'create',jsonb_build_object('title','Seven days later','due_date',d+7));
 t:=gen_random_uuid();perform public.myday_action(t,'create',jsonb_build_object('title','Finished today','due_date',d));perform public.myday_action(t,'status','{"status":"done"}');
 v:=public.myday_tasks('today','','',0);if (v->>'count')::integer<>4 then raise exception 'Today missed overdue/progress/pins or included Done: %',v->>'count';end if;
 if v->'rows'->0->>'title'<>'Pinned next month' then raise exception 'Pinned task is not first';end if;
 if (public.myday_tasks('week','','',0)->>'count')::integer<>2 then raise exception 'Rolling seven day range wrong';end if;
 if (public.myday_tasks('all','','',0)->>'count')::integer<>7 then raise exception 'All omits Done';end if;
 if (v->'tab_counts'->>'all')::integer<>7 then raise exception 'Counts disagree';end if;
 if jsonb_array_length(v->'done_today')<>1 then raise exception 'Done today missing';end if;
 perform public.myday_action(t,'archive','{}');perform public.myday_action(t,'restore','{}');
 if (select count(*) from public.task_status_history where task_id=t)<>4 then raise exception 'Archive/restore/status not logged';end if;
 if (public.myday_task_history(t)->0->>'status')<>'done' then raise exception 'Record history unavailable';end if;
 begin update public.task_status_history set status='open' where task_id=t;raise exception 'History editable';exception when insufficient_privilege then null;end;
 begin delete from public.task_status_history where task_id=t;raise exception 'History deletable';exception when insufficient_privilege then null;end;
 for i in 1..3 loop
  t:=gen_random_uuid();perform public.myday_action(t,'create',jsonb_build_object('title','Pin cap '||i,'due_date',d));
  if i<3 then perform public.myday_action(t,'pin','{"pinned":true}');else begin perform public.myday_action(t,'pin','{"pinned":true}');raise exception 'Fourth pin accepted';exception when invalid_parameter_value then null;end;end if;
 end loop;
 insert into public.role_items(company_id,owner_id,kind,title,details) values(current_setting('test.company')::uuid,auth.uid(),'workstream','Weekly reporting','Confirmed role context') returning id into role_id;
 t:=public.myday_role_task(role_id,d);if t<>public.myday_role_task(role_id,d) then raise exception 'My role duplicate';end if;
 if (public.myday_tasks('all','','',0,null,null,'role','normal')->>'count')::integer<>1 then raise exception 'Source/priority filters disagree';end if;
 if not exists(select 1 from public.actions where id=t and source_role_id=role_id and source_kind='role') then raise exception 'My role link missing';end if;
 perform set_config('test.role_task',t::text,true);
 perform set_config('test.role_item',role_id::text,true);
 perform set_config('test.handover',h::text,true);
 perform public.myday_handover(h,'save',jsonb_build_object('title','Operations cover','body','Review the supplier notes first.','cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),'starts_on',d,'ends_on',d+2));
 if jsonb_array_length(public.myday_handovers()->'rows')<>1 then raise exception 'Owner handover disappeared behind profile RLS';end if;
 if (public.myday_tasks('today','','',0)->'checklist'->>'cover')::boolean is not true then raise exception 'Cover checklist not linked';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare v jsonb;begin
 if exists(select 1 from public.actions where owner_id<>auth.uid()) then raise exception 'Direct task body leaked';end if;
 v:=public.team_member_tasks(current_setting('test.employee')::uuid,'open','',0);
 if jsonb_array_length(v->'rows')=0 or v::text like '%PRIVATE%' or v::text like '%source_url%' or v::text like '%details%' then raise exception 'Manager projection leaks private fields';end if;
 if exists(select 1 from public.task_status_history) then raise exception 'Private task history leaked';end if;
 if jsonb_array_length(public.myday_handovers()->'rows')<>0 then raise exception 'Unsubmitted draft leaked to reviewer';end if;
 begin perform public.myday_role_task(current_setting('test.role_item')::uuid,current_date);raise exception 'Manager pulled other role';exception when insufficient_privilege then null;end;
 begin perform public.myday_handover(current_setting('test.handover')::uuid,'approve');raise exception 'Unsubmitted approval accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select public.myday_handover(current_setting('test.handover')::uuid,'submit');
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$begin
 if jsonb_array_length(private.myday_cover_tasks())<>0 then raise exception 'Cover active before approval';end if;
 begin perform public.myday_handover(current_setting('test.handover')::uuid,'approve');raise exception 'Undesignated approver allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin if jsonb_array_length(public.myday_tasks('today','','',0)->'handovers_waiting')<>1 then raise exception 'Waiting handover missing';end if;end $$;
select public.myday_handover(current_setting('test.handover')::uuid,'approve');
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare v jsonb;begin if jsonb_array_length(public.myday_handovers()->'rows')<>1 then raise exception 'Cover participant handover missing';end if;
 v:=private.myday_cover_tasks();if jsonb_array_length(v)=0 or v::text like '%PRIVATE%' or v::text like '%source_url%' then raise exception 'Approved cover projection failed';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select public.myday_handover(current_setting('test.handover')::uuid,'cancel');
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$begin if jsonb_array_length(private.myday_cover_tasks())<>0 then raise exception 'Cancelled cover still active';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin
 begin perform public.team_member_tasks(current_setting('test.employee')::uuid,'open','',0);raise exception 'Cross company projection';exception when insufficient_privilege then null;end;
 if jsonb_array_length(public.myday_handovers()->'rows')<>0 then raise exception 'Cross company handover leaked';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare t uuid:=gen_random_uuid();begin
 perform public.myday_action(t,'create',jsonb_build_object('title',repeat('Long task ',25),'due_date',current_date));
 perform public.myday_action(t,'status','{"status":"done"}');
 perform public.myday_action(t,'context',jsonb_build_object('kind','note','title',repeat('Long task ',25),'details','Completed.'));
 if not exists(select 1 from public.actions where id=t and context_added_at is not null and completion_note='Completed.') then raise exception 'Long task outcome failed';end if;
end $$;
rollback;
select 'Ranked My day, counts, three pin cap, My role deduplication, status history, manager projection and approved/cancelled cover passed' result;
