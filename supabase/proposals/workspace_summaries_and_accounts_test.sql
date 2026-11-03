create function pg_temp.fixture_action_dates()returns trigger language plpgsql as $$begin
 if new.title in ('October delivery','Completed after October','Teammate private task','Other company task')then new.created_at:='2026-10-01 12:00Z';if new.title='October delivery'then new.completed_at:='2026-10-10 12:00Z';elsif new.title='Completed after October'then new.completed_at:='2026-11-02 12:00Z';end if;end if;return new;
end$$;
create trigger zzz_fixture_action_dates before insert or update on public.actions for each row execute function pg_temp.fixture_action_dates();
-- Rollback-only fixtures. Prepend the proposed migration within the same transaction.
do $$declare u uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();peer uuid:=gen_random_uuid();unconfirmed uuid:=gen_random_uuid();c uuid;other_c uuid;rp uuid;dr uuid;tid uuid;outdata jsonb;receipt text;begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values(u,'workspace-individual@example.invalid',now(),'{"full_name":"Alex Personal","workspace_type":"individual"}'),(other_user,'workspace-other@example.invalid',now(),'{"full_name":"Other Person","company_name":"Other workspace","workspace_type":"company"}'),(peer,'workspace-founder@example.invalid',now(),'{"full_name":"Taylor Founder","workspace_type":"sole_founder"}');
 perform set_config('test.workspace_user',u::text,true);
 insert into auth.users(id,email,raw_user_meta_data)values(unconfirmed,'workspace-unconfirmed@example.invalid','{"full_name":"New Registration","workspace_type":"individual"}');perform set_config('test.signup_receipt',(select raw_app_meta_data->>'vimbre_signup_receipt'from auth.users where id=unconfirmed),true);
 select company_id into c from public.profiles where id=u;select company_id into other_c from public.profiles where id=other_user;
 if(select workspace_type from public.companies where id=c)<>'individual'then raise exception 'Individual signup failed';end if;
 if(select co.workspace_type from public.companies co join public.profiles p on p.company_id=co.id where p.id=peer)<>'sole_founder'then raise exception 'Founder signup failed';end if;
 update public.profiles set company_id=c,role='employee'where id=peer;
 perform set_config('request.jwt.claim.sub',u::text,true);rp:=private.ensure_role(u);
 perform set_config('request.jwt.claim.sub',peer::text,true);dr:=private.ensure_role(peer);
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.actions(company_id,owner_id,title,details,status,completed_at,created_at,due_date)values(c,u,'October delivery','Delivered release','done','2026-10-10 12:00Z','2026-10-01 12:00Z','2026-10-10')returning id into tid;
 insert into public.actions(company_id,owner_id,title,details,status,completed_at,created_at)values(c,u,'Completed after October','Was still open at October end','done','2026-11-02 12:00Z','2026-10-01 12:00Z'),(c,peer,'Teammate private task','NEVER INCLUDE TEAMMATE TASK','open',null,'2026-10-01 12:00Z'),(other_c,other_user,'Other company task','NEVER INCLUDE OTHER COMPANY','open',null,'2026-10-01 12:00Z');
 insert into public.decisions(company_id,owner_id,role_id,title,reason,decided_by,decided_on)values(c,u,rp,'Supplier chosen','Supplier meets deadline','Alex Personal','2026-10-10');
 insert into public.work_handovers(company_id,owner_id,created_by,role_id,title,starts_on,ends_on,created_at,sections)values(c,u,u,rp,'Operations cover','2026-10-10','2026-10-20','2026-10-01 12:00Z','{"summary":"Supplier launch cover","note_for_manager":"NEVER INCLUDE MANAGER NOTE"}');
 insert into private.role_notes(role_id,author_id,body)values(dr,peer,'NEVER INCLUDE PRIVATE NOTE');
 insert into private.myday_star_awards(company_id,owner_id,task_id,day,points,reason,source_key)values(c,u,tid,'2026-10-10',3,'October task','fixture-october'),(c,u,null,'2026-09-20',2,'Earlier month','fixture-september');
 outdata:=private.workspace_evidence('2026-10-01','2026-10-31','');
 if outdata::text like '%NEVER INCLUDE%'then raise exception 'Privacy boundary failed: %',outdata;end if;
 if not outdata::text like '%Operations cover%'then raise exception 'Handover source missing';end if;
 if not outdata::text like '%October delivery%'or not outdata::text like '%open at period end%'then raise exception 'Period evidence missing: %',outdata;end if;
 if(outdata->'stars'->>'completed_tasks')::int<>1 then raise exception 'Period completion count failed: %',outdata;end if;
 outdata:=private.workspace_evidence(null,null,'What did I finish last month?');if outdata->>'from'<>'2026-10-01'or(outdata->'stars'->>'completed_tasks')::int<>1 then raise exception 'Question period resolution failed: %',outdata;end if;
 outdata:=private.workspace_evidence(null,null,'Who chose the supplier?');if not outdata::text like '%Supplier chosen%'then raise exception 'Decision retrieval failed: %',outdata;end if;
 outdata:=private.myday_stars_period('2026-10-15','month');if(outdata->>'week')::int<>3 or(outdata->>'previous_week')::int<>2 or(outdata->>'completed_tasks')::int<>1 or outdata->>'week_end'<>'2026-10-31'then raise exception 'Monthly stars range failed: %',outdata;end if;
 select raw_app_meta_data->>'vimbre_signup_receipt'into receipt from auth.users where id=u;perform set_config('request.jwt.claim.sub','',true);if not private.claim_signup_analytics(receipt)or private.claim_signup_analytics(receipt)or private.claim_signup_analytics(repeat('0',64))then raise exception 'Signup receipt was not single use';end if;perform set_config('request.jwt.claim.sub',u::text,true);if private.claim_signup_analytics()then raise exception 'Authenticated fallback replayed signup';end if;
 perform set_config('request.jwt.claim.sub',other_user::text,true);if private.workspace_evidence(null,null,'')::text like '%October delivery%'then raise exception 'Other company read leaked';end if;
 perform set_config('request.jwt.claim.sub','',true);begin perform private.workspace_evidence();raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
end$$;
select 'workspace period, privacy, signup and monthly stars checks passed' as result;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.workspace_user'),true);
do $$begin if public.workspace_evidence('2026-10-01','2026-10-31','')->>'from'<>'2026-10-01'then raise exception 'Authenticated wrapper failed';end if;if public.myday_stars_period('2026-10-15','month')->>'period'<>'month'then raise exception 'Monthly wrapper failed';end if;end$$;
set local role anon;
do $$begin if not public.claim_signup_analytics(current_setting('test.signup_receipt'))or public.claim_signup_analytics(current_setting('test.signup_receipt'))then raise exception 'New signup receipt failed without a session';end if;if public.claim_signup_analytics(repeat('0',64))then raise exception 'Invalid receipt accepted';end if;begin perform public.workspace_evidence();raise exception 'Anonymous evidence allowed';exception when insufficient_privilege then null;end;end$$;
reset role;
