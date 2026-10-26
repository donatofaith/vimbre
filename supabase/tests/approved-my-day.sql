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
 perform set_config('test.task',t::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin
 if exists(select 1 from public.actions where owner_id<>auth.uid()) then raise exception 'Private tasks leaked';end if;
 begin perform public.myday_action(current_setting('test.task')::uuid,'archive','{}');raise exception 'Manager deleted employee task';exception when insufficient_privilege then null;end;
 begin perform public.myday_action(current_setting('test.task')::uuid,'undo','{}');raise exception 'Manager undid employee task';exception when insufficient_privilege then null;end;
 begin perform private.myday_action_legacy(current_setting('test.task')::uuid,'archive','{}');raise exception 'Legacy writer exposed';exception when insufficient_privilege then null;end;
end $$;
rollback;
