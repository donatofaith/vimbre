-- Fresh build. No pre-existing tables or records are changed.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.companies (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 1 and 120),
 contact_email text check (contact_email is null or (char_length(contact_email) <= 320 and position('@' in contact_email) > 1)),
 team_mode text not null default 'small' check (team_mode in ('small','departments')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.departments (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 120),
 manager_id uuid,
 created_at timestamptz not null default now(),
 unique (id, company_id), unique (company_id,name)
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
 email text not null check (char_length(email) <= 320),
 role text not null default 'employee' check (role in ('hr_admin','manager','employee')),
 department_id uuid,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (id,company_id),
 foreign key (department_id,company_id) references public.departments(id,company_id)
);
alter table public.departments add constraint departments_manager_company_fkey
 foreign key (manager_id,company_id) references public.profiles(id,company_id);
create table public.activity_log (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 record_type text not null,
 record_id uuid not null,
 action text not null,
 created_at timestamptz not null default now()
);
create index companies_created_by_idx on public.companies(created_by);
create index profiles_company_id_idx on public.profiles(company_id);
create index profiles_department_company_idx on public.profiles(department_id,company_id);
create index departments_manager_company_idx on public.departments(manager_id,company_id);
create index activity_log_company_created_idx on public.activity_log(company_id,created_at desc);
create index activity_log_actor_idx on public.activity_log(actor_id);

-- Narrow, authenticated self lookups prevent recursive policies on profiles.
-- This schema is not exposed through the REST API. No arbitrary ID is accepted.
create function private.current_company_id() returns uuid language sql stable security definer set search_path = ''
 as $$ select company_id from public.profiles where id=(select auth.uid()) and active $$;
create function private.current_role() returns text language sql stable security definer set search_path = ''
 as $$ select role from public.profiles where id=(select auth.uid()) and active $$;
create function private.current_department_id() returns uuid language sql stable security definer set search_path = ''
 as $$ select department_id from public.profiles where id=(select auth.uid()) and active $$;
revoke all on function private.current_company_id(), private.current_role(), private.current_department_id() from public, anon;
grant execute on function private.current_company_id(), private.current_role(), private.current_department_id() to authenticated;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.activity_log enable row level security;
revoke all on public.companies, public.profiles, public.departments, public.activity_log from public, anon, authenticated;
grant select on public.companies, public.profiles, public.departments, public.activity_log to authenticated;
grant update (name,contact_email,team_mode) on public.companies to authenticated;
grant update (full_name) on public.profiles to authenticated;
-- Department and membership changes have no client write grants at this stage.
create policy company_members_read on public.companies for select to authenticated
 using (id=(select private.current_company_id()));
create policy company_admin_update on public.companies for update to authenticated
 using (id=(select private.current_company_id()) and (select private.current_role())='hr_admin')
 with check (id=(select private.current_company_id()) and (select private.current_role())='hr_admin');
create policy profiles_read on public.profiles for select to authenticated
 using (company_id=(select private.current_company_id()) and (
 id=(select auth.uid()) or (select private.current_role())='hr_admin' or
 ((select private.current_role())='manager' and department_id=(select private.current_department_id()))));
create policy profile_self_name_update on public.profiles for update to authenticated
 using (id=(select auth.uid()) and active and company_id=(select private.current_company_id()))
 with check (id=(select auth.uid()) and active and company_id=(select private.current_company_id()));
create policy departments_read on public.departments for select to authenticated
 using (company_id=(select private.current_company_id()) and ((select private.current_role())='hr_admin' or id=(select private.current_department_id())));
create policy activity_read on public.activity_log for select to authenticated
 using (company_id=(select private.current_company_id()) and ((select private.current_role())='hr_admin' or actor_id=(select auth.uid())));

-- Trigger functions are not callable through the API and accept no user role.
create function private.bootstrap_company_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare company uuid; company_name text; person_name text;
begin
 company_name := btrim(new.raw_user_meta_data->>'company_name');
 person_name := btrim(new.raw_user_meta_data->>'full_name');
 if company_name is null or char_length(company_name) not between 1 and 120 or
    person_name is null or char_length(person_name) not between 1 and 100 or new.email is null then
   raise exception 'A valid company name, full name and email are required';
 end if;
 insert into public.companies(name,contact_email,created_by) values (company_name,lower(new.email),new.id) returning id into company;
 insert into public.profiles(id,company_id,full_name,email,role) values(new.id,company,person_name,lower(new.email),'hr_admin');
 return new;
end; $$;
revoke all on function private.bootstrap_company_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.bootstrap_company_user();

create function private.sync_auth_email() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 update public.profiles set email=lower(new.email) where id=new.id;
 return new;
end; $$;
revoke all on function private.sync_auth_email() from public, anon, authenticated;
create trigger on_auth_email_changed after update of email on auth.users for each row when (old.email is distinct from new.email) execute function private.sync_auth_email();

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end; $$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger company_timestamp before update on public.companies for each row execute function private.touch_updated_at();
create trigger profile_timestamp before update on public.profiles for each row execute function private.touch_updated_at();

create function private.audit_setup_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action)
 values(case when tg_table_name='companies' then new.id else new.company_id end,
 auth.uid(),tg_table_name,new.id,lower(tg_op));
 return new;
end; $$;
revoke all on function private.audit_setup_change() from public, anon, authenticated;
create trigger company_audit after insert or update on public.companies for each row execute function private.audit_setup_change();
create trigger profile_audit after insert or update on public.profiles for each row execute function private.audit_setup_change();
