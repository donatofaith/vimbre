begin;
create temp table wn_ids(label text primary key,id uuid not null);
insert into wn_ids select label,gen_random_uuid() from unnest(array['alice','bob','outside']) label;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select id,label||'-'||id||'@example.invalid',now(),jsonb_build_object('full_name',label,'company_name','Notification test '||label) from wn_ids;
update public.profiles set company_id=(select company_id from public.profiles where id=(select id from wn_ids where label='alice')),role='employee' where id=(select id from wn_ids where label='bob');
insert into public.actions(owner_id,company_id,title,due_date,status,completed_at,deleted_at)
select p.id,p.company_id,entry.title,(now() at time zone 'UTC')::date+entry.days,entry.status,case when entry.status='done' then now() end,case when entry.archived then now() end
from public.profiles p cross join (values('Today task',0,'open',false),('Tomorrow task',1,'open',false),('Boundary three days',3,'open',false),('Too far away',4,'open',false),('Overdue task',-1,'open',false),('Completed task',0,'done',false),('Archived task',0,'open',true)) entry(title,days,status,archived)
where p.id=(select id from wn_ids where label='alice');
insert into public.role_items(owner_id,company_id,kind,title,due_date,recurrence)
select p.id,p.company_id,entry.kind,entry.title,case when entry.days is not null then (now() at time zone 'UTC')::date+entry.days end,entry.recurrence
from public.profiles p cross join (values('responsibility','Dated responsibility',0,null),('responsibility','Undated responsibility',null,null),('recurring_deadline','Monthly report',1,'Every month')) entry(kind,title,days,recurrence)
where p.id=(select id from wn_ids where label='alice');
create temp table wn_results(test text);
grant select on wn_ids to authenticated;
grant select,insert on wn_results to authenticated;
create function pg_temp.wn_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception 'FAILED: %',label;end if;insert into wn_results values(label);end$$;
create function pg_temp.wn_denied(q text,label text) returns void language plpgsql as $$declare blocked boolean:=false;begin begin execute q;exception when others then blocked:=true;end;perform pg_temp.wn_assert(blocked,label);end$$;
select set_config('request.jwt.claim.sub',(select id::text from wn_ids where label='alice'),true);
set local role authenticated;
select pg_temp.wn_assert((public.work_notification_inbox('UTC',0)->>'count')::int=6,'only dated active unfinished items in three-day window');
select pg_temp.wn_assert((public.work_notification_inbox('UTC',0)->>'unread')::int=6,'initial reminders unread');
select pg_temp.wn_assert((select item->>'stage' from jsonb_array_elements(public.work_notification_inbox('UTC',0)->'items') item where item->>'title'='Today task')='today','today classification');
select pg_temp.wn_assert((select item->>'stage' from jsonb_array_elements(public.work_notification_inbox('UTC',0)->'items') item where item->>'title'='Overdue task')='overdue','overdue classification');
select pg_temp.wn_assert((select item->>'stage' from jsonb_array_elements(public.work_notification_inbox('UTC',0)->'items') item where item->>'title'='Boundary three days')='approaching','three-day boundary included');
select pg_temp.wn_assert((select item->>'stage' from jsonb_array_elements(public.work_notification_inbox('America/Los_Angeles',0)->'items') item where item->>'title'='Today task')=case when (now() at time zone 'America/Los_Angeles')::date<(now() at time zone 'UTC')::date then 'approaching' else 'today' end,'classification uses supplied local timezone');
select pg_temp.wn_assert(public.work_notification_read((select item->>'notification_key' from jsonb_array_elements(public.work_notification_inbox('UTC',0)->'items') item where item->>'title'='Today task'),'UTC'),'owner can mark reminder read');
select pg_temp.wn_assert((public.work_notification_inbox('UTC',0)->>'unread')::int=5,'read receipt persists on next request');
select pg_temp.wn_assert(public.work_notification_read((select item->>'notification_key' from jsonb_array_elements(public.work_notification_inbox('UTC',0)->'items') item where item->>'title'='Today task'),'UTC'),'read marking idempotent');
select pg_temp.wn_assert((select count(*) from public.work_notification_reads)=1,'read marking does not create duplicates');
select pg_temp.wn_denied('select public.work_notification_inbox(''bad/timezone'',0)','invalid timezone rejected');
select pg_temp.wn_denied('select public.work_notification_inbox(''UTC'',-1)','negative page rejected');
select pg_temp.wn_denied('insert into public.work_notification_reads values(auth.uid(),''forged'',now())','direct receipt writes denied');
select pg_temp.wn_assert(not public.work_notification_read('forged','UTC'),'forged reminder key cannot be marked');
select set_config('request.jwt.claim.sub',(select id::text from wn_ids where label='bob'),true);
select pg_temp.wn_assert((public.work_notification_inbox('UTC',0)->>'count')::int=0,'same-company teammate cannot see owner reminders');
select pg_temp.wn_assert((select count(*) from public.work_notification_reads)=0,'teammate cannot read owner receipts');
select set_config('request.jwt.claim.sub',(select id::text from wn_ids where label='outside'),true);
select pg_temp.wn_assert((public.work_notification_inbox('UTC',0)->>'count')::int=0,'other company cannot see reminders');
reset role;
-- Due date changes produce new reminder identity without reusing old read state.
update public.actions set due_date=due_date+1 where owner_id=(select id from wn_ids where label='alice') and title='Today task';
select set_config('request.jwt.claim.sub',(select id::text from wn_ids where label='alice'),true);
set local role authenticated;
select pg_temp.wn_assert((public.work_notification_inbox('UTC',0)->>'unread')::int=6,'rescheduled due date produces a fresh unread reminder');
reset role;
update public.actions set status='done',completed_at=now() where owner_id=(select id from wn_ids where label='alice') and title='Tomorrow task';
update public.role_items set deleted_at=now() where owner_id=(select id from wn_ids where label='alice') and title='Monthly report';
set local role authenticated;
select pg_temp.wn_assert((public.work_notification_inbox('UTC',0)->>'count')::int=4,'completion and archive remove reminders');
reset role;
update public.profiles set active=false where id=(select id from wn_ids where label='alice');
set local role authenticated;
select pg_temp.wn_denied('select public.work_notification_inbox(''UTC'',0)','inactive accounts denied');
select pg_temp.wn_assert((select count(*) from public.work_notification_reads)=0,'inactive accounts cannot read receipts');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin begin perform public.work_notification_inbox('UTC',0);raise exception 'FAILED: anonymous access';exception when insufficient_privilege then null;end;end$$;
reset role;
select * from wn_results;
rollback;
