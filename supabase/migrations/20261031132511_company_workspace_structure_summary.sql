create function private.company_workspace_structure() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c uuid;mode text;
begin
 select p.company_id,co.team_mode into c,mode from public.profiles p join public.companies co on co.id=p.company_id where p.id=auth.uid() and p.active;
 if c is null then raise insufficient_privilege;end if;
 return jsonb_build_object('plan',private.billing_effective_plan(c),'team_mode',mode);
end $$;
revoke all on function private.company_workspace_structure() from public,anon,authenticated;
grant execute on function private.company_workspace_structure() to authenticated;
create function public.company_workspace_structure() returns jsonb language sql stable security invoker set search_path='' as $$select private.company_workspace_structure()$$;
revoke all on function public.company_workspace_structure() from public,anon;
grant execute on function public.company_workspace_structure() to authenticated;
