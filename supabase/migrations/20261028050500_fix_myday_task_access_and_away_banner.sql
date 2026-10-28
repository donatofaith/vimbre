-- Fix the authenticated My Day task RPC without exposing private handover helpers.
-- public.myday_tasks is SECURITY INVOKER, so it cannot call the deliberately
-- private/revoked handover_authorized helper. The reviewer list needs only the
-- signed-in active reviewer role because the query already limits rows to
-- h.reviewer_id = auth.uid() and the current company.

do $$
declare
  task_definition text;
  task_old text := $old$
and private.handover_authorized(h) and (h.status='pending' or h.status='approved' and h.approved_version is not null and h.version>h.approved_version)
$old$;
  task_new text := $new$
and exists (
  select 1
  from public.profiles reviewer
  where reviewer.id = u
    and reviewer.active
    and reviewer.company_id = h.company_id
    and reviewer.role in ('manager','hr_admin')
)
and (h.status='pending' or h.status='approved' and h.approved_version is not null and h.version>h.approved_version)
$new$;
  suite_definition text;
  away_old text := $old$
where owner_id=u and company_id=c and starts_on between today and today+30 and status in('draft','changes_requested')
$old$;
  away_new text := $new$
where owner_id=u and company_id=c and deleted_at is null and starts_on between today and today+30 and status in('draft','changes_requested')
$new$;
begin
  task_definition := pg_get_functiondef(
    'public.myday_tasks(text,text,text,integer,uuid,uuid,text,text)'::regprocedure
  );

  if position(trim(task_old) in task_definition) = 0 then
    raise exception 'Could not locate the expected handover reviewer filter in public.myday_tasks';
  end if;

  task_definition := replace(task_definition, trim(task_old), trim(task_new));
  execute task_definition;

  suite_definition := pg_get_functiondef(
    'private.myday_suite_role_notice_base(text,uuid,jsonb)'::regprocedure
  );

  if position(trim(away_old) in suite_definition) = 0 then
    raise exception 'Could not locate the expected away-draft filter in private.myday_suite_role_notice_base';
  end if;

  suite_definition := replace(suite_definition, trim(away_old), trim(away_new));
  execute suite_definition;
end
$$;
