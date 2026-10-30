-- Explicit account status; existing active flag remains the access-control authority.
alter table public.profiles add column employment_status text not null default 'active'
  check (employment_status in ('active','suspended','left','dismissed'));
update public.profiles set employment_status='suspended' where not active;
create function private.sync_employment_status() returns trigger language plpgsql set search_path='' as $$
begin
 if new.active then new.employment_status:='active';
 elsif tg_op='UPDATE' and old.active and new.employment_status='active' then new.employment_status:='suspended';
 elsif new.employment_status='active' then new.employment_status:='suspended';end if;
 return new;
end $$;
revoke all on function private.sync_employment_status() from public,anon,authenticated;
create trigger sync_employment_status before insert or update of active,employment_status on public.profiles for each row execute function private.sync_employment_status();
create function private.set_member_status(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare c uuid:=private.require_hr_admin();p public.profiles;
begin
 if p_status is null or p_status not in ('active','suspended','left','dismissed') then raise invalid_parameter_value;end if;
 select * into p from public.profiles where id=p_id and company_id=c for update;
 if not found or p_id=auth.uid() then raise insufficient_privilege using message='Choose another member';end if;
 perform private.manage_member(p.id,p.full_name,p.role,p.department_id,p_status='active');
 update public.profiles set employment_status=p_status where id=p_id and company_id=c;
end $$;
revoke all on function private.set_member_status(uuid,text) from public,anon,authenticated;
grant execute on function private.set_member_status(uuid,text) to authenticated;
create function public.set_member_status(p_id uuid,p_status text) returns void language sql security invoker set search_path='' as $$select private.set_member_status(p_id,p_status)$$;
revoke all on function public.set_member_status(uuid,text) from public,anon;
grant execute on function public.set_member_status(uuid,text) to authenticated;

-- Company images remain private to active members of the same company.
alter table public.companies add column logo_path text check (logo_path is null or logo_path ~ ('^'||id::text||'/[a-f0-9-]{36}[.](png|jpg|webp)$'));
grant update(logo_path) on public.companies to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('company-logos','company-logos',false,262144,array['image/png','image/jpeg','image/webp']);
create policy company_logo_read on storage.objects for select to authenticated using (bucket_id='company-logos' and (storage.foldername(name))[1]=(select private.current_company_id())::text);
create policy company_logo_insert on storage.objects for insert to authenticated with check (bucket_id='company-logos' and (storage.foldername(name))[1]=(select private.require_hr_admin())::text);
create policy company_logo_delete on storage.objects for delete to authenticated using (bucket_id='company-logos' and (storage.foldername(name))[1]=(select private.require_hr_admin())::text);

-- Reading a reminder is distinct from completing the underlying work.
create table private.notification_receipts(owner_id uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in ('role','capture','handover','task')),notice_id uuid not null,seen_at timestamptz not null default now(),primary key(owner_id,kind,notice_id));
alter table private.notification_receipts enable row level security;
revoke all on private.notification_receipts from public,anon,authenticated;
create function private.notification_receipt(p_kind text default null,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_kind is not null then
  if p_id is null or p_kind not in ('role','capture','handover','task') then raise invalid_parameter_value;end if;
  insert into private.notification_receipts(owner_id,kind,notice_id) values(u,p_kind,p_id) on conflict do nothing;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',notice_id)) from private.notification_receipts where owner_id=u),'[]');
end $$;
revoke all on function private.notification_receipt(text,uuid) from public,anon,authenticated;
grant execute on function private.notification_receipt(text,uuid) to authenticated;
create function public.notification_receipt(p_kind text default null,p_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.notification_receipt(p_kind,p_id)$$;
revoke all on function public.notification_receipt(text,uuid) from public,anon;
grant execute on function public.notification_receipt(text,uuid) to authenticated;
