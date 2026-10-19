-- Email personalization does not grant access. Clear it once the invitation
-- stops being pending so subsequent account mail uses its actual purpose.
create function private.clear_invitation_email_context() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status <> 'pending' and new.invited_user_id is not null then
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)
    - 'invitation_email_purpose' - 'invitation_company_name' - 'invitation_inviter_name' - 'invitation_role_label'
  where id=new.invited_user_id and raw_user_meta_data->>'invitation_id'=new.id::text;
 end if;
 return new;
end; $$;
revoke all on function private.clear_invitation_email_context() from public,anon,authenticated;
create trigger invitation_email_context_cleanup after update of status on public.invitations
 for each row when(new.status is distinct from old.status) execute function private.clear_invitation_email_context();
