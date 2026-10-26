-- Completion of the approved My Day brief. Private task bodies keep their existing owner RLS.
create table private.myday_company_options(company_id uuid primary key references public.companies(id) on delete cascade,flags jsonb not null default '{"ai":true,"email":true,"push":true,"team":true,"rules":true,"templates":true,"calendar":true,"write_gmail":false,"write_outlook":false,"write_slack":false,"write_teams":false,"write_trello":false}'::jsonb);
create table private.myday_personal_options(owner_id uuid primary key references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,settings jsonb not null default '{"language":"en-GB","date_style":"medium","work_start":"09:00","work_end":"17:00","quiet_start":"22:00","quiet_end":"08:00","briefing":false,"digest":false,"push":false}'::jsonb,calendar_hash text unique,calendar_enabled boolean not null default false);
create table private.myday_templates(id uuid primary key default gen_random_uuid(),owner_id uuid not null,company_id uuid not null references public.companies(id) on delete cascade,shared boolean not null default false,title text not null check(length(btrim(title)) between 1 and 300),data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table private.myday_rules(id uuid primary key default gen_random_uuid(),owner_id uuid not null,company_id uuid not null references public.companies(id) on delete cascade,shared boolean not null default false,title text not null check(length(btrim(title)) between 1 and 120),trigger_event text not null check(trigger_event in ('capture_draft','overdue','done')),source_type text not null default '',after_days integer not null default 0 check(after_days between 0 and 365),effects jsonb not null,enabled boolean not null default true,created_at timestamptz not null default now());
create table private.myday_rule_runs(rule_id uuid not null references private.myday_rules(id) on delete cascade,subject_id uuid not null,cycle text not null,created_at timestamptz not null default now(),primary key(rule_id,subject_id,cycle));
create table private.myday_assignments(id uuid primary key,company_id uuid not null references public.companies(id) on delete cascade,creator_id uuid not null references public.profiles(id),recipient_id uuid not null references public.profiles(id),source_task uuid references public.actions(id) on delete set null,recipient_task uuid references public.actions(id) on delete set null,title text not null check(length(btrim(title)) between 1 and 300),details text not null default '' check(length(details)<=5000),due_date date,status text not null default 'pending' check(status in ('pending','accepted','declined','returned','cancelled')),suggested_date date,nudged_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table private.myday_collaborators(task_id uuid not null references public.actions(id) on delete cascade,profile_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,primary key(task_id,profile_id));
create table private.myday_comments(id uuid primary key,task_id uuid not null references public.actions(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,author_id uuid not null references public.profiles(id),body text not null check(length(btrim(body)) between 1 and 5000),private_note boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table private.myday_notifications(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,task_id uuid,assignment_id uuid,title text not null,body text not null default '',read_at timestamptz,created_at timestamptz not null default now());
create table private.myday_repeats(id uuid primary key,owner_id uuid not null references public.profiles(id),company_id uuid not null references public.companies(id) on delete cascade,task_id uuid not null references public.actions(id),current_task uuid references public.actions(id),frequency text not null check(frequency in ('daily','weekdays','weekly','monthly','custom')),every_n integer not null default 1 check(every_n between 1 and 365),unit text not null default 'day' check(unit in ('day','week','month')),anchor date not null,next_date date not null,active boolean not null default true,template jsonb not null,created_at timestamptz not null default now());
create table private.myday_files(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.actions(id) on delete cascade,owner_id uuid not null references public.profiles(id),company_id uuid not null references public.companies(id) on delete cascade,name text not null check(length(name) between 1 and 200),path text not null unique,created_at timestamptz not null default now());
create table private.myday_push(owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,endpoint text primary key,subscription jsonb not null,created_at timestamptz not null default now());
create table private.myday_ai_cache(owner_id uuid not null references public.profiles(id) on delete cascade,kind text not null,fingerprint text not null,output text not null,created_at timestamptz not null default now(),primary key(owner_id,kind,fingerprint));
create table private.myday_delivery_jobs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,company_id uuid not null references public.companies(id) on delete cascade,kind text not null check(kind in ('briefing','digest','push')),day date not null,notification_id uuid,unique_key text not null unique,state text not null default 'pending' check(state in ('pending','claimed','sent','failed','uncertain','cancelled')),claimed_at timestamptz,created_at timestamptz not null default now());
create table private.myday_source_updates(id uuid primary key,owner_id uuid not null references public.profiles(id),company_id uuid not null references public.companies(id) on delete cascade,task_id uuid not null references public.actions(id),provider text not null,operation text not null,body text not null,state text not null default 'pending' check(state in ('pending','sent','failed','uncertain')),created_at timestamptz not null default now());
create table private.myday_import_rows(owner_id uuid not null,company_id uuid not null references public.companies(id) on delete cascade,row_hash text not null,task_id uuid not null references public.actions(id),primary key(owner_id,company_id,row_hash));
alter table private.myday_import_rows enable row level security;
revoke all on private.myday_import_rows from public,anon,authenticated,service_role;
alter table private.myday_undo add column repeat_state jsonb;
alter table public.actions add column missed_at timestamptz,add column purged_at timestamptz;
-- No direct API access to collaboration, endpoint capabilities or private configuration.
do $$declare t text;begin foreach t in array array['myday_company_options','myday_personal_options','myday_templates','myday_rules','myday_rule_runs','myday_assignments','myday_collaborators','myday_comments','myday_notifications','myday_repeats','myday_files','myday_push','myday_ai_cache','myday_delivery_jobs','myday_source_updates'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);end loop;end$$;
create index myday_assignments_recipient_idx on private.myday_assignments(recipient_id,status,created_at);
create index myday_notifications_owner_idx on private.myday_notifications(owner_id,created_at);
create index myday_comments_task_idx on private.myday_comments(task_id,created_at);
create index myday_repeats_due_idx on private.myday_repeats(next_date) where active;
create function private.myday_enabled(c uuid,k text) returns boolean language sql stable security definer set search_path='' as $$select coalesce((select (flags->>k)::boolean from private.myday_company_options where company_id=c),case when k like 'write_%' then false else true end)$$;
revoke all on function private.myday_enabled(uuid,text) from public,anon,authenticated,service_role;
create function private.myday_task_participant(t uuid,u uuid,c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.actions where id=t and company_id=c and purged_at is null and owner_id=u) or exists(select 1 from private.myday_collaborators where task_id=t and profile_id=u and company_id=c) or exists(select 1 from private.myday_assignments where company_id=c and recipient_task=t and status='accepted' and u in(creator_id,recipient_id))$$;
revoke all on function private.myday_task_participant(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function private.myday_notify(u uuid,c uuid,t uuid,a uuid,title text,body text default '') returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare n uuid;begin
 if not exists(select 1 from public.profiles where id=u and company_id=c and active) then return;end if;
 insert into private.myday_notifications(owner_id,company_id,task_id,assignment_id,title,body) values(u,c,t,a,title,left(body,1000)) returning id into n;
 if private.myday_enabled(c,'push') and coalesce((select (settings->>'push')::boolean from private.myday_personal_options where owner_id=u),false) then insert into private.myday_delivery_jobs(owner_id,company_id,kind,day,notification_id,unique_key) values(u,c,'push',(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London'))::date,n,'push:'||n::text);end if;
end$$;
revoke all on function private.myday_notify(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function private.myday_next_date(d date,f text,n integer,unit text,anchor date) returns date language plpgsql immutable set search_path='' as $$
#variable_conflict use_column
declare result date;first_day date;begin
 if f='monthly' or f='custom' and unit='month' then first_day:=(date_trunc('month',d)+(case when f='monthly' then 1 else n end)*interval '1 month')::date;return first_day+least(extract(day from anchor)::int,extract(day from (first_day+interval '1 month - 1 day'))::int)-1;end if;
 result:=d+case when f='weekly' then 7 when f='custom' and unit='week' then n*7 when f='custom' then n else 1 end;
 if f='weekdays' then while extract(isodow from result)>5 loop result:=result+1;end loop;end if;return result;
end$$;
revoke all on function private.myday_next_date(date,text,integer,text,date) from public,anon,authenticated,service_role;
create function private.myday_manager(member uuid,company uuid) returns uuid language sql stable security definer set search_path='' as $$select coalesce((select manager_id from public.role_profiles where holder_id=member and company_id=company and manager_id is not null order by created_at,id limit 1),(select d.manager_id from public.profiles p join public.departments d on d.id=p.department_id and d.company_id=company where p.id=member and p.company_id=company and d.archived_at is null))$$;
create function private.myday_reports_to(member uuid,manager uuid,company uuid) returns boolean language sql stable security definer set search_path='' as $$select member<>manager and (exists(select 1 from public.role_profiles where holder_id=member and company_id=company and manager_id=manager) or not exists(select 1 from public.role_profiles where holder_id=member and company_id=company and manager_id is not null) and exists(select 1 from public.profiles p join public.departments d on d.id=p.department_id where p.id=member and p.company_id=company and d.company_id=company and d.manager_id=manager and d.archived_at is null))$$;
revoke all on function private.myday_manager(uuid,uuid),private.myday_reports_to(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function private.myday_suite(p_operation text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare u uuid:=auth.uid();c uuid:=private.current_company_id();me public.profiles;a public.actions;assigned private.myday_assignments;template private.myday_templates;rule private.myday_rules;comment private.myday_comments;v jsonb;target uuid;token text;tz text;today date;shared boolean;recipient public.profiles;row_id uuid;row_key text;added int:=0;duplicates int:=0;task_status text;begin
 if u is null or c is null then raise insufficient_privilege;end if;
 select * into me from public.profiles where id=u and company_id=c and active;if not found then raise insufficient_privilege;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>(case when p_operation='import' then 2500000 else 150000 end) then raise invalid_parameter_value;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 if p_operation='notifications' then
  return jsonb_build_object('unread',(select count(*) from private.myday_notifications where owner_id=u and company_id=c and read_at is null),'rows',coalesce((select jsonb_agg(to_jsonb(q) order by created_at desc) from(select id,title,body,task_id,assignment_id,created_at from private.myday_notifications where owner_id=u and company_id=c and read_at is null order by created_at desc limit 100)q),'[]'::jsonb));
 elsif p_operation='overview' then
 return jsonb_build_object('briefing',(select jsonb_build_object('body',output,'created_at',created_at) from private.myday_ai_cache where owner_id=u and kind='day_briefing' and (created_at at time zone tz)::date=today order by created_at desc limit 1),'settings',coalesce((select settings from private.myday_personal_options where owner_id=u),'{"language":"en-GB","date_style":"medium","work_start":"09:00","work_end":"17:00","quiet_start":"22:00","quiet_end":"08:00","briefing":false,"digest":false,"push":false}'::jsonb),'flags',coalesce((select flags from private.myday_company_options where company_id=c),'{"ai":true,"email":true,"push":true,"team":true,"rules":true,"templates":true,"calendar":true,"write_gmail":false,"write_outlook":false,"write_slack":false,"write_teams":false,"write_trello":false}'::jsonb),
 'incoming',coalesce((select jsonb_agg(to_jsonb(q) order by created_at desc) from(select r.id,r.title,r.details,r.due_date,r.suggested_date,r.status,r.created_at,p.full_name as creator_name from private.myday_assignments r join public.profiles p on p.id=r.creator_id where r.recipient_id=u and r.company_id=c and r.status='pending' order by r.created_at desc limit 100)q),'[]'::jsonb),
 'waiting',coalesce((select jsonb_agg(to_jsonb(q)) from(select r.id,r.title,r.due_date,r.suggested_date,r.status,r.recipient_task,p.full_name as recipient_name,coalesce(a.status,'open') as task_status from private.myday_assignments r join public.profiles p on p.id=r.recipient_id left join public.actions a on a.id=r.recipient_task where r.creator_id=u and r.company_id=c and r.status in('pending','accepted') and (a.id is null or a.status<>'done' and a.deleted_at is null) order by r.created_at desc limit 100)q),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(to_jsonb(q)) from(select id,title,body,task_id,assignment_id,created_at,read_at from private.myday_notifications where owner_id=u and company_id=c and read_at is null order by created_at desc limit 100)q),'[]'::jsonb),
 'away',coalesce((select jsonb_agg(jsonb_build_object('id',id,'starts_on',starts_on,'status',status)) from public.work_handovers where owner_id=u and company_id=c and starts_on between today and today+30 and status in('draft','changes_requested')),'[]'::jsonb),
 'calendar_enabled',coalesce((select calendar_enabled from private.myday_personal_options where owner_id=u),false));
 elsif p_operation='preferences' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in('language','date_style','work_start','work_end','quiet_start','quiet_end','briefing','digest','push')) or coalesce(p_data->>'date_style','medium') not in('short','medium','long') or coalesce(p_data->>'language','en-GB') not in('en-GB','en-US','fr-FR','de-DE','es-ES','pt-BR') then raise invalid_parameter_value;end if;
  perform nullif(p_data->>'work_start','')::time;perform nullif(p_data->>'work_end','')::time;perform nullif(p_data->>'quiet_start','')::time;perform nullif(p_data->>'quiet_end','')::time;
  perform (p_data->>'briefing')::boolean;perform(p_data->>'digest')::boolean;perform(p_data->>'push')::boolean;
  insert into private.myday_personal_options(owner_id,company_id,settings) values(u,c,p_data) on conflict(owner_id) do update set settings=private.myday_personal_options.settings||excluded.settings;return '{}'::jsonb;
 elsif p_operation='company' then
  if me.role<>'hr_admin' then raise insufficient_privilege;end if;
  if exists(select 1 from jsonb_each(p_data) e where e.key not in('ai','email','push','team','rules','templates','calendar','write_gmail','write_outlook','write_slack','write_teams','write_trello') or jsonb_typeof(e.value)<>'boolean') then raise invalid_parameter_value;end if;
  insert into private.myday_company_options(company_id) values(c) on conflict do nothing;update private.myday_company_options set flags=flags||p_data where company_id=c;return '{}'::jsonb;
 elsif p_operation in('people','mention_people') then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role)) from (select id,full_name,role from public.profiles where company_id=c and active and (p_operation='mention_people' or me.role='hr_admin' or id=u or me.role='manager' and private.myday_reports_to(id,u,c)) and strpos(lower(full_name),lower(coalesce(p_data->>'query','')))>0 order by full_name limit 100)q),'[]'::jsonb);
 elsif p_operation='team' then
  if me.role not in('manager','hr_admin') or not private.myday_enabled(c,'team') then raise insufficient_privilege;end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'today',(select count(*) from public.actions a where a.owner_id=p.id and a.company_id=c and a.deleted_at is null and a.purged_at is null and a.missed_at is null and a.status<>'done' and (a.due_date=(now() at time zone coalesce(w.timezone,'Europe/London'))::date or a.pinned_at is not null)),'overdue',(select count(*) from public.actions a where a.owner_id=p.id and a.company_id=c and a.deleted_at is null and a.purged_at is null and a.missed_at is null and a.status<>'done' and a.due_at<now()),'waiting',(select count(*) from private.myday_assignments r where r.creator_id=p.id and r.status in('pending','accepted')),'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'due_date',a.due_date)) from(select id,title,status,due_date from public.actions where owner_id=p.id and company_id=c and deleted_at is null and purged_at is null and missed_at is null and status<>'done' order by due_at nulls last,id limit 100)a),'[]'::jsonb),'cover',coalesce((select jsonb_agg(jsonb_build_object('name',cover.full_name,'from',h.starts_on,'until',h.ends_on)) from public.work_handovers h join public.profiles cover on cover.id=h.cover_id where h.owner_id=p.id and h.company_id=c and h.status='approved' and today between h.starts_on and h.ends_on),'[]'::jsonb)) order by p.full_name) from public.profiles p left join public.work_preferences w on w.owner_id=p.id where p.company_id=c and p.active and private.myday_reports_to(p.id,u,c)),'[]'::jsonb);
 elsif p_operation='ai_source' then
  if not private.myday_enabled(c,'ai') then raise insufficient_privilege;end if;
  if p_data->>'kind'='conversation_summary' then
   return to_jsonb((select left(cp.source_text,15000) from public.actions a join public.captures cp on cp.id=a.capture_id and cp.owner_id=u where a.id=p_id and a.owner_id=u and a.company_id=c and a.purged_at is null));
  end if;
  return jsonb_build_object('today',today,'timezone',tz,'working_hours',coalesce((select settings from private.myday_personal_options where owner_id=u),'{}'::jsonb),'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',left(title,160),'due_date',due_date,'due_time',due_time,'starred',pinned_at is not null,'time_needed_minutes',time_needed_minutes,'status',status)) from(select * from public.actions where owner_id=u and company_id=c and status<>'done' and deleted_at is null and purged_at is null and missed_at is null order by (pinned_at is not null) desc,due_at nulls last,created_at,id limit 40)q),'[]'::jsonb));
 elsif p_operation='ai_cache_get' then
  if not private.myday_enabled(c,'ai') then raise insufficient_privilege;end if;
  return (select to_jsonb(output) from private.myday_ai_cache where owner_id=u and kind=p_data->>'kind' and fingerprint=p_data->>'fingerprint');
 elsif p_operation='ai_cache_save' then
  if p_data->>'kind' not in('day_plan','day_briefing','conversation_summary') or length(p_data->>'fingerprint')<>64 or length(p_data->>'output')>16000 or not private.myday_enabled(c,'ai') then raise invalid_parameter_value;end if;
  insert into private.myday_ai_cache(owner_id,kind,fingerprint,output) values(u,p_data->>'kind',p_data->>'fingerprint',p_data->>'output') on conflict(owner_id,kind,fingerprint) do nothing;return '{}'::jsonb;
 elsif p_operation='plan_accept' then
  if not private.myday_enabled(c,'ai') or jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items')>100 then raise invalid_parameter_value;end if;
  for v in select value from jsonb_array_elements(p_data->'items') loop
   target:=(v->>'id')::uuid;
   if not exists(select 1 from public.actions where id=target and owner_id=u and company_id=c and deleted_at is null and purged_at is null and missed_at is null and status<>'done') then raise insufficient_privilege;end if;
  end loop;
  for v in select value||jsonb_build_object('position',ordinality) from jsonb_array_elements(p_data->'items') with ordinality loop
   update public.actions set metadata=metadata||jsonb_build_object('plan_day',today,'plan_order',(v->>'position')::int,'plan_reason',left(coalesce(v->>'reason',''),300)) where id=(v->>'id')::uuid;
   insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status) select id,u,c,u,'plan_accepted',status from public.actions where id=(v->>'id')::uuid;
  end loop;return '{}'::jsonb;
 elsif p_operation='templates' then
  if not private.myday_enabled(c,'templates') then return '[]'::jsonb;end if;
  return coalesce((select jsonb_agg(to_jsonb(q)) from(select id,title,data,shared,owner_id from private.myday_templates where company_id=c and (owner_id=u or shared) and strpos(lower(title),lower(coalesce(p_data->>'query','')))>0 order by title limit 100)q),'[]'::jsonb);
 elsif p_operation='template_save' then
  if not private.myday_enabled(c,'templates') then raise insufficient_privilege;end if;
  shared:=coalesce((p_data->>'shared')::boolean,false);if shared and me.role<>'hr_admin' then raise insufficient_privilege;end if;
  if exists(select 1 from private.myday_templates where id=p_id and not(owner_id=u and company_id=c)) then raise insufficient_privilege;end if;
  if jsonb_typeof(coalesce(p_data->'data','{}'::jsonb))<>'object' or exists(select 1 from jsonb_object_keys(coalesce(p_data->'data','{}'::jsonb)) k where k not in('details','steps','label','time_needed_minutes')) or length(coalesce(p_data->'data'->>'label',''))>80 or nullif(p_data->'data'->>'time_needed_minutes','')::int not in(15,30,60,120) then raise invalid_parameter_value;end if;
  if length(coalesce(p_data->'data'->>'details',''))>5000 or jsonb_typeof(coalesce(p_data->'data'->'steps','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_data->'data'->'steps','[]'::jsonb))>100 or exists(select 1 from jsonb_array_elements(coalesce(p_data->'data'->'steps','[]')) step where jsonb_typeof(step)<>'string' or length(step#>>'{}')>1000) then raise invalid_parameter_value;end if;
  insert into private.myday_templates(id,owner_id,company_id,title,shared,data) values(p_id,u,c,p_data->>'title',shared,coalesce(p_data->'data','{}')) on conflict(id) do update set title=excluded.title,shared=excluded.shared,data=excluded.data,updated_at=now();return to_jsonb(p_id);
 elsif p_operation='template_delete' then
  delete from private.myday_templates where id=p_id and owner_id=u and company_id=c and (not shared or me.role='hr_admin');if not found then raise insufficient_privilege;end if;return '{}'::jsonb;
 elsif p_operation='template_use' then
  select * into template from private.myday_templates where id=p_id and company_id=c and (owner_id=u or shared);if not found or not private.myday_enabled(c,'templates') then raise insufficient_privilege;end if;
  target:=(p_data->>'task_id')::uuid;perform private.myday_action(target,'create',template.data||jsonb_build_object('title',template.title,'due_date',coalesce(p_data->>'due_date',today::text)));return to_jsonb(target);
 elsif p_operation='rules' then
  return coalesce((select jsonb_agg(to_jsonb(r)) from private.myday_rules r where company_id=c and (owner_id=u or shared)),'[]'::jsonb);
 elsif p_operation='rule_save' then
  if not private.myday_enabled(c,'rules') then raise insufficient_privilege;end if;
  shared:=coalesce((p_data->>'shared')::boolean,false);if shared and me.role<>'hr_admin' then raise insufficient_privilege;end if;
  if exists(select 1 from private.myday_rules where id=p_id and not(owner_id=u and company_id=c)) then raise insufficient_privilege;end if;
  if jsonb_typeof(p_data->'effects')<>'array' or jsonb_array_length(p_data->'effects') not between 1 and 5 or exists(select 1 from jsonb_array_elements(p_data->'effects') e where jsonb_typeof(e)<>'object' or coalesce(e->>'kind','') not in('label','remind','notify','notify_manager','owner') or length(coalesce(e->>'value',''))>100) then raise invalid_parameter_value;end if;
  if exists(select 1 from jsonb_array_elements(p_data->'effects') e where e->>'kind'='owner') and me.role not in('hr_admin','manager') then raise insufficient_privilege;end if;
  if exists(select 1 from jsonb_array_elements(p_data->'effects') e where e->>'kind'='owner' and coalesce(e->>'value','')!~'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$') then raise invalid_parameter_value;end if;
  insert into private.myday_rules(id,owner_id,company_id,title,shared,trigger_event,source_type,after_days,effects,enabled) values(p_id,u,c,p_data->>'title',shared,p_data->>'trigger_event',coalesce(p_data->>'source_type',''),coalesce((p_data->>'after_days')::int,0),p_data->'effects',coalesce((p_data->>'enabled')::boolean,true)) on conflict(id) do update set title=excluded.title,shared=excluded.shared,trigger_event=excluded.trigger_event,source_type=excluded.source_type,after_days=excluded.after_days,effects=excluded.effects,enabled=excluded.enabled;return to_jsonb(p_id);
 elsif p_operation='rule_delete' then delete from private.myday_rules where id=p_id and owner_id=u and company_id=c and (not shared or me.role='hr_admin');if not found then raise insufficient_privilege;end if;return '{}'::jsonb;
 elsif p_operation='assign' then
  select * into recipient from public.profiles where id=(p_data->>'recipient_id')::uuid and company_id=c and active and id<>u;
  if not found or not(me.role='hr_admin' or me.role='manager' and private.myday_reports_to(recipient.id,u,c)) then raise insufficient_privilege;end if;
  if nullif(p_data->>'source_task','') is not null and not exists(select 1 from public.actions where id=(p_data->>'source_task')::uuid and owner_id=u and company_id=c and deleted_at is null and purged_at is null) then raise insufficient_privilege;end if;
  insert into private.myday_assignments(id,company_id,creator_id,recipient_id,source_task,title,details,due_date) values(p_id,c,u,recipient.id,nullif(p_data->>'source_task','')::uuid,p_data->>'title',coalesce(p_data->>'details',''),nullif(p_data->>'due_date','')::date) on conflict(id) do nothing;
  if not exists(select 1 from private.myday_assignments where id=p_id and creator_id=u and company_id=c) then raise insufficient_privilege;end if;
  perform private.myday_notify(recipient.id,c,null,p_id,'New task to review',p_data->>'title');return to_jsonb(p_id);
 elsif p_operation in('accept','decline','suggest_date','hand_back','nudge','cancel_assignment') then
  select * into assigned from private.myday_assignments where id=p_id and company_id=c and u in(creator_id,recipient_id) for update;if not found then raise insufficient_privilege;end if;
  if p_operation='nudge' then
   if assigned.creator_id<>u or assigned.status not in('pending','accepted') then raise insufficient_privilege;end if;
   if assigned.nudged_at>now()-interval '1 day' then raise exception 'You can nudge once a day' using errcode='22023';end if;
   update private.myday_assignments set nudged_at=now() where id=p_id;perform private.myday_notify(assigned.recipient_id,c,assigned.recipient_task,p_id,'Task follow-up',assigned.title);return '{}'::jsonb;
  elsif p_operation='cancel_assignment' then
   if assigned.creator_id<>u then raise insufficient_privilege;end if;
   if assigned.status not in('pending','accepted') then raise invalid_parameter_value;end if;
   if assigned.recipient_task is not null then update public.actions set deleted_at=coalesce(deleted_at,now()),deleted_by=u where id=assigned.recipient_task and owner_id=assigned.recipient_id and company_id=c;insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status) select id,owner_id,company_id,u,'assignment_withdrawn',status from public.actions where id=assigned.recipient_task;end if;
   update private.myday_assignments set status='cancelled',updated_at=now() where id=p_id;perform private.myday_notify(assigned.recipient_id,c,assigned.recipient_task,p_id,'Assigned task withdrawn',assigned.title);return '{}'::jsonb;
  end if;
  if assigned.recipient_id<>u then raise insufficient_privilege;end if;
  if p_operation='accept' then
   if assigned.status='accepted' then return to_jsonb(assigned.recipient_task);end if;
   if assigned.status<>'pending' then raise invalid_parameter_value;end if;
   target:=gen_random_uuid();perform private.myday_action(target,'create',jsonb_build_object('title',assigned.title,'details',assigned.details,'due_date',coalesce(assigned.suggested_date,assigned.due_date)::text));
   update private.myday_assignments set status='accepted',recipient_task=target,updated_at=now() where id=p_id;
   perform private.myday_notify(assigned.creator_id,c,target,p_id,'Task accepted',assigned.title);return to_jsonb(target);
  elsif p_operation='suggest_date' then
   if assigned.status<>'pending' or nullif(p_data->>'date','')::date<today then raise invalid_parameter_value;end if;
   update private.myday_assignments set suggested_date=(p_data->>'date')::date,updated_at=now() where id=p_id;perform private.myday_notify(assigned.creator_id,c,null,p_id,'A new date was suggested',assigned.title);return '{}'::jsonb;
  elsif p_operation='decline' then
   if assigned.status<>'pending' then raise invalid_parameter_value;end if;
   update private.myday_assignments set status='declined',updated_at=now() where id=p_id;
  else
   if assigned.status<>'accepted' then raise invalid_parameter_value;end if;
   update private.myday_assignments set status='returned',updated_at=now() where id=p_id;
   update public.actions set deleted_at=now(),deleted_by=u where id=assigned.recipient_task and owner_id=u;
  end if;
  perform private.myday_notify(assigned.creator_id,c,null,p_id,case when p_operation='decline' then 'Task declined' else 'Task handed back' end,assigned.title);return '{}'::jsonb;
 elsif p_operation='cover_hand_back' then
  update public.work_handovers set status='completed',completed_at=now(),version=version+1 where id=p_id and company_id=c and cover_id=u and status='approved' and today between starts_on and ends_on returning owner_id into target;
  if target is null then raise insufficient_privilege;end if;
  perform private.handover_event(p_id,'hand_back');insert into private.handover_notifications(handover_id,owner_id,message) values(p_id,target,'Cover handed back');return '{}'::jsonb;
 elsif p_operation='notification_read' then update private.myday_notifications set read_at=coalesce(read_at,now()) where id=p_id and owner_id=u and company_id=c;return '{}'::jsonb;
 elsif p_operation='batch' then
  if p_data->>'operation' not in('done','tomorrow','delete','assign','undo') or jsonb_typeof(p_data->'ids')<>'array' or jsonb_array_length(p_data->'ids') not between 1 and 100 then raise invalid_parameter_value;end if;
  for v in select value from jsonb_array_elements(p_data->'ids') loop
   row_id:=(v#>>'{}')::uuid;
   if not exists(select 1 from public.actions where id=row_id and owner_id=u and company_id=c and purged_at is null and missed_at is null) then raise insufficient_privilege;end if;
   if p_data->>'operation'='undo' then perform private.myday_action(row_id,'undo','{}');
   elsif p_data->>'operation'='delete' then perform private.myday_suite('delete',row_id,p_data);
   elsif p_data->>'operation'='assign' then select * into a from public.actions where id=row_id;perform private.myday_suite('assign',gen_random_uuid(),jsonb_build_object('recipient_id',p_data->>'recipient_id','source_task',a.id,'title',a.title,'due_date',a.due_date,'details',coalesce(p_data->>'details','')));
   else perform private.myday_action(row_id,case when p_data->>'operation'='done' then 'status' else 'tomorrow' end,case when p_data->>'operation'='done' then '{"status":"done"}'::jsonb else '{}'::jsonb end);end if;
  end loop;return '{}'::jsonb;
 elsif p_operation='import' then
  if jsonb_typeof(p_data->'rows')<>'array' or jsonb_array_length(p_data->'rows') not between 1 and 500 then raise invalid_parameter_value;end if;
  for v in select value from jsonb_array_elements(p_data->'rows') loop
   if length(btrim(v->>'title')) not between 1 and 300 then raise invalid_parameter_value;end if;
   row_key:=encode(extensions.digest(lower(btrim(v->>'title'))||E'\n'||coalesce(nullif(v->>'due_date','')::date::text,'')||E'\n'||coalesce(nullif(v->>'due_time','')::time::text,''),'sha256'),'hex');
   perform pg_advisory_xact_lock(hashtextextended(u::text||c::text||row_key,3261));
   if exists(select 1 from private.myday_import_rows where owner_id=u and company_id=c and row_hash=row_key) or exists(select 1 from public.actions where owner_id=u and company_id=c and purged_at is null and deleted_at is null and lower(btrim(title))=lower(btrim(v->>'title')) and due_date is not distinct from nullif(v->>'due_date','')::date and due_time is not distinct from nullif(v->>'due_time','')::time) then duplicates:=duplicates+1;continue;end if;
   target:=gen_random_uuid();perform private.myday_action(target,'create',jsonb_build_object('title',btrim(v->>'title'),'details',coalesce(v->>'details',''),'due_date',v->>'due_date','due_time',v->>'due_time','label',coalesce(v->>'label',''),'time_needed_minutes',nullif(v->>'time_needed_minutes','')::int,'steps',to_jsonb(string_to_array(nullif(v->>'steps',''),E'\n')),'links',to_jsonb(string_to_array(nullif(v->>'links',''),E'\n')))-'steps'-'links'||jsonb_build_object('steps',coalesce(to_jsonb(string_to_array(nullif(v->>'steps',''),E'\n')),'[]'::jsonb),'links',coalesce(to_jsonb(string_to_array(nullif(v->>'links',''),E'\n')),'[]'::jsonb)));
   task_status:=case lower(coalesce(nullif(v->>'status',''),'open')) when 'to do' then 'open' when 'in progress' then 'in_progress' else lower(coalesce(nullif(v->>'status',''),'open')) end;
   if task_status not in('open','in_progress','done') then raise invalid_parameter_value;end if;
   if task_status<>'open' then perform private.myday_action(target,'status',jsonb_build_object('status',task_status));end if;
   insert into private.myday_import_rows(owner_id,company_id,row_hash,task_id) values(u,c,row_key,target);added:=added+1;
  end loop;return jsonb_build_object('added',added,'duplicates',duplicates);
 elsif p_operation='calendar' then
  if not private.myday_enabled(c,'calendar') then raise insufficient_privilege;end if;
  if coalesce((p_data->>'revoke')::boolean,false) then update private.myday_personal_options set calendar_enabled=false,calendar_hash=null where owner_id=u;return '{}'::jsonb;end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');insert into private.myday_personal_options(owner_id,company_id,calendar_enabled,calendar_hash) values(u,c,true,encode(extensions.digest(token,'sha256'),'hex')) on conflict(owner_id) do update set calendar_enabled=true,calendar_hash=excluded.calendar_hash;return jsonb_build_object('token',token);
 elsif p_operation='push_unregister' then delete from private.myday_push where owner_id=u and company_id=c and endpoint=p_data->>'endpoint';return '{}'::jsonb;
 elsif p_operation='push_register' then
  if not private.myday_enabled(c,'push') or p_data->>'endpoint'!~'^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-zA-Z0-9-]+\.notify\.windows\.com)/' or length(p_data::text)>6000 or coalesce(p_data->'keys'->>'p256dh','')!~'^[A-Za-z0-9_-]{87}$' or coalesce(p_data->'keys'->>'auth','')!~'^[A-Za-z0-9_-]{22}$' then raise invalid_parameter_value;end if;
  if not exists(select 1 from private.myday_push where endpoint=p_data->>'endpoint') and (select count(*) from private.myday_push where owner_id=u)>=10 then raise exception 'Remove an old registered device first' using errcode='22023';end if;
  insert into private.myday_push(owner_id,company_id,endpoint,subscription) values(u,c,p_data->>'endpoint',p_data) on conflict(endpoint) do update set owner_id=excluded.owner_id,company_id=excluded.company_id,subscription=excluded.subscription;return '{}'::jsonb;
 end if;
 -- The operations below require an explicitly selected task. Never return another owner's task body.
 select * into a from public.actions where id=p_id and company_id=c and purged_at is null for update;if not found then raise insufficient_privilege;end if;
 if p_operation='comments' then
  if not private.myday_task_participant(a.id,u,c) then raise insufficient_privilege;end if;
  return jsonb_build_object('task',jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'due_date',a.due_date),'rows',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'author_id',r.author_id,'author',p.full_name,'body',r.body,'private_note',r.private_note,'created_at',r.created_at,'updated_at',r.updated_at) order by r.created_at,r.id) from private.myday_comments r join public.profiles p on p.id=r.author_id where r.task_id=a.id and (not r.private_note or r.author_id=u)),'[]'::jsonb));
 elsif p_operation in('comment_save','comment_delete') then
  if not private.myday_task_participant(a.id,u,c) then raise insufficient_privilege;end if;
  row_id:=(p_data->>'id')::uuid;
  if exists(select 1 from private.myday_comments where id=row_id and (author_id<>u or task_id<>a.id or company_id<>c)) then raise insufficient_privilege;end if;
  if p_operation='comment_delete' then delete from private.myday_comments where id=row_id and task_id=a.id and author_id=u;else
   insert into private.myday_comments(id,task_id,company_id,author_id,body,private_note) values(row_id,a.id,c,u,p_data->>'body',coalesce((p_data->>'private_note')::boolean,false)) on conflict(id) do update set body=excluded.body,private_note=excluded.private_note,updated_at=now();
   if not coalesce((p_data->>'private_note')::boolean,false) then
    for v in select value from jsonb_array_elements(coalesce(p_data->'mentions','[]'::jsonb)) loop
     target:=(v#>>'{}')::uuid;
     if not exists(select 1 from public.profiles where id=target and company_id=c and active) then raise insufficient_privilege;end if;
     if a.owner_id<>u and not private.myday_task_participant(a.id,target,c) then raise insufficient_privilege;end if;
     insert into private.myday_collaborators(task_id,profile_id,company_id) values(a.id,target,c) on conflict do nothing;
     perform private.myday_notify(target,c,a.id,null,'You were mentioned on a task',left(p_data->>'body',160));
    end loop;
   end if;
  end if;
  insert into public.task_events(task_id,owner_id,company_id,actor_id,event,status) values(a.id,a.owner_id,c,u,case when p_operation='comment_delete' then 'comment_deleted' else 'commented' end,a.status);return '{}'::jsonb;
 elsif p_operation='delete' then
  if not(a.owner_id=u or exists(select 1 from private.myday_assignments where recipient_task=a.id and creator_id=u and company_id=c) or exists(select 1 from public.companies where id=c and created_by=u)) then raise insufficient_privilege;end if;
  if (a.capture_id is not null or a.decision_id is not null) and not coalesce((p_data->>'confirmed')::boolean,false) then raise exception 'This task is part of the record. Confirm deletion.' using errcode='22023';end if;
  if a.owner_id=u then perform private.myday_action(a.id,'archive','{}');else update public.actions set deleted_at=now(),deleted_by=u where id=a.id;perform private.myday_notify(a.owner_id,c,a.id,null,'A task was deleted by its creator',a.title);end if;
  if coalesce((p_data->>'future')::boolean,false) then update private.myday_undo set repeat_state=coalesce((select jsonb_agg(id) from private.myday_repeats where current_task=a.id and owner_id=u and active),'[]'::jsonb) where task_id=a.id and owner_id=u;update private.myday_repeats set active=false where current_task=a.id and owner_id=u;end if;return '{}'::jsonb;
 elsif p_operation='delete_forever' then
  if a.owner_id<>u or a.deleted_at is null or a.deleted_at>now()-interval '30 days' then raise insufficient_privilege;end if;
  update public.actions set purged_at=now(),title='Deleted task',details='',completion_note='',source_url=null,source_excerpt=null,steps='[]',links='[]',label=null,metadata='{"schema_version":1}' where id=a.id;
  return '{}'::jsonb;
 end if;
 if a.owner_id<>u then raise insufficient_privilege;end if;
 if p_operation='task_extra' then
  return jsonb_build_object('repeat',(select to_jsonb(r) from private.myday_repeats r where current_task=a.id and owner_id=u and active limit 1),'assignment',(select jsonb_build_object('id',id,'creator_id',creator_id,'status',status) from private.myday_assignments where recipient_task=a.id and recipient_id=u and status='accepted' limit 1),'files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'path',path)) from private.myday_files where task_id=a.id and owner_id=u),'[]'::jsonb),'decisions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title)) from(select id,title from public.decisions where owner_id=u and company_id=c and deleted_at is null and status='active' order by title limit 200)q),'[]'::jsonb));
 elsif p_operation='link_decision' then update public.actions set decision_id=nullif(p_data->>'decision_id','')::uuid where id=a.id;return '{}'::jsonb;
 elsif p_operation='repeat' then
  if a.recurring_id is not null or a.source_kind='recurring_deadline' then raise exception 'This task repeats from My role' using errcode='22023';end if;
  if coalesce((p_data->>'stop')::boolean,false) then update private.myday_repeats set active=false where owner_id=u and current_task=a.id;update public.actions set repeat_rule=null where id=a.id;return '{}'::jsonb;end if;
  if a.deleted_at is not null or a.missed_at is not null or a.status='done' or a.due_date is null then raise exception 'Set a due date on an open task first' using errcode='22023';end if;
  update private.myday_repeats set active=false where owner_id=u and current_task=a.id;
  insert into private.myday_repeats(id,owner_id,company_id,task_id,current_task,frequency,every_n,unit,anchor,next_date,template) values(gen_random_uuid(),u,c,a.id,a.id,p_data->>'frequency',coalesce((p_data->>'every_n')::int,1),coalesce(p_data->>'unit','day'),a.due_date,private.myday_next_date(a.due_date,p_data->>'frequency',coalesce((p_data->>'every_n')::int,1),coalesce(p_data->>'unit','day'),a.due_date),to_jsonb(a));
  update public.actions set repeat_rule=jsonb_build_object('frequency',p_data->>'frequency','every_n',coalesce((p_data->>'every_n')::int,1),'unit',coalesce(p_data->>'unit','day')) where id=a.id;
  return '{}'::jsonb;
 elsif p_operation='file_attach' then
  if length(p_data->>'path')>600 or p_data->>'path' not like c::text||'/'||u::text||'/'||a.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='task-files' and name=p_data->>'path') then raise insufficient_privilege;end if;
  insert into private.myday_files(task_id,owner_id,company_id,name,path) values(a.id,u,c,p_data->>'name',p_data->>'path') on conflict(path) do nothing;return '{}'::jsonb;
 elsif p_operation='file_remove' then
  delete from private.myday_files where id=(p_data->>'file_id')::uuid and task_id=a.id and owner_id=u;return '{}'::jsonb;
 elsif p_operation='sync' then
  if a.updated_at is distinct from nullif(p_data->>'base_updated_at','')::timestamptz then
   perform private.myday_action(a.id,'edit',p_data-'base_updated_at');return jsonb_build_object('conflict',true,'id',a.id);
  end if;
  perform private.myday_action(a.id,'edit',p_data-'base_updated_at');return jsonb_build_object('conflict',false,'id',a.id);
 end if;
 raise exception 'Unknown My Day operation' using errcode='22023';
