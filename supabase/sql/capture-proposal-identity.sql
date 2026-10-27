-- Distinct assignees and decision dates are separate proposals.
CREATE OR REPLACE FUNCTION private.capture_ai_complete(p_user uuid, p_request uuid, p_output text, p_items jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j private.capture_ai_jobs;s public.captures;r jsonb;
begin
 select * into j from private.capture_ai_jobs where request_id=p_request and owner_id=p_user for update;
 if not found then raise insufficient_privilege;end if;
 if j.state<>'pending' then return;end if;
 select * into s from public.captures where id=j.capture_id for update;
 if s.deleted_at is not null or not exists(select 1 from public.profiles where id=p_user and company_id=s.company_id and active) then raise insufficient_privilege;end if;
 if p_output is null then
  update private.capture_ai_jobs set state='failed',finished_at=now() where request_id=j.request_id;
  update public.captures set result_state='could_not_read',status='failed',error='AI could not prepare drafts. Your text is still here. You can add a task by hand.' where id=s.id;
  return;
 end if;
 if octet_length(p_output)>60000 then raise exception 'Draft response is too long' using errcode='22023';end if;
 if j.task='capture_extract' then
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>60 then raise exception 'Invalid draft response' using errcode='22023';end if;
  update public.capture_items set status='discarded',reviewed_at=now(),version=version+1 where capture_id=s.id and status='pending' and origin='ai';
  for r in select distinct on (value->>'kind',lower(btrim(value->'payload'->>'title')),coalesce(nullif(value->'payload'->>'due_date',''),value->'payload'->>'decided_on',''),lower(btrim(coalesce(value->'payload'->>'source_owner','')))) value from jsonb_array_elements(p_items) loop
   if r->>'kind' not in ('decision','action','summary','contact') or jsonb_typeof(r->'payload')<>'object' or char_length(btrim(coalesce(r->'payload'->>'title',''))) not between 1 and 200 or octet_length((r->'payload')::text)>20000 then raise exception 'Invalid draft' using errcode='22023';end if;
   if (select count(*) from public.capture_items where capture_id=s.id)>=100 then raise exception 'A capture can contain up to 100 drafts' using errcode='22023';end if;
   insert into public.capture_items(capture_id,company_id,owner_id,kind,payload,origin) values(s.id,s.company_id,s.owner_id,r->>'kind',(r->'payload')||jsonb_build_object('owner_id',s.owner_id,'priority','normal','reminder_option','at_time','record_id',s.record_id,'department_id',s.department_id),'ai');
  end loop;
  update public.captures set result_state=case when jsonb_array_length(p_items)>0 then 'needs_review' else 'no_actions' end,status=case when jsonb_array_length(p_items)>0 then 'drafts_ready' else 'needs_review' end,error=null where id=s.id;
 end if;
 update private.capture_ai_jobs set output=p_output,state='success',finished_at=now() where request_id=j.request_id;
end$function$;
