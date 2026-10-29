-- Free workspaces and bounded complimentary access. No Stripe billing state is fabricated.
alter table public.ai_limits drop constraint ai_limits_plan_check;
alter table public.ai_limits add constraint ai_limits_plan_check check(plan in ('free','trial','starter','growth','business','enterprise'));
insert into public.ai_limits(plan,daily_request_limit,monthly_request_limit,daily_cost_limit,monthly_cost_limit,enabled)
values('free',3,15,.25,1,true);

create table private.billing_plan_choices(company_id uuid primary key references public.companies(id) on delete cascade,chosen_at timestamptz not null default now());
create table private.billing_access_codes(
 id uuid primary key default gen_random_uuid(),code_hash bytea unique not null,
 company_id uuid not null references public.companies(id) on delete cascade,
 plan text not null check(plan in ('starter','growth','business')),expires_at timestamptz not null,
 redeemed_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now());
alter table private.billing_plan_choices enable row level security;
alter table private.billing_access_codes enable row level security;
revoke all on private.billing_plan_choices,private.billing_access_codes from public,anon,authenticated;
-- Existing workspaces keep access; only new company owners must choose a plan.
insert into private.billing_plan_choices(company_id) select id from public.companies;

create function private.billing_effective_plan(p_company uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare chosen text;a private.billing_live_accounts;
begin
 select plan into chosen from private.billing_access_codes where company_id=p_company and redeemed_at is not null and revoked_at is null and expires_at>now() order by expires_at desc limit 1;
 if chosen is not null then return chosen;end if;
 select * into a from private.billing_live_accounts where company_id=p_company;
 if a.subscription_id is not null then
  if a.status='trialing' and a.trial_ends_at>now() then return 'trial';end if;
  if a.status='active' and a.period_ends_at>now() then return case a.price_id when 'price_1UVUXb4AwSci2kG6vvor5nsm' then 'starter' when 'price_1UVUXg4AwSci2kG6AX2jfzEK' then 'growth' when 'price_1UVUXm4AwSci2kG6lxKPqCNa' then 'business' else 'free' end;end if;
 end if;
 -- Preserve explicitly configured Enterprise contracts.
 if exists(select 1 from public.ai_company_limits where company_id=p_company and plan='enterprise')then return 'enterprise';end if;
 return 'free';
end$$;
revoke all on function private.billing_effective_plan(uuid) from public,anon,authenticated;

create or replace function private.billing_ai_allowed(p_company uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.companies where id=p_company)
$$;

-- Issuance is a database-administrator operation; users can only redeem a bound code.
create function private.billing_issue_access_code(p_company uuid,p_plan text,p_days integer default 30) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text;code_id uuid;until_at timestamptz;
begin
 if p_company is null or p_plan is null or p_plan not in('starter','growth','business') or p_days is null or p_days not between 1 and 365 then raise invalid_parameter_value;end if;
 token:='VIMBRE-'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');until_at:=now()+make_interval(days=>p_days);
 insert into private.billing_access_codes(company_id,plan,code_hash,expires_at)values(p_company,p_plan,sha256(convert_to(token,'UTF8')),until_at) returning id into code_id;
 return jsonb_build_object('id',code_id,'code',token,'expires_at',until_at,'plan',p_plan);
end$$;
revoke all on function private.billing_issue_access_code(uuid,text,integer) from public,anon,authenticated,service_role;

create function private.billing_access(p_operation text,p_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.profiles;code private.billing_access_codes;chosen text;ends timestamptz;
begin
 select p.* into member from public.profiles p join public.companies c on c.id=p.company_id and c.created_by=p.id where p.id=auth.uid() and p.active and p.role='hr_admin';
 if not found then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(member.company_id::text,731));
 if p_operation='redeem' then
  if p_code is null or length(p_code)<>71 then raise check_violation using message='This access code is unavailable for your company.';end if;
  select * into code from private.billing_access_codes where code_hash=sha256(convert_to(btrim(p_code),'UTF8')) and company_id=member.company_id for update;
  if not found or code.revoked_at is not null or code.expires_at<=now() or code.redeemed_at is not null then raise check_violation using message='This access code is unavailable for your company.';end if;
  update private.billing_access_codes set redeemed_at=now() where id=code.id;
  insert into private.billing_plan_choices(company_id)values(member.company_id)on conflict do nothing;
 elsif p_operation='choose_free' then
  insert into private.billing_plan_choices(company_id)values(member.company_id)on conflict do nothing;
 elsif p_operation<>'status' then raise invalid_parameter_value;end if;
 chosen:=private.billing_effective_plan(member.company_id);
 select max(expires_at) into ends from private.billing_access_codes where company_id=member.company_id and redeemed_at is not null and revoked_at is null and expires_at>now();
 return jsonb_build_object('plan',chosen,'access_ends_at',ends,'needs_choice',chosen='free' and not exists(select 1 from private.billing_plan_choices where company_id=member.company_id),'free_members',3,'free_messages',100,'free_storage_bytes',104857600,'free_daily_ai',3,'free_monthly_ai',15);
end$$;
revoke all on function private.billing_access(text,text) from public,anon,authenticated;
create function public.billing_access(p_operation text,p_code text default null) returns jsonb language sql security invoker set search_path='' as $$select private.billing_access(p_operation,p_code)$$;
revoke all on function public.billing_access(text,text) from public,anon;
grant execute on function private.billing_access(text,text),public.billing_access(text,text) to authenticated;

create function private.billing_free_chat_cap() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.company_id::text,731));
 if private.billing_effective_plan(new.company_id)='free' and (select count(*) from public.chat_messages where company_id=new.company_id and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')>=100 then
  raise check_violation using message='Your Free plan has reached 100 chat messages this month. Upgrade in Plans and billing to send more.';
 end if;return new;
end$$;
revoke all on function private.billing_free_chat_cap() from public,anon,authenticated;
create trigger billing_free_chat_cap before insert on public.chat_messages for each row execute function private.billing_free_chat_cap();
create index if not exists chat_messages_company_month on public.chat_messages(company_id,created_at);

create function private.billing_storage_company(p_bucket text,p_name text) returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if p_bucket='role-documents' then return (select company_id from public.profiles where id=private.document_owner(p_name));end if;
 if p_bucket in('task-files','capture-originals')then return private.document_owner(p_name);end if;
 return null;
end$$;
create function private.billing_storage_cap() returns trigger language plpgsql security definer set search_path='' as $$
declare company uuid;used_bytes bigint;incoming bigint;
begin
 if new.bucket_id not in('task-files','capture-originals','role-documents')then return new;end if;
 company:=private.billing_storage_company(new.bucket_id,new.name);
 if company is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(company::text,731));
 if private.billing_effective_plan(company)<>'free' then return new;end if;
 -- Storage permission probes may omit metadata; actual completion supplies the server-measured size.
 if coalesce(new.metadata->>'size','') !~ '^[0-9]{1,12}$'then return new;end if;
 incoming:=(new.metadata->>'size')::bigint;
 if tg_op='UPDATE' then
  if company=private.billing_storage_company(old.bucket_id,old.name) and coalesce(old.metadata->>'size','')~'^[0-9]{1,12}$' then
   if incoming<=(old.metadata->>'size')::bigint then return new;end if;
  end if;
 end if;
 select coalesce(sum(case when coalesce(metadata->>'size','')~'^[0-9]{1,12}$'then (metadata->>'size')::bigint else 0 end),0)into used_bytes from storage.objects where id<>new.id and bucket_id in('task-files','capture-originals','role-documents') and private.billing_storage_company(bucket_id,name)=company;
 if used_bytes+incoming>104857600 then raise check_violation using message='Your Free plan has reached 100 MB of uploads. Remove an unused file or upgrade in Plans and billing.';end if;
 return new;
