-- AI gateway only. Prices are USD per million tokens, verified 21 Oct 2026.
-- Haiku's short-prompt tier applies: the gateway caps counted input at 32768.
create table public.ai_models (
 id uuid primary key default gen_random_uuid(), provider text not null check(provider ~ '^[a-z][a-z0-9_]{1,39}$'),
 model_name text not null check(length(model_name) between 1 and 120),
 input_price_per_million numeric(14,6) not null check(input_price_per_million between 0 and 100000),
 output_price_per_million numeric(14,6) not null check(output_price_per_million between 0 and 100000),
 enabled boolean not null default false, unique(provider,model_name)
);
create table public.ai_task_routes (
 task text primary key check(task ~ '^[a-z][a-z0-9_]{1,79}$'),
 primary_model_id uuid not null references public.ai_models(id), fallback_model_id uuid references public.ai_models(id),
 max_output_tokens integer not null check(max_output_tokens between 1 and 8192),
 temperature numeric(3,2) check(temperature between 0 and 1), enabled boolean not null default false,
 check(fallback_model_id is null or fallback_model_id<>primary_model_id)
);
create index ai_task_routes_primary_idx on public.ai_task_routes(primary_model_id);
create index ai_task_routes_fallback_idx on public.ai_task_routes(fallback_model_id) where fallback_model_id is not null;
-- No budget was supplied: new and existing companies fail closed until configured.
create table public.ai_company_limits (
 company_id uuid primary key references public.companies(id) on delete cascade,
 daily_request_limit integer not null default 0 check(daily_request_limit between 0 and 1000000),
 monthly_request_limit integer not null default 0 check(monthly_request_limit between 0 and 31000000),
 daily_cost_limit numeric(16,8) not null default 0 check(daily_cost_limit between 0 and 1000000),
 monthly_cost_limit numeric(16,8) not null default 0 check(monthly_cost_limit between 0 and 10000000),
 enabled boolean not null default false
);
create table public.ai_usage (
 id uuid primary key default gen_random_uuid(), request_id uuid not null,
 company_id uuid not null references public.companies(id) on delete cascade, user_id uuid references public.profiles(id) on delete set null,
 task text not null, model_id uuid not null references public.ai_models(id),
 input_tokens bigint, output_tokens bigint, cost numeric(18,10) not null default 0 check(cost between 0 and 10000000),
 cost_is_estimate boolean not null default false,
 status text not null default 'pending' check(status in ('pending','completed','failed')),
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 reserved_cost numeric(18,10) not null check(reserved_cost between 0 and 10000000),
 route_snapshot jsonb not null, attempts jsonb not null default '[]',
 created_at timestamptz not null default now(), finished_at timestamptz,
 unique(company_id,user_id,request_id),
 check(input_tokens is null or input_tokens>=0), check(output_tokens is null or output_tokens>=0)
);
create index ai_usage_company_created_idx on public.ai_usage(company_id,created_at);
create index ai_usage_user_idx on public.ai_usage(user_id);
create index ai_usage_model_idx on public.ai_usage(model_id);

alter table public.ai_models enable row level security;
alter table public.ai_task_routes enable row level security;
alter table public.ai_company_limits enable row level security;
alter table public.ai_usage enable row level security;
revoke all on public.ai_models,public.ai_task_routes,public.ai_company_limits,public.ai_usage from public,anon,authenticated;
grant select,insert,update,delete on public.ai_models,public.ai_task_routes,public.ai_company_limits,public.ai_usage to service_role;
-- Intentionally no customer policies. Service-role-only functions are invokers.
grant usage on schema private to service_role;

insert into public.ai_models(provider,model_name,input_price_per_million,output_price_per_million,enabled) values
 ('anthropic','claude-haiku-5-5',0.10,0.50,true), ('anthropic','claude-sonnet-5-5',2.00,10.00,true);
insert into public.ai_task_routes(task,primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled)
select t.task,p.id,f.id,t.tokens,null,true from (values
 ('capture_extract','claude-haiku-5-5','claude-sonnet-5-5',4096),
 ('tidy_text','claude-haiku-5-5','claude-sonnet-5-5',2048),
 ('weekly_summary','claude-haiku-5-5','claude-sonnet-5-5',4096),
 ('handover_draft','claude-sonnet-5-5','claude-haiku-5-5',4096)
) t(task,primary_name,fallback_name,tokens)
join public.ai_models p on p.provider='anthropic' and p.model_name=t.primary_name
join public.ai_models f on f.provider='anthropic' and f.model_name=t.fallback_name;

