-- Keep push delivery records out of the task inbox, count completed tasks for badges,
-- and classify My Day using the task's saved calendar date.

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
 coalesce(a.due_date,(a.due_at at time zone tz)::date) as due_day,
 a.status<>'done' and (coalesce(a.due_date,(a.due_at at time zone tz)::date)<today or coalesce(a.due_date,(a.due_at at time zone tz)::date)=today or a.pinned_at is not null) as in_today
 from public.actions a left join public.captures cp on cp.id=a.capture_id and cp.owner_id=u left join public.departments d on d.id=a.department_id left join public.role_items r on r.id=a.external_contact_id
 left join public.role_items ri on ri.id=coalesce(a.source_role_id,a.stable_role_item_id,a.recurring_id)
 where a.owner_id=u and a.purged_at is null and (a.missed_at is null or p_filter in ('all','archived')) and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_source='' or a.source_kind=p_source) and (p_priority='' or a.priority=p_priority)
 ), filtered as materialized(select * from base where (deleted_at is not null)=(p_filter='archived')
 and (p_filter in ('all','archived') or p_filter='today' and in_today and (due_day>=today or due_day is null) or p_filter='done' and status='done' or p_filter='week' and status<>'done' and due_day between today and today+6 or p_filter='overdue' and status<>'done' and due_day<today)),
 ranked as(select *,row_number() over(order by case when metadata->>'plan_day'=today::text and metadata->>'plan_order' ~ '^[0-9]{1,3}$' then (metadata->>'plan_order')::int else 1000 end,(pinned_at is not null) desc,due_at,created_at,id) as rank from filtered),
 paged as(select * from ranked order by rank limit case when p_filter='today' then null else 60 end offset case when p_filter='today' then 0 else p_page*60 end)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by rank) from paged),'[]'::jsonb),'count',(select count(*) from filtered),'today',today,'timezone',tz,
 'tab_counts',totals->'tab_counts',
 'undated',coalesce((select jsonb_agg(to_jsonb(q) order by created_at,id) from base q where deleted_at is null and status<>'done' and due_date is null and missed_at is null),'[]'::jsonb),
 'overdue_rows',coalesce((select jsonb_agg(to_jsonb(q) order by (pinned_at is not null) desc,due_at,created_at,id) from base q where deleted_at is null and status<>'done' and due_day<today),'[]'::jsonb),
 'counts',totals->'counts',
 'has_work',exists(select 1 from public.actions where owner_id=u) or exists(select 1 from public.role_items where owner_id=u),
 'review_assignments',private.myday_incoming(),'context_waiting',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.actions where owner_id=u and status='done' and deleted_at is null and context_added_at is null order by completed_at desc limit 10)q),'[]'::jsonb),
 'done_today',coalesce((select jsonb_agg(to_jsonb(q) order by completed_at desc,id) from base q where deleted_at is null and status='done' and (completed_at at time zone tz)::date=today),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(to_jsonb(q) order by (pinned_at is not null) desc,due_at,created_at,id) from base q where deleted_at is null and status<>'done' and pinned_at is null and (due_day between today+1 and today+7 or due_day is null)),'[]'::jsonb),
 'review_drafts',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'capture_id',i.capture_id,'kind',i.kind,'version',i.version,'payload',i.payload,'duplicate',(i.kind='action' and exists(select 1 from public.actions a where a.owner_id=u and a.deleted_at is null and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))) or i.kind='decision' and exists(select 1 from public.decisions a where a.owner_id=u and a.deleted_at is null and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))) or i.kind='summary' and exists(select 1 from public.capture_summaries a where a.owner_id=u and lower(btrim(a.title))=lower(btrim(i.payload->>'title'))))) order by i.created_at,i.id) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.status='pending' and c.deleted_at is null and strpos(lower(i.payload->>'title'),lower(p_query))>0),'[]'::jsonb),
 'drafts_waiting',(select count(*) from public.capture_items i join public.captures c on c.id=i.capture_id where i.owner_id=u and i.status='pending' and c.deleted_at is null and strpos(lower(i.payload->>'title'),lower(p_query))>0),
 'decisions_waiting',0,
 'handovers_waiting',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title)) from public.work_handovers h where h.company_id=private.current_company_id() and h.deleted_at is null and h.reviewer_id=u and exists (
  select 1
  from public.profiles reviewer
  where reviewer.id = u
    and reviewer.active
    and reviewer.company_id = h.company_id
    and reviewer.role in ('manager','hr_admin')
)
and (h.status='pending' or h.status='approved' and h.approved_version is not null and h.version>h.approved_version)),'[]'::jsonb),
 'covering',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'owner_name',p.full_name,'owner_id',p.id)) from public.work_handovers h join public.profiles p on p.id=h.owner_id and p.active where h.cover_id=u and h.status='approved' and h.company_id=private.current_company_id() and h.deleted_at is null and today between h.starts_on and coalesce(h.ends_on,'infinity'::date)),'[]'::jsonb),
 'cover_tasks',private.myday_cover_tasks(), 'returning_handovers',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title)) from public.work_handovers h where h.owner_id=u and h.company_id=private.current_company_id() and h.status='approved' and h.deleted_at is null and h.ends_on<=today),'[]'::jsonb),
 'checklist',jsonb_build_object('capture',exists(select 1 from public.captures where owner_id=u),'role',exists(select 1 from public.role_items where owner_id=u and deleted_at is null) or exists(select 1 from public.decisions where owner_id=u and deleted_at is null),'reminder',exists(select 1 from public.actions where owner_id=u and deleted_at is null and remind_at is not null),'cover',exists(select 1 from public.work_handovers where owner_id=u and status<>'cancelled'))
 ) into result;return result;
