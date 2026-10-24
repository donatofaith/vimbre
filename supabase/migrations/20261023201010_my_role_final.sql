-- Stable role identity; existing item IDs and original authors remain intact.
create table public.role_profiles (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 origin_owner_id uuid unique references public.profiles(id), holder_id uuid not null references public.profiles(id),
 title text not null default '' check(length(title)<=200), department_id uuid references public.departments(id),
 manager_id uuid references public.profiles(id), cover_id uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index role_profile_holder on public.role_profiles(holder_id,company_id);
create table private.role_features(company_id uuid primary key references public.companies(id),ai boolean not null default false,manager_review boolean not null default false,reassignment boolean not null default false,readiness boolean not null default false,recurring boolean not null default false);
alter table private.role_features enable row level security;
revoke all on private.role_features from public,anon,authenticated;
create table public.role_personal_notes(role_id uuid not null references public.role_profiles(id),author_id uuid not null references public.profiles(id),body text not null default '' check(length(body)<=12000),updated_at timestamptz not null default now(),primary key(role_id,author_id));
create table public.role_review_areas(role_id uuid not null references public.role_profiles(id),area text not null check(area in ('handled','decision','external_contact','document','recurring_deadline')),nothing_to_add boolean not null default false,reviewed_at timestamptz not null default now(),primary key(role_id,area));
create table public.role_edit_proposals(id uuid primary key default gen_random_uuid(),role_id uuid not null references public.role_profiles(id),author_id uuid not null references public.profiles(id),target_id uuid not null,target_kind text not null,expected_updated_at timestamptz not null,body text not null check(length(btrim(body)) between 1 and 5000),status text not null default 'pending' check(status in ('pending','accepted','declined')),created_at timestamptz not null default now(),resolved_at timestamptz);
alter table public.role_items add column role_id uuid references public.role_profiles(id),add column role_fields jsonb not null default '{}' check(jsonb_typeof(role_fields)='object' and octet_length(role_fields::text)<=16000),add column reviewed_at timestamptz;
alter table public.decisions add column role_id uuid references public.role_profiles(id),add column role_fields jsonb not null default '{}' check(jsonb_typeof(role_fields)='object' and octet_length(role_fields::text)<=16000),add column reviewed_at timestamptz,add column replaces_id uuid references public.decisions(id),add column replaced_by_id uuid references public.decisions(id);
create unique index decision_replacement_once on public.decisions(replaces_id) where replaces_id is not null;
create index role_items_role on public.role_items(role_id,kind);
create index decisions_role on public.decisions(role_id,status);
insert into public.role_profiles(company_id,origin_owner_id,holder_id,title,department_id,manager_id)
select p.company_id,p.id,p.id,left(p.role_description,200),p.department_id,d.manager_id from public.profiles p left join public.departments d on d.id=p.department_id;
update public.role_items i set role_id=r.id from public.role_profiles r where r.origin_owner_id=i.owner_id;
update public.decisions i set role_id=r.id from public.role_profiles r where r.origin_owner_id=i.owner_id;
create function private.ensure_role(p_owner uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 select id into rid from public.role_profiles where holder_id=p_owner order by created_at,id limit 1;
 if rid is not null then return rid;end if;
 insert into public.role_profiles(company_id,origin_owner_id,holder_id,title,department_id,manager_id)
 select p.company_id,p.id,p.id,left(p.role_description,200),p.department_id,d.manager_id from public.profiles p left join public.departments d on d.id=p.department_id where p.id=p_owner
 on conflict(origin_owner_id) do nothing returning id into rid;
 -- An original role can have a new holder. Do not silently return it to the previous holder.
 if rid is null then insert into public.role_profiles(company_id,holder_id,title,department_id) select company_id,id,left(role_description,200),department_id from public.profiles where id=p_owner returning id into rid;end if;
 return rid;
end$$;
create function private.attach_stable_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='decisions' and TG_OP='UPDATE' then
 if old.status='replaced' and (to_jsonb(new)-array['deleted_at','reviewed_at','updated_at']) is distinct from (to_jsonb(old)-array['deleted_at','reviewed_at','updated_at']) then raise check_violation using message='Replaced decisions retain their history';end if;
 end if;
 -- role_id has no client write grant; association changes are restricted to checked RPCs/triggers.
 if new.role_id is null then new.role_id:=private.ensure_role(new.owner_id);end if;
 if new.role_id is null or not exists(select 1 from public.role_profiles r where r.id=new.role_id and r.company_id=new.company_id) then raise check_violation using message='Invalid role';end if;
 return new;
end$$;
create trigger stable_role_item before insert or update on public.role_items for each row execute function private.attach_stable_role();
create trigger stable_role_decision before insert or update on public.decisions for each row execute function private.attach_stable_role();
create function private.role_access(p_role uuid,p_contact boolean default false,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.role_profiles r join public.profiles v on v.id=auth.uid() and v.active and v.company_id=r.company_id
 where r.id=p_role and (r.holder_id=v.id or not p_write and (
 (v.id=r.manager_id and (v.role='hr_admin' or v.role='manager' and v.department_id=r.department_id)) or
 (not p_contact and (v.role='hr_admin' or v.role='manager' and v.department_id=r.department_id)) or
 exists(select 1 from public.work_handovers h where h.owner_id=r.holder_id and h.cover_id=v.id and h.company_id=r.company_id and h.status='approved' and current_date between h.starts_on and h.ends_on))))
$$;
revoke all on function private.ensure_role(uuid),private.attach_stable_role(),private.role_access(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function private.role_access(uuid,boolean,boolean) to authenticated;
alter table public.role_profiles enable row level security;
alter table public.role_personal_notes enable row level security;
alter table public.role_review_areas enable row level security;
alter table public.role_edit_proposals enable row level security;
revoke all on public.role_profiles,public.role_personal_notes,public.role_review_areas,public.role_edit_proposals from public,anon,authenticated;
grant select on public.role_profiles to authenticated;
create policy role_profile_read on public.role_profiles for select to authenticated using(private.role_access(id));
-- A restrictive policy prevents legacy policies exposing a transferred role or its contacts.
create policy stable_item_read on public.role_items as restrictive for select to authenticated using(private.role_access(role_id,kind='external_contact'));
create policy stable_decision_read on public.decisions as restrictive for select to authenticated using(private.role_access(role_id));
create policy stable_item_edit on public.role_items as restrictive for update to authenticated using(private.role_access(role_id,false,true)) with check(private.role_access(role_id,false,true));
create policy stable_decision_edit on public.decisions as restrictive for update to authenticated using(private.role_access(role_id,false,true)) with check(private.role_access(role_id,false,true));
-- Direct inserts must belong to a role held by the caller. RPC checks every write separately.
create policy stable_item_create on public.role_items as restrictive for insert to authenticated with check(private.role_access(role_id,false,true));
create policy stable_decision_create on public.decisions as restrictive for insert to authenticated with check(private.role_access(role_id,false,true));
create trigger stable_profile_audit after insert or update on public.role_profiles for each row execute function private.audit_setup_change();


create table private.role_task_schedules(item_id uuid primary key references public.role_items(id),role_id uuid not null references public.role_profiles(id),rule text not null,anchor date not null,next_date date not null,enabled boolean not null default true);
alter table private.role_task_schedules enable row level security;
revoke all on private.role_task_schedules from public,anon,authenticated;
alter table public.actions add column stable_role_item_id uuid references public.role_items(id);
create unique index stable_role_task_cycle on public.actions(stable_role_item_id,owner_id,due_date) where stable_role_item_id is not null;
create table public.role_review_nudges(role_id uuid not null references public.role_profiles(id),owner_id uuid not null references public.profiles(id),period date not null,created_at timestamptz not null default now(),primary key(role_id,owner_id,period));
alter table public.role_review_nudges enable row level security;
revoke all on public.role_review_nudges from public,anon,authenticated;

alter table public.captures add column role_profile_id uuid references public.role_profiles(id);
create table private.role_ai_results(role_id uuid references public.role_profiles(id),holder_id uuid references public.profiles(id),kind text,fingerprint text,output text not null,primary key(role_id,holder_id,kind,fingerprint));
alter table private.role_ai_results enable row level security;
revoke all on private.role_ai_results from public,anon,authenticated;
create function private.capture_to_stable_role() returns trigger language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if new.status<>'confirmed' then return new;end if;
 select cp.role_profile_id into rid from public.captures cp join public.role_profiles rp on rp.id=cp.role_profile_id and rp.holder_id=new.owner_id and rp.company_id=new.company_id where cp.id=new.capture_id;
 if rid is not null then
 if new.decision_id is not null then update public.decisions set role_id=rid where id=new.decision_id and owner_id=new.owner_id;end if;
 if new.contact_id is not null then update public.role_items set role_id=rid where id=new.contact_id and owner_id=new.owner_id;end if;
 end if;return new;
end$$;
revoke all on function private.capture_to_stable_role() from public,anon,authenticated;
create trigger capture_stable_role after update on public.capture_items for each row execute function private.capture_to_stable_role();
create function private.role_workspace(p_operation text,p_role uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();r public.role_profiles;v public.profiles;f private.role_features;
 rid uuid; item uuid; k text; rowdata jsonb; outdata jsonb; olddecision public.decisions; nxt uuid; field jsonb; title text; body text; chosen uuid; proposal public.role_edit_proposals;
begin
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and active) then raise insufficient_privilege;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>24000 then raise invalid_parameter_value;end if;
 select * into v from public.profiles where id=u;
 if p_role is null then p_role:=private.ensure_role(u);end if;
 if p_operation='own_records' then return jsonb_build_object('items',coalesce((select jsonb_agg(x) from (select i.kind,i.id,i.title,i.details,i.due_date,i.recurrence,i.work_status,i.next_step,i.organisation,i.contact_details,i.contact_context from public.role_items i join public.role_profiles rp on rp.id=i.role_id where rp.holder_id=u and rp.company_id=c and i.deleted_at is null order by i.created_at desc limit 100) x),'[]'),'decisions',coalesce((select jsonb_agg(x) from (select d.title,d.reason,d.decided_on,d.decided_by,d.next_step from public.decisions d join public.role_profiles rp on rp.id=d.role_id where rp.holder_id=u and rp.company_id=c and d.deleted_at is null and d.status='live' order by d.decided_on desc limit 100) x),'[]'));end if;
 if p_operation='task_choices' then return coalesce((select jsonb_agg(x) from (select i.id,i.title,i.kind from public.role_items i join public.role_profiles rp on rp.id=i.role_id where rp.holder_id=u and rp.company_id=c and i.deleted_at is null and i.kind in ('responsibility','workstream','recurring_deadline') and i.title ilike '%'||replace(replace(coalesce(p_data->>'query',''),'%',''),'_','')||'%' order by i.title,i.id limit 20 offset greatest(0,least(coalesce((p_data->>'page')::int,0),10000))*20) x),'[]');end if;
 if p_operation='upcoming' then return jsonb_build_object('deadlines',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'role_id',rp.id,'title',i.title,'due_date',i.due_date) order by i.due_date,i.id) from public.role_items i join public.role_profiles rp on rp.id=i.role_id where rp.holder_id=u and rp.company_id=c and i.kind='recurring_deadline' and i.deleted_at is null and i.due_date>=((now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date)),'[]'),'review',exists(select 1 from public.role_review_nudges where owner_id=u and period=date_trunc('month',now())::date));end if;
 if p_operation='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',rp.id,'title',rp.title,'holder',p.full_name,'own',rp.holder_id=u) order by rp.holder_id=u desc,p.full_name,rp.id) from public.role_profiles rp join public.profiles p on p.id=rp.holder_id where rp.company_id=c and private.role_access(rp.id)),'[]');end if;
 select * into r from public.role_profiles where id=p_role and company_id=c for update;
 if not found or not private.role_access(r.id) then raise insufficient_privilege using message='Role unavailable';end if;
 select * into f from private.role_features where company_id=c;
 if p_operation='get' then
 return jsonb_build_object('role',to_jsonb(r),'holder',(select full_name from public.profiles where id=r.holder_id),'department',(select name from public.departments where id=r.department_id),'manager',(select full_name from public.profiles where id=r.manager_id),'cover',(select full_name from public.profiles where id=r.cover_id),'own',r.holder_id=u,
 'can_suggest',coalesce(f.manager_review,false) and r.manager_id=u and v.role in ('manager','hr_admin'),
 'can_reassign',coalesce(f.reassignment,false) and (v.role='hr_admin' or v.role='manager' and v.department_id=r.department_id),
 'flags',jsonb_build_object('ai',coalesce(f.ai,false),'manager_review',coalesce(f.manager_review,false),'reassignment',coalesce(f.reassignment,false),'readiness',coalesce(f.readiness,false),'recurring',coalesce(f.recurring,false)),
 'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id) from public.role_items i where i.role_id=r.id and (i.kind<>'external_contact' or private.role_access(r.id,true))),'[]'),
 'decisions',coalesce((select jsonb_agg((to_jsonb(d)-'capture_id')||jsonb_build_object('capture_id',case when exists(select 1 from public.captures cp where cp.id=d.capture_id and cp.owner_id=u) then d.capture_id else null end) order by d.decided_on desc,d.id) from public.decisions d where d.role_id=r.id),'[]'),
 'past_notes',coalesce((select jsonb_agg(jsonb_build_object('role_title',rp.title,'body',n.body)) from public.role_personal_notes n join public.role_profiles rp on rp.id=n.role_id where n.author_id=u and rp.holder_id<>u),'[]'),
 'notes',coalesce((select n.body from public.role_personal_notes n where n.role_id=r.id and n.author_id=u),''),
 'areas',coalesce((select jsonb_agg(to_jsonb(a)) from public.role_review_areas a where a.role_id=r.id),'[]'),
 'proposals',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.role_edit_proposals s where s.role_id=r.id and (r.holder_id=u or s.author_id=u)),'[]'),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name)) from public.profiles p where p.company_id=c and p.active),'[]'));
 elsif p_operation='suggest' then
 if not coalesce(f.manager_review,false) or r.manager_id<>u or v.role not in ('manager','hr_admin') then raise insufficient_privilege;end if;
 item:=(p_data->>'target_id')::uuid;k:=p_data->>'target_kind';
 if k='decision' then select to_jsonb(d) into rowdata from public.decisions d where id=item and role_id=r.id and deleted_at is null and status='live';else select to_jsonb(i) into rowdata from public.role_items i where id=item and role_id=r.id and kind=k and deleted_at is null;end if;
 if rowdata is null or k='external_contact' and not private.role_access(r.id,true) then raise insufficient_privilege;end if;
 insert into public.role_edit_proposals(role_id,author_id,target_id,target_kind,expected_updated_at,body) values(r.id,u,item,k,(rowdata->>'updated_at')::timestamptz,p_data->>'body') returning id into item;
 elsif p_operation='reassign' then
 if not coalesce(f.reassignment,false) or not(v.role='hr_admin' or v.role='manager' and v.department_id=r.department_id) then raise insufficient_privilege;end if;
 chosen:=(p_data->>'holder')::uuid;
 if chosen=r.holder_id or not exists(select 1 from public.profiles p where p.id=chosen and p.company_id=c and p.active and (v.role='hr_admin' or p.department_id=r.department_id)) then raise check_violation using message='Choose an active role holder in scope';end if;
 insert into private.role_task_schedules(item_id,role_id,rule,anchor,next_date) select id,r.id,recurrence,due_date,due_date from public.role_items where role_id=r.id and kind='recurring_deadline' and deleted_at is null on conflict(item_id) do nothing;
 update public.role_profiles set holder_id=chosen,updated_at=now() where id=r.id;
 -- Personal notes, tasks, sources and private outcomes remain with their authors.
 else
 if r.holder_id<>u then raise insufficient_privilege using message='This role is read only';end if;
 if p_operation='profile' then
 chosen:=nullif(p_data->>'cover_id','')::uuid;
 if chosen is not null and (chosen=u or not exists(select 1 from public.profiles where id=chosen and active and company_id=c)) then raise check_violation;end if;
 update public.role_profiles set title=btrim(p_data->>'title'),cover_id=chosen,updated_at=now() where id=r.id;
 elsif p_operation='bind_capture' then
 item:=(p_data->>'capture')::uuid;
 update public.captures set role_profile_id=r.id where id=item and owner_id=u and company_id=c and not exists(select 1 from public.capture_items where capture_id=item and status='confirmed');
 if not found then raise insufficient_privilege using message='Only an unconfirmed own capture can be linked';end if;
 elsif p_operation='ai_source' then
 if not coalesce(f.ai,false) then raise insufficient_privilege;end if;
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'title',i.title,'details',i.details,'fields',i.role_fields) order by i.id) from public.role_items i where i.role_id=r.id and i.deleted_at is null),'[]'),'decisions',coalesce((select jsonb_agg(jsonb_build_object('title',d.title,'reason',d.reason,'date',d.decided_on) order by d.id) from public.decisions d where d.role_id=r.id and d.deleted_at is null and d.status='live'),'[]')) into outdata;
 return jsonb_build_object('source',outdata::text,'fingerprint',md5(outdata::text),'cached',(select output from private.role_ai_results where role_id=r.id and holder_id=u and kind=p_data->>'kind' and fingerprint=md5(outdata::text)));
 elsif p_operation='ai_cache' then
 if not coalesce(f.ai,false) or p_data->>'kind' not in ('responsibility','decision','document','external_contact','recurring_deadline') or length(p_data->>'output')>18000 then raise insufficient_privilege;end if;
 insert into private.role_ai_results(role_id,holder_id,kind,fingerprint,output) values(r.id,u,p_data->>'kind',p_data->>'fingerprint',p_data->>'output') on conflict(role_id,holder_id,kind,fingerprint) do update set output=excluded.output;
 elsif p_operation='notes' then
 insert into public.role_personal_notes(role_id,author_id,body) values(r.id,u,coalesce(p_data->>'body','')) on conflict(role_id,author_id) do update set body=excluded.body,updated_at=now();
 elsif p_operation='review_area' then
 if not coalesce(f.readiness,false) then raise insufficient_privilege;end if;
 if coalesce((p_data->>'empty')::boolean,false) and (exists(select 1 from public.decisions where role_id=r.id and deleted_at is null and status='live' and p_data->>'area'='decision') or exists(select 1 from public.role_items where role_id=r.id and deleted_at is null and (kind=p_data->>'area' or p_data->>'area'='handled' and kind in ('responsibility','workstream')))) then raise check_violation using message='This area contains current records';end if;
 if not coalesce((p_data->>'empty')::boolean,false) then
 update public.decisions set reviewed_at=now() where role_id=r.id and deleted_at is null and status='live' and p_data->>'area'='decision';
 update public.role_items set reviewed_at=now() where role_id=r.id and deleted_at is null and (kind=p_data->>'area' or p_data->>'area'='handled' and kind in ('responsibility','workstream'));
 end if;
 insert into public.role_review_areas(role_id,area,nothing_to_add) values(r.id,p_data->>'area',coalesce((p_data->>'empty')::boolean,false)) on conflict(role_id,area) do update set nothing_to_add=excluded.nothing_to_add,reviewed_at=now();
 elsif p_operation='resolve' then
 if not coalesce(f.manager_review,false) then raise insufficient_privilege;end if;
 select * into proposal from public.role_edit_proposals where id=(p_data->>'id')::uuid and role_id=r.id for update;
 if not found or proposal.status<>'pending' or p_data->>'status' not in ('accepted','declined') then raise invalid_parameter_value;end if;
 if p_data->>'status'='accepted' then
 if proposal.target_kind='decision' then update public.decisions set reason=proposal.body,role_fields=role_fields||jsonb_build_object('reason',proposal.body),reviewed_at=now() where id=proposal.target_id and role_id=r.id and updated_at=proposal.expected_updated_at and status='live' and deleted_at is null;
 else update public.role_items set details=proposal.body,role_fields=role_fields||jsonb_build_object('details',proposal.body),reviewed_at=now() where id=proposal.target_id and role_id=r.id and updated_at=proposal.expected_updated_at and deleted_at is null;end if;
 if not found then raise exception 'The record changed. Decline this suggestion and request an updated one.' using errcode='40001';end if;
 end if;
 update public.role_edit_proposals set status=p_data->>'status',resolved_at=now() where id=proposal.id;
 elsif p_operation in ('save','replace','archive','review') then
 item:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());k:=p_data->>'kind';field:=coalesce(p_data->'fields','{}');
 if jsonb_typeof(field)<>'object' or exists(select 1 from jsonb_each(field) where jsonb_typeof(value) not in ('string','null')) then raise invalid_parameter_value;end if;
 title:=btrim(p_data->>'title');
 foreach body in array array['effective_date','review_date','last_contacted','last_checked'] loop if nullif(field->>body,'') is not null then perform (field->>body)::date;end if;end loop;
 if k='decision' then
 select * into olddecision from public.decisions where id=item for update;
 if found and olddecision.role_id<>r.id then raise insufficient_privilege;end if;
 if p_operation='replace' then
 if olddecision.id is null or olddecision.status<>'live' or olddecision.deleted_at is not null then raise check_violation using message='Only an active decision can be replaced';end if;
 nxt:=gen_random_uuid();
 insert into public.decisions(id,company_id,owner_id,role_id,title,reason,decided_by,decided_on,next_step,role_fields,reviewed_at,replaces_id)
 values(nxt,c,u,r.id,title,field->>'reason',field->>'decided_by',(field->>'decided_on')::date,coalesce(field->>'next_step',''),field,now(),item);
 update public.decisions set status='replaced',replaced_by_id=nxt where id=item;item:=nxt;
 elsif p_operation='archive' then
 if olddecision.id is null then raise no_data_found;end if;
 update public.decisions set deleted_at=case when coalesce((p_data->>'restore')::boolean,false) then null else now() end where id=item;
 elsif p_operation='review' then update public.decisions set reviewed_at=now() where id=item and role_id=r.id;
 else
 if olddecision.status='replaced' then raise check_violation using message='Replaced decisions retain their history';end if;
 insert into public.decisions(id,company_id,owner_id,role_id,title,reason,decided_by,decided_on,next_step,source_url,role_fields,reviewed_at)
 values(item,c,u,r.id,title,field->>'reason',field->>'decided_by',(field->>'decided_on')::date,coalesce(field->>'next_step',''),nullif(field->>'source_url',''),field,now())
 on conflict(id) do update set title=excluded.title,reason=excluded.reason,decided_by=excluded.decided_by,decided_on=excluded.decided_on,next_step=excluded.next_step,source_url=excluded.source_url,role_fields=excluded.role_fields,reviewed_at=now();
 end if;
 else
 if k not in ('responsibility','workstream','external_contact','document','recurring_deadline') then raise invalid_parameter_value;end if;
 if exists(select 1 from public.role_items where id=item and (role_id<>r.id or kind<>k)) then raise insufficient_privilege;end if;
 if p_operation='archive' then update public.role_items set deleted_at=case when coalesce((p_data->>'restore')::boolean,false) then null else now() end where id=item and role_id=r.id;
 elsif p_operation='review' then update public.role_items set reviewed_at=now() where id=item and role_id=r.id;
 else
 if k='recurring_deadline' and coalesce(field->>'recurrence','Once')<>'Once' and not public.myday_valid_recurrence((field->>'due_date')::date,field->>'recurrence') then raise check_violation using message='Choose a valid repeat rule';end if;
 insert into public.role_items(id,company_id,owner_id,role_id,kind,title,details,url,recurrence,due_date,organisation,contact_details,contact_context,next_step,role_fields,reviewed_at)
 values(item,c,u,r.id,k,title,coalesce(field->>'details',''),nullif(field->>'url',''),case when k in ('responsibility','recurring_deadline') then coalesce(nullif(field->>'recurrence',''),'Once') end,case when k='recurring_deadline' then (field->>'due_date')::date end,coalesce(field->>'organisation',''),coalesce(field->>'contact_details',''),coalesce(field->>'contact_context',''),coalesce(field->>'next_step',''),field,now())
 on conflict(id) do update set title=excluded.title,details=excluded.details,url=excluded.url,recurrence=excluded.recurrence,due_date=excluded.due_date,organisation=excluded.organisation,contact_details=excluded.contact_details,contact_context=excluded.contact_context,next_step=excluded.next_step,role_fields=excluded.role_fields,reviewed_at=now();
 if k='recurring_deadline' and p_operation='save' then
 insert into private.role_task_schedules(item_id,role_id,rule,anchor,next_date) values(item,r.id,coalesce(nullif(field->>'recurrence',''),'Once'),(field->>'due_date')::date,(field->>'due_date')::date) on conflict(item_id) do update set rule=excluded.rule,anchor=excluded.anchor,next_date=excluded.next_date,enabled=true;
 end if;
 end if;
 end if;
 elsif p_operation='recurring' then
 if not coalesce(f.recurring,false) then raise insufficient_privilege;end if;
 item:=(p_data->>'id')::uuid;field:=p_data->'fields';
 if not exists(select 1 from public.role_items where id=item and role_id=r.id and deleted_at is null and kind in ('responsibility','workstream')) or not public.myday_valid_recurrence((field->>'due_date')::date,field->>'recurrence') then raise check_violation using message='Choose a start date and repeat rule';end if;
 insert into private.role_task_schedules(item_id,role_id,rule,anchor,next_date) values(item,r.id,field->>'recurrence',(field->>'due_date')::date,(field->>'due_date')::date) on conflict(item_id) do update set rule=excluded.rule,anchor=excluded.anchor,next_date=excluded.next_date,enabled=true;
 elsif p_operation='handover' then
 -- Read only confirmed role content and this holder's own notes. Return a draft for explicit review.
 select string_agg(i.title||E'\n'||i.details||case when i.url is not null then E'\nLink: '||i.url else '' end||case when i.contact_details<>'' then E'\nContact: '||i.contact_details else '' end||case when i.due_date is not null then E'\nDue: '||i.due_date::text||' ('||coalesce(i.recurrence,'Once')||')' else '' end||E'\n'||coalesce((select string_agg(replace(e.key,'_',' ')||': '||e.value,E'\n') from jsonb_each_text(i.role_fields) e where e.value<>''),''),E'\n\n') into body from public.role_items i where role_id=r.id and deleted_at is null;
 select coalesce(body,'')||E'\n\nDecisions\n'||coalesce(string_agg(d.title||E'\nWhy: '||d.reason||E'\nDecided by: '||d.decided_by,E'\n\n'),'') into body from public.decisions d where role_id=r.id and deleted_at is null and status='live';
 body:=body||E'\n\nMy notes\n'||coalesce((select n.body from public.role_personal_notes n where n.role_id=r.id and n.author_id=u),'');
 return jsonb_build_object('body',body,'title',coalesce(nullif(r.title,''),'My role')||' handover','cover_id',r.cover_id,'reviewer_id',r.manager_id);
 else raise invalid_parameter_value;end if;
 end if;
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'role_profile',r.id,p_operation);
 return jsonb_build_object('id',coalesce(item,r.id));
