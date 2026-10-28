CREATE OR REPLACE FUNCTION private.handover_workspace(p_operation text, p_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();v public.profiles;h public.work_handovers;rp public.role_profiles;f private.handover_features;owner uuid;rid uuid;chosen uuid;reviewer uuid;item jsonb;k text;content jsonb;token text;itemid uuid;operation text:=p_operation;pol private.handover_policy;material boolean:=false;begin
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and active) then raise insufficient_privilege;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>65000 then raise invalid_parameter_value;end if;
 select * into v from public.profiles where id=u;select * into f from private.handover_features where company_id=c;
 select * into pol from private.handover_policy where company_id=c;
 if not found then pol:=row(c,true,false,array['manager','hr_admin'],0,false,14,'approval',array['priorities'],3)::private.handover_policy;end if;
 f.sudden:=coalesce(f.sudden,true);f.exit:=coalesce(f.exit,true);f.pdf:=coalesce(f.pdf,true);f.sharing:=pol.external_sharing and coalesce(f.sharing,true);
 if operation in('options','policy','policy_save','overview','warnings','template') then return private.handover_client_setup(operation,p_id,p_data);end if;
 if operation='notifications' then
 update private.handover_notifications set read_at=now() where handover_id=nullif(p_data->>'seen','')::uuid and owner_id=u and read_at is null;
 return jsonb_build_object('count',(select count(*) from private.handover_notifications where owner_id=u and read_at is null),'rows',coalesce((select jsonb_agg(x) from(select id,handover_id,message,created_at from private.handover_notifications where owner_id=u and read_at is null order by created_at desc limit 30)x),'[]'));
 elsif operation='list' then return jsonb_build_object('flags',jsonb_build_object('sudden',coalesce(f.sudden,false),'exit',coalesce(f.exit,false),'sharing',coalesce(f.sharing,false),'pdf',coalesce(f.pdf,false)),'rows',coalesce((select jsonb_agg(private.handover_snapshot(x.id)) from(select w.id from public.work_handovers w where w.company_id=c and w.deleted_at is null and private.handover_authorized(w) order by w.updated_at desc,w.id limit 50 offset greatest(0,least(coalesce((p_data->>'page')::int,0),10000))*50)x),'[]'));
 elsif operation='save' then
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,19));select * into h from public.work_handovers where id=p_id and company_id=c for update;
 if h.id is not null and (not private.handover_authorized(h,true) or h.status in ('pending','cancelled','completed')) then raise insufficient_privilege;end if;
 if h.id is not null and (p_data->>'version')::int is distinct from h.version then raise exception 'This handover changed in another session. Reload before saving.' using errcode='40001';end if;
 owner:=coalesce(h.owner_id,nullif(p_data->>'owner_id','')::uuid,u);if h.id is not null and h.status='draft' and h.created_by=u and v.role in('manager','hr_admin') and nullif(p_data->>'owner_id','')::uuid is distinct from h.owner_id then owner:=coalesce(nullif(p_data->>'owner_id','')::uuid,u);end if;rid:=case when owner is distinct from h.owner_id and h.id is not null then coalesce(nullif(p_data->>'role_id','')::uuid,private.ensure_role(owner)) else coalesce(h.role_id,nullif(p_data->>'role_id','')::uuid,private.ensure_role(owner)) end;select * into rp from public.role_profiles where id=rid and company_id=c and holder_id=owner;
 if not found then raise insufficient_privilege;end if;
 k:=coalesce(p_data->>'handover_type',h.handover_type,'leave');
 if k='exit' and not coalesce(f.exit,false) or k='sudden' and not coalesce(f.sudden,false) then raise insufficient_privilege using message='This handover type is not enabled';end if;
 if owner<>u and (k<>'sudden' or not coalesce(f.sudden,false) or v.role not in ('hr_admin','manager') or not private.can_read_role(owner)) then raise insufficient_privilege;end if;
 chosen:=nullif(p_data->>'cover_id','')::uuid;reviewer:=nullif(p_data->>'reviewer_id','')::uuid;
 if chosen is not null and not exists(select 1 from public.profiles where id=chosen and company_id=c and active and id<>owner) then raise check_violation using message='Choose an active cover person';end if;
 if reviewer is not null and not exists(select 1 from public.profiles where id=reviewer and company_id=c and active and id<>owner and role=any(pol.approver_roles)) then raise check_violation using message='Choose an active manager or admin';end if;
 material:=h.status='approved' and(chosen is distinct from h.cover_id or reviewer is distinct from h.reviewer_id or nullif(p_data->>'starts_on','')::date is distinct from h.starts_on or nullif(p_data->>'ends_on','')::date is distinct from h.ends_on);
 if jsonb_typeof(coalesce(p_data->'selected_records','[]'))<>'array' or jsonb_array_length(coalesce(p_data->'selected_records','[]'))>500 then raise invalid_parameter_value;end if;
 for item in select * from jsonb_array_elements(coalesce(p_data->'selected_records','[]')) loop
 itemid:=(item->>'id')::uuid;
 if item->>'group'='notes' then
 if owner<>u or not exists(select 1 from private.role_notes where id=itemid and role_id=rid and author_id=u and include_in_handover) then raise insufficient_privilege;end if;
 elsif not exists(select 1 from public.role_items i where i.id=itemid and i.role_id=rid and i.deleted_at is null and not exists(select 1 from private.role_item_settings rs where rs.item_id=i.id and(rs.is_private or not rs.include_in_handover))) then raise insufficient_privilege;
 end if;end loop;

 content:=coalesce(p_data->'sections','{}');if jsonb_typeof(content)<>'object' or exists(select 1 from jsonb_each(content) where jsonb_typeof(value)<>'string' or length(value#>>'{}')>6000) then raise invalid_parameter_value;end if;
 insert into public.work_handovers(id,company_id,owner_id,role_id,cover_id,reviewer_id,title,starts_on,ends_on,sections,inclusions,body,structured,created_by,handover_type)
 values(p_id,c,owner,rid,chosen,reviewer,btrim(p_data->>'title'),nullif(p_data->>'starts_on','')::date,nullif(p_data->>'ends_on','')::date,content,coalesce(p_data->'inclusions','[]'),left(coalesce((select string_agg(e.key||E'\n'||e.value,E'\n\n') from jsonb_each_text(content)e),''),16000),true,u,k)
 on conflict(id) do update set owner_id=excluded.owner_id,role_id=excluded.role_id,title=excluded.title,cover_id=excluded.cover_id,reviewer_id=excluded.reviewer_id,starts_on=excluded.starts_on,ends_on=excluded.ends_on,sections=excluded.sections,inclusions=excluded.inclusions,body=excluded.body,structured=true,handover_type=excluded.handover_type,status=case when work_handovers.status='declined' then 'draft' else work_handovers.status end,version=work_handovers.version+1,updated_at=now();
 -- Only selected, owned records enter the handover. No private task detail enters manager-created absence flows.
 delete from private.handover_items i where i.handover_id=p_id and not exists(select 1 from public.actions a where i.kind='task' and a.id=i.record_id and a.status='done') and not exists(select 1 from jsonb_array_elements(coalesce(p_data->'items','[]'))j where j->>'kind'=i.kind and j->>'id'=i.record_id::text);
 for item in select * from jsonb_array_elements(coalesce(p_data->'items','[]')) loop
 itemid:=(item->>'id')::uuid;k:=item->>'kind';
 if k='task' and not exists(select 1 from public.actions a where a.id=itemid and private.handover_task_eligible(a,owner,rid,u) and(a.status<>'done' or exists(select 1 from private.handover_items hi where hi.handover_id=p_id and hi.record_id=a.id and hi.kind='task'))) or k='decision' and not exists(select 1 from public.decisions where id=itemid and role_id=rid and deleted_at is null and status='live' and not exists(select 1 from private.role_item_settings ris where ris.item_id=itemid and (ris.is_private or not ris.include_in_handover))) or k not in ('task','decision') then raise insufficient_privilege;end if;
 insert into private.handover_items(handover_id,kind,record_id,do_not_change,checked_at) values(p_id,k,itemid,coalesce((item->>'do_not_change')::boolean,false),case when coalesce((item->>'checked')::boolean,false) then now() end) on conflict(handover_id,kind,record_id) do update set do_not_change=excluded.do_not_change,checked_at=case when excluded.checked_at is not null then coalesce(handover_items.checked_at,excluded.checked_at) end;
 end loop;
 update public.work_handovers set title_renamed=coalesce((p_data->>'title_renamed')::boolean,title_renamed),return_unknown=coalesce((p_data->>'return_unknown')::boolean,false),wizard_step=coalesce((p_data->>'wizard_step')::smallint,wizard_step),selected_records=coalesce(p_data->'selected_records',selected_records),source_selection_set=source_selection_set or (p_data?'selected_records'),priority_order=coalesce(p_data->'priority_order',priority_order),status=case when material then 'draft' else status end where id=p_id;
 if p_data?'share_draft' then insert into private.handover_share_drafts(handover_id,options) values(p_id,p_data->'share_draft') on conflict(handover_id) do update set options=excluded.options;end if;
 if p_data?'note_for_manager' then insert into private.handover_manager_notes(handover_id,body) values(p_id,coalesce(p_data->>'note_for_manager','')) on conflict(handover_id) do update set body=excluded.body;end if;
 if material then update private.handover_items set approved=false where handover_id=p_id;end if;
 if h.status='approved' then insert into private.handover_notifications(handover_id,owner_id,message) select p_id,x,case when material then 'Dates or cover changed. Approval is required again.' else 'Changed since approval' end from(select distinct unnest(array[h.reviewer_id,h.cover_id]) x)t where x is not null;end if;
 if h.id is null and pol.cover_visibility='assignment' and chosen is not null then insert into private.handover_notifications(handover_id,owner_id,message) values(p_id,chosen,'You have been assigned cover');end if;

 perform private.handover_event(p_id,'save');return private.handover_snapshot(p_id);
 end if;
 select * into h from public.work_handovers where id=p_id and company_id=c for update;
 if not found or not private.handover_authorized(h) then raise insufficient_privilege;end if;
 if operation in('withdraw','delete','undo_delete','comment','comments','preview','copy_last','reassign_tasks') then return private.handover_client_actions(operation,p_id,p_data);end if;
 if operation='get' then
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'handover',h.id,'viewed'); return jsonb_build_object('handover',private.handover_snapshot(p_id),'comments',private.handover_workspace('comments',h.id,'{}'),'history',coalesce((select jsonb_agg(jsonb_build_object('version',version,'operation',hh.operation,'actor',p.full_name,'at',hh.created_at,'snapshot',case when u=h.owner_id or u=h.reviewer_id then hh.snapshot else null end) order by hh.id desc) from private.handover_history hh left join public.profiles p on p.id=hh.actor_id where hh.handover_id=h.id),'[]'));
 elsif operation='populate' then
 if not private.handover_authorized(h,true) then raise insufficient_privilege;end if;
 content:=jsonb_build_object('summary',h.title,'priorities',coalesce(p_data->>'priorities',''),'watch_outs',coalesce(p_data->>'watch_outs',''));
 for k in select jsonb_array_elements_text(coalesce(p_data->'inclusions',h.inclusions)) loop
 if k='notes' then if u=h.owner_id then content:=content||jsonb_build_object('notes',coalesce((select string_agg(body,E'\n\n') from private.role_notes n where role_id=h.role_id and author_id=u and include_in_handover and(not h.source_selection_set or exists(select 1 from jsonb_array_elements(h.selected_records) j where j->>'id'=n.id::text and j->>'group'='notes'))),''));end if;
 elsif k='decisions' then content:=content||jsonb_build_object('decisions',coalesce((select string_agg(d.title||E'\nWhy: '||d.reason||E'\nDecided by: '||d.decided_by,E'\n\n') from public.decisions d where role_id=h.role_id and not exists(select 1 from private.role_item_settings ris where ris.item_id=d.id and (ris.is_private or not ris.include_in_handover)) and status='live' and deleted_at is null and exists(select 1 from private.handover_items hi where hi.handover_id=h.id and hi.kind='decision' and hi.record_id=d.id)),''));
 else content:=content||jsonb_build_object(k,coalesce((select string_agg(i.title||E'\n'||i.details||case when i.url is not null then E'\n'||i.url else '' end||case when i.contact_details<>'' then E'\n'||i.organisation||': '||i.contact_details else '' end||case when i.due_date is not null then E'\n'||i.due_date::text||' · '||coalesce(i.recurrence,'') else '' end,E'\n\n') from public.role_items i where role_id=h.role_id and deleted_at is null and(not h.source_selection_set or exists(select 1 from jsonb_array_elements(h.selected_records) j where j->>'id'=i.id::text and j->>'group'=k)) and not exists(select 1 from private.role_item_settings ris where ris.item_id=i.id and (ris.is_private or not ris.include_in_handover)) and (case k when 'work' then i.kind in ('responsibility','workstream') when 'contacts' then i.kind='external_contact' and private.role_access(h.role_id,true) when 'documents' then i.kind='document' when 'dates' then i.kind='recurring_deadline' else false end)),''));end if;
 end loop;
 content:=content||jsonb_build_object('tasks',coalesce((select string_agg(a.title||case when a.due_date is not null then ' · '||a.due_date::text else '' end||case when h.owner_id=u then E'\n'||a.details else '' end,E'\n\n') from private.handover_items hi join public.actions a on a.id=hi.record_id and hi.kind='task' where hi.handover_id=h.id and private.handover_task_eligible(a,h.owner_id,h.role_id,u)),''));return content;
 elsif operation='submit' then
 if not private.handover_authorized(h,true) or h.status not in ('draft','declined') then raise insufficient_privilege;end if;
 if h.cover_id is null or h.starts_on is null or(h.ends_on is null and not h.return_unknown) or(h.ends_on<h.starts_on) then raise check_violation using message='Set valid dates and a cover person';end if;
 if not exists(select 1 from public.profiles where id=h.cover_id and company_id=c and active and id<>h.owner_id) then raise check_violation using message='Choose an active cover person';end if;
 if exists(select 1 from unnest(pol.required_sections) req(value) where btrim(coalesce(h.sections->>req.value,''))='') then raise check_violation using message='Complete the required handover sections';end if;
 if not pol.approval_required or pol.allow_top_no_approval and v.role='hr_admin' and h.owner_id=u and not exists(select 1 from public.role_profiles where id=h.role_id and manager_id is not null) then
 update public.work_handovers set status='approved',approved_by=u,approved_at=now(),approved_version=version,updated_at=now() where id=h.id;update private.handover_items set approved=true where handover_id=h.id;
 insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.cover_id,'Handover assigned. No approval needed.');perform private.handover_event(h.id,'assigned');return private.handover_snapshot(h.id);end if;
 if h.reviewer_id is null or not exists(select 1 from public.profiles where id=h.reviewer_id and company_id=c and active and id<>h.owner_id and role=any(pol.approver_roles)) then raise check_violation using message='Choose who approves this handover';end if;

 update public.work_handovers set status='pending',updated_at=now() where id=h.id;
 insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'Handover ready for review');
 if h.handover_type='sudden' and h.created_by=u and u<>h.owner_id and coalesce(f.sudden,false) and v.role=any(pol.approver_roles) then perform private.handover_event(h.id,'submit');operation:='approve';else perform private.handover_event(h.id,'submit');return private.handover_snapshot(h.id);end if;
 end if;
 if operation in ('approve','request_changes') then
 if h.reviewer_id is distinct from u and not(h.handover_type='sudden' and h.created_by=u and coalesce(f.sudden,false)) or not(v.role=any(pol.approver_roles)) or h.status not in ('pending','approved') and not(h.handover_type='sudden' and h.status='draft') then raise insufficient_privilege;end if;
 if operation='approve' and not exists(select 1 from public.profiles where id=h.cover_id and company_id=c and active) then raise check_violation using message='Choose an active cover person before approving';end if; if operation='request_changes' and btrim(coalesce(p_data->>'comment',''))='' then raise check_violation using message='Add a comment describing the changes needed';end if;
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
 if not private.handover_authorized(h,true) or h.status in ('cancelled','completed') or private.handover_view_status(h)='active' then raise insufficient_privilege;end if;insert into private.handover_notifications(handover_id,owner_id,message) select h.id,x,'Handover cancelled' from(select distinct unnest(array[h.reviewer_id,h.cover_id])x)t where x is not null;update public.work_handovers set status='cancelled',updated_at=now() where id=h.id;
 elsif operation='return_summary' then
 if not private.handover_authorized(h,true) or h.status<>'completed' or length(p_data->>'summary')>6000 then raise insufficient_privilege;end if;update public.work_handovers set sections=sections||jsonb_build_object('return_summary',p_data->>'summary'),version=version+1,updated_at=now() where id=h.id;
 elsif operation='cover_task' then
 if h.cover_id<>u or h.status<>'approved' or current_date<h.starts_on or current_date>coalesce(h.ends_on,'infinity'::date) then raise insufficient_privilege;end if;
 itemid:=(p_data->>'task')::uuid;
 if not exists(select 1 from private.handover_items where handover_id=h.id and kind='task' and record_id=itemid and approved) then raise insufficient_privilege;end if;
 update public.actions set status='done',completed_at=now(),updated_at=now() where id=itemid and owner_id=h.owner_id and company_id=c and status<>'done' and deleted_at is null;
 if not found and not exists(select 1 from public.actions where id=itemid and owner_id=h.owner_id and company_id=c and status='done' and deleted_at is null) then raise check_violation using message='This task is no longer available for cover';end if; update private.handover_items set completed_by=u,completed_at=now() where handover_id=h.id and record_id=itemid and kind='task';elsif operation='share' then
 if not coalesce(f.sharing,false) or not private.handover_authorized(h,true) or h.status not in ('approved','completed') then raise insufficient_privilege;end if;
 if (p_data->>'expires')::timestamptz<=now() or (p_data->>'expires')::timestamptz>now()+interval '30 days' then raise check_violation;end if;
 if coalesce(p_data->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise check_violation using message='Enter a valid email address';end if; if jsonb_typeof(coalesce(p_data->'sections','[]'))<>'array' or jsonb_array_length(coalesce(p_data->'sections','[]'))=0 then raise check_violation using message='Choose sections to share';end if; token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.handover_shares(handover_id,token_hash,expires_at,created_by,snapshot) values(h.id,encode(extensions.digest(token,'sha256'),'hex'),coalesce(nullif(p_data->>'expires','')::timestamptz,now()+make_interval(days=>pol.link_expiry_days)),u,jsonb_build_object('title',h.title,'sections',coalesce((select jsonb_object_agg(key,value) from jsonb_each(h.sections-array['reason','note_for_manager']) where key in(select jsonb_array_elements_text(coalesce(p_data->'sections',to_jsonb(pol.required_sections))))),'{}'::jsonb),'starts_on',h.starts_on,'ends_on',h.ends_on)) returning id into itemid;
 update private.handover_shares set recipient_email=coalesce(p_data->>'email',''),section_keys=coalesce(p_data->'sections','[]') where id=itemid;perform private.handover_event(h.id,'shared');return jsonb_build_object('token',token,'id',itemid);
 elsif operation='revoke_share' then
 if not private.handover_authorized(h,true) then raise insufficient_privilege;end if;update private.handover_shares set revoked_at=now() where id=(p_data->>'share')::uuid and handover_id=h.id;
 elsif operation='shares' then
 if not private.handover_authorized(h,true) then raise insufficient_privilege;end if;return coalesce((select jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at,'revoked_at',revoked_at,'email',recipient_email,'views',(select count(*) from private.handover_share_views hv where hv.share_id=handover_shares.id),'last_viewed',(select max(viewed_at) from private.handover_share_views hv where hv.share_id=handover_shares.id))) from private.handover_shares where handover_id=h.id),'[]');
 else raise invalid_parameter_value;end if;
 perform private.handover_event(h.id,operation);return private.handover_snapshot(h.id);
