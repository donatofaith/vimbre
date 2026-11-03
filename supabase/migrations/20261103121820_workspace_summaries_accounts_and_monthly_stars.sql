CREATE OR REPLACE FUNCTION private.myday_stars_period(p_day date DEFAULT NULL::date, p_period text DEFAULT 'week')
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
 return jsonb_build_object('week_start',week_start,'week_end',period_end-1,'period',p_period,'today_date',v_day,'completed_tasks',(select count(*)from public.actions a where a.owner_id=u and a.company_id=c and a.status='done' and a.deleted_at is null and (a.completed_at at time zone tz)::date>=week_start and (a.completed_at at time zone tz)::date<period_end),'current_week',date_trunc(p_period,v_day)::date,'previous_week',coalesce((select sum(points)from private.myday_star_awards where owner_id=u and company_id=c and day>=previous_start and day<week_start and not voided),0),'level_tasks',(select count(distinct task_id) from private.myday_star_awards where owner_id=u and company_id=c and task_id is not null and not voided),'mode',mode,'streak',private.myday_streak(u),'visible',visible,'today',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day=v_day and not voided),0),'week',coalesce((select sum(points) from private.myday_star_awards where owner_id=u and day>=week_start and day<period_end and not voided),0),'history',coalesce((select jsonb_agg(to_jsonb(q)) from (select points,reason,created_at from private.myday_star_awards where owner_id=u and company_id=c and day>=week_start and day<period_end and not voided order by created_at desc limit 200)q),'[]'),'teams',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(team)) from(select coalesce(d.name,'Company team') as name,round(avg(member.points),2) as average,count(*) as members from(select p.department_id,coalesce(sum(s.points),0) as points from public.profiles p join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join private.myday_star_awards s on s.owner_id=p.id and s.company_id=c and s.day>=week_start and s.day<period_end and not s.voided where p.company_id=c and p.active group by p.id,p.department_id)member left join public.departments d on d.id=member.department_id and d.company_id=c group by d.name order by avg(member.points) desc,d.name)team),'[]') end,
 'own_rank',case when mode='off' or not visible then null else (select place from(select p.id,rank() over(order by coalesce(sum(s.points),0) desc) as place from public.profiles p join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible left join private.myday_star_awards s on s.owner_id=p.id and s.company_id=c and s.day>=week_start and s.day<period_end and not s.voided where p.company_id=c and p.active and p.department_id is not distinct from department group by p.id having coalesce(sum(s.points),0)>0)ranked where id=u) end,
 'ranking',case when mode='off' or not visible then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(q)) from(select p.id,p.full_name,sum(s.points) as stars from private.myday_star_awards s join public.profiles p on p.id=s.owner_id and p.active and p.company_id=c join private.myday_star_consent consent on consent.owner_id=p.id and consent.company_id=c and consent.visible where s.company_id=c and s.day>=week_start and s.day<period_end and not s.voided and p.department_id is not distinct from department group by p.id,p.full_name having sum(s.points)>0 order by sum(s.points) desc,p.id limit 3)q),'[]') end);
end$function$;


revoke all on function private.myday_stars_period(date,text) from public,anon,service_role,console_backend;
grant execute on function private.myday_stars_period(date,text) to authenticated;
create or replace function public.myday_stars_period(p_day date default null,p_period text default 'week') returns jsonb language sql security invoker set search_path='' as $$select private.myday_stars_period(p_day,p_period)$$;
revoke all on function public.myday_stars_period(date,text) from public,anon,service_role;grant execute on function public.myday_stars_period(date,text) to authenticated;