end$$;
revoke all on function private.role_workspace(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.role_workspace(text,uuid,jsonb) to authenticated;
create function public.role_workspace(p_operation text,p_role uuid default null,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.role_workspace(p_operation,p_role,p_data)$$;
revoke all on function public.role_workspace(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.role_workspace(text,uuid,jsonb) to authenticated;

create function private.process_role_schedules(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$
declare s record;day date;nextday date;n integer:=0;begin
 if not pg_try_advisory_xact_lock(627451905) then return 0;end if;
 for s in select rs.*,rp.holder_id,rp.company_id,i.title,i.details,i.kind,i.deleted_at,i.role_fields,coalesce(w.timezone,'Europe/London') tz from private.role_task_schedules rs join public.role_profiles rp on rp.id=rs.role_id join public.profiles p on p.id=rp.holder_id and p.active join public.role_items i on i.id=rs.item_id left join public.work_preferences w on w.owner_id=rp.holder_id where rs.enabled and i.deleted_at is null and (i.kind='recurring_deadline' or exists(select 1 from private.role_features where company_id=rp.company_id and recurring)) for update of rs skip locked loop
 day:=(p_now at time zone s.tz)::date;
 -- Skip missed repeating cycles; never create a backlog after inactivity.
 while s.next_date<day and s.rule<>'Once' loop nextday:=private.anchored_work_date(s.next_date,s.rule,s.anchor);exit when nextday is null or nextday<=s.next_date;s.next_date:=nextday;end loop;
 if s.next_date>=day and s.next_date<=day+7 then
 if not exists(select 1 from public.actions where owner_id=s.holder_id and due_date=s.next_date and (source_role_id=s.item_id or recurring_id=s.item_id)) then
 insert into public.actions(owner_id,company_id,title,details,due_date,source_kind,stable_role_item_id,reminder_option) values(s.holder_id,s.company_id,s.title,s.details,s.next_date,'role',s.item_id,case s.role_fields->>'reminder' when '1 day before' then 'day_before' else 'at_time' end) on conflict do nothing;n:=n+1;end if;
 if s.next_date=day then
 nextday:=private.anchored_work_date(s.next_date,s.rule,s.anchor);
 if nextday is null then update private.role_task_schedules set enabled=false where item_id=s.item_id;
 else update private.role_task_schedules set next_date=nextday where item_id=s.item_id;if s.kind='recurring_deadline' then update public.role_items set due_date=nextday where id=s.item_id;end if;end if;
 else update private.role_task_schedules set next_date=s.next_date where item_id=s.item_id;end if;
 end if;
 end loop;
 insert into public.role_review_nudges(role_id,owner_id,period) select r.id,r.holder_id,date_trunc('month',p_now)::date from public.role_profiles r join private.role_features f on f.company_id=r.company_id and f.readiness where r.created_at<p_now-interval '1 month' on conflict do nothing;
 return n;
end$$;
revoke all on function private.process_role_schedules(timestamptz) from public,anon,authenticated,service_role;
-- Existing recurring deadlines remain on their original worker until explicitly edited here.
-- New schedules are excluded to avoid duplicates or delivery to a previous role holder.
do $$declare definition text;begin
 select pg_get_functiondef('private.process_myday(timestamptz)'::regprocedure) into definition;
 if position('ri.kind=''recurring_deadline''' in definition)=0 then raise exception 'Inspect the current deadline worker before installing';end if;
 definition:=replace(definition,'ri.kind=''recurring_deadline''','ri.kind=''recurring_deadline'' and not exists(select 1 from private.role_task_schedules rs where rs.item_id=ri.id)');
 execute definition;
end$$;
select cron.schedule('vimbre-role-schedules','* * * * *','select private.process_role_schedules();');

-- Manual imports and scheduled cycles share one owner/date identity after transfer.
create or replace function private.myday_role_task(p_record uuid,p_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();r public.role_items;t uuid;begin
 if u is null or c is null or p_date is null then raise insufficient_privilege;end if;
 select i.* into r from public.role_items i join public.role_profiles rp on rp.id=i.role_id where i.id=p_record and rp.holder_id=u and rp.company_id=c and i.deleted_at is null and i.kind in ('responsibility','workstream','recurring_deadline') and private.role_access(rp.id,false,true);
 if not found then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_record::text||p_date::text,77));
 select id into t from public.actions where owner_id=u and due_date=p_date and (stable_role_item_id=r.id or source_role_id=r.id or recurring_id=r.id) limit 1;
 if t is not null then return t;end if;
 insert into public.actions(owner_id,company_id,title,details,due_date,source_kind,stable_role_item_id,department_id) values(u,c,r.title,r.details,p_date,'role',r.id,(select department_id from public.profiles where id=u)) on conflict(stable_role_item_id,owner_id,due_date) where stable_role_item_id is not null do update set stable_role_item_id=excluded.stable_role_item_id returning id into t;return t;
end$$;
