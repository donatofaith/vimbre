-- Capture: selected-source search, private previews, queue and opt-in Watch. No provider tokens in this schema.
alter table public.captures add column if not exists source_provider text;
alter table public.captures add column if not exists source_account uuid;
alter table public.captures add column if not exists source_reference text;
alter table public.captures add column if not exists source_url text;
alter table public.captures add column if not exists label text not null default '' check(char_length(label)<=100);
alter table public.captures add column if not exists result_state text check(result_state in ('needs_review','saved','no_actions','could_not_read'));
create index if not exists captures_source_reference_idx on public.captures(owner_id,source_account,source_reference) where source_reference is not null;
create table if not exists private.capture_tool_policy(company_id uuid primary key references public.companies(id) on delete cascade,allowed text[] not null default array['gmail','drive','outlook','teams','slack','trello'],check(allowed<@array['gmail','drive','outlook','teams','slack','trello']::text[]));
create table if not exists private.capture_search_pages(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,connection_id uuid not null references private.capture_connections(id) on delete cascade,fingerprint text not null,cursor text not null default '',page jsonb not null,expires_at timestamptz not null default now()+interval '5 minutes',unique(owner_id,connection_id,fingerprint,cursor));
create table if not exists private.capture_selected_sources(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,connection_id uuid not null references private.capture_connections(id) on delete cascade,source jsonb not null,expires_at timestamptz not null default now()+interval '10 minutes');
create table if not exists private.capture_watches(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,connection_id uuid not null references private.capture_connections(id) on delete cascade,place text not null check(char_length(place) between 1 and 1024),filters jsonb not null default '{}',frequency int not null default 60 check(frequency in (15,30,60,240,1440)),daily_cap int not null default 5 check(daily_cap between 1 and 100),enabled boolean not null default true,state text not null default 'active' check(state in ('active','paused','allowance','reconnect','error')),error text,next_check timestamptz not null default now(),lease_until timestamptz,created_at timestamptz not null default now());
create table if not exists private.capture_queue(id uuid primary key default gen_random_uuid(),capture_id uuid not null references public.captures(id) on delete cascade,owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,watch_id uuid references private.capture_watches(id) on delete set null,state text not null default 'pending' check(state in ('pending','claimed','success','failed','paused')),error text,created_at timestamptz not null default now(),finished_at timestamptz);
create unique index if not exists capture_queue_active_idx on private.capture_queue(capture_id) where state in ('pending','claimed');
create index if not exists capture_queue_pending_idx on private.capture_queue(created_at) where state='pending';
create index if not exists capture_watches_due_idx on private.capture_watches(next_check) where enabled;
alter table private.capture_tool_policy enable row level security;
alter table private.capture_search_pages enable row level security;
alter table private.capture_selected_sources enable row level security;
alter table private.capture_watches enable row level security;
alter table private.capture_queue enable row level security;
revoke all on private.capture_tool_policy,private.capture_search_pages,private.capture_selected_sources,private.capture_watches,private.capture_queue from public,anon,authenticated;

create or replace function private.capture_state(s public.captures) returns text language sql stable set search_path='' as $$
select case when s.deleted_at is not null then 'archived' when s.status='failed' then 'could_not_read' when s.status='saved' then 'saved' when s.result_state='no_actions' and not exists(select 1 from public.capture_items i where i.capture_id=s.id and i.status in ('pending','confirmed')) then 'no_actions' else 'needs_review' end
$$;
revoke all on function private.capture_state(public.captures) from public,anon,authenticated;

