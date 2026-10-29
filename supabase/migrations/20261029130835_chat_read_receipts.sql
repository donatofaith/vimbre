CREATE OR REPLACE FUNCTION private.chat_detail(p_conversation uuid, p_before bigint, p_anchor uuid)
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
 select m.id,m.seq,m.sender_id,p.full_name as sender_name,m.body,m.reply_to,m.mentions,m.record_path,m.created_at,
 case when r.id is not null then jsonb_build_object('id',r.id,'body',left(r.body,160),'sender_name',rp.full_name) end as reply,
 coalesce((select jsonb_agg(jsonb_build_object('id',mp.id,'name',mp.full_name)) from public.profiles mp where mp.id=any(m.mentions)),'[]'::jsonb) as mention_names
 from public.chat_messages m join public.profiles p on p.id=m.sender_id
 left join public.chat_messages r on r.id=m.reply_to left join public.profiles rp on rp.id=r.sender_id
 where m.conversation_id=p_conversation and (p_before is null or m.seq<p_before) and (anchor_seq is null or m.seq<=anchor_seq)
 order by m.seq desc limit 50
 ) select jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(rows) order by seq) from rows),'[]'::jsonb),
 'members',(select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'active',p.active,'last_read_seq',cm.last_read_seq,'joined_at',cm.joined_at) order by p.full_name,p.id) from public.chat_members cm join public.profiles p on p.id=cm.user_id where cm.conversation_id=p_conversation),
 'kind',(select kind from public.chat_conversations where id=p_conversation),
 'title',(select title from public.chat_conversations where id=p_conversation)) into result;
 return result;
end $function$
;
