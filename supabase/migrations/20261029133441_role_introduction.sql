alter table public.role_profiles add column introduction text not null default '' check(char_length(introduction)<=1200);
create function private.role_introduction(p_role uuid,p_text text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.role_profiles;
begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 select * into r from public.role_profiles where id=p_role and company_id=private.current_company_id() for update;
 if not found or not private.role_access(r.id) then raise insufficient_privilege;end if;
 if p_text is not null then
  if r.holder_id<>auth.uid() then raise insufficient_privilege;end if;
  if char_length(p_text)>1200 or not private.role_safe_text(p_text) then raise check_violation using message='Use a short introduction without passwords or access keys.';end if;
  update public.role_profiles set introduction=btrim(p_text),updated_at=now() where id=r.id returning * into r;
 end if;
 return jsonb_build_object('introduction',r.introduction);
end$$;
revoke all on function private.role_introduction(uuid,text) from public,anon;
create function public.role_introduction(p_role uuid,p_text text default null) returns jsonb language sql security invoker set search_path='' as $$select private.role_introduction(p_role,p_text)$$;
revoke all on function public.role_introduction(uuid,text) from public,anon;
grant execute on function public.role_introduction(uuid,text),private.role_introduction(uuid,text) to authenticated;
