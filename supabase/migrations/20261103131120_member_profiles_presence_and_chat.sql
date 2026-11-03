create table private.member_profiles(user_id uuid primary key references public.profiles(id)on delete cascade,company_id uuid not null references public.companies(id),display_name text not null default '' check(length(display_name)<=100),job_title text not null default '' check(length(job_title)<=100),avatar_path text,availability text not null default 'active' check(availability in ('active','away','offline')),updated_at timestamptz not null default now());
create table private.member_presence(user_id uuid primary key references public.profiles(id)on delete cascade,company_id uuid not null,seen_at timestamptz not null,active_at timestamptz,meter_at timestamptz not null,meter_active boolean not null default false);
create table private.member_active_days(user_id uuid references public.profiles(id)on delete cascade,company_id uuid not null,day date not null,seconds integer not null default 0 check(seconds between 0 and 86400),primary key(user_id,day));
alter table private.member_profiles enable row level security;alter table private.member_presence enable row level security;alter table private.member_active_days enable row level security;
revoke all on private.member_profiles,private.member_presence,private.member_active_days from public,anon,authenticated,service_role,console_backend;
create function private.member_name(p_user uuid)returns text language sql stable security definer set search_path=''as $$select coalesce(nullif(m.display_name,''),p.full_name)from public.profiles p left join private.member_profiles m on m.user_id=p.id and m.company_id=p.company_id where p.id=p_user$$;
revoke all on function private.member_name(uuid)from public,anon,authenticated,service_role,console_backend;
create function private.member_public(p_user uuid)returns jsonb language sql stable security definer set search_path=''as $$
 select jsonb_build_object('id',p.id,'company_id',p.company_id,'full_name',private.member_name(p.id),'job_title',coalesce(m.job_title,''),'avatar_path',m.avatar_path,'availability',coalesce(m.availability,'active'),'presence',case when not p.active or m.availability='offline'or s.seen_at is null or s.seen_at<now()-interval '100 seconds'then 'offline'when m.availability='away'or s.active_at is null or s.active_at<now()-interval '5 minutes'then 'away'else 'active'end,'last_active',case when m.availability='offline'then null else s.active_at end)from public.profiles p left join private.member_profiles m on m.user_id=p.id and m.company_id=p.company_id left join private.member_presence s on s.user_id=p.id and s.company_id=p.company_id where p.id=p_user and p.company_id=(select company_id from public.profiles where id=auth.uid()and active)
$$;
revoke all on function private.member_public(uuid)from public,anon,authenticated,service_role,console_backend;
create function private.member_profile(p_data jsonb default null)returns jsonb language plpgsql security definer set search_path=''as $$declare v public.profiles;result jsonb;begin
 select *into v from public.profiles where id=auth.uid()and active;if not found then raise insufficient_privilege;end if;
 if p_data is not null then
 if jsonb_typeof(p_data)<>'object'or exists(select 1 from jsonb_object_keys(p_data)k where k not in ('display_name','job_title','avatar_path','availability'))or octet_length(p_data::text)>2000 then raise invalid_parameter_value;end if;
 if p_data?'display_name'and(char_length(btrim(p_data->>'display_name'))not between 1 and 100)or p_data?'job_title'and char_length(p_data->>'job_title')>100 or p_data?'availability'and p_data->>'availability'not in ('active','away','offline')then raise invalid_parameter_value;end if;
 if p_data?'avatar_path'and p_data->>'avatar_path'is not null and not exists(select 1 from storage.objects where bucket_id='member-avatars'and name=p_data->>'avatar_path'and name like v.company_id::text||'/'||v.id::text||'/%')then raise check_violation using message='Upload your profile picture first';end if;
 insert into private.member_profiles(user_id,company_id,display_name,job_title,avatar_path,availability)values(v.id,v.company_id,coalesce(btrim(p_data->>'display_name'),''),coalesce(btrim(p_data->>'job_title'),''),p_data->>'avatar_path',coalesce(p_data->>'availability','active'))on conflict(user_id)do update set company_id=v.company_id,display_name=case when p_data?'display_name'then btrim(p_data->>'display_name')else member_profiles.display_name end,job_title=case when p_data?'job_title'then btrim(p_data->>'job_title')else member_profiles.job_title end,avatar_path=case when p_data?'avatar_path'then p_data->>'avatar_path'else member_profiles.avatar_path end,availability=case when p_data?'availability'then p_data->>'availability'else member_profiles.availability end,updated_at=now();
 end if;
 result:=private.member_public(v.id);return result||jsonb_build_object('company_id',v.company_id,'display_name',coalesce((select display_name from private.member_profiles where user_id=v.id),v.full_name));