end$$;
revoke all on function private.myday_suite(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.myday_suite(text,uuid,jsonb) to authenticated;
create function public.myday_suite(p_operation text,p_id uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.myday_suite(p_operation,p_id,p_data)$$;
revoke all on function public.myday_suite(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.myday_suite(text,uuid,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('task-files','task-files',false,10485760,array['application/pdf','text/plain','text/csv','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id) do nothing;
create policy task_files_owner_read on storage.objects for select to authenticated using(bucket_id='task-files' and (storage.foldername(name))[1]=(select private.current_company_id())::text and (storage.foldername(name))[2]=(select auth.uid())::text);
create policy task_files_owner_write on storage.objects for insert to authenticated with check(bucket_id='task-files' and (storage.foldername(name))[1]=(select private.current_company_id())::text and (storage.foldername(name))[2]=(select auth.uid())::text and exists(select 1 from public.actions where id::text=(storage.foldername(name))[3] and owner_id=(select auth.uid()) and company_id=(select private.current_company_id()) and purged_at is null));
create policy task_files_owner_remove on storage.objects for delete to authenticated using(bucket_id='task-files' and (storage.foldername(name))[1]=(select private.current_company_id())::text and (storage.foldername(name))[2]=(select auth.uid())::text);

create function private.myday_apply_rules(event_name text,subject uuid,owner uuid,company uuid,cycle_key text,source_kind text default '') returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare r private.myday_rules;e jsonb;manager uuid;target public.profiles;a public.actions;begin
 if not private.myday_enabled(company,'rules') then return;end if;
 for r in select * from private.myday_rules where company_id=company and enabled and trigger_event=event_name and (owner_id=owner or shared) and (source_type='' or source_type=source_kind or source_type='email' and source_kind in('gmail','outlook') or source_type='note' and source_kind in('slack','teams','trello','drive')) loop
  if event_name='overdue' and not exists(select 1 from public.actions where id=subject and due_date<=(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=owner),'Europe/London'))::date-r.after_days) then continue;end if;
  insert into private.myday_rule_runs(rule_id,subject_id,cycle) values(r.id,subject,cycle_key) on conflict do nothing;if not found then continue;end if;
  for e in select value from jsonb_array_elements(r.effects) loop
   if event_name='capture_draft' then
    if e->>'kind'='label' then update public.capture_items set payload=payload||jsonb_build_object('label',left(e->>'value',80)),version=version+1 where id=subject and owner_id=owner and status='pending';
    elsif e->>'kind'='remind' then update public.capture_items set payload=payload||jsonb_build_object('reminder_option',case when e->>'value' in('at_time','30_minutes','1_hour','day_before') then e->>'value' else 'at_time' end),version=version+1 where id=subject and owner_id=owner and status='pending';
    elsif e->>'kind'='owner' then
     select p.* into target from public.profiles p join public.profiles author on author.id=r.owner_id and author.active where p.id=nullif(e->>'value','')::uuid and p.company_id=company and p.active and (author.role='hr_admin' or author.role='manager' and private.myday_reports_to(p.id,author.id,company) or p.id=owner);
     if found and exists(select 1 from public.profiles capturer where capturer.id=owner and capturer.company_id=company and capturer.active and (target.id=owner or capturer.role='hr_admin' or capturer.role='manager' and private.myday_reports_to(target.id,owner,company))) then update public.capture_items set payload=payload||jsonb_build_object('owner_id',target.id),version=version+1 where id=subject and owner_id=owner and status='pending';end if;
    end if;
   else
    select * into a from public.actions where id=subject and owner_id=owner and company_id=company and purged_at is null;
    if not found then continue;end if;
    if e->>'kind'='label' then update public.actions set label=left(e->>'value',80) where id=subject;
    elsif e->>'kind'='remind' and a.status<>'done' then update public.actions set remind_at=now()+interval '1 hour',reminder_sent_at=null,check_in_sent_at=null,reminder_cycle=reminder_cycle+1 where id=subject;
    elsif e->>'kind'='owner' and a.status<>'done' then
     select p.* into target from public.profiles p join public.profiles author on author.id=r.owner_id and author.active where p.id=nullif(e->>'value','')::uuid and p.company_id=company and p.active and (author.role='hr_admin' or author.role='manager' and private.myday_reports_to(p.id,author.id,company));
     if found and target.id<>owner then insert into private.myday_assignments(id,company_id,creator_id,recipient_id,source_task,title,details,due_date) values(gen_random_uuid(),company,r.owner_id,target.id,a.id,a.title,'',a.due_date);perform private.myday_notify(target.id,company,null,null,'New task to review',a.title);end if;
    end if;
   end if;
   if e->>'kind'='notify' then perform private.myday_notify(owner,company,case when event_name='capture_draft' then null else subject end,null,r.title,'A task rule matched.');
   elsif e->>'kind'='notify_manager' then select private.myday_manager(id,company) into manager from public.profiles where id=owner and company_id=company and active;if manager is not null and manager<>owner then perform private.myday_notify(manager,company,null,null,r.title,'A task rule matched for a direct report.');end if;
   end if;
  end loop;
 end loop;
end$$;
revoke all on function private.myday_apply_rules(text,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function private.myday_rule_trigger() returns trigger language plpgsql security definer set search_path='' as $$begin
 if pg_trigger_depth()>2 then return new;end if;
 if tg_table_name='capture_items' then
  if new.status='pending' and tg_op='INSERT' then perform private.myday_apply_rules('capture_draft',new.id,new.owner_id,new.company_id,'created',(select case split_part(title,':',1) when 'Gmail' then 'gmail' when 'Outlook' then 'outlook' when 'Slack' then 'slack' when 'Microsoft Teams' then 'teams' when 'Trello' then 'trello' when 'Google Drive' then 'drive' else source_type end from public.captures where id=new.capture_id));end if;
 elsif tg_op='UPDATE' and new.status='done' and old.status<>'done' then perform private.myday_apply_rules('done',new.id,new.owner_id,new.company_id,coalesce(new.completed_at::text,'done'),new.source_kind);
 end if;return new;
end$$;
revoke all on function private.myday_rule_trigger() from public,anon,authenticated,service_role;
create trigger myday_rules_capture after insert on public.capture_items for each row execute function private.myday_rule_trigger();
create trigger myday_rules_done after update on public.actions for each row execute function private.myday_rule_trigger();
create function private.myday_tick(p_now timestamptz default now(),p_owner uuid default null) returns integer language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare r private.myday_repeats;a public.actions;d date;last_due date;next_due date;zone text;created uuid;processed int:=0;p record;local_time time;q_start time;q_end time;quiet boolean;begin
 if not pg_try_advisory_xact_lock(727454131) then return 0;end if;
 for r in select s.* from private.myday_repeats s join public.profiles p on p.id=s.owner_id and p.company_id=s.company_id and p.active where s.active and (p_owner is null or s.owner_id=p_owner) and s.next_date<=(p_now at time zone coalesce((select timezone from public.work_preferences where owner_id=s.owner_id),'Europe/London'))::date order by s.id for update of s skip locked limit 1000 loop
  zone:=coalesce((select timezone from public.work_preferences where owner_id=r.owner_id),'Europe/London');d:=(p_now at time zone zone)::date;last_due:=r.next_date;next_due:=private.myday_next_date(last_due,r.frequency,r.every_n,r.unit,r.anchor);
  while next_due<=d loop last_due:=next_due;next_due:=private.myday_next_date(next_due,r.frequency,r.every_n,r.unit,r.anchor);end loop;
  select * into a from public.actions where id=r.current_task for update;

  if a.status<>'done' and a.missed_at is null and a.deleted_at is null and a.purged_at is null then
   update public.actions set missed_at=p_now,pinned_at=null where id=a.id;
   insert into public.task_events(task_id,owner_id,company_id,event,status) values(a.id,r.owner_id,r.company_id,'missed',a.status);
  end if;
  insert into public.actions(owner_id,company_id,title,details,due_date,due_time,source_kind,reminder_option,steps,links,label,time_needed_minutes,capture_id,metadata,repeat_rule)
  values(r.owner_id,r.company_id,r.template->>'title',coalesce(r.template->>'details',''),last_due,nullif(r.template->>'due_time','')::time,coalesce(r.template->>'source_kind','manual'),coalesce(r.template->>'reminder_option','at_time'),coalesce(r.template->'steps','[]'),coalesce(r.template->'links','[]'),r.template->>'label',nullif(r.template->>'time_needed_minutes','')::int,nullif(r.template->>'capture_id','')::uuid,jsonb_build_object('schema_version',1,'repeat_id',r.id),jsonb_build_object('frequency',r.frequency,'every_n',r.every_n,'unit',r.unit)) returning id into created;
  update private.myday_repeats set current_task=created,next_date=next_due where id=r.id;processed:=processed+1;
 end loop;
 for a in select act.* from public.actions act join public.profiles p on p.id=act.owner_id and p.active where (p_owner is null or act.owner_id=p_owner) and act.deleted_at is null and act.purged_at is null and act.missed_at is null and act.status<>'done' and act.due_at<p_now order by act.id limit 2000 loop perform private.myday_apply_rules('overdue',a.id,a.owner_id,a.company_id,coalesce(a.due_at::text,'undated'),a.source_kind);end loop;
 -- Expired drafts leave review; the original capture and confirmed record are retained.
 update public.capture_items set status='discarded',reviewed_at=p_now,version=version+1 where (p_owner is null or owner_id=p_owner) and status='pending' and created_at<p_now-interval '30 days';
 -- Purge task content only after the complete 30-day retention window; keep audit identifiers and source/decision records.
 delete from private.myday_undo where expires_at<p_now;
 delete from private.myday_comments where task_id in(select id from public.actions where (p_owner is null or owner_id=p_owner) and deleted_at<p_now-interval '30 days');
 update public.actions set purged_at=p_now,title='Deleted task',details='',completion_note='',source_url=null,source_excerpt=null,steps='[]',links='[]',label=null,metadata='{"schema_version":1}' where (p_owner is null or owner_id=p_owner) and deleted_at<p_now-interval '30 days' and purged_at is null;
 update private.myday_repeats r set template='{}' where not active and template<>'{}'::jsonb and exists(select 1 from public.actions a where a.id=r.current_task and a.purged_at is not null) and (p_owner is null or r.owner_id=p_owner);
 for p in select o.*,coalesce(w.timezone,'Europe/London') as zone from private.myday_personal_options o join public.profiles member on member.id=o.owner_id and member.company_id=o.company_id and member.active left join public.work_preferences w on w.owner_id=o.owner_id where p_owner is null or o.owner_id=p_owner loop
  local_time:=(p_now at time zone p.zone)::time;d:=(p_now at time zone p.zone)::date;
  q_start:=coalesce(nullif(p.settings->>'quiet_start','')::time,time '22:00');q_end:=coalesce(nullif(p.settings->>'quiet_end','')::time,time '08:00');quiet:=case when q_start=q_end then false when q_start<q_end then local_time>=q_start and local_time<q_end else local_time>=q_start or local_time<q_end end;
  if not quiet and local_time>=coalesce(nullif(p.settings->>'work_start','')::time,time '09:00') and coalesce((p.settings->>'briefing')::boolean,false) and private.myday_enabled(p.company_id,'ai') then insert into private.myday_delivery_jobs(owner_id,company_id,kind,day,unique_key) values(p.owner_id,p.company_id,'briefing',d,'briefing:'||p.owner_id::text||':'||d::text) on conflict do nothing;end if;
  if not quiet and local_time>=coalesce(nullif(p.settings->>'work_end','')::time,time '17:00') and coalesce((p.settings->>'digest')::boolean,false) and private.myday_enabled(p.company_id,'email') then insert into private.myday_delivery_jobs(owner_id,company_id,kind,day,unique_key) values(p.owner_id,p.company_id,'digest',d,'digest:'||p.owner_id::text||':'||d::text) on conflict do nothing;end if;
 end loop;
 return processed;
end$$;
revoke all on function private.myday_tick(timestamptz,uuid) from public,anon,authenticated,service_role;
select cron.schedule('myday-suite-minute','* * * * *','select private.myday_tick();');


-- Reuse the existing readers and quota reservation; extend only the approved task workflow.
create function private.myday_next_morning(owner uuid,due timestamptz,reminder timestamptz) returns timestamptz language sql stable security definer set search_path='' as $$select (((greatest(due,reminder) at time zone coalesce(w.timezone,'Europe/London'))::date+1)+coalesce(w.reminder_time,time '09:00')) at time zone coalesce(w.timezone,'Europe/London') from (select 1) base left join public.work_preferences w on w.owner_id=owner$$;
create function private.myday_quiet(owner uuid,at_time timestamptz) returns boolean language plpgsql stable security definer set search_path='' as $$
declare zone text;settings jsonb;t time;begins time;ends time;begin
 zone:=coalesce((select timezone from public.work_preferences where owner_id=owner),'Europe/London');settings:=coalesce((select o.settings from private.myday_personal_options o where owner_id=owner),'{}'::jsonb);t:=(at_time at time zone zone)::time;begins:=coalesce(nullif(settings->>'quiet_start','')::time,time '22:00');ends:=coalesce(nullif(settings->>'quiet_end','')::time,time '08:00');
 return case when begins=ends then false when begins<ends then t>=begins and t<ends else t>=begins or t<ends end;
end$$;
revoke all on function private.myday_next_morning(uuid,timestamptz,timestamptz),private.myday_quiet(uuid,timestamptz) from public,anon,authenticated,service_role;
create function private.myday_incoming() returns jsonb language sql stable security definer set search_path='' as $$ select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'details',r.details,'due_date',r.due_date,'suggested_date',r.suggested_date,'status',r.status,'creator_name',p.full_name) order by r.created_at,r.id),'[]'::jsonb) from private.myday_assignments r join public.profiles p on p.id=r.creator_id where r.recipient_id=auth.uid() and r.company_id=private.current_company_id() and r.status='pending' $$;
revoke all on function private.myday_incoming() from public,anon,authenticated,service_role;
grant execute on function private.myday_incoming() to authenticated;
CREATE OR REPLACE FUNCTION public.myday_tasks(p_filter text, p_query text, p_for text, p_page integer, p_task uuid DEFAULT NULL::uuid, p_decision uuid DEFAULT NULL::uuid, p_source text DEFAULT ''::text, p_priority text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();tz text;today date;result jsonb;totals jsonb;begin
 if u is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_filter is null or p_filter not in ('today','week','overdue','all','archived','done') or p_page is null or p_page<0 or p_page>100000 or p_query is null or char_length(p_query)>100 or p_for is null or char_length(p_for)>80 or p_source is null or p_source not in ('','manual','email','notes','ai','recurring_deadline','role','meeting','handover','cover') or p_priority is null or p_priority not in ('','high','normal','low') then raise exception 'Invalid task filter' using errcode='22023';end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');today:=(now() at time zone tz)::date;
 totals:=private.myday_counts(p_query,p_for,p_source,p_priority,p_task,p_decision);
 with base as materialized(
 select a.*,private.myday_source_connected(cp.title) as source_connected,case when split_part(cp.title,':',1) in ('Gmail','Google Drive','Outlook','Microsoft Teams','Slack','Trello') then split_part(cp.title,':',1) else null end as source_name,cp.source_date,substring(cp.source_text from 'Source: (https?://[^[:space:]]+)') as source_origin_url,left(cp.source_text,500) as capture_excerpt,d.name as department_name,r.title as external_contact_name,ri.kind as source_role_kind,ri.role_id as source_role_profile_id,
 (a.due_at at time zone tz)::date as due_day,
 a.status<>'done' and (a.due_at<now() or (a.due_at at time zone tz)::date=today or a.pinned_at is not null) as in_today
 from public.actions a left join public.captures cp on cp.id=a.capture_id and cp.owner_id=u left join public.departments d on d.id=a.department_id left join public.role_items r on r.id=a.external_contact_id
 left join public.role_items ri on ri.id=coalesce(a.source_role_id,a.stable_role_item_id,a.recurring_id)
 where a.owner_id=u and a.purged_at is null and (a.missed_at is null or p_filter in ('all','archived')) and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_source='' or a.source_kind=p_source) and (p_priority='' or a.priority=p_priority)
 ), filtered as materialized(select * from base where (deleted_at is not null)=(p_filter='archived')
 and (p_filter in ('all','archived') or p_filter='today' and in_today and (due_at>=now() or due_at is null) or p_filter='done' and status='done' or p_filter='week' and status<>'done' and due_day between today and today+6 or p_filter='overdue' and status<>'done' and due_at<now())),
 ranked as(select *,row_number() over(order by case when metadata->>'plan_day'=today::text and metadata->>'plan_order' ~ '^[0-9]{1,3}$' then (metadata->>'plan_order')::int else 1000 end,(pinned_at is not null) desc,due_at,created_at,id) as rank from filtered),
 paged as(select * from ranked order by rank limit case when p_filter='today' then null else 60 end offset case when p_filter='today' then 0 else p_page*60 end)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by rank) from paged),'[]'::jsonb),'count',(select count(*) from filtered),'today',today,'timezone',tz,
 'tab_counts',totals->'tab_counts',
 'undated',coalesce((select jsonb_agg(to_jsonb(q) order by created_at,id) from base q where deleted_at is null and status<>'done' and due_date is null and missed_at is null),'[]'::jsonb),
 'overdue_rows',coalesce((select jsonb_agg(to_jsonb(q) order by (pinned_at is not null) desc,due_at,created_at,id) from base q where deleted_at is null and status<>'done' and due_at<now()),'[]'::jsonb),
 'counts',totals->'counts',
 'has_work',exists(select 1 from public.actions where owner_id=u) or exists(select 1 from public.role_items where owner_id=u),
 'review_assignments',private.myday_incoming(),'context_waiting',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.actions where owner_id=u and status='done' and deleted_at is null and context_added_at is null order by completed_at desc limit 10)q),'[]'::jsonb),
 'done_today',coalesce((select jsonb_agg(to_jsonb(q) order by completed_at desc,id) from base q where deleted_at is null and status='done' and (completed_at at time zone tz)::date=today),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q) order by (pinned_at is not null) desc,due_at,created_at,id) from base q where deleted_at is null and status<>'done' and pinned_at is null and (due_day between today+1 and today+7 or due_day is null)),'[]'::jsonb),
 'review_drafts',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'capture_id',i.capture_id,'kind',i.kind,'version',i.version,'payload',i.payload,'duplicate',(i.kind='action' and exists(select 1 from public.actions a where a.owner_id=u and a.deleted_at is null and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))) or i.kind='decision' and exists(select 1 from public.decisions a where a.owner_id=u and a.deleted_at is null and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))) or i.kind='summary' and exists(select 1 from public.capture_summaries a where a.owner_id=u and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))))) order by i.created_at,i.id) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.status='pending' and c.deleted_at is null and strpos(lower(i.payload->>'title'),lower(p_query))>0),'[]'::jsonb),
 'drafts_waiting',(select count(*) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.status='pending' and c.deleted_at is null and strpos(lower(i.payload->>'title'),lower(p_query))>0),
 'decisions_waiting',0,
 'handovers_waiting',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title)) from public.work_handovers h where reviewer_id=u and status='pending'),'[]'::jsonb),
 'covering',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'owner_name',p.full_name,'owner_id',p.id)) from public.work_handovers h join public.profiles p on p.id=h.owner_id and p.active where h.cover_id=u and h.status='approved' and today between h.starts_on and h.ends_on),'[]'::jsonb),
 'cover_tasks',private.myday_cover_tasks(),
 'checklist',jsonb_build_object('capture',exists(select 1 from public.captures where owner_id=u),'role',exists(select 1 from public.role_items where owner_id=u and deleted_at is null) or exists(select 1 from public.decisions where owner_id=u and deleted_at is null),'reminder',exists(select 1 from public.actions where owner_id=u and deleted_at is null and remind_at is not null),'cover',exists(select 1 from public.work_handovers where owner_id=u and status<>'cancelled'))
 ) into result;return result;
