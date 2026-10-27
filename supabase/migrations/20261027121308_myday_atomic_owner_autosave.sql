create function private.myday_edit(p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;a public.actions;begin
 select company_id into c from public.profiles where id=u and active;
 if c is null then raise insufficient_privilege;end if;
 select * into a from public.actions where id=p_id and owner_id=u and company_id=c and deleted_at is null and purged_at is null for update;
 if not found then raise insufficient_privilege;end if;
 if nullif(p_data->>'base_updated_at','')::timestamptz is distinct from a.updated_at then raise exception 'This task changed. Reload before saving.' using errcode='40001';end if;
 perform private.myday_action(p_id,'edit',p_data);
 return (select jsonb_build_object('id',id,'updated_at',updated_at) from public.actions where id=p_id and owner_id=u and company_id=c);
end$$;
revoke all on function private.myday_edit(uuid,jsonb) from public,anon,service_role;
grant execute on function private.myday_edit(uuid,jsonb) to authenticated;
create function public.myday_edit(p_id uuid,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.myday_edit(p_id,p_data)$$;
revoke all on function public.myday_edit(uuid,jsonb) from public,anon,service_role;
grant execute on function public.myday_edit(uuid,jsonb) to authenticated;

