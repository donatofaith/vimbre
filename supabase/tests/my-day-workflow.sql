-- Append to team-fixtures.sql and run in one transaction. No email or paid AI calls.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select public.myday_preferences('{"timezone":"Africa/Lagos","reminder_time":"10:00","email_enabled":false}');
select set_config('test.task',gen_random_uuid()::text,true);
select public.myday_action(current_setting('test.task')::uuid,'create',jsonb_build_object('title','Review supplier notes','due_date','2099-10-25','due_time','09:30','department_id',current_setting('test.department')));
do $$declare a public.actions;begin
 select * into a from public.actions where id=current_setting('test.task')::uuid;
 if a.due_at<>timestamptz '2099-10-25 08:30Z' or a.status<>'open' then raise exception 'Timezone or initial status failed';end if;
 if jsonb_array_length(public.myday_tasks('all','','',0,a.id,null)->'rows')<>1 then raise exception 'Deep link filtering failed';end if;
 begin update public.actions set reminder_sent_at=now() where id=a.id;raise exception 'Protected columns writable';exception when insufficient_privilege then null;end;
 begin perform public.myday_action(a.id,'snooze','{}');raise exception 'Null snooze accepted';exception when invalid_parameter_value then null;end;
end $$;
select public.myday_action(current_setting('test.task')::uuid,'status','{"status":"done"}');
select public.myday_action(current_setting('test.task')::uuid,'context','{"kind":"note","title":"Supplier review","details":"Shared the review notes with Operations."}');
select public.myday_action(current_setting('test.task')::uuid,'context','{"kind":"note","details":"This duplicate must not be saved."}');
do $$begin if (public.myday_notes(0)->>'count')::integer<>1 then raise exception 'Context idempotency failed';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin
 if (public.myday_notes(0)->>'count')::integer<>0 then raise exception 'Private notes leaked';end if;
 begin perform public.myday_action(current_setting('test.task')::uuid,'status','{"status":"open"}');raise exception 'Manager wrote personal task';exception when insufficient_privilege then null;end;
end $$;
-- Context must preserve existing Open work and retain a Decision outcome.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare t uuid:=gen_random_uuid();r uuid;d uuid;begin
 insert into public.role_items(owner_id,company_id,kind,title,details,next_step) values(auth.uid(),current_setting('test.company')::uuid,'workstream','Reporting','Existing notes','Existing next step') returning id into r;
 perform public.myday_action(t,'create','{"title":"Report sent","due_date":"2099-01-01"}');perform public.myday_action(t,'status','{"status":"done"}');
 perform public.myday_action(t,'context',jsonb_build_object('kind','workstream','record_id',r,'title','Report sent','details','Shared with Finance.','next_step',''));
 if not exists(select 1 from public.role_items where id=r and details like 'Existing notes%' and details like '%Shared with Finance.' and next_step='Existing next step') then raise exception 'Open work context was lost';end if;
 t:=gen_random_uuid();perform public.myday_action(t,'create','{"title":"Monthly reviews","due_date":"2099-01-01"}');perform public.myday_action(t,'status','{"status":"done"}');
 d:=public.myday_action(t,'context','{"kind":"decision","title":"Monthly reviews","details":"Shared notes with Operations.","reason":"Reduce meeting load.","next_step":""}');
 if d is distinct from (select context_record_id from public.actions where id=t) then raise exception 'Context response is inconsistent';end if;
 if not exists(select 1 from public.decisions where id=d and next_step='Shared notes with Operations.') then raise exception 'Decision outcome was lost';end if;
end $$;
reset role;
-- Enable only inside this rollback transaction; never call the HTTP dispatcher.
update private.task_delivery_config set enabled=true;
-- Simulate worker time on isolated fixtures. All changes roll back.
do $$declare u uuid:=current_setting('test.employee')::uuid;c uuid:=current_setting('test.company')::uuid;r uuid;a uuid;t timestamptz:=now();n integer;begin
 insert into public.role_items(owner_id,company_id,kind,title,details,recurrence,due_date) values(u,c,'recurring_deadline','Daily report','Share report','Daily',(t at time zone 'Africa/Lagos')::date) returning id into r;
 perform private.process_myday(t);perform private.process_myday(t);
 if (select count(*) from public.actions where recurring_id=r)<>1 then raise exception 'Recurring task duplicated';end if;
 insert into public.actions(owner_id,company_id,title,due_date,due_time) values(u,c,'Reminder test',(t at time zone 'Africa/Lagos')::date,'09:00') returning id into a;
 -- Set explicit test timestamps after creation; a real client cannot set these.
 update public.actions set due_at=t-interval '2 minutes',remind_at=t-interval '2 minutes' where id=a;
 perform private.process_myday(t);perform private.process_myday(t+interval '61 minutes');perform private.process_myday(t+interval '2 days');
 select count(*) into n from public.task_alerts where task_id=a;if n<>2 then raise exception 'Expected two alerts, got %',n;end if;
 if exists(select 1 from private.task_mail_queue q join public.task_alerts n on n.id=q.alert_id where n.task_id=a) then raise exception 'Email preference ignored';end if;
 if private.anchored_work_date('2027-02-28','Monthly','2027-01-31')<>date '2027-03-31' then raise exception 'Month end anchor lost';end if;
 if private.anchored_work_date('2026-10-23','Every weekday','2026-10-23')<>date '2026-10-26' then raise exception 'Weekday schedule failed';end if;
 if private.next_work_date('2026-10-02','First Friday of each month')<>date '2026-11-06' then raise exception 'Monthly date failed';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin if (public.myday_tasks('all','','',0)->>'count')::integer<>0 or jsonb_array_length(public.myday_alerts())<>0 then raise exception 'Cross company leak';end if;end $$;
rollback;