end $function$

;
CREATE OR REPLACE FUNCTION private.myday_counts(p_query text, p_for text, p_source text, p_priority text, p_task uuid, p_decision uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare tz text; today date; result jsonb;begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');today:=(now() at time zone tz)::date;
 with base as materialized(select a.*,(a.due_at at time zone tz)::date as due_day from public.actions a where a.owner_id=auth.uid() and a.purged_at is null
 and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_source='' or a.source_kind=p_source) and (p_priority='' or a.priority=p_priority))
 select jsonb_build_object(
 'tab_counts',jsonb_build_object('today',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and (due_at>=now() or due_at is null) and (due_day=today or pinned_at is not null)),
 'week',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_day between today and today+6),'overdue',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_at<now()),'done',count(*) filter(where deleted_at is null and status='done'),'all',count(*) filter(where deleted_at is null),'archived',count(*) filter(where deleted_at is not null)),
 'counts',jsonb_build_object('today',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and (due_at>=now() or due_at is null) and (due_day=today or pinned_at is not null)),
 'todo',count(*) filter(where deleted_at is null and status='open' and missed_at is null and (due_at<now() or due_day=today or pinned_at is not null)),
 'progress',count(*) filter(where deleted_at is null and status='in_progress' and missed_at is null and (due_at<now() or due_day=today or pinned_at is not null)),
 'overdue',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_at<now()),'done',count(*) filter(where deleted_at is null and status='done' and (completed_at at time zone tz)::date=today))) into result from base;
 return result;
