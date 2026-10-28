-- Sandbox billing is deliberately isolated from paid entitlements and live AI quotas.
create table private.billing_sandbox_accounts(
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
create table private.billing_sandbox_events(
 event_id text primary key,
 customer_id text not null,
 event_type text not null,
 received_at timestamptz not null default now()
);
alter table private.billing_sandbox_accounts enable row level security;
alter table private.billing_sandbox_events enable row level security;
revoke all on private.billing_sandbox_accounts,private.billing_sandbox_events from public,anon,authenticated,service_role;

create function private.billing_sandbox_backend(p_operation text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member public.profiles; account private.billing_sandbox_accounts; company_name text; target uuid; incoming timestamptz;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>20000 then raise invalid_parameter_value;end if;
 if p_operation='event' then
   if coalesce(p_data->>'stripe_account','')<>'acct_1UUoHn3dlOUNkjoi' or coalesce((p_data->>'livemode')::boolean,true) then raise insufficient_privilege;end if;
   select * into account from private.billing_sandbox_accounts where customer_id=p_data->>'customer_id' for update;
   if not found then return '{"ignored":true}'::jsonb;end if;
   if exists(select 1 from private.billing_sandbox_events where event_id=p_data->>'event_id') then return '{"duplicate":true}'::jsonb;end if;
   incoming:=(p_data->>'synced_at')::timestamptz;
   if incoming is null or incoming>now()+interval '1 minute' then raise invalid_parameter_value;end if;
   if coalesce(p_data->>'status','') not in('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused') then raise invalid_parameter_value;end if;
   if p_data->>'price_id' not in('price_1UVThi3dlOUNkjoi0ggow2Zu','price_1UVThn3dlOUNkjoiywZd15dC','price_1UVThs3dlOUNkjoieDyhZHQw') then raise invalid_parameter_value;end if;
   if account.subscription_id is not null and account.subscription_id<>p_data->>'subscription_id' and account.status not in('canceled','incomplete_expired','unsubscribed') then raise check_violation using message='Subscription conflict';end if;
   if account.synced_at is null or incoming>account.synced_at then
     update private.billing_sandbox_accounts set subscription_id=p_data->>'subscription_id',price_id=p_data->>'price_id',status=p_data->>'status',
       period_ends_at=nullif(p_data->>'period_ends_at','')::timestamptz,cancel_at_period_end=coalesce((p_data->>'cancel_at_period_end')::boolean,false),synced_at=incoming,updated_at=now()
       where company_id=account.company_id;
   end if;
   insert into private.billing_sandbox_events(event_id,customer_id,event_type) values(p_data->>'event_id',account.customer_id,p_data->>'event_type');
   return '{"ok":true}'::jsonb;
 end if;
 target:=nullif(p_data->>'user_id','')::uuid;
 select p.* into member from public.profiles p join public.companies c on c.id=p.company_id and c.created_by=p.id where p.id=target and p.active and p.role='hr_admin';
 if not found then raise insufficient_privilege;end if;
 select name into company_name from public.companies where id=member.company_id;
 insert into private.billing_sandbox_accounts(company_id) values(member.company_id) on conflict(company_id) do nothing;
 select * into account from private.billing_sandbox_accounts where company_id=member.company_id for update;
 if p_operation='bind_customer' then
   if coalesce(p_data->>'customer_id','') !~ '^cus_[A-Za-z0-9]+$' then raise invalid_parameter_value;end if;
   if account.customer_id is not null and account.customer_id<>p_data->>'customer_id' then raise check_violation;end if;
   update private.billing_sandbox_accounts set customer_id=p_data->>'customer_id' where company_id=member.company_id returning * into account;
 elsif p_operation='checkout_claim' then
   if p_data->>'plan' not in('starter','growth','business') then raise invalid_parameter_value;end if;
   if account.checkout_lock_until>now() then
     if account.checkout_plan<>p_data->>'plan' then raise check_violation using message='A checkout is already in progress';end if;
   else
     update private.billing_sandbox_accounts set checkout_token=gen_random_uuid(),checkout_lock_until=now()+interval '24 hours',checkout_plan=p_data->>'plan' where company_id=member.company_id returning * into account;
   end if;
 elsif p_operation<>'context' then raise invalid_parameter_value;
 end if;
 return to_jsonb(account)||jsonb_build_object('company_name',company_name,'sandbox',true,'trial_days',3,'members',(select count(*) from public.profiles where company_id=member.company_id and active));
end$$;
create function public.billing_sandbox_backend(p_operation text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.billing_sandbox_backend(p_operation,p_data)$$;
revoke all on function private.billing_sandbox_backend(text,jsonb),public.billing_sandbox_backend(text,jsonb) from public,anon,authenticated;
grant execute on function private.billing_sandbox_backend(text,jsonb),public.billing_sandbox_backend(text,jsonb) to service_role;
