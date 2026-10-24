-- Stable role readers still pass the restrictive company/contact/holder policies.
create policy stable_holder_item_read on public.role_items for select to authenticated using(private.role_access(role_id,false,true));
create policy stable_holder_decision_read on public.decisions for select to authenticated using(private.role_access(role_id,false,true));
do $$declare definition text;begin
 select pg_get_functiondef('public.myday_tasks(text,text,text,integer,uuid,uuid,text,text)'::regprocedure) into definition;
 if position('coalesce(a.source_role_id,a.recurring_id)' in definition)=0 then raise exception 'Inspect task reader before changing';end if;
 definition:=replace(definition,'coalesce(a.source_role_id,a.recurring_id)','coalesce(a.source_role_id,a.stable_role_item_id,a.recurring_id)');
 definition:=replace(definition,'ri.kind as source_role_kind,','ri.kind as source_role_kind,ri.role_id as source_role_profile_id,');
 execute definition;
end$$;
