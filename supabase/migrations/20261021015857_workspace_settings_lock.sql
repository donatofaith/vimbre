-- Company settings may rename a company. Contact email and team structure
-- remain server managed; a pricing link does not grant an entitlement.
revoke update (contact_email, team_mode) on public.companies from authenticated;

create function private.protect_company_subscription_settings()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (old.contact_email is distinct from new.contact_email or old.team_mode is distinct from new.team_mode)
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'Company email and team structure cannot be changed from settings' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_company_subscription_settings() from public, anon, authenticated;
create trigger protect_company_subscription_settings
before update on public.companies for each row
execute function private.protect_company_subscription_settings();
