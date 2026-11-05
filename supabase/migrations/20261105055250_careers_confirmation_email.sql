-- Existing notification rows belong to staff. Only new submissions queue a receipt.
alter table private.career_notifications
  add column kind text not null default 'staff' check (kind in ('staff','applicant')),
  drop constraint career_notifications_enquiry_id_key,
  add constraint career_notifications_enquiry_kind_key unique (enquiry_id,kind);

create or replace function private.console_website(p_action text,p_id uuid default null,p_revision integer default null,p_data jsonb default '{}')returns jsonb language plpgsql security definer set search_path=''as $$
declare gate jsonb;staff_role text;row private.website_posts;item private.career_enquiries;page_name text;result jsonb;search text;offset_n integer;begin
 gate:=private.console_request('self','',0);if not coalesce((gate->>'ok')::boolean,false)then return gate;end if;
 page_name:=case when p_action like 'career_%'then 'careers'else 'blog'end;
 select role into staff_role from public.staff_members where user_id=auth.uid()and active;
 if staff_role is distinct from 'owner'or not exists(select 1 from public.staff_permissions where role=staff_role and page=page_name and access='full')then
 insert into public.staff_activity_log(staff_user_id,action,outcome)values(auth.uid(),page_name,'denied');return jsonb_build_object('ok',false,'code','access_denied');end if;
 if p_action in('list','career_list')then
  search:=left(coalesce(p_data->>'search',''),80);offset_n:=greatest(0,least(coalesce((p_data->>'page')::integer,0),10000))*20;
  if p_action='list'then select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb))into result from(select id,slug,draft->>'title'as title,status,revision,updated_at,published is not null and draft<>published as has_changes from private.website_posts where (search=''or position(lower(search)in lower(draft->>'title'))>0)order by updated_at desc,id limit 21 offset offset_n)t;
  else select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb))into result from(select c.id,c.full_name,c.email,c.interest,c.location,c.status,c.revision,c.created_at,n.status as notification_status from private.career_enquiries c left join private.career_notifications n on n.enquiry_id=c.id and n.kind='staff' where (search=''or position(lower(search)in lower(c.full_name||' '||c.email||' '||c.interest))>0)and(coalesce(p_data->>'status','')=''or c.status=p_data->>'status')order by c.created_at desc,c.id limit 21 offset offset_n)t;end if;
 elsif p_action='career_get'then
  select to_jsonb(c)-'ip_hash'-'email_hash'-'request_hash'||jsonb_build_object('notification_status',n.status)into result from private.career_enquiries c left join private.career_notifications n on n.enquiry_id=c.id and n.kind='staff' where c.id=p_id;
 elsif p_action='career_status'then
  if p_data->>'status'not in('new','reviewing','contacted','archived')or p_data->>'status'is null then return jsonb_build_object('ok',false,'code','invalid_input');end if;
  select *into item from private.career_enquiries where id=p_id for update;if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
  if item.revision is distinct from p_revision then return jsonb_build_object('ok',false,'code','conflict');end if;
  update private.career_enquiries set status=p_data->>'status',revision=revision+1 where id=p_id returning jsonb_build_object('id',id,'revision',revision)into result;
 elsif p_action='career_retry'then
  update private.career_notifications set status='queued',attempts=0,next_attempt=now(),lease=null where enquiry_id=p_id and kind='staff' and status='failed';result:='{"queued":true}'::jsonb;
 elsif p_action='get'then select to_jsonb(p)into result from private.website_posts p where id=p_id;
 elsif p_action in('save','publish','unpublish','archive')then
  if p_action='save'and not private.website_valid_post(p_data)then return jsonb_build_object('ok',false,'code','invalid_input');end if;
  if p_id is null then
   if p_action<>'save'then return jsonb_build_object('ok',false,'code','invalid_input');end if;
   insert into private.website_posts(slug,draft)values(p_data->>'slug',p_data)returning *into row;
  else
   select *into row from private.website_posts where id=p_id for update;if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
   if row.revision is distinct from p_revision then return jsonb_build_object('ok',false,'code','conflict');end if;
   if p_action='save'then
    if row.first_published_at is not null and row.slug<>p_data->>'slug'then return jsonb_build_object('ok',false,'code','slug_locked');end if;
    update private.website_posts set draft=p_data,slug=p_data->>'slug',revision=revision+1,updated_at=now()where id=p_id returning *into row;
   elsif p_action='publish'then
    if not private.website_valid_post(row.draft)or(row.draft->>'published')::date>current_date then return jsonb_build_object('ok',false,'code','invalid_input');end if;
    update private.website_posts set published=draft,status='published',first_published_at=coalesce(first_published_at,now()),published_updated_at=now(),revision=revision+1,updated_at=now()where id=p_id returning *into row;
   else update private.website_posts set published=null,status=case when p_action='archive'then 'archived'else 'draft'end,revision=revision+1,updated_at=now()where id=p_id returning *into row;
   end if;
  end if;result:=to_jsonb(row);
 else return jsonb_build_object('ok',false,'code','invalid_input');end if;
 insert into public.staff_activity_log(staff_user_id,action,outcome,target_type,target_id)values(auth.uid(),'website_'||p_action,'allowed',page_name,p_id);
 return jsonb_build_object('ok',true,'data',result);
