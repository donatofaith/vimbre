-- Keep Capture's existing owner/company checks and private privileged boundary.
-- Origin is provenance only, never an authorization decision.
create or replace function private.capture_change(p_operation text,p_id uuid,p_capture uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); c uuid; source public.captures; draft public.capture_items;
 target uuid; data jsonb; item_kind text;
begin
 c:=private.current_company_id();
 if u is null or c is null then raise insufficient_privilege using message='Sign in to use Capture'; end if;
 if p_id is null or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>220000 then
  raise exception 'Invalid request' using errcode='22023';
 end if;
 if p_operation='create' then
  insert into public.captures(id,company_id,owner_id,title,source_text,source_type,source_date)
  values(p_id,c,u,coalesce(nullif(btrim(p_data->>'title'),''),'Untitled capture'),p_data->>'source_text',p_data->>'source_type',(p_data->>'source_date')::date)
  on conflict(id) do nothing;
  perform 1 from public.captures where id=p_id and owner_id=u and company_id=c;
  if not found then raise insufficient_privilege using message='Capture is unavailable'; end if;
  return p_id;
 end if;
 select * into source from public.captures where id=p_capture and owner_id=u and company_id=c for update;
 if not found then raise insufficient_privilege using message='Capture is unavailable'; end if;
 if p_operation in ('archive','restore') then
  update public.captures set deleted_at=case when p_operation='archive' then now() else null end where id=source.id;
  return source.id;
 end if;
 if source.deleted_at is not null then raise exception 'Restore this capture before reviewing it' using errcode='22023'; end if;
 if p_operation in ('add','edit') then
  item_kind:=p_data->>'kind';
  if item_kind is null or item_kind not in ('decision','action','contact') or char_length(btrim(coalesce(p_data->>'title',''))) not between 1 and 200 then
   raise exception 'Choose a type and a clear title' using errcode='22023';
  end if;
  data:=jsonb_build_object('title',btrim(p_data->>'title'),'details',coalesce(p_data->>'details',''),
   'next_step',coalesce(p_data->>'next_step',''),'reason',coalesce(p_data->>'reason',''),'decided_by',coalesce(p_data->>'decided_by',''),
   'decided_on',p_data->>'decided_on','due_date',p_data->>'due_date',
   'contact_email',nullif(btrim(p_data->>'contact_email'),''),'contact_phone',nullif(btrim(p_data->>'contact_phone'),''));
  if p_operation='add' then
   if (select count(*) from public.capture_items where capture_id=source.id)>=100 then
    raise exception 'Use another capture after 100 drafts' using errcode='22023';
   end if;
   insert into public.capture_items(id,capture_id,owner_id,company_id,kind,payload,origin)
   values(p_id,source.id,u,c,item_kind,data,case when p_data->>'origin'='ai' then 'ai' else 'manual' end) on conflict(id) do nothing;
   perform 1 from public.capture_items where id=p_id and capture_id=source.id and owner_id=u and company_id=c;
   if not found then raise insufficient_privilege using message='Draft is unavailable'; end if;
   return p_id;
  end if;
 end if;
 select * into draft from public.capture_items where id=p_id and capture_id=source.id and owner_id=u and company_id=c for update;
 if not found then raise insufficient_privilege using message='Draft is unavailable'; end if;
 if p_operation='confirm' and draft.status='confirmed' then return coalesce(draft.decision_id,draft.action_id,draft.contact_id); end if;
 if p_operation='discard' and draft.status='discarded' then return draft.id; end if;
 if draft.status<>'pending' or draft.version is distinct from (p_data->>'version')::integer then
  raise exception 'This draft changed. Reload it before continuing.' using errcode='40001';
 end if;
 if p_operation='edit' then
  update public.capture_items set kind=item_kind,payload=data,version=version+1 where id=draft.id;
  return draft.id;
 elsif p_operation='discard' then
  update public.capture_items set status='discarded',reviewed_at=now(),version=version+1 where id=draft.id;
  return draft.id;
 elsif p_operation='confirm' then
  data:=draft.payload;
  if draft.kind='decision' then
   insert into public.decisions(company_id,owner_id,title,reason,decided_by,decided_on,next_step)
   values(c,u,data->>'title',data->>'reason',data->>'decided_by',nullif(data->>'decided_on','')::date,coalesce(data->>'next_step','')) returning id into target;
   update public.capture_items set decision_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=draft.id;
  elsif draft.kind='action' then
   insert into public.actions(company_id,owner_id,title,details,due_date)
   values(c,u,data->>'title',coalesce(data->>'details',''),nullif(data->>'due_date','')::date) returning id into target;
   update public.capture_items set action_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=draft.id;
  else
   insert into public.role_items(company_id,owner_id,kind,title,details,contact_email,contact_phone)
   values(c,u,'external_contact',data->>'title',coalesce(data->>'details',''),data->>'contact_email',data->>'contact_phone') returning id into target;
   update public.capture_items set contact_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=draft.id;
  end if;
  return target;
 end if;
 raise exception 'Unsupported Capture operation' using errcode='22023';
end; $$;
revoke all on function private.capture_change(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.capture_change(text,uuid,uuid,jsonb) to authenticated;
