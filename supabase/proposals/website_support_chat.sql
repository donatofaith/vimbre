create table private.website_support_sessions(token_hash text primary key check(token_hash~'^[a-f0-9]{64}$'),ticket_id uuid unique not null references public.console_support_tickets(id)on delete cascade,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours');
create table private.website_support_limits(key text not null,bucket timestamptz not null,requests integer not null default 1,primary key(key,bucket));
alter table private.website_support_sessions enable row level security;alter table private.website_support_limits enable row level security;
revoke all on private.website_support_sessions,private.website_support_limits from public,anon,authenticated,service_role,console_backend;
create function private.website_support(p_action text,p_hash text,p_ip_hash text,p_request uuid default null,p_body text default '',p_name text default '')returns jsonb language plpgsql security definer set search_path=''as $$
declare s private.website_support_sessions;ticket uuid;mid uuid;calls int;bucket_start timestamptz:=date_trunc('hour',now());existing_body text;
begin
 if p_hash is null or p_hash!~'^[a-f0-9]{64}$'or p_ip_hash is null or p_ip_hash!~'^[a-f0-9]{64}$'or p_action not in('start','read','reply')or p_action is null then return jsonb_build_object('ok',false,'code','invalid_input');end if;
 insert into private.website_support_limits(key,bucket)values('global_requests',bucket_start)on conflict(key,bucket)do update set requests=website_support_limits.requests+1 returning requests into calls;
 if calls>6000 then return jsonb_build_object('ok',false,'code','rate_limited');end if;
 insert into private.website_support_limits(key,bucket)values('read:'||p_ip_hash,bucket_start)on conflict(key,bucket)do update set requests=website_support_limits.requests+1 returning requests into calls;
 if calls>600 then return jsonb_build_object('ok',false,'code','rate_limited');end if;
 select * into s from private.website_support_sessions where token_hash=p_hash for update;
 if s.token_hash is not null and s.expires_at<=now()then return jsonb_build_object('ok',false,'code','session_expired');end if;
 if p_action='start'and s.token_hash is null then
  if p_request is null or length(btrim(p_body))not between 1 and 2000 or length(p_name)>80 then return jsonb_build_object('ok',false,'code','invalid_input');end if;
  insert into private.website_support_limits(key,bucket)values('global_starts',bucket_start)on conflict(key,bucket)do update set requests=website_support_limits.requests+1 returning requests into calls;
  if calls>50 then return jsonb_build_object('ok',false,'code','rate_limited');end if;
  insert into private.website_support_limits(key,bucket)values('start:'||p_ip_hash,bucket_start)on conflict(key,bucket)do update set requests=website_support_limits.requests+1 returning requests into calls;
  if calls>5 then return jsonb_build_object('ok',false,'code','rate_limited');end if;
  perform pg_advisory_xact_lock(hashtextextended(p_hash,0));
  select * into s from private.website_support_sessions where token_hash=p_hash;
  if s.token_hash is null then
   insert into public.console_support_tickets(company_name,customer_name,customer_email,subject,category)values('Website visitor',coalesce(nullif(btrim(p_name),''),'Website visitor'),'',left(btrim(p_body),160),'other')returning id into ticket;
   insert into private.website_support_sessions(token_hash,ticket_id)values(p_hash,ticket)returning * into s;
   insert into public.console_ticket_messages(ticket_id,sender_kind,body,request_id)values(ticket,'customer',btrim(p_body),p_request);
  end if;
 elsif s.token_hash is null then return jsonb_build_object('ok',false,'code','session_expired');end if;
 if p_action='reply'then
  if p_request is null or length(btrim(p_body))not between 1 and 2000 then return jsonb_build_object('ok',false,'code','invalid_input');end if;
  select id,body into mid,existing_body from public.console_ticket_messages where ticket_id=s.ticket_id and request_id=p_request and sender_kind='customer'limit 1;
  if mid is null then
   insert into private.website_support_limits(key,bucket)values('send:'||p_hash,bucket_start)on conflict(key,bucket)do update set requests=website_support_limits.requests+1 returning requests into calls;
   if calls>30 then return jsonb_build_object('ok',false,'code','rate_limited');end if;
   insert into public.console_ticket_messages(ticket_id,sender_kind,body,request_id)values(s.ticket_id,'customer',btrim(p_body),p_request);
   update public.console_support_tickets set updated_at=now()where id=s.ticket_id;
  elsif existing_body<>btrim(p_body)then return jsonb_build_object('ok',false,'code','request_conflict');end if;
 end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('expires_at',s.expires_at,'messages',coalesce((select jsonb_agg(to_jsonb(m)order by created_at,id)from(select id,sender_kind,body,created_at from public.console_ticket_messages where ticket_id=s.ticket_id order by created_at desc,id desc limit 50)m),'[]'::jsonb)));
end $$;
revoke all on function private.website_support(text,text,text,uuid,text,text)from public,anon,authenticated,console_backend;
grant execute on function private.website_support(text,text,text,uuid,text,text)to service_role;
create function public.website_support_service(p_action text,p_hash text,p_ip_hash text,p_request uuid default null,p_body text default '',p_name text default '')returns jsonb language sql security invoker set search_path=''as $$select private.website_support(p_action,p_hash,p_ip_hash,p_request,p_body,p_name)$$;
revoke all on function public.website_support_service(text,text,text,uuid,text,text)from public,anon,authenticated;
grant execute on function public.website_support_service(text,text,text,uuid,text,text)to service_role;
