-- Chat writes are narrow RPCs; table reads are participant-only (including Realtime).
create table public.chat_conversations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 kind text not null check(kind in ('direct','group')), title text not null check(char_length(title) between 1 and 80),
 direct_key text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,direct_key), unique(id,company_id), check((kind='direct')=(direct_key is not null))
);
create table public.chat_members (
 conversation_id uuid not null, company_id uuid not null, user_id uuid not null references public.profiles(id),
 last_read_seq bigint not null default 0 check(last_read_seq>=0), joined_at timestamptz not null default now(),
 primary key(conversation_id,user_id), foreign key(conversation_id,company_id) references public.chat_conversations(id,company_id) on delete cascade
);
create index chat_members_user_idx on public.chat_members(user_id,conversation_id);
create table public.chat_messages (
 id uuid primary key, seq bigint generated always as identity unique, conversation_id uuid not null, company_id uuid not null,
 sender_id uuid not null references public.profiles(id), body text not null check(char_length(btrim(body)) between 1 and 4000),
 reply_to uuid, mentions uuid[] not null default '{}', record_path text, created_at timestamptz not null default now(),
 unique(id,conversation_id), foreign key(conversation_id,company_id) references public.chat_conversations(id,company_id) on delete cascade,
 foreign key(reply_to,conversation_id) references public.chat_messages(id,conversation_id),
 check(cardinality(mentions)<=50), check(record_path is null or (char_length(record_path)<=500 and record_path ~ '^/app/(role-record|team-activity|handovers|my-cover-duties)(\?|$)'))
);
create index chat_messages_thread_seq_idx on public.chat_messages(conversation_id,seq desc);
create index chat_messages_sender_idx on public.chat_messages(sender_id);
create index chat_messages_reply_idx on public.chat_messages(reply_to,conversation_id) where reply_to is not null;
create table public.chat_notifications (
 id bigint generated always as identity primary key, recipient_id uuid not null references public.profiles(id), company_id uuid not null,
 conversation_id uuid not null, message_id uuid not null, mentioned boolean not null default false, created_at timestamptz not null default now(),
 unique(recipient_id,message_id), foreign key(message_id,conversation_id) references public.chat_messages(id,conversation_id) on delete cascade,
 foreign key(conversation_id,company_id) references public.chat_conversations(id,company_id) on delete cascade
);
create index chat_notifications_recipient_idx on public.chat_notifications(recipient_id,id desc);
create index chat_notifications_message_idx on public.chat_notifications(message_id,conversation_id);
create index chat_notifications_conversation_idx on public.chat_notifications(conversation_id,company_id);
create index chat_conversations_company_idx on public.chat_conversations(company_id,updated_at desc);
create index chat_conversations_creator_idx on public.chat_conversations(created_by);

create function private.chat_can_access(p_conversation uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_members m join public.profiles p on p.id=m.user_id and p.company_id=m.company_id
 where m.conversation_id=p_conversation and p.id=(select auth.uid()) and p.active)
$$;
revoke all on function private.chat_can_access(uuid) from public,anon,authenticated;
grant execute on function private.chat_can_access(uuid) to authenticated;

alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_notifications enable row level security;
revoke all on public.chat_conversations,public.chat_members,public.chat_messages,public.chat_notifications from anon,authenticated;
grant select on public.chat_conversations,public.chat_members,public.chat_messages,public.chat_notifications to authenticated;
create policy chat_conversation_read on public.chat_conversations for select to authenticated using(private.chat_can_access(id));
create policy chat_member_read on public.chat_members for select to authenticated using(private.chat_can_access(conversation_id));
create policy chat_message_read on public.chat_messages for select to authenticated using(private.chat_can_access(conversation_id));
create policy chat_notification_read on public.chat_notifications for select to authenticated using(recipient_id=(select auth.uid()) and private.chat_can_access(conversation_id));

-- Every operation rechecks the current protected profile, never user-editable metadata.
create function private.chat_people(p_search text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 if p_search is null or char_length(p_search)>100 or p_page is null or p_page<0 or p_page>10000 then raise exception 'Invalid search' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
 select id,full_name,role from public.profiles where company_id=viewer.company_id and active and id<>viewer.id
 and strpos(lower(full_name),lower(btrim(p_search)))>0 order by full_name,id limit 50 offset p_page*50) r;
 return result;
