-- A new company conversation; existing selected-member groups remain private.
alter table public.chat_conversations add column is_team boolean not null default false;
alter table public.chat_conversations add constraint chat_team_kind_check check(not is_team or kind='group');
create unique index chat_one_team_per_company_idx on public.chat_conversations(company_id) where is_team;

create function private.chat_team() returns uuid
language plpgsql security definer set search_path='' as $$
declare viewer public.profiles; room uuid;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 -- Serialize creation with membership changes, so concurrent callers reuse one room.
 perform 1 from public.companies where id=viewer.company_id for update;
 if not exists(select 1 from public.profiles where id=viewer.id and active and company_id=viewer.company_id) then
  raise insufficient_privilege using message='Chat is not available';
 end if;
 select id into room from public.chat_conversations where company_id=viewer.company_id and is_team;
 if room is null then
  insert into public.chat_conversations(company_id,kind,title,created_by,is_team)
  values(viewer.company_id,'group','Team chat',viewer.id,true) returning id into room;
  insert into public.chat_members(conversation_id,company_id,user_id)
  select room,viewer.company_id,id from public.profiles where company_id=viewer.company_id and active;
 end if;
 return room;
end $$;
revoke all on function private.chat_team() from public,anon,authenticated;
grant execute on function private.chat_team() to authenticated;
create function public.chat_team() returns uuid language sql security invoker set search_path='' as $$select private.chat_team()$$;
revoke all on function public.chat_team() from public,anon,authenticated;
grant execute on function public.chat_team() to authenticated;

create function private.sync_team_chat_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.active then
  perform 1 from public.companies where id=new.company_id for update;
 end if;
 -- Remove company-chat membership on departure; never alter private conversations.
 delete from public.chat_members m using public.chat_conversations c
 where m.conversation_id=c.id and c.is_team and m.user_id=new.id
 and (not new.active or m.company_id<>new.company_id);
 if new.active then
  insert into public.chat_members(conversation_id,company_id,user_id)
  select id,new.company_id,new.id from public.chat_conversations where company_id=new.company_id and is_team
  on conflict(conversation_id,user_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.sync_team_chat_membership() from public,anon,authenticated;
create trigger profiles_team_chat_membership after insert or update of company_id,active on public.profiles
 for each row execute function private.sync_team_chat_membership();

-- Keep the shared conversation first while retaining private history.
create or replace function private.chat_list(p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 if p_page is null or p_page<0 or p_page>10000 then raise exception 'Invalid page' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by is_team desc,updated_at desc,id),'[]'::jsonb) into result from (
 select c.is_team,c.id,c.kind,case when c.kind='direct' then coalesce((select p.full_name from public.chat_members cm join public.profiles p on p.id=cm.user_id where cm.conversation_id=c.id and cm.user_id<>viewer.id limit 1),'Teammate') else c.title end as title,c.updated_at,
 (select left(body,120) from public.chat_messages where conversation_id=c.id order by seq desc limit 1) as preview,
 (select count(*)::integer from public.chat_messages where conversation_id=c.id and sender_id<>viewer.id and seq>m.last_read_seq) as unread
 from public.chat_members m join public.chat_conversations c on c.id=m.conversation_id
 where m.user_id=viewer.id and m.company_id=viewer.company_id order by c.is_team desc,c.updated_at desc,c.id limit 50 offset p_page*50) r;
 return result;
end $$;
