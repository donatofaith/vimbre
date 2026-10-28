-- Cover Duties lifecycle: bounded requests, shared tasks, hand-backs, notes, and team capacity.
alter table public.work_handovers
  add column if not exists cover_response text not null default 'pending',
  add column if not exists cover_accepted_at timestamptz,
  add column if not exists cover_declined_at timestamptz,
  add column if not exists cover_decline_reason text not null default '',
  add column if not exists cover_suggested_id uuid references public.profiles(id);

do $$
begin
  if not exists(select 1 from pg_constraint where conname='work_handovers_cover_response_check') then
    alter table public.work_handovers add constraint work_handovers_cover_response_check
      check(cover_response in ('pending','accepted','declined') and length(cover_decline_reason)<=1000);
  end if;
end $$;

-- Existing approved/completed handovers represent covers who were already able to work.
update public.work_handovers
set cover_response='accepted',
    cover_accepted_at=coalesce(cover_accepted_at,approved_at,updated_at)
where status in ('approved','completed') and cover_id is not null and cover_response='pending';

create table if not exists private.handover_cover_notes(
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.work_handovers(id),
  company_id uuid not null references public.companies(id),
  author_id uuid not null references public.profiles(id),
  note_type text not null check(note_type in ('note','decision')),
  title text not null default '' check(length(title)<=200),
  body text not null check(length(btrim(body)) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index if not exists handover_cover_notes_by_handover on private.handover_cover_notes(handover_id,created_at);

create table if not exists private.handover_task_handbacks(
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.work_handovers(id),
  task_id uuid not null references public.actions(id),
  company_id uuid not null references public.companies(id),
  cover_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.profiles(id),
  reason text not null check(length(btrim(reason)) between 1 and 1000),
  status text not null default 'pending' check(status in ('pending','returned','declined')),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz
);
create unique index if not exists handover_task_handback_open_once on private.handover_task_handbacks(handover_id,task_id) where status='pending';
create index if not exists handover_task_handbacks_task on private.handover_task_handbacks(task_id,status);

create table if not exists private.handover_cover_availability(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  person_id uuid not null references public.profiles(id),
  starts_on date not null,
  ends_on date not null,
  note text not null default '' check(length(note)<=500),
  created_at timestamptz not null default now(),
  check(starts_on<=ends_on)
);
create index if not exists handover_cover_availability_dates on private.handover_cover_availability(company_id,person_id,starts_on,ends_on);

create table if not exists private.handover_cover_pool(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  department_id uuid not null references public.departments(id),
  person_id uuid not null references public.profiles(id),
  priority integer not null default 100 check(priority between 1 and 1000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(company_id,department_id,person_id)
);
create index if not exists handover_cover_pool_department on private.handover_cover_pool(company_id,department_id,priority);

create table if not exists private.handover_external_questions(
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references private.handover_shares(id),
  handover_id uuid not null references public.work_handovers(id),
  company_id uuid not null references public.companies(id),
  sender_email text not null default '' check(length(sender_email)<=320),
  body text not null check(length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists handover_external_questions_handover on private.handover_external_questions(handover_id,created_at);

alter table private.handover_cover_notes enable row level security;
alter table private.handover_task_handbacks enable row level security;
alter table private.handover_cover_availability enable row level security;
alter table private.handover_cover_pool enable row level security;
alter table private.handover_external_questions enable row level security;
revoke all on private.handover_cover_notes,private.handover_task_handbacks,private.handover_cover_availability,private.handover_cover_pool,private.handover_external_questions from public,anon,authenticated,service_role;

create or replace function private.handover_cover_brief(p_id uuid,p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  h public.work_handovers;
  me public.profiles;
  pol private.handover_policy;
  allowed boolean:=false;
  full_access boolean:=false;
  row_state text;
  role_title text:='';
  task_count integer:=0;
  item_count integer:=0;
  completed_count integer:=0;
  next_title text;
  next_due date;
  current_load integer:=0;
  capacity integer:=3;
  tasks_json jsonb:='[]'::jsonb;
  sections_json jsonb:='{}'::jsonb;
  notes_json jsonb:='[]'::jsonb;
  comments_json jsonb:='[]'::jsonb;
  activity_json jsonb:='[]'::jsonb;
  handbacks_json jsonb:='[]'::jsonb;
begin
  select * into h from public.work_handovers where id=p_id and company_id=private.current_company_id() and deleted_at is null;
  if not found then raise insufficient_privilege; end if;
  select * into me from public.profiles where id=p_user and active and company_id=h.company_id;
  if not found then raise insufficient_privilege; end if;
  select * into pol from private.handover_policy where company_id=h.company_id;
  if not found then pol:=row(h.company_id,true,false,array['manager','hr_admin'],0,false,14,'approval',array['priorities'],3)::private.handover_policy; end if;

  allowed:=p_user=h.cover_id or (me.role='manager' and h.status<>'draft' and private.can_read_role(h.owner_id));
  if not allowed then raise insufficient_privilege; end if;
  if me.role='hr_admin' and p_user<>h.cover_id then raise insufficient_privilege; end if;
  full_access:=(p_user=h.cover_id and h.cover_response<>'declined' and
       (h.cover_response='accepted' or pol.cover_visibility='approval' and h.status in ('approved','completed')))
       or (p_user<>h.cover_id and me.role='manager' and h.status in ('approved','completed') and private.can_read_role(h.owner_id));

  select coalesce(rp.title,'') into role_title from public.role_profiles rp where rp.id=h.role_id and rp.holder_id=h.owner_id;
  select count(*) filter(where hi.kind='task' and a.id is not null),count(*),
         count(*) filter(where hi.kind='task' and a.id is not null and a.status='done')
    into task_count,item_count,completed_count
  from private.handover_items hi
  left join public.actions a on hi.kind='task' and a.id=hi.record_id and a.deleted_at is null and a.purged_at is null
  where hi.handover_id=h.id;

  if h.status='cancelled' or h.cover_response='declined' then row_state:='cancelled';
  elsif h.status='completed' or (h.status='approved' and h.ends_on is not null and h.ends_on<current_date) then row_state:='ended';
  elsif h.cover_response='pending' then row_state:='waiting';
  elsif h.starts_on>current_date then row_state:='upcoming';
  elsif h.status='approved' and current_date between h.starts_on and coalesce(h.ends_on,'infinity'::date) then row_state:='active';
  else row_state:='upcoming'; end if;

  if full_access then
    sections_json:=h.sections-array['reason','note_for_manager','return_summary'];
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'title',a.title,'status',a.status,'due_date',a.due_date,'due_at',a.due_at,
      'details',case when a.source_kind='manual' then a.details else '' end,'steps',a.steps,'links',case when a.source_kind='manual' then a.links else '[]'::jsonb end,
      'completion_note',a.completion_note,'do_not_change',hi.do_not_change,'approved',hi.approved,
      'handback_pending',exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=a.id and hb.status='pending'),
      'source_not_shared',a.source_kind<>'manual' and (a.source_url is not null or a.source_excerpt is not null),
      'completed_by_cover',hi.completed_by=p_user
    ) order by a.due_date nulls last,a.due_time nulls last,a.created_at,a.id),'[]'::jsonb)
    into tasks_json
    from private.handover_items hi join public.actions a on a.id=hi.record_id
    where hi.handover_id=h.id and hi.kind='task' and a.company_id=h.company_id
      and a.owner_id=h.owner_id and a.deleted_at is null and a.purged_at is null;

    select a.title,a.due_date into next_title,next_due
    from private.handover_items hi join public.actions a on a.id=hi.record_id
    where hi.handover_id=h.id and hi.kind='task' and hi.approved and a.status<>'done'
      and a.deleted_at is null and a.purged_at is null
      and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=a.id and hb.status in ('pending','returned'))
    order by a.due_date nulls last,a.due_time nulls last,a.created_at,a.id limit 1;

    select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'note_type',n.note_type,'title',n.title,'body',n.body,'author_name',p.full_name,'created_at',n.created_at) order by n.created_at),'[]'::jsonb)
      into notes_json from private.handover_cover_notes n join public.profiles p on p.id=n.author_id where n.handover_id=h.id;
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'author',p.full_name,'author_id',q.author_id,'body',q.body,'created_at',q.created_at) order by q.created_at),'[]'::jsonb)
      into comments_json from private.handover_comments q join public.profiles p on p.id=q.author_id where q.handover_id=h.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',hb.id,'task_id',hb.task_id,'task_title',a.title,'reason',hb.reason,'status',hb.status,'created_at',hb.created_at) order by hb.created_at desc),'[]'::jsonb)
    into handbacks_json
  from private.handover_task_handbacks hb join public.actions a on a.id=hb.task_id where hb.handover_id=h.id;

  select coalesce(jsonb_agg(jsonb_build_object('operation',hh.operation,'actor',coalesce(p.full_name,'Vimbre'),'at',hh.created_at) order by hh.created_at desc),'[]'::jsonb)
    into activity_json
  from private.handover_history hh left join public.profiles p on p.id=hh.actor_id where hh.handover_id=h.id;

  select count(distinct h2.owner_id) into current_load
  from public.work_handovers h2
  where h2.company_id=h.company_id and h2.cover_id=p_user and h2.id<>h.id and h2.deleted_at is null
    and h2.status='approved' and h2.cover_response='accepted'
    and h2.starts_on<=current_date+7 and coalesce(h2.ends_on,'infinity'::date)>=current_date;

  capacity:=coalesce(pol.cover_capacity,3);
  return jsonb_build_object(
    'handover',jsonb_build_object(
      'id',h.id,'title',h.title,'owner_id',h.owner_id,'owner_name',(select full_name from public.profiles where id=h.owner_id),
      'role_id',h.role_id,'role_title',role_title,'cover_id',h.cover_id,'cover_name',(select full_name from public.profiles where id=h.cover_id),
      'reviewer_id',h.reviewer_id,'reviewer_name',(select full_name from public.profiles where id=h.reviewer_id),
      'starts_on',h.starts_on,'ends_on',h.ends_on,'return_unknown',h.return_unknown,'handover_type',h.handover_type,
      'status',h.status,'display_status',private.handover_view_status(h),'cover_response',h.cover_response,
      'cover_visibility',pol.cover_visibility,'state',row_state,'full_access',full_access,
      'task_count',task_count,'item_count',item_count,'completed_count',completed_count,
      'next_task_title',case when full_access then next_title else null end,
      'next_task_due',case when full_access then next_due else null end,
      'updated_at',h.updated_at,'approved_at',h.approved_at,'accepted_at',h.cover_accepted_at,
      'cover_decline_reason',case when p_user=h.owner_id or me.role='manager' then h.cover_decline_reason else '' end,
      'cover_suggested_id',case when p_user=h.owner_id or me.role='manager' then h.cover_suggested_id else null end,
      'review_comment',case when full_access then h.review_comment else '' end,
      'sections',sections_json,'priority_order',case when full_access then coalesce(h.priority_order,'[]'::jsonb) else '[]'::jsonb end,
      'sudden',h.handover_type='sudden' and h.created_by is distinct from h.owner_id,
      'owner_returned',h.status='completed','cover_summary',case when full_access then coalesce(h.sections->>'return_summary','') else '' end,
      'covering_people_count',current_load+1,'cover_capacity',capacity
    ),
    'full_access',full_access,'tasks',tasks_json,'notes',notes_json,'comments',comments_json,
    'activity',activity_json,'handbacks',handbacks_json
  );
