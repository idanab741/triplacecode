-- ========================================================================
-- Migration 0003: user_preferences table + RLS + extending the
-- auto-create trigger from migration 0001 to also create this row.
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

create table public.user_preferences (
  id uuid primary key references auth.users (id) on delete cascade,
  culinary_styles text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  kosher boolean not null default false,
  accessibility boolean not null default false,
  transportation text[] not null default '{}',
  interests text[] not null default '{}',
  accommodation_types text[] not null default '{}',
  vacation_preferences text[] not null default '{}',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can view their own preferences"
  on public.user_preferences for select
  using (auth.uid() = id);

create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = id);

create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = id);

-- משתמש חוזר ב-set_updated_at() שכבר נוצרה במיגרציה 0001
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- מרחיב את הטריגר הקיים (ממיגרציה 0001) כך שייצור גם שורת העדפות ריקה
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_preferences (id) values (new.id);
  return new;
end;
$$;

-- מילוי חד-פעמי למשתמשים קיימים שנרשמו לפני המיגרציה הזו
insert into public.user_preferences (id)
select id from auth.users
on conflict (id) do nothing;
