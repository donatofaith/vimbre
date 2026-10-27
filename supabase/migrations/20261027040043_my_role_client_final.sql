-- Client's 27 October My role specification. Additive, owner-scoped settings.
create table private.role_item_settings (
 item_id uuid primary key, role_id uuid not null references public.role_profiles(id),
 include_in_handover boolean not null default true, is_private boolean not null default false,
 private_owner uuid references public.profiles(id), version integer not null default 1,
 deleted_by uuid references public.profiles(id), do_not_change boolean not null default false,
 linked_decision uuid references public.decisions(id), link_status text not null default 'unchecked' check(link_status in ('unchecked','ok','broken')),
 updated_at timestamptz not null default now(), check(not is_private or not include_in_handover)
);
create index role_settings_role on private.role_item_settings(role_id);
create table private.role_notes (
 id uuid primary key default gen_random_uuid(),role_id uuid not null references public.role_profiles(id),author_id uuid not null references public.profiles(id),
 body text not null check(length(btrim(body)) between 1 and 12000),include_in_handover boolean not null default false,source_note uuid,
 updated_at timestamptz not null default now(), unique(role_id,author_id,source_note)
);
insert into private.role_notes(role_id,author_id,body) select role_id,author_id,body from public.role_personal_notes where btrim(body)<>'';
create table private.role_events(id bigint generated always as identity primary key,role_id uuid not null references public.role_profiles(id),item_id uuid,actor_id uuid references public.profiles(id),action text not null,fields text[] not null default '{}',created_at timestamptz not null default now());
create index role_events_recent on private.role_events(role_id,id desc);
create table private.role_review_requests(id uuid primary key default gen_random_uuid(),role_id uuid not null references public.role_profiles(id),holder_id uuid not null references public.profiles(id),manager_id uuid not null references public.profiles(id),status text not null default 'pending' check(status in ('pending','approved','commented','outdated')),comment text not null default '' check(length(comment)<=5000),version bigint not null,created_at timestamptz not null default now(),checked_at timestamptz);
create unique index role_review_pending on private.role_review_requests(role_id) where status='pending';
create table private.role_templates(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),department_id uuid references public.departments(id),name text not null check(length(btrim(name)) between 1 and 200),snapshot jsonb not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create table private.role_incoming(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),recipient_id uuid not null references public.profiles(id),source_role uuid not null references public.role_profiles(id),snapshot jsonb not null,status text not null default 'pending' check(status in ('pending','accepted','declined')),created_at timestamptz not null default now());
create table private.role_guides(id uuid primary key default gen_random_uuid(),role_id uuid not null references public.role_profiles(id),token_hash text not null unique,expires_at timestamptz not null,revoked_at timestamptz,holder_id uuid not null references public.profiles(id),snapshot jsonb not null,created_at timestamptz not null default now());
create table private.role_review_config(company_id uuid primary key references public.companies(id),days integer not null default 90 check(days between 7 and 365));
create table private.role_mail(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),role_id uuid not null references public.role_profiles(id),period date not null,title text not null,body text not null,state text not null default 'queued' check(state in ('queued','claimed','sent','failed')),claimed_at timestamptz,unique(role_id,owner_id,period,title));
do $$declare t text;begin foreach t in array array['role_item_settings','role_notes','role_events','role_review_requests','role_templates','role_incoming','role_guides','role_review_config','role_mail'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);end loop;end$$;
create function private.role_item_visible(p_item uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.role_item_settings s where s.item_id=p_item and ((s.is_private and s.private_owner is distinct from auth.uid()) or (not s.include_in_handover and not exists(select 1 from public.role_profiles rp where rp.id=s.role_id and rp.holder_id=auth.uid()))))
$$;
revoke all on function private.role_item_visible(uuid) from public,anon,authenticated;grant execute on function private.role_item_visible(uuid) to authenticated;
create policy role_private_items on public.role_items as restrictive for select to authenticated using(private.role_item_visible(id));
create policy role_private_decisions on public.decisions as restrictive for select to authenticated using(private.role_item_visible(id));
create function private.role_safe_text(p_text text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_text,'') !~* '(sk-[a-zA-Z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY|password\s*[:=]\s*\S+|[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{4}|\m[0-9]{16}\M)'
$$;
create function private.role_ready(p_role uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.role_profiles;d integer;stale integer;steps jsonb:='[]';total integer:=6;begin
 select * into r from public.role_profiles where id=p_role;
 d:=coalesce((select days from private.role_review_config where company_id=r.company_id),90);
 if btrim(r.title)='' then steps:=steps||jsonb_build_array('Add your role title');end if;
 if r.department_id is null then steps:=steps||jsonb_build_array('Add your department in Team');end if;
 if r.manager_id is null then steps:=steps||jsonb_build_array('Add your line manager in Team');end if;
 if r.cover_id is null then steps:=steps||jsonb_build_array('Add a cover person');end if;
 if not exists(select 1 from public.role_items where role_id=p_role and deleted_at is null and kind in ('responsibility','workstream') and private.role_item_visible(id)) then steps:=steps||jsonb_build_array('Add work');end if;
 select count(*) into stale from (
 select id,reviewed_at from public.role_items where role_id=p_role and deleted_at is null and private.role_item_visible(id)
 union all select id,reviewed_at from public.decisions where role_id=p_role and deleted_at is null and status='live' and private.role_item_visible(id)
 ) x where reviewed_at is null or reviewed_at<now()-make_interval(days=>d);
 if stale>0 then steps:=steps||jsonb_build_array('Check '||stale||case when stale=1 then ' item' else ' items' end);end if;
 return jsonb_build_object('steps',steps,'left',jsonb_array_length(steps),'done',total-jsonb_array_length(steps),'total',total,'overdue',stale,'review_days',d);
end$$;
create function private.role_export(p_role uuid,p_notes boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.role_profiles;outdata jsonb;begin
 select * into r from public.role_profiles where id=p_role;
 select jsonb_build_object('title',r.title,'holder',(select full_name from public.profiles where id=r.holder_id),'department',(select name from public.departments where id=r.department_id),'summary',coalesce((select body from private.role_notes where role_id=r.id and author_id=r.holder_id and source_note=r.id and include_in_handover),''),
 'items',coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'title',i.title,'fields',(i.role_fields-array['source_url','capture_id','file_path','title','do_not_change','linked_decision','id','kind','version','include_in_handover','is_private'])||jsonb_build_object('details',i.details,'url',i.url,'recurrence',i.recurrence,'due_date',i.due_date,'contact_details',i.contact_details),'reviewed_at',i.reviewed_at,'do_not_change',coalesce(s.do_not_change,false))) from public.role_items i left join private.role_item_settings s on s.item_id=i.id where i.role_id=r.id and i.deleted_at is null and (i.kind<>'external_contact' or private.role_access(r.id,true)) and coalesce(s.include_in_handover,true) and not coalesce(s.is_private,false)),'[]'),
 'decisions',coalesce((select jsonb_agg(jsonb_build_object('kind','decision','title',i.title,'fields',(i.role_fields-array['source_url','capture_id','file_path','title','do_not_change','linked_decision','id','kind','version','include_in_handover','is_private'])||jsonb_build_object('reason',i.reason,'decided_by',i.decided_by,'decided_on',i.decided_on,'next_step',i.next_step),'reviewed_at',i.reviewed_at,'do_not_change',coalesce(s.do_not_change,false))) from public.decisions i left join private.role_item_settings s on s.item_id=i.id where i.role_id=r.id and i.deleted_at is null and i.status='live' and coalesce(s.include_in_handover,true) and not coalesce(s.is_private,false)),'[]'),
 'notes',case when p_notes then coalesce((select jsonb_agg(jsonb_build_object('body',n.body)) from private.role_notes n where n.role_id=r.id and n.author_id=r.holder_id and n.include_in_handover and n.source_note is distinct from r.id),'[]') else '[]'::jsonb end) into outdata;
 return outdata;
