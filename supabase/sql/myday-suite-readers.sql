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
