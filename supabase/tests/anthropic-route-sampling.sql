-- Regression test for the Claude 5.5 route contract.
-- Run after applying migrations to a local/test database (no provider calls).
do $$
declare
  invalid_routes text[];
begin
  select array_agg(r.task order by r.task)
  into invalid_routes
  from public.ai_task_routes r
  join public.ai_models p on p.id = r.primary_model_id
  left join public.ai_models f on f.id = r.fallback_model_id
  where r.enabled
    and r.temperature is not null
    and (p.provider = 'anthropic' or f.provider = 'anthropic');

  if coalesce(cardinality(invalid_routes), 0) > 0 then
    raise exception 'Anthropic routes still configure unsupported temperature: %',
      array_to_string(invalid_routes, ', ');
  end if;

  if not exists (
    select 1
    from public.ai_task_routes r
    join public.ai_models p on p.id = r.primary_model_id
    where r.task = 'day_plan'
      and r.enabled
      and p.provider = 'anthropic'
      and r.temperature is null
  ) then
    raise exception 'The day_plan route must be enabled and compatible with Anthropic';
  end if;
end
$$;