end$function$;

revoke all on function private.handover_workspace(text,uuid,jsonb) from public,anon;grant execute on function private.handover_workspace(text,uuid,jsonb) to authenticated;
create or replace function private.handover_remind() returns integer language plpgsql security definer set search_path='' as $$
declare h public.work_handovers;day date;hour integer;days integer;n integer:=0;kind text;recipient uuid;message text;begin
 for h in select w.* from public.work_handovers w where w.deleted_at is null and w.status not in('cancelled','completed') loop
 select (now() at time zone coalesce(p.timezone,'Europe/London'))::date,extract(hour from now() at time zone coalesce(p.timezone,'Europe/London'))::integer into day,hour from (select 1)x left join public.work_preferences p on p.owner_id=h.owner_id;
 if hour<8 or hour>10 then continue;end if;days:=h.starts_on-day;
 for kind,recipient,message in
 select 'owner',h.owner_id,case when days=0 then 'Your leave starts today' else 'Your leave starts in '||days||case when days=1 then ' day' else ' days' end end||' and your handover isn’t submitted.' where days between 0 and 3 and h.status in('draft','declined')
 union all select 'manager',h.reviewer_id,'A handover starts within two days and needs your approval.' where days between 0 and 2 and h.status='pending' and h.reviewer_id is not null
 union all select 'cover',h.cover_id,'Your cover starts today.' where days=0 and h.status='approved' and h.cover_id is not null
 union all select 'return',h.owner_id,'Your return date is here. Take back your work when you return.' where h.ends_on=day and h.status='approved' and not h.return_unknown loop
 insert into private.handover_reminder_log(handover_id,kind,day) values(h.id,kind,day) on conflict do nothing;
 if found then insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,recipient,message);n:=n+1;end if;
 end loop;
 if h.status='approved' and h.activated_at is null and h.starts_on<=day then update public.work_handovers set activated_at=now() where id=h.id;perform private.handover_event(h.id,'activated');end if;
 end loop;return n;
