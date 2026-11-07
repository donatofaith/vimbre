create or replace function private.capture_recording_allowance(p_user uuid, p_consume boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  workspace uuid;
  allowance jsonb;
  today date := (now() at time zone 'UTC')::date;
begin
  select company_id into workspace from public.profiles where id = p_user and active;
  if workspace is null or not private.billing_ai_allowed(workspace) then return 'access_denied'; end if;

  allowance := private.ai_allowance_status(workspace);
  if not coalesce((allowance->>'enabled')::boolean, false)
     or coalesce((allowance->>'blocked')::boolean, true) then
    return 'access_denied';
  end if;

  if p_consume then
    insert into private.capture_recording_usage as usage (user_id, utc_day, requests)
    values (p_user, today, 1)
    on conflict (user_id) do update
      set utc_day = excluded.utc_day,
          requests = case when usage.utc_day = excluded.utc_day then usage.requests + 1 else 1 end
      where usage.utc_day < excluded.utc_day
        or (usage.utc_day = excluded.utc_day and usage.requests < 3);
    if not found then return 'recording_limit'; end if;
  elsif exists (select 1 from private.capture_recording_usage where user_id = p_user and utc_day = today and requests >= 3) then
    -- Keep the recorder visible so the user can see the daily limit.
    return 'recording_limit';
  end if;

  return 'allowed';
end;
$$;