end$$;
create function public.member_profile(p_data jsonb default null)returns jsonb language sql security invoker set search_path=''as $$select private.member_profile(p_data)$$;
revoke all on function private.member_profile(jsonb),public.member_profile(jsonb)from public,anon,service_role,console_backend;grant execute on function private.member_profile(jsonb),public.member_profile(jsonb)to authenticated;
create function private.member_heartbeat(p_active boolean default true)returns jsonb language plpgsql security definer set search_path=''as $$declare v public.profiles;s private.member_presence;mode text;tz text;today date;credit int:=0;begin
 select *into v from public.profiles where id=auth.uid()and active;if not found then raise insufficient_privilege;end if;
 select availability into mode from private.member_profiles where user_id=v.id and company_id=v.company_id;if mode='offline'then return private.member_public(v.id);end if;
 perform 1 from public.profiles where id=v.id for update;
 select *into s from private.member_presence where user_id=v.id;
 if found and s.seen_at>now()-interval '15 seconds'then return private.member_public(v.id);end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=v.id),'Europe/London');today:=(now()at time zone tz)::date;
 if s.company_id=v.company_id and s.meter_active and s.meter_at>now()-interval '70 seconds'and p_active and coalesce(mode,'active')='active'then credit:=least(60,greatest(0,extract(epoch from now()-greatest(s.meter_at,today::timestamp at time zone tz))::int));end if;
 insert into private.member_active_days(user_id,company_id,day,seconds)values(v.id,v.company_id,today,credit)on conflict(user_id,day)do update set seconds=least(86400,member_active_days.seconds+excluded.seconds);
 insert into private.member_presence(user_id,company_id,seen_at,active_at,meter_at,meter_active)values(v.id,v.company_id,now(),case when p_active then now()end,now(),p_active and coalesce(mode,'active')='active')on conflict(user_id)do update set company_id=v.company_id,seen_at=now(),active_at=case when p_active then now()else member_presence.active_at end,meter_at=now(),meter_active=p_active and coalesce(mode,'active')='active';return private.member_public(v.id);
