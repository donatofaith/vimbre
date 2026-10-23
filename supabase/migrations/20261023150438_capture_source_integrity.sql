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
end$$;