end$$;
revoke all on function private.billing_storage_company(text,text),private.billing_storage_cap() from public,anon,authenticated;
create trigger billing_free_storage_cap before insert or update of metadata,name,bucket_id on storage.objects for each row execute function private.billing_storage_cap();

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
 quota.plan:=private.billing_effective_plan(company);
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

CREATE OR REPLACE FUNCTION private.ai_allowance_status(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare q public.ai_company_limits; p public.ai_limits; dc bigint; mc bigint; ds numeric; ms numeric;
 day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 month_start timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 dp numeric; mp numeric;
begin
 select * into q from public.ai_company_limits where company_id=p_company;
 if not found or not q.enabled then return jsonb_build_object('enabled',false); end if;
 q.plan:=private.billing_effective_plan(p_company);
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
end $function$;

CREATE OR REPLACE FUNCTION private.ai_provision_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 insert into public.ai_company_limits(company_id,plan,enabled) values(new.id,'free',true) on conflict(company_id) do nothing;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.billing_live_member_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cap integer;
begin
 if not new.active then return new;end if;
 if tg_op='UPDATE' then if old.active and old.company_id=new.company_id then return new;end if;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.company_id::text,731));
 cap:=case private.billing_effective_plan(new.company_id) when 'free' then 3 when 'trial' then (select case price_id when 'price_1UVUXb4AwSci2kG6vvor5nsm' then 10 when 'price_1UVUXg4AwSci2kG6AX2jfzEK' then 50 else 250 end from private.billing_live_accounts where company_id=new.company_id) when 'starter' then 10 when 'growth' then 50 when 'business' then 250 else null end;
 if cap is not null and (select count(*) from public.profiles where company_id=new.company_id and active and id<>new.id)>=cap then
 raise check_violation using message='Your plan has reached its active member limit. Upgrade before adding another person.';end if;
 return new;
end$function$;
