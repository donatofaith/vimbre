-- Owner explicitly approved same-company employee assignment requests on 31 October 2026.
-- Source ownership, active membership, company boundaries and recipient acceptance are retained.
CREATE OR REPLACE FUNCTION private.myday_suite_role_notice_base(p_operation text, p_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 'away',coalesce((select jsonb_agg(jsonb_build_object('id',id,'starts_on',starts_on,'status',status)) from public.work_handovers where owner_id=u and company_id=c and deleted_at is null and starts_on between today and today+30 and status in('draft','changes_requested')),'[]'::jsonb),
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
  if not found then raise insufficient_privilege;end if;
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
end$function$;

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
 where n.owner_id=u and n.company_id=c and n.read_at is null and n.source_alert_id is null
 and (n.task_id is null or a.id is not null and a.deleted_at is null and a.purged_at is null)
 order by coalesce(n.task_id,n.id),n.created_at desc,n.id
 ),page as(select * from latest order by created_at desc limit 100)
 select jsonb_build_object('unread',(select count(*) from latest),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;return result;
end$function$;

