-- Prepend team-fixtures.sql in a rollback-only transaction; no AI provider is called.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select set_config('test.identity_capture',gen_random_uuid()::text,true);
select public.capture_change('create',current_setting('test.identity_capture')::uuid,null,'{"source_text":"Amara and Faith must each send a quote. Operations reviewed the supplier twice.","title":"Proposal identity","source_type":"note"}');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare u uuid:=current_setting('test.employee')::uuid;c uuid:=current_setting('test.identity_capture')::uuid;r uuid:=gen_random_uuid();hash text;v jsonb;begin
 select encode(extensions.digest(source_text,'sha256'),'hex') into hash from public.captures where id=c;
 perform public.capture_ai_claim(u,c,r,'capture_extract',repeat('a',64),hash,false);
 perform public.capture_ai_complete(u,r,'{"tasks":[],"decisions":[]}',jsonb_build_array(
 jsonb_build_object('kind','action','payload',jsonb_build_object('title','Send a quote','due_date','2026-10-30','source_owner','Amara')),
 jsonb_build_object('kind','action','payload',jsonb_build_object('title','Send a quote','due_date','2026-10-30','source_owner','Faith')),
 jsonb_build_object('kind','action','payload',jsonb_build_object('title','Send a quote','due_date','2026-10-30','source_owner','Amara')),
 jsonb_build_object('kind','decision','payload',jsonb_build_object('title','Keep the supplier','decided_on','2026-10-01','source_owner','Operations')),
 jsonb_build_object('kind','decision','payload',jsonb_build_object('title','Keep the supplier','decided_on','2026-10-26','source_owner','Operations'))));
 if (select count(*) from public.capture_items where capture_id=c and status='pending')<>4 then raise exception 'Different assignees or decision dates were merged, or a true duplicate remained';end if;
 if exists(select 1 from public.capture_items where capture_id=c and status='confirmed') or exists(select 1 from public.actions where capture_id=c) then raise exception 'Proposals were confirmed automatically';end if;
end $$;
select 'Proposal identity, true duplicate merging and private draft boundary passed' as result;
rollback;
