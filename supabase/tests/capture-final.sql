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
-- Selected-body proofs, cursor ownership, server deduplication and Watch caps.
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare u uuid:=current_setting('test.employee')::uuid;c uuid:=current_setting('test.company')::uuid;conn uuid;r jsonb;other uuid:=current_setting('test.other_admin')::uuid;begin
 perform public.capture_connection_service('store',u,jsonb_build_object('provider','gmail','company_id',c,'secret',jsonb_build_object('access_token','synthetic-capture-test')));
 select id into conn from private.capture_connections where user_id=u and provider='gmail';perform set_config('test.capture_conn',conn::text,true);
 r:=public.capture_search_service(u,'page_put',jsonb_build_object('connection',conn,'fingerprint','fixture-filter','cursor','','page',jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id','thread','reference','thread','kind','item','title','Quote')),'next','provider-page-token')));
 perform set_config('test.capture_cache',r->>'cache',true);
 if public.capture_search_service(u,'cursor',jsonb_build_object('connection',conn,'fingerprint','fixture-filter','token',r->>'cache'))#>>'{}'<>'provider-page-token' then raise exception 'Opaque cursor did not resolve';end if;
 begin perform public.capture_search_service(other,'selected_row',jsonb_build_object('connection',conn,'cache',r->>'cache','reference','thread'));raise exception 'Cross-account selected source leak';exception when insufficient_privilege then null;end;
 begin perform public.capture_search_service(u,'selected_row',jsonb_build_object('connection',conn,'cache',r->>'cache','reference','forged-thread'));raise exception 'Unlisted source body allowed';exception when insufficient_privilege then null;end;
 r:=public.capture_search_service(u,'preview_put',jsonb_build_object('connection',conn,'source',jsonb_build_object('title','Selected quote','text','Please review this selected quote.','date',current_date,'source_type','email','provider','gmail','reference','thread','source','message')));
 perform set_config('test.capture_preview',r->>'preview',true);
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$declare id uuid;again uuid;w uuid;begin
 id:=(public.capture_workspace('create',gen_random_uuid(),jsonb_build_object('preview',current_setting('test.capture_preview')))#>>'{}')::uuid;
 again:=(public.capture_workspace('create',gen_random_uuid(),jsonb_build_object('preview',current_setting('test.capture_preview')))#>>'{}')::uuid;
 if id<>again then raise exception 'Provider source reference and body dedup failed';end if;
 w:=(public.capture_workspace('watch_save',null,jsonb_build_object('connection',current_setting('test.capture_conn'),'place','Clients','filters','{"query":"quote"}'::jsonb,'frequency',60,'daily_cap',1))#>>'{}')::uuid;
 perform set_config('test.capture_watch',w::text,true);
 if jsonb_array_length(public.capture_workspace('watches'))<>1 then raise exception 'Watch not visible to owner';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare r jsonb;w uuid:=current_setting('test.capture_watch')::uuid;v_capture uuid;begin
 r:=public.capture_automation('watch_claim');if jsonb_array_length(r)<>1 then raise exception 'Watch claim failed';end if;
 if jsonb_array_length(public.capture_automation('watch_claim'))<>0 then raise exception 'Watch lease replayed';end if;
 r:=public.capture_automation('watch_context',w);if r is null then raise exception 'Fixture allowance unexpectedly unavailable';end if;
 v_capture:=(public.capture_automation('watch_source',w,jsonb_build_object('source',jsonb_build_object('title','Watch quote','text','Please approve the quote.','date',current_date,'source_type','email','provider','gmail','reference','watched-thread','source','watched-message')))#>>'{}')::uuid;
 if v_capture is null then raise exception 'Watch match was not queued';end if;
 if public.capture_automation('watch_source',w,jsonb_build_object('source',jsonb_build_object('title','Beyond daily cap','text','Another quote','date',current_date,'source_type','email','reference','thread-2'))) is not null then raise exception 'Watch daily cap bypassed';end if;
 if exists(select 1 from public.capture_items where capture_id=v_capture and status='confirmed') or exists(select 1 from public.actions where capture_id=v_capture) then raise exception 'Watch confirmed work automatically';end if;
 perform public.capture_automation('watch_finish',w,'{"state":"allowance","error":"AI allowance used up"}');
 if exists(select 1 from private.capture_watches where private.capture_watches.id=w and enabled) then raise exception 'Allowance did not pause Watch';end if;
 update private.capture_search_pages set expires_at=now()-interval '1 minute' where id=current_setting('test.capture_cache')::uuid;
 begin perform public.capture_search_service(current_setting('test.employee')::uuid,'cursor',jsonb_build_object('connection',current_setting('test.capture_conn'),'fingerprint','fixture-filter','token',current_setting('test.capture_cache')));raise exception 'Expired cache cursor accepted';exception when invalid_parameter_value then null;end;
end $$;
rollback;
