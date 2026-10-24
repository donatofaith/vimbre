-- Prepend team-fixtures.sql. Test fixtures and schema iterations are rolled back.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare r uuid;h uuid:=gen_random_uuid();t uuid:=gen_random_uuid();other uuid:=gen_random_uuid();j jsonb;begin
 j:=public.role_workspace('get');r:=(j->'role'->>'id')::uuid;perform set_config('test.hrole',r::text,true);perform set_config('test.handover',h::text,true);perform set_config('test.htask',t::text,true);perform set_config('test.hprivate',other::text,true);
 perform public.role_workspace('notes',r,'{"body":"PRIVATE ROLE NOTE"}');
 perform public.myday_action(t,'create',jsonb_build_object('title','Selected report','details','Shared report detail','due_date',current_date));
 perform public.myday_action(other,'create',jsonb_build_object('title','Unselected private task','details','DO NOT SHARE','due_date',current_date));
 j:=public.handover_workspace('save',h,jsonb_build_object('title','Operations handover','owner_id',auth.uid(),'role_id',r,'handover_type','leave','starts_on',current_date,'ends_on',current_date+2,'sections',jsonb_build_object('priorities','Send report first'),'inclusions','["work","decisions"]'::jsonb,'items',jsonb_build_array(jsonb_build_object('kind','task','id',t))));
 if j->>'status'<>'draft' or j->>'cover_id' is not null then raise exception 'Incomplete draft did not save';end if;
 begin perform public.handover_workspace('submit',h);raise exception 'Incomplete draft submitted';exception when check_violation then null;end;
 j:=public.handover_workspace('save',h,jsonb_build_object('version',1,'title','Operations handover','cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),'starts_on',current_date,'ends_on',current_date+2,'sections',jsonb_build_object('priorities','Send report first'),'inclusions','["work","decisions"]'::jsonb,'items',jsonb_build_array(jsonb_build_object('kind','task','id',t))));
 begin perform public.handover_workspace('save',h,'{"version":1}');raise exception 'Stale save accepted';exception when serialization_failure then null;end;
 perform public.handover_workspace('submit',h);
 j:=public.handover_workspace('get',h);if j::text like '%DO NOT SHARE%' or j::text like '%PRIVATE ROLE NOTE%' then raise exception 'Unselected private data shared';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin begin perform public.handover_workspace('get',current_setting('test.handover')::uuid);raise exception 'Cross tenant handover exposed';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare h uuid:=current_setting('test.handover')::uuid;j jsonb;begin
 j:=public.handover_workspace('list');if jsonb_array_length(j->'rows')<>1 then raise exception 'Reviewer cannot find submission';end if;
 begin perform public.handover_workspace('request_changes',h);raise exception 'Empty changes request accepted';exception when check_violation then null;end;
 perform public.handover_workspace('request_changes',h,'{"comment":"Add the report deadline"}');
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare h uuid:=current_setting('test.handover')::uuid;j jsonb;begin
 j:=public.handover_workspace('save',h,jsonb_build_object('version',2,'title','Operations handover','cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),'starts_on',current_date,'ends_on',current_date+2,'sections',jsonb_build_object('priorities','Send report today'),'inclusions','[]'::jsonb,'items',jsonb_build_array(jsonb_build_object('kind','task','id',current_setting('test.htask')))));
 perform public.handover_workspace('submit',h);
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
select public.handover_workspace('approve',current_setting('test.handover')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare h uuid:=current_setting('test.handover')::uuid;j jsonb;begin
 j:=public.myday_tasks('today','','',0);if j::text like '%DO NOT SHARE%' or (j->'cover_tasks')::text like '%Unselected private task%' then raise exception 'Unselected task reached cover projection';end if;
 j:=public.handover_workspace('get',h);if j->'handover'->>'display_status'<>'active' then raise exception 'Start date did not activate cover';end if;
 begin perform public.handover_workspace('cover_task',h,jsonb_build_object('task',current_setting('test.hprivate')));raise exception 'Unselected task writable';exception when insufficient_privilege then null;end;
 perform public.handover_workspace('cover_task',h,jsonb_build_object('task',current_setting('test.htask')));
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare h uuid:=current_setting('test.handover')::uuid;j jsonb;begin
 if (select status from public.actions where id=current_setting('test.htask')::uuid)<>'done' then raise exception 'Cover completion lost';end if;
 if (select owner_id from public.actions where id=current_setting('test.htask')::uuid)<>auth.uid() then raise exception 'Task ownership moved';end if;
 perform public.handover_workspace('take_back',h);j:=public.handover_workspace('get',h);if j->'handover'->>'status'<>'completed' then raise exception 'Take back did not complete';end if;
 begin perform public.handover_workspace('share',h,jsonb_build_object('expires',now()+interval '1 day'));raise exception 'Sharing bypassed flag';exception when insufficient_privilege then null;end;
end$$;
reset role;
insert into private.handover_features(company_id,sudden,exit,sharing,pdf) values(current_setting('test.company')::uuid,true,true,true,true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare j jsonb;h uuid:=current_setting('test.handover')::uuid;begin
 j:=public.handover_workspace('share',h,jsonb_build_object('expires',now()+interval '1 day'));perform set_config('test.share_token',j->>'token',true);perform set_config('test.share_id',j->>'id',true);
 if public.handover_shared(j->>'token')->>'title'<>'Operations handover' then raise exception 'Shared snapshot missing';end if;
 perform public.handover_workspace('revoke_share',h,jsonb_build_object('share',j->>'id'));
 if public.handover_shared(j->>'token') is not null then raise exception 'Revoked share works';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$declare h uuid:=gen_random_uuid();j jsonb;begin
 j:=public.handover_workspace('save',h,jsonb_build_object('owner_id',current_setting('test.employee'),'role_id',current_setting('test.hrole'),'title','Sudden cover','handover_type','sudden','cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),'starts_on',current_date,'ends_on',current_date+1,'sections',jsonb_build_object('priorities','Review the role deadlines'),'inclusions','["notes","work"]'::jsonb,'items','[]'::jsonb));
 j:=public.handover_workspace('populate',h,'{"inclusions":["notes","work"]}');if j::text like '%PRIVATE ROLE NOTE%' then raise exception 'Manager imported private notes';end if;
 perform public.handover_workspace('submit',h);j:=public.handover_workspace('get',h);if j->'handover'->>'status'<>'approved' then raise exception 'Sudden handover not immediately approved';end if;
 perform set_config('test.sudden',h::text,true);
end$$;
reset role;
select private.activate_handovers();
do $$begin if not exists(select 1 from private.handover_history where handover_id=current_setting('test.sudden')::uuid and operation='active' and actor_id is null) then raise exception 'Active status not logged';end if;end$$;
insert into private.role_features(company_id,reassignment) values(current_setting('test.company')::uuid,true) on conflict(company_id) do update set reassignment=true;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare h uuid:=gen_random_uuid();begin
 perform public.handover_workspace('save',h,jsonb_build_object('role_id',current_setting('test.hrole'),'title','Role exit','handover_type','exit','cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),'starts_on',current_date,'ends_on',current_date,'sections',jsonb_build_object('priorities','Transfer reporting'),'items','[]'::jsonb));
 begin perform public.myday_handover(h,'submit');raise exception 'Legacy endpoint bypassed structured review';exception when insufficient_privilege then null;end;
 perform public.handover_workspace('submit',h);perform set_config('test.exit',h::text,true);
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
select public.handover_workspace('approve',current_setting('test.exit')::uuid);
select public.handover_workspace('take_back',current_setting('test.exit')::uuid,jsonb_build_object('new_holder',current_setting('test.manager')));
reset role;
do $$begin if not exists(select 1 from public.role_profiles where id=current_setting('test.hrole')::uuid and holder_id=current_setting('test.manager')::uuid) then raise exception 'Exit role was not reassigned';end if;end$$;
-- Service-only AI cache/redraft limits; no provider request.
do $$declare h uuid:=current_setting('test.handover')::uuid;u uuid:=current_setting('test.employee')::uuid;r uuid;j jsonb;begin
 for n in 1..3 loop r:=gen_random_uuid();j:=public.handover_ai_claim(u,h,r,'handover_return',repeat(n::text,64),false);if j->>'blocked' is not null then raise exception 'Allowed draft blocked';end if;perform public.handover_ai_complete(u,r,'Return draft',false);end loop;
 j:=public.handover_ai_claim(u,h,gen_random_uuid(),'handover_return',repeat('1',64),false);if j->>'cached'<>'Return draft' then raise exception 'Identical source cache missed';end if;
 j:=public.handover_ai_claim(u,h,gen_random_uuid(),'handover_return',repeat('4',64),true);if j->>'blocked' is null then raise exception 'Fourth draft accepted';end if;
 if has_function_privilege('authenticated','public.handover_ai_claim(uuid,uuid,uuid,text,text,boolean)','execute') then raise exception 'Customer can invoke service AI claim';end if;
end$$;
select 'Handover drafts, approval, selected cover tasks, take back, privacy, flags and AI limits passed' result;
rollback;
