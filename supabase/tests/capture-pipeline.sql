-- Run after team-fixtures.sql, rollback only.
do $$declare s uuid:=gen_random_uuid();d uuid:=gen_random_uuid();sm uuid:=gen_random_uuid();v jsonb;begin
 perform public.capture_change('create',s,null,'{"title":"Review meeting","source_text":"Supplier reviews move to monthly because of meeting load.","source_type":"meeting","source_date":"2026-10-23"}');
 perform public.capture_change('add',d,s,'{"kind":"action","title":"Share review notes","due_date":"2026-10-24","priority":"high","details":"Send to Operations"}');
 perform public.capture_change('confirm',d,s,'{"version":1}');perform public.capture_change('confirm',d,s,'{"version":1}');
 if(select count(*) from public.actions where capture_id=s)<>1 then raise exception 'Duplicate confirmation';end if;
 if(select priority from public.actions where capture_id=s)<>'high' then raise exception 'Lost priority';end if;
 perform public.capture_change('add',sm,s,'{"kind":"summary","title":"Supplier review context","details":"Monthly review cadence"}');
 perform public.capture_pipeline('confirm',s,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',sm,'version',1))));
 if(select status from public.captures where id=s)<>'saved' then raise exception 'Wrong saved state';end if;
 if not(public.capture_list(0,false)::text like '%items_created%')then raise exception 'Missing list fields';end if;
 v:=public.capture_pipeline('options');if v->>'forwarding'<>'false' or v->>'upload'<>'false' then raise exception 'Channels must be off';end if;
 perform set_config('test.capture',s::text,true);
 -- An employee cannot choose another owner or a company outside their own.
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$begin if public.capture_detail(current_setting('test.capture')::uuid)is not null then raise exception 'Manager can read original';end if;
 begin perform public.capture_change('add',gen_random_uuid(),current_setting('test.capture')::uuid,'{"kind":"action","title":"Forbidden"}');raise exception 'Manager modified private draft';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.employee'),true);
do $$declare s uuid:=gen_random_uuid();begin
 perform public.capture_change('create',s,null,'{"source_text":"Review notes","source_type":"note","source_date":"2026-10-23"}');
 begin perform public.capture_change('add',gen_random_uuid(),s,jsonb_build_object('kind','action','title','Illegal assignment','owner_id',current_setting('test.admin')));raise exception 'Employee assigned another owner';exception when insufficient_privilege then null;end;
 begin perform public.capture_change('create',gen_random_uuid(),null,'{"source_text":"File text","source_type":"note","channel":"upload"}');raise exception 'Upload flag bypass';exception when invalid_parameter_value then null;end;
end$$;
reset role;
do $$declare u uuid:=current_setting('test.admin')::uuid;s uuid:=current_setting('test.capture')::uuid;r uuid:=gen_random_uuid();j jsonb;f text:=repeat('a',64);hash text;begin
 select encode(extensions.digest(source_text,'sha256'),'hex')into hash from public.captures where id=s;
 j:=public.capture_ai_claim(u,s,r,'capture_extract',f,hash,false);
 if j->>'blocked' is not null then raise exception 'Initial draft blocked';end if;
 perform public.capture_ai_complete(u,r,'{"decisions":[],"tasks":[],"summaries":[]}','[]');
 r:=gen_random_uuid();j:=public.capture_ai_claim(u,s,r,'capture_extract',f,hash,false);
 if j->>'cached' is null then raise exception 'Cache not reused';end if;
 perform public.capture_ai_complete(u,r,j->>'cached','[]');
 if(select draft_attempts from public.captures where id=s)<>1 then raise exception 'Cache charged redraft';end if;
 for n in 2..3 loop r:=gen_random_uuid();perform public.capture_ai_claim(u,s,r,'capture_extract',repeat(n::text,64),hash,true);perform public.capture_ai_complete(u,r,null,null);end loop;
 j:=public.capture_ai_claim(u,s,gen_random_uuid(),'capture_extract',repeat('d',64),hash,true);
 if j->>'blocked' not like '%both redrafts%' then raise exception 'Redraft cap bypass';end if;
 if has_function_privilege('authenticated','public.capture_ai_claim(uuid,uuid,uuid,text,text,text,boolean)','execute')then raise exception 'Customer can invoke service claim';end if;
 j:=public.capture_receive_v2('nonexistent@example.invalid','owner@example.invalid',repeat('a',64),'Test','Text',null);
 if(j->>'accepted')::boolean then raise exception 'Unknown forwarding accepted';end if;
end$$;
select 'Capture pipeline privacy, confirmation and cache tests passed' result;
rollback;
