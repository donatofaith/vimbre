-- Apply only after the validated uploader works in production and legacy clients have refreshed.
-- The service role used by the validated uploader bypasses Storage RLS.
create policy validated_upload_required on storage.objects as restrictive for insert to authenticated,anon
with check (bucket_id not in ('role-documents','task-files','capture-originals','chat-attachments','company-logos','member-avatars'));
create policy validated_upload_no_client_overwrite on storage.objects as restrictive for update to authenticated,anon
using (bucket_id not in ('role-documents','task-files','capture-originals','chat-attachments','company-logos','member-avatars'))
with check (bucket_id not in ('role-documents','task-files','capture-originals','chat-attachments','company-logos','member-avatars'));
update storage.buckets set allowed_mime_types=array_remove(allowed_mime_types,'application/octet-stream')
where id in ('chat-attachments','capture-originals');