end $function$

;
CREATE OR REPLACE FUNCTION private.process_myday(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;a public.actions; alert uuid; processed integer:=0;next_date date;anchor date;local_today date;steps integer;
begin
 -- Skip overlapping minute jobs. Each create also has a unique cycle key.
 if not pg_try_advisory_xact_lock(627451903) then return 0;end if;
 for r in select ri.*,coalesce(w.timezone,'Europe/London') as tz from public.role_items ri
 join public.profiles p on p.id=ri.owner_id and p.company_id=ri.company_id and p.active
 left join public.work_preferences w on w.owner_id=p.id
 where ri.kind='recurring_deadline' and not exists(select 1 from private.role_task_schedules rs where rs.item_id=ri.id) and ri.deleted_at is null and ri.due_date<=(p_now at time zone coalesce(w.timezone,'Europe/London'))::date
 order by ri.id for update of ri skip locked limit 2000 loop
  local_today:=(p_now at time zone r.tz)::date;
  select coalesce(min(recurring_date),r.due_date) into anchor from public.actions where recurring_id=r.id;
  steps:=0;
  while r.due_date<local_today and steps<500 loop
   next_date:=private.anchored_work_date(r.due_date,r.recurrence,anchor);
   exit when next_date is null or next_date<=r.due_date;
   r.due_date:=next_date;steps:=steps+1;
  end loop;
  if r.due_date<>local_today then
   if steps>0 then update public.role_items set due_date=r.due_date where id=r.id;end if;
   continue;
  end if;
  insert into public.actions(owner_id,company_id,title,details,due_date,due_time,source_kind,recurring_id,recurring_date)
  values(r.owner_id,r.company_id,r.title,r.details,r.due_date,time '09:00','recurring_deadline',r.id,r.due_date) on conflict do nothing;
  next_date:=private.anchored_work_date(r.due_date,r.recurrence,anchor);
  if next_date is not null then update public.role_items set due_date=next_date where id=r.id;end if;
 end loop;
 for a in select act.* from public.actions act join public.profiles p on p.id=act.owner_id and p.company_id=act.company_id and p.active
 where act.deleted_at is null and act.purged_at is null and act.missed_at is null and not private.myday_quiet(act.owner_id,p_now) and act.status<>'done' and act.remind_at<=p_now
 and (act.reminder_sent_at is null or act.check_in_sent_at is null and private.myday_next_morning(act.owner_id,act.due_at,act.remind_at)<=p_now)
 order by act.remind_at,act.id for update of act skip locked limit 2000 loop
  alert:=null;
  if a.reminder_sent_at is null then
   insert into public.task_alerts(task_id,owner_id,company_id,cycle,phase) values(a.id,a.owner_id,a.company_id,a.reminder_cycle,'due') on conflict do nothing returning id into alert;
   update public.actions set reminder_sent_at=p_now where id=a.id;
  elsif private.myday_next_morning(a.owner_id,a.due_at,a.remind_at)<=p_now and a.check_in_sent_at is null then
   insert into public.task_alerts(task_id,owner_id,company_id,cycle,phase) values(a.id,a.owner_id,a.company_id,a.reminder_cycle,'check_in') on conflict do nothing returning id into alert;
   update public.actions set check_in_sent_at=p_now,overdue=true where id=a.id;
  end if;
  if alert is not null then
   if exists(select 1 from private.task_delivery_config where enabled) and private.myday_enabled(a.company_id,'email') and coalesce((select email_enabled from public.work_preferences where owner_id=a.owner_id),true) then insert into private.task_mail_queue(alert_id,owner_id) values(alert,a.owner_id) on conflict do nothing;end if;
   processed:=processed+1;
  end if;
 end loop;
 -- A completed, archived, rescheduled or deactivated task must not send a stale queued email.
 update private.task_mail_queue q set state='cancelled' from public.task_alerts n,public.actions stale,public.profiles p
 where q.alert_id=n.id and n.task_id=stale.id and p.id=stale.owner_id and q.state='pending'
 and (stale.status='done' or stale.missed_at is not null or stale.purged_at is not null or not private.myday_enabled(stale.company_id,'email') or stale.deleted_at is not null or stale.reminder_cycle<>n.cycle or not p.active or not coalesce((select email_enabled from public.work_preferences where owner_id=stale.owner_id),true));
 return processed;
end $function$

;
CREATE OR REPLACE FUNCTION private.ai_gateway_begin(p_user uuid, p_request uuid, p_task text, p_fingerprint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare company uuid; quota public.ai_company_limits; r public.ai_task_routes; p public.ai_models; f public.ai_models;
 existing public.ai_usage; reserve numeric; usage_id uuid; day_start timestamptz; month_start timestamptz;
 day_count bigint; month_count bigint; day_cost numeric; month_cost numeric; snapshot jsonb; plan public.ai_limits;
begin
 select company_id into company from public.profiles where id=p_user and active;
 if company is null then return jsonb_build_object('ok',false,'code','access_denied'); end if;
 if not private.myday_enabled(company,'ai') then return jsonb_build_object('ok',false,'code','not_configured');end if;
 -- Serialise every reservation for the company, including retries across workers.
 select * into quota from public.ai_company_limits where company_id=company for update;
 if not found or not quota.enabled then return jsonb_build_object('ok',false,'code','not_configured'); end if;
 -- Lock the plan as well: Console edits become effective on the next request.
 if quota.plan is not null then
  select * into plan from public.ai_limits where ai_limits.plan=quota.plan for share;
  if not found or not plan.enabled then return jsonb_build_object('ok',false,'code','not_configured'); end if;
  if quota.plan<>'enterprise' then
   quota.daily_request_limit:=plan.daily_request_limit;
   quota.monthly_request_limit:=plan.monthly_request_limit;
   quota.daily_cost_limit:=plan.daily_cost_limit;
   quota.monthly_cost_limit:=plan.monthly_cost_limit;
  end if;
 end if;
 select * into existing from public.ai_usage where company_id=company and user_id=p_user and request_id=p_request;
 if found then
  return jsonb_build_object('ok',false,'code',case when existing.fingerprint=p_fingerprint then 'already_requested' else 'idempotency_conflict' end);
 end if;
 select * into r from public.ai_task_routes where task=p_task and enabled;
 if not found then return jsonb_build_object('ok',false,'code','route_unavailable'); end if;
 select * into p from public.ai_models where id=r.primary_model_id and enabled;
 if not found then return jsonb_build_object('ok',false,'code','route_unavailable'); end if;
 select * into f from public.ai_models where id=r.fallback_model_id and enabled;
 -- Snapshot rates and both possible calls; later route/price changes cannot alter a reservation.
 snapshot:=jsonb_build_object('task',r.task,'max_output_tokens',r.max_output_tokens,'temperature',r.temperature,'primary',to_jsonb(p),'fallback',case when f.id is null then null else to_jsonb(f) end);
 reserve:=(32768*p.input_price_per_million+r.max_output_tokens*p.output_price_per_million)/1000000;
 if f.id is not null then reserve:=reserve+(32768*f.input_price_per_million+r.max_output_tokens*f.output_price_per_million)/1000000; end if;
 day_start:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 month_start:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 select count(*) filter(where created_at>=day_start),count(*),
 coalesce(sum(case when status='pending' then reserved_cost else cost end) filter(where created_at>=day_start),0),
 coalesce(sum(case when status='pending' then reserved_cost else cost end),0)
 into day_count,month_count,day_cost,month_cost from public.ai_usage where company_id=company and created_at>=month_start;
 if day_count>=quota.daily_request_limit or month_count>=quota.monthly_request_limit
 or day_cost+reserve>quota.daily_cost_limit or month_cost+reserve>quota.monthly_cost_limit then
  return jsonb_build_object('ok',false,'code','limit_reached',
   'period',case when month_count>=quota.monthly_request_limit or month_cost+reserve>quota.monthly_cost_limit then 'month' else 'day' end,
   'reset_at',case when month_count>=quota.monthly_request_limit or month_cost+reserve>quota.monthly_cost_limit
    then (date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC'
    else (date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC' end);
 end if;
 insert into public.ai_usage(request_id,company_id,user_id,task,model_id,fingerprint,reserved_cost,route_snapshot)
 values(p_request,company,p_user,p_task,p.id,p_fingerprint,reserve,snapshot) returning id into usage_id;
 return jsonb_build_object('ok',true,'usage_id',usage_id,'company_id',company,'route',snapshot);
end $function$

;
insert into public.ai_task_routes(task,primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled)
select name,r.primary_model_id,r.fallback_model_id,4096,0.1,r.enabled from public.ai_task_routes r cross join unnest(array['day_plan','day_briefing','conversation_summary']) name where r.task='capture_extract' on conflict(task) do nothing;
-- Service-only check runs before cached AI results as well as quota reservation.
grant execute on function private.myday_enabled(uuid,text) to service_role;
create function public.myday_ai_enabled(p_user uuid) returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from public.profiles where id=p_user and active and private.myday_enabled(company_id,'ai'))$$;
revoke all on function public.myday_ai_enabled(uuid) from public,anon,authenticated,service_role;
grant execute on function public.myday_ai_enabled(uuid) to service_role;

CREATE OR REPLACE FUNCTION private.myday_action_base(p_id uuid, p_operation text, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare draft public.capture_items; origin public.captures; result_json jsonb;
 a public.actions; before_task public.actions; saved private.myday_undo; result uuid; tz text; target date;
begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>22000 then raise exception 'Invalid task data' using errcode='22023';end if;
 if p_operation in ('review_accept','review_dismiss') then
  select * into draft from public.capture_items where id=p_id and owner_id=auth.uid() and company_id=private.current_company_id() for update;
  if not found then raise insufficient_privilege;end if;
  select * into origin from public.captures where id=draft.capture_id and owner_id=auth.uid() and company_id=private.current_company_id() and deleted_at is null for update;
  if not found then raise insufficient_privilege;end if;
  if p_operation='review_accept' and draft.status='confirmed' then return draft.id;end if;
  if p_operation='review_dismiss' and draft.status='discarded' then return draft.id;end if;
  if draft.status<>'pending' or draft.version is distinct from (p_data->>'version')::integer then raise exception 'This draft changed. Reload it.' using errcode='40001';end if;
  if p_operation='review_dismiss' then
   perform private.capture_change('discard',draft.id,draft.capture_id,jsonb_build_object('version',draft.version));return draft.id;
  end if;
  if coalesce(nullif(draft.payload->>'owner_id','')::uuid,auth.uid())<>auth.uid() then raise exception 'Review the assigned owner in Capture first' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||lower(btrim(draft.payload->>'title')),326));
  if draft.kind='action' and exists(select 1 from public.actions where owner_id=auth.uid() and company_id=private.current_company_id() and deleted_at is null and lower(btrim(title))=lower(btrim(draft.payload->>'title'))) or draft.kind='decision' and exists(select 1 from public.decisions where owner_id=auth.uid() and company_id=private.current_company_id() and deleted_at is null and lower(btrim(title))=lower(btrim(draft.payload->>'title'))) or draft.kind='summary' and exists(select 1 from public.capture_summaries where owner_id=auth.uid() and company_id=private.current_company_id() and lower(btrim(title))=lower(btrim(draft.payload->>'title'))) then raise exception 'A matching item already exists. Review or dismiss this draft.' using errcode='22023';end if;
  result_json:=private.capture_pipeline('confirm',draft.capture_id,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',draft.id,'version',draft.version))));return draft.id;
 end if;
 if p_operation<>'create' then
  select * into a from public.actions where id=p_id and owner_id=auth.uid() and company_id=private.current_company_id() for update;
  if not found then raise insufficient_privilege;end if;
  before_task:=a;
 end if;
 if p_operation='undo' then
  select * into saved from private.myday_undo where task_id=p_id and owner_id=auth.uid() and expires_at>=clock_timestamp() for update;
  if not found or a.updated_at<>saved.expected_updated_at then raise exception 'Undo expired or the task changed' using errcode='22023';end if;
  update public.actions set status=saved.status,deleted_at=saved.deleted_at,pinned_at=saved.pinned_at,completed_at=saved.completed_at where id=p_id;
  delete from private.myday_undo where task_id=p_id;return p_id;
 elsif p_operation='tomorrow' then
  if a.deleted_at is not null or a.status='done' then raise exception 'Task is not open' using errcode='22023';end if;
  tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');
  target:=coalesce(nullif(p_data->>'date','')::date,(now() at time zone tz)::date+1);
  if target<(now() at time zone tz)::date then raise exception 'Choose today or later' using errcode='22023';end if;
  update public.actions set due_date=target,reminder_sent_at=null,check_in_sent_at=null,reminder_cycle=reminder_cycle+1,overdue=false where id=p_id;return p_id;
 end if;
 if p_operation in ('create','edit') then
  if p_data ? 'steps' and (jsonb_typeof(p_data->'steps')<>'array' or jsonb_array_length(p_data->'steps')>100 or exists(select 1 from jsonb_array_elements(p_data->'steps') x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>1000)) then raise exception 'Invalid steps' using errcode='22023';end if;
  if p_data ? 'links' and (jsonb_typeof(p_data->'links')<>'array' or jsonb_array_length(p_data->'links')>30 or exists(select 1 from jsonb_array_elements(p_data->'links') x where jsonb_typeof(x)<>'string' or (x#>>'{}')!~'^https?://' or length(x#>>'{}')>2048)) then raise exception 'Invalid links' using errcode='22023';end if;
  if length(coalesce(p_data->>'label',''))>80 then raise exception 'Invalid label' using errcode='22023';end if;
 end if;
 result:=private.myday_action_legacy(p_id,p_operation,p_data);
 if p_operation in ('create','edit') then
  update public.actions set time_needed_minutes=case when p_data ? 'time_needed_minutes' then (p_data->>'time_needed_minutes')::integer else time_needed_minutes end,
  label=case when p_data ? 'label' then nullif(btrim(p_data->>'label'),'') else label end,
  steps=coalesce(p_data->'steps',steps),links=coalesce(p_data->'links',links) where id=p_id;
 end if;
 if p_operation='create' and nullif(p_data->>'reminder_date','') is not null then
  tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');
  update public.actions set remind_at=((p_data->>'reminder_date')::date+time '09:00') at time zone tz where id=p_id;
 end if;
 if p_operation='archive' or p_operation='edit' and p_data->>'status'='archived' then update public.actions set deleted_by=auth.uid() where id=p_id;end if;
 if p_operation='restore' then
  if a.deleted_at<now()-interval '30 days' then raise exception 'Restore period has ended' using errcode='22023';end if;
  update public.actions set deleted_by=null where id=p_id;
 end if;
 if p_operation='archive' or p_operation='status' and p_data->>'status'='done' then
  insert into private.myday_undo(owner_id,task_id,status,deleted_at,pinned_at,completed_at,expected_updated_at,expires_at)
  select auth.uid(),p_id,before_task.status,before_task.deleted_at,before_task.pinned_at,before_task.completed_at,updated_at,clock_timestamp()+interval '10 seconds' from public.actions where id=p_id
  on conflict(task_id) do update set status=excluded.status,deleted_at=excluded.deleted_at,pinned_at=excluded.pinned_at,completed_at=excluded.completed_at,expected_updated_at=excluded.expected_updated_at,expires_at=excluded.expires_at;
 end if;
 return result;
end $function$

;
revoke all on function private.myday_action_base(uuid,text,jsonb) from public,anon,authenticated,service_role;
create or replace function private.myday_action(p_id uuid,p_operation text,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare state jsonb;result uuid;begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_operation='undo' then select repeat_state into state from private.myday_undo where task_id=p_id and owner_id=auth.uid();end if;
 result:=private.myday_action_base(p_id,p_operation,p_data);
 if p_operation='undo' and state is not null then update private.myday_repeats set active=true where owner_id=auth.uid() and company_id=private.current_company_id() and id in(select (value#>>'{}')::uuid from jsonb_array_elements(state));end if;
 return result;
end$$;
revoke all on function private.myday_action(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.myday_action(uuid,text,jsonb) to authenticated;


alter table private.myday_notifications add column source_alert_id uuid;
-- Narrow service operations for delivery, provider updates and revocable calendar capabilities.
create table private.myday_vapid(singleton boolean primary key default true check(singleton),public_key text not null,secret_id uuid not null);
alter table private.myday_vapid enable row level security;
revoke all on private.myday_vapid from public,anon,authenticated,service_role;
alter table private.myday_delivery_jobs add column ready_at timestamptz;
create function private.myday_calendar_feed(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member public.profiles;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then return null;end if;
 select p.* into member from private.myday_personal_options o join public.profiles p on p.id=o.owner_id and p.company_id=o.company_id and p.active where o.calendar_hash=encode(extensions.digest(p_token,'sha256'),'hex') and o.calendar_enabled;
 if not found or not private.myday_enabled(member.company_id,'calendar') then return null;end if;
 return jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(q)) from(select id,title,due_date,due_time,due_at,time_needed_minutes,updated_at from public.actions where owner_id=member.id and company_id=member.company_id and deleted_at is null and purged_at is null and missed_at is null and status<>'done' order by due_at nulls last,id limit 2000)q),'[]'::jsonb));
end$$;
revoke all on function private.myday_calendar_feed(text) from public,anon,authenticated,service_role;
grant execute on function private.myday_calendar_feed(text) to anon,authenticated;
create function public.myday_calendar_feed(p_token text) returns jsonb language sql stable security invoker set search_path='' as $$select private.myday_calendar_feed(p_token)$$;
revoke all on function public.myday_calendar_feed(text) from public,anon,authenticated,service_role;
grant execute on function public.myday_calendar_feed(text) to anon,authenticated;
create function public.myday_delivery(p_action text,p_id uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare j private.myday_delivery_jobs;p public.profiles;o private.myday_personal_options;result jsonb:='[]';v jsonb;key_id uuid;zone text;begin
 if p_action='files_cleanup' then
  return coalesce((select jsonb_agg(f.path) from (select f.path from private.myday_files f join public.actions a on a.id=f.task_id and a.owner_id=f.owner_id and a.company_id=f.company_id where a.purged_at is not null order by f.created_at limit 100)f),'[]'::jsonb);
 elsif p_action='files_cleaned' then
  delete from private.myday_files f using public.actions a where a.id=f.task_id and a.owner_id=f.owner_id and a.company_id=f.company_id and a.purged_at is not null and f.path in(select jsonb_array_elements_text(p_data->'paths'));return '{}';
 elsif p_action='vapid_init' then
  perform pg_advisory_xact_lock(727454132);
  if not exists(select 1 from private.myday_vapid) then
   if length(p_data->>'public_key') not between 80 and 100 or p_data->'private_jwk'->>'kty'<>'EC' or p_data->'private_jwk'->>'crv'<>'P-256' then raise invalid_parameter_value;end if;
   key_id:=vault.create_secret((p_data->'private_jwk')::text,'vimbre_task_push_key');insert into private.myday_vapid(public_key,secret_id) values(p_data->>'public_key',key_id);
  end if;return (select jsonb_build_object('public_key',public_key) from private.myday_vapid);
 elsif p_action='vapid_public' then
  select * into p from public.profiles where id=(p_data->>'user')::uuid and active;
  if not found or not private.myday_enabled(p.company_id,'push') then raise insufficient_privilege;end if;
  return(select jsonb_build_object('public_key',public_key) from private.myday_vapid);
 elsif p_action='vapid_private' then
  return(select jsonb_build_object('public_key',v.public_key,'private_jwk',d.decrypted_secret::jsonb) from private.myday_vapid v join vault.decrypted_secrets d on d.id=v.secret_id);
 elsif p_action='claim' then
  update private.myday_delivery_jobs set state='uncertain' where state='claimed' and claimed_at<now()-interval '5 minutes';
  update private.myday_delivery_jobs j set state='cancelled' where j.state='pending' and not exists(select 1 from public.profiles p join private.myday_personal_options o on o.owner_id=p.id and o.company_id=p.company_id where p.id=j.owner_id and p.company_id=j.company_id and p.active and (j.kind='push' and j.created_at>now()-interval '1 day' or j.kind<>'push' and j.day=(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=p.id),'Europe/London'))::date) and (j.kind='briefing' and coalesce((o.settings->>'briefing')::boolean,false) and private.myday_enabled(p.company_id,'ai') or j.kind='digest' and coalesce((o.settings->>'digest')::boolean,false) and private.myday_enabled(p.company_id,'email') or j.kind='push' and coalesce((o.settings->>'push')::boolean,false) and private.myday_enabled(p.company_id,'push')));
  for j in select q.* from private.myday_delivery_jobs q where q.state='pending' and not private.myday_quiet(q.owner_id,now()) order by q.created_at,q.id for update skip locked limit 5 loop
   update private.myday_delivery_jobs set state='claimed',claimed_at=now() where id=j.id;
   result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'kind',j.kind));
  end loop;return result;
 end if;
 select * into j from private.myday_delivery_jobs where id=p_id and state='claimed' for update;if not found then raise insufficient_privilege;end if;
 select * into p from public.profiles where id=j.owner_id and company_id=j.company_id and active;if not found then update private.myday_delivery_jobs set state='cancelled' where id=j.id;return null;end if;
 select * into o from private.myday_personal_options where owner_id=p.id;zone:=coalesce((select timezone from public.work_preferences where owner_id=p.id),'Europe/London');
 if p_action='source' then
  if j.kind='push' then
   if exists(select 1 from private.myday_notifications n join public.task_alerts alert on alert.id=n.source_alert_id join public.actions a on a.id=alert.task_id where n.id=j.notification_id and (a.status='done' or a.deleted_at is not null or a.purged_at is not null or a.missed_at is not null or a.reminder_cycle<>alert.cycle or alert.read_at is not null)) then return null;end if;
   return jsonb_build_object('kind',j.kind,'owner_id',p.id,'notice',(select jsonb_build_object('id',n.id,'owner_id',p.id,'title',n.title,'body',n.body,'path',case when n.source_alert_id is not null then '/app?task='||n.task_id::text||'&task_action=remind' when n.task_id is not null then '/app?comment_task='||n.task_id::text else '/app' end) from private.myday_notifications n where n.id=j.notification_id and n.owner_id=p.id),'subscriptions',coalesce((select jsonb_agg(subscription) from private.myday_push where owner_id=p.id and company_id=p.company_id),'[]'::jsonb));
  end if;
  v:=jsonb_build_object('today',j.day,'timezone',zone,'working_hours',o.settings,'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',left(title,160),'status',status,'due_date',due_date,'due_time',due_time,'starred',pinned_at is not null,'time_needed_minutes',time_needed_minutes)) from(select * from public.actions where owner_id=p.id and company_id=p.company_id and deleted_at is null and purged_at is null and missed_at is null and (status<>'done' or (completed_at at time zone zone)::date=j.day) order by (pinned_at is not null) desc,due_at nulls last,created_at,id limit 40)q),'[]'::jsonb));
  return jsonb_build_object('kind',j.kind,'day',j.day,'owner_id',p.id,'company_id',p.company_id,'email',p.email,'name',p.full_name,'email_enabled',private.myday_enabled(p.company_id,'email') and coalesce((select email_enabled from public.work_preferences where owner_id=p.id),true),'source',v,'cached',(select output from private.myday_ai_cache where owner_id=p.id and kind='day_briefing' and fingerprint=encode(extensions.digest(v::text,'sha256'),'hex')),'fingerprint',encode(extensions.digest(v::text,'sha256'),'hex'));
 elsif p_action='briefing_ready' then
  if j.kind<>'briefing' or not private.myday_enabled(p.company_id,'ai') or length(p_data->>'output')>16000 then raise invalid_parameter_value;end if;
  insert into private.myday_ai_cache(owner_id,kind,fingerprint,output) values(p.id,'day_briefing',p_data->>'fingerprint',p_data->>'output') on conflict(owner_id,kind,fingerprint) do nothing;
  if j.ready_at is null then perform private.myday_notify(p.id,p.company_id,null,null,'Daily briefing',p_data->>'output');update private.myday_delivery_jobs set ready_at=now() where id=j.id;end if;return '{}'::jsonb;
 elsif p_action='push_remove' then
  delete from private.myday_push where owner_id=p.id and company_id=p.company_id and endpoint=p_data->>'endpoint';return '{}'::jsonb;
 elsif p_action='finish' then
  if p_data->>'state' not in('sent','failed','uncertain','cancelled') then raise invalid_parameter_value;end if;
  update private.myday_delivery_jobs set state=p_data->>'state' where id=j.id;return '{}'::jsonb;
 end if;raise invalid_parameter_value;
end$$;
revoke all on function public.myday_delivery(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.myday_delivery(text,uuid,jsonb) to service_role;
-- Reuse the existing scheduler credential; neither device registration nor clients receive it.
create or replace function private.dispatch_task_mail() returns void language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from private.task_delivery_config where enabled) and (exists(select 1 from private.task_mail_queue where state='pending') or exists(select 1 from private.myday_delivery_jobs where state='pending') or exists(select 1 from private.myday_files f join public.actions a on a.id=f.task_id where a.purged_at is not null)) then
  perform net.http_post(url:='https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/my-day-mail',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myday_dispatch_token')),body:='{}'::jsonb,timeout_milliseconds:=10000);
 end if;
end$$;

create function private.myday_alert_push() returns trigger language plpgsql security definer set search_path='' as $$declare notification uuid;begin
 if private.myday_enabled(new.company_id,'push') and coalesce((select (settings->>'push')::boolean from private.myday_personal_options where owner_id=new.owner_id),false) then
  insert into private.myday_notifications(owner_id,company_id,task_id,title,body,source_alert_id) select new.owner_id,new.company_id,new.task_id,case when new.phase='check_in' then 'Task still open' else 'Task reminder' end,title,new.id from public.actions where id=new.task_id returning id into notification;
  insert into private.myday_delivery_jobs(owner_id,company_id,kind,day,notification_id,unique_key) values(new.owner_id,new.company_id,'push',(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=new.owner_id),'Europe/London'))::date,notification,'push-alert:'||new.id::text) on conflict do nothing;
 end if;return new;
