-- Additive handover workflow metadata; private review notes never enter the public row.
alter table public.work_handovers add column title_renamed boolean not null default true,add column return_unknown boolean not null default false,
 add column wizard_step smallint not null default 0 check(wizard_step between 0 and 3),
 add column selected_records jsonb not null default '[]' check(jsonb_typeof(selected_records)='array'),
 add column source_selection_set boolean not null default false,
 add column priority_order jsonb not null default '[]' check(jsonb_typeof(priority_order)='array'),
 add column deleted_at timestamptz;
create table private.handover_policy(company_id uuid primary key references public.companies(id),approval_required boolean not null default true,allow_top_no_approval boolean not null default false,approver_roles text[] not null default array['manager','hr_admin'],minimum_notice_days integer not null default 0 check(minimum_notice_days between 0 and 90),external_sharing boolean not null default false,link_expiry_days integer not null default 14 check(link_expiry_days between 1 and 30),cover_visibility text not null default 'approval' check(cover_visibility in ('approval','assignment')),required_sections text[] not null default array['priorities'],cover_capacity integer not null default 3 check(cover_capacity between 1 and 50));
create table private.handover_manager_notes(handover_id uuid primary key references public.work_handovers(id),body text not null default '' check(length(body)<=3000));
create table private.handover_comments(id uuid primary key default gen_random_uuid(),handover_id uuid not null references public.work_handovers(id),author_id uuid not null references public.profiles(id),body text not null check(length(btrim(body)) between 1 and 3000),created_at timestamptz not null default now());
create index handover_comments_thread on private.handover_comments(handover_id,created_at);
create table private.handover_share_views(id bigint generated always as identity primary key,share_id uuid not null references private.handover_shares(id),viewed_at timestamptz not null default now());
create index handover_share_views_link on private.handover_share_views(share_id,viewed_at);
alter table private.handover_shares add column recipient_email text not null default '' check(length(recipient_email)<=254),add column section_keys jsonb not null default '[]';
create table private.handover_reminder_log(handover_id uuid references public.work_handovers(id),kind text not null,day date not null,primary key(handover_id,kind,day));
alter table private.handover_policy enable row level security;
alter table private.handover_manager_notes enable row level security;
alter table private.handover_comments enable row level security;
alter table private.handover_share_views enable row level security;
alter table private.handover_reminder_log enable row level security;
revoke all on private.handover_policy,private.handover_manager_notes,private.handover_comments,private.handover_share_views,private.handover_reminder_log from public,anon,authenticated;
create or replace function private.handover_task_eligible(a public.actions,own uuid,r uuid,actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select a.company_id=private.current_company_id() and a.owner_id=own and a.deleted_at is null and a.purged_at is null and (own=actor or a.context_added_at is not null and (exists(select 1 from public.role_items i where i.id=a.context_record_id and i.role_id=r and i.deleted_at is null and not exists(select 1 from private.role_item_settings s where s.item_id=i.id and(s.is_private or not s.include_in_handover))) or exists(select 1 from public.decisions d where d.id=a.context_record_id and d.role_id=r and d.deleted_at is null and not exists(select 1 from private.role_item_settings s where s.item_id=d.id and(s.is_private or not s.include_in_handover)))));
$$;
revoke all on function private.handover_task_eligible(public.actions,uuid,uuid,uuid) from public,anon,authenticated;
create or replace function private.handover_authorized(h public.work_handovers,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.company_id=h.company_id and (p.id=h.owner_id or p.id=h.created_by and p.role in('manager','hr_admin') and private.can_read_role(h.owner_id) or not p_write and (p.role='hr_admin' or p.id=h.reviewer_id and p.role in('manager','hr_admin') or p.id=h.cover_id and h.deleted_at is null and (h.status in('approved','completed') or coalesce((select cover_visibility='assignment' from private.handover_policy where company_id=h.company_id),false) and h.status in('draft','pending','declined')))));
$$;

create table private.handover_share_drafts(handover_id uuid primary key references public.work_handovers(id),options jsonb not null default '{}' check(jsonb_typeof(options)='object' and octet_length(options::text)<=4000));
alter table private.handover_share_drafts enable row level security;
revoke all on private.handover_share_drafts from public,anon,authenticated;

alter table private.handover_items add column checked_at timestamptz,add column completed_by uuid references public.profiles(id),add column completed_at timestamptz;

-- The final client brief supersedes the old internal phase gates. Sharing still requires company consent.
alter table private.handover_features alter column sudden set default true,alter column exit set default true,alter column pdf set default true;
update private.handover_features set sudden=true,exit=true,pdf=true;

CREATE OR REPLACE FUNCTION private.handover_client_setup(p_operation text, p_id uuid, p_data jsonb)
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
 if operation='policy' then return to_jsonb(pol)||jsonb_build_object('admin',v.role='hr_admin');
 elsif operation='policy_save' then
 if v.role<>'hr_admin' then raise insufficient_privilege;end if;
 if coalesce((p_data->>'approval_required')::boolean,pol.approval_required) and jsonb_array_length(coalesce(p_data->'approver_roles',to_jsonb(pol.approver_roles)))=0 then raise check_violation using message='Choose at least one approver role';end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(p_data->'approver_roles',to_jsonb(pol.approver_roles))) allowed(value) where allowed.value not in('manager','hr_admin')) or exists(select 1 from jsonb_array_elements_text(coalesce(p_data->'required_sections',to_jsonb(pol.required_sections))) allowed(value) where allowed.value not in('summary','priorities','work','tasks','dates','decisions','contacts','documents','watch_outs','notes')) then raise invalid_parameter_value;end if;
 insert into private.handover_policy(company_id,approval_required,allow_top_no_approval,approver_roles,minimum_notice_days,external_sharing,link_expiry_days,cover_visibility,required_sections,cover_capacity)
 values(c,coalesce((p_data->>'approval_required')::boolean,pol.approval_required),coalesce((p_data->>'allow_top_no_approval')::boolean,pol.allow_top_no_approval),array(select jsonb_array_elements_text(coalesce(p_data->'approver_roles',to_jsonb(pol.approver_roles)))),coalesce((p_data->>'minimum_notice_days')::int,pol.minimum_notice_days),coalesce((p_data->>'external_sharing')::boolean,pol.external_sharing),coalesce((p_data->>'link_expiry_days')::int,pol.link_expiry_days),coalesce(p_data->>'cover_visibility',pol.cover_visibility),array(select jsonb_array_elements_text(coalesce(p_data->'required_sections',to_jsonb(pol.required_sections)))),coalesce((p_data->>'cover_capacity')::int,pol.cover_capacity))
 on conflict(company_id) do update set approval_required=excluded.approval_required,allow_top_no_approval=excluded.allow_top_no_approval,approver_roles=excluded.approver_roles,minimum_notice_days=excluded.minimum_notice_days,external_sharing=excluded.external_sharing,link_expiry_days=excluded.link_expiry_days,cover_visibility=excluded.cover_visibility,required_sections=excluded.required_sections,cover_capacity=excluded.cover_capacity;
 insert into private.handover_features(company_id,sudden,exit,pdf,sharing) values(c,true,true,true,coalesce((p_data->>'external_sharing')::boolean,pol.external_sharing)) on conflict(company_id) do update set sharing=excluded.sharing;
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'handover_settings',c,'updated');return private.handover_client_setup('policy',null,'{}');
 elsif operation='overview' then
 if v.role<>'hr_admin' then raise insufficient_privilege;end if;
 return jsonb_build_object('upcoming',(select count(*) from public.work_handovers where company_id=c and deleted_at is null and status not in('cancelled','completed') and starts_on>current_date),'unapproved',(select count(*) from public.work_handovers where company_id=c and deleted_at is null and status in('draft','pending','declined')),'missing_cover',(select count(*) from public.work_handovers where company_id=c and deleted_at is null and cover_id is null and status not in('cancelled','completed')));
 elsif operation='warnings' then
 owner:=coalesce(nullif(p_data->>'owner_id','')::uuid,u);rid:=coalesce(nullif(p_data->>'role_id','')::uuid,private.ensure_role(owner));
 if owner<>u and(v.role not in('manager','hr_admin') or not private.can_read_role(owner)) then raise insufficient_privilege;end if;
 chosen:=nullif(p_data->>'cover_id','')::uuid;
 if chosen is not null and not exists(select 1 from public.profiles where id=chosen and company_id=c and active) then raise insufficient_privilege;end if;
 return jsonb_build_object('cover_away',exists(select 1 from public.work_handovers w where w.company_id=c and w.owner_id=chosen and w.id is distinct from p_id and w.deleted_at is null and w.status in('pending','approved') and daterange(w.starts_on,coalesce(w.ends_on,'infinity'::date),'[]')&&daterange(nullif(p_data->>'starts_on','')::date,coalesce(nullif(p_data->>'ends_on','')::date,'infinity'::date),'[]')),
 'cover_load',(select count(*) from public.work_handovers w where w.company_id=c and w.cover_id=chosen and w.id is distinct from p_id and w.deleted_at is null and w.status in('pending','approved') and daterange(w.starts_on,coalesce(w.ends_on,'infinity'::date),'[]')&&daterange(nullif(p_data->>'starts_on','')::date,coalesce(nullif(p_data->>'ends_on','')::date,'infinity'::date),'[]')),
 'overlap',exists(select 1 from public.work_handovers w where w.company_id=c and w.owner_id=owner and w.id is distinct from p_id and w.deleted_at is null and w.status not in('cancelled','completed') and daterange(w.starts_on,coalesce(w.ends_on,'infinity'::date),'[]')&&daterange(nullif(p_data->>'starts_on','')::date,coalesce(nullif(p_data->>'ends_on','')::date,'infinity'::date),'[]')));
 end if;
 if operation='template' then
 select * into rp from public.role_profiles where id=(p_data->>'role_id')::uuid and company_id=c;
 if not found or rp.holder_id<>u and(v.role not in('manager','hr_admin') or not private.can_read_role(rp.holder_id)) then raise insufficient_privilege;end if;
 select t.snapshot into content from private.role_templates t where t.id=p_id and t.company_id=c and(t.department_id is null or t.department_id=rp.department_id);
 if content is null then raise insufficient_privilege;end if;
 return jsonb_build_object('work',coalesce((select string_agg(j->>'title',E'\n') from jsonb_array_elements(coalesce(content->'items','[]'))j where j->>'kind' in('responsibility','workstream')),''),'decisions',coalesce((select string_agg(j->>'title',E'\n') from jsonb_array_elements(coalesce(content->'decisions','[]'))j),''),'summary',coalesce(content->>'summary',''));
 end if;

 if operation='options' then
 owner:=coalesce(nullif(p_data->>'owner','')::uuid,u);rid:=coalesce(nullif(p_data->>'role','')::uuid,private.ensure_role(owner));select * into rp from public.role_profiles where id=rid and holder_id=owner and company_id=c;
 if not found or owner<>u and (not coalesce(f.sudden,true) or not private.can_read_role(owner) or v.role not in('manager','hr_admin')) then raise insufficient_privilege;end if;
 return jsonb_build_object('role',to_jsonb(rp),'today',(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date,'readiness',private.role_ready(rid),'policy',to_jsonb(pol),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'role',p.role,'department',d.name,'photo',to_jsonb(p)->>'avatar_url','reviewer',p.id<>owner and p.role=any(pol.approver_roles))) from public.profiles p left join public.departments d on d.id=p.department_id where p.company_id=c and p.active and p.id<>owner),'[]'),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'owner',r.holder_id,'name',p.full_name)) from public.role_profiles r join public.profiles p on p.id=r.holder_id and p.active where r.company_id=c and(r.holder_id=u or coalesce(f.sudden,true) and v.role in('hr_admin','manager') and private.can_read_role(r.holder_id))),'[]'),
 'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'due_date',a.due_date,'priority',a.priority)) from public.actions a where private.handover_task_eligible(a,owner,rid,u) and a.status<>'done'),'[]'),
 'decisions',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'reviewed_at',d.reviewed_at,'do_not_change',coalesce(s.do_not_change,false))) from public.decisions d left join private.role_item_settings s on s.item_id=d.id where d.role_id=rid and not coalesce(s.is_private,false) and coalesce(s.include_in_handover,true) and d.status='live' and d.deleted_at is null),'[]'),
 'records',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'group',case when i.kind in('responsibility','workstream') then 'work' when i.kind='external_contact' then 'contacts' when i.kind='document' then 'documents' else 'dates' end,'reviewed_at',i.reviewed_at,'do_not_change',coalesce(s.do_not_change,false))) from public.role_items i left join private.role_item_settings s on s.item_id=i.id where i.role_id=rid and i.deleted_at is null and not coalesce(s.is_private,false) and coalesce(s.include_in_handover,true) and (i.kind<>'external_contact' or private.role_access(rid,true))),'[]'),
 'notes',case when owner=u then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'title',left(n.body,100),'group','notes','reviewed_at',n.updated_at)) from private.role_notes n where n.role_id=rid and n.author_id=u and n.include_in_handover),'[]') else '[]' end,
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name)) from private.role_templates t where t.company_id=c and(t.department_id is null or t.department_id=rp.department_id)),'[]'),
 'last_handover',(select w.id from public.work_handovers w where w.owner_id=owner and w.role_id=rid and w.deleted_at is null and w.id is distinct from p_id and private.handover_authorized(w,true) order by w.updated_at desc limit 1));

 end if;

 raise invalid_parameter_value;end$function$;
