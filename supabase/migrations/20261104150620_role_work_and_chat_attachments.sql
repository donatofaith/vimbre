-- Private chat attachments; permission checks follow conversation membership.
create table private.chat_attachments (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),conversation_id uuid not null references public.chat_conversations(id),sender_id uuid not null references public.profiles(id),message_id uuid references public.chat_messages(id),name text not null check(char_length(name) between 1 and 240),path text not null unique,mime text not null,size bigint not null check(size between 1 and 5242880),created_at timestamptz not null default now()
);
create index chat_attachments_message_idx on private.chat_attachments(message_id);
create index chat_attachments_company_idx on private.chat_attachments(company_id,created_at);
alter table private.chat_attachments enable row level security;
revoke all on private.chat_attachments from public,anon,authenticated,service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('chat-attachments','chat-attachments',false,5242880,array['image/jpeg','application/pdf','text/plain','text/csv','application/zip','application/octet-stream','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
create function private.chat_file_access(p_path text,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.chat_attachments a where a.path=p_path and a.company_id=private.current_company_id() and private.chat_can_access(a.conversation_id) and case when p_write then a.sender_id=auth.uid() and a.message_id is null and a.created_at>now()-interval '1 hour' else a.message_id is not null or a.sender_id=auth.uid() end)
$$;
revoke all on function private.chat_file_access(text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.chat_file_access(text,boolean) to authenticated;
create policy chat_files_read on storage.objects for select to authenticated using(bucket_id='chat-attachments' and private.chat_file_access(name,false));
create policy chat_files_insert on storage.objects for insert to authenticated with check(bucket_id='chat-attachments' and private.chat_file_access(name,true));
create policy chat_files_remove_pending on storage.objects for delete to authenticated using(bucket_id='chat-attachments' and private.chat_file_access(name,true));
create function private.chat_attachment_prepare(p_conversation uuid,p_name text,p_size bigint,p_mime text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;key uuid:=gen_random_uuid();path text;used bigint;begin
 if not private.chat_can_access(p_conversation) then raise insufficient_privilege;end if;
 select company_id into c from public.chat_conversations where id=p_conversation;
 if p_name is null or char_length(p_name) not between 1 and 240 or p_name~'[[:cntrl:]/\\]'  or p_name like '.%' or lower(p_name)!~'\.(jpg|jpeg|pdf|txt|csv|docx|xlsx|pptx|zip)$' or p_size is null or p_size not between 1 and 5242880 or p_mime is null or p_mime not in('image/jpeg','application/pdf','text/plain','text/csv','application/zip','application/octet-stream','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation')then raise invalid_parameter_value using message='Choose an allowed file under 5 MB';end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text,731));
 select coalesce(sum(size),0)into used from private.chat_attachments a where a.company_id=c and (a.message_id is not null or a.created_at>now()-interval '1 hour' or exists(select 1 from storage.objects o where o.bucket_id='chat-attachments' and o.name=a.path));
 if used+p_size>104857600 then raise check_violation using message='Chat attachment storage limit reached';end if;
 if (select coalesce(sum(size),0) from private.chat_attachments where sender_id=u and created_at>now()-interval '1 day')+p_size>20971520 then raise check_violation using message='Daily attachment storage limit reached. Try again tomorrow.';end if;
 path:=c::text||'/'||u::text||'/'||p_conversation::text||'/'||key::text;
 insert into private.chat_attachments(id,company_id,conversation_id,sender_id,name,path,mime,size)values(key,c,p_conversation,u,p_name,path,p_mime,p_size);
 return jsonb_build_object('id',key,'path',path);
end$$;
revoke all on function private.chat_attachment_prepare(uuid,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function private.chat_attachment_prepare(uuid,text,bigint,text) to authenticated;
create function public.chat_attachment_prepare(p_conversation uuid,p_name text,p_size bigint,p_mime text) returns jsonb language sql security invoker set search_path='' as $$select private.chat_attachment_prepare(p_conversation,p_name,p_size,p_mime)$$;
revoke all on function public.chat_attachment_prepare(uuid,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.chat_attachment_prepare(uuid,text,bigint,text) to authenticated;
create function private.chat_send_files(p_conversation uuid,p_id uuid,p_body text,p_reply uuid,p_mentions uuid[],p_record_path text,p_attachments uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare key uuid;total bigint:=0;a private.chat_attachments;actual bigint;result uuid;begin
 if not private.chat_can_access(p_conversation) then raise insufficient_privilege;end if;
 if p_attachments is null or cardinality(p_attachments)>5 or array_position(p_attachments,null)is not null or cardinality(p_attachments)<>(select count(distinct i)from unnest(p_attachments)i)then raise invalid_parameter_value;end if;
 foreach key in array p_attachments loop
  select *into a from private.chat_attachments where id=key and conversation_id=p_conversation and sender_id=auth.uid() and (message_id is null or message_id=p_id)for update;
  if not found then raise insufficient_privilege;end if;
  select (metadata->>'size')::bigint into actual from storage.objects where bucket_id='chat-attachments'and name=a.path and metadata->>'mimetype'=a.mime;
  if actual is null or actual<>a.size then raise check_violation using message='Upload every attachment before sending';end if;total:=total+actual;
 end loop;
 if total>10485760 then raise check_violation;end if;
 if exists(select 1 from private.chat_attachments where message_id=p_id and not(id=any(p_attachments)))then raise invalid_parameter_value;end if;
 result:=private.chat_send(p_conversation,p_id,p_body,p_reply,p_mentions,p_record_path);
 update private.chat_attachments set message_id=p_id where id=any(p_attachments)and sender_id=auth.uid();return result;
end$$;
revoke all on function private.chat_send_files(uuid,uuid,text,uuid,uuid[],text,uuid[]) from public,anon,authenticated,service_role;
grant execute on function private.chat_send_files(uuid,uuid,text,uuid,uuid[],text,uuid[]) to authenticated;
create function public.chat_send_files(p_conversation uuid,p_id uuid,p_body text,p_reply uuid,p_mentions uuid[],p_record_path text,p_attachments uuid[]) returns uuid language sql security invoker set search_path='' as $$select private.chat_send_files(p_conversation,p_id,p_body,p_reply,p_mentions,p_record_path,p_attachments)$$;
revoke all on function public.chat_send_files(uuid,uuid,text,uuid,uuid[],text,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.chat_send_files(uuid,uuid,text,uuid,uuid[],text,uuid[]) to authenticated;
-- Validate actual Storage sizes too: client compression is not an authorization boundary.
create function private.chat_storage_cap()returns trigger language plpgsql security definer set search_path='' as $$
declare a private.chat_attachments;used bigint;incoming bigint;begin
 if new.bucket_id<>'chat-attachments' or coalesce(new.metadata->>'size','')!~'^[0-9]{1,12}$'then return new;end if;
 select *into a from private.chat_attachments where path=new.name;
 if not found then raise insufficient_privilege;end if;
 incoming:=(new.metadata->>'size')::bigint;if incoming<>a.size or new.metadata->>'mimetype'<>a.mime then raise check_violation using message='Attachment size or type changed';end if;
 perform pg_advisory_xact_lock(hashtextextended(a.company_id::text,731));
 select coalesce(sum((o.metadata->>'size')::bigint),0)into used from storage.objects o where o.id<>new.id and o.bucket_id='chat-attachments'and o.name like a.company_id::text||'/%'and coalesce(o.metadata->>'size','')~'^[0-9]{1,12}$';
 if used+incoming>104857600 then raise check_violation using message='Chat attachment storage limit reached';end if;return new;
end$$;
revoke all on function private.chat_storage_cap()from public,anon,authenticated,service_role;
create trigger chat_attachment_size_cap before insert or update on storage.objects for each row execute function private.chat_storage_cap();
-- Save a task and its repeating rule atomically, retaining existing ownership/version checks.
create function private.myday_save_task(p_id uuid,p_data jsonb,p_create boolean)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;a public.actions;rule jsonb:=p_data->'repeat';begin
 if auth.uid()is null or private.current_company_id()is null then raise insufficient_privilege;end if;
 if p_create then
  if exists(select 1 from public.actions where id=p_id)then
   select *into a from public.actions where id=p_id and owner_id=auth.uid()and company_id=private.current_company_id()and deleted_at is null;
   if not found or a.title is distinct from btrim(p_data->>'title')or a.details is distinct from coalesce(p_data->>'details','')then raise invalid_parameter_value;end if;
   return jsonb_build_object('id',a.id,'updated_at',a.updated_at);
  end if;
  perform private.myday_action(p_id,'create',p_data-'repeat');
  if coalesce(p_data->>'status','open')<>'open'then perform private.myday_action(p_id,'status',jsonb_build_object('status',p_data->>'status'));end if;
 else perform private.myday_edit(p_id,p_data-'repeat');end if;
 select *into a from public.actions where id=p_id and owner_id=auth.uid()and company_id=private.current_company_id();if not found then raise insufficient_privilege;end if;
 if rule is not null and a.recurring_id is null and a.source_kind<>'recurring_deadline'then
  if coalesce((rule->>'stop')::boolean,false)then
   if a.repeat_rule is not null then perform private.myday_suite('repeat',p_id,'{"stop":true}');end if;
  elsif rule->>'frequency'not in('daily','weekdays','weekly','monthly','custom')then raise invalid_parameter_value;
  elsif a.repeat_rule is distinct from jsonb_build_object('frequency',rule->>'frequency','every_n',coalesce((rule->>'every_n')::int,1),'unit',coalesce(rule->>'unit','day'))then perform private.myday_suite('repeat',p_id,rule);end if;
 end if;
 return(select jsonb_build_object('id',id,'updated_at',updated_at)from public.actions where id=p_id and owner_id=auth.uid());
end$$;
revoke all on function private.myday_save_task(uuid,jsonb,boolean)from public,anon,authenticated,service_role;
grant execute on function private.myday_save_task(uuid,jsonb,boolean)to authenticated;
create function public.myday_save_task(p_id uuid,p_data jsonb,p_create boolean)returns jsonb language sql security invoker set search_path='' as $$select private.myday_save_task(p_id,p_data,p_create)$$;
revoke all on function public.myday_save_task(uuid,jsonb,boolean)from public,anon,authenticated,service_role;
grant execute on function public.myday_save_task(uuid,jsonb,boolean)to authenticated;

CREATE OR REPLACE FUNCTION private.chat_page(p_conversation uuid, p_before bigint, p_anchor uuid, p_after bigint)
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
 coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'path',f.path,'size',f.size,'mime',f.mime)order by f.created_at,f.id) from private.chat_attachments f where f.message_id=m.id),'[]'::jsonb)as attachments,
 case when r.id is not null then jsonb_build_object('id',r.id,'body',left(r.body,160),'sender_name',private.member_name(rp.id)) end as reply,
 coalesce((select jsonb_agg(jsonb_build_object('id',mp.id,'name',private.member_name(mp.id))) from public.profiles mp where mp.id=any(m.mentions)),'[]'::jsonb) as mention_names
 from public.chat_messages m join public.profiles p on p.id=m.sender_id
 left join public.chat_messages r on r.id=m.reply_to left join public.profiles rp on rp.id=r.sender_id
 where m.conversation_id=p_conversation and (p_before is null or m.seq<p_before) and (p_after is null or m.seq>p_after) and (anchor_seq is null or m.seq>=coalesce((select mm.seq from public.chat_messages mm where mm.conversation_id=p_conversation and mm.seq<=anchor_seq order by mm.seq desc offset 24 limit 1),0))
 order by case when anchor_seq is null and p_after is null then m.seq end desc,m.seq asc limit 50
 ) select jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(rows) order by seq) from rows),'[]'::jsonb),
 'members',(select jsonb_agg(private.member_public(p.id)||jsonb_build_object('id',p.id,'company_id',p.company_id,'full_name',private.member_name(p.id),'active',p.active,'last_read_seq',cm.last_read_seq,'joined_at',cm.joined_at) order by p.full_name,p.id) from public.chat_members cm join public.profiles p on p.id=cm.user_id where cm.conversation_id=p_conversation),
 'kind',(select kind from public.chat_conversations where id=p_conversation),
 'can_rename',(select c.kind='group'and(not c.is_team or c.created_by=auth.uid()or exists(select 1 from public.profiles where id=auth.uid()and role='hr_admin'))from public.chat_conversations c where id=p_conversation),'title',(select title from public.chat_conversations where id=p_conversation)) into result;
 return result||jsonb_build_object('has_older',exists(select 1 from public.chat_messages where conversation_id=p_conversation and seq<(result->'messages'->0->>'seq')::bigint),'has_newer',exists(select 1 from public.chat_messages where conversation_id=p_conversation and seq>(result->'messages'->-1->>'seq')::bigint),'latest_seq',(select max(seq)from public.chat_messages where conversation_id=p_conversation));