end$$;
revoke all on function private.myday_alert_push() from public,anon,authenticated,service_role;
create trigger myday_alert_push after insert on public.task_alerts for each row execute function private.myday_alert_push();


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


-- Preserve Capture's all-or-none confirmation and one-result invariant while adding pending assignments.
alter table public.capture_items add column assignment_id uuid references private.myday_assignments(id);
do $$declare constraint_row record;definition text;before_body text;after_body text;begin
 for constraint_row in select conname,pg_get_constraintdef(oid) as body from pg_constraint where conrelid='public.capture_items'::regclass and contype='c' and pg_get_constraintdef(oid) like '%num_nonnulls%' loop
  definition:=regexp_replace(constraint_row.body,'num_nonnulls\(([^)]*)\)','num_nonnulls(\1, assignment_id)','g');
  execute format('alter table public.capture_items drop constraint %I',constraint_row.conname);
  execute format('alter table public.capture_items add constraint %I %s',constraint_row.conname,definition);
 end loop;
 before_body:=pg_get_functiondef('private.capture_change(text,uuid,uuid,jsonb)'::regprocedure);
 after_body:=replace(before_body,'coalesce(d.decision_id,d.action_id,d.contact_id,d.summary_id)','coalesce(d.decision_id,d.action_id,d.contact_id,d.summary_id,d.assignment_id)');
 after_body:=replace(after_body,$old$  elsif d.kind='action' then
   insert into public.actions$old$,$new$  elsif d.kind='action' and own<>u then
   target:=gen_random_uuid();
   perform private.myday_suite('assign',target,jsonb_build_object('recipient_id',own,'title',data->>'title','details',coalesce(data->>'details',''),'due_date',data->>'due_date'));
   update public.capture_items set assignment_id=target,status='confirmed',reviewed_at=now(),version=version+1 where id=d.id;
  elsif d.kind='action' then
   insert into public.actions$new$);
 if after_body=before_body or strpos(after_body,$check$d.kind='action' and own<>u$check$)=0 then raise exception 'Capture confirmation definition changed; review before installing';end if;
 execute after_body;
end$$;


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

