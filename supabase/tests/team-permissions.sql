-- Prepend team-fixtures.sql.
do $$declare d uuid:=current_setting('test.department')::uuid;begin
 perform public.manage_department(d,'Operations',current_setting('test.manager')::uuid,false);
 if not exists(select 1 from public.departments where id=d and manager_id=current_setting('test.manager')::uuid) then raise exception 'Manager assignment failed';end if;
 perform public.manage_member(current_setting('test.manager')::uuid,'Manager','employee',d,true);
 if exists(select 1 from public.departments where id=d and manager_id is not null) then raise exception 'Stale manager assignment';end if;
 begin perform public.manage_department(d,'Operations',null,true);raise exception 'Occupied department archived';exception when others then if sqlerrm<>'Move members and cancel pending invitations before archiving this department' then raise;end if;end;
 begin perform public.manage_member(auth.uid(),'Admin','employee',null,true);raise exception 'Last admin demoted';exception when others then if sqlerrm<>'Keep at least one active HR Admin' then raise;end if;end;
 begin perform public.manage_member(current_setting('test.other_admin')::uuid,'Other','employee',null,false);raise exception 'Cross tenant mutation';exception when insufficient_privilege then null;end;
 begin perform public.complete_invitation_delivery(gen_random_uuid(),'accepted',null);raise exception 'Delivery forgery allowed';exception when insufficient_privilege then null;end;
 d:=public.manage_department(null,'Empty department',null,false);
 perform public.manage_department(d,'Empty department',null,true);
 if not exists(select 1 from public.departments where id=d and archived_at is not null) then raise exception 'Archive failed';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$begin
 begin perform public.manage_department(null,'Forbidden',null,false);raise exception 'Employee write';exception when insufficient_privilege then null;end;
 begin perform public.prepare_invitation('create',null,'forged@example.invalid','Forged','hr_admin',null);raise exception 'Employee invitation';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.email_log) or exists(select 1 from public.invitations) then raise exception 'Employee invitation visibility';end if;
end;$$;
reset role;
rollback;
select 'Department manager, archive, last admin, cross company and employee restrictions passed' result;
