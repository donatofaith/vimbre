-- Install before the Edge Function and client. Existing storage policies remain active during rollout.
create or replace function public.authorize_validated_upload(p_bucket text,p_path text,p_size integer)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); c uuid:=private.current_company_id(); parts text[]:=string_to_array(p_path,'/');
begin
 if u is null or c is null or p_path is null or length(p_path)>240 or p_size is null or p_size<1 then return false; end if;
 return coalesce(case p_bucket
  when 'capture-originals' then p_size<=10485760 and private.capture_upload_allowed(p_path)
  when 'chat-attachments' then p_size<=5242880 and private.chat_file_access(p_path,true)
    and exists(select 1 from private.chat_attachments a where a.path=p_path and a.size=p_size and a.sender_id=u)
  when 'company-logos' then p_size<=262144 and parts[1]=c::text
    and exists(select 1 from public.profiles p where p.id=u and p.company_id=c and p.active and p.role='hr_admin')
  when 'member-avatars' then p_size<=1048576 and parts[1]=c::text and parts[2]=u::text
  when 'role-documents' then p_size<=10485760 and private.can_edit_role(private.document_owner(p_path),'document')
  when 'task-files' then p_size<=10485760 and parts[1]=c::text and parts[2]=u::text and exists(
    select 1 from public.actions a where a.id::text=parts[3] and a.owner_id=u and a.company_id=c and a.purged_at is null)
  else false end,false);
end$$;
revoke all on function public.authorize_validated_upload(text,text,integer) from public,anon;
grant execute on function public.authorize_validated_upload(text,text,integer) to authenticated;