end $function$;

CREATE OR REPLACE FUNCTION private.myday_suite(p_operation text, p_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare recipient_ids uuid[];department_ids uuid[];source_ids uuid[];recipient_id uuid;source_id uuid;assignment_id uuid;src public.actions;draft public.capture_items;sent int:=0;result jsonb;u uuid:=auth.uid();c uuid:=private.current_company_id();begin

 if p_operation in ('assign_people','assign_many','review_note') then
  if u is null or c is null or not exists(select 1 from public.profiles where id=u and active and company_id=c) then raise insufficient_privilege;end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>150000 then raise invalid_parameter_value;end if;
  if p_operation='assign_people' then
   return jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,full_name as name,role,department_id from public.profiles where company_id=c and active and id<>u order by full_name limit 1000)q),'[]'::jsonb),
    'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from public.departments where company_id=c and archived_at is null),'[]'::jsonb));
  elsif p_operation='review_note' then
   if char_length(coalesce(p_data->>'note',''))>4000 then raise invalid_parameter_value;end if;
   select ci.* into draft from public.capture_items ci join public.captures ca on ca.id=ci.capture_id where ci.id=p_id and ci.owner_id=u and ci.company_id=c and ci.status='pending' and ca.owner_id=u and ca.company_id=c and ca.deleted_at is null for update of ci;
   if not found then raise insufficient_privilege;end if;
   if draft.version is distinct from (p_data->>'version')::int then raise exception 'Draft changed. Reload before commenting.' using errcode='40001';end if;
   update public.capture_items set payload=payload||jsonb_build_object('review_comment',btrim(coalesce(p_data->>'note',''))),version=version+1 where id=draft.id;
   return to_jsonb(draft.version+1);
  end if;
  if p_id is null or jsonb_typeof(coalesce(p_data->'recipient_ids','[]'))<>'array' or jsonb_typeof(coalesce(p_data->'department_ids','[]'))<>'array' or jsonb_typeof(coalesce(p_data->'ids','[]'))<>'array' then raise invalid_parameter_value;end if;
  if jsonb_array_length(coalesce(p_data->'recipient_ids','[]'))>100 or jsonb_array_length(coalesce(p_data->'department_ids','[]'))>20 or jsonb_array_length(coalesce(p_data->'ids','[]'))>20 then raise exception 'Select up to 20 tasks and 100 teammates' using errcode='22023';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into department_ids from jsonb_array_elements_text(coalesce(p_data->'department_ids','[]'));
  if exists(select 1 from unnest(department_ids)d where not exists(select 1 from public.departments where id=d and company_id=c and archived_at is null)) then raise insufficient_privilege;end if;
  select coalesce(array_agg(distinct value),'{}') into recipient_ids from (
   select value::uuid from jsonb_array_elements_text(coalesce(p_data->'recipient_ids','[]'))
   union select id from public.profiles where company_id=c and active and department_id=any(department_ids) and id<>u
  )q;
  if cardinality(recipient_ids) not between 1 and 100 then raise exception 'Choose 1 to 100 active teammates' using errcode='22023';end if;
  if exists(select 1 from unnest(recipient_ids)r where not exists(select 1 from public.profiles where id=r and company_id=c and active and id<>u)) then raise insufficient_privilege;end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into source_ids from jsonb_array_elements_text(coalesce(p_data->'ids','[]'));
  if cardinality(source_ids)=0 then source_ids:=array[nullif(p_data->>'source_task','')::uuid];end if;
  if cardinality(source_ids)*cardinality(recipient_ids)>200 then raise exception 'Send at most 200 individual requests at once' using errcode='22023';end if;
  foreach source_id in array source_ids loop
   src:=null;
   if source_id is not null then select * into src from public.actions where id=source_id and company_id=c and owner_id=u and deleted_at is null and purged_at is null;
    if not found then raise insufficient_privilege;end if;
   end if;
   if char_length(btrim(coalesce(src.title,p_data->>'title',''))) not between 1 and 300 or char_length(coalesce(p_data->>'details',''))>5000 then raise invalid_parameter_value;end if;
   foreach recipient_id in array recipient_ids loop
    assignment_id:=md5(u::text||':'||p_id::text||':'||coalesce(source_id::text,'new')||':'||recipient_id::text)::uuid;
    if not exists(select 1 from private.myday_assignments where id=assignment_id and creator_id=u and company_id=c) then
     perform private.myday_suite_role_notice_base('assign',assignment_id,jsonb_build_object('recipient_id',recipient_id,'source_task',source_id,'title',coalesce(src.title,p_data->>'title'),'details',coalesce(p_data->>'details',''),'due_date',coalesce(src.due_date::text,p_data->>'due_date')));
    end if;
    sent:=sent+1;
   end loop;
  end loop;
  return jsonb_build_object('sent',sent);
 end if;

 if p_operation<>'notifications' then return private.myday_suite_role_notice_base(p_operation,p_id,p_data);end if;
 if u is null or c is null or not exists(select 1 from public.profiles where id=u and active and company_id=c) then raise insufficient_privilege;end if;
 with latest as (
 select distinct on (coalesce(n.task_id,n.id)) n.id,n.title,n.body,n.task_id,n.assignment_id,n.created_at,a.status task_status
 from private.myday_notifications n left join public.actions a on a.id=n.task_id and a.owner_id=u and a.company_id=c
 where n.owner_id=u and n.company_id=c and n.read_at is null and n.source_alert_id is null and n.source_chat_message is null
 and (n.task_id is null or a.id is not null and a.deleted_at is null and a.purged_at is null)
 order by coalesce(n.task_id,n.id),n.created_at desc,n.id
 ),page as(select * from latest order by created_at desc limit 100)
 select jsonb_build_object('unread',(select count(*) from latest),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;return result;
end$function$;

CREATE OR REPLACE FUNCTION private.myday_stars_period(p_day date DEFAULT NULL::date, p_period text DEFAULT 'week'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();c uuid;department uuid;tz text;v_day date;mode text;week_start date;period_end date;previous_start date;visible boolean;begin
 select company_id,department_id into c,department from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');v_day:=(now() at time zone tz)::date;if p_period not in ('week','month') then raise invalid_parameter_value;end if;week_start:=date_trunc(p_period,coalesce(p_day,v_day))::date;period_end:=case when p_period='month' then (week_start+interval '1 month')::date else week_start+7 end;previous_start:=case when p_period='month' then (week_start-interval '1 month')::date else week_start-7 end;
 if week_start>date_trunc(p_period,v_day)::date or week_start<v_day-interval '5 years' then raise invalid_parameter_value;end if;
 mode:=coalesce((select x.mode from private.myday_competition x where company_id=c),'off');visible:=coalesce((select s.visible from private.myday_star_consent s where owner_id=u and company_id=c),false);
 return jsonb_build_object('week_start',week_start,'week_end',period_end-1,'period',p_period,'today_date',v_day,'completed_tasks',(select count(*)from public.actions a where a.owner_id=u and a.company_id=c and a.status='done' and a.deleted_at is null and (a.completed_at at time zone tz)::date>=week_start and (a.completed_at at time zone tz)::date<period_end),'current_week',date_trunc(p_period,v_day)::date,'previous_week',coalesce((select sum(points)from private.myday_star_awards where owner_id=u and company_id=c and day>=previous_start and day<week_start and not voided),0),'level_tasks',(select count(*) from public.actions a where a.owner_id=u and a.company_id=c and a.status='done' and a.completed_at is not null and a.deleted_at is null and a.purged_at is null),'mode',mode,'streak',private.myday_streak(u),'visible',visible,'today',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day=v_day and not voided),0),'week',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day>=week_start and day<period_end and not voided),0),'history',coalesce((select jsonb_agg(to_jsonb(q)) from (select points,reason,created_at from private.myday_star_awards where owner_id=u and company_id=c and day>=week_start and day<period_end and not voided order by created_at desc limit 200)q),'[]'),'teams',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(team)) from(select coalesce(d.name,'Company team') as name,round(avg(member.points),2) as average,count(*) as members from(select p.department_id,coalesce(sum(s.points),0) as points from public.profiles p join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join private.myday_star_awards s on s.owner_id=p.id and s.company_id=c and s.day>=week_start and s.day<period_end and not s.voided where p.company_id=c and p.active group by p.id,p.department_id)member left join public.departments d on d.id=member.department_id and d.company_id=c group by d.name order by avg(member.points) desc,d.name)team),'[]') end,
 'own_rank',case when mode='off' or not visible then null else (select place from(select p.id,rank() over(order by coalesce(sum(s.points),0) desc) as place from public.profiles p join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join private.myday_star_awards s on s.owner_id=p.id and s.company_id=c and s.day>=week_start and s.day<period_end and not s.voided where p.company_id=c and p.active and p.department_id is not distinct from department group by p.id having coalesce(sum(s.points),0)>0)ranked where id=u) end,
 'ranking',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(q)) from(select p.id,p.full_name,sum(s.points) as stars from private.myday_star_awards s join public.profiles p on p.id=s.owner_id and p.active and p.company_id=c join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible where s.company_id=c and s.day>=week_start and s.day<period_end and not s.voided and p.department_id is not distinct from department group by p.id,p.full_name having sum(s.points)>0 order by sum(s.points) desc,p.id limit 3)q),'[]') end);
