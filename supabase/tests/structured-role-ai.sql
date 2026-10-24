-- Run after team-fixtures.sql, which begins the rollback transaction.
reset role;
do $$
declare n integer; address_id uuid; result jsonb;
begin
 select count(*) into n from public.ai_task_routes where task in ('role_responsibility','role_workstream','role_external_contact','role_document','role_recurring_deadline','role_decision','tasks_extract');
 if n<>7 then raise exception 'Missing structured routes'; end if;
 if has_function_privilege('authenticated','public.capture_receive(text,text,text,text,text)','execute') or has_function_privilege('anon','public.capture_receive(text,text,text,text,text)','execute') then raise exception 'Customer can receive inbound mail'; end if;
 if has_table_privilege('authenticated','private.capture_inbound_receipts','select') then raise exception 'Customer can read receipts'; end if;
 insert into public.capture_forwarding_addresses(company_id,owner_id,address,enabled,verified_at) values(current_setting('test.company')::uuid,current_setting('test.employee')::uuid,'test-private@capture.example.invalid',true,now()) returning id into address_id;
 result:=public.capture_receive('test-private@capture.example.invalid','team-admin-a@example.invalid',repeat('a',64),'Supplier review','Private original email');
 if (result->>'accepted')::boolean then raise exception 'Another sender accepted'; end if;
 result:=public.capture_receive('test-private@capture.example.invalid','team-employee@example.invalid',repeat('a',64),'Supplier review','Private original email');
 if not (result->>'accepted')::boolean then raise exception 'Valid message rejected'; end if;
 result:=public.capture_receive('test-private@capture.example.invalid','team-employee@example.invalid',repeat('a',64),'Supplier review','Private original email');
 if not (result->>'duplicate')::boolean then raise exception 'Retry not idempotent'; end if;
 select count(*) into n from public.captures where owner_id=current_setting('test.employee')::uuid and title='Supplier review';
 if n<>1 then raise exception 'Duplicate capture created'; end if;
 update public.capture_forwarding_addresses set enabled=false where id=address_id;
 result:=public.capture_receive('test-private@capture.example.invalid','team-employee@example.invalid',repeat('b',64),'Supplier review','Disabled mailbox');
 if (result->>'accepted')::boolean then raise exception 'Disabled mailbox accepted'; end if;
 update public.capture_forwarding_addresses set enabled=true where id=address_id;
 update public.profiles set active=false where id=current_setting('test.employee')::uuid;
 result:=public.capture_receive('test-private@capture.example.invalid','team-employee@example.invalid',repeat('c',64),'Supplier review','Inactive person');
 if (result->>'accepted')::boolean then raise exception 'Inactive person accepted'; end if;
 update public.profiles set active=true where id=current_setting('test.employee')::uuid;
 insert into private.capture_inbound_receipts(address_id,message_hash,capture_id)
 select address_id,encode(sha256(convert_to(seq.value::text,'UTF8')),'hex'),(select id from public.captures where owner_id=current_setting('test.employee')::uuid and title='Supplier review' limit 1)
 from generate_series(1,99) as seq(value);
 result:=public.capture_receive('test-private@capture.example.invalid','team-employee@example.invalid',repeat('d',64),'One too many','Should not be stored');
 if not (result->>'limited')::boolean then raise exception 'Daily inbound cap not enforced'; end if;

end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$ begin
 if exists(select 1 from public.captures where title='Supplier review') then raise exception 'Manager can read private forwarded email'; end if;
end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$ begin
 if not exists(select 1 from public.captures where title='Supplier review') then raise exception 'Owner cannot read forwarded email'; end if;
 if exists(select 1 from public.capture_items where capture_id in (select id from public.captures where title='Supplier review')) then raise exception 'Forwarding bypassed draft review'; end if;
end; $$;
rollback;
