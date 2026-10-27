create or replace function private.ai_allowance_summary() returns jsonb
language plpgsql security definer set search_path='' as $$
declare company uuid; member_role text; summary jsonb;
begin
 if auth.uid() is null then return null;end if;
 select company_id,role into company,member_role from public.profiles where id=auth.uid() and active;
 if company is null then return null;end if;
 summary:=private.ai_allowance_status(company);
 if member_role='hr_admin' then return summary;end if;
 -- Members see request allowance only. Prices, spend, plan and ledger remain admin-only.
 if summary->>'enabled' is distinct from 'true' then return jsonb_build_object('enabled',false);end if;
 return jsonb_build_object('enabled',true,
 'daily_requests',summary->'daily_requests','daily_request_limit',summary->'daily_request_limit',
 'monthly_requests',summary->'monthly_requests','monthly_request_limit',summary->'monthly_request_limit',
 'blocked',summary->'blocked','period',summary->'period',
 'daily_reset_at',summary->'daily_reset_at','monthly_reset_at',summary->'monthly_reset_at');
end$$;