end$$;
-- Versions/events contain field names, never personal content.
create function private.role_change_event() returns trigger language plpgsql security definer set search_path='' as $$
declare changed text[];op text;begin
 if TG_OP='UPDATE' then
 select array_agg(key) into changed from jsonb_each(to_jsonb(new)) where key not in ('updated_at','reviewed_at') and value is distinct from to_jsonb(old)->key;
 op:=case when new.deleted_at is not null and old.deleted_at is null then 'removed' when new.deleted_at is null and old.deleted_at is not null then 'restored' when changed is null then 'checked' else 'edited' end;
 else op:='added';end if;
 insert into private.role_events(role_id,item_id,actor_id,action,fields) values(new.role_id,new.id,auth.uid(),op,coalesce(changed,'{}'));
 insert into private.role_item_settings(item_id,role_id) values(new.id,new.role_id) on conflict(item_id) do update set version=role_item_settings.version+1,updated_at=now(),deleted_by=case when op='removed' then auth.uid() else role_item_settings.deleted_by end;
 update private.role_review_requests set status='outdated' where role_id=new.role_id and status in ('pending','approved');
 return new;
end$$;
create trigger role_client_item_event after insert or update on public.role_items for each row execute function private.role_change_event();
create trigger role_client_decision_event after insert or update on public.decisions for each row execute function private.role_change_event();
alter function private.role_workspace(text,uuid,jsonb) rename to role_workspace_previous;
create function private.role_workspace(p_operation text,p_role uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();r public.role_profiles;v public.profiles;result jsonb;rowdata jsonb;item uuid;k text;f jsonb;s private.role_item_settings;ex jsonb;entry jsonb;target uuid;token text;request private.role_review_requests;note private.role_notes;
begin
 if u is null or c is null or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>24000 then raise insufficient_privilege;end if;
 if not private.role_safe_text(p_data::text) then raise check_violation using message='Remove passwords, API keys and card numbers. Say where to find access instead.';end if;
 select * into v from public.profiles where id=u and active and company_id=c;if not found then raise insufficient_privilege;end if;
 if p_operation='team_readiness' then
 if v.role not in ('hr_admin','manager') then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('role_id',rp.id,'holder',p.full_name,'title',rp.title,'readiness',private.role_ready(rp.id))) from public.role_profiles rp join public.profiles p on p.id=rp.holder_id and p.active where rp.company_id=c and (v.role='hr_admin' or rp.department_id=v.department_id)),'[]');
 elsif p_operation='notices' then
 return coalesce((select jsonb_agg(x) from (
 select rr.id,rr.role_id,'Role ready for review' title,rr.created_at from private.role_review_requests rr join public.role_profiles rp on rp.id=rr.role_id where rr.manager_id=u and rr.status='pending' and rp.manager_id=u and private.role_access(rp.id)
 union all select rp.id,rp.id,'Still correct? Review your role.' title,now() from public.role_profiles rp where rp.holder_id=u and rp.company_id=c and (private.role_ready(rp.id)->>'overdue')::int>0
 )x),'[]');
 end if;
 p_role:=coalesce(p_role,private.ensure_role(u));
 select * into r from public.role_profiles where id=p_role and company_id=c for update;
 if not found or not private.role_access(r.id) then raise insufficient_privilege;end if;
 if p_operation='get' then
 result:=private.role_workspace_previous('get',r.id,p_data);
 select coalesce(jsonb_agg(e.value||coalesce((select to_jsonb(ss)-array['item_id','role_id','private_owner'] from private.role_item_settings ss where ss.item_id=(e.value->>'id')::uuid),'{}')),'[]') into ex from jsonb_array_elements(result->'items') e where private.role_item_visible((e.value->>'id')::uuid) and (r.holder_id=u or not exists(select 1 from private.role_item_settings ss where ss.item_id=(e.value->>'id')::uuid and not ss.include_in_handover));
 result:=jsonb_set(result,'{items}',ex);
 select coalesce(jsonb_agg(e.value||coalesce((select to_jsonb(ss)-array['item_id','role_id','private_owner'] from private.role_item_settings ss where ss.item_id=(e.value->>'id')::uuid),'{}')),'[]') into ex from jsonb_array_elements(result->'decisions')e where private.role_item_visible((e.value->>'id')::uuid) and (r.holder_id=u or not exists(select 1 from private.role_item_settings ss where ss.item_id=(e.value->>'id')::uuid and not ss.include_in_handover));
 result:=jsonb_set(result,'{decisions}',ex);
 return result||jsonb_build_object('can_review',r.manager_id=u and v.role in ('manager','hr_admin'),'can_manage_templates',v.role='hr_admin' or v.role='manager' and v.department_id=r.department_id,'can_admin',v.role='hr_admin','readiness',private.role_ready(r.id),'review',coalesce((select to_jsonb(rr)||jsonb_build_object('manager_name',p.full_name) from private.role_review_requests rr join public.profiles p on p.id=rr.manager_id where rr.role_id=r.id order by rr.created_at desc limit 1),'null'),
 'note_entries',case when r.holder_id=u then coalesce((select jsonb_agg(to_jsonb(n)) from private.role_notes n where role_id=r.id and author_id=u and source_note is null),'[]') else '[]'::jsonb end,
 'summary',coalesce((select body from private.role_notes where role_id=r.id and source_note=r.id and author_id=r.holder_id and (r.holder_id=u or include_in_handover)),''),
 'outcomes',case when r.holder_id=u then coalesce((select jsonb_agg(to_jsonb(n)||jsonb_build_object('included',exists(select 1 from private.role_notes rn where rn.role_id=r.id and rn.author_id=u and rn.source_note=n.id and rn.include_in_handover))) from(select id,title,details,created_at from public.role_work_notes where owner_id=u order by created_at desc,id limit 50)n),'[]') else '[]'::jsonb end,
 'history',coalesce((select jsonb_agg(x) from(select ev.item_id,ev.action,ev.fields,ev.created_at,p.full_name actor from private.role_events ev left join public.profiles p on p.id=ev.actor_id where ev.role_id=r.id and (ev.item_id is null or private.role_item_visible(ev.item_id)) order by ev.id desc limit 100)x),'[]'),
 'last_handover', (select max(created_at) from public.work_handovers where role_id=r.id),
 'task_stats',case when r.holder_id=u then coalesce((select jsonb_agg(x) from(select coalesce(stable_role_item_id,source_role_id,recurring_id) item_id,count(*) filter(where status='done') done_count,max(completed_at) last_done from public.actions where owner_id=u and company_id=c and deleted_at is null group by coalesce(stable_role_item_id,source_role_id,recurring_id))x where x.item_id is not null),'[]') else '[]'::jsonb end,
 'incoming',case when r.holder_id=u then coalesce((select jsonb_agg(jsonb_build_object('id',id,'snapshot',snapshot)) from private.role_incoming where recipient_id=u and company_id=c and status='pending'),'[]') else '[]'::jsonb end,
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from private.role_templates where company_id=c and (department_id is null or department_id=r.department_id)),'[]'));
 elsif p_operation='preview' then return private.role_export(r.id,r.holder_id=u);
 elsif p_operation='review_response' then
 select * into request from private.role_review_requests where id=(p_data->>'id')::uuid and role_id=r.id for update;
 if not found or request.manager_id<>u or r.manager_id<>u or v.role not in ('manager','hr_admin') or request.status<>'pending' then raise insufficient_privilege;end if;
 if request.version<>(select coalesce(max(id),0) from private.role_events where role_id=r.id) then raise exception 'The role changed. Ask for a fresh review.' using errcode='40001';end if;
 if p_data->>'status' not in ('approved','commented') or p_data->>'status'='commented' and btrim(coalesce(p_data->>'comment',''))='' then raise invalid_parameter_value;end if;
 update private.role_review_requests set status=p_data->>'status',comment=left(coalesce(p_data->>'comment',''),5000),checked_at=now() where id=request.id;
 insert into private.myday_notifications(owner_id,company_id,title,body) values(r.holder_id,c,case when p_data->>'status'='approved' then 'Your role was checked' else 'Your manager commented on your role' end,left(coalesce(p_data->>'comment',''),5000));
 elsif p_operation='review_period' then
 if v.role<>'hr_admin' then raise insufficient_privilege;end if;
 insert into private.role_review_config(company_id,days) values(c,(p_data->>'days')::int) on conflict(company_id) do update set days=excluded.days;
 elsif p_operation='templates_save' then
 if not(v.role='hr_admin' or v.role='manager' and v.department_id=r.department_id) then raise insufficient_privilege;end if;
 insert into private.role_templates(company_id,department_id,name,snapshot,created_by) values(c,r.department_id,btrim(p_data->>'name'),private.role_export(r.id,false)-array['notes','summary'],u) returning id into item;
 else
 if r.holder_id<>u then raise insufficient_privilege using message='This role is read only';end if;
 if p_operation in ('save','replace','archive','review','duplicate','settings','link_status') then
 item:=nullif(p_data->>'id','')::uuid;k:=p_data->>'kind';
 if item is not null then
 if k='decision' then select to_jsonb(d) into rowdata from public.decisions d where id=item and role_id=r.id for update;
 else select to_jsonb(i) into rowdata from public.role_items i where id=item and role_id=r.id and kind=k for update;end if;
 if rowdata is null or not private.role_item_visible(item) then raise insufficient_privilege;end if;
 select * into s from private.role_item_settings where item_id=item;
 if p_data ? 'version' and coalesce(s.version,1)<>(p_data->>'version')::int then raise exception 'This item changed. Reload before saving.' using errcode='40001';end if;
 if p_operation='archive' and coalesce((p_data->>'restore')::boolean,false) and (rowdata->>'deleted_at')::timestamptz<now()-interval '30 days' then raise check_violation using message='The 30-day restore period has ended';end if;
 end if;
 if p_operation='settings' and rowdata->>'status'='replaced' then raise check_violation using message='Replaced decisions retain their history';end if;
 if p_operation in ('save','replace','duplicate') then
 if not private.role_safe_text(p_data->>'title') or not private.role_safe_text(coalesce(p_data->'fields',rowdata->'role_fields')::text) then raise check_violation using message='Remove passwords, API keys and card numbers. Say where to find access instead.';end if;
 if p_operation='duplicate' then
 f:=coalesce(rowdata->'role_fields','{}')||jsonb_build_object('details',rowdata->>'details','recurrence',rowdata->>'recurrence','due_date',rowdata->>'due_date','url',rowdata->>'url','contact_details',rowdata->>'contact_details');
 if k='decision' then f:=coalesce(rowdata->'role_fields','{}')||jsonb_build_object('reason',rowdata->>'reason','decided_by',rowdata->>'decided_by','decided_on',rowdata->>'decided_on');end if;
 p_data:=jsonb_build_object('kind',k,'title',left(rowdata->>'title',193)||' (copy)','fields',f);item:=null;
 end if;
 if k in ('responsibility','workstream') and btrim(coalesce(p_data->'fields'->>'recurrence',''))='' then raise check_violation using message='Choose how often this work is done';end if;
 end if;
 if p_operation not in ('settings','link_status') then result:=private.role_workspace_previous(case when p_operation='duplicate' then 'save' else p_operation end,r.id,p_data);item:=(result->>'id')::uuid;end if;
 if item is null then raise insufficient_privilege;end if;
 if p_operation='link_status' then
 if p_data->>'status' not in ('ok','broken','unchecked') then raise invalid_parameter_value;end if;
 insert into private.role_item_settings(item_id,role_id,link_status) values(item,r.id,p_data->>'status') on conflict(item_id) do update set link_status=excluded.link_status;
 elsif p_operation='settings' or p_operation in ('save','replace') and p_data ? 'include_in_handover' then
 if rowdata is not null and coalesce(s.include_in_handover,true) and (coalesce((p_data->>'is_private')::boolean,false) or not coalesce((p_data->>'include_in_handover')::boolean,true)) then update private.role_guides set revoked_at=now() where role_id=r.id and revoked_at is null;end if;
 if coalesce((p_data->>'is_private')::boolean,false) and coalesce((p_data->>'include_in_handover')::boolean,true) then raise check_violation using message='Private items cannot be included in handover';end if;
 target:=nullif(p_data->>'linked_decision','')::uuid;
 if target is not null and not exists(select 1 from public.decisions where id=target and role_id=r.id and deleted_at is null and status='live' and private.role_item_visible(id)) then raise insufficient_privilege;end if;
 insert into private.role_item_settings(item_id,role_id,include_in_handover,is_private,private_owner,do_not_change,linked_decision) values(item,r.id,coalesce((p_data->>'include_in_handover')::boolean,true),coalesce((p_data->>'is_private')::boolean,false),u,coalesce((p_data->>'do_not_change')::boolean,false),target)
 on conflict(item_id) do update set include_in_handover=excluded.include_in_handover,is_private=excluded.is_private,private_owner=excluded.private_owner,do_not_change=excluded.do_not_change,linked_decision=excluded.linked_decision,version=role_item_settings.version+1,updated_at=now();
 end if;
 elsif p_operation='note_save' then
 item:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 if exists(select 1 from private.role_notes where id=item and (role_id<>r.id or author_id<>u)) then raise insufficient_privilege;end if;
 select * into note from private.role_notes where id=item and role_id=r.id and author_id=u;
 if note.include_in_handover and not coalesce((p_data->>'include_in_handover')::boolean,false) then update private.role_guides set revoked_at=now() where role_id=r.id and revoked_at is null;end if;
 if not private.role_safe_text(p_data->>'body') then raise check_violation using message='Remove passwords, API keys and card numbers.';end if;
 insert into private.role_notes(id,role_id,author_id,body,include_in_handover) values(item,r.id,u,btrim(p_data->>'body'),coalesce((p_data->>'include_in_handover')::boolean,false)) on conflict(id) do update set body=excluded.body,include_in_handover=excluded.include_in_handover,updated_at=now();
 elsif p_operation='note_remove' then
 if exists(select 1 from private.role_notes where id=(p_data->>'id')::uuid and role_id=r.id and author_id=u and include_in_handover) then update private.role_guides set revoked_at=now() where role_id=r.id and revoked_at is null;end if;
 delete from private.role_notes where id=(p_data->>'id')::uuid and role_id=r.id and author_id=u;
 elsif p_operation='outcome_include' then
 target:=(p_data->>'id')::uuid;
 select jsonb_build_object('title',title,'body',title||E'\n'||details) into rowdata from public.role_work_notes where id=target and owner_id=u;
 if rowdata is null then raise insufficient_privilege;end if;
 if not private.role_safe_text(rowdata->>'body') then raise check_violation using message='Remove passwords, API keys and card numbers from the outcome first';end if;
 if coalesce((p_data->>'include')::boolean,false) then insert into private.role_notes(role_id,author_id,body,source_note,include_in_handover) values(r.id,u,rowdata->>'body',target,true) on conflict(role_id,author_id,source_note) do update set include_in_handover=true,body=excluded.body;
 else
 if exists(select 1 from private.role_notes where role_id=r.id and author_id=u and source_note=target and include_in_handover) then update private.role_guides set revoked_at=now() where role_id=r.id and revoked_at is null;end if;
 delete from private.role_notes where role_id=r.id and author_id=u and source_note=target;end if;
 elsif p_operation='review_request' then
 if r.manager_id is null or r.manager_id=u or not exists(select 1 from public.profiles where id=r.manager_id and active and company_id=c and role in ('manager','hr_admin')) then raise check_violation using message='Add a line manager in Team first';end if;
 insert into private.role_review_requests(role_id,holder_id,manager_id,version) values(r.id,u,r.manager_id,(select coalesce(max(id),0) from private.role_events where role_id=r.id)) on conflict(role_id) where status='pending' do nothing returning id into item;
 elsif p_operation='recurring' then
 item:=(p_data->>'id')::uuid;f:=p_data->'fields';
 if not exists(select 1 from public.role_items where id=item and role_id=r.id and kind in ('responsibility','workstream','recurring_deadline') and deleted_at is null and private.role_item_visible(id)) or not public.myday_valid_recurrence((f->>'due_date')::date,f->>'recurrence') then raise check_violation using message='Choose a start date and repeat rule';end if;
 insert into private.role_task_schedules(item_id,role_id,rule,anchor,next_date) values(item,r.id,f->>'recurrence',(f->>'due_date')::date,(f->>'due_date')::date) on conflict(item_id) do update set rule=excluded.rule,anchor=excluded.anchor,next_date=excluded.next_date,enabled=true;
 perform private.myday_role_task(item,(f->>'due_date')::date);
 elsif p_operation='linked_tasks' then
 item:=(p_data->>'id')::uuid;
 if not exists(select 1 from public.role_items where id=item and role_id=r.id and private.role_item_visible(id)) then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(x) from(select id,title,status,due_date from public.actions where owner_id=u and company_id=c and deleted_at is null and coalesce(stable_role_item_id,source_role_id,recurring_id)=item order by due_date desc nulls last,id limit 100)x),'[]');
 elsif p_operation='handover' then
 ex:=private.role_export(r.id,true);
 select coalesce(string_agg(e->>'title'||E'\n'||coalesce((e->'fields')::text,''),E'\n\n'),'') into token from jsonb_array_elements((ex->'items')||(ex->'decisions'))e;
 return jsonb_build_object('title',r.title||' handover','body',coalesce(ex->>'summary','')||E'\n\n'||token||E'\n\n'||coalesce((select string_agg(n->>'body',E'\n\n') from jsonb_array_elements(ex->'notes')n),''),'cover_id',r.cover_id,'reviewer_id',r.manager_id);

 elsif p_operation='guide_create' then
 if (p_data->>'expires')::timestamptz<=now() or (p_data->>'expires')::timestamptz>now()+interval '30 days' then raise check_violation using message='Choose an expiry within 30 days';end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.role_guides(role_id,token_hash,expires_at,holder_id,snapshot) values(r.id,encode(extensions.digest(token,'sha256'),'hex'),(p_data->>'expires')::timestamptz,u,private.role_export(r.id,true)) returning id into item;
 insert into private.role_events(role_id,actor_id,action) values(r.id,u,'guide shared');return jsonb_build_object('id',item,'token',token);
 elsif p_operation='guide_revoke' then update private.role_guides set revoked_at=now() where role_id=r.id and id=(p_data->>'id')::uuid;
 elsif p_operation='guides' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at,'revoked_at',revoked_at)) from private.role_guides where role_id=r.id order by created_at desc),'[]');
 elsif p_operation='suggestions' then
 return jsonb_build_object('work',coalesce((select jsonb_agg(x) from(select min(title) title,count(*) times from public.actions a where a.owner_id=u and a.company_id=c and a.status='done' and a.deleted_at is null and not exists(select 1 from public.role_items i where i.role_id=r.id and lower(i.title)=lower(a.title) and i.deleted_at is null) group by lower(title) having count(*)>=3 order by count(*) desc limit 5)x),'[]'),
 'contacts',coalesce((select jsonb_agg(x) from(select min((ci.payload->>'title')) title,count(distinct ci.capture_id) times from public.capture_items ci where ci.owner_id=u and ci.company_id=c and ci.kind='contact' and ci.status='confirmed' and not exists(select 1 from public.role_items i where i.role_id=r.id and lower(i.title)=lower((ci.payload->>'title')) and i.deleted_at is null) group by lower((ci.payload->>'title')) having count(distinct ci.capture_id)>=5 order by count(*) desc limit 5)x),'[]'));
 elsif p_operation='summary_source' then
 ex:=private.role_export(r.id,false);return jsonb_build_object('source',ex::text,'fingerprint',md5(ex::text),'cached',(select output from private.role_ai_results where role_id=r.id and holder_id=u and kind='summary' and fingerprint=md5(ex::text)));
 elsif p_operation='summary_cache' then
 ex:=private.role_export(r.id,false);if p_data->>'fingerprint' is distinct from md5(ex::text) or length(p_data->>'output')>6000 then raise invalid_parameter_value;end if;
 insert into private.role_ai_results(role_id,holder_id,kind,fingerprint,output) values(r.id,u,'summary',md5(ex::text),p_data->>'output') on conflict(role_id,holder_id,kind,fingerprint) do update set output=excluded.output;
 elsif p_operation='summary_save' then
 if not private.role_safe_text(p_data->>'body') or length(p_data->>'body')>6000 then raise check_violation;end if;
 insert into private.role_notes(role_id,author_id,source_note,body,include_in_handover) values(r.id,u,r.id,p_data->>'body',true) on conflict(role_id,author_id,source_note) do update set body=excluded.body,include_in_handover=true,updated_at=now();
 elsif p_operation='pass_role' then
 target:=(p_data->>'recipient')::uuid;
 if target=u or not exists(select 1 from public.profiles where id=target and active and company_id=c) then raise insufficient_privilege;end if;
 insert into private.role_incoming(company_id,recipient_id,source_role,snapshot) values(c,target,r.id,private.role_export(r.id,false)-array['notes','summary']) returning id into item;
 elsif p_operation in ('template_use','incoming_accept','incoming_decline') then
 if p_operation='template_use' then select snapshot into ex from private.role_templates where id=(p_data->>'id')::uuid and company_id=c and (department_id is null or department_id=r.department_id);
 else select snapshot into ex from private.role_incoming where id=(p_data->>'id')::uuid and company_id=c and recipient_id=u and status='pending' for update;end if;
 if ex is null then raise insufficient_privilege;end if;
 if p_operation<>'incoming_decline' then
 for entry in select * from jsonb_array_elements((ex->'items')||(ex->'decisions')) loop
 perform private.role_workspace('save',r.id,jsonb_build_object('kind',entry->>'kind','title',entry->>'title','fields',entry->'fields'));
 end loop;end if;
 if p_operation<>'template_use' then update private.role_incoming set status=case when p_operation='incoming_accept' then 'accepted' else 'declined' end where id=(p_data->>'id')::uuid and recipient_id=u;end if;
 else
 if p_operation in ('profile','notes','review_area','resolve','reassign') then
 if not private.role_safe_text(p_data::text) then raise check_violation using message='Remove passwords, API keys and card numbers.';end if;
 result:=private.role_workspace_previous(p_operation,p_role,p_data);
 else return private.role_workspace_previous(p_operation,p_role,p_data);end if;
 end if;
 end if;
 if p_operation not in ('review_request','review_response') then update private.role_review_requests set status='outdated' where role_id=r.id and status in ('pending','approved');end if;
 insert into private.role_events(role_id,item_id,actor_id,action) values(r.id,item,u,p_operation);
 if p_operation='review_request' then update private.role_review_requests set version=(select max(id) from private.role_events where role_id=r.id) where role_id=r.id and status='pending';end if;
 return jsonb_build_object('id',coalesce(item,r.id));