-- All evidence is selected on the server. Tasks stay owner-private; role visibility is checked per row.
create or replace function private.workspace_evidence(p_from date default null,p_to date default null,p_query text default '')returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;tz text;v_today date;search tsquery;terms text;out_sources jsonb;total int;begin
 select company_id into c from public.profiles where id=u and active;if c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');v_today:=(now()at time zone tz)::date;
 if p_from is null and p_query~*'\m(this|last) month\M'then p_from:=date_trunc('month',v_today)::date;if p_query~*'last month'then p_from:=(p_from-interval '1 month')::date;end if;p_to:=(p_from+interval '1 month')::date-1;elsif p_from is null and p_query~*'\m(this|last) week\M'then p_from:=date_trunc('week',v_today)::date;if p_query~*'last week'then p_from:=p_from-7;end if;p_to:=p_from+6;end if;
 if (p_from is null)<>(p_to is null) or p_from>p_to or p_to-p_from>31 or p_from<v_today-interval '5 years' or length(p_query)>2000 then raise invalid_parameter_value;end if;
 select string_agg(quote_literal(word),' | ') into terms from regexp_split_to_table(lower(coalesce(p_query,'')),'[^[:alnum:]_]+')word where length(word)>2 and word not in ('who','what','when','where','why','how','the','this','that','was','were','has','have','made','did','does','still','for','and','with','about','please','tell','which','show','from','are','can','you','our','work','records','finish','finished','complete','completed','month','week','last','today');
 if terms is not null then search:=to_tsquery('simple',terms);end if;
 with evidence as (
 select 'task:'||a.id as ref,'task'::text kind,a.title,left(a.details,1200)||case when a.completed_at is not null and(p_to is null or(a.completed_at at time zone tz)::date<=p_to)then E'\nOutcome: '||coalesce(a.completion_note,'')else ''end body,
 case when p_to is not null and(a.completed_at at time zone tz)::date>p_to then 'open at period end'else a.status end status,p.full_name person,coalesce(a.completed_at,a.updated_at)as at,'/app?task='||a.id path
 from public.actions a join public.profiles p on p.id=a.owner_id where a.company_id=c and a.owner_id=u and a.deleted_at is null and a.purged_at is null and(p_from is null or(a.created_at at time zone tz)::date<=p_to and(a.status<>'done' or(a.completed_at at time zone tz)::date>=p_from))
 union all
 select 'decision:'||d.id,'decision',d.title,left(d.reason,1200)||E'\nNext step: '||coalesce(d.next_step,''),d.status,coalesce(nullif(d.decided_by,''),p.full_name),coalesce(d.decided_on::timestamp at time zone tz,d.created_at),'/app/role-record?section=decision&record='||d.id||case when d.role_id is null then ''else '&role='||d.role_id end
 from public.decisions d join public.profiles p on p.id=d.owner_id where d.company_id=c and d.deleted_at is null and private.role_item_visible(d.id) and(case when d.role_id is null then private.can_read_role(d.owner_id)else private.role_access(d.role_id)end)and(p_from is null or coalesce(d.decided_on,(d.created_at at time zone tz)::date)between p_from and p_to or d.status not in ('live','archived','replaced')and(d.created_at at time zone tz)::date<=p_to)
 union all
 select 'role:'||i.id,i.kind,i.title,left(i.details,1200)||E'\nNext step: '||coalesce(i.next_step,'')||E'\nDue: '||coalesce(i.due_date::text,''),coalesce(i.work_status,''),p.full_name,i.updated_at,'/app/role-record?section='||i.kind||'&record='||i.id||case when i.role_id is null then ''else '&role='||i.role_id end
 from public.role_items i join public.profiles p on p.id=i.owner_id where i.company_id=c and i.deleted_at is null and private.role_item_visible(i.id) and(case when i.role_id is null then private.can_read_role(i.owner_id)else private.role_access(i.role_id,i.kind='external_contact')end)and(p_to is null or(i.created_at at time zone tz)::date<=p_to)and(p_from is null or i.kind='recurring_deadline' or i.kind='workstream'and i.work_status<>'done' or(i.updated_at at time zone tz)::date between p_from and p_to)
 union all
 select 'assignment:'||a.id,'teammate follow-up',a.title,left(a.details,1200)||E'\nDue: '||coalesce(a.due_date::text,''),a.status,p.full_name,a.updated_at,'/app'
 from private.myday_assignments a join public.profiles p on p.id=a.recipient_id where a.company_id=c and(u=a.creator_id or u=a.recipient_id)and(p_to is null or(a.created_at at time zone tz)::date<=p_to)and(a.status not in ('done','declined','cancelled')or p_from is null or(a.updated_at at time zone tz)::date between p_from and p_to)
 union all
 select 'capture-decision:'||i.id,'pending decision',left(coalesce(i.payload->>'decision',i.payload->>'title','Decision to review'),200),left(coalesce(i.payload->>'why',i.payload->>'reason',''),1200),'awaiting your approval',p.full_name,i.created_at,'/app/capture?capture='||i.capture_id from public.capture_items i join public.captures cap on cap.id=i.capture_id join public.profiles p on p.id=i.owner_id where i.company_id=c and i.owner_id=u and cap.owner_id=u and cap.company_id=c and cap.deleted_at is null and i.kind='decision'and i.status='pending'and(p_to is null or(i.created_at at time zone tz)::date<=p_to)
 union all
 select 'review:'||rr.id,'approval','Role review: '||coalesce(rp.title,p.full_name),'Waiting for approval',rr.status,p.full_name,rr.created_at,'/app/role-record?role='||rp.id
 from private.role_review_requests rr join public.role_profiles rp on rp.id=rr.role_id join public.profiles p on p.id=rr.holder_id where rp.company_id=c and(rr.holder_id=u or rr.manager_id=u and rp.manager_id=u)and private.role_access(rp.id)and rr.status='pending'and(p_to is null or(rr.created_at at time zone tz)::date<=p_to)
 union all
 select 'profile:'||rp.id,'profile',rp.title,left(rp.introduction,1200),'current',p.full_name,rp.updated_at,'/app/role-record?role='||rp.id from public.role_profiles rp join public.profiles p on p.id=rp.holder_id where rp.company_id=c and rp.holder_id=u
 union all
 select 'note:'||n.id,'private note','My role note',left(n.body,1200),'private',p.full_name,n.updated_at,'/app/role-record?role='||n.role_id from private.role_notes n join public.role_profiles rp on rp.id=n.role_id join public.profiles p on p.id=n.author_id where rp.company_id=c and n.author_id=u and private.role_access(n.role_id) and(p_from is null or(n.updated_at at time zone tz)::date between p_from and p_to)
 ), matched as(select *,case when search is null then 0 else ts_rank_cd(to_tsvector('simple',coalesce(title,'')||' '||coalesce(body,'')||' '||coalesce(person,'')||' '||coalesce(status,'')||' '||coalesce(kind,'')),search)end score from evidence where search is null or to_tsvector('simple',coalesce(title,'')||' '||coalesce(body,'')||' '||coalesce(person,'')||' '||coalesce(status,'')||' '||coalesce(kind,''))@@search or kind='profile'),picked as(select * from matched order by score desc,at desc nulls last,ref limit 100)
 select coalesce(jsonb_agg(to_jsonb(picked)-'score'),'[]'),(select count(*)from matched)into out_sources,total from picked;
 return jsonb_build_object('from',p_from,'to',p_to,'today',v_today,'timezone',tz,'prepared_at',now(),'sources',out_sources,'total_matches',total,'truncated',total>100,'stars',jsonb_build_object('points',coalesce((select sum(points)from private.myday_star_awards where owner_id=u and company_id=c and not voided and(p_from is null or day between p_from and p_to)),0),'completed_tasks',(select count(*)from public.actions where owner_id=u and company_id=c and status='done'and deleted_at is null and(p_from is null or(completed_at at time zone tz)::date between p_from and p_to))));
