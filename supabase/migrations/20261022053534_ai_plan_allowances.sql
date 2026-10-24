-- Approved plan allowances in USD; console edits require no frontend release.
create table public.ai_limits (
 plan text primary key check(plan in ('trial','starter','growth','business','enterprise')),
 daily_request_limit integer check(daily_request_limit between 0 and 1000000),
 monthly_request_limit integer check(monthly_request_limit between 0 and 31000000),
 daily_cost_limit numeric(16,8) check(daily_cost_limit between 0 and 1000000),
 monthly_cost_limit numeric(16,8) check(monthly_cost_limit between 0 and 10000000),
 enabled boolean not null default true,
 check(plan='enterprise' or (daily_request_limit is not null and monthly_request_limit is not null and daily_cost_limit is not null and monthly_cost_limit is not null))
);
alter table public.ai_limits enable row level security;
revoke all on public.ai_limits from public,anon,authenticated;
grant select,insert,update,delete on public.ai_limits to service_role;
insert into public.ai_limits(plan,daily_request_limit,monthly_request_limit,daily_cost_limit,monthly_cost_limit) values
 ('trial',15,100,0.25,1),('starter',40,500,0.75,2),('growth',200,3000,4,12),('business',1000,15000,20,60),('enterprise',null,null,null,null);
alter table public.ai_company_limits add column plan text references public.ai_limits(plan);
create index ai_company_limits_plan_idx on public.ai_company_limits(plan);
-- NULL preserves explicitly configured custom budgets. Enterprise uses the four company fields.
-- Only server operators can assign a paid plan. Never trust profile metadata or a browser choice.
create function private.ai_provision_trial() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ai_company_limits(company_id,plan,enabled) values(new.id,'trial',true) on conflict(company_id) do nothing;
 return new;
end $$;
revoke all on function private.ai_provision_trial() from public,anon,authenticated;
create trigger ai_provision_trial after insert on public.companies for each row execute function private.ai_provision_trial();
insert into public.ai_company_limits(company_id,plan,enabled) select id,'trial',true from public.companies on conflict(company_id) do nothing;

