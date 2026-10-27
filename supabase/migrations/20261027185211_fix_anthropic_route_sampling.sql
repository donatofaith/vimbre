-- Anthropic's current Claude 5.5 adapter intentionally sends no custom sampling
-- parameters and rejects non-NULL route temperatures. Keep the database route
-- aligned with that provider contract, including primary or fallback Anthropic routes.
update public.ai_task_routes r
set temperature = null
where r.temperature is not null
  and (
    exists (
      select 1
      from public.ai_models m
      where m.id = r.primary_model_id
        and m.provider = 'anthropic'
    )
    or exists (
      select 1
      from public.ai_models m
      where m.id = r.fallback_model_id
        and m.provider = 'anthropic'
    )
  );

-- Fail the migration if any enabled Anthropic route is still configured with
-- a setting the adapter cannot use. This is deliberately fail-closed.
do $$
begin
  if exists (
    select 1
    from public.ai_task_routes r
    join public.ai_models p on p.id = r.primary_model_id
    left join public.ai_models f on f.id = r.fallback_model_id
    where r.enabled
      and r.temperature is not null
      and (p.provider = 'anthropic' or f.provider = 'anthropic')
  ) then
    raise exception 'Enabled Anthropic AI routes must use NULL temperature';
  end if;
end
$$;
