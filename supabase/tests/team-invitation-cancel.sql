-- Prepend team-fixtures.sql.
do $$declare i uuid; d uuid;begin
 d:=public.manage_department(null,'Invitation department',null,false);
 perform set_config('test.invite_department',d::text,true);
 select invitation_id into i from public.prepare_invitation('create',null,'team-cancel@example.invalid','Cancelled recipient','employee',current_setting('test.invite_department')::uuid);
 perform set_config('test.invitation',i::text,true);
 begin perform public.prepare_invitation('resend',i,null,null,null,null);raise exception 'Cooldown bypass';exception when others then if sqlerrm<>'Wait one minute before resending' then raise;end if;end;
end;$$;
reset role;
do $$declare person uuid:=gen_random_uuid();begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(person,'team-cancel@example.invalid',now(),jsonb_build_object('invitation_id',current_setting('test.invitation')));
 perform set_config('test.recipient',person::text,true);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
select public.cancel_invitation(current_setting('test.invitation')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
do $$begin
 if exists(select 1 from public.my_invitation()) then raise exception 'Cancelled invite visible';end if;
 begin perform public.accept_invitation(current_setting('test.invitation')::uuid);raise exception 'Cancelled invite accepted';exception when others then if sqlerrm<>'This invitation has expired or was cancelled' then raise;end if;end;
 if exists(select 1 from public.companies) then raise exception 'Cancelled account has access';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
select public.manage_department(current_setting('test.invite_department')::uuid,null,null,true);
do $$begin if exists(select 1 from public.profiles where department_id=current_setting('test.invite_department')::uuid) then raise exception 'Cancelled invitation stranded department';end if;end;$$;
reset role;
rollback;
select 'Resend cooldown, cancellation and cancelled member isolation passed' result;