revoke all on function private.handover_client_setup(text,uuid,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.handover_client_actions(p_operation text, p_id uuid, p_data jsonb)
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
select * into h from public.work_handovers where id=p_id and company_id=c for update; if not found or not private.handover_authorized(h) then raise insufficient_privilege;end if;
 if operation='withdraw' then
 if not private.handover_authorized(h,true) or h.status<>'pending' then raise insufficient_privilege;end if;
 update public.work_handovers set status='draft',version=version+1,updated_at=now() where id=h.id;
 if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'Handover withdrawn');end if;
 perform private.handover_event(h.id,'withdrawn');return private.handover_snapshot(h.id);
 elsif operation in('delete','undo_delete') then
 if not private.handover_authorized(h,true) or h.status<>'draft' or operation='undo_delete' and(h.deleted_at is null or h.deleted_at<now()-interval '5 minutes') then raise insufficient_privilege;end if;
 update public.work_handovers set deleted_at=case when operation='delete' then now() else null end,version=version+1,updated_at=now() where id=h.id;
 perform private.handover_event(h.id,operation);return private.handover_snapshot(h.id);
 elsif operation='comment' then
 if h.deleted_at is not null or length(btrim(coalesce(p_data->>'body',''))) not between 1 and 3000 then raise invalid_parameter_value;end if;
 insert into private.handover_comments(handover_id,author_id,body) values(h.id,u,btrim(p_data->>'body'));
 insert into private.handover_notifications(handover_id,owner_id,message) select h.id,x,'New handover question or reply' from (select distinct unnest(array[h.owner_id,h.reviewer_id,h.cover_id]) x)t where x is not null and x<>u;
 perform private.handover_event(h.id,'commented');return private.handover_workspace('get',h.id,'{}');
 elsif operation='comments' then
 return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'author',p.full_name,'body',q.body,'created_at',q.created_at) order by q.created_at) from private.handover_comments q join public.profiles p on p.id=q.author_id where q.handover_id=h.id),'[]');
 elsif operation='preview' then
 if not private.handover_authorized(h,true) and h.reviewer_id<>u then raise insufficient_privilege;end if;
 perform private.handover_event(h.id,'previewed');return private.handover_snapshot(h.id)-'note_for_manager';
 elsif operation='copy_last' then
 if not private.handover_authorized(h,true) then raise insufficient_privilege;end if;
 return jsonb_build_object('sections',h.sections-array['reason','note_for_manager','return_summary'],'selected_records',h.selected_records,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.record_id,'kind',i.kind,'do_not_change',i.do_not_change)) from private.handover_items i where i.handover_id=h.id),'[]'));
 elsif operation='reassign_tasks' then
 if not private.handover_authorized(h,true) or h.handover_type<>'exit' or h.status not in('draft','declined') then raise insufficient_privilege;end if;
 for item in select * from jsonb_array_elements(coalesce(p_data->'assignments','[]')) loop
 chosen:=(item->>'owner')::uuid;itemid:=(item->>'id')::uuid;
 if not exists(select 1 from public.profiles where id=chosen and company_id=c and active) or not exists(select 1 from private.handover_items where handover_id=h.id and kind='task' and record_id=itemid) then raise insufficient_privilege;end if;
 update public.actions set owner_id=chosen,updated_at=now() where id=itemid and owner_id=h.owner_id and company_id=c and status<>'done' and deleted_at is null;
 if not found then raise check_violation using message='This task changed. Reload before reassigning.';end if;
 delete from private.handover_items where handover_id=h.id and kind='task' and record_id=itemid;
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'task',itemid,'reassigned_at_exit');
 end loop;
 perform private.handover_event(h.id,'tasks_reassigned');return private.handover_snapshot(h.id);
 end if;


 raise invalid_parameter_value;end$function$;
