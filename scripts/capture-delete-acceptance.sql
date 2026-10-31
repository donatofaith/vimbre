begin;
do $test$
declare u uuid; other_user uuid; c uuid; cap uuid:=gen_random_uuid(); draft uuid:=gen_random_uuid(); task uuid; v jsonb;
begin
 select id,company_id into u,c from public.profiles where active order by created_at limit 1;
 if u is null then raise exception 'No active fixture account';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform private.capture_workspace('create',cap,jsonb_build_object('source_text','Rollback fixture '||cap,'title','Rollback fixture','channel','paste'));
 perform private.capture_change('add',draft,cap,jsonb_build_object('kind','action','title','Rollback fixture task','owner_id',u));
 task:=private.capture_change('confirm',draft,cap,'{"version":1}');
 perform private.capture_workspace('delete',cap,'{}');
 if not exists(select 1 from public.actions where id=task and deleted_at is null) then raise exception 'Saved task affected';end if;
 if (select private.capture_state(ca) from public.captures ca where id=cap)<>'deleted' then raise exception 'Not deleted';end if;
 v:=private.capture_workspace('list',null,'{"filter":"all"}');
 if exists(select 1 from jsonb_array_elements(v->'rows') x where x->>'id'=cap::text) then raise exception 'Deleted in All';end if;
 v:=private.capture_workspace('list',null,'{"filter":"deleted"}');
 if not exists(select 1 from jsonb_array_elements(v->'rows') x where x->>'id'=cap::text) then raise exception 'Deleted absent';end if;
 begin perform private.capture_change('source',cap,cap,'{"source_text":"Should fail"}');raise exception 'Allowed editing deleted capture';exception when sqlstate '22023' then null;end;
 select id into other_user from public.profiles where active and id<>u limit 1;
 if other_user is not null then
  perform set_config('request.jwt.claim.sub',other_user::text,true);
  begin perform private.capture_workspace('restore_deleted',cap,'{}');raise exception 'Other owner restored';exception when insufficient_privilege then null;end;
  perform set_config('request.jwt.claim.sub',u::text,true);
 end if;
 perform private.capture_workspace('restore_deleted',cap,'{}');
 if exists(select 1 from public.captures where id=cap and (trashed_at is not null or deleted_at is not null)) then raise exception 'Restore failed';end if;
 if not exists(select 1 from public.actions where id=task and deleted_at is null) then raise exception 'Restore affected saved task';end if;
end $test$;
rollback;
select 'passed: delete/list/restore, edit guard, owner isolation and saved-task preservation; fixtures rolled back' as result;
