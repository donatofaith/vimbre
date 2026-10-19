create or replace function private.audit_setup_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_company uuid;
begin
 if tg_table_name='companies' then target_company:=new.id; else target_company:=new.company_id; end if;
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action)
 values(target_company,auth.uid(),tg_table_name,new.id,lower(tg_op));
 return new;
end; $$;
revoke all on function private.audit_setup_change() from public, anon, authenticated;
-- Platform-installed DDL event handler: it has no client-facing purpose.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
