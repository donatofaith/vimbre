create function private.capture_connection_bound(p_action text,p_user uuid,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.capture_connection_states; value jsonb;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege;end if;
 if p_action in ('state_redirect','state_claim') then
  select * into s from private.capture_connection_states where hash=p_data->>'hash' for update;
  if not found or s.expires_at<now() or not exists(select 1 from public.profiles where id=s.user_id and company_id=s.company_id and active) then raise exception 'connection_expired';end if;
  if p_action='state_redirect' then return jsonb_build_object('origin',s.return_origin);end if;
  if p_user is distinct from s.user_id then raise insufficient_privilege;end if;
 elsif p_action='state_create' then
  if p_data->>'return_origin' is null or p_data->>'return_origin' not in ('https://vimbre.com','https://www.vimbre.com','https://vimbre.vercel.app','https://vimbre.co.uk','https://www.vimbre.co.uk') then raise exception 'invalid_origin';end if;
 end if;
 value:=private.capture_connection_service(p_action,p_user,p_data);
 if p_action='state_create' then update private.capture_connection_states set return_origin=p_data->>'return_origin' where hash=p_data->>'hash' and user_id=p_user;end if;
 return value;
end$$;
revoke all on function private.capture_connection_bound(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.capture_connection_bound(text,uuid,jsonb) to service_role;
create or replace function public.capture_connection_service(p_action text,p_user uuid,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.capture_connection_bound(p_action,p_user,p_data)$$;
revoke all on function private.capture_connection_service(text,uuid,jsonb) from service_role;