end$$;
revoke all on function private.workspace_evidence(date,date,text) from public,anon,service_role,console_backend;grant execute on function private.workspace_evidence(date,date,text) to authenticated;
create or replace function public.workspace_evidence(p_from date default null,p_to date default null,p_query text default '')returns jsonb language sql security invoker set search_path=''as $$select private.workspace_evidence(p_from,p_to,p_query)$$;
revoke all on function public.workspace_evidence(date,date,text)from public,anon,service_role;grant execute on function public.workspace_evidence(date,date,text)to authenticated;
insert into public.ai_task_routes(task,primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled)select 'workspace_answer',primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled from public.ai_task_routes where task='weekly_summary' on conflict(task)do nothing;

alter table public.companies add column if not exists workspace_type text not null default 'company' check(workspace_type in ('individual','sole_founder','company'));
CREATE OR REPLACE FUNCTION private.bootstrap_company_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare company uuid; company_name text; person_name text; invite public.invitations; staff_inv private.console_staff_invites; workspace_kind text;
begin
 if new.raw_app_meta_data->>'console_invite_hash' is not null then
  select * into staff_inv from private.console_staff_invites where token_hash=new.raw_app_meta_data->>'console_invite_hash' for update;
  if not found or staff_inv.email<>lower(new.email) or staff_inv.accepted_at is not null or staff_inv.revoked_at is not null or staff_inv.expires_at<=now() or new.email_confirmed_at is null or not exists(select 1 from public.staff_members where user_id=staff_inv.created_by and active and role='owner') then raise exception 'Staff invitation is unavailable';end if;
  insert into public.staff_members(user_id,full_name,role)values(new.id,staff_inv.full_name,staff_inv.role);
  update private.console_staff_invites set accepted_at=now()where id=staff_inv.id;
  insert into public.staff_activity_log(staff_user_id,action,outcome,target_type,target_id)values(staff_inv.created_by,'staff_invitation_accepted','allowed','staff',new.id);
  return new;
 end if;
 if new.raw_user_meta_data->>'invitation_id' is not null then
  select * into invite from public.invitations where id=(new.raw_user_meta_data->>'invitation_id')::uuid
   and email=lower(new.email) and status='pending' and expires_at>now() and invited_user_id is null;
  if not found then raise exception 'Invitation is unavailable';end if;
  perform 1 from public.companies where id=invite.company_id for update;
  select * into invite from public.invitations where id=invite.id and email=lower(new.email) and status='pending' and expires_at>now() and invited_user_id is null for update;
  if not found then raise exception 'Invitation is unavailable';end if;
  insert into public.profiles(id,company_id,full_name,email,role,department_id,active)
   values(new.id,invite.company_id,invite.full_name,lower(new.email),invite.role,invite.department_id,false);
  update public.invitations set invited_user_id=new.id where id=invite.id;
  return new;
 end if;
 workspace_kind:=coalesce(new.raw_user_meta_data->>'workspace_type','company');if workspace_kind not in ('individual','sole_founder','company')then raise check_violation using message='Choose a valid signup mode';end if;company_name:=btrim(new.raw_user_meta_data->>'company_name');person_name:=btrim(new.raw_user_meta_data->>'full_name');if workspace_kind='individual'then company_name:=person_name||'’s workspace';elsif workspace_kind='sole_founder'and coalesce(company_name,'')=''then company_name:=person_name||'’s workspace';end if;
 if company_name is null or char_length(company_name) not between 1 and 120 or person_name is null or char_length(person_name) not between 1 and 100 or new.email is null then raise exception 'A valid company name, full name and email are required';end if;
 insert into public.companies(name,contact_email,created_by,workspace_type) values(company_name,lower(new.email),new.id,workspace_kind) returning id into company;
 insert into public.profiles(id,company_id,full_name,email,role) values(new.id,company,person_name,lower(new.email),'hr_admin');
 return new;
