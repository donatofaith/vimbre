insert into public.staff_permissions(role,page,access)values('owner','capture','full'),('engineering','capture','full')on conflict(role,page)do nothing;
