-- Recoverable capture deletion. Saved records and uploads are retained.
alter table public.captures add column trashed_at timestamptz;
comment on column public.captures.trashed_at is 'Owner-deleted capture, recoverable from Deleted; distinct from Archive. No cascading record deletion.';
CREATE OR REPLACE FUNCTION private.capture_change(p_operation text, p_id uuid, p_capture uuid, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if s.trashed_at is not null then raise exception 'Restore this deleted capture first' using errcode='22023';end if;
 if p_operation in ('archive','restore') then
  update public.captures set deleted_at=case when p_operation='archive' then now() else null end,status=case when p_operation='archive' then 'archived' when exists(select 1 from public.capture_items where capture_id=s.id and status='pending') then 'drafts_ready' when exists(select 1 from public.capture_items where capture_id=s.id and status='confirmed') then 'saved' else 'needs_review' end where id=s.id;return s.id;
 end if;
 if s.deleted_at is not null then raise exception 'Restore this capture first' using errcode='22023';end if;
 if p_operation='source' then
  if exists(select 1 from public.capture_items where capture_id=s.id and status='confirmed') then raise exception 'Create a new capture to change a confirmed source' using errcode='22023';end if;
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
 if p_operation='confirm' and d.status='confirmed' then return coalesce(d.decision_id,d.action_id,d.contact_id,d.summary_id,d.assignment_id);end if;
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
  elsif d.kind='action' and own<>u then
   target:=gen_random_uuid();
   perform private.myday_suite('assign',target,jsonb_build_object('recipient_id',own,'title',data->>'title','details',coalesce(data->>'details',''),'due_date',data->>'due_date'));
   update public.capture_items set assignment_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=d.id;
  elsif d.kind='action' then
   insert into public.actions(company_id,owner_id,title,details,due_date,due_time,priority,reminder_option,department_id,external_contact_id,capture_id,capture_record_id) values(c,own,data->>'title',coalesce(data->>'details',''),nullif(data->>'due_date','')::date,nullif(data->>'due_time','')::time,coalesce(data->>'priority','normal'),coalesce(data->>'reminder_option','at_time'),case when ct is null then dep end,ct,s.id,rec) returning id into target;
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
end$function$;

CREATE OR REPLACE FUNCTION private.capture_state(s public.captures)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select case when s.trashed_at is not null then 'deleted' when s.deleted_at is not null then 'archived' when s.status='failed' then 'could_not_read' when s.status='saved' then 'saved' when s.result_state='no_actions' and not exists(select 1 from public.capture_items i where i.capture_id=s.id and i.status in ('pending','confirmed')) then 'no_actions' else 'needs_review' end
$function$;

CREATE OR REPLACE FUNCTION private.capture_workspace(p_action text, p_id uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();r jsonb;v jsonb;s public.captures;selected private.capture_selected_sources;conn private.capture_connections;n int;new_id uuid;allowed text[];
begin
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and company_id=c and active) then raise insufficient_privilege;end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>100000 then raise invalid_parameter_value;end if;
 select p.allowed into allowed from private.capture_tool_policy p where p.company_id=c;allowed:=coalesce(allowed,array['gmail','drive','outlook','teams','slack','trello']);
 if p_action in ('delete','restore_deleted') then
  select * into s from public.captures where id=p_id and owner_id=u and company_id=c for update;
  if not found then raise insufficient_privilege;end if;
  if p_action='delete' then
   if exists(select 1 from private.capture_queue where capture_id=s.id and state in ('pending','claimed'))
    or exists(select 1 from private.capture_ai_jobs where capture_id=s.id and state in ('pending','claimed') and created_at>now()-interval '5 minutes')
   then raise exception 'Wait for drafting to finish before deleting this capture' using errcode='22023';end if;
   update public.captures set trashed_at=coalesce(trashed_at,now()),deleted_at=coalesce(deleted_at,now()),status='archived' where id=s.id;
  elsif s.trashed_at is not null then
   update public.captures set trashed_at=null where id=s.id;
   perform private.capture_change('restore',s.id,s.id,'{}'::jsonb);
  end if;
  return to_jsonb(s.id);
 elsif p_action='config' then return jsonb_build_object('allowed',allowed,'admin',exists(select 1 from public.profiles where id=u and role='hr_admin'));
 elsif p_action='allowed_tools' then
  if not exists(select 1 from public.profiles where id=u and role='hr_admin') or jsonb_typeof(p_data->'allowed')<>'array' then raise insufficient_privilege;end if;
  select coalesce(array_agg(value),'{}') into allowed from jsonb_array_elements_text(p_data->'allowed');
  insert into private.capture_tool_policy(company_id,allowed) values(c,allowed) on conflict(company_id) do update set allowed=excluded.allowed;
  insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'capture_tools',c,'updated');return jsonb_build_object('allowed',allowed);
 elsif p_action='detail' then
  select * into s from public.captures where id=p_id and owner_id=u and company_id=c;if not found then return null;end if;
  return public.capture_detail(s.id)||jsonb_build_object('job',(select jsonb_build_object('state',q.state,'error',q.error) from private.capture_queue q where q.capture_id=s.id and q.owner_id=u and q.company_id=c order by q.created_at desc limit 1));
 elsif p_action='list' then
  n:=greatest(0,least(coalesce((p_data->>'page')::int,0),10000));
  select jsonb_build_object('count',count(*),'rows',coalesce(jsonb_agg(to_jsonb(x)-'total'),'[]')) into r from (
   select z.* from (
    select ca.id,ca.title,ca.source_date,ca.channel,ca.source_provider,ca.source_reference,ca.deleted_at,ca.status,ca.error,ca.label,private.capture_state(ca) as result_state,
    (select count(*) from public.capture_items i where i.capture_id=ca.id and i.kind='action' and i.status<>'discarded') as tasks,
    (select count(*) from public.capture_items i where i.capture_id=ca.id and i.kind='decision' and i.status<>'discarded') as decisions
    from public.captures ca where ca.owner_id=u and ca.company_id=c
   ) z where (coalesce(p_data->>'filter','all')='all' and z.deleted_at is null) or z.result_state=p_data->>'filter' order by z.source_date desc,z.id desc offset n*20 limit 20
  ) x;
  select count(*) into n from public.captures ca where ca.owner_id=u and ca.company_id=c and ((coalesce(p_data->>'filter','all')='all' and ca.deleted_at is null) or private.capture_state(ca)=p_data->>'filter');return r||jsonb_build_object('count',n);
 elsif p_action='create' then
  if p_id is null then raise invalid_parameter_value;end if;
  if nullif(p_data->>'preview','') is not null then
   select * into selected from private.capture_selected_sources where id=(p_data->>'preview')::uuid and owner_id=u and company_id=c and expires_at>now();if not found then raise exception 'Preview expired. Select the conversation again.' using errcode='22023';end if;
   select * into conn from private.capture_connections where id=selected.connection_id and user_id=u and company_id=c;if not found or not(conn.provider=any(allowed)) then raise insufficient_privilege;end if;
   v:=selected.source;if v->>'format'='pdf' then raise invalid_parameter_value;end if;
   perform pg_advisory_xact_lock(hashtextextended(u::text||conn.id::text||(v->>'reference'),0));
   select id into new_id from public.captures where owner_id=u and company_id=c and source_account=conn.id and source_reference=v->>'reference' and coalesce(source_fingerprint,encode(extensions.digest(coalesce(nullif(private.capture_clean_text(source_text),''),source_text),'sha256'),'hex'))=encode(extensions.digest(coalesce(nullif(private.capture_clean_text(v->>'text'),''),v->>'text'),'sha256'),'hex') and deleted_at is null order by created_at desc limit 1;
   if new_id is not null then return to_jsonb(new_id);end if;
   new_id:=private.capture_change('create',p_id,null,jsonb_build_object('source_text',v->>'text','title',v->>'title','source_date',v->>'date','source_type',v->>'source_type','channel','paste'));
   update public.captures set source_provider=conn.provider,source_account=conn.id,source_reference=v->>'reference',source_url=v->>'url',sender=v->>'sender',source_updated_at=nullif(v->>'updated_at','')::timestamptz where id=new_id;
  else
   perform pg_advisory_xact_lock(hashtextextended(u::text||coalesce(p_data->>'source_text',''),0));
   select id into new_id from public.captures where owner_id=u and company_id=c and source_account is null and coalesce(source_fingerprint,encode(extensions.digest(coalesce(nullif(private.capture_clean_text(source_text),''),source_text),'sha256'),'hex'))=encode(extensions.digest(coalesce(nullif(private.capture_clean_text(p_data->>'source_text'),''),p_data->>'source_text'),'sha256'),'hex') and deleted_at is null order by created_at desc limit 1;
   if new_id is not null then return to_jsonb(new_id);end if;
   new_id:=private.capture_change('create',p_id,null,p_data);
   update public.captures set label=coalesce(p_data->>'label','') where id=new_id;
  end if;
  update public.captures set source_fingerprint=encode(extensions.digest(coalesce(nullif(private.capture_clean_text(source_text),''),source_text),'sha256'),'hex') where id=new_id;
  return to_jsonb(new_id);
 elsif p_action='queue' then
  if jsonb_typeof(p_data->'captures')<>'array' or jsonb_array_length(p_data->'captures') not between 1 and 10 then raise invalid_parameter_value;end if;
  for v in select value from jsonb_array_elements(p_data->'captures') loop
   select * into s from public.captures where id=(v#>>'{}')::uuid and owner_id=u and company_id=c and deleted_at is null for update;if not found then raise insufficient_privilege;end if;
   if s.draft_attempts=0 then insert into private.capture_queue(capture_id,owner_id,company_id) values(s.id,u,c) on conflict do nothing;end if;
  end loop;return '{}'::jsonb;
 elsif p_action='jobs' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'capture_id',capture_id,'state',state,'error',error)) from (select * from private.capture_queue where owner_id=u and company_id=c order by created_at desc limit 20) x),'[]');
 elsif p_action='watches' then return coalesce((select jsonb_agg(to_jsonb(w)-'lease_until'-'search_cursor'-'search_key') from private.capture_watches w where owner_id=u and company_id=c),'[]');
 elsif p_action='watch_save' then
  select * into conn from private.capture_connections where id=(p_data->>'connection')::uuid and user_id=u and company_id=c;if not found or not(conn.provider=any(allowed)) then raise insufficient_privilege;end if;
  if (select count(*) from private.capture_watches where owner_id=u)>=20 then raise exception 'You can keep up to 20 Watch rules.' using errcode='22023';end if;
  if jsonb_typeof(p_data->'filters')<>'object' or octet_length((p_data->'filters')::text)>6000 then raise invalid_parameter_value;end if;
  insert into private.capture_watches(owner_id,company_id,connection_id,place,filters,frequency,daily_cap) values(u,c,conn.id,p_data->>'place',p_data->'filters',(p_data->>'frequency')::int,(p_data->>'daily_cap')::int) returning id into new_id;
  insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'capture_watch',new_id,'created');return to_jsonb(new_id);
 elsif p_action='watch_toggle' then
  update private.capture_watches set enabled=coalesce((p_data->>'enabled')::boolean,false),state=case when coalesce((p_data->>'enabled')::boolean,false) then 'active' else 'paused' end,error=null,next_check=now() where id=p_id and owner_id=u and company_id=c;if not found then raise insufficient_privilege;end if;
  insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'capture_watch',p_id,'updated');return '{}';
 else raise invalid_parameter_value;end if;
end $function$;