end$$;
create function public.member_heartbeat(p_active boolean default true)returns jsonb language sql security invoker set search_path=''as $$select private.member_heartbeat(p_active)$$;
revoke all on function private.member_heartbeat(boolean),public.member_heartbeat(boolean)from public,anon,service_role,console_backend;grant execute on function private.member_heartbeat(boolean),public.member_heartbeat(boolean)to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('member-avatars','member-avatars',false,1048576,array['image/webp','image/jpeg','image/png'])on conflict(id)do nothing;
create policy member_avatars_read on storage.objects for select to authenticated using(bucket_id='member-avatars'and(storage.foldername(name))[1]=(select private.current_company_id())::text);
create policy member_avatars_insert on storage.objects for insert to authenticated with check(bucket_id='member-avatars'and(storage.foldername(name))[1]=(select private.current_company_id())::text and(storage.foldername(name))[2]=(select auth.uid())::text);
create policy member_avatars_delete on storage.objects for delete to authenticated using(bucket_id='member-avatars'and(storage.foldername(name))[1]=(select private.current_company_id())::text and(storage.foldername(name))[2]=(select auth.uid())::text);
create function private.chat_rename(p_conversation uuid,p_title text)returns void language plpgsql security definer set search_path=''as $$declare v public.profiles;c public.chat_conversations;begin
 select *into v from public.profiles where id=auth.uid()and active;if not found or not private.chat_can_access(p_conversation)then raise insufficient_privilege;end if;
 select *into c from public.chat_conversations where id=p_conversation and company_id=v.company_id for update;
 if c.kind<>'group'or c.is_team and c.created_by<>v.id and v.role<>'hr_admin'then raise insufficient_privilege;end if;
 if p_title is null or length(btrim(p_title))not between 1 and 80 then raise check_violation using message='Enter a chat name of up to 80 characters';end if;
 update public.chat_conversations set title=btrim(p_title),updated_at=now()where id=c.id;
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action)values(v.company_id,v.id,'chat',c.id,'chat_renamed');
end$$;
create function public.chat_rename(p_conversation uuid,p_title text)returns void language sql security invoker set search_path=''as $$select private.chat_rename(p_conversation,p_title)$$;
revoke all on function private.chat_rename(uuid,text),public.chat_rename(uuid,text)from public,anon,service_role,console_backend;grant execute on function private.chat_rename(uuid,text),public.chat_rename(uuid,text)to authenticated;
create function private.chat_group_create(p_title text,p_members uuid[] default null)returns uuid language plpgsql security definer set search_path=''as $$declare v public.profiles;members uuid[];begin
 select *into v from public.profiles where id=auth.uid()and active;if not found then raise insufficient_privilege;end if;
 if p_members is null then select array_agg(id)into members from public.profiles where company_id=v.company_id and active and id<>v.id;else members:=p_members;end if;
 if coalesce(cardinality(members),0)>49 then raise check_violation using message='Choose up to 49 teammates for this chat';end if;
 return private.chat_create('group',p_title,coalesce(members,'{}'));
