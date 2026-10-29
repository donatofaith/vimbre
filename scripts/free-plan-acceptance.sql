-- Execute in a transaction after installing the candidate migration; always roll back.
do $$
declare u uuid:=gen_random_uuid();c uuid;u2 uuid:=gen_random_uuid();u3 uuid:=gen_random_uuid();u4 uuid:=gen_random_uuid();other_company uuid;chat uuid:=gen_random_uuid();token jsonb;result jsonb;blocked boolean:=false;i integer;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values(u,'free-test-'||u||'@example.invalid',now(),'{"company_name":"Free acceptance fixture","full_name":"Fixture Owner"}');
 select company_id into c from public.profiles where id=u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 result:=public.billing_access('status');if not (result->>'needs_choice')::boolean then raise exception 'New company skipped plan choice';end if;
 perform public.billing_access('choose_free');
 execute 'reset role';
 if (public.billing_access('status')->>'needs_choice')::boolean then raise exception 'Free choice did not persist';end if;
 result:=private.ai_allowance_status(c);
 if result->>'plan'<>'free' or (result->>'daily_request_limit')::int<>3 or (result->>'monthly_request_limit')::int<>15 then raise exception 'Wrong Free AI limits';end if;
 if not private.billing_ai_allowed(c) then raise exception 'Free AI incorrectly requires Stripe';end if;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)select id,'other-test-'||id||'@example.invalid',now(),'{"company_name":"Other fixture","full_name":"Fixture Person"}'::jsonb from unnest(array[u2,u3,u4])id;
 select company_id into other_company from public.profiles where id=u4;
 update public.profiles set company_id=c where id in(u2,u3);
 begin update public.profiles set company_id=c where id=u4;exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'Free member cap not enforced';end if;
 insert into public.chat_conversations(id,company_id,kind,title,created_by)values(chat,c,'group','Fixture',u);
 for i in 1..100 loop insert into public.chat_messages(id,conversation_id,company_id,sender_id,body)values(gen_random_uuid(),chat,c,u,'Fixture message');end loop;
 blocked:=false;begin insert into public.chat_messages(id,conversation_id,company_id,sender_id,body)values(gen_random_uuid(),chat,c,u,'Over limit');exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'Free chat cap not enforced';end if;
 insert into storage.objects(bucket_id,name,metadata)values('task-files',c||'/'||u||'/fixture/first','{"size":104857600}');
 blocked:=false;begin insert into storage.objects(bucket_id,name,metadata)values('task-files',c||'/'||u||'/fixture/extra','{"size":1}');exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'Free storage cap not enforced';end if;
 token:=private.billing_issue_access_code(c,'starter',30);
 if length(token->>'code')<>71 then raise exception 'Wrong code length';end if;
 -- A code for one company cannot be redeemed by another company owner.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u4,'role','authenticated')::text,true);
 blocked:=false;begin perform public.billing_access('redeem',token->>'code');exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'Cross-company code redemption permitted';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 result:=public.billing_access('redeem',token->>'code');if result->>'plan'<>'starter' then raise exception 'Code did not activate Starter';end if;
 if private.ai_allowance_status(c)->>'plan'<>'starter' then raise exception 'Code allowance mismatch';end if;
 if (private.ai_allowance_status(c)->>'monthly_request_limit')::int<>500 or (private.ai_allowance_status(c)->>'monthly_cost_limit')::numeric<>2 then raise exception 'Complimentary access bypassed spend safeguards';end if;
 blocked:=false;begin perform public.billing_access('redeem',token->>'code');exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'Code reused';end if;
 -- Expiry is checked on every request, without waiting for a scheduled job.
 update private.billing_access_codes set expires_at=now()-interval '1 second' where id=(token->>'id')::uuid;
 if private.billing_effective_plan(c)<>'free' then raise exception 'Expired access retained';end if;
 update private.billing_access_codes set expires_at=now()+interval '1 day' where id=(token->>'id')::uuid;
 -- Revocation immediately restores Free, without changing paid subscriptions or deleting data.
 update private.billing_access_codes set revoked_at=now() where id=(token->>'id')::uuid;
 if private.billing_effective_plan(c)<>'free' then raise exception 'Revocation failed';end if;
 if has_function_privilege('authenticated','private.billing_issue_access_code(uuid,text,integer)','execute') or has_function_privilege('anon','public.billing_access(text,text)','execute') then raise exception 'Access code privilege leak';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u2,'role','authenticated')::text,true);
 blocked:=false;begin perform public.billing_access('choose_free');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Nonowner changed billing';end if;
end$$;
