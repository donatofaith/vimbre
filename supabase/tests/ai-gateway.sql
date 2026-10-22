-- Prepend team-fixtures.sql. Transaction rolls back; no provider calls or emails.
do $$ declare t text; begin
 foreach t in array array['ai_models','ai_task_routes','ai_company_limits','ai_usage'] loop
  begin execute format('select 1 from public.%I limit 1',t);raise exception 'Customer read allowed for %',t;exception when insufficient_privilege then null;end;
  if has_table_privilege('authenticated','public.'||t,'INSERT') or has_table_privilege('authenticated','public.'||t,'UPDATE') or has_table_privilege('authenticated','public.'||t,'DELETE') then raise exception 'Customer write grant on %',t;end if;
 end loop;
 begin perform public.ai_gateway_begin(auth.uid(),gen_random_uuid(),'tidy_text',repeat('a',64));raise exception 'Customer bypassed gateway';exception when insufficient_privilege then null;end;
 begin perform public.ai_gateway_finish(gen_random_uuid(),'[]');raise exception 'Customer forged usage';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.ai_gateway_begin(gen_random_uuid(),gen_random_uuid(),'tidy_text',repeat('a',64));raise exception 'Anonymous gateway bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Provisioning now creates Trial rows. Remove only test-company rows to exercise legacy missing/custom cases.
