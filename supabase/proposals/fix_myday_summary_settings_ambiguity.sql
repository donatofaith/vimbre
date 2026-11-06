do $patch$
declare
 definition text := pg_get_functiondef('private.myday_daily(text,uuid,date,jsonb)'::regprocedure);
 old text := $old$select settings->>'work_end'from private.myday_personal_options where owner_id=u and company_id=c$old$;
 replacement text := $new$select o.settings->>'work_end' from private.myday_personal_options o where o.owner_id=u and o.company_id=c$new$;
begin
 if strpos(definition,old)=0 then raise exception 'Daily summary settings query changed since review'; end if;
 execute replace(definition,old,replacement);
end
$patch$;
