create table private.capture_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 provider text not null check(provider in ('gmail','drive','outlook','teams','slack','trello')),
 secret_id uuid not null references vault.secrets(id), connected_at timestamptz not null default now(),
 lease_until timestamptz, unique(user_id,company_id,provider)
);
create table private.capture_connection_states (
 hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade, provider text not null,
 secret_id uuid not null references vault.secrets(id), expires_at timestamptz not null default now()+interval '10 minutes'
);
create table private.capture_connection_rates(user_id uuid primary key, minute timestamptz not null, count integer not null);
alter table private.capture_connections enable row level security;
alter table private.capture_connection_states enable row level security;
alter table private.capture_connection_rates enable row level security;
revoke all on private.capture_connections,private.capture_connection_states,private.capture_connection_rates from public,anon,authenticated,service_role;
create function private.capture_connection_service(p_action text,p_user uuid,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
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
  if p_data->>'provider' not in ('gmail','drive','outlook','teams','slack','trello') then raise exception 'invalid_provider'; end if;
  -- Expired temporary grants are removed before another attempt.
  for s in delete from private.capture_connection_states where user_id=p_user and expires_at<now() returning * loop delete from vault.secrets where id=s.secret_id; end loop;
  if (select count(*) from private.capture_connection_states where user_id=p_user)>4 then raise exception 'rate_limited'; end if;
  secret:=vault.create_secret((p_data->'secret')::text);
  insert into private.capture_connection_states(hash,user_id,company_id,provider,secret_id) values(p_data->>'hash',p_user,company,p_data->>'provider',secret);
  return '{}'::jsonb;
 elsif p_action='store' then
  if p_data->>'company_id' is distinct from company::text then raise insufficient_privilege; end if;
  if p_data->>'provider' not in ('gmail','drive','outlook','teams','slack','trello') then raise exception 'invalid_provider'; end if;
  select * into c from private.capture_connections where user_id=p_user and company_id=company and provider=p_data->>'provider' for update;
  if found then perform vault.update_secret(c.secret_id,(p_data->'secret')::text);update private.capture_connections set lease_until=null,connected_at=now() where id=c.id;
  else secret:=vault.create_secret((p_data->'secret')::text);insert into private.capture_connections(user_id,company_id,provider,secret_id) values(p_user,company,p_data->>'provider',secret);end if;
  return '{}'::jsonb;
 end if;
 select * into c from private.capture_connections where id=(p_data->>'id')::uuid and user_id=p_user and company_id=company for update;
 if not found then raise insufficient_privilege; end if;
 if p_action='get' then
  if c.lease_until>now() then raise exception 'connection_busy'; end if;
  update private.capture_connections set lease_until=now()+interval '45 seconds' where id=c.id;
  select decrypted_secret::jsonb into value from vault.decrypted_secrets where id=c.secret_id;
  return jsonb_build_object('provider',c.provider,'secret',value);
 elsif p_action='unlock' then
  if p_data ? 'secret' then perform vault.update_secret(c.secret_id,(p_data->'secret')::text); end if;
  update private.capture_connections set lease_until=null where id=c.id;
 elsif p_action='remove' then
  delete from private.capture_connections where id=c.id;delete from vault.secrets where id=c.secret_id;
 else raise exception 'invalid_action';end if;
 return '{}'::jsonb;
end $$;
revoke all on function private.capture_connection_service(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.capture_connection_service(text,uuid,jsonb) to service_role;
create function public.capture_connection_service(p_action text,p_user uuid,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.capture_connection_service(p_action,p_user,p_data)$$;
revoke all on function public.capture_connection_service(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.capture_connection_service(text,uuid,jsonb) to service_role;

create function private.capture_connection_secret_cleanup() returns trigger language plpgsql security definer set search_path='' as $$begin delete from vault.secrets where id=old.secret_id;return old;end$$;
revoke all on function private.capture_connection_secret_cleanup() from public,anon,authenticated,service_role;
create trigger capture_connection_cleanup after delete on private.capture_connections for each row execute function private.capture_connection_secret_cleanup();
create trigger capture_connection_state_cleanup after delete on private.capture_connection_states for each row execute function private.capture_connection_secret_cleanup();
