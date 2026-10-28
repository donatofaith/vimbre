-- Live billing uses separate merchant mappings and private service-only state.
create table private.billing_live_accounts(
 company_id uuid primary key references public.companies(id),
 customer_id text unique,
 checkout_token uuid,
 checkout_lock_until timestamptz,
 checkout_plan text,
 subscription_id text unique,
 price_id text,
 status text not null default 'unsubscribed',
 trial_started_at timestamptz not null default now(),
 trial_ends_at timestamptz not null default now()+interval '3 days',
 period_ends_at timestamptz,
 cancel_at_period_end boolean not null default false,
 synced_at timestamptz,
 updated_at timestamptz not null default now()
);
create table private.billing_live_events(
 event_id text primary key,
 customer_id text not null,
 event_type text not null,
 received_at timestamptz not null default now()
);
alter table private.billing_live_accounts enable row level security;
alter table private.billing_live_events enable row level security;
revoke all on private.billing_live_accounts,private.billing_live_events from public,anon,authenticated,service_role;

create function private.billing_live_backend(p_operation text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member public.profiles; account private.billing_live_accounts; company_name text; target uuid; incoming timestamptz;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>20000 then raise invalid_parameter_value;end if;
 if p_operation='event' then
   if coalesce(p_data->>'stripe_account','')<>'acct_1UUpbY4AwSci2kG6' or not coalesce((p_data->>'livemode')::boolean,false) then raise insufficient_privilege;end if;
   select * into account from private.billing_live_accounts where customer_id=p_data->>'customer_id' for update;
   if not found then return '{"ignored":true}'::jsonb;end if;
   if exists(select 1 from private.billing_live_events where event_id=p_data->>'event_id') then return '{"duplicate":true}'::jsonb;end if;
   incoming:=(p_data->>'synced_at')::timestamptz;
   if incoming is null or incoming>now()+interval '1 minute' then raise invalid_parameter_value;end if;
   if coalesce(p_data->>'status','') not in('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused') then raise invalid_parameter_value;end if;
   if p_data->>'price_id' not in('price_1UVUXb4AwSci2kG6vvor5nsm','price_1UVUXg4AwSci2kG6AX2jfzEK','price_1UVUXm4AwSci2kG6lxKPqCNa') then raise invalid_parameter_value;end if;
   if account.subscription_id is not null and account.subscription_id<>p_data->>'subscription_id' and account.status not in('canceled','incomplete_expired','unsubscribed') then raise check_violation using message='Subscription conflict';end if;
   if account.synced_at is null or incoming>account.synced_at then
     update private.billing_live_accounts set subscription_id=p_data->>'subscription_id',price_id=p_data->>'price_id',status=p_data->>'status',
       period_ends_at=nullif(p_data->>'period_ends_at','')::timestamptz,cancel_at_period_end=coalesce((p_data->>'cancel_at_period_end')::boolean,false),synced_at=incoming,updated_at=now()
       where company_id=account.company_id;
   end if;
   insert into private.billing_live_events(event_id,customer_id,event_type) values(p_data->>'event_id',account.customer_id,p_data->>'event_type');
   return '{"ok":true}'::jsonb;
 end if;
 target:=nullif(p_data->>'user_id','')::uuid;
 select p.* into member from public.profiles p join public.companies c on c.id=p.company_id and c.created_by=p.id where p.id=target and p.active and p.role='hr_admin';
 if not found then raise insufficient_privilege;end if;
 select name into company_name from public.companies where id=member.company_id;
 insert into private.billing_live_accounts(company_id) values(member.company_id) on conflict(company_id) do nothing;
 select * into account from private.billing_live_accounts where company_id=member.company_id for update;
 if p_operation='bind_customer' then
   if coalesce(p_data->>'customer_id','') !~ '^cus_[A-Za-z0-9]+$' then raise invalid_parameter_value;end if;
   if account.customer_id is not null and account.customer_id<>p_data->>'customer_id' then raise check_violation;end if;
   update private.billing_live_accounts set customer_id=p_data->>'customer_id' where company_id=member.company_id returning * into account;
 elsif p_operation='checkout_claim' then
   if p_data->>'plan' not in('starter','growth','business') then raise invalid_parameter_value;end if;
   if account.checkout_lock_until>now() then
     if account.checkout_plan<>p_data->>'plan' then raise check_violation using message='A checkout is already in progress';end if;
   else
     update private.billing_live_accounts set checkout_token=gen_random_uuid(),checkout_lock_until=now()+interval '24 hours',checkout_plan=p_data->>'plan' where company_id=member.company_id returning * into account;
   end if;
 elsif p_operation<>'context' then raise invalid_parameter_value;
 end if;
 return to_jsonb(account)||jsonb_build_object('company_name',company_name,'sandbox',false,'trial_days',3,'members',(select count(*) from public.profiles where company_id=member.company_id and active));
end$$;
create function public.billing_live_backend(p_operation text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.billing_live_backend(p_operation,p_data)$$;
revoke all on function private.billing_live_backend(text,jsonb),public.billing_live_backend(text,jsonb) from public,anon,authenticated;
grant execute on function private.billing_live_backend(text,jsonb),public.billing_live_backend(text,jsonb) to service_role;

-- A single trial starts on company creation; existing companies start once on first billing access.
create function private.billing_live_trial() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into private.billing_live_accounts(company_id) values(new.id) on conflict(company_id) do nothing;return new;end$$;
create trigger billing_live_trial after insert on public.companies for each row execute function private.billing_live_trial();

create function private.billing_ai_allowed(p_company uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select case when subscription_id is null then now()<trial_ends_at
 when status='trialing' then now()<trial_ends_at
 when status='active' then now()<period_ends_at else false end from private.billing_live_accounts where company_id=p_company),true)
$$;
revoke all on function private.billing_ai_allowed(uuid) from public,anon,authenticated;
grant execute on function private.billing_ai_allowed(uuid) to service_role;

create function private.billing_apply_live_plan() returns trigger language plpgsql security definer set search_path='' as $$
declare chosen text;
begin
 chosen:=case when new.status='active' then case new.price_id when 'price_1UVUXb4AwSci2kG6vvor5nsm' then 'starter' when 'price_1UVUXg4AwSci2kG6AX2jfzEK' then 'growth' when 'price_1UVUXm4AwSci2kG6lxKPqCNa' then 'business' end
 when new.status='trialing' then 'trial' else null end;
 if chosen is not null then update public.ai_company_limits set plan=chosen where company_id=new.company_id;end if;
 return new;
end$$;
create trigger billing_apply_live_plan after insert or update of status,price_id on private.billing_live_accounts for each row execute function private.billing_apply_live_plan();

create function private.billing_live_member_cap() returns trigger language plpgsql security definer set search_path='' as $$
declare cap integer;
begin
 if not new.active then return new;end if;
 if tg_op='UPDATE' then if old.active and old.company_id=new.company_id then return new;end if;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.company_id::text,731));
 select case price_id when 'price_1UVUXb4AwSci2kG6vvor5nsm' then 10 when 'price_1UVUXg4AwSci2kG6AX2jfzEK' then 50 when 'price_1UVUXm4AwSci2kG6lxKPqCNa' then 250 end into cap from private.billing_live_accounts where company_id=new.company_id and status in('active','trialing');
 if cap is not null and (select count(*) from public.profiles where company_id=new.company_id and active and id<>new.id)>=cap then
 raise check_violation using message='Your plan has reached its active member limit. Upgrade before adding another person.';end if;
 return new;
end$$;
create trigger billing_live_member_cap before insert or update of company_id,active on public.profiles for each row execute function private.billing_live_member_cap();

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

revoke all on function private.billing_live_trial(),private.billing_apply_live_plan(),private.billing_live_member_cap() from public,anon,authenticated,service_role;
