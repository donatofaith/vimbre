-- Prepend team-fixtures.sql; fixtures and assertions are rolled back.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare s uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); v jsonb;begin
 v:=public.my_day_summary();
 if v->>'pending_drafts'<>'0' or v->'completed_sections'<>'[]'::jsonb or v->>'forwarding_address' is not null then raise exception 'Empty summary invented data'; end if;
 perform public.capture_change('create',s,null,jsonb_build_object('title','Summary fixture','source_text','Meeting fixture','source_type','meeting','source_date',current_date));
 perform public.capture_change('add',d,s,'{"kind":"decision","title":"Review fixture"}');
 perform public.capture_change('add',gen_random_uuid(),s,'{"kind":"contact","title":"Contact fixture"}');
 if public.my_day_summary()->>'pending_drafts'<>'2' then raise exception 'Pending count wrong'; end if;
 perform public.capture_change('discard',d,s,'{"version":1}');
 if public.my_day_summary()->>'pending_drafts'<>'1' then raise exception 'Discard counted'; end if;
 perform public.capture_change('archive',s,s,'{}');
 if public.my_day_summary()->>'pending_drafts'<>'0' then raise exception 'Archived source counted'; end if;
 perform public.capture_change('restore',s,s,'{}');
 insert into public.role_items(company_id,owner_id,kind,title) values
 (current_setting('test.company')::uuid,auth.uid(),'responsibility','First fixture'),
 (current_setting('test.company')::uuid,auth.uid(),'responsibility','Second fixture'),
 (current_setting('test.company')::uuid,auth.uid(),'workstream','Project fixture');
 insert into public.role_items(company_id,owner_id,kind,title,deleted_at) values(current_setting('test.company')::uuid,auth.uid(),'external_contact','Archived fixture',now());
 v:=public.my_day_summary();
 if jsonb_array_length(v->'completed_sections')<>2 or not(v->'completed_sections' ? 'responsibility') or not(v->'completed_sections' ? 'workstream') then raise exception 'Category progress must count distinct active categories'; end if;
 begin insert into public.capture_forwarding_addresses(company_id,owner_id,address) values(current_setting('test.company')::uuid,auth.uid(),'forged@example.invalid'); raise exception 'Client provisioned inbound address'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
insert into public.capture_forwarding_addresses(company_id,owner_id,address) values(current_setting('test.company')::uuid,current_setting('test.employee')::uuid,'verified-fixture@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin if public.my_day_summary()->>'forwarding_address' is not null then raise exception 'Unverified address shown'; end if;end;$$;
reset role;
update public.capture_forwarding_addresses set verified_at=now(),enabled=true where owner_id=current_setting('test.employee')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin if public.my_day_summary()->>'forwarding_address'<>'verified-fixture@example.invalid' then raise exception 'Verified address missing'; end if;end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare v jsonb;begin
 v:=public.my_day_summary();
 if v->>'pending_drafts'<>'0' or v->'completed_sections'<>'[]'::jsonb or v->>'forwarding_address' is not null then raise exception 'Manager summary leaked employee data'; end if;
 if exists(select 1 from public.capture_forwarding_addresses) then raise exception 'Manager address leak'; end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin if public.my_day_summary()->>'forwarding_address' is not null then raise exception 'Cross-company address leak'; end if;end;$$;
reset role;
update public.profiles set active=false where id=current_setting('test.employee')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin begin perform public.my_day_summary();raise exception 'Inactive summary';exception when insufficient_privilege then null;end;end;$$;
set local role anon;
do $$begin begin perform public.my_day_summary();raise exception 'Anonymous summary';exception when insufficient_privilege then null;end;end;$$;
reset role;
select 'My day summary counts, archived/discarded filtering, verified-address controls and tenant/owner/active isolation passed' as result;
rollback;
