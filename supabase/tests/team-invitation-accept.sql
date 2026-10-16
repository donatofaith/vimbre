-- Prepend team-fixtures.sql. All records, including auth users, roll back.
do $$ declare invitation uuid;begin
 select invitation_id into invitation from public.prepare_invitation('create',null,'team-invite@example.invalid','Invited Employee','employee',current_setting('test.department')::uuid);
 perform set_config('test.invitation',invitation::text,true);
 if (select count(*) from public.email_log)<>1 then raise exception 'Email request not recorded';end if;
end;$$;
reset role;
do $$declare person uuid:=gen_random_uuid();begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(person,'team-invite@example.invalid',now(),jsonb_build_object('invitation_id',current_setting('test.invitation'),'full_name','Forged name','role','hr_admin','company_name','Forged company'));
 if not exists(select 1 from public.profiles where id=person and not active and role='employee' and company_id=current_setting('test.company')::uuid) then raise exception 'Bootstrap trust boundary failed';end if;
 perform set_config('test.recipient',person::text,true);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
do $$begin
 if exists(select 1 from public.companies) then raise exception 'Pending user has company access';end if;
 if (select count(*) from public.my_invitation())<>1 then raise exception 'Verified invitation unavailable';end if;
 perform public.accept_invitation(current_setting('test.invitation')::uuid);
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='employee' and full_name='Invited Employee') then raise exception 'Acceptance failed';end if;
 perform public.accept_invitation(current_setting('test.invitation')::uuid);
 if (select count(*) from public.companies)<>1 then raise exception 'Recipient company isolation failed';end if;
end;$$;
reset role;
rollback;
select 'Invitation bootstrap, verified acceptance, idempotency and scope passed' result;
