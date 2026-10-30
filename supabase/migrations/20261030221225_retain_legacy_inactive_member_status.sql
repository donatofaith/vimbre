alter table public.profiles drop constraint profiles_employment_status_check;
alter table public.profiles add constraint profiles_employment_status_check check(employment_status in ('active','inactive','suspended','left','dismissed'));
alter table public.profiles alter column employment_status set default 'inactive';
-- Legacy inactive/invited accounts had no recorded suspension reason.
update public.profiles set employment_status='inactive' where not active and employment_status='suspended';
create or replace function private.sync_employment_status() returns trigger language plpgsql set search_path='' as $$
begin
 if new.active then new.employment_status:='active';
 elsif tg_op='UPDATE' and old.active and new.employment_status='active' then new.employment_status:='suspended';
 elsif new.employment_status='active' then new.employment_status:='inactive';end if;
 return new;
end $$;
revoke all on function private.sync_employment_status() from public,anon,authenticated;