-- Service-only aggregation. Uses the same pending-reservation accounting as the gateway.
create function private.ai_allowance_status(p_company uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare q public.ai_company_limits; p public.ai_limits; dc bigint; mc bigint; ds numeric; ms numeric;
 day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 month_start timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 dp numeric; mp numeric;
begin
 select * into q from public.ai_company_limits where company_id=p_company;
 if not found or not q.enabled then return jsonb_build_object('enabled',false); end if;
 if q.plan is not null then
  select * into p from public.ai_limits where plan=q.plan;
  if not found or not p.enabled then return jsonb_build_object('enabled',false); end if;
  if q.plan<>'enterprise' then
   q.daily_request_limit:=p.daily_request_limit;q.monthly_request_limit:=p.monthly_request_limit;
   q.daily_cost_limit:=p.daily_cost_limit;q.monthly_cost_limit:=p.monthly_cost_limit;
  end if;
 end if;
 select count(*) filter(where created_at>=day_start),count(*),
 coalesce(sum(case when status='pending' then reserved_cost else cost end) filter(where created_at>=day_start),0),
 coalesce(sum(case when status='pending' then reserved_cost else cost end),0)
 into dc,mc,ds,ms from public.ai_usage where company_id=p_company and created_at>=month_start;
 dp:=greatest(case when q.daily_request_limit<=0 then 100 else 100.0*dc/q.daily_request_limit end,case when q.daily_cost_limit<=0 then 100 else 100.0*ds/q.daily_cost_limit end);
 mp:=greatest(case when q.monthly_request_limit<=0 then 100 else 100.0*mc/q.monthly_request_limit end,case when q.monthly_cost_limit<=0 then 100 else 100.0*ms/q.monthly_cost_limit end);
 return jsonb_build_object('enabled',true,'plan',coalesce(q.plan,'custom'),'warning',greatest(dp,mp)>=80,'blocked',greatest(dp,mp)>=100,
 'daily_percent',round(dp,1),'monthly_percent',round(mp,1),'daily_requests',dc,'monthly_requests',mc,'daily_cost',ds,'monthly_cost',ms,
 'daily_request_limit',q.daily_request_limit,'monthly_request_limit',q.monthly_request_limit,'daily_cost_limit',q.daily_cost_limit,'monthly_cost_limit',q.monthly_cost_limit,
 'period',case when mp>=100 then 'month' when dp>=100 then 'day' when mp>=dp then 'month' else 'day' end,
 'daily_reset_at',(date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC',
 'monthly_reset_at',(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC');
end $$;
revoke all on function private.ai_allowance_status(uuid) from public,anon,authenticated;
grant execute on function private.ai_allowance_status(uuid) to service_role;
-- Narrow admin summary: no supplied company ID, ledger rows, users, prompts or source content.
create function private.ai_allowance_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare company uuid;
begin
 if auth.uid() is null then return null; end if;
 select company_id into company from public.profiles where id=auth.uid() and active and role='hr_admin';
 if company is null then return null; end if;
 return private.ai_allowance_status(company);
end $$;
create function public.ai_allowance_summary() returns jsonb language sql security invoker set search_path='' as $$select private.ai_allowance_summary()$$;
revoke all on function private.ai_allowance_summary(),public.ai_allowance_summary() from public,anon;
grant execute on function private.ai_allowance_summary(),public.ai_allowance_summary() to authenticated;

create or replace function private.ai_gateway_begin(p_user uuid,p_request uuid,p_task text,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare company uuid; quota public.ai_company_limits; r public.ai_task_routes; p public.ai_models; f public.ai_models;
 existing public.ai_usage; reserve numeric; usage_id uuid; day_start timestamptz; month_start timestamptz;
 day_count bigint; month_count bigint; day_cost numeric; month_cost numeric; snapshot jsonb; plan public.ai_limits;
begin
 select company_id into company from public.profiles where id=p_user and active;
 if company is null then return jsonb_build_object('ok',false,'code','access_denied'); end if;
 -- Serialise every reservation for the company, including retries across workers.
 select * into quota from public.ai_company_limits where company_id=company for update;
 if not found or not quota.enabled then return jsonb_build_object('ok',false,'code','not_configured'); end if;
 -- Lock the plan as well: Console edits become effective on the next request.
 if quota.plan is not null then
  select * into plan from public.ai_limits where ai_limits.plan=quota.plan for share;
  if not found or not plan.enabled then return jsonb_build_object('ok',false,'code','not_configured'); end if;
  if quota.plan<>'enterprise' then
   quota.daily_request_limit:=plan.daily_request_limit;
   quota.monthly_request_limit:=plan.monthly_request_limit;
   quota.daily_cost_limit:=plan.daily_cost_limit;
   quota.monthly_cost_limit:=plan.monthly_cost_limit;
  end if;
 end if;
 select * into existing from public.ai_usage where company_id=company and user_id=p_user and request_id=p_request;
 if found then
  return jsonb_build_object('ok',false,'code',case when existing.fingerprint=p_fingerprint then 'already_requested' else 'idempotency_conflict' end);
 end if;
 select * into r from public.ai_task_routes where task=p_task and enabled;
 if not found then return jsonb_build_object('ok',false,'code','route_unavailable'); end if;
 select * into p from public.ai_models where id=r.primary_model_id and enabled;
 if not found then return jsonb_build_object('ok',false,'code','route_unavailable'); end if;
 select * into f from public.ai_models where id=r.fallback_model_id and enabled;
 -- Snapshot rates and both possible calls; later route/price changes cannot alter a reservation.
 snapshot:=jsonb_build_object('task',r.task,'max_output_tokens',r.max_output_tokens,'temperature',r.temperature,'primary',to_jsonb(p),'fallback',case when f.id is null then null else to_jsonb(f) end);
 reserve:=(32768*p.input_price_per_million+r.max_output_tokens*p.output_price_per_million)/1000000;
 if f.id is not null then reserve:=reserve+(32768*f.input_price_per_million+r.max_output_tokens*f.output_price_per_million)/1000000; end if;
 day_start:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 month_start:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 select count(*) filter(where created_at>=day_start),count(*),
 coalesce(sum(case when status='pending' then reserved_cost else cost end) filter(where created_at>=day_start),0),
 coalesce(sum(case when status='pending' then reserved_cost else cost end),0)
 into day_count,month_count,day_cost,month_cost from public.ai_usage where company_id=company and created_at>=month_start;
 if day_count>=quota.daily_request_limit or month_count>=quota.monthly_request_limit
 or day_cost+reserve>quota.daily_cost_limit or month_cost+reserve>quota.monthly_cost_limit then
  return jsonb_build_object('ok',false,'code','limit_reached',
   'period',case when month_count>=quota.monthly_request_limit or month_cost+reserve>quota.monthly_cost_limit then 'month' else 'day' end,
   'reset_at',case when month_count>=quota.monthly_request_limit or month_cost+reserve>quota.monthly_cost_limit
    then (date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC'
    else (date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC' end);
 end if;
 insert into public.ai_usage(request_id,company_id,user_id,task,model_id,fingerprint,reserved_cost,route_snapshot)
 values(p_request,company,p_user,p_task,p.id,p_fingerprint,reserve,snapshot) returning id into usage_id;
 return jsonb_build_object('ok',true,'usage_id',usage_id,'company_id',company,'route',snapshot);
end $$;

