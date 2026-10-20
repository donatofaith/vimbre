-- Only provision a forwarding address after the receiving service is verified.
-- This table does not itself create a mailbox or an inbound webhook.
create table public.capture_forwarding_addresses (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 owner_id uuid not null unique,
 address text not null unique check(char_length(address)<=320 and address ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
 enabled boolean not null default false,
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(owner_id,company_id) references public.profiles(id,company_id),
 check(not enabled or verified_at is not null)
);
create index capture_forwarding_company_idx on public.capture_forwarding_addresses(company_id);
create index capture_forwarding_owner_company_idx on public.capture_forwarding_addresses(owner_id,company_id);
alter table public.capture_forwarding_addresses enable row level security;
revoke all on public.capture_forwarding_addresses from public,anon,authenticated;
grant select on public.capture_forwarding_addresses to authenticated;
grant all on public.capture_forwarding_addresses to service_role;
create policy capture_forwarding_owner_read on public.capture_forwarding_addresses for select to authenticated
 using(owner_id=(select auth.uid()) and company_id=(select private.current_company_id()));

create function public.my_day_summary() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or private.current_company_id() is null then
  raise insufficient_privilege using message='Sign in to view My day';
 end if;
 return jsonb_build_object(
  'pending_drafts',(select count(*) from public.capture_items i join public.captures c
    on c.id=i.capture_id and c.owner_id=i.owner_id and c.company_id=i.company_id
    where i.owner_id=(select auth.uid()) and i.status='pending' and c.deleted_at is null),
  'completed_sections',coalesce((select jsonb_agg(kind order by kind) from (
    select distinct kind from public.role_items where owner_id=(select auth.uid()) and deleted_at is null
  )s),'[]'::jsonb),
  'forwarding_address',(select address from public.capture_forwarding_addresses where owner_id=(select auth.uid()) and enabled and verified_at is not null)
 );
end; $$;
revoke all on function public.my_day_summary() from public,anon,authenticated;
grant execute on function public.my_day_summary() to authenticated;
