-- Append to team-fixtures.sql; rollback-only.

select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare t uuid:=gen_random_uuid();begin
perform public.myday_action(t,'create',jsonb_build_object('title','Save regression','due_date',current_date+1));
perform public.myday_action(t,'edit','{"title":"Edited regression","details":"Preserved notes"}');
perform public.myday_action(t,'status','{"status":"done"}');
if (select status from public.actions where id=t)<>'done' then raise exception 'Completion failed';end if;
perform public.myday_action(t,'undo','{}');
perform public.myday_action(t,'tomorrow',jsonb_build_object('date',current_date+2));
if (select due_date from public.actions where id=t)<>current_date+2 then raise exception 'Reschedule failed';end if;
perform public.myday_tasks('all','','',0,t,null);
perform set_config('test.save_task',t::text,true);
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$begin begin perform public.myday_action(current_setting('test.save_task')::uuid,'edit','{"title":"Forbidden"}');raise exception 'Cross-company write allowed';exception when insufficient_privilege then null;end;end$$;
rollback;