end$$;
create function public.chat_group_create(p_title text,p_members uuid[] default null)returns uuid language sql security invoker set search_path=''as $$select private.chat_group_create(p_title,p_members)$$;
revoke all on function private.chat_group_create(text,uuid[]),public.chat_group_create(text,uuid[])from public,anon,service_role,console_backend;grant execute on function private.chat_group_create(text,uuid[]),public.chat_group_create(text,uuid[])to authenticated;
CREATE OR REPLACE FUNCTION private.chat_detail(p_conversation uuid, p_before bigint, p_anchor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; anchor_seq bigint;
begin
 if not private.chat_can_access(p_conversation) then raise insufficient_privilege using message='This conversation is not available'; end if;
 if p_anchor is not null then select seq into anchor_seq from public.chat_messages where id=p_anchor and conversation_id=p_conversation; if not found then raise exception 'Message not found' using errcode='22023'; end if; end if;
 with rows as (
 select m.id,m.seq,m.sender_id,private.member_name(p.id)as sender_name,m.body,m.reply_to,m.mentions,m.record_path,m.created_at,
 case when r.id is not null then jsonb_build_object('id',r.id,'body',left(r.body,160),'sender_name',private.member_name(rp.id)) end as reply,
 coalesce((select jsonb_agg(jsonb_build_object('id',mp.id,'name',private.member_name(mp.id))) from public.profiles mp where mp.id=any(m.mentions)),'[]'::jsonb) as mention_names
 from public.chat_messages m join public.profiles p on p.id=m.sender_id
 left join public.chat_messages r on r.id=m.reply_to left join public.profiles rp on rp.id=r.sender_id
 where m.conversation_id=p_conversation and (p_before is null or m.seq<p_before) and (anchor_seq is null or m.seq<=anchor_seq)
 order by m.seq desc limit 50
 ) select jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(rows) order by seq) from rows),'[]'::jsonb),
 'members',(select jsonb_agg(private.member_public(p.id)||jsonb_build_object('id',p.id,'company_id',p.company_id,'full_name',private.member_name(p.id),'active',p.active,'last_read_seq',cm.last_read_seq,'joined_at',cm.joined_at) order by p.full_name,p.id) from public.chat_members cm join public.profiles p on p.id=cm.user_id where cm.conversation_id=p_conversation),
 'kind',(select kind from public.chat_conversations where id=p_conversation),
 'can_rename',(select c.kind='group'and(not c.is_team or c.created_by=auth.uid()or exists(select 1 from public.profiles where id=auth.uid()and role='hr_admin'))from public.chat_conversations c where id=p_conversation),'title',(select title from public.chat_conversations where id=p_conversation)) into result;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION private.chat_people(p_search text, p_page integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare viewer public.profiles; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 if p_search is null or char_length(p_search)>100 or p_page is null or p_page<0 or p_page>10000 then raise exception 'Invalid search' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
 select id,private.member_name(id)as full_name,role,private.member_public(id)as person from public.profiles where company_id=viewer.company_id and active and id<>viewer.id
 and strpos(lower(private.member_name(id)),lower(btrim(p_search)))>0 order by full_name,id limit 50 offset p_page*50) r;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION private.chat_list(p_page integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare viewer public.profiles; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 if p_page is null or p_page<0 or p_page>10000 then raise exception 'Invalid page' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by updated_at desc,id),'[]'::jsonb) into result from (
 select c.is_team,c.id,c.kind,(select private.member_public(cm.user_id)from public.chat_members cm where cm.conversation_id=c.id and cm.user_id<>viewer.id order by cm.user_id limit 1)as person,case when c.kind='direct' then coalesce((select private.member_name(p.id)from public.chat_members cm join public.profiles p on p.id=cm.user_id where cm.conversation_id=c.id and cm.user_id<>viewer.id limit 1),'Teammate') else c.title end as title,c.updated_at,
 (select left(body,120) from public.chat_messages where conversation_id=c.id order by seq desc limit 1) as preview,
 (select count(*)::integer from public.chat_messages where conversation_id=c.id and sender_id<>viewer.id and seq>m.last_read_seq) as unread
 from public.chat_members m join public.chat_conversations c on c.id=m.conversation_id
 where m.user_id=viewer.id and m.company_id=viewer.company_id order by c.updated_at desc,c.id limit 50 offset p_page*50) r;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION private.chat_inbox()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare viewer public.profiles; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 with unread as materialized (
 select n.id,n.conversation_id,n.message_id,n.mentioned,n.created_at,private.member_name(p.id)as sender_name,left(msg.body,120) as preview,
 case when c.kind='direct' then private.member_name(p.id) else c.title end as title
 from public.chat_notifications n join public.chat_members m on m.conversation_id=n.conversation_id and m.user_id=viewer.id and m.company_id=viewer.company_id
 join public.chat_messages msg on msg.id=n.message_id join public.profiles p on p.id=msg.sender_id join public.chat_conversations c on c.id=n.conversation_id
 where n.recipient_id=viewer.id and n.company_id=viewer.company_id and msg.seq>m.last_read_seq
 ) select jsonb_build_object('unread',(select count(*) from unread),'mentions',(select count(*) from unread where mentioned),
 'items',coalesce((select jsonb_agg(to_jsonb(r) order by id desc) from (select * from unread order by id desc limit 30) r),'[]'::jsonb)) into result;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION private.team_activity_overview(p_search text, p_page integer, p_timezone text, p_member uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare viewer public.profiles; work_today date; week_start date; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found or viewer.role not in ('hr_admin','manager') then
  raise insufficient_privilege using message='Team activity is not available';
 end if;
 if p_page is null or p_page<0 or p_page>100000 or p_search is null or char_length(p_search)>100 or
    p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
  raise exception 'Invalid overview request' using errcode='22023';
 end if;
 if p_member is not null and not exists(select 1 from public.profiles p where p.id=p_member and p.active
   and p.company_id=viewer.company_id and (viewer.role='hr_admin' or (viewer.department_id is not null and p.department_id=viewer.department_id))) then
  raise insufficient_privilege using message='Team member is not available';
 end if;
 work_today:=(now() at time zone p_timezone)::date;
 week_start:=date_trunc('week',now() at time zone p_timezone)::date;
 with members as materialized (
  select id,private.member_name(id)as full_name from public.profiles p where p.company_id=viewer.company_id and p.active
  and (viewer.role='hr_admin' or (viewer.department_id is not null and p.department_id=viewer.department_id))
 ), task_counts as (
  select a.owner_id,count(*)filter(where a.status='in_progress')::int as tasks_in_progress,
   count(*) filter(where a.status='done' and a.completed_at>=week_start::timestamp at time zone p_timezone and a.completed_at<=now())::integer as tasks_done,
   count(*) filter(where a.status<>'done' and a.due_date<work_today)::integer as tasks_overdue
  from public.actions a join members m on m.id=a.owner_id where a.company_id=viewer.company_id and a.deleted_at is null group by a.owner_id
 ), draft_counts as (
  select i.owner_id,count(*)::integer as drafts_waiting from public.capture_items i join members m on m.id=i.owner_id
  join public.captures c on c.id=i.capture_id and c.owner_id=i.owner_id and c.company_id=i.company_id
  where i.company_id=viewer.company_id and i.status='pending' and c.deleted_at is null group by i.owner_id
 ), metrics as materialized (
  select m.id,m.full_name,coalesce(t.tasks_in_progress,0)as tasks_in_progress,coalesce(t.tasks_done,0) as tasks_done,coalesce(t.tasks_overdue,0) as tasks_overdue,
   coalesce(d.drafts_waiting,0) as drafts_waiting,null::text as handover_status,
   not exists(select 1 from public.role_items r where r.company_id=viewer.company_id and r.owner_id=m.id and r.deleted_at is null)
   and not exists(select 1 from public.decisions r where r.company_id=viewer.company_id and r.owner_id=m.id and r.deleted_at is null) as no_role_record
  from members m left join task_counts t on t.owner_id=m.id left join draft_counts d on d.owner_id=m.id
 ), filtered as materialized (
  select * from metrics where (p_member is null or id=p_member) and strpos(lower(full_name),lower(btrim(p_search)))>0
 ), paged as (
  select * from filtered order by full_name,id limit 20 offset p_page*20
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(paged)||private.member_public(paged.id)||jsonb_build_object('active_seconds',case when coalesce((select availability from private.member_profiles where user_id=paged.id),'active')='offline'then null else(select seconds from private.member_active_days where user_id=paged.id and company_id=viewer.company_id and day=(now()at time zone coalesce((select timezone from public.work_preferences where owner_id=paged.id),p_timezone))::date)end,'working_on',coalesce((select jsonb_agg(to_jsonb(w))from(select a.title,a.status,a.due_date from public.actions a where a.owner_id=paged.id and a.company_id=viewer.company_id and a.deleted_at is null and a.purged_at is null and a.status='in_progress'order by a.updated_at desc limit 3)w),'[]'),'open_tasks',(select count(*)from public.actions where owner_id=paged.id and company_id=viewer.company_id and deleted_at is null and purged_at is null and status in ('open','in_progress')))order by full_name,id) from paged),'[]'::jsonb),
  'count',(select count(*) from filtered),
  'total_active_count',private.company_active_member_count(),
  'scope',case when viewer.role='hr_admin' then 'company' else 'department' end,
  'today',work_today,'week_start',week_start,
  'flags',jsonb_build_object('tasks_in_progress',coalesce((select sum(tasks_in_progress)from metrics),0),'tasks_done',coalesce((select sum(tasks_done)from metrics),0),'overdue_tasks',coalesce((select sum(tasks_overdue) from metrics),0),
    'handovers_not_started',null,'people_without_role_record',(select count(*) from metrics where no_role_record)),
  'handovers_available',false
 ) into result;
 return result;
end; $function$;
