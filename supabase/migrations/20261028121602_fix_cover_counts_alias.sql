CREATE OR REPLACE FUNCTION private.handover_cover_action(p_operation text, p_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid:=auth.uid(); c uuid:=private.current_company_id(); me public.profiles; h public.work_handovers;
  pol private.handover_policy; item_id uuid; body text; reason text; decision text; suggested uuid;
  task_row public.actions; full_access boolean; cover_count integer:=0; counts_json jsonb; suggested_name text;
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
          'active',count(*) filter(where wh.status='approved' and wh.cover_response='accepted' and current_date between wh.starts_on and coalesce(wh.ends_on,'infinity'::date)),
          'upcoming',count(*) filter(where wh.status='approved' and wh.starts_on>current_date and wh.cover_response='accepted'),
          'past',count(*) filter(where wh.status in ('completed','cancelled') or wh.cover_response='declined'),
          'waiting',count(*) filter(where wh.cover_response='pending' and wh.status in ('pending','approved'))
        ) into counts_json from public.work_handovers wh where wh.company_id=c and wh.deleted_at is null;
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
  full_access:=(u=h.owner_id and h.status in ('approved','completed'))
       or (u=h.cover_id and h.cover_response<>'declined' and
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
    select full_name into suggested_name from public.profiles where id=suggested and company_id=c;
    update public.work_handovers set cover_response='declined',cover_declined_at=now(),cover_decline_reason=body,cover_suggested_id=suggested,updated_at=now() where id=h.id;
    insert into private.handover_notifications(handover_id,owner_id,message)
      values(h.id,h.owner_id,me.full_name||' declined the cover request: '||left(body,400)||case when suggested is not null then '. Suggested cover: '||coalesce(suggested_name,'a colleague') else '' end);
    if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message)
      values(h.id,h.reviewer_id,me.full_name||' declined the cover request.'||case when suggested is not null then ' Suggested cover: '||coalesce(suggested_name,'a colleague')||'. Reason: '||left(body,300) else ' Reason: '||left(body,300) end); end if;
    perform private.handover_event(h.id,'cover_declined');
    return private.handover_cover_brief(h.id,u);

  elsif p_operation in ('task_done','task_edit','hand_back') then
    if h.cover_id<>u or h.cover_response<>'accepted' or not full_access or h.status<>'approved'
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
    if h.cover_id<>u or h.cover_response<>'accepted' or not full_access then raise insufficient_privilege; end if;
    body:=btrim(coalesce(p_data->>'body',''));
    if length(body) not between 1 and 3000 then raise check_violation using message='Write a short note for the owner.'; end if;
    insert into private.handover_cover_notes(handover_id,company_id,author_id,note_type,title,body)
      values(h.id,c,u,'note','For when you’re back',body);
    insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.owner_id,'For when you’re back: '||left(body,180));
    perform private.handover_event(h.id,'cover_note_added');
    return private.handover_cover_brief(h.id,u);

  elsif p_operation='decision' then
    if h.cover_id<>u or h.cover_response<>'accepted' or not full_access then raise insufficient_privilege; end if;
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
    if h.cover_id<>u or h.cover_response<>'accepted' or not full_access or h.status not in ('completed','approved') or h.ends_on is null and h.status<>'completed' or current_date<=coalesce(h.ends_on,current_date) and h.status<>'completed' then
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
$function$
