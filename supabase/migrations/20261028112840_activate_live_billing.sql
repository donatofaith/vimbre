-- Apply only after the approved billing-mail dispatcher is installed and ready.
CREATE OR REPLACE FUNCTION private.ai_gateway_begin(p_user uuid, p_request uuid, p_task text, p_fingerprint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare company uuid; quota public.ai_company_limits; r public.ai_task_routes; p public.ai_models; f public.ai_models;
 existing public.ai_usage; reserve numeric; usage_id uuid; day_start timestamptz; month_start timestamptz;
 day_count bigint; month_count bigint; day_cost numeric; month_cost numeric; snapshot jsonb; plan public.ai_limits;
begin
 select company_id into company from public.profiles where id=p_user and active;
 if company is null then return jsonb_build_object('ok',false,'code','access_denied'); end if;
 if not private.myday_enabled(company,'ai') then return jsonb_build_object('ok',false,'code','not_configured');end if;
 if not private.billing_ai_allowed(company) then return jsonb_build_object('ok',false,'code','billing_required');end if;
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
end $function$;