exception when unique_violation then return jsonb_build_object('ok',false,'code','slug_exists');when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('ok',false,'code','invalid_input');end$$;

create or replace function private.website_careers_service(p_action text,p_id uuid default null,p_data jsonb default '{}')returns jsonb language plpgsql security definer set search_path=''as $$
declare prior private.career_enquiries;payload jsonb;job private.career_notifications;results jsonb:='[]';begin
 if p_action='create'then
  payload:=p_data->'application';
  if p_id is null or jsonb_typeof(payload)is distinct from 'object'or length(p_data->>'ip_hash')<>64 or length(p_data->>'email_hash')<>64 or length(p_data->>'request_hash')<>64 or p_data->>'ip_hash'is null or p_data->>'email_hash'is null or p_data->>'request_hash'is null then return jsonb_build_object('ok',false,'code','invalid_input');end if;
  if length(btrim(payload->>'full_name'))not between 1 and 100 or payload->>'full_name'is null or payload->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or length(payload->>'email')>254 or payload->>'email'is null or payload->>'interest'not in('Engineering','Design','Product','Marketing','Operations','Other')or payload->>'interest'is null or length(payload->>'location')>120 or length(payload->>'portfolio')>500 or(payload->>'portfolio'<>''and payload->>'portfolio'!~'^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$')or length(btrim(payload->>'message'))not between 1 and 2000 or payload->>'message'is null or payload->>'consent'is distinct from 'true'then return jsonb_build_object('ok',false,'code','invalid_input');end if;
  perform pg_advisory_xact_lock(hashtextextended('career:'||(p_data->>'ip_hash'),0));perform pg_advisory_xact_lock(hashtextextended('career-email:'||(p_data->>'email_hash'),0));
  select *into prior from private.career_enquiries where id=p_id;if found then return jsonb_build_object('ok',prior.request_hash=p_data->>'request_hash','code',case when prior.request_hash=p_data->>'request_hash'then 'accepted'else 'invalid_input'end);end if;
  if(select count(*)from private.career_enquiries where ip_hash=p_data->>'ip_hash'and created_at>now()-interval '1 hour')>=3 or(select count(*)from private.career_enquiries where email_hash=p_data->>'email_hash'and created_at>now()-interval '1 day')>=2 then return jsonb_build_object('ok',false,'code','rate_limited');end if;
  insert into private.career_enquiries(id,request_hash,ip_hash,email_hash,full_name,email,interest,location,portfolio,message)values(p_id,p_data->>'request_hash',p_data->>'ip_hash',p_data->>'email_hash',btrim(payload->>'full_name'),lower(btrim(payload->>'email')),payload->>'interest',coalesce(payload->>'location',''),coalesce(payload->>'portfolio',''),btrim(payload->>'message'));
  insert into private.career_notifications(enquiry_id,kind) values (p_id,'staff'),(p_id,'applicant');return '{"ok":true,"code":"accepted"}'::jsonb;
 elsif p_action='claim'then
  if p_data?'dispatch_hash'and not exists(select 1 from private.website_dispatch_config where encode(sha256(convert_to(token,'UTF8')),'hex')=p_data->>'dispatch_hash')then return '{"ok":false,"code":"access_denied"}'::jsonb;end if;
  update private.career_notifications set status='failed',lease=null where status='sending'and claimed_at<now()-interval '15 minutes'and attempts>=5;
  for job in select *from private.career_notifications where(status='queued'and next_attempt<=now()or status='sending'and claimed_at<now()-interval '15 minutes')and attempts<5 order by next_attempt for update skip locked limit 5 loop
   update private.career_notifications set status='sending',attempts=attempts+1,lease=gen_random_uuid(),claimed_at=now()where id=job.id returning *into job;
   results:=results||jsonb_build_array(jsonb_build_object('id',job.id,'lease',job.lease,'kind',job.kind,
    'recipient',case when job.kind='applicant' then
      (select email from private.career_enquiries where id=job.enquiry_id)
    end));
  end loop;return jsonb_build_object('ok',true,'jobs',results);
 elsif p_action='finish'then
  update private.career_notifications set status=case when p_data->>'accepted'='true'then 'accepted'when attempts>=5 then 'failed'else 'queued'end,accepted_at=case when p_data->>'accepted'='true'then now()else null end,next_attempt=now()+interval '5 minutes',lease=null where id=p_id and status='sending'and lease=(p_data->>'lease')::uuid;return '{"ok":true}'::jsonb;
 end if;return '{"ok":false,"code":"invalid_input"}'::jsonb;
end$$;
