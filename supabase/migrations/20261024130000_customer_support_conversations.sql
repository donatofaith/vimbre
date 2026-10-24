-- Customer-safe support inbox and reply RPCs. Staff-only private notes are never returned.
create or replace function private.customer_support(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  target uuid;
  ticket public.console_support_tickets;
  body_text text;
  result jsonb;
begin
  if uid is null then return jsonb_build_object('ok',false,'code','sign_in'); end if;
  if not exists (select 1 from public.profiles where id=uid and active=true) then
    return jsonb_build_object('ok',false,'code','access_denied');
  end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) is distinct from 'object' then
    return jsonb_build_object('ok',false,'code','invalid_input');
  end if;

  if p_action='submit' then
    return private.submit_customer_support(
      p_payload->>'subject', p_payload->>'category', p_payload->>'body'
    );
  elsif p_action='list' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb) into result
    from (
      select id,ticket_number,subject,category,status,created_at,updated_at,first_reply_at
      from public.console_support_tickets where customer_user_id=uid
      order by updated_at desc limit 100
    ) x;
    return jsonb_build_object('ok',true,'data',result);
  elsif p_action='detail' then
    begin target := (p_payload->>'ticket_id')::uuid; exception when others then target := null; end;
    if target is null then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
    select * into ticket from public.console_support_tickets where id=target and customer_user_id=uid;
    if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
    select jsonb_build_object(
      'ticket',jsonb_build_object('id',ticket.id,'ticket_number',ticket.ticket_number,'subject',ticket.subject,'category',ticket.category,'status',ticket.status,'created_at',ticket.created_at,'updated_at',ticket.updated_at),
      'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sender_kind',m.sender_kind,'body',m.body,'created_at',m.created_at) order by m.created_at) from public.console_ticket_messages m where m.ticket_id=target),'[]'::jsonb)
    ) into result;
    return jsonb_build_object('ok',true,'data',result);
  elsif p_action='reply' then
    begin target := (p_payload->>'ticket_id')::uuid; exception when others then target := null; end;
    body_text := btrim(coalesce(p_payload->>'body',''));
    if target is null or length(body_text) not between 1 and 10000 then
      return jsonb_build_object('ok',false,'code','invalid_input');
    end if;
    select * into ticket from public.console_support_tickets where id=target and customer_user_id=uid for update;
    if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
    insert into public.console_ticket_messages(ticket_id,sender_kind,body) values(target,'customer',body_text);
    update public.console_support_tickets set status=case when status='resolved' then 'open' else status end,updated_at=now() where id=target;
    return jsonb_build_object('ok',true);
  end if;
  return jsonb_build_object('ok',false,'code','not_available');
end
$$;

revoke all on function private.customer_support(text,jsonb) from public,anon,service_role;
grant usage on schema private to authenticated;
grant execute on function private.customer_support(text,jsonb) to authenticated;

create or replace function public.customer_support(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.customer_support(p_action,p_payload)
$$;
revoke all on function public.customer_support(text,jsonb) from public,anon,service_role;
grant execute on function public.customer_support(text,jsonb) to authenticated;
