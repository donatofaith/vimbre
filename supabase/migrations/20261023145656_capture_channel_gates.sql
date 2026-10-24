-- Keep all incoming sources behind the company switch; receipt never calls AI.
create function private.capture_receive_v2(p_address text,p_sender text,p_message_hash text,p_title text,p_text text,p_sent_date text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.capture_forwarding_addresses;p public.profiles;existing uuid;new_id uuid;sent_date date;
begin
 if p_address is null or p_sender is null or p_message_hash is null or p_message_hash!~'^[a-f0-9]{64}$' or p_text is null or char_length(btrim(p_text))=0 or octet_length(p_text)>50000 or char_length(coalesce(p_title,''))>200 then return jsonb_build_object('accepted',false,'reason','invalid_message');end if;
 select * into a from public.capture_forwarding_addresses where lower(address)=lower(p_address) and enabled and verified_at is not null for update;
 if not found or not coalesce((select forwarding_enabled from public.capture_channel_settings where company_id=a.company_id and capture_domain=split_part(a.address,'@',2)),false) then return jsonb_build_object('accepted',false,'reason','forwarding_disabled');end if;
 select * into p from public.profiles where id=a.owner_id and company_id=a.company_id and active;
 if not found or lower(p.email)<>lower(p_sender) then return jsonb_build_object('accepted',false,'reason','sender_not_registered');end if;
 select capture_id into existing from private.capture_inbound_receipts where address_id=a.id and message_hash=p_message_hash;
 if found then return jsonb_build_object('accepted',true,'duplicate',true);end if;
 if(select count(*) from private.capture_inbound_receipts where address_id=a.id and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=100 then return jsonb_build_object('accepted',false,'reason','daily_email_limit');end if;
 begin sent_date:=nullif(left(p_sent_date,10),'')::date;exception when others then sent_date:=null;end;
 insert into public.captures(company_id,owner_id,title,source_text,source_type,source_date,channel,sender,status)
 values(a.company_id,a.owner_id,coalesce(nullif(btrim(p_title),''),'Forwarded email'),p_text,'email',coalesce(sent_date,(now() at time zone coalesce((select timezone from public.work_preferences where owner_id=p.id),'Europe/London'))::date),'email',p_sender,'received') returning id into new_id;
 insert into private.capture_inbound_receipts(address_id,message_hash,capture_id)values(a.id,p_message_hash,new_id);
 return jsonb_build_object('accepted',true,'duplicate',false);
end$$;
revoke all on function private.capture_receive_v2(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.capture_receive_v2(text,text,text,text,text,text) to service_role;
create function public.capture_receive_v2(p_address text,p_sender text,p_message_hash text,p_title text,p_text text,p_sent_date text default null) returns jsonb language sql security invoker set search_path='' as $$select private.capture_receive_v2(p_address,p_sender,p_message_hash,p_title,p_text,p_sent_date)$$;
revoke all on function public.capture_receive_v2(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.capture_receive_v2(text,text,text,text,text,text) to service_role;
create or replace function private.capture_receive(p_address text,p_sender text,p_message_hash text,p_title text,p_text text) returns jsonb language sql security definer set search_path='' as $$select private.capture_receive_v2(p_address,p_sender,p_message_hash,p_title,p_text,null)$$;
-- Staff channel controls re-use the Console's live MFA/session/rate/role guard.
create function private.console_capture_channels(p_company uuid,p_changes jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare gate jsonb;role_name text;config public.capture_channel_settings;domain text;
begin
 gate:=private.console_request('touch','',0);
 if not coalesce((gate->>'ok')::boolean,false) then return gate;end if;
 role_name:=gate->'data'->>'role';
 if role_name not in ('owner','engineering') then
  insert into public.staff_activity_log(staff_user_id,action,outcome)values(auth.uid(),'capture_channels','denied');
  return jsonb_build_object('ok',false,'code','access_denied');
 end if;
 if not exists(select 1 from public.companies where id=p_company) then return jsonb_build_object('ok',false,'code','invalid_input');end if;
 if p_changes is not null then
  if jsonb_typeof(p_changes)<>'object' or octet_length(p_changes::text)>1000 or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('capture_domain','forwarding_enabled','upload_enabled')) then return jsonb_build_object('ok',false,'code','invalid_input');end if;
  domain:=lower(btrim(p_changes->>'capture_domain'));
  if domain is not null and domain<>'' and (char_length(domain)>253 or domain!~'^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$') then return jsonb_build_object('ok',false,'code','invalid_input');end if;
  insert into public.capture_channel_settings(company_id)values(p_company)on conflict do nothing;
  select * into config from public.capture_channel_settings where company_id=p_company for update;
  if coalesce((p_changes->>'forwarding_enabled')::boolean,config.forwarding_enabled) and not exists(select 1 from public.capture_forwarding_addresses where company_id=p_company and enabled and verified_at is not null and split_part(address,'@',2)=coalesce(nullif(domain,''),config.capture_domain)) then return jsonb_build_object('ok',false,'code','address_not_verified');end if;
  update public.capture_channel_settings set capture_domain=coalesce(nullif(domain,''),capture_domain),forwarding_enabled=coalesce((p_changes->>'forwarding_enabled')::boolean,forwarding_enabled),upload_enabled=coalesce((p_changes->>'upload_enabled')::boolean,upload_enabled)where company_id=p_company;
 end if;
 insert into public.staff_activity_log(staff_user_id,action,outcome)values(auth.uid(),case when p_changes is null then 'capture_channels_view' else 'capture_channels_update' end,'allowed');
 return jsonb_build_object('ok',true,'data',jsonb_build_object('company',(select name from public.companies where id=p_company),'settings',coalesce((select to_jsonb(t) from public.capture_channel_settings t where company_id=p_company),jsonb_build_object('forwarding_enabled',false,'upload_enabled',false,'capture_domain','')),'addresses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'address',address,'enabled',enabled,'verified',verified_at is not null))from public.capture_forwarding_addresses where company_id=p_company),'[]'::jsonb)));
end$$;
revoke all on function private.console_capture_channels(uuid,jsonb) from public,anon,service_role;
grant execute on function private.console_capture_channels(uuid,jsonb) to authenticated;
create function public.console_capture_channels(p_company uuid,p_changes jsonb default null)returns jsonb language sql security invoker set search_path='' as $$select private.console_capture_channels(p_company,p_changes)$$;
revoke all on function public.console_capture_channels(uuid,jsonb) from public,anon,service_role;
grant execute on function public.console_capture_channels(uuid,jsonb) to authenticated;
alter table public.captures add column opened_at timestamptz;
create function public.capture_notifications(p_seen uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 if p_seen is not null then perform private.capture_mark_open(p_seen);end if;
 return jsonb_build_object('count',(select count(*) from public.captures where channel='email' and opened_at is null and deleted_at is null),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from(select id,title,created_at from public.captures where channel='email' and opened_at is null and deleted_at is null order by created_at desc limit 50)r),'[]'::jsonb));
end$$;
create function private.capture_mark_open(p_id uuid)returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or private.current_company_id() is null then raise insufficient_privilege;end if;
 update public.captures set opened_at=coalesce(opened_at,now()),status=case when status='received' then 'needs_review' else status end where id=p_id and owner_id=auth.uid() and company_id=private.current_company_id();
end$$;
revoke all on function private.capture_mark_open(uuid),public.capture_notifications(uuid) from public,anon;
grant execute on function private.capture_mark_open(uuid),public.capture_notifications(uuid) to authenticated;
