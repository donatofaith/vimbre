-- The legacy endpoint cannot bypass structured review/version checks.
do $$declare definition text;begin
 select pg_get_functiondef('private.myday_handover(uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'if u is null or c is null then','if exists(select 1 from public.work_handovers where id=p_id and structured) then raise insufficient_privilege using message=''Use the handover review flow'';end if; if u is null or c is null then');execute definition;
end$$;
alter table public.work_handovers add column activated_at timestamptz;
create function private.activate_handovers() returns integer language plpgsql security definer set search_path='' as $$declare h public.work_handovers;n integer:=0;begin
 for h in update public.work_handovers w set activated_at=now() where structured and status='approved' and activated_at is null and starts_on<=current_date returning w.* loop
 insert into private.handover_history(handover_id,version,actor_id,operation,snapshot) values(h.id,h.version,null,'active',to_jsonb(h));
 insert into public.activity_log(company_id,actor_id,record_type,record_id,action) values(h.company_id,null,'handover',h.id,'active');n:=n+1;end loop;return n;
end$$;
revoke all on function private.activate_handovers() from public,anon,authenticated,service_role;
select cron.schedule('vimbre-handover-activation','* * * * *','select private.activate_handovers();');
