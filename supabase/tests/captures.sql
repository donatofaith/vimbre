-- Prepend team-fixtures.sql. No test data survives the final rollback.
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$
declare s uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); x uuid:=gen_random_uuid(); r uuid; r2 uuid;
begin
 perform public.capture_change('create',s,null,jsonb_build_object('title','Source fixture','source_text','Team agreed to review on Friday.','source_type','meeting','source_date',current_date));
 perform public.capture_change('create',s,null,jsonb_build_object('title','Source fixture','source_text','Team agreed to review on Friday.','source_type','meeting','source_date',current_date));
 if (public.capture_list(0,false)->>'count')::int<>1 then raise exception 'Source retry duplicated'; end if;
 perform public.capture_change('add',d,s,jsonb_build_object('kind','decision','title','Friday review','reason','Give Finance time','decided_by','The team','decided_on',current_date));
 perform public.capture_change('add',d,s,jsonb_build_object('kind','decision','title','Friday review'));
 if exists(select 1 from public.decisions where owner_id=auth.uid()) then raise exception 'Draft became fact'; end if;
 if jsonb_array_length(public.capture_detail(s)->'items')<>1 then raise exception 'Draft retry duplicated'; end if;
 begin perform public.capture_change('edit',d,s,'{"kind":"decision","title":"Overwrite","version":2}'); raise exception 'Stale edit accepted'; exception when serialization_failure then null; end;
 r:=public.capture_change('confirm',d,s,'{"version":1}');
 r2:=public.capture_change('confirm',d,s,'{"version":1}');
 if r<>r2 or (select count(*) from public.decisions where owner_id=auth.uid())<>1 then raise exception 'Confirm duplicate'; end if;
 begin perform public.capture_change('discard',d,s,'{"version":2}'); raise exception 'Confirmed draft discarded'; exception when serialization_failure then null; end;
 perform public.capture_change('add',a,s,'{"kind":"action","title":"Send report"}');
 begin perform public.capture_change('confirm',a,s,'{"version":1}'); raise exception 'Invalid action confirmed'; exception when not_null_violation then null; end;
 if not exists(select 1 from public.capture_items where id=a and status='pending') or exists(select 1 from public.actions where owner_id=auth.uid()) then raise exception 'Failed confirmation partially saved'; end if;
 perform public.capture_change('edit',a,s,jsonb_build_object('kind','action','title','Send report','due_date',current_date,'version',1));
 perform public.capture_change('confirm',a,s,'{"version":2}');
 perform public.capture_change('add',x,s,'{"kind":"contact","title":"Ada","contact_email":"ada@example.invalid"}');
 perform public.capture_change('confirm',x,s,'{"version":1}');
 x:=gen_random_uuid(); perform public.capture_change('add',x,s,'{"kind":"decision","title":"Not needed"}');
 perform public.capture_change('discard',x,s,'{"version":1}');
 perform public.capture_change('discard',x,s,'{"version":1}');
 if (select count(*) from public.decisions where owner_id=auth.uid())<>1 then raise exception 'Discard created fact'; end if;
 begin update public.capture_items set status='pending' where id=d; raise exception 'Direct review-state write allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.captures(company_id,owner_id,title,source_text,source_type,source_date) values(current_setting('test.company')::uuid,auth.uid(),'Direct','No','note',current_date); raise exception 'Direct insert allowed'; exception when insufficient_privilege then null; end;
 perform public.capture_change('archive',s,s,'{}');
 if (public.capture_list(0,true)->>'count')::int<>1 then raise exception 'Archive list'; end if;
 begin perform public.capture_change('add',gen_random_uuid(),s,'{"kind":"action","title":"Archived source"}'); raise exception 'Archived capture accepts drafts'; exception when invalid_parameter_value then null; end;
 if (select count(*) from public.actions where owner_id=auth.uid())<>1 then raise exception 'Archive removed confirmed record'; end if;
 perform public.capture_change('restore',s,s,'{}');
 if (public.capture_list(0,false)->>'count')::int<>1 then raise exception 'Restore failed'; end if;
 perform set_config('test.capture',s::text,true);
 perform set_config('test.capture_draft',d::text,true);
end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin
 if exists(select 1 from public.captures) or exists(select 1 from public.capture_items) or public.capture_detail(current_setting('test.capture')::uuid) is not null then raise exception 'Manager read private source'; end if;
 if (select count(*) from public.decisions where owner_id=current_setting('test.employee')::uuid)<>1 then raise exception 'Confirmed manager access missing'; end if;
 begin perform public.capture_change('archive',current_setting('test.capture')::uuid,current_setting('test.capture')::uuid,'{}'); raise exception 'Manager wrote source'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$begin
 if exists(select 1 from public.captures) or exists(select 1 from public.capture_items) then raise exception 'HR read private sources'; end if;
end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin
 if (public.capture_list(0,false)->>'count')::int<>0 or public.capture_detail(current_setting('test.capture')::uuid) is not null then raise exception 'Cross-company source leak'; end if;
 begin perform public.capture_change('create',current_setting('test.capture')::uuid,null,jsonb_build_object('title','Collision','source_text','Foreign source','source_type','note','source_date',current_date)); raise exception 'Foreign source ID accepted'; exception when insufficient_privilege then null; end;
 begin perform public.capture_change('confirm',current_setting('test.capture_draft')::uuid,current_setting('test.capture')::uuid,'{"version":1}'); raise exception 'Foreign confirm accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
update public.profiles set active=false where id=current_setting('test.employee')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin
 if exists(select 1 from public.captures) then raise exception 'Inactive user read source'; end if;
 begin perform public.capture_change('restore',current_setting('test.capture')::uuid,current_setting('test.capture')::uuid,'{}'); raise exception 'Inactive user wrote capture'; exception when insufficient_privilege then null; end;
end; $$;
set local role anon;
do $$begin
 begin perform public.capture_list(0,false); raise exception 'Anonymous list'; exception when insufficient_privilege then null; end;
 begin perform public.capture_change('restore',gen_random_uuid(),null,'{}'); raise exception 'Anonymous mutation'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'Capture lifecycle, atomic confirmation, retries, private-source isolation and inactive/anonymous protections passed' as result;
rollback;
