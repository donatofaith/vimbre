-- Company setup: writes are narrow RPCs with private authorization checks.
alter table public.departments add column archived_at timestamptz;
create unique index departments_active_name_idx on public.departments(company_id,lower(name)) where archived_at is null;
create index profiles_company_name_idx on public.profiles(company_id,full_name,id);
create index departments_company_name_idx on public.departments(company_id,name,id);

create table public.invitations (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 email text not null check(email=lower(btrim(email)) and char_length(email)<=320 and email like '%_@_%._%'),
 full_name text not null check(char_length(btrim(full_name)) between 1 and 100),
 role text not null check(role in ('hr_admin','manager','employee')),
 department_id uuid,
 status text not null default 'pending' check(status in ('pending','accepted','cancelled','expired')),
 invited_user_id uuid references auth.users(id) on delete set null,
 invited_by uuid references auth.users(id) on delete set null,
 expires_at timestamptz not null default (now()+interval '7 days'),
 last_requested_at timestamptz,
 accepted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(department_id,company_id) references public.departments(id,company_id)
);
create unique index invitations_pending_email_idx on public.invitations(email) where status='pending';
create index invitations_company_created_idx on public.invitations(company_id,created_at desc,id);
create index invitations_department_company_idx on public.invitations(department_id,company_id);
create index invitations_user_idx on public.invitations(invited_user_id);
create index invitations_author_idx on public.invitations(invited_by);
create table public.email_log (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 invitation_id uuid not null references public.invitations(id),
 recipient text not null,
 requested_by uuid references auth.users(id) on delete set null,
 status text not null default 'requested' check(status in ('requested','accepted','failed')),
 error_code text,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index email_log_company_created_idx on public.email_log(company_id,created_at desc);
create index email_log_invitation_created_idx on public.email_log(invitation_id,created_at desc);
create index email_log_requester_idx on public.email_log(requested_by,created_at desc);
alter table public.invitations enable row level security;
alter table public.email_log enable row level security;
revoke all on public.invitations,public.email_log from public,anon,authenticated;
grant select on public.invitations,public.email_log to authenticated;
create policy invitations_admin_read on public.invitations for select to authenticated
 using(company_id=(select private.current_company_id()) and (select private.current_role())='hr_admin');
create policy email_log_admin_read on public.email_log for select to authenticated
 using(company_id=(select private.current_company_id()) and (select private.current_role())='hr_admin');
create trigger invitation_timestamp before update on public.invitations for each row execute function private.touch_updated_at();
create trigger invitation_audit after insert or update on public.invitations for each row execute function private.audit_setup_change();
create trigger department_audit after insert or update on public.departments for each row execute function private.audit_setup_change();

create function private.require_hr_admin() returns uuid language plpgsql stable security definer set search_path='' as $$
declare company uuid;
begin
 select p.company_id into company from public.profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.active and p.role='hr_admin' and u.email_confirmed_at is not null;
 if company is null then raise exception 'An active HR Admin account is required' using errcode='42501'; end if;
 return company;
end; $$;
revoke all on function private.require_hr_admin() from public,anon,authenticated;

create function private.manage_department(p_id uuid,p_name text,p_manager uuid,p_archive boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_hr_admin(); target uuid:=p_id;
begin
 perform 1 from public.companies where id=company for update;
 if target is null then
  if p_archive then raise exception 'Choose a department';end if;
  insert into public.departments(company_id,name) values(company,btrim(p_name)) returning id into target;
 else
  perform 1 from public.departments where id=target and company_id=company and archived_at is null for update;
  if not found then raise exception 'Department is unavailable' using errcode='42501';end if;
 end if;
 if p_archive then
  if exists(select 1 from public.profiles where department_id=target) or
     exists(select 1 from public.invitations where department_id=target and status='pending' and expires_at>now()) then
    raise exception 'Move members and cancel pending invitations before archiving this department';end if;
  update public.departments set archived_at=now(),manager_id=null where id=target;
 else
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Enter a department name of 1 to 120 characters';end if;
  if p_manager is not null and not exists(select 1 from public.profiles where id=p_manager and company_id=company and active and
    (role='hr_admin' or (role='manager' and department_id=target))) then raise exception 'Choose an active manager in this department or an HR Admin';end if;
  update public.departments set name=btrim(p_name),manager_id=p_manager where id=target;
 end if;
 return target;
end; $$;
create function public.manage_department(p_id uuid default null,p_name text default null,p_manager uuid default null,p_archive boolean default false)
returns uuid language sql security invoker set search_path='' as $$ select private.manage_department(p_id,p_name,p_manager,p_archive) $$;
revoke all on function private.manage_department(uuid,text,uuid,boolean),public.manage_department(uuid,text,uuid,boolean) from public,anon;
grant execute on function private.manage_department(uuid,text,uuid,boolean),public.manage_department(uuid,text,uuid,boolean) to authenticated;

create function private.manage_member(p_id uuid,p_full_name text,p_role text,p_department uuid,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_hr_admin(); person public.profiles; mode text;
begin
 select team_mode into mode from public.companies where id=company for update;
 select * into person from public.profiles where id=p_id and company_id=company for update;
 if not found then raise exception 'Member is unavailable' using errcode='42501';end if;
 if p_role is null or p_role not in ('hr_admin','manager','employee') or p_active is null or p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 100 then raise exception 'Check the name, role and account status';end if;
 if exists(select 1 from public.invitations where invited_user_id=p_id) and not exists(select 1 from public.invitations where invited_user_id=p_id and status='accepted') then raise exception 'This person must accept their invitation first';end if;
 if person.active and person.role='hr_admin' and (not p_active or p_role<>'hr_admin') and
    (select count(*) from public.profiles where company_id=company and active and role='hr_admin')<=1 then
   raise exception 'Keep at least one active HR Admin';end if;
 if p_department is not null and not exists(select 1 from public.departments where id=p_department and company_id=company and archived_at is null) then raise exception 'Department is unavailable';end if;
 if mode='departments' and p_role<>'hr_admin' and p_department is null then raise exception 'Choose a department for this member';end if;
 update public.departments set manager_id=null where manager_id=p_id and
   (not p_active or p_role='employee' or (p_role='manager' and id is distinct from p_department));
 update public.profiles set full_name=btrim(p_full_name),role=p_role,department_id=p_department,active=p_active where id=p_id;
end; $$;
create function public.manage_member(p_id uuid,p_full_name text,p_role text,p_department uuid,p_active boolean)
returns void language sql security invoker set search_path='' as $$ select private.manage_member(p_id,p_full_name,p_role,p_department,p_active) $$;
revoke all on function private.manage_member(uuid,text,text,uuid,boolean),public.manage_member(uuid,text,text,uuid,boolean) from public,anon;
grant execute on function private.manage_member(uuid,text,text,uuid,boolean),public.manage_member(uuid,text,text,uuid,boolean) to authenticated;

create function private.prepare_invitation(p_action text,p_id uuid,p_email text,p_full_name text,p_role text,p_department uuid)
returns table(invitation_id uuid,email_log_id uuid,email text,full_name text) language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_hr_admin(); invite public.invitations; person public.profiles; mail_id uuid; address text:=lower(btrim(p_email)); mode text;
begin
 select team_mode into mode from public.companies where id=company for update;
 if p_action='create' then
  if address is null or char_length(address)>320 or address not like '%_@_%._%' or p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 100 or
     p_role is null or p_role not in ('hr_admin','manager','employee') then raise exception 'Check the name, email and role';end if;
  if p_department is not null and not exists(select 1 from public.departments where id=p_department and company_id=company and archived_at is null) then raise exception 'Department is unavailable';end if;
  if mode='departments' and p_role<>'hr_admin' and p_department is null then raise exception 'Choose a department for this person';end if;
  select p.* into person from public.profiles p join auth.users u on u.id=p.id where lower(u.email)=address;
  if found and (person.company_id<>company or person.active or
     not exists(select 1 from public.invitations where invited_user_id=person.id) or
     exists(select 1 from public.invitations where invited_user_id=person.id and status='accepted')) then
    raise exception 'This email already belongs to a workspace. Existing members can be managed on the Team page';end if;
  update public.invitations set status='expired' where invitations.email=address and status='pending' and expires_at<=now();
  if exists(select 1 from public.invitations where invitations.email=address and status='pending') then raise exception 'An invitation is already pending for this email';end if;
  insert into public.invitations(company_id,email,full_name,role,department_id,invited_by,invited_user_id)
  values(company,address,btrim(p_full_name),p_role,p_department,auth.uid(),person.id) returning * into invite;
 elsif p_action='resend' then
  select * into invite from public.invitations where id=p_id and company_id=company for update;
  if not found or invite.status not in ('pending','expired') then raise exception 'This invitation cannot be resent';end if;
  if invite.last_requested_at>now()-interval '60 seconds' then raise exception 'Wait one minute before resending';end if;
  if invite.department_id is not null and not exists(select 1 from public.departments where id=invite.department_id and archived_at is null) then raise exception 'Department is unavailable';end if;
  if exists(select 1 from public.profiles p join auth.users u on u.id=p.id where lower(u.email)=invite.email and (p.company_id<>company or p.active)) then raise exception 'This email already belongs to a workspace';end if;
 else raise exception 'Unsupported invitation action';end if;
 if (select count(*) from public.email_log where company_id=company and created_at>now()-interval '1 hour')>=30 or
    (select count(*) from public.email_log where requested_by=auth.uid() and created_at>now()-interval '1 hour')>=15 then raise exception 'Invitation email limit reached. Please try again later';end if;
 if exists(select 1 from public.email_log where company_id=company and recipient=invite.email and created_at>now()-interval '60 seconds') then raise exception 'Wait one minute before resending';end if;
 update public.invitations set status='pending',expires_at=now()+interval '7 days',last_requested_at=now() where id=invite.id;
 insert into public.email_log(company_id,invitation_id,recipient,requested_by) values(company,invite.id,invite.email,auth.uid()) returning id into mail_id;
 return query select invite.id,mail_id,invite.email,invite.full_name;
end; $$;
create function public.prepare_invitation(p_action text,p_id uuid default null,p_email text default null,p_full_name text default null,p_role text default null,p_department uuid default null)
returns table(invitation_id uuid,email_log_id uuid,email text,full_name text) language sql security invoker set search_path='' as $$ select * from private.prepare_invitation(p_action,p_id,p_email,p_full_name,p_role,p_department) $$;
-- Preparation reserves an invitation and records a request. It neither sends email nor grants membership.
-- Only the service role can record an accepted email request, and acceptance requires the verified recipient.
revoke all on function private.prepare_invitation(text,uuid,text,text,text,uuid),public.prepare_invitation(text,uuid,text,text,text,uuid) from public,anon;
grant execute on function private.prepare_invitation(text,uuid,text,text,text,uuid),public.prepare_invitation(text,uuid,text,text,text,uuid) to authenticated;

create function private.cancel_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare company uuid:=private.require_hr_admin();
begin
 perform 1 from public.companies where id=company for update;
 update public.invitations set status='cancelled' where id=p_id and company_id=company and status in ('pending','expired');
 if not found then raise exception 'Invitation is unavailable';end if;
end; $$;
create function public.cancel_invitation(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.cancel_invitation(p_id) $$;
revoke all on function private.cancel_invitation(uuid),public.cancel_invitation(uuid) from public,anon;
grant execute on function private.cancel_invitation(uuid),public.cancel_invitation(uuid) to authenticated;

grant usage on schema private to service_role;
create function private.complete_invitation_delivery(p_id uuid,p_status text,p_error_code text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('accepted','failed') then raise exception 'Invalid delivery status';end if;
 update public.email_log set status=p_status,error_code=left(p_error_code,100),completed_at=now() where id=p_id and status='requested';
end; $$;
create function public.complete_invitation_delivery(p_id uuid,p_status text,p_error_code text default null) returns void language sql security invoker set search_path='' as $$ select private.complete_invitation_delivery(p_id,p_status,p_error_code) $$;
revoke all on function private.complete_invitation_delivery(uuid,text,text),public.complete_invitation_delivery(uuid,text,text) from public,anon,authenticated;
grant execute on function private.complete_invitation_delivery(uuid,text,text),public.complete_invitation_delivery(uuid,text,text) to service_role;

-- Invitation display is available only to its verified email owner, even before membership activation.
create function private.my_invitation() returns table(invitation_id uuid,company_name text,full_name text,role text,department_name text,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 select i.id,c.name,i.full_name,i.role,d.name,i.expires_at from public.invitations i
 join auth.users u on u.id=i.invited_user_id join public.companies c on c.id=i.company_id
 left join public.departments d on d.id=i.department_id
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null and lower(u.email)=i.email
 and i.status='pending' and i.expires_at>now() and (d.id is null or d.archived_at is null)
 limit 1
$$;
create function public.my_invitation() returns table(invitation_id uuid,company_name text,full_name text,role text,department_name text,expires_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from private.my_invitation() $$;
revoke all on function private.my_invitation(),public.my_invitation() from public,anon;
grant execute on function private.my_invitation(),public.my_invitation() to authenticated;

create function private.accept_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare invite public.invitations; person public.profiles; address text;
begin
 select lower(email) into address from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if address is null then raise exception 'A verified email is required' using errcode='42501';end if;
 -- Lock company before invitation consistently with cancellation and member writes.
 select * into invite from public.invitations where id=p_id and invited_user_id=auth.uid() and email=address;
 if not found then raise exception 'Invitation is unavailable' using errcode='42501';end if;
 perform 1 from public.companies where id=invite.company_id for update;
 select * into invite from public.invitations where id=p_id for update;
 if invite.status='accepted' then return;end if;
 if invite.status<>'pending' or invite.expires_at<=now() then raise exception 'This invitation has expired or was cancelled';end if;
 if invite.department_id is not null and not exists(select 1 from public.departments where id=invite.department_id and company_id=invite.company_id and archived_at is null) then raise exception 'Department is unavailable';end if;
 select * into person from public.profiles where id=auth.uid() for update;
 if person.company_id is distinct from invite.company_id or person.active then raise exception 'Account is already assigned' using errcode='42501';end if;
 update public.profiles set full_name=invite.full_name,role=invite.role,department_id=invite.department_id,active=true where id=auth.uid();
 update public.invitations set status='accepted',accepted_at=now() where id=p_id;
end; $$;
create function public.accept_invitation(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.accept_invitation(p_id) $$;
revoke all on function private.accept_invitation(uuid),public.accept_invitation(uuid) from public,anon;
grant execute on function private.accept_invitation(uuid),public.accept_invitation(uuid) to authenticated;

create or replace function private.bootstrap_company_user() returns trigger language plpgsql security definer set search_path='' as $$
declare company uuid; company_name text; person_name text; invite public.invitations;
begin
 if new.raw_user_meta_data->>'invitation_id' is not null then
  select * into invite from public.invitations where id=(new.raw_user_meta_data->>'invitation_id')::uuid
   and email=lower(new.email) and status='pending' and expires_at>now() and invited_user_id is null;
  if not found then raise exception 'Invitation is unavailable';end if;
  perform 1 from public.companies where id=invite.company_id for update;
  select * into invite from public.invitations where id=invite.id and email=lower(new.email) and status='pending' and expires_at>now() and invited_user_id is null for update;
  if not found then raise exception 'Invitation is unavailable';end if;
  insert into public.profiles(id,company_id,full_name,email,role,department_id,active)
   values(new.id,invite.company_id,invite.full_name,lower(new.email),invite.role,invite.department_id,false);
  update public.invitations set invited_user_id=new.id where id=invite.id;
  return new;
 end if;
 company_name:=btrim(new.raw_user_meta_data->>'company_name');person_name:=btrim(new.raw_user_meta_data->>'full_name');
 if company_name is null or char_length(company_name) not between 1 and 120 or person_name is null or char_length(person_name) not between 1 and 100 or new.email is null then raise exception 'A valid company name, full name and email are required';end if;
 insert into public.companies(name,contact_email,created_by) values(company_name,lower(new.email),new.id) returning id into company;
 insert into public.profiles(id,company_id,full_name,email,role) values(new.id,company,person_name,lower(new.email),'hr_admin');
 return new;
end; $$;
revoke all on function private.bootstrap_company_user() from public,anon,authenticated;
