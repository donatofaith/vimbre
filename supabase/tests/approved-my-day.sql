-- Prepend team-fixtures.sql inside the same rollback-only transaction.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select public.myday_preferences('{"timezone":"Africa/Lagos","reminder_time":"09:00","email_enabled":false}');
do $$declare d date:=(now() at time zone 'Africa/Lagos')::date; t uuid; v jsonb; w jsonb;begin
 perform public.myday_action(gen_random_uuid(),'create',jsonb_build_object('title','Overdue fixture','due_date',d-1));
 t:=gen_random_uuid();perform public.myday_action(t,'create',jsonb_build_object('title','Today fixture','due_date',d,'due_time','23:59'));
 perform public.myday_action(gen_random_uuid(),'create',jsonb_build_object('title','Upcoming fixture','due_date',d+3));
 v:=public.myday_tasks('today','','',0);
 if (v->>'count')::int<>jsonb_array_length(v->'rows') or (v->'tab_counts'->>'today')::int<>jsonb_array_length(v->'rows') or (v->'counts'->>'today')::int<>jsonb_array_length(v->'rows') then raise exception 'Today totals disagree: %',v;end if;
 if (v->'counts'->>'overdue')::int<>jsonb_array_length(v->'overdue_rows') then raise exception 'Overdue totals disagree';end if;
 if jsonb_array_length(v->'upcoming')<>1 then raise exception 'Coming up list wrong';end if;
 w:=public.myday_tasks('today','Upcoming','','0');
 if jsonb_array_length(w->'rows')<>0 or jsonb_array_length(w->'overdue_rows')<>0 or jsonb_array_length(w->'upcoming')<>1 then raise exception 'Secondary sections ignore search';end if;
 perform public.myday_action(t,'status','{"status":"done"}');
 v:=public.myday_tasks('done','','',0);if (v->>'count')::int<>1 or jsonb_array_length(v->'rows')<>1 then raise exception 'Done filter broken';end if;
 perform public.myday_action(t,'undo','{}');if (select status from public.actions where id=t)<>'open' then raise exception 'Done Undo broken';end if;
 perform public.myday_action(t,'archive','{}');perform public.myday_action(t,'undo','{}');if (select deleted_at from public.actions where id=t) is not null then raise exception 'Delete Undo broken';end if;
 for i in 1..4 loop
  t:=gen_random_uuid();perform public.myday_action(t,'create',jsonb_build_object('title','Star fixture '||i,'due_date',d+30));perform public.myday_action(t,'pin','{"pinned":true}');
 end loop;
 v:=public.myday_tasks('today','','',0);if (v->'counts'->>'today')::int<>5 then raise exception 'Star should have no three-pin limit';end if;
 perform public.myday_action(t,'edit',jsonb_build_object('title','Task details fixture','due_date',d+30,'time_needed_minutes',30,'steps',jsonb_build_array('Check numbers','Send report'),'links',jsonb_build_array('https://example.invalid/report'),'label','Reporting'));
 if not exists(select 1 from public.actions where id=t and time_needed_minutes=30 and jsonb_array_length(steps)=2 and label='Reporting') then raise exception 'Task planning fields not saved';end if;
 begin perform public.myday_action(t,'edit',jsonb_build_object('title','Invalid link','due_date',d+30,'links',jsonb_build_array('javascript:alert(1)')));raise exception 'Unsafe link accepted';exception when invalid_parameter_value then null;end;
 perform public.myday_action(gen_random_uuid(),'create','{"title":"Undated fixture","due_date":""}');
 v:=public.myday_tasks('today','Undated','','0');if jsonb_array_length(v->'upcoming')<>1 or v->'upcoming'->0->'due_date'<>'null'::jsonb then raise exception 'Undated task missing from Coming up';end if;
 perform set_config('test.task',t::text,true);
end $$;
do $$declare source uuid:=gen_random_uuid(); draft_id uuid:=gen_random_uuid(); duplicate_id uuid:=gen_random_uuid(); v jsonb;begin
 perform public.capture_change('create',source,null,jsonb_build_object('title','Gmail: My day review fixture','source_text',E'Gmail: Review notes\nSource: https://mail.google.com/mail/u/0/#inbox/example\n\nSupplier follow-up notes.','source_type','email','source_date',current_date));
 perform public.capture_change('add',draft_id,source,jsonb_build_object('kind','action','title','Accept review fixture','due_date',current_date+1));
 v:=public.myday_tasks('today','','',0);if (v->>'drafts_waiting')::int<>jsonb_array_length(v->'review_drafts') then raise exception 'Review count duplicates decisions';end if;
 perform public.myday_action(draft_id,'review_accept','{"version":1}');perform public.myday_action(draft_id,'review_accept','{"version":1}');
 if(select count(*) from public.actions where capture_id=source)<>1 then raise exception 'Review acceptance duplicated task';end if;
 perform public.capture_change('add',duplicate_id,source,jsonb_build_object('kind','action','title','Accept review fixture','due_date',current_date+1));
 begin perform public.myday_action(duplicate_id,'review_accept','{"version":1}');raise exception 'Duplicate review accepted';exception when invalid_parameter_value then null;end;
 perform public.myday_action(duplicate_id,'review_dismiss','{"version":1}');
 v:=public.myday_tasks('all','Accept review fixture','',0);if v->'rows'->0->>'source_name'<>'Gmail' or (v->'rows'->0->>'source_connected')::boolean is not false then raise exception 'Captured source metadata missing: %',v;end if;
 if(public.my_day_summary()->'task_counts'->>'today')::int<>(public.myday_tasks('today','','',0)->'counts'->>'today')::int then raise exception 'Sidebar count differs';end if;
end $$;
do $$begin
 if not exists(select 1 from public.task_events where owner_id=auth.uid() and event='done') then raise exception 'Done event not logged';end if;
 begin update public.task_events set event='updated' where owner_id=auth.uid();raise exception 'Audit editable';exception when insufficient_privilege then null;end;
 begin delete from public.task_events where owner_id=auth.uid();raise exception 'Audit removable';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin
 if exists(select 1 from public.task_events where owner_id<>auth.uid()) then raise exception 'Private events leaked';end if;
 if exists(select 1 from public.actions where owner_id<>auth.uid()) then raise exception 'Private tasks leaked';end if;
 begin perform public.myday_action(current_setting('test.task')::uuid,'archive','{}');raise exception 'Manager deleted employee task';exception when insufficient_privilege then null;end;
 begin perform public.myday_action(current_setting('test.task')::uuid,'undo','{}');raise exception 'Manager undid employee task';exception when insufficient_privilege then null;end;
 begin perform private.myday_action_legacy(current_setting('test.task')::uuid,'archive','{}');raise exception 'Legacy writer exposed';exception when insufficient_privilege then null;end;
end $$;
rollback;
