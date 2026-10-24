-- Participant names are projected here without expanding employee profile access.
create function private.myday_handovers() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid:=private.current_company_id();tz text;begin
 if u is null or c is null then raise insufficient_privilege;end if;
 tz:=coalesce((select timezone from public.work_preferences where owner_id=u),'Europe/London');
 return jsonb_build_object('today',(now() at time zone tz)::date,'timezone',tz,'rows',coalesce((select jsonb_agg(to_jsonb(h) order by h.updated_at desc) from (
 select w.*,p.full_name as owner_name,cover.full_name as cover_name,r.full_name as reviewer_name from public.work_handovers w
 join public.profiles p on p.id=w.owner_id join public.profiles cover on cover.id=w.cover_id join public.profiles r on r.id=w.reviewer_id
 where w.company_id=c and (w.owner_id=u or w.reviewer_id=u and w.status<>'draft' and private.can_read_role(w.owner_id) and exists(select 1 from public.profiles where id=u and role in ('hr_admin','manager')) or w.cover_id=u and w.status='approved')
 order by w.updated_at desc limit 100)h),'[]'::jsonb));
end $$;
revoke all on function private.myday_handovers() from public,anon,authenticated;grant execute on function private.myday_handovers() to authenticated;
create or replace function public.myday_handovers() returns jsonb language sql stable security invoker set search_path='' as $$select private.myday_handovers()$$;
create function private.myday_people(p_query text,p_page integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c uuid:=private.current_company_id();begin
 if auth.uid() is null or c is null then raise insufficient_privilege;end if;
 if p_query is null or char_length(p_query)>100 or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid people search' using errcode='22023';end if;
 return coalesce((select jsonb_agg(to_jsonb(p) order by p.full_name,p.id) from(select id,full_name,role,department_id from public.profiles where company_id=c and active and id<>auth.uid() and strpos(lower(full_name),lower(p_query))>0 order by full_name,id limit 100 offset p_page*100)p),'[]'::jsonb);
end $$;
revoke all on function private.myday_people(text,integer) from public,anon,authenticated;grant execute on function private.myday_people(text,integer) to authenticated;
create function public.myday_people(p_query text default '',p_page integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select private.myday_people(p_query,p_page)$$;
revoke all on function public.myday_people(text,integer) from public,anon,authenticated;grant execute on function public.myday_people(text,integer) to authenticated;
