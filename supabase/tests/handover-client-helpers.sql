-- Run after the proposed metadata migration and team-fixtures.sql, then roll back.
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare r uuid;id uuid:=gen_random_uuid();hidden uuid:=gen_random_uuid();j jsonb;begin
 r:=private.ensure_role(auth.uid());perform set_config('test.hh',id::text,true);perform set_config('test.hh_role',r::text,true);
 insert into public.role_items(id,company_id,owner_id,role_id,kind,title) values(hidden,current_setting('test.company')::uuid,auth.uid(),r,'responsibility','PRIVATE ROLE ITEM');
 insert into private.role_item_settings(item_id,role_id,is_private,include_in_handover) values(hidden,r,true,false) on conflict(item_id) do update set is_private=true,include_in_handover=false;
 insert into private.role_notes(role_id,author_id,body,include_in_handover) values(r,auth.uid(),'OWNER NOTE FOR CHOSEN SHARING',true);
 insert into public.work_handovers(id,company_id,owner_id,role_id,cover_id,reviewer_id,title,status,starts_on,ends_on,created_by,structured,sections) values(id,current_setting('test.company')::uuid,auth.uid(),r,current_setting('test.admin')::uuid,current_setting('test.manager')::uuid,'Helper fixture','draft',current_date+4,current_date+8,auth.uid(),true,'{"priorities":"Send notes"}');
 j:=private.handover_client_setup('options',id,jsonb_build_object('owner',auth.uid(),'role',r));
 if j::text like '%PRIVATE ROLE ITEM%' or j::text not like '%OWNER NOTE FOR CHOSEN SHARING%' then raise exception 'Role source filtering failed';end if;
 perform private.handover_client_actions('delete',id,'{}');if not exists(select 1 from public.work_handovers where work_handovers.id=current_setting('test.hh')::uuid and deleted_at is not null) then raise exception 'Draft not soft deleted';end if;
 perform private.handover_client_actions('undo_delete',id,'{}');if exists(select 1 from public.work_handovers where work_handovers.id=current_setting('test.hh')::uuid and deleted_at is not null) then raise exception 'Undo did not restore draft';end if;
 update public.work_handovers set status='pending' where work_handovers.id=current_setting('test.hh')::uuid;
 perform private.handover_client_actions('withdraw',id,'{}');if not exists(select 1 from public.work_handovers where work_handovers.id=current_setting('test.hh')::uuid and status='draft') then raise exception 'Withdraw did not restore editable draft';end if;
 update public.work_handovers set status='approved' where work_handovers.id=current_setting('test.hh')::uuid;
 begin perform private.handover_client_actions('delete',id,'{}');raise exception 'Approved record deleted';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare j jsonb;r uuid:=current_setting('test.hh_role')::uuid;id uuid:=current_setting('test.hh')::uuid;begin
 j:=private.handover_client_setup('options',id,jsonb_build_object('owner',current_setting('test.employee'),'role',r));
 if j::text like '%OWNER NOTE FOR CHOSEN SHARING%' or j::text like '%PRIVATE ROLE ITEM%' then raise exception 'Manager-created absence exposed private role content';end if;
 perform private.handover_client_actions('comment',id,'{"body":"Can I confirm the deadline?"}');
 j:=private.handover_client_actions('comments',id,'{}');if j::text not like '%Can I confirm the deadline?%' then raise exception 'Question not retained';end if;
 j:=private.handover_client_setup('overview',null,'{}');if j?'sections' or j?'rows' then raise exception 'Admin overview exposed contents';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin begin perform private.handover_client_actions('comments',current_setting('test.hh')::uuid,'{}');raise exception 'Other company read handover thread';exception when insufficient_privilege then null;end;end$$;