revoke all on function private.handover_client_actions(text,uuid,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.handover_snapshot(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select (to_jsonb(h)-'body'-'sections')||jsonb_build_object('sections',h.sections-array['reason','note_for_manager'],'body',(select string_agg(e.key||E'\n'||e.value,E'\n\n') from jsonb_each_text(h.sections-array['reason','note_for_manager'])e),'share_draft',case when auth.uid() in(h.owner_id,h.reviewer_id) then (select options from private.handover_share_drafts where handover_id=h.id) else null end,'note_for_manager',case when auth.uid() in(h.owner_id,h.reviewer_id) then coalesce((select body from private.handover_manager_notes where handover_id=h.id),h.sections->>'reason','') else '' end,'display_status',private.handover_view_status(h),'owner_name',o.full_name,'cover_name',c.full_name,'reviewer_name',m.full_name,'changed_since_approval',h.approved_version is not null and h.version>h.approved_version,'items',coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'id',i.record_id,'do_not_change',i.do_not_change,'approved',i.approved,'checked',i.checked_at is not null,'title',case when i.kind='task' then a.title else d.title end,'status',a.status)) from private.handover_items i left join public.actions a on i.kind='task' and a.id=i.record_id left join public.decisions d on i.kind='decision' and d.id=i.record_id where i.handover_id=h.id),'[]')) from public.work_handovers h join public.profiles o on o.id=h.owner_id left join public.profiles c on c.id=h.cover_id left join public.profiles m on m.id=h.reviewer_id where h.id=p_id
$function$;

