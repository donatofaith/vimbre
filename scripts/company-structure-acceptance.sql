begin;
do $test$
declare member record;v jsonb;checked int:=0;
begin
 if has_function_privilege('anon','public.company_workspace_structure()','execute') then raise exception 'Anonymous access allowed';end if;
 for member in select p.id,p.company_id,c.team_mode from public.profiles p join public.companies c on c.id=p.company_id where p.active loop
  perform set_config('request.jwt.claim.sub',member.id::text,true);
  v:=public.company_workspace_structure();
  if v->>'plan' is distinct from private.billing_effective_plan(member.company_id) or v->>'team_mode' is distinct from member.team_mode then raise exception 'Incorrect company summary';end if;
  if (select count(*) from jsonb_object_keys(v))<>2 then raise exception 'Unexpected private billing fields';end if;
  checked:=checked+1;
 end loop;
 if checked=0 then raise exception 'No active fixture members';end if;
 update public.profiles set active=false where id=member.id;
 begin perform public.company_workspace_structure();raise exception 'Inactive account allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.company_workspace_structure();raise exception 'Unauthenticated account allowed';exception when insufficient_privilege then null;end;
end $test$;
rollback;
select 'Passed: active members receive only their company plan/structure; inactive and unauthenticated accounts rejected; anonymous grant absent; fixtures rolled back' as result;
