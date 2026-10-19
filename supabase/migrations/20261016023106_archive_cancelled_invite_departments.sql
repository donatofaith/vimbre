create or replace function private.manage_department(p_id uuid,p_name text,p_manager uuid,p_archive boolean) returns uuid
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
  if exists(select 1 from public.profiles p where p.department_id=target and (p.active or
      not exists(select 1 from public.invitations i where i.invited_user_id=p.id) or
      exists(select 1 from public.invitations i where i.invited_user_id=p.id and i.status='accepted'))) or
     exists(select 1 from public.invitations where department_id=target and status='pending' and expires_at>now()) then
    raise exception 'Move members and cancel pending invitations before archiving this department';end if;
  -- A never-accepted, inactive invite account must not strand a cancelled department.
  update public.profiles p set department_id=null where p.department_id=target and not p.active
    and exists(select 1 from public.invitations i where i.invited_user_id=p.id)
    and not exists(select 1 from public.invitations i where i.invited_user_id=p.id and i.status='accepted');
  update public.departments set archived_at=now(),manager_id=null where id=target;
 else
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Enter a department name of 1 to 120 characters';end if;
  if p_manager is not null and not exists(select 1 from public.profiles where id=p_manager and company_id=company and active and
    (role='hr_admin' or (role='manager' and department_id=target))) then raise exception 'Choose an active manager in this department or an HR Admin';end if;
  update public.departments set name=btrim(p_name),manager_id=p_manager where id=target;
 end if;
 return target;
end; $$;
