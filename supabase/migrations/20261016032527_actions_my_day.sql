-- Actions belong to a person and company. Handover/cover links come with that schema.
alter table public.decisions add constraint decisions_id_owner_company_key unique(id,owner_id,company_id);
create table public.actions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 owner_id uuid not null,
 decision_id uuid,
 title text not null check(char_length(btrim(title)) between 1 and 300),
 details text not null default '' check(char_length(details)<=5000),
 due_date date not null,
 status text not null default 'open' check(status in ('open','in_progress','done')),
 source_url text check(source_url is null or (char_length(source_url)<=2048 and source_url ~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
 completion_note text not null default '' check(char_length(completion_note)<=5000),
 completed_at timestamptz,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(owner_id,company_id) references public.profiles(id,company_id),
 foreign key(decision_id,owner_id,company_id) references public.decisions(id,owner_id,company_id),
 check((status='done')=(completed_at is not null))
);
create index actions_company_idx on public.actions(company_id);
create index actions_owner_company_idx on public.actions(owner_id,company_id);
create index actions_decision_scope_idx on public.actions(decision_id,owner_id,company_id);
create index actions_due_idx on public.actions(owner_id,due_date,id) where deleted_at is null and status<>'done';
create index actions_completed_idx on public.actions(owner_id,completed_at desc,id) where deleted_at is null and status='done';
create index actions_archive_idx on public.actions(owner_id,deleted_at desc,id) where deleted_at is not null;
alter table public.actions enable row level security;
revoke all on public.actions from public,anon,authenticated;
grant select,insert on public.actions to authenticated;
grant update(title,details,due_date,status,source_url,decision_id,completion_note,deleted_at) on public.actions to authenticated;
create policy actions_read on public.actions for select to authenticated
 using(company_id=(select private.current_company_id()) and private.can_read_role(owner_id));
create policy actions_create on public.actions for insert to authenticated
 with check(company_id=(select private.current_company_id()) and owner_id=(select auth.uid()));
create policy actions_edit on public.actions for update to authenticated
 using(company_id=(select private.current_company_id()) and owner_id=(select auth.uid()))
 with check(company_id=(select private.current_company_id()) and owner_id=(select auth.uid()));
create function private.prepare_action() returns trigger language plpgsql set search_path='' as $$
declare check_link boolean:=false;
begin
 if tg_op='INSERT' then
  new.created_at:=now();
  new.completed_at:=case when new.status='done' then now() else null end;
  check_link:=new.decision_id is not null;
 else
  if new.status='done' then
   new.completed_at:=case when old.status='done' then old.completed_at else now() end;
  else new.completed_at:=null; end if;
  check_link:=new.decision_id is not null and new.decision_id is distinct from old.decision_id;
 end if;
 new.updated_at:=now();
 if check_link then
  perform 1 from public.decisions where id=new.decision_id and owner_id=new.owner_id and company_id=new.company_id and deleted_at is null for share;
  if not found then raise exception 'Choose an active decision belonging to this role' using errcode='23514'; end if;
 end if;
 return new;
end; $$;
revoke all on function private.prepare_action() from public,anon,authenticated;
create trigger action_prepare before insert or update on public.actions for each row execute function private.prepare_action();
create trigger action_audit after insert or update on public.actions for each row execute function private.audit_setup_change();
create function private.log_action_view(p_owner uuid) returns void language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if auth.uid() is null or not private.can_read_role(p_owner) then raise insufficient_privilege using message='Actions are not available'; end if;
 select company_id into c from public.profiles where id=p_owner;
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,auth.uid(),'action_list',p_owner,'view');
end; $$;
revoke all on function private.log_action_view(uuid) from public,anon,authenticated;
grant execute on function private.log_action_view(uuid) to authenticated;
create function public.log_action_view(p_owner uuid) returns void language sql security invoker set search_path='' as $$ select private.log_action_view(p_owner) $$;
revoke all on function public.log_action_view(uuid) from public,anon,authenticated;
grant execute on function public.log_action_view(uuid) to authenticated;
