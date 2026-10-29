do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();company uuid;conversation uuid;message uuid:=gen_random_uuid();position bigint;detail jsonb;blocked boolean:=false;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)select id,'receipt-'||id||'@example.invalid',now(),'{"company_name":"Receipt fixture","full_name":"Fixture Person"}'::jsonb from unnest(array[u,v,outsider])id;
 select company_id into company from public.profiles where id=u;
 update public.profiles set company_id=company where id=v;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 conversation:=public.chat_create('direct','',array[v]);
 perform public.chat_send(conversation,message,'Please review @Fixture Person',null,array[v],null);
 select seq into position from public.chat_messages where id=message;
 detail:=public.chat_detail(conversation,null,null);
 if jsonb_array_length(detail->'members')<>2 or not exists(select 1 from jsonb_array_elements(detail->'members')m where m->>'id'=v::text and m ? 'last_read_seq' and m ? 'joined_at' and (m->>'last_read_seq')::bigint<position) then raise exception 'Missing initial unread position';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);
 perform public.chat_read(conversation,position);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 detail:=public.chat_detail(conversation,null,null);
 if not exists(select 1 from jsonb_array_elements(detail->'members')m where m->>'id'=v::text and (m->>'last_read_seq')::bigint>=position) then raise exception 'Receipt did not advance';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 begin perform public.chat_detail(conversation,null,null);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Outsider accessed read receipts';end if;
end$$;
