-- Capture channels share one private source and explicit review boundary.
alter table public.captures
 add column channel text not null default 'paste',
 add column status text not null default 'needs_review' check(status in ('received','needs_review','drafts_ready','saved','archived','failed')),
 add column file_reference text,
 add column sender text,
 add column error text,
 add column fingerprint text,
 add column record_id uuid references public.role_items(id),
 add column department_id uuid references public.departments(id),
 add column draft_attempts integer not null default 0 check(draft_attempts between 0 and 3);
update public.captures c set status=case when deleted_at is not null then 'archived' when exists(select 1 from public.capture_items i where i.capture_id=c.id and status='pending') then 'drafts_ready' when exists(select 1 from public.capture_items i where i.capture_id=c.id and status='confirmed') then 'saved' else 'needs_review' end;
-- Channel deliberately has no enum constraint, so another channel needs no migration.
create table public.capture_channel_settings (
 company_id uuid primary key references public.companies(id) on delete cascade,
 forwarding_enabled boolean not null default false,
 upload_enabled boolean not null default false,
 capture_domain text,
 file_limit_bytes integer not null default 10485760 check(file_limit_bytes between 1 and 10485760)
);
alter table public.capture_channel_settings enable row level security;
revoke all on public.capture_channel_settings from public,anon,authenticated;
grant select,insert,update on public.capture_channel_settings to service_role;

create table public.capture_summaries (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),owner_id uuid not null,
 capture_id uuid not null references public.captures(id),record_id uuid references public.role_items(id),
 title text not null check(char_length(title) between 1 and 200),details text not null check(char_length(details)<=5000),
 created_at timestamptz not null default now(),unique(id,owner_id,company_id),
 foreign key(owner_id,company_id) references public.profiles(id,company_id)
);
alter table public.capture_summaries enable row level security;
revoke all on public.capture_summaries from public,anon,authenticated;
grant select on public.capture_summaries to authenticated;
create policy capture_summary_read on public.capture_summaries for select to authenticated using(company_id=(select private.current_company_id()) and private.can_read_role(owner_id));
create index capture_summaries_owner_idx on public.capture_summaries(owner_id,company_id);
create index capture_summaries_source_idx on public.capture_summaries(capture_id);
alter table public.capture_items add column summary_id uuid;
alter table public.capture_items add constraint capture_summary_fk foreign key(summary_id,owner_id,company_id) references public.capture_summaries(id,owner_id,company_id);
-- Replace only the two constraints whose set of supported types grows.
do $$declare r record;begin for r in select conname from pg_constraint where conrelid='public.capture_items'::regclass and contype='c' and (pg_get_constraintdef(oid) like '%kind = ANY%' or pg_get_constraintdef(oid) like '%num_nonnulls%') loop execute format('alter table public.capture_items drop constraint %I',r.conname);end loop;end$$;
alter table public.capture_items add check(kind in ('decision','action','summary','contact'));
alter table public.capture_items add check(num_nonnulls(decision_id,action_id,contact_id,summary_id)=case when status='confirmed' then 1 else 0 end);
alter table public.capture_items add check(summary_id is null or kind='summary');
alter table public.actions add column capture_id uuid references public.captures(id);
alter table public.decisions add column capture_id uuid references public.captures(id);
create index actions_capture_idx on public.actions(capture_id);
create index decisions_capture_idx on public.decisions(capture_id);

create table private.capture_ai_jobs (
 request_id uuid primary key,capture_id uuid not null references public.captures(id) on delete cascade,
 company_id uuid not null,owner_id uuid not null,task text not null check(task in ('capture_extract','tidy_text')),
 fingerprint text not null,output text,state text not null default 'pending' check(state in ('pending','success','failed')),
 created_at timestamptz not null default now(),finished_at timestamptz,
 foreign key(owner_id,company_id) references public.profiles(id,company_id)
);
alter table private.capture_ai_jobs enable row level security;
revoke all on private.capture_ai_jobs from public,anon,authenticated,service_role;
create index capture_ai_cache_idx on private.capture_ai_jobs(owner_id,company_id,task,fingerprint) where state='success';
create index capture_ai_source_idx on private.capture_ai_jobs(capture_id);

