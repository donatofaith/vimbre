-- Run after team-fixtures.sql in a rollback-only transaction.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$
declare id uuid:=gen_random_uuid();again uuid;other uuid;result jsonb;
begin
 id:=(public.capture_workspace('create',id,jsonb_build_object('source_text','Please send the revised quote by Friday.','title','Quote','label','Client'))#>>'{}')::uuid;
 again:=(public.capture_workspace('create',gen_random_uuid(),jsonb_build_object('source_text','Please send the revised quote by Friday.','title','Repeated quote'))#>>'{}')::uuid;
 if id<>again then raise exception 'Paste duplicate was not reused';end if;
 result:=public.capture_workspace('list',null,'{"filter":"needs_review"}');
 if (result->>'count')::int<>1 or result->'rows'->0->>'title'<>'Quote' then raise exception 'History metadata incorrect';end if;
 perform public.capture_workspace('queue',null,jsonb_build_object('captures',jsonb_build_array(id)));
 perform public.capture_workspace('queue',null,jsonb_build_object('captures',jsonb_build_array(id)));
 if jsonb_array_length(public.capture_workspace('jobs'))<>1 then raise exception 'Queue retry duplicated';end if;
 begin perform public.capture_workspace('allowed_tools',null,'{"allowed":[]}');raise exception 'Employee changed company tools';exception when insufficient_privilege then null;end;
 begin perform public.capture_automation('claim');raise exception 'User claimed scheduler jobs';exception when insufficient_privilege then null;end;
 begin perform public.capture_search_service(auth.uid(),'policy');raise exception 'User accessed search service';exception when insufficient_privilege then null;end;
 perform set_config('test.capture_final',id::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin
 if(public.capture_workspace('list',null,'{}')->>'count')::int<>0 then raise exception 'Manager read private Capture history';end if;
 begin perform public.capture_workspace('queue',null,jsonb_build_object('captures',jsonb_build_array(current_setting('test.capture_final'))));raise exception 'Manager queued employee source';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin
 if(public.capture_workspace('list',null,'{}')->>'count')::int<>0 then raise exception 'Cross-company Capture history leak';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$declare r jsonb;begin
 r:=public.capture_automation('claim');if jsonb_array_length(r)<>1 then raise exception 'Queue claim incorrect';end if;
 if jsonb_array_length(public.capture_automation('claim'))<>0 then raise exception 'Claim was replayed';end if;
 perform public.capture_automation('finish',(r->0->>'id')::uuid,'{"state":"success"}');
end $$;
reset role;
rollback;