end$$;
-- The existing public RPC keeps its identity and permission boundary.
revoke all on function private.role_workspace_previous(text,uuid,jsonb),private.role_workspace(text,uuid,jsonb),private.role_ready(uuid),private.role_export(uuid,boolean),private.role_change_event(),private.role_safe_text(text) from public,anon,authenticated;
grant execute on function private.role_workspace(text,uuid,jsonb) to authenticated;
create function private.read_role_guide(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare outdata jsonb;begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise insufficient_privilege;end if;
 select g.snapshot into outdata from private.role_guides g join public.role_profiles rp on rp.id=g.role_id and rp.holder_id=g.holder_id join public.profiles p on p.id=g.holder_id and p.active and p.company_id=rp.company_id where g.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and g.revoked_at is null and g.expires_at>now();
 if outdata is null then raise insufficient_privilege using message='This role guide has expired or been revoked';end if;return outdata;
end$$;
revoke all on function private.read_role_guide(text) from public,anon,authenticated;grant execute on function private.read_role_guide(text) to anon,authenticated;
create function public.read_role_guide(p_token text) returns jsonb language sql security invoker set search_path='' as $$select private.read_role_guide(p_token)$$;
revoke all on function public.read_role_guide(text) from public,anon,authenticated;grant execute on function public.read_role_guide(text) to anon,authenticated;
-- Preserve task imports/scheduling, but make the newly core repeating-task feature available.
do $$declare d text;begin
 select pg_get_functiondef('private.process_role_schedules(timestamptz)'::regprocedure) into d;
 d:=replace(d,'(i.kind=''recurring_deadline'' or exists(select 1 from private.role_features where company_id=rp.company_id and recurring))','i.kind in (''responsibility'',''workstream'',''recurring_deadline'')');execute d;
end$$;
-- Handover population must honour item privacy/inclusion and explicit author note consent.
do $$declare d text;begin
 select pg_get_functiondef('private.handover_workspace(text,uuid,jsonb)'::regprocedure) into d;
 d:=replace(d,'i where role_id=h.role_id and deleted_at is null','i where role_id=h.role_id and deleted_at is null and not exists(select 1 from private.role_item_settings ris where ris.item_id=i.id and (ris.is_private or not ris.include_in_handover))');
 d:=replace(d,'id=itemid and role_id=rid and deleted_at is null and status=''live''','id=itemid and role_id=rid and deleted_at is null and status=''live'' and not exists(select 1 from private.role_item_settings ris where ris.item_id=itemid and (ris.is_private or not ris.include_in_handover))');
 d:=replace(d,'d.role_id=rp.id and d.status','d.role_id=rp.id and not exists(select 1 from private.role_item_settings ris where ris.item_id=d.id and (ris.is_private or not ris.include_in_handover)) and d.status');
 d:=replace(d,'d where role_id=h.role_id and status=''live''','d where role_id=h.role_id and not exists(select 1 from private.role_item_settings ris where ris.item_id=d.id and (ris.is_private or not ris.include_in_handover)) and status=''live''');
 d:=replace(d,'(select body from public.role_personal_notes where role_id=h.role_id and author_id=u)','(select string_agg(body,E''\n\n'') from private.role_notes where role_id=h.role_id and author_id=u and include_in_handover)');
 d:=replace(d,'''summary'',h.title','''summary'',coalesce((private.role_export(h.role_id,false))->>''summary'',h.title)');
 execute d;
end$$;
-- Summary uses the same centrally priced smaller model and allowance as role drafting.
insert into public.ai_task_routes(task,primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled)
select 'role_summary',primary_model_id,null,1024,null,enabled from public.ai_task_routes where task='role_responsibility' on conflict(task) do nothing;
create index role_notes_author on private.role_notes(role_id,author_id,updated_at desc);
create index role_review_latest on private.role_review_requests(role_id,created_at desc);
create index role_incoming_recipient on private.role_incoming(recipient_id,company_id) where status='pending';
create index role_templates_department on private.role_templates(company_id,department_id);
create index role_guides_role on private.role_guides(role_id,created_at desc);
create index role_mail_pending on private.role_mail(period,id) where state='queued';
-- Team remains the source of department and line manager values.
create function private.sync_role_team() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='profiles' then
 update public.role_profiles r set department_id=new.department_id,manager_id=(select manager_id from public.departments where id=new.department_id),updated_at=now() where r.holder_id=new.id;
 else update public.role_profiles r set manager_id=new.manager_id,updated_at=now() where r.department_id=new.id;end if;
 return new;
end$$;
create trigger role_client_team_profile after update of department_id on public.profiles for each row execute function private.sync_role_team();
create trigger role_client_team_manager after update of manager_id on public.departments for each row execute function private.sync_role_team();
update public.role_profiles r set department_id=p.department_id,manager_id=d.manager_id from public.profiles p left join public.departments d on d.id=p.department_id where p.id=r.holder_id and (r.department_id is distinct from p.department_id or r.manager_id is distinct from d.manager_id);
revoke all on function private.sync_role_team() from public,anon,authenticated;
-- One latest task notice per task; the current task state wins over historical alerts.
do $$declare d text;begin
 select pg_get_functiondef('public.myday_alerts()'::regprocedure) into d;
 if position('select n.*,a.title' in d)>0 then
 d:=replace(d,'select n.*,a.title','select distinct on (n.task_id) n.*,a.title');d:=replace(d,'order by n.created_at desc limit 50','order by n.task_id,n.created_at desc limit 50');execute d;
 end if;
end$$;
create function private.role_reminders(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$
declare r record;n integer:=0;begin
 for r in select rp.*,p.email,p.full_name from public.role_profiles rp join public.profiles p on p.id=rp.holder_id and p.active where (private.role_ready(rp.id)->>'overdue')::int>0 loop
 insert into private.role_mail(owner_id,role_id,period,title,body) values(r.holder_id,r.id,date_trunc('month',p_now)::date,'Still correct? Review your role.','Some role items are due for review. Open My role in Vimbre and check that they are still correct.'||E'\nhttps://vimbre.com/app/role-record?role='||r.id::text) on conflict do nothing;
 n:=n+1;
 end loop;return n;
end$$;
revoke all on function private.role_reminders(timestamptz) from public,anon,authenticated,service_role;
select cron.schedule('vimbre-role-reviews','15 8 * * *','select private.role_reminders();');
create function private.role_review_delivery(p_action text,p_id uuid,p_state text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if p_action='claim' then
 with q as(select m.id from private.role_mail m join public.profiles p on p.id=m.owner_id and p.active join public.role_profiles r on r.id=m.role_id and r.holder_id=p.id where m.state='queued' and (private.role_ready(r.id)->>'overdue')::int>0 and coalesce((select email_enabled from public.work_preferences where owner_id=p.id),true) order by m.period,m.id for update of m skip locked limit 10),claimed as(update private.role_mail m set state='claimed',claimed_at=now() from q where m.id=q.id returning m.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'email',p.email,'name',p.full_name,'title',m.title,'body',m.body)),'[]') into result from claimed m join public.profiles p on p.id=m.owner_id;
 return result;
 elsif p_action='finish' and p_state in ('sent','failed') then update private.role_mail set state=p_state where id=p_id and state='claimed';return '{}'::jsonb;
 else raise invalid_parameter_value;end if;
end$$;
revoke all on function private.role_review_delivery(text,uuid,text) from public,anon,authenticated;grant execute on function private.role_review_delivery(text,uuid,text) to service_role;
create function public.role_review_delivery(p_action text,p_id uuid default null,p_state text default null) returns jsonb language sql security invoker set search_path='' as $$select private.role_review_delivery(p_action,p_id,p_state)$$;
revoke all on function public.role_review_delivery(text,uuid,text) from public,anon,authenticated;grant execute on function public.role_review_delivery(text,uuid,text) to service_role;
-- Suppress superseded reminder entries and use the current owned task state.
alter function private.myday_suite(text,uuid,jsonb) rename to myday_suite_role_notice_base;
create function private.myday_suite(p_operation text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;u uuid:=auth.uid();c uuid:=private.current_company_id();begin
 if p_operation<>'notifications' then return private.myday_suite_role_notice_base(p_operation,p_id,p_data);end if;
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and active and company_id=c) then raise insufficient_privilege;end if;
 with latest as (
 select distinct on (coalesce(n.task_id,n.id)) n.id,n.title,n.body,n.task_id,n.assignment_id,n.created_at,a.status task_status
 from private.myday_notifications n left join public.actions a on a.id=n.task_id and a.owner_id=u and a.company_id=c
 where n.owner_id=u and n.company_id=c and n.read_at is null and n.source_alert_id is null
 and (n.task_id is null or a.id is not null and a.deleted_at is null and a.purged_at is null)
 order by coalesce(n.task_id,n.id),n.created_at desc,n.id
 ),page as(select * from latest order by created_at desc limit 100)
 select jsonb_build_object('unread',(select count(*) from latest),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;return result;
end$$;
revoke all on function private.myday_suite_role_notice_base(text,uuid,jsonb),private.myday_suite(text,uuid,jsonb) from public,anon,authenticated;grant execute on function private.myday_suite(text,uuid,jsonb) to authenticated;
