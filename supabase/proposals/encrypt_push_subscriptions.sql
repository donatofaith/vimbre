-- Keep only a SHA-256 endpoint lookup and an encrypted Vault reference in the device table.
alter table private.myday_push add column subscription_secret_id uuid;

update private.myday_push
set subscription_secret_id=vault.create_secret(subscription::text),
    endpoint=encode(extensions.digest(endpoint,'sha256'),'hex');

alter table private.myday_push alter column subscription_secret_id set not null;
alter table private.myday_push add constraint myday_push_endpoint_digest check(endpoint ~ '^[0-9a-f]{64}$');

create function private.save_encrypted_push(p_owner uuid,p_company uuid,p_subscription jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare
 lookup text:=encode(extensions.digest(p_subscription->>'endpoint','sha256'),'hex');
 existing uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(lookup,0));
 select subscription_secret_id into existing from private.myday_push where endpoint=lookup for update;
 if found then
  perform vault.update_secret(existing,p_subscription::text);
  update private.myday_push set owner_id=p_owner,company_id=p_company where endpoint=lookup;
 else
  insert into private.myday_push(owner_id,company_id,endpoint,subscription_secret_id)
  values(p_owner,p_company,lookup,vault.create_secret(p_subscription::text));
 end if;
end$$;
revoke all on function private.save_encrypted_push(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function private.remove_push_vault_secret()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from vault.secrets where id=old.subscription_secret_id;
 return old;
end$$;
revoke all on function private.remove_push_vault_secret() from public,anon,authenticated,service_role;
create trigger remove_push_vault_secret after delete on private.myday_push
for each row execute function private.remove_push_vault_secret();

do $patch$
declare
 writer text:=pg_get_functiondef('private.myday_suite_role_notice_base(text,uuid,jsonb)'::regprocedure);
 delivery text:=pg_get_functiondef('public.myday_delivery(text,uuid,jsonb)'::regprocedure);
 old_write text:=$old$insert into private.myday_push(owner_id,company_id,endpoint,subscription) values(u,c,p_data->>'endpoint',p_data) on conflict(endpoint) do update set owner_id=excluded.owner_id,company_id=excluded.company_id,subscription=excluded.subscription;$old$;
 old_read text:=$old$select jsonb_agg(subscription) from private.myday_push where owner_id=p.id and company_id=p.company_id$old$;
 old_lookup text:=$old$endpoint=p_data->>'endpoint'$old$;
 new_lookup text:=$new$endpoint=encode(extensions.digest(p_data->>'endpoint','sha256'),'hex')$new$;
begin
 if strpos(writer,old_write)=0 or strpos(delivery,old_read)=0
   or strpos(writer,old_lookup)=0 or strpos(delivery,old_lookup)=0 then
  raise exception 'Push subscription function changed since review';
 end if;
 execute replace(replace(writer,old_write,'perform private.save_encrypted_push(u,c,p_data);'),old_lookup,new_lookup);
 execute replace(replace(delivery,old_read,
   'select jsonb_agg(s.decrypted_secret::jsonb) from private.myday_push d join vault.decrypted_secrets s on s.id=d.subscription_secret_id where d.owner_id=p.id and d.company_id=p.company_id'),old_lookup,new_lookup);
end
$patch$;

alter table private.myday_push drop column subscription;
