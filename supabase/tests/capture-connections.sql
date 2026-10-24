-- Prepend team-fixtures.sql. All Vault material is synthetic and rolled back.
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare a uuid:=current_setting('test.admin')::uuid;b uuid:=current_setting('test.other_admin')::uuid; c uuid:=current_setting('test.company')::uuid;conn uuid;v_secret uuid;v jsonb;denied boolean:=false;
begin
 if has_function_privilege('authenticated','public.capture_connection_service(text,uuid,jsonb)','execute') or has_function_privilege('anon','public.capture_connection_service(text,uuid,jsonb)','execute') then raise exception 'private API exposed';end if;
 if has_table_privilege('authenticated','private.capture_connections','select') then raise exception 'token metadata exposed';end if;
 perform public.capture_connection_service('store',a,jsonb_build_object('provider','slack','company_id',c,'secret',jsonb_build_object('access_token','synthetic-only')));
 select id,secret_id into conn,v_secret from private.capture_connections where user_id=a;
 if (select decrypted_secret from vault.decrypted_secrets where id=v_secret) not like '%synthetic-only%' then raise exception 'Vault store failed';end if;
 v:=public.capture_connection_service('list',a);if v::text like '%synthetic%' or v::text like '%secret_id%' then raise exception 'metadata leaked token';end if;
 if jsonb_array_length(public.capture_connection_service('list',b))<>0 then raise exception 'cross company list';end if;
 begin perform public.capture_connection_service('get',b,jsonb_build_object('id',conn));exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'cross account token read';end if;
 v:=public.capture_connection_service('get',a,jsonb_build_object('id',conn));if v->'secret'->>'access_token'<>'synthetic-only' then raise exception 'service read failed';end if;
 denied:=false;begin perform public.capture_connection_service('get',a,jsonb_build_object('id',conn));exception when others then if sqlerrm like '%connection_busy%' then denied:=true;else raise;end if;end;if not denied then raise exception 'lease failed';end if;
 perform public.capture_connection_service('unlock',a,jsonb_build_object('id',conn,'lease_token',v->>'lease_token'));
 -- A reconnect must not be overwritten by an older in-flight refresh.
 perform public.capture_connection_service('store',a,jsonb_build_object('provider','slack','company_id',c,'secret',jsonb_build_object('access_token','new-grant')));
 perform public.capture_connection_service('unlock',a,jsonb_build_object('id',conn,'lease_token',v->>'lease_token','secret',jsonb_build_object('access_token','stale-grant')));
 v:=public.capture_connection_service('get',a,jsonb_build_object('id',conn));if v->'secret'->>'access_token'<>'new-grant' then raise exception 'stale refresh overwrote new consent';end if;
 perform public.capture_connection_service('unlock',a,jsonb_build_object('id',conn,'lease_token',v->>'lease_token'));

 perform public.capture_connection_service('state_create',a,jsonb_build_object('provider','slack','hash','synthetic-state','secret',jsonb_build_object('verifier','synthetic-verifier')));
 v:=public.capture_connection_service('state_claim',null,jsonb_build_object('hash','synthetic-state'));if v->'secret'->>'verifier'<>'synthetic-verifier' then raise exception 'state failed';end if;
 denied:=false;begin perform public.capture_connection_service('state_claim',null,jsonb_build_object('hash','synthetic-state'));exception when others then denied:=true;end;if not denied then raise exception 'state replay';end if;
 perform public.capture_connection_service('remove',a,jsonb_build_object('id',conn));if exists(select 1 from vault.secrets where id=v_secret) then raise exception 'secret retained';end if;
 update public.profiles set active=false where id=a;denied:=false;begin perform public.capture_connection_service('list',a);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'inactive access';end if;
end $$;
rollback;
