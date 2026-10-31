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
   return jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,full_name as name,role,department_id from public.profiles where company_id=c and active and id<>u and (exists(select 1 from public.profiles actor where actor.id=u and actor.role='hr_admin') or private.myday_reports_to(id,u,c)) order by full_name limit 1000)q),'[]'::jsonb),
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
  if exists(select 1 from unnest(recipient_ids)r where not exists(select 1 from public.profiles where id=r and company_id=c and active and id<>u and (exists(select 1 from public.profiles actor where actor.id=u and actor.role='hr_admin') or exists(select 1 from public.profiles actor where actor.id=u and actor.role='manager') and private.myday_reports_to(id,u,c)))) then raise insufficient_privilege;end if;
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

CREATE OR REPLACE FUNCTION private.myday_stars()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();c uuid;department uuid;tz text;v_day date;mode text;week_start date;visible boolean;begin
 select company_id,department_id into c,department from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');v_day:=(now() at time zone tz)::date;week_start:=date_trunc('week',v_day)::date;
 mode:=coalesce((select x.mode from private.myday_competition x where company_id=c),'off');visible:=coalesce((select s.visible from private.myday_star_consent s where owner_id=u and company_id=c),false);
 return jsonb_build_object('level_tasks',(select count(distinct task_id) from private.myday_star_awards where owner_id=u and company_id=c and task_id is not null and not voided),'mode',mode,'streak',private.myday_streak(u),'visible',visible,'today',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day=v_day and not voided),0),'week',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day>=week_start and not voided),0),'history',coalesce((select jsonb_agg(to_jsonb(q)) from (select points,reason,created_at from private.myday_star_awards where owner_id=u and not voided order by created_at desc limit 30)q),'[]'),'teams',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(team)) from(select coalesce(d.name,'Company team') as name,round(avg(member.points),2) as average,count(*) as members from(select p.department_id,coalesce(sum(s.points),0) as points from public.profiles p join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join private.myday_star_awards s on s.owner_id=p.id and s.company_id=c and s.day>=week_start and not s.voided where p.company_id=c and p.active group by p.id,p.department_id)member left join public.departments d on d.id=member.department_id and d.company_id=c group by d.name order by avg(member.points) desc,d.name)team),'[]') end,
 'own_rank',case when mode='off' or not visible then null else (select place from(select p.id,rank() over(order by coalesce(sum(s.points),0) desc) as place from public.profiles p join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join private.myday_star_awards s on s.owner_id=p.id and s.company_id=c and s.day>=week_start and not s.voided where p.company_id=c and p.active and p.department_id is not distinct from department group by p.id)ranked where id=u) end,
 'ranking',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(q)) from(select p.id,p.full_name,sum(s.points) as stars from private.myday_star_awards s join public.profiles p on p.id=s.owner_id and p.active and p.company_id=c join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible where s.company_id=c and s.day>=week_start and not s.voided and p.department_id is not distinct from department group by p.id,p.full_name order by sum(s.points) desc,p.id limit 3)q),'[]') end);
end$function$;