end; $function$;


-- A new registration gets a server-side single-use analytics claim. Never backfill existing accounts.
create table private.signup_analytics_claims(user_id uuid primary key references auth.users(id)on delete cascade,receipt_hash text unique not null,claimed_at timestamptz);
alter table private.signup_analytics_claims enable row level security;
revoke all on private.signup_analytics_claims from public,anon,authenticated,service_role,console_backend;
create function private.prepare_signup_analytics()returns trigger language plpgsql security definer set search_path=''as $$begin
 new.raw_app_meta_data:=coalesce(new.raw_app_meta_data,'{}')||jsonb_build_object('vimbre_signup_receipt',encode(extensions.gen_random_bytes(32),'hex'));return new;
end$$;
revoke all on function private.prepare_signup_analytics()from public,anon,authenticated,service_role,console_backend;
create trigger a_prepare_signup_analytics before insert on auth.users for each row execute function private.prepare_signup_analytics();
create function private.register_signup_analytics()returns trigger language plpgsql security definer set search_path=''as $$begin if new.raw_app_meta_data->>'console_invite_hash'is null then insert into private.signup_analytics_claims(user_id,receipt_hash)values(new.id,encode(extensions.digest(new.raw_app_meta_data->>'vimbre_signup_receipt','sha256'),'hex'))on conflict do nothing;end if;return new;end$$;
revoke all on function private.register_signup_analytics()from public,anon,authenticated,service_role,console_backend;
create trigger z_register_signup_analytics after insert on auth.users for each row execute function private.register_signup_analytics();
create function private.claim_signup_analytics(p_receipt text default null)returns boolean language plpgsql security definer set search_path=''as $$declare claimed uuid;begin
 if p_receipt is not null then
  if p_receipt!~'^[a-f0-9]{64}$'then return false;end if;
  update private.signup_analytics_claims set claimed_at=now()where receipt_hash=encode(extensions.digest(p_receipt,'sha256'),'hex')and claimed_at is null returning user_id into claimed;
 else
  if auth.uid()is null or not exists(select 1 from auth.users where id=auth.uid()and email_confirmed_at is not null and not coalesce(is_anonymous,false))then return false;end if;
  update private.signup_analytics_claims set claimed_at=now()where user_id=auth.uid()and claimed_at is null returning user_id into claimed;
 end if;return claimed is not null;
end$$;
revoke all on function private.claim_signup_analytics(text)from public,service_role,console_backend;grant execute on function private.claim_signup_analytics(text)to anon,authenticated;
create function public.claim_signup_analytics(p_receipt text default null)returns boolean language sql security invoker set search_path=''as $$select private.claim_signup_analytics(p_receipt)$$;
revoke all on function public.claim_signup_analytics(text)from public,service_role;grant execute on function public.claim_signup_analytics(text)to anon,authenticated;

