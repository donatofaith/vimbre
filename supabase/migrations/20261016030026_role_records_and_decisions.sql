-- Role knowledge and decisions. No existing customer rows are modified.
create table public.role_items (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 owner_id uuid not null,
 kind text not null check (kind in ('responsibility','workstream','external_contact','document','recurring_deadline')),
 title text not null check (char_length(btrim(title)) between 1 and 200),
 details text not null default '' check (char_length(details)<=5000),
 url text check (url is null or (char_length(url)<=2048 and url ~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
 contact_email text check (contact_email is null or (char_length(contact_email)<=320 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+$')),
 contact_phone text check (contact_phone is null or char_length(contact_phone)<=80),
 due_date date,
 recurrence text check (recurrence is null or char_length(btrim(recurrence)) between 1 and 200),
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,owner_id,company_id),
 foreign key(owner_id,company_id) references public.profiles(id,company_id),
 check (kind <> 'document' or url is not null),
 check (kind <> 'recurring_deadline' or (due_date is not null and recurrence is not null)),
 check (kind = 'external_contact' or (contact_email is null and contact_phone is null)),
 check (kind = 'recurring_deadline' or (due_date is null and recurrence is null))
);
create table public.decisions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 owner_id uuid not null,
 workstream_id uuid,
 title text not null check (char_length(btrim(title)) between 1 and 300),
 reason text not null check (char_length(btrim(reason)) between 1 and 5000),
 decided_by text not null check (char_length(btrim(decided_by)) between 1 and 200),
 decided_on date not null,
 status text not null default 'live' check (status in ('live','replaced','reversed')),
 source_url text check (source_url is null or (char_length(source_url)<=2048 and source_url ~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
 related_task_url text check (related_task_url is null or (char_length(related_task_url)<=2048 and related_task_url ~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(owner_id,company_id) references public.profiles(id,company_id),
 foreign key(workstream_id,owner_id,company_id) references public.role_items(id,owner_id,company_id)
);
create index role_items_company_idx on public.role_items(company_id);
create index role_items_owner_company_idx on public.role_items(owner_id,company_id);
create index role_items_list_idx on public.role_items(owner_id,kind,created_at desc,id);
create index role_items_workstreams_idx on public.role_items(owner_id,title,id) where kind='workstream' and deleted_at is null;
create index decisions_company_idx on public.decisions(company_id);
create index decisions_owner_company_idx on public.decisions(owner_id,company_id);
create index decisions_workstream_owner_company_idx on public.decisions(workstream_id,owner_id,company_id);
create index decisions_list_idx on public.decisions(owner_id,status,decided_on desc,id);
create index decisions_role_date_idx on public.decisions(owner_id,decided_on desc,id);

-- Only this narrow lookup bypasses profiles RLS. Identity comes from auth.uid().
create function private.can_read_role(p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles viewer join public.profiles target on viewer.company_id=target.company_id
 where viewer.id=(select auth.uid()) and viewer.active and target.id=p_owner
 and (viewer.id=target.id or viewer.role='hr_admin' or
 (viewer.role='manager' and viewer.department_id is not null and viewer.department_id=target.department_id)))
$$;
revoke all on function private.can_read_role(uuid) from public,anon,authenticated;
grant execute on function private.can_read_role(uuid) to authenticated;

alter table public.role_items enable row level security;
alter table public.decisions enable row level security;
revoke all on public.role_items,public.decisions from public,anon,authenticated;
grant select,insert on public.role_items,public.decisions to authenticated;
grant update(title,details,url,contact_email,contact_phone,due_date,recurrence,deleted_at) on public.role_items to authenticated;
grant update(title,reason,decided_by,decided_on,status,workstream_id,source_url,related_task_url,deleted_at) on public.decisions to authenticated;
create policy role_items_read on public.role_items for select to authenticated
 using (company_id=(select private.current_company_id()) and private.can_read_role(owner_id));
create policy role_items_create on public.role_items for insert to authenticated
 with check (company_id=(select private.current_company_id()) and owner_id=(select auth.uid()));
create policy role_items_edit on public.role_items for update to authenticated
 using (company_id=(select private.current_company_id()) and owner_id=(select auth.uid()))
 with check (company_id=(select private.current_company_id()) and owner_id=(select auth.uid()));
create policy decisions_read on public.decisions for select to authenticated
 using (company_id=(select private.current_company_id()) and private.can_read_role(owner_id));
create policy decisions_create on public.decisions for insert to authenticated
 with check (company_id=(select private.current_company_id()) and owner_id=(select auth.uid()));
create policy decisions_edit on public.decisions for update to authenticated
 using (company_id=(select private.current_company_id()) and owner_id=(select auth.uid()))
 with check (company_id=(select private.current_company_id()) and owner_id=(select auth.uid()));

-- Foreign keys enforce tenant and owner; this checks the linked item's kind.
-- An existing link survives archive so history remains readable and editable.
create function private.validate_decision_workstream() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.workstream_id is null then return new; end if;
 if tg_op='UPDATE' then
  if new.workstream_id is not distinct from old.workstream_id then return new; end if;
 end if;
 perform 1 from public.role_items where id=new.workstream_id and owner_id=new.owner_id
 and company_id=new.company_id and kind='workstream' and deleted_at is null for share;
 if not found then raise exception 'Choose an active workstream belonging to this role' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function private.validate_decision_workstream() from public,anon,authenticated;
create trigger decision_workstream_check before insert or update on public.decisions for each row execute function private.validate_decision_workstream();
create trigger role_item_timestamp before update on public.role_items for each row execute function private.touch_updated_at();
create trigger decision_timestamp before update on public.decisions for each row execute function private.touch_updated_at();
create trigger role_item_audit after insert or update on public.role_items for each row execute function private.audit_setup_change();
create trigger decision_audit after insert or update on public.decisions for each row execute function private.audit_setup_change();

-- Reading a role is logged without copying record contents into the audit trail.
create function private.log_role_view(p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if auth.uid() is null or not private.can_read_role(p_owner) then raise insufficient_privilege using message='Role record is not available'; end if;
 select company_id into c from public.profiles where id=p_owner;
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,auth.uid(),'role_record',p_owner,'view');
end; $$;
revoke all on function private.log_role_view(uuid) from public,anon,authenticated;
grant execute on function private.log_role_view(uuid) to authenticated;
create function public.log_role_view(p_owner uuid) returns void language sql security invoker set search_path='' as $$ select private.log_role_view(p_owner) $$;
revoke all on function public.log_role_view(uuid) from public,anon,authenticated;
grant execute on function public.log_role_view(uuid) to authenticated;