create or replace function private.capture_workspace(p_action text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();r jsonb;v jsonb;s public.captures;selected private.capture_selected_sources;conn private.capture_connections;n int;new_id uuid;allowed text[];
begin
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and company_id=c and active) then raise insufficient_privilege;end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>100000 then raise invalid_parameter_value;end if;
 select p.allowed into allowed from private.capture_tool_policy p where p.company_id=c;allowed:=coalesce(allowed,array['gmail','drive','outlook','teams','slack','trello']);
 if p_action='config' then return jsonb_build_object('allowed',allowed,'admin',exists(select 1 from public.profiles where id=u and role='hr_admin'));
 elsif p_action='allowed_tools' then
  if not exists(select 1 from public.profiles where id=u and role='hr_admin') or jsonb_typeof(p_data->'allowed')<>'array' then raise insufficient_privilege;end if;
  select coalesce(array_agg(value),'{}') into allowed from jsonb_array_elements_text(p_data->'allowed');
  insert into private.capture_tool_policy(company_id,allowed) values(c,allowed) on conflict(company_id) do update set allowed=excluded.allowed;
  insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'capture_tools',c,'updated');return jsonb_build_object('allowed',allowed);
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
   select id into new_id from public.captures where owner_id=u and company_id=c and source_account=conn.id and source_reference=v->>'reference' and source_text=v->>'text' and deleted_at is null order by created_at desc limit 1;
   if new_id is not null then return to_jsonb(new_id);end if;
   new_id:=private.capture_change('create',p_id,null,jsonb_build_object('source_text',v->>'text','title',v->>'title','source_date',v->>'date','source_type',v->>'source_type','channel','paste'));
   update public.captures set source_provider=conn.provider,source_account=conn.id,source_reference=v->>'reference',source_url=v->>'url',sender=v->>'sender' where id=new_id;
  else
   perform pg_advisory_xact_lock(hashtextextended(u::text||coalesce(p_data->>'source_text',''),0));
   select id into new_id from public.captures where owner_id=u and company_id=c and source_account is null and source_text=p_data->>'source_text' and deleted_at is null order by created_at desc limit 1;
   if new_id is not null then return to_jsonb(new_id);end if;
   new_id:=private.capture_change('create',p_id,null,p_data);
   update public.captures set label=coalesce(p_data->>'label','') where id=new_id;
  end if;
  return to_jsonb(new_id);
 elsif p_action='queue' then
  if jsonb_typeof(p_data->'captures')<>'array' or jsonb_array_length(p_data->'captures') not between 1 and 10 then raise invalid_parameter_value;end if;
  for v in select value from jsonb_array_elements(p_data->'captures') loop
   select * into s from public.captures where id=(v#>>'{}')::uuid and owner_id=u and company_id=c and deleted_at is null for update;if not found then raise insufficient_privilege;end if;
   if s.draft_attempts=0 then insert into private.capture_queue(capture_id,owner_id,company_id) values(s.id,u,c) on conflict do nothing;end if;
  end loop;return '{}'::jsonb;
 elsif p_action='jobs' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'capture_id',capture_id,'state',state,'error',error)) from (select * from private.capture_queue where owner_id=u and company_id=c order by created_at desc limit 20) x),'[]');
 elsif p_action='watches' then return coalesce((select jsonb_agg(to_jsonb(w)-'lease_until') from private.capture_watches w where owner_id=u and company_id=c),'[]');
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
end $$;
create or replace function public.capture_workspace(p_action text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.capture_workspace(p_action,p_id,p_data)$$;
revoke all on function private.capture_workspace(text,uuid,jsonb),public.capture_workspace(text,uuid,jsonb) from public,anon;
grant execute on function private.capture_workspace(text,uuid,jsonb),public.capture_workspace(text,uuid,jsonb) to authenticated;

-- Service-only metadata cache and previews. Every operation rechecks active membership and the owned connection.
create or replace function private.capture_search_service(p_user uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid;conn private.capture_connections;pg private.capture_search_pages;v jsonb;r jsonb;new_id uuid;policy text[];
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise insufficient_privilege;end if;
 select company_id into c from public.profiles where id=p_user and active;if c is null then raise insufficient_privilege;end if;
 if p_action='policy' then return jsonb_build_object('allowed',coalesce((select allowed from private.capture_tool_policy where company_id=c),array['gmail','drive','outlook','teams','slack','trello']));end if;
 select * into conn from private.capture_connections where id=(p_data->>'connection')::uuid and user_id=p_user and company_id=c;if not found then raise insufficient_privilege;end if;
 select allowed into policy from private.capture_tool_policy where company_id=c;if policy is not null and not(conn.provider=any(policy)) then raise insufficient_privilege;end if;
 if p_action='page_get' then
  select * into pg from private.capture_search_pages where connection_id=conn.id and owner_id=p_user and fingerprint=p_data->>'fingerprint' and cursor=coalesce(p_data->>'cursor','') and expires_at>now();
  if found then return pg.page||jsonb_build_object('cache',pg.id);end if;return null;
 elsif p_action='page_put' then
  if jsonb_typeof(p_data->'page'->'rows')<>'array' or jsonb_array_length(p_data->'page'->'rows')>20 or octet_length((p_data->'page')::text)>100000 then raise invalid_parameter_value;end if;
  delete from private.capture_search_pages where owner_id=p_user and expires_at<=now();
  if(select count(*) from private.capture_search_pages where owner_id=p_user)>200 then delete from private.capture_search_pages where id in(select id from private.capture_search_pages where owner_id=p_user order by expires_at limit 20);end if;
  insert into private.capture_search_pages(owner_id,company_id,connection_id,fingerprint,cursor,page) values(p_user,c,conn.id,p_data->>'fingerprint',coalesce(p_data->>'cursor',''),p_data->'page') on conflict(owner_id,connection_id,fingerprint,cursor) do update set page=excluded.page,expires_at=excluded.expires_at returning id into new_id;
  return (p_data->'page')||jsonb_build_object('cache',new_id);
 elsif p_action='cursor' then
  select * into pg from private.capture_search_pages where id=(p_data->>'token')::uuid and connection_id=conn.id and owner_id=p_user and fingerprint=p_data->>'fingerprint' and expires_at>now();if not found then raise exception 'search_expired' using errcode='22023';end if;return to_jsonb(pg.page->>'next');
 elsif p_action='selected_row' then
  select * into pg from private.capture_search_pages where id=(p_data->>'cache')::uuid and connection_id=conn.id and owner_id=p_user and expires_at>now();if not found then raise exception 'search_expired' using errcode='22023';end if;
  select value into r from jsonb_array_elements(pg.page->'rows') where value->>'reference'=p_data->>'reference' and value->>'kind'='item' limit 1;if r is null then raise insufficient_privilege;end if;return r;
 elsif p_action='preview_put' then
  v:=p_data->'source';if char_length(v->>'text') not between 1 and 16000 or octet_length(v::text)>60000 then raise invalid_parameter_value;end if;
  delete from private.capture_selected_sources where owner_id=p_user and expires_at<=now();
  if(select count(*) from private.capture_selected_sources where owner_id=p_user)>100 then raise exception 'rate_limited';end if;
  insert into private.capture_selected_sources(owner_id,company_id,connection_id,source) values(p_user,c,conn.id,v) returning id into new_id;return jsonb_build_object('preview',new_id);
 elsif p_action='preview_finish' then
  if char_length(btrim(p_data->>'text')) not between 1 and 16000 then raise invalid_parameter_value;end if;
  update private.capture_selected_sources set source=source||jsonb_build_object('text',p_data->>'text','format','text') where id=(p_data->>'preview')::uuid and owner_id=p_user and company_id=c and connection_id=conn.id and expires_at>now() and source->>'format'='pdf' returning source into v;
  if not found then raise insufficient_privilege;end if;return jsonb_build_object('preview',p_data->>'preview','source',v);
 elsif p_action='captured' then
  return coalesce((select jsonb_object_agg(source_reference,id) from(select distinct on(source_reference) source_reference,id from public.captures where owner_id=p_user and company_id=c and source_account=conn.id and source_reference in(select jsonb_array_elements_text(p_data->'references')) and deleted_at is null order by source_reference,created_at desc)x),'{}');
 else raise invalid_parameter_value;end if;
end $$;
create or replace function public.capture_search_service(p_user uuid,p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.capture_search_service(p_user,p_action,p_data)$$;
revoke all on function private.capture_search_service(uuid,text,jsonb),public.capture_search_service(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.capture_search_service(uuid,text,jsonb),public.capture_search_service(uuid,text,jsonb) to service_role;

-- Reuse the established confirmation pipeline; add result semantics and merge repeated AI proposals.
CREATE OR REPLACE FUNCTION private.capture_ai_complete(p_user uuid, p_request uuid, p_output text, p_items jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j private.capture_ai_jobs;s public.captures;r jsonb;
begin
 select * into j from private.capture_ai_jobs where request_id=p_request and owner_id=p_user for update;
 if not found then raise insufficient_privilege;end if;
 if j.state<>'pending' then return;end if;
 select * into s from public.captures where id=j.capture_id for update;
 if s.deleted_at is not null or not exists(select 1 from public.profiles where id=p_user and company_id=s.company_id and active) then raise insufficient_privilege;end if;
 if p_output is null then
  update private.capture_ai_jobs set state='failed',finished_at=now() where request_id=j.request_id;
  update public.captures set result_state='could_not_read',status='failed',error='AI could not prepare drafts. Your text is still here. You can add a task by hand.' where id=s.id;
  return;
 end if;
 if octet_length(p_output)>60000 then raise exception 'Draft response is too long' using errcode='22023';end if;
 if j.task='capture_extract' then
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>60 then raise exception 'Invalid draft response' using errcode='22023';end if;
  update public.capture_items set status='discarded',reviewed_at=now(),version=version+1 where capture_id=s.id and status='pending' and origin='ai';
  for r in select distinct on (value->>'kind',lower(btrim(value->'payload'->>'title')),coalesce(value->'payload'->>'due_date','')) value from jsonb_array_elements(p_items) loop
   if r->>'kind' not in ('decision','action','summary','contact') or jsonb_typeof(r->'payload')<>'object' or char_length(btrim(coalesce(r->'payload'->>'title',''))) not between 1 and 200 or octet_length((r->'payload')::text)>20000 then raise exception 'Invalid draft' using errcode='22023';end if;
   if (select count(*) from public.capture_items where capture_id=s.id)>=100 then raise exception 'A capture can contain up to 100 drafts' using errcode='22023';end if;
   insert into public.capture_items(capture_id,company_id,owner_id,kind,payload,origin) values(s.id,s.company_id,s.owner_id,r->>'kind',(r->'payload')||jsonb_build_object('owner_id',s.owner_id,'priority','normal','reminder_option','at_time','record_id',s.record_id,'department_id',s.department_id),'ai');
  end loop;
  update public.captures set result_state=case when jsonb_array_length(p_items)>0 then 'needs_review' else 'no_actions' end,status=case when jsonb_array_length(p_items)>0 then 'drafts_ready' else 'needs_review' end,error=null where id=s.id;
 end if;
 update private.capture_ai_jobs set output=p_output,state='success',finished_at=now() where request_id=j.request_id;
end$function$;


create table if not exists private.capture_automation_config(singleton boolean primary key default true check(singleton),enabled_from timestamptz not null default now());
insert into private.capture_automation_config(singleton) values(true) on conflict do nothing;
alter table private.capture_automation_config enable row level security;
revoke all on private.capture_automation_config from public,anon,authenticated;
-- Scheduler calls are service-only, after the existing dispatch token has been verified.
create or replace function private.capture_automation(p_action text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare q private.capture_queue;w private.capture_watches;conn private.capture_connections;v jsonb;u uuid;c uuid;new_id uuid;budget jsonb;remaining int;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_action='claim' then
  -- Only future, verified inbound receipts enter the new automatic draft flow.
  insert into private.capture_queue(capture_id,owner_id,company_id)
   select ca.id,ca.owner_id,ca.company_id from public.captures ca join private.capture_inbound_receipts ir on ir.capture_id=ca.id join public.capture_forwarding_addresses a on a.id=ir.address_id and a.owner_id=ca.owner_id join public.capture_channel_settings cs on cs.company_id=ca.company_id and cs.forwarding_enabled join public.profiles p on p.id=ca.owner_id and p.active
   where ca.created_at>=(select enabled_from from private.capture_automation_config where singleton) and a.enabled and a.verified_at is not null and ca.deleted_at is null and ca.draft_attempts=0 and not exists(select 1 from private.capture_queue j where j.capture_id=ca.id) limit 20 on conflict do nothing;
  update private.capture_queue set state='failed',error='Drafting was interrupted. Open the capture to retry.',finished_at=now() where state='claimed' and created_at<now()-interval '10 minutes';
  with due as(select j.id from private.capture_queue j join public.profiles p on p.id=j.owner_id and p.company_id=j.company_id and p.active join public.captures ca on ca.id=j.capture_id and ca.deleted_at is null where j.state='pending' order by j.created_at for update of j skip locked limit 3),claimed as(update private.capture_queue j set state='claimed' from due where due.id=j.id returning j.*) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into v from claimed;return v;
 elsif p_action='source' then
  select * into q from private.capture_queue where id=p_id and state='claimed' for update;if not found then raise insufficient_privilege;end if;
  if not exists(select 1 from public.profiles where id=q.owner_id and company_id=q.company_id and active) then raise insufficient_privilege;end if;
  return (select jsonb_build_object('text',source_text,'capture_id',id,'owner_id',owner_id,'company_id',company_id) from public.captures where id=q.capture_id and owner_id=q.owner_id and deleted_at is null);
 elsif p_action='finish' then
  select * into q from private.capture_queue where id=p_id and state='claimed' for update;if not found then return '{}';end if;
  if p_data->>'state' not in ('success','failed','paused') then raise invalid_parameter_value;end if;
  update private.capture_queue set state=p_data->>'state',error=left(p_data->>'error',300),finished_at=now() where id=q.id;
  if p_data->>'state'='paused' and q.watch_id is not null then update private.capture_watches set enabled=false,state='allowance',error='AI allowance used up. Resume when allowance is available.' where id=q.watch_id;end if;
  return '{}';
 elsif p_action='watch_claim' then
  with due as(select x.id from private.capture_watches x join public.profiles p on p.id=x.owner_id and p.company_id=x.company_id and p.active where x.enabled and x.next_check<=now() and (x.lease_until is null or x.lease_until<now()) order by x.next_check for update of x skip locked limit 2),claimed as(update private.capture_watches x set lease_until=now()+interval '3 minutes',next_check=now()+make_interval(mins=>x.frequency) from due where due.id=x.id returning x.*) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into v from claimed;return v;
 elsif p_action in ('watch_context','watch_source','watch_finish') then
  select * into w from private.capture_watches where id=p_id and enabled and lease_until>now() for update;if not found then raise insufficient_privilege;end if;
  select * into conn from private.capture_connections where id=w.connection_id and user_id=w.owner_id and company_id=w.company_id;if not found then raise insufficient_privilege;end if;
  if not exists(select 1 from public.profiles where id=w.owner_id and company_id=w.company_id and active) or exists(select 1 from private.capture_tool_policy where company_id=w.company_id and not(conn.provider=any(allowed))) then raise insufficient_privilege;end if;
  if p_action='watch_finish' then
   update private.capture_watches set lease_until=null,state=case when p_data->>'state' in('allowance','reconnect','error') then p_data->>'state' else 'active' end,enabled=case when p_data->>'state' in('allowance','reconnect') then false else true end,error=left(p_data->>'error',300) where id=w.id;return '{}';
  end if;
  budget:=private.ai_allowance_status(w.company_id);
  remaining:=case when coalesce((budget->>'enabled')::boolean,false) and not coalesce((budget->>'blocked')::boolean,false) then greatest(0,least((budget->>'daily_request_limit')::int-(budget->>'daily_requests')::int,(budget->>'monthly_request_limit')::int-(budget->>'monthly_requests')::int)) else 0 end;
  if remaining<1 then update private.capture_watches set enabled=false,state='allowance',error='AI allowance used up. Resume when allowance is available.',lease_until=null where id=w.id;return null;end if;
  if (select count(*) from private.capture_queue where watch_id=w.id and created_at>=date_trunc('day',now()))>=w.daily_cap then return null;end if;
  if p_action='watch_context' then return jsonb_build_object('provider',conn.provider,'remaining',least(remaining,w.daily_cap-(select count(*) from private.capture_queue where watch_id=w.id and created_at>=date_trunc('day',now()))));end if;
  v:=p_data->'source';if char_length(v->>'text') not between 1 and 16000 or nullif(v->>'reference','') is null then raise invalid_parameter_value;end if;
  perform pg_advisory_xact_lock(hashtextextended(w.owner_id::text||conn.id::text||(v->>'reference'),0));
  if exists(select 1 from public.captures where owner_id=w.owner_id and company_id=w.company_id and source_account=conn.id and source_reference=v->>'reference') then return null;end if;
  insert into public.captures(owner_id,company_id,title,source_text,source_type,source_date,channel,source_provider,source_account,source_reference,source_url,sender) values(w.owner_id,w.company_id,left(v->>'title',200),v->>'text',v->>'source_type',coalesce(nullif(v->>'date','')::date,current_date),'paste',conn.provider,conn.id,v->>'reference',v->>'url',v->>'sender') returning id into new_id;
  insert into private.capture_queue(capture_id,owner_id,company_id,watch_id) values(new_id,w.owner_id,w.company_id,w.id);
  insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(w.company_id,w.owner_id,'capture_watch',w.id,'matched');return to_jsonb(new_id);
 else raise invalid_parameter_value;end if;
end $$;
create or replace function public.capture_automation(p_action text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.capture_automation(p_action,p_id,p_data)$$;
revoke all on function private.capture_automation(text,uuid,jsonb),public.capture_automation(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.capture_automation(text,uuid,jsonb),public.capture_automation(text,uuid,jsonb) to service_role;
create or replace function private.dispatch_task_mail() returns void language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from private.task_delivery_config where enabled) and (exists(select 1 from private.task_mail_queue where state='pending') or exists(select 1 from private.myday_delivery_jobs where state='pending') or exists(select 1 from private.myday_files f join public.actions a on a.id=f.task_id where a.purged_at is not null) or exists(select 1 from private.capture_queue where state='pending') or exists(select 1 from private.capture_watches where enabled and next_check<=now()) or exists(select 1 from public.captures ca join private.capture_inbound_receipts ir on ir.capture_id=ca.id where ca.created_at>=(select enabled_from from private.capture_automation_config where singleton) and ca.draft_attempts=0 and ca.deleted_at is null and not exists(select 1 from private.capture_queue j where j.capture_id=ca.id))) then
 perform net.http_post(url:='https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/my-day-mail',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myday_dispatch_token')),body:='{}'::jsonb,timeout_milliseconds:=10000);
 end if;
end $$;
