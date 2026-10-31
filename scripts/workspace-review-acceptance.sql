begin;
do $t$
declare u uuid;c uuid;v uuid;w uuid;dep uuid:=gen_random_uuid();request uuid:=gen_random_uuid();cap uuid:=gen_random_uuid();draft uuid:=gen_random_uuid();x jsonb;n int;
begin
 select id,company_id into u,c from public.profiles where active and role='hr_admin' and (select count(*) from public.profiles q where q.company_id=profiles.company_id and q.active)>=3 order by created_at limit 1;
 if u is null then raise exception 'Fixture needs an administrator and two teammates';end if;
 select id into v from public.profiles where company_id=c and active and id<>u order by id limit 1;
 select id into w from public.profiles where company_id=c and active and id not in(u,v) order by id limit 1;
 insert into public.departments(id,company_id,name) values(dep,c,'Rollback assignment group');
 update public.profiles set department_id=dep where id in(v,w);
 perform set_config('request.jwt.claim.sub',u::text,true);
 x:=private.myday_suite('assign_many',request,jsonb_build_object('title','Rollback task','recipient_ids',jsonb_build_array(v),'department_ids',jsonb_build_array(dep)));
 if (x->>'sent')::int<>2 then raise exception 'Department expansion or deduplication failed';end if;
 perform private.myday_suite('assign_many',request,jsonb_build_object('title','Rollback task','recipient_ids',jsonb_build_array(v),'department_ids',jsonb_build_array(dep)));
 select count(*) into n from private.myday_assignments where creator_id=u and title='Rollback task';
 if n<>2 then raise exception 'Retry created duplicate requests';end if;
 perform private.capture_workspace('create',cap,jsonb_build_object('source_text','Rollback note '||cap,'title','Rollback review','channel','paste'));
 perform private.capture_change('add',draft,cap,jsonb_build_object('kind','decision','title','Rollback decision','reason','Fixture reason'));
 perform private.myday_suite('review_note',draft,'{"version":1,"note":"Check this decision"}');
 if not exists(select 1 from public.capture_items where id=draft and version=2 and payload->>'review_comment'='Check this decision') then raise exception 'Review comment not retained';end if;
 begin perform private.myday_suite('review_note',draft,'{"version":1,"note":"Old copy"}');raise exception 'Stale draft accepted';exception when sqlstate '40001' then null;end;
 x:=private.myday_stars();
 if (x->>'level_tasks')::int is distinct from (select count(distinct task_id) from private.myday_star_awards where owner_id=u and company_id=c and task_id is not null and not voided) then raise exception 'Level task count incorrect';end if;
 perform set_config('request.jwt.claim.sub',v::text,true);
 begin perform private.myday_suite('review_note',draft,'{"version":2,"note":"Not mine"}');raise exception 'Other member edited private review';exception when insufficient_privilege then null;end;
 begin perform private.myday_suite('assign_many',gen_random_uuid(),jsonb_build_object('title','Forbidden source','recipient_ids',jsonb_build_array(u),'source_task',gen_random_uuid()));raise exception 'Unowned source allowed';exception when insufficient_privilege then null;end;
end $t$;
rollback;
select 'Passed: department expansion, recipient deduplication, retry safety, owner-only comments, stale-version guard and personal level counts; all fixtures rolled back' as result;