CREATE OR REPLACE FUNCTION private.handover_ai_source(p_user uuid, p_handover uuid, p_kind text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare h public.work_handovers;begin
 select * into h from public.work_handovers where id=p_handover and exists(select 1 from public.profiles p where p.id=p_user and p.active and p.company_id=work_handovers.company_id);
 if h.id is null or p_user<>h.owner_id and not(p_user=h.created_by and exists(select 1 from public.profiles pv join public.profiles po on po.id=h.owner_id where pv.id=p_user and pv.active and pv.company_id=po.company_id and (pv.role='hr_admin' or pv.role='manager' and pv.department_id=po.department_id))) and not(p_user=h.cover_id and h.status='completed' and h.cover_response='accepted') or p_kind not in ('handover_draft','handover_return') then raise insufficient_privilege;end if;
 
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

 if h.status<>'completed' then raise insufficient_privilege;end if;
 return jsonb_build_object('handover',h.sections-array['reason','note_for_manager'],'decisions_made',coalesce((select jsonb_agg(jsonb_build_object('title',d.title,'why',d.reason,'date',d.decided_on)) from public.decisions d where d.role_id=h.role_id and d.created_at>=h.starts_on::timestamp and d.created_at<=coalesce(h.completed_at,now()) and d.deleted_at is null and not exists(select 1 from private.role_item_settings rs where rs.item_id=d.id and(rs.is_private or not rs.include_in_handover))),'[]'),'new_items',coalesce((select jsonb_agg(jsonb_build_object('title',i.title,'kind',i.kind)) from public.role_items i where i.role_id=h.role_id and i.created_at>=h.starts_on::timestamp and i.created_at<=coalesce(h.completed_at,now()) and i.deleted_at is null and not exists(select 1 from private.role_item_settings rs where rs.item_id=i.id and(rs.is_private or not rs.include_in_handover))),'[]'),'completed_cover_work',coalesce((select jsonb_agg(jsonb_build_object('title',a.title,'completed_at',a.completed_at,'outcome',a.completion_note,'by_cover',case when hi.completed_by is null then null else hi.completed_by=h.cover_id end)) from private.handover_items hi join public.actions a on a.id=hi.record_id and hi.kind='task' where hi.handover_id=h.id and a.status='done'),'[]'))::text;
 end if;
 if h.status not in ('draft','declined','approved') then raise insufficient_privilege;end if;
 return jsonb_build_object('type',h.handover_type,'start',h.starts_on,'end',h.ends_on,'role_profile',(select jsonb_build_object('title',rp.title,'introduction',rp.introduction)from public.role_profiles rp where rp.id=h.role_id and rp.company_id=h.company_id),'selected_records',coalesce((select jsonb_agg(jsonb_build_object('kind',i.kind,'title',i.title,'details',i.details,'due_date',i.due_date,'next_step',i.next_step,'url',i.url))from public.role_items i where i.role_id=h.role_id and i.company_id=h.company_id and i.deleted_at is null and exists(select 1 from jsonb_array_elements(h.selected_records) j where j->>'id'=i.id::text)and not exists(select 1 from private.role_item_settings s where s.item_id=i.id and(s.is_private or not s.include_in_handover))),'[]'),'selected_notes',case when p_user=h.owner_id then coalesce((select jsonb_agg(jsonb_build_object('body',n.body))from private.role_notes n where n.role_id=h.role_id and n.author_id=p_user and n.include_in_handover and exists(select 1 from jsonb_array_elements(h.selected_records)j where j->>'id'=n.id::text and j->>'group'='notes')),'[]')else '[]'::jsonb end,'content',h.sections-array['reason','note_for_manager'],'priority_order',h.priority_order,'ordering_rule','Use due dates, importance and Do not change. Do not invent dates. Respect the saved task order when one is provided.','open_tasks',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'due_date',a.due_date,'importance',a.priority)) from private.handover_items hi join public.actions a on a.id=hi.record_id and hi.kind='task' where hi.handover_id=h.id),'[]'),'decisions',coalesce((select jsonb_agg(jsonb_build_object('title',d.title,'why',d.reason,'do_not_change',hi.do_not_change)) from private.handover_items hi join public.decisions d on d.id=hi.record_id and hi.kind='decision' where hi.handover_id=h.id),'[]'))::text;
end$function$;

