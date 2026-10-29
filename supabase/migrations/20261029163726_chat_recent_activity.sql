create or replace function private.chat_list(p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 if p_page is null or p_page<0 or p_page>10000 then raise exception 'Invalid page' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by updated_at desc,id),'[]'::jsonb) into result from (
 select c.is_team,c.id,c.kind,case when c.kind='direct' then coalesce((select p.full_name from public.chat_members cm join public.profiles p on p.id=cm.user_id where cm.conversation_id=c.id and cm.user_id<>viewer.id limit 1),'Teammate') else c.title end as title,c.updated_at,
 (select left(body,120) from public.chat_messages where conversation_id=c.id order by seq desc limit 1) as preview,
 (select count(*)::integer from public.chat_messages where conversation_id=c.id and sender_id<>viewer.id and seq>m.last_read_seq) as unread
 from public.chat_members m join public.chat_conversations c on c.id=m.conversation_id
 where m.user_id=viewer.id and m.company_id=viewer.company_id order by c.updated_at desc,c.id limit 50 offset p_page*50) r;
 return result;
end $$;