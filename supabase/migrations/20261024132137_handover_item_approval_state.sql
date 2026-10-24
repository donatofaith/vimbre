-- Tasks added after approval stay read only until the manager approves them.
do $$declare definition text;begin select pg_get_functiondef('private.handover_snapshot(uuid)'::regprocedure) into definition;definition:=replace(definition,'''do_not_change'',i.do_not_change,','''do_not_change'',i.do_not_change,''approved'',i.approved,');execute definition;end$$;
