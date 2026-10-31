-- Keep historical connections and captures; disable new Google consent and Watch.
alter table private.capture_connections drop constraint capture_connections_provider_check;
alter table private.capture_connections add constraint capture_connections_provider_check check (provider in ('gmail','drive','teams','trello','slack','outlook','github','notion','asana'));
alter table private.capture_tool_policy drop constraint capture_tool_policy_allowed_check;
update private.capture_tool_policy set allowed=case when allowed @> array['gmail','drive','outlook','teams','slack','trello'] then array['teams','trello','slack','outlook','github','notion','asana'] else array(select x from unnest(allowed) x where x not in ('gmail','drive')) end;
alter table private.capture_tool_policy add constraint capture_tool_policy_allowed_check check (allowed <@ array['teams','trello','slack','outlook','github','notion','asana']);
CREATE OR REPLACE FUNCTION private.capture_connection_service(p_action text, p_user uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c private.capture_connections; s private.capture_connection_states; company uuid; secret uuid; value jsonb; n integer;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege; end if;
 if p_action='state_claim' then
  select * into s from private.capture_connection_states where hash=p_data->>'hash' for update;
  if not found then raise exception 'connection_expired'; end if;
  select decrypted_secret::jsonb into value from vault.decrypted_secrets where id=s.secret_id;
  delete from private.capture_connection_states where hash=s.hash;
  delete from vault.secrets where id=s.secret_id;
  if s.expires_at<now() or not exists(select 1 from public.profiles where id=s.user_id and company_id=s.company_id and active) then raise exception 'connection_expired'; end if;
  return jsonb_build_object('user_id',s.user_id,'company_id',s.company_id,'provider',s.provider,'secret',value);
 end if;
 select company_id into company from public.profiles where id=p_user and active;
 if company is null then raise insufficient_privilege; end if;
 insert into private.capture_connection_rates values(p_user,date_trunc('minute',now()),1)
 on conflict(user_id) do update set minute=excluded.minute,count=case when private.capture_connection_rates.minute=excluded.minute then private.capture_connection_rates.count+1 else 1 end returning count into n;
 if n>120 then raise exception 'rate_limited'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'provider',provider,'connected_at',connected_at)) from private.capture_connections where user_id=p_user and company_id=company),'[]'::jsonb);
 elsif p_action='state_create' then
  if p_data->>'provider' not in ('teams','trello','slack','outlook','github','notion','asana') then raise exception 'invalid_provider'; end if;
  -- Expired temporary grants are removed before another attempt.
  for s in delete from private.capture_connection_states where user_id=p_user and expires_at<now() returning * loop delete from vault.secrets where id=s.secret_id; end loop;
  if (select count(*) from private.capture_connection_states where user_id=p_user)>4 then raise exception 'rate_limited'; end if;
  secret:=vault.create_secret((p_data->'secret')::text);
  insert into private.capture_connection_states(hash,user_id,company_id,provider,secret_id) values(p_data->>'hash',p_user,company,p_data->>'provider',secret);
  return '{}'::jsonb;
 elsif p_action='store' then
  if p_data->>'company_id' is distinct from company::text then raise insufficient_privilege; end if;
  if p_data->>'provider' not in ('teams','trello','slack','outlook','github','notion','asana') then raise exception 'invalid_provider'; end if;
  select * into c from private.capture_connections where user_id=p_user and company_id=company and provider=p_data->>'provider' for update;
  if found then perform vault.update_secret(c.secret_id,(p_data->'secret')::text);update private.capture_connections set lease_until=null,lease_token=null,connected_at=now() where id=c.id;
  else secret:=vault.create_secret((p_data->'secret')::text);insert into private.capture_connections(user_id,company_id,provider,secret_id) values(p_user,company,p_data->>'provider',secret);end if;
  return '{}'::jsonb;
 end if;
 select * into c from private.capture_connections where id=(p_data->>'id')::uuid and user_id=p_user and company_id=company for update;
 if not found then raise insufficient_privilege; end if;
 if p_action='get' then
  if c.lease_until>now() then raise exception 'connection_busy'; end if;
  c.lease_token:=gen_random_uuid();
  update private.capture_connections set lease_until=now()+interval '45 seconds',lease_token=c.lease_token where id=c.id;
  select decrypted_secret::jsonb into value from vault.decrypted_secrets where id=c.secret_id;
  return jsonb_build_object('provider',c.provider,'secret',value,'lease_token',c.lease_token);
 elsif p_action='unlock' then
  if p_data->>'lease_token' is distinct from c.lease_token::text then return '{}'::jsonb;end if;
  if p_data ? 'secret' then perform vault.update_secret(c.secret_id,(p_data->'secret')::text); end if;
  update private.capture_connections set lease_until=null,lease_token=null where id=c.id;
 elsif p_action='remove' then
  if p_data->>'lease_token' is distinct from c.lease_token::text then raise exception 'connection_busy';end if;
  delete from private.capture_connections where id=c.id;delete from vault.secrets where id=c.secret_id;
 else raise exception 'invalid_action';end if;
 return '{}'::jsonb;
end $function$
;
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
 select p.allowed into allowed from private.capture_tool_policy p where p.company_id=c;allowed:=coalesce(allowed,array['teams','trello','slack','outlook','github','notion','asana']);
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
  if conn.provider not in ('teams','trello','slack','outlook') then raise exception 'Watch is not available for this tool' using errcode='22023';end if;
  if (select count(*) from private.capture_watches where owner_id=u)>=20 then raise exception 'You can keep up to 20 Watch rules.' using errcode='22023';end if;
  if jsonb_typeof(p_data->'filters')<>'object' or octet_length((p_data->'filters')::text)>6000 then raise invalid_parameter_value;end if;
  insert into private.capture_watches(owner_id,company_id,connection_id,place,filters,frequency,daily_cap) values(u,c,conn.id,p_data->>'place',p_data->'filters',(p_data->>'frequency')::int,(p_data->>'daily_cap')::int) returning id into new_id;
  insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'capture_watch',new_id,'created');return to_jsonb(new_id);
 elsif p_action='watch_toggle' then
  update private.capture_watches set enabled=coalesce((p_data->>'enabled')::boolean,false),state=case when coalesce((p_data->>'enabled')::boolean,false) then 'active' else 'paused' end,error=null,next_check=now() where id=p_id and owner_id=u and company_id=c;if not found then raise insufficient_privilege;end if;
  insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'capture_watch',p_id,'updated');return '{}';
 else raise invalid_parameter_value;end if;
end $function$
;
CREATE OR REPLACE FUNCTION private.capture_search_service(p_user uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid;conn private.capture_connections;pg private.capture_search_pages;v jsonb;r jsonb;new_id uuid;policy text[];
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise insufficient_privilege;end if;
 select company_id into c from public.profiles where id=p_user and active;if c is null then raise insufficient_privilege;end if;
 if p_action='policy' then return jsonb_build_object('allowed',coalesce((select allowed from private.capture_tool_policy where company_id=c),array['teams','trello','slack','outlook','github','notion','asana']));end if;
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
end $function$
;
update private.capture_watches w set enabled=false,state='paused',error='This tool has been removed from Capture.' from private.capture_connections c where c.id=w.connection_id and c.provider in ('gmail','drive');
