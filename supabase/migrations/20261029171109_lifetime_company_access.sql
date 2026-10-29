-- Administrator-only, company-bound, single-use lifetime entitlement.
create or replace function private.billing_issue_lifetime_access_code(p_company uuid,p_plan text default 'business') returns jsonb language plpgsql security definer set search_path='' as $$
declare issued jsonb;
begin
 issued:=private.billing_issue_access_code(p_company,p_plan,1);
 update private.billing_access_codes set expires_at='infinity'::timestamptz where id=(issued->>'id')::uuid and company_id=p_company;
 return issued||jsonb_build_object('expires_at',null,'lifetime',true);
end$$;
revoke all on function private.billing_issue_lifetime_access_code(uuid,text) from public,anon,authenticated,service_role;
-- Supports the effective-plan lookup and redemption status without scanning all companies' codes.
create index if not exists billing_access_codes_company_expiry_idx on private.billing_access_codes(company_id,expires_at desc) where redeemed_at is not null and revoked_at is null;
