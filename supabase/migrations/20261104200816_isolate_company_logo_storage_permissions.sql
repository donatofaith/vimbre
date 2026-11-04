-- A policy init-plan called an intentionally private admin RPC for every storage
-- insert/delete, including unrelated avatar and chat buckets. Check the signed-in
-- profile directly instead; keep company-logo writes restricted to active admins.
alter policy company_logo_insert on storage.objects to authenticated with check (
 bucket_id='company-logos'
 and (storage.foldername(name))[1]=(select private.current_company_id())::text
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role='hr_admin')
);
alter policy company_logo_delete on storage.objects to authenticated using (
 bucket_id='company-logos'
 and (storage.foldername(name))[1]=(select private.current_company_id())::text
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role='hr_admin')
);
