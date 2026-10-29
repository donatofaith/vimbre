do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();outside_user uuid:=gen_random_uuid();company uuid;role_id uuid;blocked boolean:=false;result jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)select id,'intro-'||id||'@example.invalid',now(),'{"company_name":"Intro fixture","full_name":"Fixture Person"}'::jsonb from unnest(array[u,v,outside_user])id;
 select company_id into company from public.profiles where id=u;
 update public.profiles set company_id=company where id=v;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 role_id:=private.ensure_role(u);
 execute 'set local role authenticated';
 result:=public.role_introduction(role_id,'I maintain the app and coordinate releases.');
 if result->>'introduction'<>'I maintain the app and coordinate releases.' then raise exception 'Introduction not saved';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);
 begin perform public.role_introduction(role_id,'Overwrite another holder');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Other holder changed introduction';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outside_user,'role','authenticated')::text,true);
 blocked:=false;begin perform public.role_introduction(role_id);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Another company read introduction';end if;
 if has_function_privilege('anon','public.role_introduction(uuid,text)','execute') then raise exception 'Anonymous access';end if;
 -- Exercise the actual service role, rather than only the database owner.
 execute 'set local role service_role';
 result:=public.ai_gateway_begin(u,gen_random_uuid(),'day_plan',encode(sha256(convert_to('fixture-plan-service-check','UTF8')),'hex'));
 if result->>'ok'<>'true' then raise exception 'AI service reservation failed: %',result->>'code';end if;
 execute 'reset role';
end$$;
