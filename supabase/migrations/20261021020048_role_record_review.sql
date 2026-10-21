-- Protected role context and the client's per-tab fields.
alter table public.profiles add column role_description text not null default '' check (length(role_description)<=5000), add column role_start_date date;
alter table public.invitations add column role_description text not null default '' check (length(role_description)<=5000), add column role_start_date date;
alter table public.role_items
 add column organisation text not null default '' check(length(organisation)<=200),
 add column contact_context text not null default '' check(length(contact_context)<=5000),
 add column contact_details text not null default '' check(length(contact_details)<=400),
 add column next_step text not null default '' check(length(next_step)<=5000),
 add column work_status text not null default 'in_progress' check(work_status in ('in_progress','waiting','on_hold','done')),
 add column backup_person_id uuid,
 add column file_path text,
 add constraint role_backup_company_fk foreign key(backup_person_id,company_id) references public.profiles(id,company_id),
 add constraint role_document_path_check check(file_path is null or (kind='document' and file_path like owner_id::text || '/%' and length(file_path)<=600));
create index role_items_backup_person_idx on public.role_items(backup_person_id,company_id) where backup_person_id is not null;
alter table public.role_items drop constraint role_items_check;
alter table public.role_items add constraint role_document_content_check check(kind<>'document' or url is not null or file_path is not null);
alter table public.role_items drop constraint role_items_deadline_kind_check;
alter table public.role_items add constraint role_items_deadline_kind_check check(kind in ('responsibility','recurring_deadline') or (due_date is null and recurrence is null));
alter table public.decisions add column next_step text not null default '' check(length(next_step)<=5000);
grant update(organisation,contact_context,contact_details,next_step,work_status,backup_person_id,file_path) on public.role_items to authenticated;
grant update(next_step) on public.decisions to authenticated;

create function private.can_edit_role(p_owner uuid,p_kind text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles v join public.profiles t on t.company_id=v.company_id
 where v.id=(select auth.uid()) and v.active and t.active and t.id=p_owner and
 (v.role='hr_admin' or (v.role='manager' and v.department_id is not null and v.department_id=t.department_id)
 or (v.id=t.id and p_kind<>'responsibility')))
$$;
revoke all on function private.can_edit_role(uuid,text) from public,anon;
grant execute on function private.can_edit_role(uuid,text) to authenticated;
drop policy role_items_create on public.role_items;
drop policy role_items_edit on public.role_items;
create policy role_items_create on public.role_items for insert to authenticated with check(company_id=(select private.current_company_id()) and private.can_edit_role(owner_id,kind));
create policy role_items_edit on public.role_items for update to authenticated using(company_id=(select private.current_company_id()) and private.can_edit_role(owner_id,kind)) with check(company_id=(select private.current_company_id()) and private.can_edit_role(owner_id,kind));
drop policy decisions_create on public.decisions;
drop policy decisions_edit on public.decisions;
create policy decisions_create on public.decisions for insert to authenticated with check(company_id=(select private.current_company_id()) and private.can_edit_role(owner_id,'decision'));
create policy decisions_edit on public.decisions for update to authenticated using(company_id=(select private.current_company_id()) and private.can_edit_role(owner_id,'decision')) with check(company_id=(select private.current_company_id()) and private.can_edit_role(owner_id,'decision'));

