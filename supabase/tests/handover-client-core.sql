-- Run after team-fixtures.sql and the proposed metadata/core inside a rollback-only transaction.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare r uuid;id uuid:=gen_random_uuid();t uuid:=gen_random_uuid();j jsonb;begin
 r:=(public.role_workspace('get')->'role'->>'id')::uuid;perform set_config('test.hc_role',r::text,true);perform set_config('test.hc',id::text,true);perform set_config('test.hc_task',t::text,true);
 perform public.myday_action(t,'create',jsonb_build_object('title','Explicit cover task','due_date',current_date));
 j:=public.handover_workspace('save',id,jsonb_build_object('title','Going on leave','starts_on',current_date,'ends_on',null,'return_unknown',true,'cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),'sections','{"priorities":"Send the notes"}'::jsonb,'note_for_manager','MANAGER ONLY NOTE','selected_records','[]'::jsonb,'wizard_step',1,'items',jsonb_build_array(jsonb_build_object('id',t,'kind','task'))));
 if j->>'note_for_manager'<>'MANAGER ONLY NOTE' or not(j->>'return_unknown')::boolean then raise exception 'Owner draft metadata missing';end if;
 begin perform public.handover_workspace('save',id,jsonb_build_object('version',1,'title','Bad dates','starts_on',current_date,'ends_on',current_date-1,'selected_records','[]'::jsonb));raise exception 'Invalid range accepted';exception when check_violation then null;end;
 perform public.handover_workspace('submit',id);
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
select public.handover_workspace('approve',current_setting('test.hc')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare j jsonb;begin
 j:=public.handover_workspace('list',null,'{}');if j::text like '%MANAGER ONLY NOTE%' then raise exception 'Cover/admin received manager-only note';end if;
 perform public.handover_workspace('cover_task',current_setting('test.hc')::uuid,jsonb_build_object('task',current_setting('test.hc_task')));
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin begin perform public.handover_workspace('approve',current_setting('test.hc')::uuid);raise exception 'Cross-company approval allowed';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare j jsonb;begin
 j:=public.handover_workspace('save',current_setting('test.hc')::uuid,jsonb_build_object('version',1,'title','Updated leave','starts_on',current_date+1,'ends_on',current_date+3,'cover_id',current_setting('test.admin'),'reviewer_id',current_setting('test.manager'),'sections','{"priorities":"Send notes"}'::jsonb,'selected_records','[]'::jsonb,'items','[]'::jsonb));
 if j->>'status'<>'draft' or not(j->>'changed_since_approval')::boolean then raise exception 'Material change did not require approval again';end if;
end$$;