end $function$
;
revoke all on function private.chat_page(uuid,bigint,uuid,bigint)from public,anon,authenticated,service_role;
create or replace function private.chat_detail(p_conversation uuid,p_before bigint,p_anchor uuid)returns jsonb language sql stable security definer set search_path='' as $$select private.chat_page(p_conversation,p_before,p_anchor,null)$$;
revoke all on function private.chat_detail(uuid,bigint,uuid)from public,anon,service_role;
grant execute on function private.chat_detail(uuid,bigint,uuid)to authenticated;
create function private.chat_after(p_conversation uuid,p_after bigint)returns jsonb language sql stable security definer set search_path='' as $$select private.chat_page(p_conversation,null,null,p_after)$$;
revoke all on function private.chat_after(uuid,bigint)from public,anon,authenticated,service_role;
grant execute on function private.chat_after(uuid,bigint)to authenticated;
create function public.chat_after(p_conversation uuid,p_after bigint)returns jsonb language sql stable security invoker set search_path='' as $$select private.chat_after(p_conversation,p_after)$$;
revoke all on function public.chat_after(uuid,bigint)from public,anon,authenticated,service_role;
grant execute on function public.chat_after(uuid,bigint)to authenticated;
CREATE OR REPLACE FUNCTION private.billing_storage_company(p_bucket text, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if p_bucket='role-documents' then return (select company_id from public.profiles where id=private.document_owner(p_name));end if;
 if p_bucket in('task-files','capture-originals','chat-attachments')then return private.document_owner(p_name);end if;
 return null;
end$function$
;
CREATE OR REPLACE FUNCTION private.billing_storage_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare company uuid;used_bytes bigint;incoming bigint;
begin
 if new.bucket_id not in('task-files','capture-originals','role-documents','chat-attachments')then return new;end if;
 company:=private.billing_storage_company(new.bucket_id,new.name);
 if company is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(company::text,731));
 if private.billing_effective_plan(company)<>'free' then return new;end if;
 -- Storage permission probes may omit metadata; actual completion supplies the server-measured size.
 if coalesce(new.metadata->>'size','') !~ '^[0-9]{1,12}$'then return new;end if;
 incoming:=(new.metadata->>'size')::bigint;
 if tg_op='UPDATE' then
  if company=private.billing_storage_company(old.bucket_id,old.name) and coalesce(old.metadata->>'size','')~'^[0-9]{1,12}$' then
   if incoming<=(old.metadata->>'size')::bigint then return new;end if;
  end if;
 end if;
 select coalesce(sum(case when coalesce(metadata->>'size','')~'^[0-9]{1,12}$'then (metadata->>'size')::bigint else 0 end),0)into used_bytes from storage.objects where id<>new.id and bucket_id in('task-files','capture-originals','role-documents','chat-attachments') and private.billing_storage_company(bucket_id,name)=company;
 if used_bytes+incoming>104857600 then raise check_violation using message='Your Free plan has reached 100 MB of uploads. Remove an unused file or upgrade in Plans and billing.';end if;
 return new;
end$function$
;
