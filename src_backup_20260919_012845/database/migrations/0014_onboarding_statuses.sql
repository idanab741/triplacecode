-- Independent completion state for each onboarding group.
alter table public.profiles
  add column if not exists main_onboarding_completed_at timestamptz,
  add column if not exists tripmatch_onboarding_completed_at timestamptz,
  add column if not exists tripbuilding_onboarding_completed_at timestamptz;

-- Preserve completion for existing deployments that already have the legacy columns.
-- Dynamic SQL keeps a fresh database (where those columns never existed) valid too.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'intro_completed_at') then
    execute 'update public.profiles set main_onboarding_completed_at = coalesce(main_onboarding_completed_at, intro_completed_at) where main_onboarding_completed_at is null and intro_completed_at is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'chat_onboarding_completed_at') then
    execute 'update public.profiles set tripbuilding_onboarding_completed_at = coalesce(tripbuilding_onboarding_completed_at, chat_onboarding_completed_at) where tripbuilding_onboarding_completed_at is null and chat_onboarding_completed_at is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'planner_onboarding_completed_at') then
    execute 'update public.profiles set tripbuilding_onboarding_completed_at = coalesce(tripbuilding_onboarding_completed_at, planner_onboarding_completed_at) where tripbuilding_onboarding_completed_at is null and planner_onboarding_completed_at is not null';
  end if;
end $$;
