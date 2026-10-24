-- Prepend team-fixtures.sql; no mail is sent and all changes roll back.
reset role;
do $$declare i uuid;u uuid:=current_setting('test.employee')::uuid;c uuid:=current_setting('test.company')::uuid;begin
 insert into public.invitations(company_id,email,full_name,role,invited_by,invited_user_id)
 values(c,'email-context@example.invalid','Email context fixture','employee',current_setting('test.admin')::uuid,u) returning id into i;
 update auth.users set raw_user_meta_data=raw_user_meta_data||jsonb_build_object('invitation_id',i,'invitation_email_purpose','team_invitation','invitation_company_name','Fixture Company','invitation_inviter_name','Fixture Admin','invitation_role_label','Employee','keep_this','preserved') where id=u;
 update public.invitations set status='accepted' where id=i;
 if exists(select 1 from auth.users where id=u and raw_user_meta_data ? 'invitation_email_purpose') then raise exception 'Stale invite email purpose';end if;
 if not exists(select 1 from auth.users where id=u and raw_user_meta_data->>'keep_this'='preserved') then raise exception 'Unrelated metadata changed';end if;
 if not exists(select 1 from public.profiles where id=u and company_id=c and role='employee') then raise exception 'Email metadata changed membership';end if;
end;$$;
select 'Invitation email context cleared without changing unrelated metadata or membership' as result;
rollback;