CREATE OR REPLACE FUNCTION private.myday_cover_tasks()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select a.id,a.title,a.status,a.due_date,a.due_at,d.name as department_name,p.full_name as owner_name,p.id as owner_id
 from public.actions a join public.profiles p on p.id=a.owner_id and p.active left join public.departments d on d.id=a.department_id
 where a.company_id=private.current_company_id() and a.deleted_at is null and a.status<>'done'
 and exists(select 1 from public.work_handovers h where h.owner_id=a.owner_id and h.company_id=a.company_id and h.cover_id=auth.uid() and h.status='approved' and h.deleted_at is null and (not h.structured or exists(select 1 from private.handover_items hi where hi.handover_id=h.id and hi.record_id=a.id and hi.kind='task' and hi.approved))
 and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date between h.starts_on and coalesce(h.ends_on,'infinity'::date))
 order by a.due_at,a.id limit 60)x
$function$;

create or replace function private.myday_handovers() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text;begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');
 return jsonb_build_object('today',(now() at time zone tz)::date,'timezone',tz,'rows',coalesce((select jsonb_agg(private.handover_snapshot(w.id) order by w.updated_at desc) from public.work_handovers w where w.company_id=private.current_company_id() and w.deleted_at is null and private.handover_authorized(w) and(w.owner_id=auth.uid() or w.reviewer_id=auth.uid() or w.cover_id=auth.uid())),'[]'));
