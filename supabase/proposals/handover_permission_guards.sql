-- Keep existing function owners, signatures and grants. Fail if a reviewed guard has drifted.

do $guard$
declare definition text := pg_get_functiondef('private.handover_cover_action(text,uuid,jsonb)'::regprocedure);
begin
  if strpos(definition, $old$h.cover_id<>u$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_action';
  end if;
  definition := replace(definition, $old$h.cover_id<>u$old$, $new$h.cover_id is distinct from u$new$);
  if strpos(definition, $old$h.reviewer_id<>u$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_action';
  end if;
  definition := replace(definition, $old$h.reviewer_id<>u$old$, $new$h.reviewer_id is distinct from u$new$);
  if strpos(definition, $old$h.owner_id<>u$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_action';
  end if;
  definition := replace(definition, $old$h.owner_id<>u$old$, $new$h.owner_id is distinct from u$new$);
  if strpos(definition, $old$if not (h.owner_id=u or h.reviewer_id=u or me.role='manager' and private.can_read_role(h.owner_id))$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_action';
  end if;
  definition := replace(definition, $old$if not (h.owner_id=u or h.reviewer_id=u or me.role='manager' and private.can_read_role(h.owner_id))$old$, $new$if (h.owner_id=u or h.reviewer_id=u or me.role='manager' and private.can_read_role(h.owner_id)) is not true$new$);
  if strpos(definition, $old$if not (u=h.cover_id or u=h.owner_id or u=h.reviewer_id or me.role='manager' and private.can_read_role(h.owner_id))$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_action';
  end if;
  definition := replace(definition, $old$if not (u=h.cover_id or u=h.owner_id or u=h.reviewer_id or me.role='manager' and private.can_read_role(h.owner_id))$old$, $new$if (u=h.cover_id or u=h.owner_id or u=h.reviewer_id or me.role='manager' and private.can_read_role(h.owner_id)) is not true$new$);
  if strpos(definition, $old$or not full_access$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_action';
  end if;
  definition := replace(definition, $old$or not full_access$old$, $new$or full_access is not true$new$);
  execute definition;
end
$guard$;

do $guard$
declare definition text := pg_get_functiondef('private.handover_cover_brief(uuid,uuid)'::regprocedure);
begin
  if strpos(definition, $old$if not allowed$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_brief';
  end if;
  definition := replace(definition, $old$if not allowed$old$, $new$if allowed is not true$new$);
  if strpos(definition, $old$p_user<>h.cover_id$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_brief';
  end if;
  definition := replace(definition, $old$p_user<>h.cover_id$old$, $new$p_user is distinct from h.cover_id$new$);
  if strpos(definition, $old$p_user<>h.owner_id$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_cover_brief';
  end if;
  definition := replace(definition, $old$p_user<>h.owner_id$old$, $new$p_user is distinct from h.owner_id$new$);
  execute definition;
end
$guard$;

do $guard$
declare definition text := pg_get_functiondef('public.handover_external_questions_action(text,uuid,jsonb)'::regprocedure);
begin
  if strpos(definition, $old$if not found or not (u=h.owner_id or u=h.reviewer_id and me.role in('manager','hr_admin') or me.role='manager' and private.can_read_role(h.owner_id))$old$) = 0 then
    raise exception 'Reviewed guard changed in handover_external_questions_action';
  end if;
  definition := replace(definition, $old$if not found or not (u=h.owner_id or u=h.reviewer_id and me.role in('manager','hr_admin') or me.role='manager' and private.can_read_role(h.owner_id))$old$, $new$if not found or (u=h.owner_id or u=h.reviewer_id and me.role in('manager','hr_admin') or me.role='manager' and private.can_read_role(h.owner_id)) is not true$new$);
  if strpos(definition, $old$ q private.handover_external_questions;$old$) = 0 then
    raise exception 'Reviewed declaration changed in handover_external_questions_action';
  end if;
  definition := replace(definition, $old$ q private.handover_external_questions;$old$, '');
  if strpos(definition, $old$ body text;$old$) = 0
     or strpos(definition, $old$body:=btrim$old$) = 0
     or strpos(definition, $old$length(body)$old$) = 0
     or strpos(definition, $old$set response=body,$old$) = 0 then
    raise exception 'Reviewed reply changed in handover_external_questions_action';
  end if;
  definition := replace(definition, $old$ body text;$old$, $new$ reply_body text;$new$);
  definition := replace(definition, $old$body:=btrim$old$, $new$reply_body:=btrim$new$);
  definition := replace(definition, $old$length(body)$old$, $new$length(reply_body)$new$);
  definition := replace(definition, $old$set response=body,$old$, $new$set response=reply_body,$new$);
  execute definition;
end
$guard$;
