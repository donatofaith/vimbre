-- Provider references are recorded by the authenticated connector after a successful read.
create table private.myday_source_references(owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,fingerprint text not null,provider text not null,source_id text not null,container_id text not null default '',primary key(owner_id,company_id,fingerprint));
alter table private.myday_source_references enable row level security;
revoke all on private.myday_source_references from public,anon,authenticated,service_role;
create function public.myday_source_service(p_user uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare member public.profiles;task public.actions;ref private.myday_source_references;update_row private.myday_source_updates;begin
 select * into member from public.profiles where id=p_user and active;if not found then raise insufficient_privilege;end if;
 if p_action='remember' then
  if p_data->>'provider' not in('gmail','outlook','teams','slack','trello','drive') or length(p_data->>'text')>16000 or length(p_data->>'source') not between 1 and 1024 or length(coalesce(p_data->>'container',''))>1024 then raise invalid_parameter_value;end if;
  insert into private.myday_source_references(owner_id,company_id,fingerprint,provider,source_id,container_id) values(member.id,member.company_id,encode(extensions.digest(p_data->>'text','sha256'),'hex'),p_data->>'provider',p_data->>'source',coalesce(p_data->>'container','')) on conflict do nothing;return '{}';
 elsif p_action='write_allowed' then
  if p_data->>'provider' not in('gmail','outlook','teams','slack','trello') or not private.myday_enabled(member.company_id,'write_'||(p_data->>'provider')) then raise exception 'write_disabled';end if;return '{}';
 end if;
 select * into task from public.actions where id=(p_data->>'task')::uuid and owner_id=member.id and company_id=member.company_id and status='done' and deleted_at is null and purged_at is null;if not found then raise insufficient_privilege;end if;
 select r.* into ref from private.myday_source_references r join public.captures c on c.owner_id=r.owner_id and c.company_id=r.company_id and encode(extensions.digest(c.source_text,'sha256'),'hex')=r.fingerprint where c.id=task.capture_id and r.owner_id=member.id and r.company_id=member.company_id;
 if not found then raise exception 'invalid_source';end if;
 if not private.myday_enabled(member.company_id,'write_'||ref.provider) then raise exception 'write_disabled';end if;
 if p_action='context' then return jsonb_build_object('provider',ref.provider,'source',ref.source_id,'container',ref.container_id);end if;
 if p_action='claim' then
  if p_data->>'operation' not in('reply_draft','reply','comment','move') or length(p_data->>'body')>5000 then raise invalid_parameter_value;end if;
  insert into private.myday_source_updates(id,owner_id,company_id,task_id,provider,operation,body) values((p_data->>'request_id')::uuid,member.id,member.company_id,task.id,ref.provider,p_data->>'operation',jsonb_build_object('body',p_data->>'body','list_id',p_data->>'list_id')::text) on conflict do nothing;
  if not found then select * into update_row from private.myday_source_updates where id=(p_data->>'request_id')::uuid and owner_id=member.id and task_id=task.id and company_id=member.company_id and operation=p_data->>'operation' and body=jsonb_build_object('body',p_data->>'body','list_id',p_data->>'list_id')::text;if not found then raise insufficient_privilege;end if;return jsonb_build_object('state',case when update_row.state='pending' then 'uncertain' else update_row.state end);end if;
  insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status) values(task.id,member.id,member.company_id,member.id,'source_update_requested',task.status);return jsonb_build_object('state','new');
 elsif p_action='finish' then
  if p_data->>'state' not in('sent','failed','uncertain') then raise invalid_parameter_value;end if;
  update private.myday_source_updates set state=p_data->>'state' where id=(p_data->>'request_id')::uuid and owner_id=member.id and company_id=member.company_id and task_id=task.id and state='pending';
  if found then insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status) values(task.id,member.id,member.company_id,member.id,'source_update_'||(p_data->>'state'),task.status);end if;return '{}';
 end if;raise invalid_parameter_value;
end$$;
revoke all on function public.myday_source_service(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.myday_source_service(uuid,text,jsonb) to service_role;
