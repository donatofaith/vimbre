-- Authenticated workspace members can open a ticket without choosing a company or user ID.
create or replace function private.submit_customer_support(p_subject text, p_category text, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  member public.profiles;
  ticket_id uuid;
  ticket_no bigint;
  subject_text text := btrim(coalesce(p_subject, ''));
  body_text text := btrim(coalesce(p_body, ''));
  category_text text := coalesce(p_category, 'other');
begin
  if uid is null then return jsonb_build_object('ok',false,'code','sign_in'); end if;
  if length(subject_text) not between 1 and 200 or length(body_text) not between 1 and 10000
    or category_text not in ('billing','how_to','bug','feature_idea','other') then
    return jsonb_build_object('ok',false,'code','invalid_input');
  end if;
  select * into member from public.profiles where id=uid and active=true;
  if not found then return jsonb_build_object('ok',false,'code','access_denied'); end if;
  if (select count(*) from public.console_support_tickets where customer_user_id=uid and created_at >= date_trunc('day',now())) >= 3 then
    return jsonb_build_object('ok',false,'code','rate_limited');
  end if;
  insert into public.console_support_tickets(company_id,company_name,customer_user_id,customer_name,customer_email,subject,category)
  select c.id,c.name,member.id,member.full_name,member.email,subject_text,category_text
  from public.companies c where c.id=member.company_id
  returning id,ticket_number into ticket_id,ticket_no;
  if ticket_id is null then return jsonb_build_object('ok',false,'code','workspace_unavailable'); end if;
  insert into public.console_ticket_messages(ticket_id,sender_kind,body) values(ticket_id,'customer',body_text);
  return jsonb_build_object('ok',true,'ticket_number',ticket_no);
end $$;
revoke all on function private.submit_customer_support(text,text,text) from public,anon,service_role;
grant usage on schema private to authenticated;
grant execute on function private.submit_customer_support(text,text,text) to authenticated;
create or replace function public.submit_customer_support(p_subject text,p_category text,p_body text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.submit_customer_support(p_subject,p_category,p_body)
$$;
revoke all on function public.submit_customer_support(text,text,text) from public,anon,service_role;
grant execute on function public.submit_customer_support(text,text,text) to authenticated;
