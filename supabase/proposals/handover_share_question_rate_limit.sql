-- Keep guest access capability-scoped and serialize submissions against the share row.
create index if not exists handover_external_questions_share_created_at
  on private.handover_external_questions(share_id,created_at);

CREATE OR REPLACE FUNCTION public.handover_share_question(p_token text, p_body text, p_email text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sh private.handover_shares; h public.work_handovers; body text:=btrim(coalesce(p_body,'')); who text:=left(btrim(coalesce(p_email,'')),320);
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' or length(body) not between 1 and 3000 then raise invalid_parameter_value; end if;
 select * into sh from private.handover_shares where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and revoked_at is null and expires_at>now() for update;
 if not found then raise insufficient_privilege; end if;
 select handover.* into h
 from public.work_handovers handover
 join private.handover_policy policy on policy.company_id=handover.company_id and policy.external_sharing
 where handover.id=sh.handover_id and handover.deleted_at is null
   and handover.status in ('approved','completed');
 if not found then raise insufficient_privilege; end if;
 if (select count(*) from private.handover_external_questions q
     where q.share_id=sh.id and q.created_at>=now()-interval '1 hour')>=5 then
  raise sqlstate 'PT429' using message='Too many questions for this shared handover. Try again later.';
 end if;
 insert into private.handover_external_questions(share_id,handover_id,company_id,sender_email,body) values(sh.id,h.id,h.company_id,who,body);
 insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.owner_id,'A question was sent about your shared handover.');
 if h.reviewer_id is not null then insert into private.handover_notifications(handover_id,owner_id,message) values(h.id,h.reviewer_id,'A question was sent about a shared handover.'); end if;
 perform private.handover_event(h.id,'external_question_asked');
 return jsonb_build_object('ok',true);
end$function$;