end;
$function$;

create or replace function private.handover_cover_action(p_operation text,p_id uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  u uuid:=auth.uid(); c uuid:=private.current_company_id(); me public.profiles; h public.work_handovers;
  pol private.handover_policy; item_id uuid; body text; reason text; decision text; suggested uuid;
  task_row public.actions; full_access boolean; cover_count integer:=0; counts_json jsonb;
  department uuid; row_json jsonb; ai_summary text;
begin
  if u is null or c is null then raise insufficient_privilege; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>30000 then raise invalid_parameter_value; end if;
  select * into me from public.profiles where id=u and company_id=c and active;
  if not found then raise insufficient_privilege; end if;
  select * into pol from private.handover_policy where company_id=c;
  if not found then pol:=row(c,true,false,array['manager','hr_admin'],0,false,14,'approval',array['priorities'],3)::private.handover_policy; end if;

  if p_operation='list' then
    if coalesce(p_data->>'view','mine')='team' then
      if me.role='hr_admin' then
        select jsonb_build_object(
          'active',count(*) filter(where h.status='approved' and h.cover_response='accepted' and current_date between h.starts_on and coalesce(h.ends_on,'infinity'::date)),
          'upcoming',count(*) filter(where h.status='approved' and h.starts_on>current_date and h.cover_response='accepted'),
          'past',count(*) filter(where h.status in ('completed','cancelled') or h.cover_response='declined'),
          'waiting',count(*) filter(where h.cover_response='pending' and h.status in ('pending','approved'))
        ) into counts_json from public.work_handovers h where h.company_id=c and h.deleted_at is null;
        return jsonb_build_object('team',true,'admin_counts_only',true,'counts',coalesce(counts_json,'{}'::jsonb),'rows','[]'::jsonb);
      end if;
      if me.role<>'manager' then raise insufficient_privilege; end if;
      return jsonb_build_object('team',true,'admin_counts_only',false,'rows',coalesce((
        select jsonb_agg((private.handover_cover_brief(w.id,u)->'handover') order by w.starts_on nulls last,w.updated_at desc)
        from public.work_handovers w
        where w.company_id=c and w.deleted_at is null and w.status<>'draft'
          and private.can_read_role(w.owner_id)
      ),'[]'::jsonb));
    end if;
    return jsonb_build_object('team',false,'admin_counts_only',false,'rows',coalesce((
      select jsonb_agg((private.handover_cover_brief(w.id,u)->'handover') order by w.starts_on nulls last,w.updated_at desc)
      from public.work_handovers w
      where w.company_id=c and w.cover_id=u and w.deleted_at is null and w.status<>'draft'
    ),'[]'::jsonb));
  end if;

  if p_operation in ('availability','availability_save','availability_delete') then
    if p_operation='availability' then
      return coalesce((select jsonb_agg(jsonb_build_object('id',id,'starts_on',starts_on,'ends_on',ends_on,'note',note) order by starts_on desc)
        from private.handover_cover_availability where company_id=c and person_id=u),'[]'::jsonb);
    elsif p_operation='availability_save' then
      if nullif(p_data->>'starts_on','') is null or nullif(p_data->>'ends_on','') is null
         or (p_data->>'starts_on')::date>(p_data->>'ends_on')::date or length(coalesce(p_data->>'note',''))>500 then
        raise check_violation using message='Choose valid dates for your availability.';
      end if;
      insert into private.handover_cover_availability(company_id,person_id,starts_on,ends_on,note)
      values(c,u,(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,left(coalesce(p_data->>'note',''),500));
      insert into public.activity_log(company_id,actor_id,record_type,record_id,action)
      values(c,u,'cover_availability',gen_random_uuid(),'availability_saved');
      return coalesce((select jsonb_agg(jsonb_build_object('id',id,'starts_on',starts_on,'ends_on',ends_on,'note',note) order by starts_on desc)
        from private.handover_cover_availability where company_id=c and person_id=u),'[]'::jsonb);
    else
      delete from private.handover_cover_availability where id=p_id and company_id=c and person_id=u;
      return jsonb_build_object('ok',true);
    end if;
  end if;

  if p_operation='pool_options' then
    if me.role not in ('manager','hr_admin') then raise insufficient_privilege; end if;
    return jsonb_build_object(
      'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name)
        from public.departments d where d.company_id=c and (me.role='hr_admin' or d.manager_id=u or d.id=me.department_id)),'[]'::jsonb),
      'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'department_id',p.department_id,'department_name',d.name) order by p.full_name)
        from public.profiles p left join public.departments d on d.id=p.department_id and d.company_id=p.company_id
        where p.company_id=c and p.active and p.id<>u),'[]'::jsonb)
    );
  elsif p_operation='pool_list' then
    if me.role not in ('manager','hr_admin') then raise insufficient_privilege; end if;
    return coalesce((select jsonb_agg(jsonb_build_object('id',cp.id,'person_id',cp.person_id,'person_name',p.full_name,'department_id',cp.department_id,'department_name',d.name,'priority',cp.priority) order by d.name,cp.priority,p.full_name)
      from private.handover_cover_pool cp join public.profiles p on p.id=cp.person_id and p.active join public.departments d on d.id=cp.department_id
      where cp.company_id=c and (me.role='hr_admin' or d.manager_id=u or cp.department_id=me.department_id)),'[]'::jsonb);
  elsif p_operation='pool_add' then
    if me.role not in ('manager','hr_admin') then raise insufficient_privilege; end if;
    department:=nullif(p_data->>'department_id','')::uuid;
    suggested:=nullif(p_data->>'person_id','')::uuid;
    if department is null or suggested is null or not exists(select 1 from public.departments d where d.id=department and d.company_id=c)
       or not exists(select 1 from public.profiles p where p.id=suggested and p.company_id=c and p.active and p.id<>u)
       or me.role='manager' and not exists(select 1 from public.departments d where d.id=department and d.company_id=c and (d.manager_id=u or department=me.department_id)) then
      raise insufficient_privilege;
    end if;
    insert into private.handover_cover_pool(company_id,department_id,person_id,priority,created_by)
    values(c,department,suggested,coalesce(nullif(p_data->>'priority','')::integer,100),u)
    on conflict(company_id,department_id,person_id) do update set priority=excluded.priority;
    insert into public.activity_log(company_id,actor_id,record_type,record_id,action)
    values(c,u,'cover_pool',department,'cover_person_added');
    return private.handover_cover_action('pool_list',null,'{}'::jsonb);
  elsif p_operation='pool_remove' then
    if me.role not in ('manager','hr_admin') then raise insufficient_privilege; end if;
    if not exists(select 1 from private.handover_cover_pool cp join public.departments d on d.id=cp.department_id
      where cp.id=p_id and cp.company_id=c and (me.role='hr_admin' or d.manager_id=u or cp.department_id=me.department_id)) then raise insufficient_privilege; end if;
    delete from private.handover_cover_pool where id=p_id and company_id=c;
    insert into public.activity_log(company_id,actor_id,record_type,record_id,action)
    values(c,u,'cover_pool',p_id,'cover_person_removed');
    return private.handover_cover_action('pool_list',null,'{}'::jsonb);
  elsif p_operation='suggest' then
    suggested:=coalesce(nullif(p_data->>'owner_id','')::uuid,u);
    if suggested<>u and not private.can_read_role(suggested) then raise insufficient_privilege; end if;
    if nullif(p_data->>'starts_on','') is null or nullif(p_data->>'ends_on','') is null then return '[]'::jsonb; end if;
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',x.id,'name',x.full_name,'role',x.role,'department',x.department_name,'load',x.cover_load,
        'available',x.available,'score',x.score,'reason',x.reason
      ) order by x.score desc,x.cover_load,x.full_name)
      from (
        select cand.id,cand.full_name,cand.role,d.name department_name,
          (select count(*) from public.work_handovers h2 where h2.company_id=c and h2.cover_id=cand.id and h2.status='approved' and h2.cover_response='accepted'
            and h2.deleted_at is null and h2.starts_on<=(p_data->>'ends_on')::date and coalesce(h2.ends_on,'infinity'::date)>=(p_data->>'starts_on')::date) cover_load,
          exists(select 1 from private.handover_cover_availability av where av.company_id=c and av.person_id=cand.id
            and av.starts_on<=(p_data->>'starts_on')::date and av.ends_on>=(p_data->>'ends_on')::date) available,
          (case when cand.department_id=owner_profile.department_id then 100 else 0 end)
          +(case when lower(coalesce(candidate_role.title,'')) like '%'||lower(split_part(coalesce(owner_role.title,''),' ',1))||'%' and split_part(coalesce(owner_role.title,''),' ',1)<>'' then 25 else 0 end)
          +(case when exists(select 1 from private.handover_cover_availability av where av.company_id=c and av.person_id=cand.id and av.starts_on<=(p_data->>'starts_on')::date and av.ends_on>=(p_data->>'ends_on')::date) then 100 else 0 end)
          +(case when not exists(select 1 from public.work_handovers h2 where h2.company_id=c and h2.cover_id=cand.id and h2.status='approved' and h2.cover_response='accepted' and h2.deleted_at is null and h2.starts_on<=(p_data->>'ends_on')::date and coalesce(h2.ends_on,'infinity'::date)>=(p_data->>'starts_on')::date) then 50 else 0 end)
          +(case when exists(select 1 from private.handover_cover_pool cp where cp.company_id=c and cp.person_id=cand.id and cp.department_id=cand.department_id) then 30 else 0 end)
          -10*(select count(*) from public.work_handovers hx where hx.company_id=c and hx.cover_id=cand.id and hx.status='approved' and hx.cover_response='accepted' and hx.deleted_at is null and hx.starts_on<=current_date+7 and coalesce(hx.ends_on,'infinity'::date)>=current_date) score,
          array_to_string(array_remove(array[
            case when cand.department_id=owner_profile.department_id then 'Same department' end,
            case when lower(coalesce(candidate_role.title,'')) like '%'||lower(split_part(coalesce(owner_role.title,''),' ',1))||'%' and split_part(coalesce(owner_role.title,''),' ',1)<>'' then 'Similar role' end,
            case when exists(select 1 from private.handover_cover_availability av where av.company_id=c and av.person_id=cand.id and av.starts_on<=(p_data->>'starts_on')::date and av.ends_on>=(p_data->>'ends_on')::date) then 'Available for these dates' end,
            case when not exists(select 1 from public.work_handovers h2 where h2.company_id=c and h2.cover_id=cand.id and h2.status='approved' and h2.cover_response='accepted' and h2.deleted_at is null and h2.starts_on<=(p_data->>'ends_on')::date and coalesce(h2.ends_on,'infinity'::date)>=(p_data->>'starts_on')::date) then 'No overlapping cover' end,
            case when exists(select 1 from private.handover_cover_pool cp where cp.company_id=c and cp.person_id=cand.id and cp.department_id=cand.department_id) then 'In your team’s cover pool' end
          ],null),', ') reason
        from public.profiles cand
        join public.profiles owner_profile on owner_profile.id=suggested and owner_profile.company_id=c
        left join public.departments d on d.id=cand.department_id and d.company_id=c
        left join lateral(select rp.title from public.role_profiles rp where rp.holder_id=cand.id and rp.company_id=c order by rp.updated_at desc nulls last limit 1) candidate_role on true
        left join lateral(select rp.title from public.role_profiles rp where rp.holder_id=suggested and rp.company_id=c order by rp.updated_at desc nulls last limit 1) owner_role on true
        where cand.company_id=c and cand.active and cand.id<>suggested
          and not exists(select 1 from public.work_handovers hx where hx.company_id=c and hx.cover_id=cand.id and hx.status='approved' and hx.cover_response='accepted' and hx.deleted_at is null and hx.starts_on<=(p_data->>'ends_on')::date and coalesce(hx.ends_on,'infinity'::date)>=(p_data->>'starts_on')::date)
        order by score desc,cand.full_name limit 5
      ) x
    ),'[]'::jsonb);
  end if;

  select * into h from public.work_handovers where id=p_id and company_id=c for update;
  if not found or h.deleted_at is not null then raise insufficient_privilege; end if;
  if h.cover_id<>u and not(me.role='manager' and private.can_read_role(h.owner_id)) and h.owner_id<>u and h.reviewer_id<>u then raise insufficient_privilege; end if;
  full_access:=(u=h.cover_id and h.cover_response<>'declined' and
       (h.cover_response='accepted' or pol.cover_visibility='approval' and h.status in ('approved','completed')));

  if p_operation='get' then
    insert into public.activity_log(company_id,actor_id,record_type,record_id,action)
    values(c,u,'handover',h.id,'cover_briefing_viewed');
    return private.handover_cover_brief(h.id,u);
  elsif p_operation='accept' then
    if h.cover_id<>u or h.cover_response<>'pending' or h.status not in ('pending','approved') then raise insufficient_privilege; end if;
    update public.work_handovers set cover_response='accepted',cover_accepted_at=now(),cover_declined_at=null,cover_decline_reason='',cover_suggested_id=null,updated_at=now()
      where id=h.id;
    insert into private.handover_notifications(handover_id,owner_id,message)
      values(h.id,h.owner_id,me.full_name||' accepted the cover request.');
    if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message)
      values(h.id,h.reviewer_id,me.full_name||' accepted the cover request.'); end if;
    perform private.handover_event(h.id,'cover_accepted');
    return private.handover_cover_brief(h.id,u);

  elsif p_operation='decline' then
    body:=btrim(coalesce(p_data->>'reason',''));
    if h.cover_id<>u or h.cover_response<>'pending' or length(body) not between 3 and 1000 or h.status not in ('pending','approved') then
      raise check_violation using message='Give a short reason before declining the request.';
    end if;
    suggested:=nullif(p_data->>'suggested_person_id','')::uuid;
    if suggested is not null and not exists(select 1 from public.profiles p where p.id=suggested and p.company_id=c and p.active and p.id<>h.owner_id and p.id<>u) then raise check_violation using message='Choose an active colleague as a suggestion.'; end if;
    update public.work_handovers set cover_response='declined',cover_declined_at=now(),cover_decline_reason=body,cover_suggested_id=suggested,updated_at=now() where id=h.id;
    insert into private.handover_notifications(handover_id,owner_id,message)
      values(h.id,h.owner_id,me.full_name||' declined the cover request: '||left(body,400));
    if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message)
      values(h.id,h.reviewer_id,me.full_name||' declined the cover request.'); end if;
    perform private.handover_event(h.id,'cover_declined');
    return private.handover_cover_brief(h.id,u);

  elsif p_operation in ('task_done','task_edit','hand_back') then
    if h.cover_id<>u or not full_access or h.status<>'approved'
       or (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date<h.starts_on
       or (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date>coalesce(h.ends_on,'infinity'::date) then
      raise insufficient_privilege;
    end if;
    item_id:=nullif(p_data->>'task_id','')::uuid;
    select a.* into task_row from private.handover_items hi join public.actions a on a.id=hi.record_id
      where hi.handover_id=h.id and hi.kind='task' and hi.record_id=item_id and hi.approved
        and a.company_id=c and a.owner_id=h.owner_id and a.deleted_at is null and a.purged_at is null
      for update of a;
    if not found then raise check_violation using message='That task is not available in this handover.'; end if;
    if exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=item_id and hb.status in ('pending','returned')) then raise check_violation using message='This task has been handed back and is no longer in your cover work.'; end if;

    if p_operation='task_done' then
      body:=left(btrim(coalesce(p_data->>'outcome_note','')),1000);
      if task_row.status<>'done' then
        update public.actions set status='done',completed_at=now(),completion_note=case when body<>'' then body else completion_note end,updated_at=now()
          where id=item_id and owner_id=h.owner_id and company_id=c and status<>'done' and deleted_at is null;
      elsif body<>'' then
        update public.actions set completion_note=body,updated_at=now() where id=item_id and owner_id=h.owner_id and company_id=c;
      end if;
      update private.handover_items set completed_by=u,completed_at=coalesce(completed_at,now()) where handover_id=h.id and kind='task' and record_id=item_id;
      perform private.handover_event(h.id,'task_done');
      insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.owner_id,'Cover completed a task: '||task_row.title);
      return private.handover_cover_brief(h.id,u);

    elsif p_operation='task_edit' then
      if task_row.status='done' then raise check_violation using message='Completed tasks cannot be edited from cover.'; end if;
      if p_data?'title' and length(btrim(coalesce(p_data->>'title','')))<1 or length(coalesce(p_data->>'title',task_row.title))>300 then raise check_violation using message='Enter a task title under 300 characters.'; end if;
      if length(coalesce(p_data->>'details',task_row.details))>6000 then raise check_violation using message='Keep task notes under 6,000 characters.'; end if;
      if p_data?'steps' and (jsonb_typeof(p_data->'steps')<>'array' or jsonb_array_length(p_data->'steps')>100) then raise check_violation using message='Check the task steps.'; end if;
      if p_data?'links' and (jsonb_typeof(p_data->'links')<>'array' or jsonb_array_length(p_data->'links')>30) then raise check_violation using message='Check the task links.'; end if;
      update public.actions set
        title=case when p_data?'title' then btrim(p_data->>'title') else title end,
        details=case when p_data?'details' then p_data->>'details' else details end,
        due_date=case when p_data?'due_date' then nullif(p_data->>'due_date','')::date else due_date end,
        due_time=case when p_data?'due_time' then nullif(p_data->>'due_time','')::time else due_time end,
        due_at=case when p_data?'due_at' then nullif(p_data->>'due_at','')::timestamptz else due_at end,
        priority=case when p_data?'priority' and p_data->>'priority'=any(array['low','normal','high','urgent']) then p_data->>'priority' else priority end,
        steps=case when p_data?'steps' then p_data->'steps' else steps end,
        links=case when p_data?'links' then p_data->'links' else links end,
        label=case when p_data?'label' then nullif(left(btrim(p_data->>'label'),80),'') else label end,
        time_needed_minutes=case when p_data?'time_needed_minutes' then greatest(1,least(1440,(p_data->>'time_needed_minutes')::integer)) else time_needed_minutes end,
        reminder_sent_at=null,check_in_sent_at=null,overdue=false,updated_at=now()
      where id=item_id and owner_id=h.owner_id and company_id=c;
      perform private.handover_event(h.id,'cover_task_edited');
      insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(c,u,'task',item_id,'edited_by_cover');
      return private.handover_cover_brief(h.id,u);

    else
      reason:=btrim(coalesce(p_data->>'reason',''));
      if length(reason) not between 3 and 1000 then raise check_violation using message='Give a short reason for handing this task back.'; end if;
      insert into private.handover_task_handbacks(handover_id,task_id,company_id,cover_id,owner_id,reason)
        values(h.id,item_id,c,u,h.owner_id,reason);
      insert into private.handover_notifications(handover_id,owner_id,message)
        values(h.id,h.owner_id,me.full_name||' handed back a task: '||task_row.title||'. Reason: '||left(reason,300));
      if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message)
        values(h.id,h.reviewer_id,'A covered task was handed back for a decision.'); end if;
      perform private.handover_event(h.id,'task_handed_back');
      return private.handover_cover_brief(h.id,u);
    end if;

  elsif p_operation='resolve_handback' then
    decision:=coalesce(p_data->>'decision','');
    if not (h.owner_id=u or h.reviewer_id=u or me.role='manager' and private.can_read_role(h.owner_id)) or decision not in ('return','decline') then raise insufficient_privilege; end if;
    update private.handover_task_handbacks set status=case when decision='return' then 'returned' else 'declined' end,resolved_by=u,resolved_at=now()
      where id=nullif(p_data->>'handback_id','')::uuid and handover_id=h.id and status='pending';
    if not found then raise check_violation using message='This hand-back has already been resolved.'; end if;
    insert into private.handover_notifications(handover_id,owner_id,message)
      values(h.id,h.cover_id,case when decision='return' then 'The task was handed back.' else 'The task stays with you for now.' end);
    perform private.handover_event(h.id,case when decision='return' then 'task_handback_accepted' else 'task_handback_declined' end);
    return jsonb_build_object('ok',true,'handback_id',nullif(p_data->>'handback_id',''));

  elsif p_operation='note' then
    if h.cover_id<>u or not full_access then raise insufficient_privilege; end if;
    body:=btrim(coalesce(p_data->>'body',''));
    if length(body) not between 1 and 3000 then raise check_violation using message='Write a short note for the owner.'; end if;
    insert into private.handover_cover_notes(handover_id,company_id,author_id,note_type,title,body)
      values(h.id,c,u,'note','For when you’re back',body);
    insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.owner_id,'For when you’re back: '||left(body,180));
    perform private.handover_event(h.id,'cover_note_added');
    return private.handover_cover_brief(h.id,u);

  elsif p_operation='decision' then
    if h.cover_id<>u or not full_access then raise insufficient_privilege; end if;
    body:=btrim(coalesce(p_data->>'reason','')); reason:=btrim(coalesce(p_data->>'title',''));
    if length(reason) not between 1 and 200 or length(body) not between 1 and 3000 then raise check_violation using message='Add a decision title and a short reason.'; end if;
    insert into public.decisions(company_id,owner_id,role_id,title,reason,decided_by,decided_on,status,role_fields)
      values(c,h.owner_id,h.role_id,reason,body,me.full_name||' (cover)',current_date,'live',jsonb_build_object('made_by_cover',true,'handover_id',h.id,'cover_id',u));
    insert into private.handover_cover_notes(handover_id,company_id,author_id,note_type,title,body)
      values(h.id,c,u,'decision',reason,body);
    insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.owner_id,'A decision was recorded while you were away: '||left(reason,180));
    perform private.handover_event(h.id,'decision_recorded');
    return private.handover_cover_brief(h.id,u);

  elsif p_operation='question' then
    body:=btrim(coalesce(p_data->>'body',''));
    if length(body) not between 1 and 3000 then raise check_violation using message='Write a question or reply.'; end if;
    if not (u=h.cover_id or u=h.owner_id or u=h.reviewer_id or me.role='manager' and private.can_read_role(h.owner_id)) then raise insufficient_privilege; end if;
    insert into private.handover_comments(handover_id,author_id,body) values(h.id,u,body);
    if u=h.cover_id then
      insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,'New question from the person covering your work.');
      if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'New question on a cover handover.'); end if;
      perform private.handover_event(h.id,'question_asked');
    else
      insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.cover_id,'Your cover question has a reply.');
      perform private.handover_event(h.id,'question_answered');
    end if;
    return private.handover_cover_brief(h.id,u);

  elsif p_operation='return_summary' then
    if h.cover_id<>u or not full_access or h.status not in ('completed','approved') or h.ends_on is null and h.status<>'completed' or current_date<=coalesce(h.ends_on,current_date) and h.status<>'completed' then
      raise insufficient_privilege;
    end if;
    body:=btrim(coalesce(p_data->>'summary',''));
    if length(body)<1 or length(body)>6000 then raise check_violation using message='Add the cover summary before saving.'; end if;
    update public.work_handovers set sections=sections||jsonb_build_object('return_summary',body),version=version+1,updated_at=now() where id=h.id;
    insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.owner_id,'The cover summary is ready.');
    if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'The cover summary is ready.'); end if;
    perform private.handover_event(h.id,'cover_summary_saved');
    return private.handover_cover_brief(h.id,u);

  else
    raise invalid_parameter_value using message='Unknown Cover Duties action.';
  end if;
