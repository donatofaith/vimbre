begin;
do $$
declare admin public.profiles;member public.profiles;other_company uuid;stored text;count_before int;
begin
 select * into admin from public.profiles p where active and role='hr_admin' and exists(select 1 from public.profiles m where m.company_id=p.company_id and m.active and m.role='employee') limit 1;
 if admin.id is null then raise exception 'No suitable acceptance fixture';end if;
 select * into member from public.profiles where company_id=admin.company_id and active and role='employee' limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin.id,'role','authenticated')::text,true);
 perform public.set_member_status(member.id,'suspended');
 if (select active or employment_status<>'suspended' from public.profiles where id=member.id) then raise exception 'Suspend failed';end if;
 perform public.set_member_status(member.id,'left');
 if (select active or employment_status<>'left' from public.profiles where id=member.id) then raise exception 'Left failed';end if;
 perform public.set_member_status(member.id,'dismissed');
 if (select active or employment_status<>'dismissed' from public.profiles where id=member.id) then raise exception 'Dismiss failed';end if;
 perform public.set_member_status(member.id,'active');
 if (select not active or employment_status<>'active' from public.profiles where id=member.id) then raise exception 'Reactivate failed';end if;
 begin perform public.set_member_status(admin.id,'suspended');raise exception 'Self-deactivation allowed';exception when insufficient_privilege then null;end;
 select id into other_company from public.companies where id<>admin.company_id limit 1;
 if other_company is not null then
  begin perform public.set_member_status((select id from public.profiles where company_id=other_company limit 1),'suspended');raise exception 'Cross-company allowed';exception when insufficient_privilege then null;end;
 end if;
 perform public.notification_receipt('role',member.id);perform public.notification_receipt('role',member.id);
 select count(*) into count_before from private.notification_receipts where owner_id=admin.id and kind='role' and notice_id=member.id;
 if count_before<>1 then raise exception 'Receipt dedup failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member.id,'role','authenticated')::text,true);
 if public.notification_receipt() @> jsonb_build_array(jsonb_build_object('kind','role','id',member.id)) then raise exception 'Receipt leaked across accounts';end if;
 begin perform public.set_member_status(admin.id,'suspended');raise exception 'Employee can manage members';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.set_member_status(uuid,text)','EXECUTE') or has_function_privilege('anon','public.notification_receipt(text,uuid)','EXECUTE') then raise exception 'Anonymous RPC grant';end if;
 if has_column_privilege('authenticated','public.profiles','employment_status','UPDATE') then raise exception 'Status can bypass RPC';end if;
 if (select public from storage.buckets where id='company-logos') then raise exception 'Public logo bucket';end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='company_logo_read' and qual like '%current_company_id%') then raise exception 'Logo tenant boundary missing';end if;
end $$;
rollback;