-- Keep the legacy call shape while extending validated review fields.
create or replace function private.capture_change(p_operation text,p_id uuid,p_capture uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();s public.captures;d public.capture_items;data jsonb; k text;target uuid;own uuid;rec uuid;dep uuid;ct uuid;
begin
 if u is null or c is null then raise insufficient_privilege;end if;
 if p_id is null or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>220000 then raise exception 'Invalid capture details' using errcode='22023';end if;
 if p_operation='create' then
  k:=coalesce(p_data->>'channel','paste');
  if k<>'paste' and not(k='upload' and coalesce((select upload_enabled from public.capture_channel_settings where company_id=c),false)) then raise exception 'This capture channel is not available' using errcode='22023';end if;
  if octet_length(p_data->>'source_text')>50000 then raise exception 'Use up to 50000 bytes of text' using errcode='22023';end if;
  rec:=nullif(p_data->>'record_id','')::uuid;dep:=nullif(p_data->>'department_id','')::uuid;
  if rec is not null and not exists(select 1 from public.role_items where id=rec and owner_id=u and company_id=c and kind='workstream' and deleted_at is null) then raise insufficient_privilege;end if;
  if dep is not null and not exists(select 1 from public.departments where id=dep and company_id=c and archived_at is null) then raise insufficient_privilege;end if;
  insert into public.captures(id,company_id,owner_id,title,source_text,source_type,source_date,channel,record_id,department_id)
  values(p_id,c,u,coalesce(nullif(btrim(p_data->>'title'),''),'Untitled capture'),p_data->>'source_text',coalesce(p_data->>'source_type','note'),coalesce(nullif(p_data->>'source_date','')::date,(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date),k,rec,dep) on conflict(id) do nothing;
  if not exists(select 1 from public.captures where id=p_id and owner_id=u and company_id=c) then raise insufficient_privilege;end if;
  return p_id;
 end if;
 select * into s from public.captures where id=p_capture and owner_id=u and company_id=c for update;
 if not found then raise insufficient_privilege;end if;
 if p_operation in ('archive','restore') then
  update public.captures set deleted_at=case when p_operation='archive' then now() else null end,status=case when p_operation='archive' then 'archived' when exists(select 1 from public.capture_items where capture_id=s.id and status='pending') then 'drafts_ready' when exists(select 1 from public.capture_items where capture_id=s.id and status='confirmed') then 'saved' else 'needs_review' end where id=s.id;return s.id;
 end if;
 if s.deleted_at is not null then raise exception 'Restore this capture first' using errcode='22023';end if;
 if p_operation='source' then
  if exists(select 1 from private.capture_ai_jobs where capture_id=s.id and state='pending' and created_at>now()-interval '2 minutes') then raise exception 'Wait for the current draft to finish' using errcode='22023';end if;
  if octet_length(p_data->>'source_text')>50000 then raise exception 'Use up to 50000 bytes of text' using errcode='22023';end if;
  update public.captures set source_text=p_data->>'source_text',status='needs_review',error=null where id=s.id;return s.id;
 end if;
 if p_operation in ('add','edit') then
  k:=p_data->>'kind';
  if k is null or k not in ('decision','action','summary','contact') or char_length(btrim(coalesce(p_data->>'title',''))) not between 1 and 200 then raise exception 'Choose a type and add a title' using errcode='22023';end if;
  own:=coalesce(nullif(p_data->>'owner_id','')::uuid,u);
  -- Employees cannot assign to others; managers remain department scoped.
  if not exists(select 1 from public.profiles t join public.profiles v on v.company_id=t.company_id where v.id=u and v.active and t.id=own and t.active and t.company_id=c and (own=u or v.role='hr_admin' or(v.role='manager' and v.department_id=t.department_id))) then raise insufficient_privilege;end if;
  rec:=coalesce(nullif(p_data->>'record_id','')::uuid,s.record_id);dep:=coalesce(nullif(p_data->>'department_id','')::uuid,s.department_id);ct:=nullif(p_data->>'external_contact_id','')::uuid;
  if rec is not null and not exists(select 1 from public.role_items where id=rec and owner_id=own and company_id=c and kind='workstream' and deleted_at is null) then raise exception 'Choose a Record belonging to the selected owner' using errcode='22023';end if;
  if dep is not null and not exists(select 1 from public.departments where id=dep and company_id=c and archived_at is null) then raise insufficient_privilege;end if;
  if ct is not null and not exists(select 1 from public.role_items where id=ct and owner_id=own and company_id=c and kind='external_contact' and deleted_at is null) then raise insufficient_privilege;end if;
  if coalesce(p_data->>'priority','normal') not in ('high','normal','low') or coalesce(p_data->>'reminder_option','at_time') not in ('at_time','30_minutes','1_hour','day_before') then raise exception 'Choose a priority and reminder' using errcode='22023';end if;
  if char_length(coalesce(p_data->>'details',''))>5000 or char_length(coalesce(p_data->>'reason',''))>5000 or char_length(coalesce(p_data->>'next_step',''))>5000 then raise exception 'Use up to 5000 characters per field' using errcode='22023';end if;
  data:=p_data-'kind'-'version'-'origin'||jsonb_build_object('title',btrim(p_data->>'title'),'owner_id',own,'record_id',rec,'department_id',dep,'external_contact_id',ct,'priority',coalesce(p_data->>'priority','normal'),'reminder_option',coalesce(p_data->>'reminder_option','at_time'));
  if p_operation='add' then
   if(select count(*) from public.capture_items where capture_id=s.id)>=100 then raise exception 'A capture can contain up to 100 drafts' using errcode='22023';end if;
   insert into public.capture_items(id,capture_id,company_id,owner_id,kind,payload,origin) values(p_id,s.id,c,u,k,data,case when p_data->>'origin'='ai' then 'ai' else 'manual' end) on conflict(id) do nothing;
   if not exists(select 1 from public.capture_items where id=p_id and capture_id=s.id and owner_id=u and company_id=c) then raise insufficient_privilege;end if;
   update public.captures set status='drafts_ready',error=null where id=s.id;return p_id;
  end if;
 end if;
 select * into d from public.capture_items where id=p_id and capture_id=s.id and owner_id=u and company_id=c for update;
 if not found then raise insufficient_privilege;end if;
 if p_operation='confirm' and d.status='confirmed' then return coalesce(d.decision_id,d.action_id,d.contact_id,d.summary_id);end if;
 if p_operation='discard' and d.status='discarded' then return d.id;end if;
 if d.status<>'pending' or d.version is distinct from (p_data->>'version')::integer then raise exception 'This draft changed. Reload the capture.' using errcode='40001';end if;
 if p_operation='edit' then update public.capture_items set kind=k,payload=data,version=version+1 where id=d.id;return d.id;
 elsif p_operation='discard' then update public.capture_items set status='discarded',reviewed_at=now(),version=version+1 where id=d.id;
 elsif p_operation='confirm' then
  data:=d.payload;own:=coalesce(nullif(data->>'owner_id','')::uuid,u);rec:=nullif(data->>'record_id','')::uuid;dep:=nullif(data->>'department_id','')::uuid;ct:=nullif(data->>'external_contact_id','')::uuid;
  if not exists(select 1 from public.profiles t join public.profiles v on v.company_id=t.company_id where v.id=u and v.active and t.id=own and t.active and t.company_id=c and (own=u or v.role='hr_admin' or(v.role='manager' and v.department_id=t.department_id))) then raise insufficient_privilege;end if;
  if rec is not null and not exists(select 1 from public.role_items where id=rec and owner_id=own and company_id=c and kind='workstream' and deleted_at is null) then raise insufficient_privilege;end if;
  if d.kind='decision' then
   insert into public.decisions(company_id,owner_id,title,reason,decided_by,decided_on,next_step,workstream_id,capture_id) values(c,own,data->>'title',data->>'reason',coalesce(nullif(data->>'decided_by',''),(select full_name from public.profiles where id=own)),coalesce(nullif(data->>'decided_on','')::date,s.source_date),coalesce(data->>'next_step',''),rec,s.id) returning id into target;
   update public.capture_items set decision_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=d.id;
  elsif d.kind='action' then
   insert into public.actions(company_id,owner_id,title,details,due_date,due_time,priority,reminder_option,department_id,external_contact_id,capture_id) values(c,own,data->>'title',coalesce(data->>'details',''),nullif(data->>'due_date','')::date,nullif(data->>'due_time','')::time,coalesce(data->>'priority','normal'),coalesce(data->>'reminder_option','at_time'),case when ct is null then dep end,ct,s.id) returning id into target;
   update public.capture_items set action_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=d.id;
  elsif d.kind='summary' then
   insert into public.capture_summaries(company_id,owner_id,capture_id,record_id,title,details) values(c,own,s.id,rec,data->>'title',coalesce(data->>'details','')) returning id into target;
   update public.capture_items set summary_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=d.id;
  else
   insert into public.role_items(company_id,owner_id,kind,title,details,contact_email,contact_phone) values(c,own,'external_contact',data->>'title',coalesce(data->>'details',''),nullif(data->>'contact_email',''),nullif(data->>'contact_phone','')) returning id into target;
   update public.capture_items set contact_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=d.id;
  end if;
 else raise exception 'Unknown capture operation' using errcode='22023';end if;
 update public.captures set status=case when exists(select 1 from public.capture_items where capture_id=s.id and status='pending') then 'drafts_ready' when exists(select 1 from public.capture_items where capture_id=s.id and status='confirmed') then 'saved' else 'needs_review' end where id=s.id;
 return coalesce(target,d.id);
end$$;

do $$declare r record;begin for r in select conname from pg_constraint where conrelid='public.capture_items'::regclass and contype='f' and confrelid in ('public.actions'::regclass,'public.decisions'::regclass,'public.role_items'::regclass,'public.capture_summaries'::regclass) loop execute format('alter table public.capture_items drop constraint %I',r.conname);end loop;end$$;
alter table public.capture_items add foreign key(action_id) references public.actions(id),add foreign key(decision_id) references public.decisions(id),add foreign key(contact_id) references public.role_items(id),add foreign key(summary_id) references public.capture_summaries(id);

create function private.capture_pipeline(p_operation text,p_id uuid,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();s public.captures;d public.capture_items;v jsonb;result jsonb;remaining integer;target uuid;
begin
 if u is null or c is null then raise insufficient_privilege;end if;
 if p_operation='options' then
  v:=private.ai_allowance_status(c);
  remaining:=case when coalesce((v->>'enabled')::boolean,false) and not coalesce((v->>'blocked')::boolean,false) then greatest(0,least((v->>'daily_request_limit')::int-(v->>'daily_requests')::int,(v->>'monthly_request_limit')::int-(v->>'monthly_requests')::int)) else 0 end;
  return jsonb_build_object('today',(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date,'remaining',remaining,'ai_enabled',coalesce((v->>'enabled')::boolean,false),'forwarding',coalesce((select forwarding_enabled from public.capture_channel_settings where company_id=c),false),'upload',coalesce((select upload_enabled from public.capture_channel_settings where company_id=c),false),'address',(select address from public.capture_forwarding_addresses a where owner_id=u and company_id=c and enabled and verified_at is not null and coalesce((select forwarding_enabled from public.capture_channel_settings where company_id=c),false) limit 1),'records',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title)) from (select id,title from public.role_items where owner_id=u and company_id=c and kind='workstream' and deleted_at is null order by title limit 200)r),'[]'::jsonb),'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',name)) from public.departments where company_id=c and archived_at is null),'[]'::jsonb),'contacts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title)) from(select id,title from public.role_items where company_id=c and owner_id=u and kind='external_contact' and deleted_at is null order by title limit 200)r),'[]'::jsonb));
 end if;
 select * into s from public.captures where id=p_id and owner_id=u and company_id=c for update;
 if not found then raise insufficient_privilege;end if;
 if p_operation='attach_file' then
  if not coalesce((select upload_enabled from public.capture_channel_settings where company_id=c),false) or s.channel<>'upload' then raise insufficient_privilege;end if;
  v:=to_jsonb(c::text||'/'||u::text||'/'||s.id::text||'/original');
  if not exists(select 1 from storage.objects where bucket_id='capture-originals' and name=(v#>>'{}')) then raise exception 'The upload could not be found' using errcode='22023';end if;
  update public.captures set file_reference=v#>>'{}' where id=s.id;
 elsif p_operation='remove_file' then
  if exists(select 1 from storage.objects where bucket_id='capture-originals' and name=s.file_reference) then raise exception 'Delete the original file before removing its reference' using errcode='22023';end if;
  update public.captures set file_reference=null where id=s.id;
 elsif p_operation='bulk_record' then
  if nullif(p_data->>'record_id','') is not null and not exists(select 1 from public.role_items where id=(p_data->>'record_id')::uuid and owner_id=u and company_id=c and kind='workstream' and deleted_at is null) then raise insufficient_privilege;end if;
  for d in select * from public.capture_items where capture_id=s.id and status='pending' loop
   perform private.capture_change('edit',d.id,s.id,d.payload||jsonb_build_object('kind',d.kind,'version',d.version,'record_id',p_data->>'record_id'));
  end loop;
 elsif p_operation='confirm' then
  -- All or none. Refresh versions and pass selected IDs, never silently confirm unseen drafts.
  if jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items') not between 1 and 100 then raise exception 'Select drafts to confirm' using errcode='22023';end if;
  for v in select value from jsonb_array_elements(p_data->'items') loop
   perform private.capture_change('confirm',(v->>'id')::uuid,s.id,jsonb_build_object('version',v->>'version'));
  end loop;
 elsif p_operation='duplicates' then
  return coalesce((select jsonb_agg(i.id) from public.capture_items i where i.capture_id=s.id and i.status='pending' and (
    (i.kind='action' and exists(select 1 from public.actions a where a.company_id=c and a.owner_id=u and a.deleted_at is null and lower(btrim(a.title))=lower(btrim(i.payload->>'title')))) or
    (i.kind='decision' and exists(select 1 from public.decisions a where a.company_id=c and a.owner_id=u and a.deleted_at is null and lower(btrim(a.title))=lower(btrim(i.payload->>'title')))) or
    (i.kind='summary' and exists(select 1 from public.capture_summaries a where a.company_id=c and a.owner_id=u and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))))
   )),'[]'::jsonb);
 else raise exception 'Unknown capture operation' using errcode='22023';end if;
 return public.capture_detail(s.id);
