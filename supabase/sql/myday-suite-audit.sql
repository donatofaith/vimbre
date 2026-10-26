-- Keep a metadata-only record of changes. Never copy comments, private notes, device keys or tokens here.
create table private.myday_suite_audit(id bigint generated always as identity primary key,actor_id uuid,company_id uuid,owner_id uuid,entity text not null,entity_id text,operation text not null,changed_at timestamptz not null default now());
alter table private.myday_suite_audit enable row level security;
revoke all on private.myday_suite_audit from public,anon,authenticated,service_role;
create function private.myday_audit_change() returns trigger language plpgsql security definer set search_path='' as $$declare value jsonb;begin
 value:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into private.myday_suite_audit(actor_id,company_id,owner_id,entity,entity_id,operation) values(auth.uid(),nullif(value->>'company_id','')::uuid,nullif(coalesce(value->>'owner_id',value->>'creator_id',value->>'author_id'),'')::uuid,tg_table_name,coalesce(value->>'id',value->>'task_id',value->>'owner_id'),lower(tg_op));
 return case when tg_op='DELETE' then old else new end;
end$$;
revoke all on function private.myday_audit_change() from public,anon,authenticated,service_role;
do $$declare t text;begin foreach t in array array['myday_company_options','myday_personal_options','myday_templates','myday_rules','myday_assignments','myday_collaborators','myday_comments','myday_repeats','myday_files','myday_push','myday_source_updates'] loop execute format('create trigger myday_suite_audit after insert or update or delete on private.%I for each row execute function private.myday_audit_change()',t);end loop;end$$;