end $$;
create function private.chat_create(p_kind text,p_title text,p_members uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare viewer public.profiles; people uuid[]; new_id uuid; key text;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 if p_kind is null or p_kind not in ('direct','group') or p_members is null or cardinality(p_members)<1 or cardinality(p_members)>49 then raise exception 'Choose between 1 and 49 teammates' using errcode='22023'; end if;
 select array_agg(distinct id order by id) into people from unnest(p_members || array[viewer.id]) id;
 if exists(select 1 from unnest(people) u(id) where u.id is null or not exists(select 1 from public.profiles p where p.id=u.id and p.company_id=viewer.company_id and p.active)) then raise insufficient_privilege using message='Choose active teammates in your company'; end if;
 if cardinality(people)<2 then raise exception 'Choose a teammate' using errcode='22023'; end if;
 if p_kind='direct' and cardinality(people)<>2 then raise exception 'Choose one teammate' using errcode='22023'; end if;
 if p_kind='group' and (p_title is null or char_length(btrim(p_title)) not between 1 and 80) then raise exception 'Enter a group name (up to 80 characters)' using errcode='22023'; end if;
 if p_kind='direct' then key:=array_to_string(people,':'); end if;
 -- Serialize per company to avoid duplicate direct chats or concurrent spam creates.
 perform 1 from public.companies where id=viewer.company_id for update;
 if key is not null then select id into new_id from public.chat_conversations where company_id=viewer.company_id and direct_key=key; if found then return new_id; end if; end if;
 if (select count(*) from public.chat_conversations where created_by=viewer.id and created_at>now()-interval '1 minute')>=10 then raise exception 'Please wait before creating another chat' using errcode='22023'; end if;
 insert into public.chat_conversations(company_id,kind,title,direct_key,created_by) values(viewer.company_id,p_kind,case when p_kind='direct' then 'Direct message' else btrim(p_title) end,key,viewer.id) returning id into new_id;
 insert into public.chat_members(conversation_id,company_id,user_id) select new_id,viewer.company_id,id from unnest(people) id;
 return new_id;
end $$;
create function private.chat_list(p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 if p_page is null or p_page<0 or p_page>10000 then raise exception 'Invalid page' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by updated_at desc,id),'[]'::jsonb) into result from (
 select c.id,c.kind,case when c.kind='direct' then coalesce((select p.full_name from public.chat_members cm join public.profiles p on p.id=cm.user_id where cm.conversation_id=c.id and cm.user_id<>viewer.id limit 1),'Teammate') else c.title end as title,c.updated_at,
 (select left(body,120) from public.chat_messages where conversation_id=c.id order by seq desc limit 1) as preview,
 (select count(*)::integer from public.chat_messages where conversation_id=c.id and sender_id<>viewer.id and seq>m.last_read_seq) as unread
 from public.chat_members m join public.chat_conversations c on c.id=m.conversation_id
 where m.user_id=viewer.id and m.company_id=viewer.company_id order by c.updated_at desc,c.id limit 50 offset p_page*50) r;
 return result;
end $$;
create function private.chat_detail(p_conversation uuid,p_before bigint,p_anchor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
 'members',(select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'active',p.active) order by p.full_name,p.id) from public.chat_members cm join public.profiles p on p.id=cm.user_id where cm.conversation_id=p_conversation),
 'kind',(select kind from public.chat_conversations where id=p_conversation),
 'title',(select title from public.chat_conversations where id=p_conversation)) into result;
 return result;
end $$;
create function private.chat_send(p_conversation uuid,p_id uuid,p_body text,p_reply uuid,p_mentions uuid[],p_record_path text) returns uuid
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); tenant uuid; existing public.chat_messages; new_message public.chat_messages;
begin
 if not private.chat_can_access(p_conversation) then raise insufficient_privilege using message='This conversation is not available'; end if;
 select company_id into tenant from public.chat_conversations where id=p_conversation for update;
 select * into existing from public.chat_messages where id=p_id;
 if found then
  if existing.conversation_id=p_conversation and existing.sender_id=viewer and existing.body=btrim(p_body) and existing.reply_to is not distinct from p_reply and existing.mentions=coalesce(p_mentions,'{}') and existing.record_path is not distinct from p_record_path then return p_id; end if;
  raise exception 'This message could not be sent. Please retry.' using errcode='22023';
 end if;
 if p_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 or cardinality(p_mentions)>50 or array_position(p_mentions,null) is not null then raise exception 'Enter a message of up to 4,000 characters' using errcode='22023'; end if;
 if p_record_path is not null and (char_length(p_record_path)>500 or p_record_path !~ '^/app/(role-record|team-activity|handovers|my-cover-duties)(\?|$)') then raise exception 'Choose a Vimbre record link' using errcode='22023'; end if;
 if p_reply is not null and not exists(select 1 from public.chat_messages where id=p_reply and conversation_id=p_conversation) then raise exception 'Reply to a message in this conversation' using errcode='22023'; end if;
 if exists(select 1 from unnest(p_mentions) mid where not exists(select 1 from public.chat_members m join public.profiles p on p.id=m.user_id where m.conversation_id=p_conversation and p.id=mid and p.active and p.company_id=tenant)) then raise exception 'Mention a current participant' using errcode='22023'; end if;
 if (select count(*) from public.chat_messages where sender_id=viewer and created_at>now()-interval '1 minute')>=60 then raise exception 'You are sending messages too quickly. Please wait.' using errcode='22023'; end if;
 insert into public.chat_messages(id,conversation_id,company_id,sender_id,body,reply_to,mentions,record_path) values(p_id,p_conversation,tenant,viewer,btrim(p_body),p_reply,coalesce(p_mentions,'{}'),p_record_path) returning * into new_message;
 update public.chat_conversations set updated_at=clock_timestamp() where id=p_conversation;
 insert into public.chat_notifications(recipient_id,company_id,conversation_id,message_id,mentioned)
 select m.user_id,tenant,p_conversation,p_id,m.user_id=any(coalesce(p_mentions,'{}')) from public.chat_members m join public.profiles p on p.id=m.user_id where m.conversation_id=p_conversation and p.active and p.company_id=tenant and m.user_id<>viewer;
 return p_id;