end$$;
revoke all on function private.handover_remind() from public,anon,authenticated;
select cron.schedule('handover-client-reminders','*/15 * * * *','select private.handover_remind()');
CREATE OR REPLACE FUNCTION private.handover_ai_source(p_user uuid, p_handover uuid, p_kind text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare h public.work_handovers;begin
 select * into h from public.work_handovers where id=p_handover and exists(select 1 from public.profiles p where p.id=p_user and p.active and p.company_id=work_handovers.company_id);
 if h.id is null or p_user<>h.owner_id and not(p_user=h.created_by and exists(select 1 from public.profiles pv join public.profiles po on po.id=h.owner_id where pv.id=p_user and pv.active and pv.company_id=po.company_id and (pv.role='hr_admin' or pv.role='manager' and pv.department_id=po.department_id))) or p_kind not in ('handover_draft','handover_return') then raise insufficient_privilege;end if;
 if p_kind='handover_return' then
 if h.status<>'completed' then raise insufficient_privilege;end if;
 return jsonb_build_object('handover',h.sections-array['reason','note_for_manager'],'decisions_made',coalesce((select jsonb_agg(jsonb_build_object('title',d.title,'why',d.reason,'date',d.decided_on)) from public.decisions d where d.role_id=h.role_id and d.created_at>=h.starts_on::timestamp and d.created_at<=coalesce(h.completed_at,now()) and d.deleted_at is null and not exists(select 1 from private.role_item_settings rs where rs.item_id=d.id and(rs.is_private or not rs.include_in_handover))),'[]'),'new_items',coalesce((select jsonb_agg(jsonb_build_object('title',i.title,'kind',i.kind)) from public.role_items i where i.role_id=h.role_id and i.created_at>=h.starts_on::timestamp and i.created_at<=coalesce(h.completed_at,now()) and i.deleted_at is null and not exists(select 1 from private.role_item_settings rs where rs.item_id=i.id and(rs.is_private or not rs.include_in_handover))),'[]'),'completed_cover_work',coalesce((select jsonb_agg(jsonb_build_object('title',a.title,'completed_at',a.completed_at,'outcome',a.completion_note,'by_cover',case when hi.completed_by is null then null else hi.completed_by=h.cover_id end)) from private.handover_items hi join public.actions a on a.id=hi.record_id and hi.kind='task' where hi.handover_id=h.id and a.status='done'),'[]'))::text;
 end if;
 if h.status not in ('draft','declined','approved') then raise insufficient_privilege;end if;
 return jsonb_build_object('type',h.handover_type,'start',h.starts_on,'end',h.ends_on,'content',h.sections-array['reason','note_for_manager'],'priority_order',h.priority_order,'ordering_rule','Use due dates, importance and Do not change. Do not invent dates. Respect the saved task order when one is provided.','open_tasks',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'due_date',a.due_date,'importance',a.priority)) from private.handover_items hi join public.actions a on a.id=hi.record_id and hi.kind='task' where hi.handover_id=h.id),'[]'),'decisions',coalesce((select jsonb_agg(jsonb_build_object('title',d.title,'why',d.reason,'do_not_change',hi.do_not_change)) from private.handover_items hi join public.decisions d on d.id=hi.record_id and hi.kind='decision' where hi.handover_id=h.id),'[]'))::text;
