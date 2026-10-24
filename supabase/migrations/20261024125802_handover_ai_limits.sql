-- The gateway reads saved inputs and enforces cache/redraft limits on the server.
create function private.handover_ai_source(p_user uuid,p_handover uuid,p_kind text) returns text language plpgsql security definer set search_path='' as $$declare h public.work_handovers;begin
 select * into h from public.work_handovers where id=p_handover and exists(select 1 from public.profiles p where p.id=p_user and p.active and p.company_id=work_handovers.company_id);
 if h.id is null or p_user<>h.owner_id and not(p_user=h.created_by and exists(select 1 from public.profiles pv join public.profiles po on po.id=h.owner_id where pv.id=p_user and pv.active and pv.company_id=po.company_id and (pv.role='hr_admin' or pv.role='manager' and pv.department_id=po.department_id))) or p_kind not in ('handover_draft','handover_return') then raise insufficient_privilege;end if;
 if p_kind='handover_return' then
 if h.status<>'completed' then raise insufficient_privilege;end if;
 return jsonb_build_object('handover',h.sections,'completed_cover_work',coalesce((select jsonb_agg(jsonb_build_object('title',a.title,'completed_at',a.completed_at,'outcome',a.completion_note)) from private.handover_items hi join public.actions a on a.id=hi.record_id and hi.kind='task' where hi.handover_id=h.id and a.status='done'),'[]'))::text;
 end if;
 if h.status not in ('draft','declined','approved') then raise insufficient_privilege;end if;
 return jsonb_build_object('type',h.handover_type,'start',h.starts_on,'end',h.ends_on,'content',h.sections,'decisions',coalesce((select jsonb_agg(jsonb_build_object('title',d.title,'why',d.reason,'do_not_change',hi.do_not_change)) from private.handover_items hi join public.decisions d on d.id=hi.record_id and hi.kind='decision' where hi.handover_id=h.id),'[]'))::text;
end$$;
create function public.handover_ai_source(p_user uuid,p_handover uuid,p_kind text) returns text language sql security invoker set search_path='' as $$select private.handover_ai_source(p_user,p_handover,p_kind)$$;
create function private.handover_ai_claim(p_user uuid,p_handover uuid,p_request uuid,p_kind text,p_fingerprint text,p_redraft boolean) returns jsonb language plpgsql security definer set search_path='' as $$declare cached text;n integer;begin
 perform private.handover_ai_source(p_user,p_handover,p_kind);perform pg_advisory_xact_lock(hashtextextended(p_handover::text,20));
 if exists(select 1 from private.handover_ai_jobs where request_id=p_request) then return jsonb_build_object('blocked','This draft request has already been received.');end if;
 if not p_redraft then select output into cached from private.handover_ai_jobs where handover_id=p_handover and user_id=p_user and kind=p_kind and fingerprint=p_fingerprint and status='done' order by created_at desc limit 1;end if;
 select count(*) into n from private.handover_ai_jobs where handover_id=p_handover and kind=p_kind and charged;
 if cached is null and n>=3 then return jsonb_build_object('blocked','You have used both redrafts. Edit the handover manually.');end if;
 if exists(select 1 from private.handover_ai_jobs where handover_id=p_handover and kind=p_kind and status='running' and created_at>now()-interval '2 minutes') then return jsonb_build_object('blocked','A draft is already being prepared. Try again shortly.');end if;
 insert into private.handover_ai_jobs(request_id,handover_id,user_id,kind,fingerprint,status,charged,output) values(p_request,p_handover,p_user,p_kind,p_fingerprint,case when cached is null then 'running' else 'done' end,cached is null,cached);
 return jsonb_build_object('cached',cached);
end$$;
create function public.handover_ai_claim(p_user uuid,p_handover uuid,p_request uuid,p_kind text,p_fingerprint text,p_redraft boolean) returns jsonb language sql security invoker set search_path='' as $$select private.handover_ai_claim(p_user,p_handover,p_request,p_kind,p_fingerprint,p_redraft)$$;
create function private.handover_ai_complete(p_user uuid,p_request uuid,p_output text,p_cancel boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if length(p_output)>50000 then raise check_violation;end if;
 update private.handover_ai_jobs set status=case when p_cancel then 'cancelled' when p_output is null then 'failed' else 'done' end,charged=case when p_cancel then false else charged end,output=p_output where request_id=p_request and user_id=p_user and status='running';
end$$;
create function public.handover_ai_complete(p_user uuid,p_request uuid,p_output text,p_cancel boolean default false) returns void language sql security invoker set search_path='' as $$select private.handover_ai_complete(p_user,p_request,p_output,p_cancel)$$;
revoke all on function private.handover_ai_source(uuid,uuid,text),public.handover_ai_source(uuid,uuid,text),private.handover_ai_claim(uuid,uuid,uuid,text,text,boolean),public.handover_ai_claim(uuid,uuid,uuid,text,text,boolean),private.handover_ai_complete(uuid,uuid,text,boolean),public.handover_ai_complete(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function private.handover_ai_source(uuid,uuid,text),public.handover_ai_source(uuid,uuid,text),private.handover_ai_claim(uuid,uuid,uuid,text,text,boolean),public.handover_ai_claim(uuid,uuid,uuid,text,text,boolean),private.handover_ai_complete(uuid,uuid,text,boolean),public.handover_ai_complete(uuid,uuid,text,boolean) to service_role;
insert into public.ai_task_routes(task,primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled) select 'handover_return',primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled from public.ai_task_routes where task='handover_draft' on conflict(task) do nothing;