end$function$;

CREATE OR REPLACE FUNCTION private.myday_counts(p_query text, p_for text, p_source text, p_priority text, p_task uuid, p_decision uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare tz text; today date; result jsonb;begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=auth.uid()),'Europe/London');today:=(now() at time zone tz)::date;
 with base as materialized(select a.*,coalesce(a.due_date,(a.due_at at time zone tz)::date) as due_day from public.actions a where a.owner_id=auth.uid() and a.purged_at is null
 and (p_task is null or a.id=p_task) and (p_decision is null or a.decision_id=p_decision)
 and strpos(lower(a.title),lower(p_query))>0 and (p_for='' or 'department:'||a.department_id::text=p_for or 'contact:'||a.external_contact_id::text=p_for)
 and (p_source='' or a.source_kind=p_source) and (p_priority='' or a.priority=p_priority))
 select jsonb_build_object(
 'tab_counts',jsonb_build_object('today',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and (due_day>=today or due_day is null) and (due_day=today or pinned_at is not null)),
 'week',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_day between today and today+6),'overdue',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_day<today),'done',count(*) filter(where deleted_at is null and status='done'),'all',count(*) filter(where deleted_at is null),'archived',count(*) filter(where deleted_at is not null)),
 'counts',jsonb_build_object('today',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and (due_day>=today or due_day is null) and (due_day=today or pinned_at is not null)),
 'todo',count(*) filter(where deleted_at is null and status='open' and missed_at is null and (due_day<today or due_day=today or pinned_at is not null)),
 'progress',count(*) filter(where deleted_at is null and status='in_progress' and missed_at is null and (due_day<today or due_day=today or pinned_at is not null)),
 'overdue',count(*) filter(where deleted_at is null and status<>'done' and missed_at is null and due_day<today),'done',count(*) filter(where deleted_at is null and status='done' and (completed_at at time zone tz)::date=today))) into result from base;
 return result;
end $function$;