end$$;
revoke all on function private.capture_pipeline(text,uuid,jsonb) from public,anon;
grant execute on function private.capture_pipeline(text,uuid,jsonb) to authenticated;
create function public.capture_pipeline(p_operation text,p_id uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.capture_pipeline(p_operation,p_id,p_data)$$;
revoke all on function public.capture_pipeline(text,uuid,jsonb) from public,anon;
grant execute on function public.capture_pipeline(text,uuid,jsonb) to authenticated;
create or replace function public.capture_list(p_page integer,p_archived boolean) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('count',(select count(*) from public.captures where(deleted_at is not null)=p_archived),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from(select c.id,c.title,c.channel,c.status,c.source_type,c.source_date,c.deleted_at,c.created_at,(select count(*) from public.capture_items i where i.capture_id=c.id and i.status='confirmed') as items_created from public.captures c where(c.deleted_at is not null)=p_archived order by c.created_at desc,c.id limit 10 offset least(greatest(p_page,0),100000)*10)r),'[]'::jsonb))
$$;
create function private.capture_ai_source(p_user uuid,p_capture uuid) returns text language plpgsql security definer set search_path='' as $$
declare t text;begin
 select s.source_text into t from public.captures s join public.profiles p on p.id=s.owner_id and p.company_id=s.company_id and p.active where s.id=p_capture and s.owner_id=p_user and s.deleted_at is null;
 if not found then raise insufficient_privilege;end if;return t;