end;
$function$;

revoke all on function private.handover_cover_brief(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.handover_cover_action(text,uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function public.cover_duties_action(p_operation text,p_id uuid default null,p_data jsonb default '{}'::jsonb)
returns jsonb language sql security definer set search_path='' as $function$
  select private.handover_cover_action(p_operation,p_id,coalesce(p_data,'{}'::jsonb))
$function$;
revoke all on function public.cover_duties_action(text,uuid,jsonb) from public,anon;
grant execute on function public.cover_duties_action(text,uuid,jsonb) to authenticated;

-- Keep the same shared task records in My Day and exclude tasks handed back from cover planning.
create or replace function private.myday_can_plan(p_task uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists(
    select 1 from public.actions a
    join public.profiles me on me.id=auth.uid() and me.active and me.company_id=a.company_id
    join public.profiles holder on holder.id=a.owner_id and holder.active and holder.company_id=a.company_id
    where a.id=p_task and a.deleted_at is null and a.purged_at is null and a.missed_at is null
      and (a.owner_id=me.id or exists(
        select 1 from public.work_handovers h
        where h.company_id=a.company_id and h.owner_id=a.owner_id and h.cover_id=me.id
          and h.status='approved' and h.deleted_at is null
          and (h.cover_response='accepted' or coalesce((select cover_visibility from private.handover_policy where company_id=h.company_id),'approval')='approval')
          and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=me.id),'Europe/London'))::date between h.starts_on and coalesce(h.ends_on,'infinity'::date)
          and exists(select 1 from private.handover_items i where i.handover_id=h.id and i.kind='task' and i.record_id=a.id and i.approved)
          and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=a.id and hb.status in ('pending','returned'))
      ))
  )
