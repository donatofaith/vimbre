-- Use the existing, administrator-controlled model configuration and budgets.
insert into public.ai_task_routes(task,primary_model_id,fallback_model_id,max_output_tokens,temperature,enabled)
select name,r.primary_model_id,r.fallback_model_id,4096,r.temperature,r.enabled
from public.ai_task_routes r cross join unnest(array['role_responsibility','role_workstream','role_external_contact','role_document','role_recurring_deadline','role_decision','tasks_extract']) name
where r.task='capture_extract'
on conflict(task) do nothing;

-- Provider receipt metadata only. The original text stays in owner-private captures.
create table private.capture_inbound_receipts (
 address_id uuid not null references public.capture_forwarding_addresses(id) on delete cascade,
 message_hash text not null check(message_hash ~ '^[a-f0-9]{64}$'),
 capture_id uuid not null references public.captures(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(address_id,message_hash)
);
create index capture_inbound_receipts_capture_idx on private.capture_inbound_receipts(capture_id);
alter table private.capture_inbound_receipts enable row level security;
revoke all on private.capture_inbound_receipts from public,anon,authenticated,service_role;

create function private.capture_receive(p_address text,p_sender text,p_message_hash text,p_title text,p_text text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.capture_forwarding_addresses; profile public.profiles; existing uuid; new_id uuid;
begin
 if p_address is null or p_sender is null or p_message_hash is null or p_message_hash !~ '^[a-f0-9]{64}$'
 or p_text is null or char_length(btrim(p_text))=0 or octet_length(p_text)>16000
 or p_title is null or char_length(p_title)>200 then
  raise exception 'Invalid inbound message' using errcode='22023';
 end if;
 -- Serialize receipts per address to make retries and the daily cap race safe.
 select * into a from public.capture_forwarding_addresses
 where lower(address)=lower(p_address) and enabled and verified_at is not null for update;
 if not found then return jsonb_build_object('accepted',false); end if;
 select * into profile from public.profiles where id=a.owner_id and company_id=a.company_id and active;
 if not found or lower(profile.email)<>lower(p_sender) then return jsonb_build_object('accepted',false); end if;
 select capture_id into existing from private.capture_inbound_receipts where address_id=a.id and message_hash=p_message_hash;
 if found then return jsonb_build_object('accepted',true,'duplicate',true); end if;
 if (select count(*) from private.capture_inbound_receipts where address_id=a.id and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=100 then
  return jsonb_build_object('accepted',false,'limited',true);
 end if;
 insert into public.captures(company_id,owner_id,title,source_text,source_type,source_date)
 values(a.company_id,a.owner_id,coalesce(nullif(btrim(p_title),''),'Forwarded email'),p_text,'email',(now() at time zone 'UTC')::date) returning id into new_id;
 insert into private.capture_inbound_receipts(address_id,message_hash,capture_id) values(a.id,p_message_hash,new_id);
 -- No draft, task, decision or model call occurs until the owner reviews the capture.
 return jsonb_build_object('accepted',true,'duplicate',false);
end; $$;
revoke all on function private.capture_receive(text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.capture_receive(text,text,text,text,text) to service_role;
create function public.capture_receive(p_address text,p_sender text,p_message_hash text,p_title text,p_text text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.capture_receive(p_address,p_sender,p_message_hash,p_title,p_text)
$$;
revoke all on function public.capture_receive(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.capture_receive(text,text,text,text,text) to service_role;
