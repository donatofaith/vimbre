-- Keep the task projection untouched. Resolve the same guarded company once,
-- rather than twice, within each existing source-connection lookup.
create or replace function private.myday_source_connected(p_title text)returns boolean language plpgsql stable security definer set search_path=''as $$
declare provider_name text;u uuid:=auth.uid();c uuid;
begin
 if u is null then raise insufficient_privilege;end if;
 c:=private.current_company_id();if c is null then raise insufficient_privilege;end if;
 provider_name:=case split_part(p_title,':',1)when 'Gmail'then 'gmail'when 'Google Drive'then 'drive'when 'Outlook'then 'outlook'when 'Microsoft Teams'then 'teams'when 'Slack'then 'slack'when 'Trello'then 'trello'else null end;
 if provider_name is null then return null;end if;
 return exists(select 1 from private.capture_connections where user_id=u and company_id=c and provider=provider_name);
end $$;
