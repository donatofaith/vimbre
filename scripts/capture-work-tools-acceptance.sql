begin;
set local statement_timeout='15s';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare u uuid; other_user uuid; company uuid; p text; connection_id uuid; value jsonb; grant_hash text:=repeat('b',64); denied boolean;
begin
 select id,company_id into u,company from public.profiles where active order by created_at limit 1;
 select id into other_user from public.profiles where active and id<>u order by created_at limit 1;
 if u is null or other_user is null then raise exception 'Need two active fixture identities';end if;
 foreach p in array array['github','notion','asana'] loop
  perform public.capture_connection_service('store',u,jsonb_build_object('provider',p,'company_id',company,'secret',jsonb_build_object('access_token','rollback-only-fixture')));
  select id into connection_id from private.capture_connections where user_id=u and provider=p;
  if connection_id is null then raise exception 'Missing connection';end if;
  value:=public.capture_connection_service('list',u,'{}');
  if value::text like '%rollback-only-fixture%' or value::text like '%secret_id%' then raise exception 'Metadata exposed token';end if;
  denied:=false;begin perform public.capture_connection_service('get',other_user,jsonb_build_object('id',connection_id));exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Cross-user connection read';end if;
 end loop;
 perform public.capture_connection_service('state_create',u,jsonb_build_object('provider','github','hash',grant_hash,'return_origin','https://vimbre.com','secret',jsonb_build_object('verifier','fixture')));
 denied:=false;begin perform public.capture_connection_service('state_claim',other_user,jsonb_build_object('hash',grant_hash));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'State owner bypass';end if;
 value:=public.capture_connection_service('state_claim',u,jsonb_build_object('hash',grant_hash));
 if value->>'provider'<>'github' then raise exception 'Wrong grant';end if;
 denied:=false;begin perform public.capture_connection_service('state_claim',u,jsonb_build_object('hash',grant_hash));exception when others then denied:=sqlerrm='connection_expired';end;
 if not denied then raise exception 'State reused';end if;
 foreach p in array array['gmail','drive','yahoo'] loop
  denied:=false;begin perform public.capture_connection_service('state_create',u,jsonb_build_object('provider',p,'hash',repeat('c',64),'return_origin','https://vimbre.com','secret','{}'::jsonb));exception when others then denied:=sqlerrm='invalid_provider';end;
  if not denied then raise exception 'Unsupported provider permitted';end if;
 end loop;
 if exists(select 1 from private.capture_tool_policy where allowed && array['gmail','drive']) then raise exception 'Removed policy still allowed';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 denied:=false;begin perform public.capture_connection_service('list',u,'{}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Client could access service';end if;
end $$;
select 'PASS: new encrypted connections; metadata privacy; cross-user rejection; bound single-use state; removed providers rejected; service-only access' as acceptance;
rollback;