end$$;
create function private.capture_ai_claim(p_user uuid,p_capture uuid,p_request uuid,p_task text,p_fingerprint text,p_source_hash text,p_redraft boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.captures;j private.capture_ai_jobs;cached text;
begin
 select * into s from public.captures where id=p_capture and owner_id=p_user and deleted_at is null for update;
 if not found or not exists(select 1 from public.profiles where id=p_user and company_id=s.company_id and active) then raise insufficient_privilege;end if;
 if p_task not in ('capture_extract','tidy_text') or p_fingerprint!~'^[a-f0-9]{64}$' or encode(extensions.digest(s.source_text,'sha256'),'hex')<>p_source_hash then raise exception 'The source changed. Reload it before drafting.' using errcode='40001';end if;
 select * into j from private.capture_ai_jobs where request_id=p_request;
 if found then
  if j.capture_id<>s.id or j.owner_id<>p_user or j.task<>p_task or j.fingerprint<>p_fingerprint then raise insufficient_privilege;end if;
  if j.state='success' then return jsonb_build_object('cached',j.output);end if;
  return jsonb_build_object('blocked','This draft request was already received. Review your captures before trying again.');
 end if;
 if exists(select 1 from private.capture_ai_jobs where capture_id=s.id and state='pending' and created_at>now()-interval '2 minutes') then return jsonb_build_object('blocked','A draft is already being prepared. Please wait.');end if;
 select output into cached from private.capture_ai_jobs where owner_id=p_user and company_id=s.company_id and task=p_task and fingerprint=p_fingerprint and state='success' order by created_at desc limit 1;
 if cached is null and p_task='capture_extract' and s.draft_attempts>=3 then return jsonb_build_object('blocked','You have used both redrafts. Edit the drafts by hand.');end if;
 if p_task='capture_extract' and s.draft_attempts>0 and cached is null and not p_redraft then return jsonb_build_object('blocked','Choose Redraft to prepare another set of drafts.');end if;
 insert into private.capture_ai_jobs(request_id,capture_id,company_id,owner_id,task,fingerprint) values(p_request,s.id,s.company_id,p_user,p_task,p_fingerprint);
 if cached is null and p_task='capture_extract' then update public.captures set draft_attempts=draft_attempts+1,fingerprint=p_fingerprint,error=null where id=s.id;end if;
 return jsonb_build_object('cached',cached);
end$$;
create function private.capture_ai_complete(p_user uuid,p_request uuid,p_output text,p_items jsonb default null)
returns void language plpgsql security definer set search_path='' as $$
declare j private.capture_ai_jobs;s public.captures;r jsonb;
begin
 select * into j from private.capture_ai_jobs where request_id=p_request and owner_id=p_user for update;
 if not found then raise insufficient_privilege;end if;
 if j.state<>'pending' then return;end if;
 select * into s from public.captures where id=j.capture_id for update;
 if s.deleted_at is not null or not exists(select 1 from public.profiles where id=p_user and company_id=s.company_id and active) then raise insufficient_privilege;end if;
 if p_output is null then
  update private.capture_ai_jobs set state='failed',finished_at=now() where request_id=j.request_id;
  update public.captures set status='failed',error='AI could not prepare drafts. Your text is still here. You can add a task by hand.' where id=s.id;
  return;
 end if;
 if octet_length(p_output)>60000 then raise exception 'Draft response is too long' using errcode='22023';end if;
 if j.task='capture_extract' then
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>60 then raise exception 'Invalid draft response' using errcode='22023';end if;
  update public.capture_items set status='discarded',reviewed_at=now(),version=version+1 where capture_id=s.id and status='pending' and origin='ai';
  for r in select value from jsonb_array_elements(p_items) loop
   if r->>'kind' not in ('decision','action','summary','contact') or jsonb_typeof(r->'payload')<>'object' or char_length(btrim(coalesce(r->'payload'->>'title',''))) not between 1 and 200 or octet_length((r->'payload')::text)>20000 then raise exception 'Invalid draft' using errcode='22023';end if;
   if (select count(*) from public.capture_items where capture_id=s.id)>=100 then raise exception 'A capture can contain up to 100 drafts' using errcode='22023';end if;
   insert into public.capture_items(capture_id,company_id,owner_id,kind,payload,origin) values(s.id,s.company_id,s.owner_id,r->>'kind',(r->'payload')||jsonb_build_object('owner_id',s.owner_id,'priority','normal','reminder_option','at_time','record_id',s.record_id,'department_id',s.department_id),'ai');
  end loop;
  update public.captures set status=case when jsonb_array_length(p_items)>0 then 'drafts_ready' else 'needs_review' end,error=null where id=s.id;
 end if;
 update private.capture_ai_jobs set output=p_output,state='success',finished_at=now() where request_id=j.request_id;
end$$;
-- Service-only gateway calls, always using the user verified with Auth.getUser.
revoke all on function private.capture_ai_source(uuid,uuid),private.capture_ai_claim(uuid,uuid,uuid,text,text,text,boolean),private.capture_ai_complete(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.capture_ai_source(uuid,uuid),private.capture_ai_claim(uuid,uuid,uuid,text,text,text,boolean),private.capture_ai_complete(uuid,uuid,text,jsonb) to service_role;
create function public.capture_ai_source(p_user uuid,p_capture uuid) returns text language sql security invoker set search_path='' as $$select private.capture_ai_source(p_user,p_capture)$$;
create function public.capture_ai_claim(p_user uuid,p_capture uuid,p_request uuid,p_task text,p_fingerprint text,p_source_hash text,p_redraft boolean) returns jsonb language sql security invoker set search_path='' as $$select private.capture_ai_claim(p_user,p_capture,p_request,p_task,p_fingerprint,p_source_hash,p_redraft)$$;
create function public.capture_ai_complete(p_user uuid,p_request uuid,p_output text,p_items jsonb default null) returns void language sql security invoker set search_path='' as $$select private.capture_ai_complete(p_user,p_request,p_output,p_items)$$;
revoke all on function public.capture_ai_source(uuid,uuid),public.capture_ai_claim(uuid,uuid,uuid,text,text,text,boolean),public.capture_ai_complete(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.capture_ai_source(uuid,uuid),public.capture_ai_claim(uuid,uuid,uuid,text,text,text,boolean),public.capture_ai_complete(uuid,uuid,text,jsonb) to service_role;
create trigger capture_summary_audit after insert on public.capture_summaries for each row execute function private.audit_setup_change();
-- Avoid a misleading source-kind change when a leader assigns a task to a teammate.
create or replace function private.capture_task_provenance() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='confirmed' and new.action_id is not null then update public.actions a set source_kind=case when c.source_type='email' then 'email' when c.source_type='meeting' then 'meeting' else 'notes' end from public.captures c where a.id=new.action_id and c.id=new.capture_id and c.owner_id=new.owner_id and c.company_id=new.company_id;end if;return new;end$$;

-- The original upload remains in an owner-private bucket, never a public URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('capture-originals','capture-originals',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/vtt','application/x-subrip','application/octet-stream']) on conflict(id) do nothing;
create function private.capture_upload_allowed(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.captures c join public.capture_channel_settings f on f.company_id=c.company_id and f.upload_enabled where c.owner_id=auth.uid() and c.company_id=private.current_company_id() and c.channel='upload' and c.deleted_at is null and p_name=c.company_id::text||'/'||c.owner_id::text||'/'||c.id::text||'/original')
$$;
revoke all on function private.capture_upload_allowed(text) from public,anon;
grant execute on function private.capture_upload_allowed(text) to authenticated;
create policy capture_original_insert on storage.objects for insert to authenticated with check(bucket_id='capture-originals' and private.capture_upload_allowed(name));
create policy capture_original_read on storage.objects for select to authenticated using(bucket_id='capture-originals' and (storage.foldername(name))[2]=(select auth.uid())::text and (storage.foldername(name))[1]=(select private.current_company_id())::text);
create policy capture_original_delete on storage.objects for delete to authenticated using(bucket_id='capture-originals' and (storage.foldername(name))[2]=(select auth.uid())::text and (storage.foldername(name))[1]=(select private.current_company_id())::text);
