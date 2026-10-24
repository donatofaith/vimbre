create function private.handover_workspace(p_operation text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();v public.profiles;h public.work_handovers;rp public.role_profiles;f private.handover_features;owner uuid;rid uuid;chosen uuid;reviewer uuid;item jsonb;k text;content jsonb;token text;itemid uuid;operation text:=p_operation;begin
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and active) then raise insufficient_privilege;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>65000 then raise invalid_parameter_value;end if;
 select * into v from public.profiles where id=u;select * into f from private.handover_features where company_id=c;
 if operation='notifications' then
 update private.handover_notifications set read_at=now() where handover_id=nullif(p_data->>'seen','')::uuid and owner_id=u and read_at is null;
 return jsonb_build_object('count',(select count(*) from private.handover_notifications where owner_id=u and read_at is null),'rows',coalesce((select jsonb_agg(x) from(select id,handover_id,message,created_at from private.handover_notifications where owner_id=u and read_at is null order by created_at desc limit 30)x),'[]'));
 elsif operation='list' then return jsonb_build_object('flags',jsonb_build_object('sudden',coalesce(f.sudden,false),'exit',coalesce(f.exit,false),'sharing',coalesce(f.sharing,false),'pdf',coalesce(f.pdf,false)),'rows',coalesce((select jsonb_agg(private.handover_snapshot(x.id)) from(select w.id from public.work_handovers w where w.company_id=c and private.handover_authorized(w) order by w.updated_at desc,w.id limit 50 offset greatest(0,least(coalesce((p_data->>'page')::int,0),10000))*50)x),'[]'));
 elsif operation='options' then
 owner:=coalesce(nullif(p_data->>'owner','')::uuid,u);rid:=coalesce(nullif(p_data->>'role','')::uuid,private.ensure_role(owner));select * into rp from public.role_profiles where id=rid and holder_id=owner and company_id=c;
 if not found or owner<>u and (not coalesce(f.sudden,false) or not private.can_read_role(owner) or v.role not in ('manager','hr_admin')) then raise insufficient_privilege;end if;
 return jsonb_build_object('role',to_jsonb(rp),'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'reviewer',p.id<>owner and(p.role='hr_admin' or p.role='manager' and p.department_id=rp.department_id))) from public.profiles p where p.company_id=c and p.active and p.id<>owner),'[]'),'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'owner',r.holder_id,'name',p.full_name)) from public.role_profiles r join public.profiles p on p.id=r.holder_id and p.active where r.company_id=c and (r.holder_id=u or coalesce(f.sudden,false) and v.role in ('hr_admin','manager') and private.can_read_role(r.holder_id))),'[]'),'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'due_date',a.due_date)) from public.actions a where a.owner_id=owner and a.company_id=c and a.deleted_at is null and a.status<>'done' and owner=u),'[]'),'decisions',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title)) from public.decisions d where d.role_id=rp.id and d.status='live' and d.deleted_at is null),'[]'));
 elsif operation='save' then
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,19));select * into h from public.work_handovers where id=p_id and company_id=c for update;
 if h.id is not null and (not private.handover_authorized(h,true) or h.status in ('pending','cancelled','completed')) then raise insufficient_privilege;end if;
 if h.id is not null and (p_data->>'version')::int is distinct from h.version then raise exception 'This handover changed in another session. Reload before saving.' using errcode='40001';end if;
 owner:=coalesce(h.owner_id,nullif(p_data->>'owner_id','')::uuid,u);rid:=coalesce(h.role_id,nullif(p_data->>'role_id','')::uuid,private.ensure_role(owner));select * into rp from public.role_profiles where id=rid and company_id=c and holder_id=owner;
 if not found then raise insufficient_privilege;end if;
 k:=coalesce(p_data->>'handover_type',h.handover_type,'leave');
 if k='exit' and not coalesce(f.exit,false) or k='sudden' and not coalesce(f.sudden,false) then raise insufficient_privilege using message='This handover type is not enabled';end if;
 if owner<>u and (k<>'sudden' or not coalesce(f.sudden,false) or v.role not in ('hr_admin','manager') or not private.can_read_role(owner)) then raise insufficient_privilege;end if;
 chosen:=nullif(p_data->>'cover_id','')::uuid;reviewer:=nullif(p_data->>'reviewer_id','')::uuid;
 if chosen is not null and not exists(select 1 from public.profiles where id=chosen and company_id=c and active and id<>owner) then raise check_violation using message='Choose an active cover person';end if;
 if reviewer is not null and not exists(select 1 from public.profiles where id=reviewer and company_id=c and active and id<>owner and (role='hr_admin' or role='manager' and department_id=rp.department_id)) then raise check_violation using message='Choose a manager for this department';end if;
 if h.status='approved' and (chosen is distinct from h.cover_id or reviewer is distinct from h.reviewer_id or (p_data->>'starts_on')::date is distinct from h.starts_on or (p_data->>'ends_on')::date is distinct from h.ends_on) then raise check_violation using message='Dates and cover cannot change after approval. Cancel and create a new handover.';end if;
 content:=coalesce(p_data->'sections','{}');if jsonb_typeof(content)<>'object' or exists(select 1 from jsonb_each(content) where jsonb_typeof(value)<>'string' or length(value#>>'{}')>6000) then raise invalid_parameter_value;end if;
 insert into public.work_handovers(id,company_id,owner_id,role_id,cover_id,reviewer_id,title,starts_on,ends_on,sections,inclusions,body,structured,created_by,handover_type)
 values(p_id,c,owner,rid,chosen,reviewer,btrim(p_data->>'title'),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,content,coalesce(p_data->'inclusions','[]'),left(coalesce((select string_agg(e.key||E'\n'||e.value,E'\n\n') from jsonb_each_text(content)e),''),16000),true,u,k)
 on conflict(id) do update set title=excluded.title,cover_id=excluded.cover_id,reviewer_id=excluded.reviewer_id,starts_on=excluded.starts_on,ends_on=excluded.ends_on,sections=excluded.sections,inclusions=excluded.inclusions,body=excluded.body,structured=true,handover_type=excluded.handover_type,status=case when work_handovers.status='declined' then 'draft' else work_handovers.status end,version=work_handovers.version+1,updated_at=now();
 -- Only selected, owned records enter the handover. No private task detail enters manager-created absence flows.
 delete from private.handover_items i where i.handover_id=p_id and not exists(select 1 from jsonb_array_elements(coalesce(p_data->'items','[]'))j where j->>'kind'=i.kind and j->>'id'=i.record_id::text);
 for item in select * from jsonb_array_elements(coalesce(p_data->'items','[]')) loop
 itemid:=(item->>'id')::uuid;k:=item->>'kind';
 if k='task' and (owner<>u or not exists(select 1 from public.actions where id=itemid and owner_id=owner and company_id=c and deleted_at is null and status<>'done')) or k='decision' and not exists(select 1 from public.decisions where id=itemid and role_id=rid and deleted_at is null and status='live') or k not in ('task','decision') then raise insufficient_privilege;end if;
 insert into private.handover_items(handover_id,kind,record_id,do_not_change) values(p_id,k,itemid,coalesce((item->>'do_not_change')::boolean,false)) on conflict(handover_id,kind,record_id) do update set do_not_change=excluded.do_not_change;
 end loop;
 if h.status='approved' then insert into private.handover_notifications(handover_id,owner_id,message) values(p_id,h.reviewer_id,'Changed since approval');end if;
 perform private.handover_event(p_id,'save');return private.handover_snapshot(p_id);
 end if;
 select * into h from public.work_handovers where id=p_id and company_id=c for update;
 if not found or not private.handover_authorized(h) then raise insufficient_privilege;end if;
 if operation='get' then return jsonb_build_object('handover',private.handover_snapshot(p_id),'history',coalesce((select jsonb_agg(jsonb_build_object('version',version,'operation',hh.operation,'actor',p.full_name,'at',hh.created_at,'snapshot',case when u=h.owner_id or u=h.reviewer_id then hh.snapshot else null end) order by hh.id desc) from private.handover_history hh left join public.profiles p on p.id=hh.actor_id where hh.handover_id=h.id),'[]'));
 elsif operation='populate' then
 if not private.handover_authorized(h,true) then raise insufficient_privilege;end if;
 content:=jsonb_build_object('summary',h.title,'priorities',coalesce(p_data->>'priorities',''),'watch_outs',coalesce(p_data->>'watch_outs',''));
 for k in select jsonb_array_elements_text(coalesce(p_data->'inclusions',h.inclusions)) loop
 if k='notes' then if u=h.owner_id then content:=content||jsonb_build_object('notes',coalesce((select body from public.role_personal_notes where role_id=h.role_id and author_id=u),''));end if;
 elsif k='decisions' then content:=content||jsonb_build_object('decisions',coalesce((select string_agg(d.title||E'\nWhy: '||d.reason||E'\nDecided by: '||d.decided_by,E'\n\n') from public.decisions d where role_id=h.role_id and status='live' and deleted_at is null and exists(select 1 from private.handover_items hi where hi.handover_id=h.id and hi.kind='decision' and hi.record_id=d.id)),''));
 else content:=content||jsonb_build_object(k,coalesce((select string_agg(i.title||E'\n'||i.details||case when i.url is not null then E'\n'||i.url else '' end||case when i.contact_details<>'' then E'\n'||i.organisation||': '||i.contact_details else '' end||case when i.due_date is not null then E'\n'||i.due_date::text||' · '||coalesce(i.recurrence,'') else '' end,E'\n\n') from public.role_items i where role_id=h.role_id and deleted_at is null and (case k when 'work' then i.kind in ('responsibility','workstream') when 'contacts' then i.kind='external_contact' and private.role_access(h.role_id,true) when 'documents' then i.kind='document' when 'dates' then i.kind='recurring_deadline' else false end)),''));end if;
 end loop;
 content:=content||jsonb_build_object('tasks',coalesce((select string_agg(a.title||case when a.due_date is not null then ' · '||a.due_date::text else '' end||E'\n'||a.details,E'\n\n') from private.handover_items hi join public.actions a on a.id=hi.record_id and hi.kind='task' where hi.handover_id=h.id and a.owner_id=u),''));return content;
 elsif operation='submit' then
 if not private.handover_authorized(h,true) or h.status not in ('draft','declined') then raise insufficient_privilege;end if;
 if h.cover_id is null or h.reviewer_id is null or btrim(coalesce(h.sections->>'priorities',''))='' or h.starts_on is null or h.ends_on is null then raise check_violation using message='Set the dates, cover person, manager and first priorities';end if;
 update public.work_handovers set status='pending',updated_at=now() where id=h.id;
 insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'Handover ready for review');
 if h.handover_type='sudden' and h.created_by=u and u<>h.owner_id and coalesce(f.sudden,false) then perform private.handover_event(h.id,'submit');operation:='approve';else perform private.handover_event(h.id,'submit');return private.handover_snapshot(h.id);end if;
 end if;
 if operation in ('approve','request_changes') then
 if (h.reviewer_id<>u or not private.can_read_role(h.owner_id)) and not(h.handover_type='sudden' and h.created_by=u and coalesce(f.sudden,false)) or v.role not in ('manager','hr_admin') or h.status not in ('pending','approved') and not(h.handover_type='sudden' and h.status='draft') then raise insufficient_privilege;end if;
 if operation='request_changes' and btrim(coalesce(p_data->>'comment',''))='' then raise check_violation using message='Add a comment describing the changes needed';end if;
 update public.work_handovers set status=case when operation='approve' then 'approved' else 'declined' end,approved_by=case when operation='approve' then u else approved_by end,approved_at=case when operation='approve' then now() else approved_at end,approved_version=case when operation='approve' then version else approved_version end,review_comment=coalesce(p_data->>'comment',''),updated_at=now() where id=h.id;
 if operation='approve' then update private.handover_items set approved=true where handover_id=h.id;end if;
 insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,case when operation='approve' then h.cover_id else h.owner_id end,case when operation='approve' then 'Handover approved' else 'Changes requested on your handover' end);
 elsif operation='take_back' then
 if not (private.handover_authorized(h,true) or h.handover_type='exit' and h.reviewer_id=u and v.role in ('manager','hr_admin') and private.can_read_role(h.owner_id)) or h.status<>'approved' then raise insufficient_privilege;end if;
 if h.handover_type='exit' then
 if not coalesce(f.exit,false) or v.role not in ('manager','hr_admin') then raise insufficient_privilege;end if;
 perform public.role_workspace('reassign',h.role_id,jsonb_build_object('holder',p_data->>'new_holder'));
 end if;
 update public.work_handovers set status='completed',completed_at=now(),updated_at=now() where id=h.id;
 insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.cover_id,'Handover completed');
 elsif operation='cancel' then
 if not private.handover_authorized(h,true) or h.status in ('cancelled','completed') then raise insufficient_privilege;end if;update public.work_handovers set status='cancelled',updated_at=now() where id=h.id;
 elsif operation='return_summary' then
 if not private.handover_authorized(h,true) or h.status<>'completed' or length(p_data->>'summary')>6000 then raise insufficient_privilege;end if;update public.work_handovers set sections=sections||jsonb_build_object('return_summary',p_data->>'summary'),version=version+1,updated_at=now() where id=h.id;
 elsif operation='cover_task' then
 if h.cover_id<>u or h.status<>'approved' or current_date<h.starts_on or current_date>h.ends_on then raise insufficient_privilege;end if;
 itemid:=(p_data->>'task')::uuid;
 if not exists(select 1 from private.handover_items where handover_id=h.id and kind='task' and record_id=itemid and approved) then raise insufficient_privilege;end if;
 update public.actions set status='done',completed_at=now(),updated_at=now() where id=itemid and owner_id=h.owner_id and company_id=c and status<>'done' and deleted_at is null;
 elsif operation='share' then
 if not coalesce(f.sharing,false) or not private.handover_authorized(h,true) or h.status not in ('approved','completed') then raise insufficient_privilege;end if;
 if (p_data->>'expires')::timestamptz<=now() or (p_data->>'expires')::timestamptz>now()+interval '30 days' then raise check_violation;end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.handover_shares(handover_id,token_hash,expires_at,created_by,snapshot) values(h.id,encode(extensions.digest(token,'sha256'),'hex'),(p_data->>'expires')::timestamptz,u,jsonb_build_object('title',h.title,'sections',h.sections,'starts_on',h.starts_on,'ends_on',h.ends_on)) returning id into itemid;
 perform private.handover_event(h.id,'share');return jsonb_build_object('token',token,'id',itemid);
 elsif operation='revoke_share' then
 if not private.handover_authorized(h,true) then raise insufficient_privilege;end if;update private.handover_shares set revoked_at=now() where id=(p_data->>'share')::uuid and handover_id=h.id;
 elsif operation='shares' then
 if not private.handover_authorized(h,true) then raise insufficient_privilege;end if;return coalesce((select jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at,'revoked_at',revoked_at)) from private.handover_shares where handover_id=h.id),'[]');
 else raise invalid_parameter_value;end if;
 perform private.handover_event(h.id,operation);return private.handover_snapshot(h.id);