$function$;

create or replace function private.myday_cover_tasks()
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
    select a.id,a.title,a.status,a.due_date,a.due_at,a.due_time,a.priority,a.label,a.time_needed_minutes,
      case when a.source_kind='manual' then a.details else '' end as details,
      case when a.source_kind='manual' then a.steps else '[]'::jsonb end as steps,
      case when a.source_kind='manual' then a.links else '[]'::jsonb end as links,
      (a.source_kind<>'manual' and (a.source_url is not null or a.source_excerpt is not null)) as source_not_shared,
      d.name as department_name,p.full_name as owner_name,p.id as owner_id
    from public.actions a
    join public.profiles p on p.id=a.owner_id and p.active
    left join public.departments d on d.id=a.department_id
    where a.company_id=private.current_company_id() and a.deleted_at is null and a.status<>'done' and a.purged_at is null
      and exists(select 1 from public.work_handovers h where h.owner_id=a.owner_id and h.company_id=a.company_id and h.cover_id=auth.uid()
        and h.status='approved' and h.deleted_at is null
        and (h.cover_response='accepted' or coalesce((select cover_visibility from private.handover_policy where company_id=h.company_id),'approval')='approval')
        and exists(select 1 from private.handover_items hi where hi.handover_id=h.id and hi.record_id=a.id and hi.kind='task' and hi.approved)
        and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date between h.starts_on and coalesce(h.ends_on,'infinity'::date)
        and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=a.id and hb.status in ('pending','returned')))
    order by a.due_at,a.id limit 60
  )x