end$function$;

create or replace function private.handover_ai_complete(p_user uuid,p_request uuid,p_output text,p_cancel boolean) returns void language plpgsql security definer set search_path='' as $$
declare hid uuid;h public.work_handovers;begin
 if length(p_output)>50000 then raise check_violation;end if;
 update private.handover_ai_jobs set status=case when p_cancel then 'cancelled' when p_output is null then 'failed' else 'done' end,charged=case when p_cancel then false else charged end,output=p_output where request_id=p_request and user_id=p_user and status='running' returning handover_id into hid;
 if hid is not null and not p_cancel and p_output is not null then
 select * into h from public.work_handovers where id=hid;
 insert into private.handover_history(handover_id,version,actor_id,operation,snapshot) values(h.id,h.version,p_user,'drafted',to_jsonb(h));
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(h.company_id,p_user,'handover',h.id,'drafted');
 end if;
end$$;
-- Keep the approved My Day query intact; change only its handover projections.
do $patch$
declare s text;begin
 s:=pg_get_functiondef('public.myday_tasks(text,text,text,integer,uuid,uuid,text,text)'::regprocedure);
 if strpos(s,'where reviewer_id=u and status=''pending''')=0 then raise exception 'My Day handover projection changed; review before applying';end if;
 s:=replace(s,'where reviewer_id=u and status=''pending''','where h.company_id=private.current_company_id() and h.deleted_at is null and h.reviewer_id=u and private.handover_authorized(h) and (h.status=''pending'' or h.status=''approved'' and h.approved_version is not null and h.version>h.approved_version)');
 s:=replace(s,'today between h.starts_on and h.ends_on','today between h.starts_on and coalesce(h.ends_on,''infinity''::date)');
 s:=replace(s,'h.status=''approved'' and today','h.status=''approved'' and h.company_id=private.current_company_id() and h.deleted_at is null and today');
 s:=replace(s,'''cover_tasks'',private.myday_cover_tasks(),','''cover_tasks'',private.myday_cover_tasks(), ''returning_handovers'',coalesce((select jsonb_agg(jsonb_build_object(''id'',h.id,''title'',h.title)) from public.work_handovers h where h.owner_id=u and h.company_id=private.current_company_id() and h.status=''approved'' and h.deleted_at is null and h.ends_on<=today),''[]''::jsonb),');
 execute s;
end$patch$;