create table public.responsibility_notes(
 item_id uuid primary key references public.role_items(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.profiles(id),
 body text not null check(length(body)<=5000), updated_at timestamptz not null default now()
);
alter table public.responsibility_notes enable row level security;
grant select,insert on public.responsibility_notes to authenticated;
grant update(body,updated_at) on public.responsibility_notes to authenticated;
create index responsibility_notes_author_idx on public.responsibility_notes(author_id);
create policy notes_read on public.responsibility_notes for select to authenticated using(author_id=(select auth.uid()) and exists(select 1 from public.role_items r where r.id=item_id and r.owner_id=(select auth.uid()) and r.kind='responsibility'));
create policy notes_create on public.responsibility_notes for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.role_items r where r.id=item_id and r.owner_id=(select auth.uid()) and r.kind='responsibility' and r.deleted_at is null));
create policy notes_edit on public.responsibility_notes for update to authenticated using(author_id=(select auth.uid()) and exists(select 1 from public.role_items r where r.id=item_id and r.owner_id=(select auth.uid()) and r.kind='responsibility')) with check(author_id=(select auth.uid()) and exists(select 1 from public.role_items r where r.id=item_id and r.owner_id=(select auth.uid()) and r.kind='responsibility'));

create table public.responsibility_suggestions(
 id uuid primary key default gen_random_uuid(), item_id uuid not null references public.role_items(id),
 author_id uuid not null default auth.uid() references public.profiles(id),
 body text not null check(length(trim(body)) between 1 and 5000),
 original_details text not null,
 status text not null default 'pending' check(status in ('pending','approved','declined')),
 reviewed_by uuid references public.profiles(id), created_at timestamptz not null default now(), reviewed_at timestamptz
);
create index responsibility_suggestions_item_idx on public.responsibility_suggestions(item_id,status);
create index responsibility_suggestions_author_idx on public.responsibility_suggestions(author_id);
create index responsibility_suggestions_reviewer_idx on public.responsibility_suggestions(reviewed_by) where reviewed_by is not null;
create unique index responsibility_one_pending on public.responsibility_suggestions(item_id,author_id) where status='pending';
alter table public.responsibility_suggestions enable row level security;
grant select on public.responsibility_suggestions to authenticated;
create policy suggestions_read on public.responsibility_suggestions for select to authenticated using(exists(select 1 from public.role_items r where r.id=item_id and (author_id=(select auth.uid()) or private.can_edit_role(r.owner_id,'responsibility'))));

