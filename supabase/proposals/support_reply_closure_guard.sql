-- Preserve customer-only closure. Non-closure updates do not evaluate Auth
-- helpers under the restricted Console execution role.
create or replace function private.support_customer_closure_guard()returns trigger language plpgsql set search_path=''as $$
begin
 if new.status='resolved'and old.status is distinct from new.status then
  if old.customer_user_id is null then raise insufficient_privilege using message='Only the customer can close this conversation';end if;
  if auth.uid()is distinct from old.customer_user_id then raise insufficient_privilege using message='Only the customer can close this conversation';end if;
 end if;
 return new;
end $$;