$function$;

-- Cover notices: in-app reminders use the same inbox consumed by the existing workspace notification UI.
create or replace function private.process_cover_duties_reminders()
returns integer language plpgsql security definer set search_path='' as $function$
declare h public.work_handovers; task_row record; day date; n integer:=0; kind text; recipient uuid; message text;
begin
  for h in select w.* from public.work_handovers w where w.deleted_at is null and w.status='approved' and w.cover_id is not null and w.cover_response<>'declined'
  loop
    day:=(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=h.cover_id),'Europe/London'))::date;
    for kind,recipient,message in
      select 'cover-start-tomorrow',h.cover_id,'Your cover starts tomorrow: '||h.title where h.starts_on=day+1 and h.cover_response in ('pending','accepted')
      union all
      select 'cover-start-today',h.cover_id,'Your cover starts today: '||h.title where h.starts_on=day and h.cover_response in ('pending','accepted')
    loop
      insert into private.handover_reminder_log(handover_id,kind,day) values(h.id,kind,day) on conflict do nothing;
      if found then insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,recipient,message); n:=n+1; end if;
    end loop;
    if h.cover_response='accepted' and day between h.starts_on and coalesce(h.ends_on,'infinity'::date) then
      for task_row in
        select a.id,a.title from private.handover_items hi join public.actions a on a.id=hi.record_id
        where hi.handover_id=h.id and hi.kind='task' and hi.approved and a.status<>'done' and a.deleted_at is null
          and a.due_date<day
          and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=a.id and hb.status in ('pending','returned'))
      loop
        insert into private.handover_reminder_log(handover_id,kind,day) values(h.id,'task-overdue:'||task_row.id::text,day) on conflict do nothing;
        if found then insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.cover_id,'Covered task is overdue: '||task_row.title); n:=n+1; end if;
      end loop;
    end if;
  end loop;
  return n;
