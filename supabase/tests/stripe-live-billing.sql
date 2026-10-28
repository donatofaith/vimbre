-- Append team-fixtures.sql inside a rollback transaction before these cases.
reset role;
set local role service_role;
do $$declare j jsonb;c uuid:=current_setting('test.company')::uuid;u uuid:=current_setting('test.admin')::uuid;first_end timestamptz;claim jsonb;begin
j:=public.billing_live_backend('context',jsonb_build_object('user_id',u));first_end:=(j->>'trial_ends_at')::timestamptz;
if first_end-now()<>interval '3 days' then raise exception 'Trial must be exactly three days';end if;
j:=public.billing_live_backend('context',jsonb_build_object('user_id',u));if (j->>'trial_ends_at')::timestamptz<>first_end then raise exception 'Trial reset';end if;
j:=public.billing_live_backend('bind_customer',jsonb_build_object('user_id',u,'customer_id','cus_billingfixture'));
claim:=public.billing_live_backend('checkout_claim',jsonb_build_object('user_id',u,'plan','starter'));
j:=public.billing_live_backend('checkout_claim',jsonb_build_object('user_id',u,'plan','starter'));if j->>'checkout_token'<>claim->>'checkout_token' then raise exception 'Checkout race protection failed';end if;
begin perform public.billing_live_backend('context',jsonb_build_object('user_id',current_setting('test.employee')));raise exception 'Employee may manage company billing';exception when insufficient_privilege then null;end;
j:=public.billing_live_backend('event',jsonb_build_object('event_id','evt_billingfixture','event_type','customer.subscription.updated','stripe_account','acct_1UUpbY4AwSci2kG6','livemode',true,'customer_id','cus_billingfixture','subscription_id','sub_fixture','price_id','price_1UVUXb4AwSci2kG6vvor5nsm','status','trialing','synced_at',now()));
if not(j->>'ok')::boolean then raise exception 'Event failed';end if;
j:=public.billing_live_backend('event',jsonb_build_object('event_id','evt_billingfixture','event_type','customer.subscription.updated','stripe_account','acct_1UUpbY4AwSci2kG6','livemode',true,'customer_id','cus_billingfixture','subscription_id','sub_fixture','price_id','price_1UVUXb4AwSci2kG6vvor5nsm','status','trialing','synced_at',now()));
if not(j->>'duplicate')::boolean then raise exception 'Webhook replay not idempotent';end if;
begin perform public.billing_live_backend('event',jsonb_build_object('stripe_account','acct_1UUpbY4AwSci2kG6','livemode',false));raise exception 'Test event accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$declare c uuid:=current_setting('test.company')::uuid;begin
 if not private.billing_ai_allowed(c) then raise exception 'Valid trial was blocked';end if;
 update private.billing_live_accounts set trial_ends_at=now()-interval '1 second' where company_id=c;
 if private.billing_ai_allowed(c) then raise exception 'Expired trial allowed AI';end if;
 update private.billing_live_accounts set status='active',period_ends_at=now()+interval '1 month' where company_id=c;
 if not private.billing_ai_allowed(c) or (select plan from public.ai_company_limits where company_id=c)<>'starter' then raise exception 'Paid plan did not apply';end if;
 update private.billing_live_accounts set status='past_due' where company_id=c;
 if private.billing_ai_allowed(c) then raise exception 'Failed payment allowed AI';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$begin begin perform public.billing_live_backend('context',jsonb_build_object('user_id',auth.uid()));raise exception 'Browser can call service-only billing API';exception when insufficient_privilege then null;end;end$$;

reset role;
do $$declare j jsonb;n integer;c uuid:=current_setting('test.company')::uuid;begin
 update private.billing_live_accounts set status='trialing',trial_ends_at=now()+interval '3 days',cancel_at_period_end=false where company_id=c;
 j:=public.billing_trial_delivery('claim');
 select count(*) into n from jsonb_array_elements(j) x where x->>'kind'='ending';if n<>0 then raise exception 'Reminder sent before 24-hour boundary';end if;
 update private.billing_live_accounts set trial_ends_at=now()+interval '24 hours' where company_id=c;
 j:=public.billing_trial_delivery('claim');
 select count(*) into n from jsonb_array_elements(j) x where x->>'kind'='ending';if n<>1 then raise exception 'Missing 24-hour reminder';end if;
 j:=public.billing_trial_delivery('claim');if jsonb_array_length(j)<>0 then raise exception 'Concurrent reminder claim duplicated';end if;
 update private.billing_live_accounts set subscription_id=null where company_id=c;
 if private.billing_ai_allowed(c) then raise exception 'Cardless company entered trial';end if;
end$$;

rollback;