delete from public.ai_company_limits where company_id in (select company_id from public.profiles where id in (current_setting('test.admin')::uuid,current_setting('test.other_admin')::uuid));
set local role service_role;
do $$ declare r jsonb; id uuid:=gen_random_uuid(); uid uuid; p uuid; f uuid; q public.ai_usage; begin
 if (select count(*) from public.ai_models where enabled and model_name in ('claude-haiku-5-5','claude-sonnet-5-5'))<>2 then raise exception 'Model seeds';end if;
 if (select count(*) from public.ai_task_routes where enabled and task in ('capture_extract','tidy_text','weekly_summary','handover_draft'))<>4 then raise exception 'Route seeds';end if;
 if (select p.model_name from public.ai_task_routes r join public.ai_models p on p.id=r.primary_model_id where r.task='handover_draft')<>'claude-sonnet-5-5' then raise exception 'Handover route';end if;
 if exists(select 1 from public.ai_task_routes r join public.ai_models p on p.id=r.primary_model_id where r.task in ('capture_extract','tidy_text','weekly_summary') and p.model_name<>'claude-haiku-5-5') then raise exception 'Haiku routes';end if;
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,id,'tidy_text',repeat('a',64));
 if r->>'code'<>'not_configured' then raise exception 'Missing company limits must fail closed';end if;
 insert into public.ai_company_limits(company_id,daily_request_limit,monthly_request_limit,daily_cost_limit,monthly_cost_limit,enabled) values(current_setting('test.company')::uuid,1,2,1,2,true);
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,id,'tidy_text',repeat('a',64));
 if not (r->>'ok')::boolean or r->>'company_id'<>current_setting('test.company') then raise exception 'Trusted company reservation';end if;
 uid:=(r->>'usage_id')::uuid;p:=(r->'route'->'primary'->>'id')::uuid;f:=(r->'route'->'fallback'->>'id')::uuid;
 if (r->'route'->>'temperature') is not null then raise exception 'Unsupported sampling seed';end if;
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,id,'tidy_text',repeat('a',64));if r->>'code'<>'already_requested' then raise exception 'Duplicate reservation';end if;
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,id,'tidy_text',repeat('b',64));if r->>'code'<>'idempotency_conflict' then raise exception 'Changed retry payload';end if;
 r:=public.ai_gateway_begin(current_setting('test.admin')::uuid,gen_random_uuid(),'tidy_text',repeat('a',64));if r->>'code'<>'limit_reached' then raise exception 'Pending company daily count bypass';end if;
 update public.ai_company_limits set daily_request_limit=100,monthly_request_limit=1 where company_id=current_setting('test.company')::uuid;
 r:=public.ai_gateway_begin(current_setting('test.admin')::uuid,gen_random_uuid(),'tidy_text',repeat('a',64));if r->>'code'<>'limit_reached' then raise exception 'Monthly count bypass';end if;
 update public.ai_company_limits set monthly_request_limit=100,daily_cost_limit=0.000001 where company_id=current_setting('test.company')::uuid;
 r:=public.ai_gateway_begin(current_setting('test.admin')::uuid,gen_random_uuid(),'tidy_text',repeat('a',64));if r->>'code'<>'limit_reached' then raise exception 'Daily spend bypass';end if;
 update public.ai_company_limits set daily_cost_limit=1,monthly_cost_limit=0.000001 where company_id=current_setting('test.company')::uuid;
 r:=public.ai_gateway_begin(current_setting('test.admin')::uuid,gen_random_uuid(),'tidy_text',repeat('a',64));if r->>'code'<>'limit_reached' then raise exception 'Monthly spend bypass';end if;
 update public.ai_company_limits set monthly_cost_limit=2 where company_id=current_setting('test.company')::uuid;
 if (select count(*) from public.ai_usage where company_id=current_setting('test.company')::uuid)<>1 then raise exception 'Denied requests added usage';end if;
 begin perform public.ai_gateway_finish(uid,jsonb_build_array(jsonb_build_object('model_id',f,'input_tokens',1,'output_tokens',1,'outcome','success')));raise exception 'Wrong model accounting';exception when invalid_parameter_value then null;end;
 -- Rates are snapshotted, not repriced while a request is in flight.
 update public.ai_models set input_price_per_million=100,output_price_per_million=100 where ai_models.id in(p,f);
 perform public.ai_gateway_finish(uid,jsonb_build_array(jsonb_build_object('model_id',p,'input_tokens',10,'output_tokens',5,'outcome','failed'),jsonb_build_object('model_id',f,'input_tokens',20,'output_tokens',8,'outcome','success')));
 select * into q from public.ai_usage where ai_usage.id=uid;
 if q.cost<>0.0001235 or q.input_tokens<>30 or q.output_tokens<>13 or q.model_id<>f or q.status<>'completed' or q.cost_is_estimate or jsonb_array_length(q.attempts)<>2 then raise exception 'Usage accounting incorrect';end if;
 perform public.ai_gateway_finish(uid,'[]'); -- Replay cannot overwrite the settled row.
 if (select cost from public.ai_usage where ai_usage.id=uid)<>0.0001235 then raise exception 'Settlement not idempotent';end if;
 update public.ai_models set input_price_per_million=0.1,output_price_per_million=0.5 where ai_models.id=p;
 update public.ai_models set input_price_per_million=2,output_price_per_million=10 where ai_models.id=f;
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('a',64));uid:=(r->>'usage_id')::uuid;
 perform public.ai_gateway_finish(uid,jsonb_build_array(jsonb_build_object('model_id',p,'input_tokens',null,'output_tokens',null,'outcome','timeout'),jsonb_build_object('model_id',f,'input_tokens',3,'output_tokens',2,'outcome','success')));
 select * into q from public.ai_usage where ai_usage.id=uid;
 if not q.cost_is_estimate or q.cost<>0.0043268 or q.input_tokens is not null or q.output_tokens is not null then raise exception 'Unknown billing was silently released';end if;
 update public.ai_models set enabled=false where ai_models.id=p;
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('a',64));if r->>'code'<>'route_unavailable' then raise exception 'Disabled model called';end if;
 update public.ai_models set enabled=true where ai_models.id=p;
 update public.ai_task_routes set enabled=false where task='tidy_text';
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('a',64));if r->>'code'<>'route_unavailable' then raise exception 'Disabled route called';end if;
 update public.ai_task_routes set enabled=true where task='tidy_text';
 r:=public.ai_gateway_begin(current_setting('test.other_admin')::uuid,gen_random_uuid(),'tidy_text',repeat('a',64));if r->>'code'<>'not_configured' then raise exception 'Other company used first company budget';end if;
end $$;
reset role;
-- Confirm RLS and the deliberate absence of all customer policies.
do $$ begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('ai_models','ai_task_routes','ai_company_limits','ai_usage') and c.relrowsecurity)<>4 then raise exception 'RLS missing';end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename in ('ai_models','ai_task_routes','ai_company_limits','ai_usage')) then raise exception 'Unexpected customer policy';end if;
end $$;
select 'AI gateway access, routes, reservations, limits, idempotency and cost accounting passed' as result;
rollback;