end;
$function$;
revoke all on function private.process_cover_duties_reminders() from public,anon,authenticated,service_role;
select cron.schedule('cover-duties-notices','*/15 * * * *','select private.process_cover_duties_reminders()');

-- The task API remains a single source of truth. Only covered-task edit/status/tomorrow operations are widened.
do $patch$
declare s text; needle text; replacement text;
begin
  s:=pg_get_functiondef('private.myday_action(uuid,text,jsonb)'::regprocedure);
  needle:=' result:=private.myday_action_base(p_id,p_operation,p_data);';
  if strpos(s,needle)=0 then raise exception 'myday_action changed; review the cover task edit patch before applying'; end if;
  replacement:= $coverlogic$
 if p_operation in ('edit','status','tomorrow') and exists(
   select 1 from public.actions a join public.work_handovers h on h.owner_id=a.owner_id and h.company_id=a.company_id and h.cover_id=auth.uid()
   join private.handover_items hi on hi.handover_id=h.id and hi.record_id=a.id and hi.kind='task' and hi.approved
   where a.id=p_id and a.company_id=private.current_company_id() and a.owner_id<>auth.uid() and a.deleted_at is null and a.purged_at is null
     and h.status='approved' and h.cover_response='accepted' and h.deleted_at is null
     and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date between h.starts_on and coalesce(h.ends_on,'infinity'::date)
     and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=a.id and hb.status in ('pending','returned'))
 ) then
   select z.* into a from public.actions z where z.id=p_id and z.company_id=private.current_company_id() for update;
   if p_operation='status' and p_data->>'status'='done' then
     update public.actions set status='done',completed_at=now(),completion_note=case when p_data ? 'completion_note' then left(coalesce(p_data->>'completion_note',''),1000) else completion_note end,updated_at=now()
       where id=p_id and owner_id=a.owner_id and company_id=a.company_id and deleted_at is null;
     update private.handover_items set completed_by=auth.uid(),completed_at=coalesce(completed_at,now()) where record_id=p_id and kind='task' and handover_id in(select id from public.work_handovers where owner_id=a.owner_id and cover_id=auth.uid() and status='approved' and cover_response='accepted');
   elsif p_operation='tomorrow' then
     if nullif(p_data->>'date','') is null or (p_data->>'date')::date<(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date then
       raise check_violation using message='Choose today or a later date.';
     end if;
     update public.actions set due_date=(p_data->>'date')::date,reminder_sent_at=null,check_in_sent_at=null,overdue=false,updated_at=now() where id=p_id and owner_id=a.owner_id and company_id=a.company_id;
   else
     if p_data ? 'title' and length(btrim(coalesce(p_data->>'title','')))<1 then raise check_violation using message='Enter a task title.'; end if;
     update public.actions set
       title=case when p_data?'title' then btrim(p_data->>'title') else title end,
       details=case when p_data?'details' then left(p_data->>'details',6000) else details end,
       due_date=case when p_data?'due_date' then nullif(p_data->>'due_date','')::date else due_date end,
       due_time=case when p_data?'due_time' then nullif(p_data->>'due_time','')::time else due_time end,
       priority=case when p_data?'priority' and p_data->>'priority'=any(array['low','normal','high','urgent']) then p_data->>'priority' else priority end,
       steps=case when p_data?'steps' and jsonb_typeof(p_data->'steps')='array' then p_data->'steps' else steps end,
       links=case when p_data?'links' and jsonb_typeof(p_data->'links')='array' then p_data->'links' else links end,
       label=case when p_data?'label' then nullif(left(btrim(p_data->>'label'),80),'') else label end,
       time_needed_minutes=case when p_data?'time_needed_minutes' then greatest(1,least(1440,(p_data->>'time_needed_minutes')::integer)) else time_needed_minutes end,
       reminder_sent_at=null,check_in_sent_at=null,overdue=false,updated_at=now()
     where id=p_id and owner_id=a.owner_id and company_id=a.company_id;
   end if;
   insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(a.company_id,auth.uid(),'task',p_id,'cover_task_'||p_operation);
   return p_id;
 end if;
 result:=private.myday_action_base(p_id,p_operation,p_data);
$coverlogic$;
  s:=replace(s,needle,replacement);
  execute s;
end$patch$;

-- AI return drafting is allowed for the assigned cover only after the handover ends; source data stays limited to shared work.
do $ai_patch$
declare s text; needle text; replacement text;
begin
  s:=pg_get_functiondef('private.handover_ai_source(uuid,uuid,text)'::regprocedure);
  needle := $needle$if h.id is null or p_user<>h.owner_id and not(p_user=h.created_by and exists(select 1 from public.profiles pv join public.profiles po on po.id=h.owner_id where pv.id=p_user and pv.active and pv.company_id=po.company_id and (pv.role='hr_admin' or pv.role='manager' and pv.department_id=po.department_id))) or p_kind not in ('handover_draft','handover_return') then raise insufficient_privilege;end if;$needle$;
  if strpos(s,needle)=0 then raise exception 'handover_ai_source changed; review the cover summary AI extension before applying'; end if;
  replacement := $replacement$if h.id is null or p_user<>h.owner_id and not(p_user=h.created_by and exists(select 1 from public.profiles pv join public.profiles po on po.id=h.owner_id where pv.id=p_user and pv.active and pv.company_id=po.company_id and (pv.role='hr_admin' or pv.role='manager' and pv.department_id=po.department_id))) and not(p_user=h.cover_id and h.status='completed' and h.cover_response='accepted') or p_kind not in ('handover_draft','handover_return') then raise insufficient_privilege;end if;$replacement$;
  s:=replace(s,needle,replacement);

  needle := $needle$if p_kind='handover_return' then$needle$;
  if strpos(s,needle)=0 then raise exception 'handover return source changed'; end if;
  replacement := $replacement$
if p_kind='handover_return' and p_user=h.cover_id and h.status='completed' and h.cover_response='accepted' then
 return jsonb_build_object(
   'handover',h.sections-array['reason','note_for_manager','return_summary'],
   'completed_cover_work',coalesce((select jsonb_agg(jsonb_build_object('title',a.title,'completed_at',a.completed_at,'outcome',a.completion_note,'by_cover',hi.completed_by=h.cover_id)) from private.handover_items hi join public.actions a on a.id=hi.record_id and hi.kind='task' where hi.handover_id=h.id and a.status='done'),'[]'),
   'decisions_made',coalesce((select jsonb_agg(jsonb_build_object('title',n.title,'why',n.body,'date',n.created_at)) from private.handover_cover_notes n where n.handover_id=h.id and n.note_type='decision'),'[]'),
   'notes_for_owner',coalesce((select jsonb_agg(jsonb_build_object('title',n.title,'body',n.body,'date',n.created_at)) from private.handover_cover_notes n where n.handover_id=h.id and n.note_type='note'),'[]'),
   'handed_back',coalesce((select jsonb_agg(jsonb_build_object('task',a.title,'reason',hb.reason,'status',hb.status)) from private.handover_task_handbacks hb join public.actions a on a.id=hb.task_id where hb.handover_id=h.id),'[]')
 )::text;
end if;
if p_kind='handover_return' then
$replacement$;
  s:=replace(s,needle,replacement);
  execute s;
end$ai_patch$;


-- A request must be authorised before a cover can see the full snapshot through the legacy handover route.
create or replace function private.handover_authorized(h public.work_handovers,p_write boolean default false)
returns boolean language sql stable security definer set search_path='' as $function$
 select exists(
  select 1 from public.profiles p
  where p.id=auth.uid() and p.active and p.company_id=h.company_id
   and (
    p.id=h.owner_id
    or p.id=h.created_by and p.role in('manager','hr_admin') and private.can_read_role(h.owner_id)
    or not p_write and (
      p.role='hr_admin'
      or p.id=h.reviewer_id and p.role in('manager','hr_admin')
      or p.id=h.cover_id and h.deleted_at is null and (
        h.cover_response='accepted' and h.status in('pending','approved','completed')
        or coalesce((select cover_visibility='approval' from private.handover_policy where company_id=h.company_id),false) and h.status in('approved','completed')
      )
    )
   )
 )
$function$;

-- Notify the assigned cover at the same time the manager is notified that approval is needed.
do $cover_notice_patch$
declare s text; needle text; replacement text;
begin
 s:=pg_get_functiondef('private.handover_workspace(text,uuid,jsonb)'::regprocedure);
 needle:=$needle$insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'Handover ready for review');$needle$;
 if strpos(s,needle)=0 then raise exception 'Handover submit notification changed; review cover request notification patch'; end if;
 replacement:=needle||E'\n insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.cover_id,''You have a cover request to review'');';
 s:=replace(s,needle,replacement);
 execute s;