end$$;
revoke all on function private.handover_view_status(public.work_handovers),private.handover_authorized(public.work_handovers,boolean),private.handover_event(uuid,text),private.handover_snapshot(uuid),private.handover_workspace(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.handover_workspace(text,uuid,jsonb) to authenticated;
create function public.handover_workspace(p_operation text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.handover_workspace(p_operation,p_id,p_data)$$;
revoke all on function public.handover_workspace(text,uuid,jsonb) from public,anon,authenticated;grant execute on function public.handover_workspace(text,uuid,jsonb) to authenticated;
-- An unguessable, expiring capability exposes only the explicitly shared snapshot.
create function private.handover_shared(p_token text) returns jsonb language sql stable security definer set search_path='' as $$select s.snapshot from private.handover_shares s join public.work_handovers h on h.id=s.handover_id join private.handover_features f on f.company_id=h.company_id and f.sharing where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and length(p_token)=64 and s.revoked_at is null and s.expires_at>now() and h.status in ('approved','completed')$$;
revoke all on function private.handover_shared(text) from public,anon,authenticated;grant execute on function private.handover_shared(text) to anon,authenticated;
create function public.handover_shared(p_token text) returns jsonb language sql stable security invoker set search_path='' as $$select private.handover_shared(p_token)$$;
revoke all on function public.handover_shared(text) from public,anon,authenticated;grant execute on function public.handover_shared(text) to anon,authenticated;
-- Keep the established My day metadata projection; structured handovers expose only chosen tasks.
do $$declare definition text;begin
 select pg_get_functiondef('private.myday_cover_tasks()'::regprocedure) into definition;
 definition:=replace(definition,'h.status=''approved''','h.status=''approved'' and (not h.structured or exists(select 1 from private.handover_items hi where hi.handover_id=h.id and hi.record_id=a.id and hi.kind=''task'' and hi.approved))');execute definition;
end$$;

