-- Append after team-fixtures.sql; all records roll back and no provider is called.
select set_config('test.ai_capture',gen_random_uuid()::text,true);
select set_config('test.ai_draft',gen_random_uuid()::text,true);
select public.capture_change('create',current_setting('test.ai_capture')::uuid,null,'{"title":"AI test source","source_text":"Operations agreed monthly reviews.","source_type":"note","source_date":"2026-10-21"}');
select public.capture_change('add',current_setting('test.ai_draft')::uuid,current_setting('test.ai_capture')::uuid,'{"kind":"decision","title":"Monthly supplier reviews","reason":"Reduce meetings","decided_by":"Operations","decided_on":"2026-10-21","next_step":"Share notes","origin":"ai"}');
do $$ begin
 if not exists(select 1 from public.capture_items where id=current_setting('test.ai_draft')::uuid and origin='ai' and status='pending' and decision_id is null and payload->>'next_step'='Share notes') then raise exception 'Draft provenance or review boundary failed'; end if;
 if exists(select 1 from public.decisions where title='Monthly supplier reviews') then raise exception 'Unconfirmed AI record was saved'; end if;
end $$;
select public.capture_change('edit',current_setting('test.ai_draft')::uuid,current_setting('test.ai_capture')::uuid,'{"version":1,"kind":"decision","title":"Monthly supplier reviews","reason":"Reduce meetings","decided_by":"Operations","decided_on":"2026-10-21","next_step":"Share reviewed notes"}');
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$ begin
 begin
 perform public.capture_change('confirm',current_setting('test.ai_draft')::uuid,current_setting('test.ai_capture')::uuid,'{"version":2}');
 raise exception 'Another member accessed a private draft';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
select public.capture_change('confirm',current_setting('test.ai_draft')::uuid,current_setting('test.ai_capture')::uuid,'{"version":2}');
-- Repeating confirmation must not make another record.
select public.capture_change('confirm',current_setting('test.ai_draft')::uuid,current_setting('test.ai_capture')::uuid,'{"version":2}');
do $$ begin
 if (select count(*) from public.decisions where title='Monthly supplier reviews' and next_step='Share reviewed notes')<>1 then raise exception 'Confirmed decision lost next step or duplicated'; end if;
end $$;
rollback;
