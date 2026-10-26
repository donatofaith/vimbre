-- My Day extension: additive schema only; apply after reviewing app RPC compatibility.
alter table public.actions
  add column if not exists repeat_rule jsonb,
  add column if not exists time_needed_minutes integer,
  add column if not exists steps jsonb not null default '[]'::jsonb,
  add column if not exists links jsonb not null default '[]'::jsonb,
  add column if not exists label text,
  add column if not exists created_by_ai boolean not null default false,
  add column if not exists deleted_by uuid,
  add column if not exists source_excerpt text,
  add column if not exists source_disconnected boolean not null default false,
  add column if not exists metadata jsonb not null default '{"schema_version":1}'::jsonb;
alter table public.actions
  add constraint actions_time_needed_positive check (time_needed_minutes is null or time_needed_minutes between 1 and 1440);
create table if not exists public.myday_comments (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 action_id uuid not null references public.actions(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 body text not null check (length(trim(body)) between 1 and 5000),
 private_note boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists myday_comments_action_idx on public.myday_comments(action_id,created_at);
alter table public.myday_comments enable row level security;
revoke all on public.myday_comments from anon;
grant select,insert,update,delete on public.myday_comments to authenticated;
create policy myday_comments_owner_read on public.myday_comments for select to authenticated
 using (exists(select 1 from public.actions a where a.id=action_id and a.company_id=myday_comments.company_id and a.owner_id=(select auth.uid())));
create policy myday_comments_owner_create on public.myday_comments for insert to authenticated
 with check (author_id=(select auth.uid()) and exists(select 1 from public.actions a where a.id=action_id and a.company_id=myday_comments.company_id and a.owner_id=(select auth.uid())));
create policy myday_comments_author_edit on public.myday_comments for update to authenticated
 using (author_id=(select auth.uid()) and exists(select 1 from public.actions a where a.id=action_id and a.owner_id=(select auth.uid())))
 with check (author_id=(select auth.uid()) and exists(select 1 from public.actions a where a.id=action_id and a.owner_id=(select auth.uid())));
create policy myday_comments_author_delete on public.myday_comments for delete to authenticated
 using (author_id=(select auth.uid()) and exists(select 1 from public.actions a where a.id=action_id and a.owner_id=(select auth.uid())));
-- Additional team, templates, rules and AI policies require a separate authorization review.