end$cover_notice_patch$;

-- Upcoming/overdue task reminders follow the active cover assignment instead of continuing to notify the owner.
create or replace function private.work_reminder_rows(p_timezone text)
returns table(notification_key text,source_kind text,source_id uuid,title text,due_date date,stage text,section text)
language plpgsql stable security definer set search_path='' as $function$
declare viewer public.profiles; today date;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Notifications are not available'; end if;
 if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 today:=(now() at time zone p_timezone)::date;
 return query with candidates as (
  select 'task'::text kind,a.id,a.title,a.due_date,null::text section
  from public.actions a
  where a.owner_id=viewer.id and a.company_id=viewer.company_id and a.status<>'done'
   and a.deleted_at is null and a.purged_at is null and a.due_date<=today+3
   and not exists(
    select 1 from public.work_handovers h
    join private.handover_items hi on hi.handover_id=h.id and hi.kind='task' and hi.record_id=a.id and hi.approved
    where h.company_id=a.company_id and h.owner_id=a.owner_id and h.cover_id<>h.owner_id
     and h.status='approved' and h.cover_response='accepted' and h.deleted_at is null
     and today between h.starts_on and coalesce(h.ends_on,'infinity'::date)
     and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=a.id and hb.status in('pending','returned'))
   )
  union all
  select 'task'::text,a.id,a.title,a.due_date,null::text
  from public.actions a
  join public.work_handovers h on h.owner_id=a.owner_id and h.company_id=a.company_id
  join private.handover_items hi on hi.handover_id=h.id and hi.kind='task' and hi.record_id=a.id and hi.approved
  where h.cover_id=viewer.id and h.status='approved' and h.cover_response='accepted' and h.deleted_at is null
   and today between h.starts_on and coalesce(h.ends_on,'infinity'::date)
   and a.status<>'done' and a.deleted_at is null and a.purged_at is null and a.due_date<=today+3
   and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=a.id and hb.status in('pending','returned'))
  union all
  select 'role_item'::text,r.id,r.title,r.due_date,r.kind
  from public.role_items r
  where r.owner_id=viewer.id and r.company_id=viewer.company_id and r.kind in('responsibility','recurring_deadline') and r.deleted_at is null and r.due_date<=today+3
 ), classified as (
  select c.*,case when c.due_date<today then 'overdue' when c.due_date=today then 'today' else 'approaching' end phase from candidates c
 )
 select c.kind||':'||c.id::text||':'||c.due_date::text||':'||c.phase,c.kind,c.id,c.title,c.due_date,c.phase,c.section from classified c;
end$function$;