create function private.suggest_responsibility(p_item uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.role_items; v_id uuid;
begin
 select * into r from public.role_items where id=p_item and owner_id=auth.uid() and kind='responsibility' and deleted_at is null for update;
 if not found or not private.can_read_role(r.owner_id) then raise exception 'Responsibility unavailable' using errcode='42501'; end if;
 insert into public.responsibility_suggestions(item_id,author_id,body,original_details) values(r.id,auth.uid(),trim(p_body),r.details) returning id into v_id;
 return v_id;
end $$;
create function private.review_responsibility(p_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare s public.responsibility_suggestions; r public.role_items;
begin
 select * into s from public.responsibility_suggestions where id=p_id;
 select * into r from public.role_items where id=s.item_id and deleted_at is null for update;
 if r.id is null or not private.can_edit_role(r.owner_id,'responsibility') then raise exception 'Manager access required' using errcode='42501'; end if;
 select * into s from public.responsibility_suggestions where id=p_id for update;
 if s.status<>'pending' then raise exception 'This suggestion has already been reviewed' using errcode='22023'; end if;
 if p_approve is null then raise exception 'Choose a review outcome' using errcode='22023'; end if;
 if p_approve then
  if r.details is distinct from s.original_details then raise exception 'This responsibility has changed. Review the latest version before accepting a new suggestion.' using errcode='22023'; end if;
  update public.role_items set details=s.body where id=r.id;
 end if;
 update public.responsibility_suggestions set status=case when p_approve then 'approved' else 'declined' end,reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
end $$;
create function public.suggest_responsibility(p_item uuid,p_body text) returns uuid language sql security invoker set search_path='' as $$select private.suggest_responsibility(p_item,p_body)$$;
create function public.review_responsibility(p_id uuid,p_approve boolean) returns void language sql security invoker set search_path='' as $$select private.review_responsibility(p_id,p_approve)$$;
revoke all on function private.suggest_responsibility(uuid,text),public.suggest_responsibility(uuid,text),private.review_responsibility(uuid,boolean),public.review_responsibility(uuid,boolean) from public,anon;
grant execute on function private.suggest_responsibility(uuid,text),public.suggest_responsibility(uuid,text),private.review_responsibility(uuid,boolean),public.review_responsibility(uuid,boolean) to authenticated;

create function private.manage_member_context(p_id uuid,p_full_name text,p_role text,p_department uuid,p_active boolean,p_description text,p_start date) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.manage_member(p_id,p_full_name,p_role,p_department,p_active);
 update public.profiles set role_description=coalesce(p_description,''),role_start_date=p_start where id=p_id and company_id=private.current_company_id();
end $$;
create function public.manage_member_context(p_id uuid,p_full_name text,p_role text,p_department uuid,p_active boolean,p_description text,p_start date) returns void language sql security invoker set search_path='' as $$select private.manage_member_context(p_id,p_full_name,p_role,p_department,p_active,p_description,p_start)$$;
create function private.prepare_invitation_context(p_action text,p_id uuid,p_email text,p_full_name text,p_role text,p_department uuid,p_description text,p_start date)
returns table(invitation_id uuid,email_log_id uuid,email text,full_name text) language plpgsql security definer set search_path='' as $$
declare r record;
begin
 select * into r from private.prepare_invitation(p_action,p_id,p_email,p_full_name,p_role,p_department);
 if p_action='create' then update public.invitations set role_description=coalesce(p_description,''),role_start_date=p_start where id=r.invitation_id; end if;
 return query select r.invitation_id,r.email_log_id,r.email,r.full_name;
end $$;
create function public.prepare_invitation_context(p_action text,p_id uuid,p_email text,p_full_name text,p_role text,p_department uuid,p_description text,p_start date)
returns table(invitation_id uuid,email_log_id uuid,email text,full_name text) language sql security invoker set search_path='' as $$select * from private.prepare_invitation_context(p_action,p_id,p_email,p_full_name,p_role,p_department,p_description,p_start)$$;
revoke all on function private.manage_member_context(uuid,text,text,uuid,boolean,text,date),public.manage_member_context(uuid,text,text,uuid,boolean,text,date),private.prepare_invitation_context(text,uuid,text,text,text,uuid,text,date),public.prepare_invitation_context(text,uuid,text,text,text,uuid,text,date) from public,anon;
grant execute on function private.manage_member_context(uuid,text,text,uuid,boolean,text,date),public.manage_member_context(uuid,text,text,uuid,boolean,text,date),private.prepare_invitation_context(text,uuid,text,text,text,uuid,text,date),public.prepare_invitation_context(text,uuid,text,text,text,uuid,text,date) to authenticated;
create function private.accept_role_context() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='accepted' and old.status is distinct from 'accepted' then
  update public.profiles set role_description=new.role_description,role_start_date=new.role_start_date where id=new.invited_user_id and company_id=new.company_id and active;
 end if;
 return new;
end $$;
revoke all on function private.accept_role_context() from public,anon,authenticated;
create trigger invitation_role_context after update of status on public.invitations for each row execute function private.accept_role_context();

-- Private documents: access follows the owner's role record, never public URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('role-documents','role-documents',false,10485760,array['application/pdf','text/plain','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
create function private.document_owner(p_name text) returns uuid language sql immutable set search_path='' as $$select case when split_part(p_name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(p_name,'/',1)::uuid else null end$$;
revoke all on function private.document_owner(text) from public,anon;
grant execute on function private.document_owner(text) to authenticated;
create policy role_document_read on storage.objects for select to authenticated using(bucket_id='role-documents' and private.can_read_role(private.document_owner(name)));
create policy role_document_upload on storage.objects for insert to authenticated with check(bucket_id='role-documents' and private.can_edit_role(private.document_owner(name),'document'));
-- No overwrites or public URLs; replacement files get new immutable paths.
