-- Prepend team-fixtures.sql.
do $$declare i uuid;begin
 select invitation_id into i from public.prepare_invitation('create',null,'team-expired@example.invalid','Expired recipient','employee',current_setting('test.department')::uuid);
 perform set_config('test.invitation',i::text,true);
end;$$;
reset role;
do $$declare person uuid:=gen_random_uuid();begin
 insert into auth.users(id,email,raw_user_meta_data) values(person,'team-expired@example.invalid',jsonb_build_object('invitation_id',current_setting('test.invitation')));
 perform set_config('test.recipient',person::text,true);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
do $$begin
 if exists(select 1 from public.my_invitation()) then raise exception 'Unverified recipient can view invitation';end if;
 begin perform public.accept_invitation(current_setting('test.invitation')::uuid);raise exception 'Unverified recipient accepted';exception when insufficient_privilege then null;end;
end;$$;
reset role;
update auth.users set email_confirmed_at=now() where id=current_setting('test.recipient')::uuid;
update public.invitations set expires_at=now()-interval '1 minute',last_requested_at=now()-interval '2 minutes' where id=current_setting('test.invitation')::uuid;
update public.email_log set created_at=now()-interval '2 minutes' where invitation_id=current_setting('test.invitation')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
do $$begin
 if exists(select 1 from public.my_invitation()) then raise exception 'Expired recipient can view invitation';end if;
 begin perform public.accept_invitation(current_setting('test.invitation')::uuid);raise exception 'Expired invitation accepted';exception when others then if sqlerrm<>'This invitation has expired or was cancelled' then raise;end if;end;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
select * from public.prepare_invitation('resend',current_setting('test.invitation')::uuid,null,null,null,null);
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin
 if exists(select 1 from public.invitations) or exists(select 1 from public.email_log) then raise exception 'Cross company invitation disclosure';end if;
 begin perform public.cancel_invitation(current_setting('test.invitation')::uuid);raise exception 'Cross company cancellation';exception when others then if sqlerrm<>'Invitation is unavailable' then raise;end if;end;
 begin perform public.accept_invitation(current_setting('test.invitation')::uuid);raise exception 'Wrong recipient accepted';exception when insufficient_privilege then null;end;
end;$$;
reset role;
rollback;
select 'Unverified, expired and wrong recipient denial, resend and cross company protection passed' result;
