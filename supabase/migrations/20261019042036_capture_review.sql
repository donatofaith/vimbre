-- Source text and unconfirmed drafts are private to their owner.
create table public.captures (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 owner_id uuid not null,
 title text not null check(char_length(btrim(title)) between 1 and 200),
 source_text text not null check(char_length(btrim(source_text)) between 1 and 50000),
 source_type text not null check(source_type in ('meeting','email','note')),
 source_date date not null,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 unique(id,owner_id,company_id),
 foreign key(owner_id,company_id) references public.profiles(id,company_id)
);
alter table public.actions add constraint actions_id_owner_company_key unique(id,owner_id,company_id);
create table public.capture_items (
 id uuid primary key default gen_random_uuid(),
 capture_id uuid not null,
 owner_id uuid not null,
 company_id uuid not null references public.companies(id) on delete cascade,
 kind text not null check(kind in ('decision','action','contact')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=20000),
 status text not null default 'pending' check(status in ('pending','confirmed','discarded')),
 origin text not null default 'manual' check(origin in ('manual','ai')),
 version integer not null default 1,
 decision_id uuid,
 action_id uuid,
 contact_id uuid,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 foreign key(capture_id,owner_id,company_id) references public.captures(id,owner_id,company_id),
 foreign key(decision_id,owner_id,company_id) references public.decisions(id,owner_id,company_id),
 foreign key(action_id,owner_id,company_id) references public.actions(id,owner_id,company_id),
 foreign key(contact_id,owner_id,company_id) references public.role_items(id,owner_id,company_id),
 check(num_nonnulls(decision_id,action_id,contact_id)=case when status='confirmed' then 1 else 0 end),
 check((status='pending')=(reviewed_at is null)),
 check((decision_id is null or kind='decision') and (action_id is null or kind='action') and (contact_id is null or kind='contact'))
);
create index captures_owner_list_idx on public.captures(owner_id,deleted_at,created_at desc,id);
create index captures_company_idx on public.captures(company_id);
create index capture_items_source_idx on public.capture_items(capture_id,owner_id,company_id,created_at,id);
create index capture_items_owner_idx on public.capture_items(owner_id,company_id);
create index capture_items_company_idx on public.capture_items(company_id);
create index capture_items_decision_idx on public.capture_items(decision_id,owner_id,company_id);
create index capture_items_action_idx on public.capture_items(action_id,owner_id,company_id);
create index capture_items_contact_idx on public.capture_items(contact_id,owner_id,company_id);
alter table public.captures enable row level security;
alter table public.capture_items enable row level security;
revoke all on public.captures,public.capture_items from public,anon,authenticated;
grant select on public.captures,public.capture_items to authenticated;
create policy captures_owner_read on public.captures for select to authenticated
 using(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()));
create policy capture_items_owner_read on public.capture_items for select to authenticated
 using(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()));
create trigger capture_audit after insert or update on public.captures for each row execute function private.audit_setup_change();
create trigger capture_item_audit after insert or update on public.capture_items for each row execute function private.audit_setup_change();

-- Narrow write boundary: no direct client writes to review state or output IDs.
create function private.capture_change(p_operation text,p_id uuid,p_capture uuid,p_data jsonb)
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
   'reason',coalesce(p_data->>'reason',''),'decided_by',coalesce(p_data->>'decided_by',''),
   'decided_on',p_data->>'decided_on','due_date',p_data->>'due_date',
   'contact_email',nullif(btrim(p_data->>'contact_email'),''),'contact_phone',nullif(btrim(p_data->>'contact_phone'),''));
  if p_operation='add' then
   if (select count(*) from public.capture_items where capture_id=source.id)>=100 then
    raise exception 'Use another capture after 100 drafts' using errcode='22023';
   end if;
   insert into public.capture_items(id,capture_id,owner_id,company_id,kind,payload)
   values(p_id,source.id,u,c,item_kind,data) on conflict(id) do nothing;
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
   insert into public.decisions(company_id,owner_id,title,reason,decided_by,decided_on)
   values(c,u,data->>'title',data->>'reason',data->>'decided_by',nullif(data->>'decided_on','')::date) returning id into target;
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
create function public.capture_change(p_operation text,p_id uuid,p_capture uuid,p_data jsonb)
returns uuid language sql security invoker set search_path='' as $$ select private.capture_change(p_operation,p_id,p_capture,p_data) $$;
revoke all on function public.capture_change(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.capture_change(text,uuid,uuid,jsonb) to authenticated;

create function public.capture_list(p_page integer,p_archived boolean) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('count',(select count(*) from public.captures where (deleted_at is not null)=p_archived),
 'rows',coalesce((select jsonb_agg(to_jsonb(s)) from (
  select id,title,source_type,source_date,deleted_at,created_at from public.captures
  where (deleted_at is not null)=p_archived order by created_at desc,id limit 10 offset least(greatest(p_page,0),100000)*10
 )s),'[]'::jsonb))
$$;
revoke all on function public.capture_list(integer,boolean) from public,anon,authenticated;
grant execute on function public.capture_list(integer,boolean) to authenticated;
create function public.capture_detail(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('source',to_jsonb(c),'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id) from public.capture_items i where i.capture_id=c.id),'[]'::jsonb))
 from public.captures c where c.id=p_id
$$;
revoke all on function public.capture_detail(uuid) from public,anon,authenticated;
grant execute on function public.capture_detail(uuid) to authenticated;
