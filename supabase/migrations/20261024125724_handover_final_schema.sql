-- Final handover workflow. Existing drafts and task ownership are retained.
alter table public.work_handovers alter column cover_id drop not null,alter column reviewer_id drop not null,alter column starts_on drop not null,alter column ends_on drop not null;
alter table public.work_handovers drop constraint work_handovers_status_check;
alter table public.work_handovers add constraint work_handovers_status_check check(status in ('draft','pending','approved','declined','cancelled','completed'));
alter table public.work_handovers add column role_id uuid references public.role_profiles(id),add column handover_type text not null default 'leave' check(handover_type in ('leave','exit','sudden')),add column sections jsonb not null default '{}' check(jsonb_typeof(sections)='object' and octet_length(sections::text)<=50000),add column inclusions jsonb not null default '[]' check(jsonb_typeof(inclusions)='array'),add column created_by uuid references public.profiles(id),add column approved_by uuid references public.profiles(id),add column approved_at timestamptz,add column version integer not null default 1,add column approved_version integer,add column structured boolean not null default false,add column review_comment text not null default '' check(length(review_comment)<=3000),add column completed_at timestamptz;
create table private.handover_features(company_id uuid primary key references public.companies(id),sudden boolean not null default false,exit boolean not null default false,sharing boolean not null default false,pdf boolean not null default false);
create table private.handover_history(id bigint generated always as identity primary key,handover_id uuid not null references public.work_handovers(id),version integer not null,actor_id uuid references public.profiles(id),operation text not null,snapshot jsonb not null,created_at timestamptz not null default now());
create table private.handover_items(handover_id uuid references public.work_handovers(id),kind text not null check(kind in ('task','decision')),record_id uuid not null,do_not_change boolean not null default false,approved boolean not null default false,primary key(handover_id,kind,record_id));
create index handover_item_record on private.handover_items(record_id,handover_id);
create table private.handover_notifications(id uuid primary key default gen_random_uuid(),handover_id uuid not null references public.work_handovers(id),owner_id uuid not null references public.profiles(id),message text not null,created_at timestamptz not null default now(),read_at timestamptz);
create index handover_notifications_owner on private.handover_notifications(owner_id,created_at desc);
create table private.handover_shares(id uuid primary key default gen_random_uuid(),handover_id uuid not null references public.work_handovers(id),token_hash text not null unique,expires_at timestamptz not null,revoked_at timestamptz,created_by uuid references public.profiles(id),snapshot jsonb not null);
create table private.handover_ai_jobs(request_id uuid primary key,handover_id uuid not null references public.work_handovers(id),user_id uuid not null,kind text not null,fingerprint text not null,status text not null check(status in ('running','done','failed','cancelled')),charged boolean not null default true,output text,created_at timestamptz not null default now());
create index handover_ai_lookup on private.handover_ai_jobs(handover_id,kind,fingerprint);
alter table private.handover_features enable row level security;
alter table private.handover_history enable row level security;
alter table private.handover_items enable row level security;
alter table private.handover_notifications enable row level security;
alter table private.handover_shares enable row level security;
alter table private.handover_ai_jobs enable row level security;
revoke all on private.handover_features,private.handover_history,private.handover_items,private.handover_notifications,private.handover_shares,private.handover_ai_jobs from public,anon,authenticated;

create function private.handover_view_status(h public.work_handovers) returns text language sql stable set search_path='' as $$select case when h.status='pending' then 'submitted' when h.status='declined' then 'changes_requested' when h.status='approved' and current_date>=h.starts_on then 'active' else h.status end$$;
create function private.handover_authorized(h public.work_handovers,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.company_id=h.company_id and (p.id=h.owner_id or p.id=h.created_by and p.role in ('manager','hr_admin') and private.can_read_role(h.owner_id) or not p_write and (p.id=h.reviewer_id and h.status<>'draft' and private.can_read_role(h.owner_id) and p.role in ('manager','hr_admin') or p.id=h.cover_id and h.status in ('approved','completed'))))
$$;
create function private.handover_event(p_id uuid,p_operation text) returns void language plpgsql security definer set search_path='' as $$declare h public.work_handovers;begin
 select * into h from public.work_handovers where id=p_id;
 insert into private.handover_history(handover_id,version,actor_id,operation,snapshot) values(h.id,h.version,auth.uid(),p_operation,to_jsonb(h));
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(h.company_id,auth.uid(),'handover',h.id,p_operation);
end$$;
create function private.handover_snapshot(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
select to_jsonb(h)||jsonb_build_object('display_status',private.handover_view_status(h),'owner_name',o.full_name,'cover_name',c.full_name,'reviewer_name',m.full_name,'changed_since_approval',h.approved_version is not null and h.version>h.approved_version,'items',coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'id',i.record_id,'do_not_change',i.do_not_change,'title',case when i.kind='task' then a.title else d.title end,'status',a.status)) from private.handover_items i left join public.actions a on i.kind='task' and a.id=i.record_id left join public.decisions d on i.kind='decision' and d.id=i.record_id where i.handover_id=h.id),'[]')) from public.work_handovers h join public.profiles o on o.id=h.owner_id left join public.profiles c on c.id=h.cover_id left join public.profiles m on m.id=h.reviewer_id where h.id=p_id
$$;

revoke all on function private.handover_view_status(public.work_handovers),private.handover_authorized(public.work_handovers,boolean),private.handover_event(uuid,text),private.handover_snapshot(uuid) from public,anon,authenticated;