create function private.ai_gateway_begin(p_user uuid,p_request uuid,p_task text,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare company uuid; quota public.ai_company_limits; r public.ai_task_routes; p public.ai_models; f public.ai_models;
 existing public.ai_usage; reserve numeric; usage_id uuid; day_start timestamptz; month_start timestamptz;
 day_count bigint; month_count bigint; day_cost numeric; month_cost numeric; snapshot jsonb;
begin
 select company_id into company from public.profiles where id=p_user and active;
 if company is null then return jsonb_build_object('ok',false,'code','access_denied'); end if;
 -- Serialise every reservation for the company, including retries across workers.
 select * into quota from public.ai_company_limits where company_id=company for update;
 if not found or not quota.enabled then return jsonb_build_object('ok',false,'code','not_configured'); end if;
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
  return jsonb_build_object('ok',false,'code','limit_reached');
 end if;
 insert into public.ai_usage(request_id,company_id,user_id,task,model_id,fingerprint,reserved_cost,route_snapshot)
 values(p_request,company,p_user,p_task,p.id,p_fingerprint,reserve,snapshot) returning id into usage_id;
 return jsonb_build_object('ok',true,'usage_id',usage_id,'company_id',company,'route',snapshot);
end $$;

create function private.ai_gateway_finish(p_usage uuid,p_attempts jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare u public.ai_usage; a jsonb; m jsonb; final_id uuid; n integer:=0; input_total bigint:=0; output_total bigint:=0;
 actual_input bigint; actual_output bigint; charge numeric:=0; estimated boolean:=false; entry_cost numeric; details jsonb:='[]'; outcome text;
begin
 select * into u from public.ai_usage where id=p_usage for update;
 if not found then raise exception 'Usage unavailable' using errcode='22023'; end if;
 if u.status<>'pending' then return; end if; -- Idempotent logging after an ambiguous database timeout.
 if jsonb_typeof(p_attempts)<>'array' or jsonb_array_length(p_attempts) not between 1 and 2 then raise exception 'Invalid attempts' using errcode='22023'; end if;
 for a in select value from jsonb_array_elements(p_attempts) loop
  m:=case when n=0 then u.route_snapshot->'primary' else u.route_snapshot->'fallback' end;
  if m is null or m='null'::jsonb or a->>'model_id' is distinct from m->>'id' then raise exception 'Invalid model' using errcode='22023'; end if;
  outcome:=a->>'outcome'; if outcome not in ('success','failed','timeout') or outcome is null then raise exception 'Invalid outcome' using errcode='22023'; end if;
  actual_input:=(a->>'input_tokens')::bigint; actual_output:=(a->>'output_tokens')::bigint;
  if actual_input is null or actual_output is null then
   -- A timed out provider may still bill. Never silently release its reservation.
   estimated:=true; entry_cost:=(32768*(m->>'input_price_per_million')::numeric+(u.route_snapshot->>'max_output_tokens')::integer*(m->>'output_price_per_million')::numeric)/1000000;
  else
   if actual_input<0 or actual_output<0 then raise exception 'Invalid tokens' using errcode='22023'; end if;
   entry_cost:=(actual_input*(m->>'input_price_per_million')::numeric+actual_output*(m->>'output_price_per_million')::numeric)/1000000;
   input_total:=input_total+actual_input; output_total:=output_total+actual_output;
  end if;
  charge:=charge+entry_cost; final_id:=(m->>'id')::uuid;
  details:=details||jsonb_build_array(a||jsonb_build_object('cost',entry_cost,'cost_is_estimate',actual_input is null or actual_output is null));
  n:=n+1;
 end loop;
 update public.ai_usage set model_id=final_id,input_tokens=case when estimated then null else input_total end,
 output_tokens=case when estimated then null else output_total end,cost=charge,cost_is_estimate=estimated,
 status=case when outcome='success' then 'completed' else 'failed' end,attempts=details,finished_at=now() where id=p_usage;
end $$;
create function public.ai_gateway_begin(p_user uuid,p_request uuid,p_task text,p_fingerprint text) returns jsonb language sql security invoker set search_path='' as $$select private.ai_gateway_begin(p_user,p_request,p_task,p_fingerprint)$$;
create function public.ai_gateway_finish(p_usage uuid,p_attempts jsonb) returns void language sql security invoker set search_path='' as $$select private.ai_gateway_finish(p_usage,p_attempts)$$;
revoke all on function private.ai_gateway_begin(uuid,uuid,text,text),public.ai_gateway_begin(uuid,uuid,text,text),private.ai_gateway_finish(uuid,jsonb),public.ai_gateway_finish(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.ai_gateway_begin(uuid,uuid,text,text),public.ai_gateway_begin(uuid,uuid,text,text),private.ai_gateway_finish(uuid,jsonb),public.ai_gateway_finish(uuid,jsonb) to service_role;