-- The "move to today" shortcut is also allowed for the current, accepted cover assignment.
do $cover_tomorrow_patch$
declare s text; needle text; replacement text;
begin
 s:=pg_get_functiondef('private.myday_action(uuid,text,jsonb)'::regprocedure);
 needle:=$needle$select * into a
   from public.actions
   where id=p_id and owner_id=auth.uid() and company_id=private.current_company_id()
   for update;$needle$;
 if strpos(s,needle)=0 then raise exception 'myday_action today shortcut changed; review cover edit permission patch'; end if;
 replacement:=$replacement$select * into a
   from public.actions
   where id=p_id and company_id=private.current_company_id()
     and (owner_id=auth.uid() or exists(
       select 1 from public.work_handovers h
       join private.handover_items hi on hi.handover_id=h.id and hi.kind='task' and hi.record_id=p_id and hi.approved
       where h.owner_id=public.actions.owner_id and h.company_id=public.actions.company_id and h.cover_id=auth.uid()
        and h.status='approved' and h.cover_response='accepted' and h.deleted_at is null
        and (now() at time zone coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London'))::date between h.starts_on and coalesce(h.ends_on,'infinity'::date)
        and not exists(select 1 from private.handover_task_handbacks hb where hb.handover_id=h.id and hb.task_id=p_id and hb.status in('pending','returned'))
     ))
   for update;$replacement$;
 s:=replace(s,needle,replacement);
 execute s;
end$cover_tomorrow_patch$;

-- Authenticated users may submit a question to a non-expired, non-revoked outside-cover link.
create or replace function public.handover_share_question(p_token text,p_body text,p_email text default '')
returns jsonb language plpgsql security definer set search_path='' as $function$
declare sh private.handover_shares; h public.work_handovers; body text:=btrim(coalesce(p_body,'')); who text:=left(btrim(coalesce(p_email,'')),320);
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' or length(body) not between 1 and 3000 then raise invalid_parameter_value; end if;
 select * into sh from private.handover_shares where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and revoked_at is null and expires_at>now();
 if not found then raise insufficient_privilege; end if;
 select * into h from public.work_handovers where id=sh.handover_id and deleted_at is null;
 if not found then raise insufficient_privilege; end if;
 insert into private.handover_external_questions(share_id,handover_id,company_id,sender_email,body) values(sh.id,h.id,h.company_id,who,body);
 insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.owner_id,'A question was sent about your shared handover.');
 if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'A question was sent about a shared handover.'); end if;
 perform private.handover_event(h.id,'external_question_asked');
 return jsonb_build_object('ok',true);
end$function$;
revoke all on function public.handover_share_question(text,text,text) from public,anon;
grant execute on function public.handover_share_question(text,text,text) to anon,authenticated;





-- Questions from an outside-cover link can be answered by the owner or authorised manager.
alter table private.handover_external_questions
  add column if not exists response text not null default '' check(length(response)<=3000),
  add column if not exists replied_by uuid references public.profiles(id),
  add column if not exists replied_at timestamptz;

create or replace function private.handover_shared(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare sh private.handover_shares; questions_json jsonb;
begin
 select shares.* into sh
 from private.handover_shares shares
 join public.work_handovers h on h.id=shares.handover_id
 join private.handover_policy policy on policy.company_id=h.company_id and policy.external_sharing
 where shares.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
   and length(coalesce(p_token,''))=64 and shares.revoked_at is null and shares.expires_at>now()
   and h.deleted_at is null and h.status in('approved','completed');
 if not found then return null; end if;
 insert into private.handover_share_views(share_id) values(sh.id);
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'body',q.body,'sender_email',q.sender_email,'response',q.response,
   'created_at',q.created_at,'replied_at',q.replied_at
 ) order by q.created_at),'[]'::jsonb)
 into questions_json from private.handover_external_questions q where q.share_id=sh.id;
 return sh.snapshot||jsonb_build_object('external_questions',questions_json);
end$function$;
revoke all on function private.handover_shared(text) from public,anon,authenticated,service_role;

create or replace function public.handover_external_questions_action(
 p_operation text,p_id uuid,p_data jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare u uuid:=auth.uid(); c uuid:=private.current_company_id(); me public.profiles; h public.work_handovers; q private.handover_external_questions; body text;
begin
 if u is null or c is null then raise insufficient_privilege; end if;
 select * into me from public.profiles where id=u and active and company_id=c;
 if not found then raise insufficient_privilege; end if;
 select * into h from public.work_handovers where id=p_id and company_id=c and deleted_at is null and status in('approved','completed');
 if not found or not (u=h.owner_id or u=h.reviewer_id and me.role in('manager','hr_admin') or me.role='manager' and private.can_read_role(h.owner_id)) then raise insufficient_privilege; end if;
 if p_operation='list' then
   return coalesce((select jsonb_agg(jsonb_build_object(
     'id',q.id,'sender_email',q.sender_email,'body',q.body,'response',q.response,
     'created_at',q.created_at,'replied_at',q.replied_at,
     'reply_author',coalesce(p.full_name,'')
   ) order by q.created_at desc)
   from private.handover_external_questions q left join public.profiles p on p.id=q.replied_by
   where q.handover_id=h.id and q.company_id=c),'[]'::jsonb);
 elsif p_operation='reply' then
   body:=btrim(coalesce(p_data->>'response',''));
   if length(body) not between 1 and 3000 then raise check_violation using message='Write a short answer before sending.'; end if;
   update private.handover_external_questions set response=body,replied_by=u,replied_at=now()
   where id=nullif(p_data->>'question_id','')::uuid and handover_id=h.id and company_id=c;
   if not found then raise check_violation using message='That outside-cover question could not be found.'; end if;
   insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.owner_id,'An answer was added to an outside-cover question.');
   if h.reviewer_id is not null and h.reviewer_id<>h.owner_id then
     insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'An answer was added to an outside-cover question.');
   end if;
   perform private.handover_event(h.id,'external_question_answered');
   return coalesce((select jsonb_agg(jsonb_build_object(
     'id',q.id,'sender_email',q.sender_email,'body',q.body,'response',q.response,
     'created_at',q.created_at,'replied_at',q.replied_at,
     'reply_author',coalesce(p.full_name,'')
   ) order by q.created_at desc)
   from private.handover_external_questions q left join public.profiles p on p.id=q.replied_by
   where q.handover_id=h.id and q.company_id=c),'[]'::jsonb);
 else
   raise invalid_parameter_value using message='Unknown outside-cover question action.';
 end if;
end$function$;
revoke all on function public.handover_external_questions_action(text,uuid,jsonb) from public,anon;
grant execute on function public.handover_external_questions_action(text,uuid,jsonb) to authenticated;


-- The return action ends cover and informs both the cover person and manager.
do $cover_return_notice_patch$
declare s text; needle text; replacement text;
begin
 s:=pg_get_functiondef('private.handover_workspace(text,uuid,jsonb)'::regprocedure);
 needle := $needle$insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.cover_id,'Handover completed');$needle$;
 if strpos(s,needle)=0 then raise exception 'Handover take-back notification changed; review return-notification patch'; end if;
 replacement := $replacement$insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.cover_id,'The owner has returned. Your cover has ended.');
 if h.reviewer_id is not null then
   insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'The owner returned and the cover has ended.');
 end if;$replacement$;
 s:=replace(s,needle,replacement);
 execute s;
end$cover_return_notice_patch$;