end $$;
create function private.chat_read(p_conversation uuid,p_through bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.chat_can_access(p_conversation) then raise insufficient_privilege using message='This conversation is not available'; end if;
 update public.chat_members set last_read_seq=greatest(last_read_seq,least(coalesce(p_through,0),coalesce((select max(seq) from public.chat_messages where conversation_id=p_conversation),0))) where conversation_id=p_conversation and user_id=auth.uid();
end $$;
create function private.chat_inbox() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer public.profiles; result jsonb;
begin
 select * into viewer from public.profiles where id=auth.uid() and active;
 if not found then raise insufficient_privilege using message='Chat is not available'; end if;
 with unread as materialized (
 select n.id,n.conversation_id,n.message_id,n.mentioned,n.created_at,p.full_name as sender_name,left(msg.body,120) as preview,
 case when c.kind='direct' then p.full_name else c.title end as title
 from public.chat_notifications n join public.chat_members m on m.conversation_id=n.conversation_id and m.user_id=viewer.id and m.company_id=viewer.company_id
 join public.chat_messages msg on msg.id=n.message_id join public.profiles p on p.id=msg.sender_id join public.chat_conversations c on c.id=n.conversation_id
 where n.recipient_id=viewer.id and n.company_id=viewer.company_id and msg.seq>m.last_read_seq
 ) select jsonb_build_object('unread',(select count(*) from unread),'mentions',(select count(*) from unread where mentioned),
 'items',coalesce((select jsonb_agg(to_jsonb(r) order by id desc) from (select * from unread order by id desc limit 30) r),'[]'::jsonb)) into result;
 return result;
end $$;

-- Public, invoker-only wrappers retain the repository's RPC convention.
create function public.chat_people(p_search text default '',p_page integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select private.chat_people(p_search,p_page)$$;
create function public.chat_create(p_kind text,p_title text,p_members uuid[]) returns uuid language sql security invoker set search_path='' as $$select private.chat_create(p_kind,p_title,p_members)$$;
create function public.chat_list(p_page integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select private.chat_list(p_page)$$;
create function public.chat_detail(p_conversation uuid,p_before bigint default null,p_anchor uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.chat_detail(p_conversation,p_before,p_anchor)$$;
create function public.chat_send(p_conversation uuid,p_id uuid,p_body text,p_reply uuid default null,p_mentions uuid[] default '{}',p_record_path text default null) returns uuid language sql security invoker set search_path='' as $$select private.chat_send(p_conversation,p_id,p_body,p_reply,p_mentions,p_record_path)$$;
create function public.chat_read(p_conversation uuid,p_through bigint) returns void language sql security invoker set search_path='' as $$select private.chat_read(p_conversation,p_through)$$;
create function public.chat_inbox() returns jsonb language sql stable security invoker set search_path='' as $$select private.chat_inbox()$$;

revoke all on function private.chat_people(text,integer) from public,anon,authenticated;
grant execute on function private.chat_people(text,integer) to authenticated;

revoke all on function private.chat_create(text,text,uuid[]) from public,anon,authenticated;
grant execute on function private.chat_create(text,text,uuid[]) to authenticated;

revoke all on function private.chat_list(integer) from public,anon,authenticated;
grant execute on function private.chat_list(integer) to authenticated;

revoke all on function private.chat_detail(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function private.chat_detail(uuid,bigint,uuid) to authenticated;

revoke all on function private.chat_send(uuid,uuid,text,uuid,uuid[],text) from public,anon,authenticated;
grant execute on function private.chat_send(uuid,uuid,text,uuid,uuid[],text) to authenticated;

revoke all on function private.chat_read(uuid,bigint) from public,anon,authenticated;
grant execute on function private.chat_read(uuid,bigint) to authenticated;

revoke all on function private.chat_inbox() from public,anon,authenticated;
grant execute on function private.chat_inbox() to authenticated;

revoke all on function public.chat_people(text,integer) from public,anon,authenticated;
grant execute on function public.chat_people(text,integer) to authenticated;

revoke all on function public.chat_create(text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.chat_create(text,text,uuid[]) to authenticated;

revoke all on function public.chat_list(integer) from public,anon,authenticated;
grant execute on function public.chat_list(integer) to authenticated;

revoke all on function public.chat_detail(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.chat_detail(uuid,bigint,uuid) to authenticated;

revoke all on function public.chat_send(uuid,uuid,text,uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.chat_send(uuid,uuid,text,uuid,uuid[],text) to authenticated;

revoke all on function public.chat_read(uuid,bigint) from public,anon,authenticated;
grant execute on function public.chat_read(uuid,bigint) to authenticated;

revoke all on function public.chat_inbox() from public,anon,authenticated;
grant execute on function public.chat_inbox() to authenticated;

alter publication supabase_realtime add table public.chat_notifications;
