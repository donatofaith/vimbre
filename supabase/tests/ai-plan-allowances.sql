-- Prepend team-fixtures.sql. No model calls; all fixtures and changes roll back.
reset role;
do $$ declare s jsonb; r jsonb; uid uuid; primary_id uuid; begin
 if not exists(select 1 from public.ai_company_limits where company_id=current_setting('test.company')::uuid and plan='trial' and enabled) then raise exception 'Trial provisioning';end if;
 if (select count(*) from public.ai_limits)<>5 then raise exception 'Plan seeds';end if;
 if not exists(select 1 from public.ai_limits where plan='growth' and daily_request_limit=200 and monthly_request_limit=3000 and daily_cost_limit=4 and monthly_cost_limit=12) then raise exception 'Growth seed';end if;
 s:=private.ai_allowance_status(current_setting('test.company')::uuid);
 if s->>'plan'<>'trial' or (s->>'daily_request_limit')::int<>15 or (s->>'monthly_cost_limit')::numeric<>1 or (s->>'warning')::boolean then raise exception 'Initial Trial status';end if;
 -- Calendar reset values stay UTC even when the database session uses another timezone.
 perform set_config('TimeZone','Pacific/Honolulu',true);
 if (s->>'daily_reset_at')::timestamptz<>((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC' then raise exception 'UTC daily reset';end if;
 -- Both pending reservations and settled bills count; first reached dimension warns/blocks.
 update public.ai_limits set daily_request_limit=5,monthly_request_limit=1000,daily_cost_limit=100,monthly_cost_limit=100 where plan='trial';
 for i in 1..4 loop
  r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));
  if not (r->>'ok')::boolean then raise exception 'Reservation % denied',i;end if;
 end loop;
 s:=private.ai_allowance_status(current_setting('test.company')::uuid);
 if not (s->>'warning')::boolean or (s->>'blocked')::boolean or (s->>'daily_percent')::numeric<>80 then raise exception '80 percent warning';end if;
 r:=public.ai_gateway_begin(current_setting('test.admin')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));
 uid:=(r->>'usage_id')::uuid; primary_id:=(r->'route'->'primary'->>'id')::uuid;
 r:=public.ai_gateway_begin(current_setting('test.admin')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));
 if r->>'code'<>'limit_reached' or r->>'period'<>'day' or (r->>'reset_at')::timestamptz<now() then raise exception 'Daily stop';end if;
 s:=private.ai_allowance_status(current_setting('test.company')::uuid);if not (s->>'blocked')::boolean then raise exception '100 percent blocked';end if;
 -- Console plan edit affects existing companies immediately, with no code release.
 update public.ai_limits set daily_request_limit=20,monthly_request_limit=5 where plan='trial';
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));
 if r->>'period'<>'month' or (r->>'reset_at')::timestamptz<>(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC' then raise exception 'Monthly stop/reset';end if;
 -- USD costs, not just counts, independently stop calls before the reservation crosses a cap.
 update public.ai_limits set monthly_request_limit=1000,daily_cost_limit=0.01 where plan='trial';
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));if r->>'period'<>'day' then raise exception 'Daily spend';end if;
 update public.ai_limits set daily_cost_limit=100,monthly_cost_limit=0.01 where plan='trial';
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));if r->>'period'<>'month' then raise exception 'Monthly spend';end if;
 update public.ai_limits set daily_cost_limit=100,monthly_cost_limit=100 where plan='trial';
 -- Admin sees only their company; members receive request counts without pricing or spend.
 perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
 if (public.ai_allowance_summary()->>'daily_requests')::int<>5 then raise exception 'Admin company summary';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
 if (public.ai_allowance_summary()->>'daily_requests')::int<>0 then raise exception 'Cross-company summary';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.employee'),true);if public.ai_allowance_summary()->>'enabled'<>'true' or public.ai_allowance_summary() ? 'daily_cost' or public.ai_allowance_summary() ? 'plan' then raise exception 'Employee projection';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.manager'),true);if public.ai_allowance_summary()->>'enabled'<>'true' or public.ai_allowance_summary() ? 'monthly_cost' then raise exception 'Manager projection';end if;
 -- Disabled/custom Enterprise defaults fail closed; operators must set contract caps.
 update public.ai_company_limits set plan='enterprise' where company_id=current_setting('test.company')::uuid;
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));if r->>'code'<>'limit_reached' then raise exception 'Enterprise default unlimited';end if;
 update public.ai_company_limits set daily_request_limit=50,monthly_request_limit=100,daily_cost_limit=5,monthly_cost_limit=10 where company_id=current_setting('test.company')::uuid;
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));if not (r->>'ok')::boolean then raise exception 'Enterprise contract';end if;
 update public.ai_company_limits set enabled=false where company_id=current_setting('test.company')::uuid;
 r:=public.ai_gateway_begin(current_setting('test.employee')::uuid,gen_random_uuid(),'tidy_text',repeat('c',64));if r->>'code'<>'not_configured' then raise exception 'Company disabled';end if;
 -- Test fixtures never contain source or generated text in the ledger.
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='ai_usage' and column_name in ('text','prompt','output','source')) then raise exception 'Prompt storage';end if;
end $$;
set local role authenticated;
do $$ begin
 if has_table_privilege('authenticated','public.ai_limits','SELECT') or has_table_privilege('authenticated','public.ai_company_limits','UPDATE') then raise exception 'Customer plan access';end if;
 begin update public.ai_company_limits set plan='business';raise exception 'Customer upgraded';exception when insufficient_privilege then null;end;
 begin perform private.ai_allowance_status(gen_random_uuid());raise exception 'Customer arbitrary company';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.ai_allowance_summary();raise exception 'Anonymous summary';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AI plan seeds, console edits, Trial provisioning, UTC resets, warnings, four caps, Enterprise and tenant isolation passed' as result;
rollback;