end$$;

create or replace function private.handover_shared(p_token text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare s private.handover_shares;begin
 select sh.* into s from private.handover_shares sh join public.work_handovers h on h.id=sh.handover_id join private.handover_policy p on p.company_id=h.company_id and p.external_sharing where sh.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and length(p_token)=64 and sh.revoked_at is null and sh.expires_at>now() and h.deleted_at is null and h.status in('approved','completed');
 if not found then return null;end if;
 insert into private.handover_share_views(share_id) values(s.id);
 return s.snapshot;
end$$;
-- The public capability reader also writes its view audit.
create or replace function public.handover_shared(p_token text) returns jsonb language sql volatile security invoker set search_path='' as $$select private.handover_shared(p_token)$$;
create or replace function handover_capabilities.read(p_token text) returns jsonb language sql volatile security definer set search_path='' as $$select private.handover_shared(p_token)$$;
create or replace function public.handover_shared(p_token text) returns jsonb language sql volatile security invoker set search_path='' as $$select handover_capabilities.read(p_token)$$;
create or replace function private.handover_event(p_id uuid,p_operation text) returns void language plpgsql security definer set search_path='' as $$
declare h public.work_handovers;event text;begin
 select * into h from public.work_handovers where id=p_id;
 event:=case p_operation when 'save' then case when h.version=1 then 'started' else 'edited' end when 'submit' then 'submitted' when 'approve' then 'approved' when 'request_changes' then 'changes_requested' when 'take_back' then 'taken_back' when 'cancel' then 'cancelled' else p_operation end;
 insert into private.handover_history(handover_id,version,actor_id,operation,snapshot) values(h.id,h.version,auth.uid(),event,to_jsonb(h)||jsonb_build_object('note_for_manager',coalesce((select body from private.handover_manager_notes where handover_id=h.id),''),'items',coalesce((select jsonb_agg(to_jsonb(i)) from private.handover_items i where i.handover_id=h.id),'[]')));
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(h.company_id,auth.uid(),'handover',h.id,event);
end$$;
