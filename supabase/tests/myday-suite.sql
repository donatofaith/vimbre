-- Prepend team-fixtures.sql after the proposed suite schema, inside one rollback-only transaction.
reset role;
update public.departments set manager_id=current_setting('test.manager')::uuid where id=current_setting('test.department')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare template uuid:=gen_random_uuid();task uuid:=gen_random_uuid();comment uuid:=gen_random_uuid();a uuid:=gen_random_uuid();v jsonb;begin
 perform public.myday_suite('template_save',template,'{"title":"Month end","data":{"details":"PRIVATE owner details","steps":["Review totals","Send report"],"time_needed_minutes":30}}');
 perform public.myday_suite('template_use',template,jsonb_build_object('task_id',task,'due_date',current_date+1));
 if not exists(select 1 from public.actions where id=task and steps='["Review totals", "Send report"]'::jsonb and time_needed_minutes=30) then raise exception 'Template fields lost';end if;
 perform set_config('suite.task',task::text,true);perform set_config('suite.template',template::text,true);
 perform public.myday_suite('comment_save',task,jsonb_build_object('id',comment,'body','Shared comment','mentions',jsonb_build_array(current_setting('test.manager'))));
 perform set_config('suite.comment',comment::text,true);
 perform public.myday_suite('comment_save',task,jsonb_build_object('id',gen_random_uuid(),'body','PRIVATE note','private_note',true));
 begin perform public.myday_suite('assign',a,jsonb_build_object('recipient_id',current_setting('test.admin'),'title','Forbidden'));raise exception 'Employee assignment bypass';exception when insufficient_privilege then null;end;
 perform public.myday_suite('repeat',task,'{"frequency":"monthly"}');
 if not exists(select 1 from public.actions where id=task and repeat_rule->>'frequency'='monthly') then raise exception 'Repeat not stored';end if;
 v:=public.myday_suite('task_extra',task);if v->'repeat' is null or v->'repeat'='null'::jsonb then raise exception 'Repeat details missing';end if;
 v:=public.myday_suite('import',null,'{"fingerprint":"test","rows":[{"title":"CSV task","due_date":"","details":"CSV details","steps":"One\nTwo","links":"https://example.invalid"}]}');
 if(v->>'added')::int<>1 then raise exception 'CSV import failed: %',v;end if;
 v:=public.myday_suite('import',null,'{"fingerprint":"test","rows":[{"title":"CSV task","due_date":"","details":"CSV details"}]}');
 if(v->>'duplicates')::int<>1 then raise exception 'CSV duplicate not blocked';end if;
 perform public.myday_suite('preferences',null,'{"language":"en-US","date_style":"short","briefing":true,"digest":true,"quiet_start":"22:00","quiet_end":"08:00"}');
 v:=public.myday_suite('overview');if v->'settings'->>'language'<>'en-US' then raise exception 'Preferences not stored';end if;
 v:=public.myday_suite('calendar');if length(v->>'token')<>64 then raise exception 'Calendar token missing';end if;
 perform public.myday_suite('calendar',null,'{"revoke":true}');
 begin perform public.myday_suite('company',null,'{"team":false}');raise exception 'Employee company settings bypass';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare v jsonb;assignment uuid:=gen_random_uuid();begin
 v:=public.myday_suite('comments',current_setting('suite.task')::uuid);
 if v::text like '%PRIVATE%' or jsonb_array_length(v->'rows')<>1 then raise exception 'Comment scope leak: %',v;end if;
 begin perform public.myday_suite('comment_save',current_setting('suite.task')::uuid,jsonb_build_object('id',current_setting('suite.comment'),'body','Illegal edit'));raise exception 'Edited another author comment';exception when insufficient_privilege then null;end;
 begin perform public.myday_suite('task_extra',current_setting('suite.task')::uuid);raise exception 'Manager read private fields';exception when insufficient_privilege then null;end;
 v:=public.myday_suite('team');if jsonb_array_length(v)<>1 or v::text like '%PRIVATE%' then raise exception 'Direct reports projection wrong: %',v;end if;
 perform public.myday_suite('assign',assignment,jsonb_build_object('recipient_id',current_setting('test.employee'),'title','Assigned review','details','Explicitly shared note','due_date',current_date+2));perform set_config('suite.assignment',assignment::text,true);
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare task uuid;v jsonb;begin
 v:=public.myday_suite('overview');if jsonb_array_length(v->'incoming')<>1 then raise exception 'Assignment missing from review';end if;
 perform public.myday_suite('suggest_date',current_setting('suite.assignment')::uuid,jsonb_build_object('date',current_date+3));
 task:=(public.myday_suite('accept',current_setting('suite.assignment')::uuid)#>>'{}')::uuid;
 if task<>(public.myday_suite('accept',current_setting('suite.assignment')::uuid)#>>'{}')::uuid then raise exception 'Accept not idempotent';end if;
 if(select count(*) from public.actions where title='Assigned review' and owner_id=auth.uid())<>1 then raise exception 'Assignment duplicated';end if;
 perform public.myday_suite('hand_back',current_setting('suite.assignment')::uuid);
 v:=public.myday_suite('overview');if jsonb_array_length(v->'incoming')<>0 then raise exception 'Accepted assignment still in review';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin
 begin perform public.myday_suite('comments',current_setting('suite.task')::uuid);raise exception 'Cross-company comment leak';exception when insufficient_privilege then null;end;
 begin perform public.myday_suite('template_use',current_setting('suite.template')::uuid,jsonb_build_object('task_id',gen_random_uuid(),'due_date',current_date));raise exception 'Cross-company template leak';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$declare r private.myday_repeats;begin
 select * into r from private.myday_repeats where owner_id=current_setting('test.employee')::uuid and task_id=current_setting('suite.task')::uuid;
 perform private.myday_tick((r.next_date+time '12:00') at time zone 'Europe/London',r.owner_id);
 if not exists(select 1 from public.actions where id=r.current_task and missed_at is not null) then raise exception 'Open cycle not marked missed';end if;
 if(select count(*) from public.actions where owner_id=r.owner_id and missed_at is null and deleted_at is null and metadata->>'repeat_id'=r.id::text)<>1 then raise exception 'More than one active repeat instance';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare v jsonb;begin
 v:=public.myday_tasks('today','','',0);if exists(select 1 from jsonb_array_elements(v->'rows') r where r->>'missed_at' is not null) then raise exception 'Missed cycle still active';end if;
end$$;
rollback;
