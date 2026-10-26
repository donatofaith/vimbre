-- Preserve Capture's all-or-none confirmation and one-result invariant while adding pending assignments.
alter table public.capture_items add column assignment_id uuid references private.myday_assignments(id);
do $$declare constraint_row record;definition text;before_body text;after_body text;begin
 for constraint_row in select conname,pg_get_constraintdef(oid) as body from pg_constraint where conrelid='public.capture_items'::regclass and contype='c' and pg_get_constraintdef(oid) like '%num_nonnulls%' loop
  definition:=regexp_replace(constraint_row.body,'num_nonnulls\(([^)]*)\)','num_nonnulls(\1, assignment_id)','g');
  execute format('alter table public.capture_items drop constraint %I',constraint_row.conname);
  execute format('alter table public.capture_items add constraint %I %s',constraint_row.conname,definition);
 end loop;
 before_body:=pg_get_functiondef('private.capture_change(text,uuid,uuid,jsonb)'::regprocedure);
 after_body:=replace(before_body,'coalesce(d.decision_id,d.action_id,d.contact_id,d.summary_id)','coalesce(d.decision_id,d.action_id,d.contact_id,d.summary_id,d.assignment_id)');
 after_body:=replace(after_body,$old$  elsif d.kind='action' then
   insert into public.actions$old$,$new$  elsif d.kind='action' and own<>u then
   target:=gen_random_uuid();
   perform private.myday_suite('assign',target,jsonb_build_object('recipient_id',own,'title',data->>'title','details',coalesce(data->>'details',''),'due_date',data->>'due_date'));
   update public.capture_items set assignment_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=d.id;
  elsif d.kind='action' then
   insert into public.actions$new$);
 if after_body=before_body or strpos(after_body,$check$d.kind='action' and own<>u$check$)=0 then raise exception 'Capture confirmation definition changed; review before installing';end if;
 execute after_body;
end$$;
