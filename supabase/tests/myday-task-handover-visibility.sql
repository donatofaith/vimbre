-- Regression checks for My Day task loading and stale away banners.
-- Run against a migrated local/test database; this test makes no data changes.
do $$
declare
  task_definition text;
  suite_definition text;
begin
  if not has_function_privilege(
    'authenticated',
    'public.myday_tasks(text,text,text,integer,uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated users must be able to call public.myday_tasks';
  end if;

  task_definition := pg_get_functiondef(
    'public.myday_tasks(text,text,text,integer,uuid,uuid,text,text)'::regprocedure
  );

  if position('private.handover_authorized' in task_definition) > 0 then
    raise exception 'SECURITY INVOKER myday_tasks still calls a revoked private helper';
  end if;
  if position('reviewer.role in (''manager'',''hr_admin'')' in task_definition) = 0 then
    raise exception 'My Day reviewer visibility must remain limited to active manager/HR admins';
  end if;

  suite_definition := pg_get_functiondef(
    'private.myday_suite_role_notice_base(text,uuid,jsonb)'::regprocedure
  );

  if position(
    'where owner_id=u and company_id=c and deleted_at is null and starts_on between today and today+30 and status in(''draft'',''changes_requested'')'
    in suite_definition
  ) = 0 then
    raise exception 'Away banner query must exclude soft-deleted handover drafts';
  end if;
end
$$;
